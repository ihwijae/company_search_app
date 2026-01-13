import React from 'react';

const DEFAULT_FILTERS = {
  ownerId: '',
  rangeId: '',
  industryLabel: '',
  dutyRegion: '',
  amountMin: '',
  amountMax: '',
  sortOrder: 'noticeDateDesc',
};

export default function useAgreementBoardStorage({
  ownerId,
  ownerDisplayLabel,
  selectedRangeOption,
  industryLabel,
  estimatedAmount,
  noticeDate,
  baseAmount,
  bidAmount,
  ratioBaseAmount,
  bidRate,
  adjustmentRate,
  entryAmount,
  entryModeResolved,
  noticeNo,
  noticeTitle,
  bidDeadline,
  regionDutyRate,
  participantLimit,
  dutyRegions,
  safeGroupSize,
  fileType,
  netCostAmount,
  aValue,
  memoHtml,
  candidates,
  pinned,
  excluded,
  alwaysInclude,
  groupAssignments,
  groupShares,
  groupShareRawInputs,
  groupCredibility,
  groupApprovals,
  groupManagementBonus,
  setGroupAssignments,
  setGroupShares,
  setGroupShareRawInputs,
  setGroupCredibility,
  setGroupApprovals,
  setGroupManagementBonus,
  markSkipAssignmentSync,
  onUpdateBoard,
  showHeaderAlert,
  parseNumeric,
}) {
  const [loadModalOpen, setLoadModalOpen] = React.useState(false);
  const [loadItems, setLoadItems] = React.useState([]);
  const [loadFilters, setLoadFilters] = React.useState({ ...DEFAULT_FILTERS });
  const [loadBusy, setLoadBusy] = React.useState(false);
  const [loadError, setLoadError] = React.useState('');
  const [loadRootPath, setLoadRootPath] = React.useState('');

  const buildAgreementSnapshot = React.useCallback(() => ({
    meta: {
      ownerId,
      ownerLabel: ownerDisplayLabel,
      rangeId: selectedRangeOption?.key || '',
      rangeLabel: selectedRangeOption?.label || '',
      industryLabel: industryLabel || '',
      dutyRegions: Array.isArray(dutyRegions) ? dutyRegions.slice() : [],
      estimatedAmount: parseNumeric(estimatedAmount),
      estimatedAmountLabel: estimatedAmount || '',
      noticeDate: noticeDate || '',
      noticeNo: noticeNo || '',
      noticeTitle: noticeTitle || '',
    },
    payload: {
      ownerId,
      rangeId: selectedRangeOption?.key || '',
      industryLabel: industryLabel || '',
      estimatedAmount: estimatedAmount || '',
      baseAmount: baseAmount || '',
      bidAmount: bidAmount || '',
      ratioBaseAmount: ratioBaseAmount || '',
      bidRate: bidRate || '',
      adjustmentRate: adjustmentRate || '',
      entryAmount: entryAmount || '',
      entryMode: entryModeResolved || '',
      noticeNo: noticeNo || '',
      noticeTitle: noticeTitle || '',
      noticeDate: noticeDate || '',
      bidDeadline: bidDeadline || '',
      regionDutyRate: regionDutyRate || '',
      participantLimit: participantLimit || safeGroupSize,
      dutyRegions: Array.isArray(dutyRegions) ? dutyRegions.slice() : [],
      groupSize: safeGroupSize,
      fileType: fileType || '',
      netCostAmount: netCostAmount || '',
      aValue: aValue || '',
      memoHtml: memoHtml || '',
      candidates: Array.isArray(candidates) ? candidates : [],
      pinned: Array.isArray(pinned) ? pinned : [],
      excluded: Array.isArray(excluded) ? excluded : [],
      alwaysInclude: Array.isArray(alwaysInclude) ? alwaysInclude : [],
      groupAssignments: Array.isArray(groupAssignments) ? groupAssignments : [],
      groupShares: Array.isArray(groupShares) ? groupShares : [],
      groupShareRawInputs: Array.isArray(groupShareRawInputs) ? groupShareRawInputs : [],
      groupCredibility: Array.isArray(groupCredibility) ? groupCredibility : [],
      groupApprovals: Array.isArray(groupApprovals) ? groupApprovals : [],
      groupManagementBonus: Array.isArray(groupManagementBonus) ? groupManagementBonus : [],
    },
  }), [
    ownerId,
    ownerDisplayLabel,
    selectedRangeOption?.key,
    selectedRangeOption?.label,
    industryLabel,
    estimatedAmount,
    noticeDate,
    baseAmount,
    bidAmount,
    ratioBaseAmount,
    bidRate,
    adjustmentRate,
    entryAmount,
    entryModeResolved,
    noticeNo,
    noticeTitle,
    bidDeadline,
    regionDutyRate,
    participantLimit,
    dutyRegions,
    safeGroupSize,
    fileType,
    netCostAmount,
    aValue,
    memoHtml,
    candidates,
    pinned,
    excluded,
    alwaysInclude,
    groupAssignments,
    groupShares,
    groupShareRawInputs,
    groupCredibility,
    groupApprovals,
    groupManagementBonus,
    parseNumeric,
  ]);

  const handleSaveAgreement = React.useCallback(async () => {
    const payload = buildAgreementSnapshot();
    try {
      const result = await window.electronAPI?.agreementBoardSave?.(payload);
      if (!result?.success) throw new Error(result?.message || '저장 실패');
      showHeaderAlert('협정 저장 완료');
    } catch (err) {
      showHeaderAlert(err?.message || '협정 저장 실패');
    }
  }, [buildAgreementSnapshot, showHeaderAlert]);

  const refreshLoadList = React.useCallback(async () => {
    setLoadBusy(true);
    setLoadError('');
    try {
      const result = await window.electronAPI?.agreementBoardList?.();
      if (!result?.success) throw new Error(result?.message || '불러오기 목록 실패');
      setLoadItems(Array.isArray(result.data) ? result.data : []);
    } catch (err) {
      setLoadItems([]);
      setLoadError(err?.message || '불러오기 목록 실패');
    } finally {
      setLoadBusy(false);
    }
  }, []);

  const refreshLoadRoot = React.useCallback(async () => {
    try {
      const result = await window.electronAPI?.agreementBoardGetRoot?.();
      if (result?.success && result?.path) {
        setLoadRootPath(result.path);
      }
    } catch {}
  }, []);

  const openLoadModal = React.useCallback(async () => {
    setLoadModalOpen(true);
    await Promise.all([refreshLoadRoot(), refreshLoadList()]);
  }, [refreshLoadList, refreshLoadRoot]);

  const closeLoadModal = React.useCallback(() => {
    setLoadModalOpen(false);
    setLoadError('');
  }, []);

  const applyAgreementSnapshot = React.useCallback((snapshot) => {
    if (!snapshot || typeof snapshot !== 'object') return;
    const next = {
      ownerId: snapshot.ownerId || ownerId,
      rangeId: snapshot.rangeId || null,
      industryLabel: snapshot.industryLabel || '',
      estimatedAmount: snapshot.estimatedAmount || '',
      baseAmount: snapshot.baseAmount || '',
      bidAmount: snapshot.bidAmount || '',
      ratioBaseAmount: snapshot.ratioBaseAmount || '',
      bidRate: snapshot.bidRate || '',
      adjustmentRate: snapshot.adjustmentRate || '',
      entryAmount: snapshot.entryAmount || '',
      entryMode: snapshot.entryMode || entryModeResolved,
      noticeNo: snapshot.noticeNo || '',
      noticeTitle: snapshot.noticeTitle || '',
      noticeDate: snapshot.noticeDate || '',
      bidDeadline: snapshot.bidDeadline || '',
      regionDutyRate: snapshot.regionDutyRate || '',
      participantLimit: snapshot.participantLimit || safeGroupSize,
      dutyRegions: Array.isArray(snapshot.dutyRegions) ? snapshot.dutyRegions : [],
      groupSize: snapshot.groupSize || safeGroupSize,
      fileType: snapshot.fileType || fileType,
      netCostAmount: snapshot.netCostAmount || '',
      aValue: snapshot.aValue || '',
      memoHtml: snapshot.memoHtml || '',
      candidates: Array.isArray(snapshot.candidates) ? snapshot.candidates : [],
      pinned: Array.isArray(snapshot.pinned) ? snapshot.pinned : [],
      excluded: Array.isArray(snapshot.excluded) ? snapshot.excluded : [],
      alwaysInclude: Array.isArray(snapshot.alwaysInclude) ? snapshot.alwaysInclude : [],
    };
    if (typeof onUpdateBoard === 'function') onUpdateBoard(next);
    if (typeof markSkipAssignmentSync === 'function') markSkipAssignmentSync();
    if (Array.isArray(snapshot.groupAssignments)) setGroupAssignments(snapshot.groupAssignments);
    if (Array.isArray(snapshot.groupShares)) setGroupShares(snapshot.groupShares);
    if (Array.isArray(snapshot.groupShareRawInputs)) setGroupShareRawInputs(snapshot.groupShareRawInputs);
    if (Array.isArray(snapshot.groupCredibility)) setGroupCredibility(snapshot.groupCredibility);
    if (Array.isArray(snapshot.groupApprovals)) setGroupApprovals(snapshot.groupApprovals);
    if (Array.isArray(snapshot.groupManagementBonus)) setGroupManagementBonus(snapshot.groupManagementBonus);
  }, [
    entryModeResolved,
    fileType,
    onUpdateBoard,
    ownerId,
    safeGroupSize,
    setGroupAssignments,
    setGroupShares,
    setGroupShareRawInputs,
    setGroupCredibility,
    setGroupApprovals,
    setGroupManagementBonus,
    markSkipAssignmentSync,
  ]);

  const handleLoadAgreement = React.useCallback(async (path) => {
    if (!path) return;
    setLoadBusy(true);
    try {
      const result = await window.electronAPI?.agreementBoardLoad?.(path);
      if (!result?.success) throw new Error(result?.message || '불러오기 실패');
      applyAgreementSnapshot(result.data || {});
      showHeaderAlert('협정 불러오기 완료');
      setLoadModalOpen(false);
    } catch (err) {
      setLoadError(err?.message || '불러오기 실패');
    } finally {
      setLoadBusy(false);
    }
  }, [applyAgreementSnapshot, showHeaderAlert]);

  const handleDeleteAgreement = React.useCallback(async (path, confirm) => {
    if (!path || typeof confirm !== 'function') return;
    const ok = await confirm({
      title: '협정을 삭제하시겠습니까?',
      message: '삭제한 협정은 복구할 수 없습니다.',
      confirmText: '예',
      cancelText: '아니오',
      tone: 'warning',
    });
    if (!ok) return;
    setLoadBusy(true);
    setLoadError('');
    try {
      const result = await window.electronAPI?.agreementBoardDelete?.(path);
      if (!result?.success) throw new Error(result?.message || '삭제 실패');
      showHeaderAlert('협정 삭제 완료');
      await refreshLoadList();
    } catch (err) {
      setLoadError(err?.message || '삭제 실패');
    } finally {
      setLoadBusy(false);
    }
  }, [refreshLoadList, showHeaderAlert]);

  const handlePickRoot = React.useCallback(async () => {
    setLoadBusy(true);
    setLoadError('');
    try {
      const result = await window.electronAPI?.agreementBoardPickRoot?.();
      if (!result?.success) {
        if (result?.canceled) return;
        throw new Error(result?.message || '폴더 선택 실패');
      }
      if (result?.path) setLoadRootPath(result.path);
      await refreshLoadList();
    } catch (err) {
      setLoadError(err?.message || '폴더 선택 실패');
    } finally {
      setLoadBusy(false);
    }
  }, [refreshLoadList]);

  const filteredLoadItems = React.useMemo(() => {
    const ownerFilter = String(loadFilters.ownerId || '').trim();
    const rangeFilter = String(loadFilters.rangeId || '').trim();
    const industryFilter = String(loadFilters.industryLabel || '').trim();
    const dutyFilter = String(loadFilters.dutyRegion || '').trim();
    const amountMin = parseNumeric(loadFilters.amountMin);
    const amountMax = parseNumeric(loadFilters.amountMax);
    const getNoticeDateValue = (value) => {
      if (!value) return null;
      const parsed = Date.parse(value);
      if (Number.isNaN(parsed)) return null;
      return parsed;
    };
    const filtered = (loadItems || []).filter((item) => {
      const meta = item?.meta || {};
      if (ownerFilter && String(meta.ownerId || '') !== ownerFilter) return false;
      if (rangeFilter && String(meta.rangeId || '') !== rangeFilter) return false;
      if (industryFilter && String(meta.industryLabel || '') !== industryFilter) return false;
      if (dutyFilter) {
        const regions = Array.isArray(meta.dutyRegions) ? meta.dutyRegions : [];
        if (!regions.some((region) => String(region || '') === dutyFilter)) return false;
      }
      const amount = parseNumeric(meta.estimatedAmount ?? meta.estimatedAmountLabel);
      if (Number.isFinite(amountMin) && amount != null && amount < amountMin) return false;
      if (Number.isFinite(amountMax) && amount != null && amount > amountMax) return false;
      if ((Number.isFinite(amountMin) || Number.isFinite(amountMax)) && amount == null) return false;
      return true;
    });
    const sortOrder = loadFilters.sortOrder === 'noticeDateAsc' ? 'noticeDateAsc' : 'noticeDateDesc';
    return filtered.sort((a, b) => {
      const aTime = getNoticeDateValue(a?.meta?.noticeDate);
      const bTime = getNoticeDateValue(b?.meta?.noticeDate);
      if (aTime != null && bTime != null) {
        return sortOrder === 'noticeDateAsc' ? (aTime - bTime) : (bTime - aTime);
      }
      if (aTime != null) return sortOrder === 'noticeDateAsc' ? 1 : -1;
      if (bTime != null) return sortOrder === 'noticeDateAsc' ? -1 : 1;
      const aKey = String(a?.meta?.noticeTitle || a?.meta?.noticeNo || a?.path || '');
      const bKey = String(b?.meta?.noticeTitle || b?.meta?.noticeNo || b?.path || '');
      return aKey.localeCompare(bKey, 'ko');
    });
  }, [loadFilters, loadItems, parseNumeric]);

  const dutyRegionOptions = React.useMemo(() => {
    const set = new Set();
    (loadItems || []).forEach((item) => {
      const regions = item?.meta?.dutyRegions;
      if (Array.isArray(regions)) {
        regions.forEach((region) => {
          if (region) set.add(String(region));
        });
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ko'));
  }, [loadItems]);

  return {
    loadModalOpen,
    loadFilters,
    loadItems: filteredLoadItems,
    loadBusy,
    loadError,
    loadRootPath,
    dutyRegionOptions,
    setLoadFilters,
    openLoadModal,
    closeLoadModal,
    handleSaveAgreement,
    handleLoadAgreement,
    handleDeleteAgreement,
    handlePickRoot,
    refreshLoadList,
    resetFilters: () => setLoadFilters({ ...DEFAULT_FILTERS }),
  };
}
