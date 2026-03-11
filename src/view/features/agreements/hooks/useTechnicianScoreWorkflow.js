import React from 'react';
import {
  computeTechnicianScore,
  roundTo,
} from '../../../../shared/agreements/calculations/technicianScore.js';

export default function useTechnicianScoreWorkflow({
  technicianModalOpen,
  setTechnicianModalOpen,
  initialTechnicianEntriesByTarget,
  groupAssignments,
  participantMap,
  slotLabels,
  getCompanyName,
  getBizNo,
  normalizeBizNo,
  onUpdateBoard,
  technicianEditable,
  setGroupTechnicianScores,
}) {
  const [technicianEntries, setTechnicianEntries] = React.useState([]);
  const technicianEntriesByTargetRef = React.useRef({});
  const technicianEntriesTargetKeyRef = React.useRef('0:0');
  const [technicianTarget, setTechnicianTarget] = React.useState({ groupIndex: 0, slotIndex: 0 });

  const openTechnicianModal = React.useCallback(() => {
    setTechnicianModalOpen(true);
  }, []);

  const closeTechnicianModal = React.useCallback(() => {
    setTechnicianModalOpen(false);
  }, []);

  const addTechnicianEntry = React.useCallback(() => {
    setTechnicianEntries((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        grade: '',
        careerCoeff: 'none',
        managementCoeff: 'none',
        count: '1',
      },
    ]);
  }, []);

  const updateTechnicianEntry = React.useCallback((id, field, value) => {
    setTechnicianEntries((prev) => prev.map((entry) => (
      entry.id === id ? { ...entry, [field]: value } : entry
    )));
  }, []);

  const removeTechnicianEntry = React.useCallback((id) => {
    setTechnicianEntries((prev) => prev.filter((entry) => entry.id !== id));
  }, []);

  const technicianScoreTotal = React.useMemo(() => (
    technicianEntries.reduce((sum, entry) => sum + computeTechnicianScore(entry), 0)
  ), [technicianEntries]);

  const resolveTechnicianStorageKeyBySlot = React.useCallback((groupIndex, slotIndex) => {
    const uid = groupAssignments?.[groupIndex]?.[slotIndex];
    if (!uid) return '';
    const entry = participantMap.get(uid);
    const candidate = entry?.candidate;
    if (candidate && typeof candidate === 'object') {
      const bizNo = normalizeBizNo(getBizNo(candidate));
      if (bizNo) return `biz:${bizNo}`;
      if (candidate.id != null && candidate.id !== '') return `id:${String(candidate.id)}`;
      const name = String(getCompanyName(candidate) || '').trim().toLowerCase();
      if (name) return `name:${name}`;
    }
    return `uid:${uid}`;
  }, [getBizNo, getCompanyName, groupAssignments, normalizeBizNo, participantMap]);

  const resolveTechnicianStorageKeyByTarget = React.useCallback((target) => {
    if (!target || typeof target !== 'object') return '';
    return resolveTechnicianStorageKeyBySlot(target.groupIndex, target.slotIndex);
  }, [resolveTechnicianStorageKeyBySlot]);

  React.useEffect(() => {
    const incoming = (
      initialTechnicianEntriesByTarget && typeof initialTechnicianEntriesByTarget === 'object'
        ? { ...initialTechnicianEntriesByTarget }
        : {}
    );
    const migrated = { ...incoming };
    Object.entries(incoming).forEach(([legacyKey, entries]) => {
      if (!Array.isArray(entries)) return;
      const match = /^(\d+):(\d+)$/.exec(String(legacyKey));
      if (!match) return;
      const groupIndex = Number(match[1]);
      const slotIndex = Number(match[2]);
      if (!Number.isInteger(groupIndex) || !Number.isInteger(slotIndex)) return;
      const candidateKey = resolveTechnicianStorageKeyBySlot(groupIndex, slotIndex);
      if (!candidateKey) return;
      if (!Array.isArray(migrated[candidateKey])) {
        migrated[candidateKey] = entries;
      }
      delete migrated[legacyKey];
    });
    technicianEntriesByTargetRef.current = migrated;
  }, [initialTechnicianEntriesByTarget, resolveTechnicianStorageKeyBySlot]);

  React.useEffect(() => {
    if (!technicianModalOpen) return;
    const activeKey = resolveTechnicianStorageKeyByTarget(technicianTarget);
    technicianEntriesTargetKeyRef.current = activeKey;
    const stored = activeKey ? technicianEntriesByTargetRef.current[activeKey] : [];
    setTechnicianEntries(Array.isArray(stored) ? stored : []);
  }, [technicianModalOpen, technicianTarget, resolveTechnicianStorageKeyByTarget]);

  React.useEffect(() => {
    if (!technicianModalOpen) return;
    const key = technicianEntriesTargetKeyRef.current || resolveTechnicianStorageKeyByTarget(technicianTarget);
    if (!key) return;
    const nextMap = { ...technicianEntriesByTargetRef.current, [key]: technicianEntries };
    technicianEntriesByTargetRef.current = nextMap;
    if (typeof onUpdateBoard === 'function') onUpdateBoard({ technicianEntriesByTarget: nextMap });
  }, [onUpdateBoard, resolveTechnicianStorageKeyByTarget, technicianEntries, technicianModalOpen, technicianTarget]);

  const technicianTargetOptions = React.useMemo(() => (
    groupAssignments.flatMap((row, groupIndex) => (
      slotLabels.map((label, slotIndex) => {
        const uid = row?.[slotIndex];
        const entry = uid ? participantMap.get(uid) : null;
        const name = entry?.candidate ? getCompanyName(entry.candidate) : '';
        const suffix = name ? ` - ${name}` : '';
        return {
          key: `${groupIndex}:${slotIndex}`,
          groupIndex,
          slotIndex,
          label: `${groupIndex + 1}번 ${label}${suffix}`,
        };
      })
    ))
  ), [getCompanyName, groupAssignments, participantMap, slotLabels]);

  React.useEffect(() => {
    if (!technicianTargetOptions.length) return;
    const exists = technicianTargetOptions.some(
      (option) => option.groupIndex === technicianTarget.groupIndex && option.slotIndex === technicianTarget.slotIndex,
    );
    if (!exists) {
      const first = technicianTargetOptions[0];
      setTechnicianTarget({ groupIndex: first.groupIndex, slotIndex: first.slotIndex });
    }
  }, [technicianTarget.groupIndex, technicianTarget.slotIndex, technicianTargetOptions]);

  const applyTechnicianScoreToTarget = React.useCallback(() => {
    if (!technicianEditable) return;
    if (!technicianTargetOptions.length) return;
    const resolved = roundTo(technicianScoreTotal, 2);
    if (resolved == null) return;
    setGroupTechnicianScores((prev) => {
      const next = prev.map((row) => row.slice());
      const { groupIndex, slotIndex } = technicianTarget;
      while (next.length <= groupIndex) next.push([]);
      while (next[groupIndex].length <= slotIndex) next[groupIndex].push('');
      next[groupIndex][slotIndex] = String(resolved);
      return next;
    });
  }, [setGroupTechnicianScores, technicianEditable, technicianScoreTotal, technicianTarget, technicianTargetOptions.length]);

  const handleSaveTechnicianScore = React.useCallback(() => {
    applyTechnicianScoreToTarget();
    closeTechnicianModal();
  }, [applyTechnicianScoreToTarget, closeTechnicianModal]);

  return {
    technicianEntries,
    technicianTarget,
    setTechnicianTarget,
    technicianScoreTotal,
    technicianTargetOptions,
    openTechnicianModal,
    closeTechnicianModal,
    addTechnicianEntry,
    updateTechnicianEntry,
    removeTechnicianEntry,
    handleSaveTechnicianScore,
  };
}
