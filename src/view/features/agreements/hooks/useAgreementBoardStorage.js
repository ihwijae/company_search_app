import React from 'react';

const DEFAULT_FILTERS = {
  ownerId: '',
  rangeId: '',
  industryLabel: '',
  amountMin: '',
  amountMax: '',
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
  dutyRegions,
  safeGroupSize,
  fileType,
  netCostAmount,
  aValue,
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
  onUpdateBoard,
  showHeaderAlert,
  parseNumeric,
}) {
  const [loadModalOpen, setLoadModalOpen] = React.useState(false);
  const [loadItems, setLoadItems] = React.useState([]);
  const [loadFilters, setLoadFilters] = React.useState({ ...DEFAULT_FILTERS });
  const [loadBusy, setLoadBusy] = React.useState(false);
  const [loadError, setLoadError] = React.useState('');

  const buildAgreementSnapshot = React.useCallback(() => ({
    meta: {
      ownerId,
      ownerLabel: ownerDisplayLabel,
      rangeId: selectedRangeOption?.key || '',
      rangeLabel: selectedRangeOption?.label || '',
      industryLabel: industryLabel || '',
      estimatedAmount: parseNumeric(estimatedAmount),
      estimatedAmountLabel: estimatedAmount || '',
      noticeDate: noticeDate || '',
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
      dutyRegions: Array.isArray(dutyRegions) ? dutyRegions.slice() : [],
      groupSize: safeGroupSize,
      fileType: fileType || '',
      netCostAmount: netCostAmount || '',
      aValue: aValue || '',
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
    dutyRegions,
    safeGroupSize,
    fileType,
    netCostAmount,
    aValue,
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

  const openLoadModal = React.useCallback(async () => {
    setLoadModalOpen(true);
    await refreshLoadList();
  }, [refreshLoadList]);

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
      dutyRegions: Array.isArray(snapshot.dutyRegions) ? snapshot.dutyRegions : [],
      groupSize: snapshot.groupSize || safeGroupSize,
      fileType: snapshot.fileType || fileType,
      netCostAmount: snapshot.netCostAmount || '',
      aValue: snapshot.aValue || '',
      candidates: Array.isArray(snapshot.candidates) ? snapshot.candidates : [],
      pinned: Array.isArray(snapshot.pinned) ? snapshot.pinned : [],
      excluded: Array.isArray(snapshot.excluded) ? snapshot.excluded : [],
      alwaysInclude: Array.isArray(snapshot.alwaysInclude) ? snapshot.alwaysInclude : [],
    };
    if (typeof onUpdateBoard === 'function') onUpdateBoard(next);
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

  const filteredLoadItems = React.useMemo(() => {
    const ownerFilter = String(loadFilters.ownerId || '').trim();
    const rangeFilter = String(loadFilters.rangeId || '').trim();
    const industryFilter = String(loadFilters.industryLabel || '').trim();
    const amountMin = parseNumeric(loadFilters.amountMin);
    const amountMax = parseNumeric(loadFilters.amountMax);
    return (loadItems || []).filter((item) => {
      const meta = item?.meta || {};
      if (ownerFilter && String(meta.ownerId || '') !== ownerFilter) return false;
      if (rangeFilter && String(meta.rangeId || '') !== rangeFilter) return false;
      if (industryFilter && String(meta.industryLabel || '') !== industryFilter) return false;
      const amount = parseNumeric(meta.estimatedAmount ?? meta.estimatedAmountLabel);
      if (Number.isFinite(amountMin) && amount != null && amount < amountMin) return false;
      if (Number.isFinite(amountMax) && amount != null && amount > amountMax) return false;
      if ((Number.isFinite(amountMin) || Number.isFinite(amountMax)) && amount == null) return false;
      return true;
    });
  }, [loadFilters, loadItems, parseNumeric]);

  return {
    loadModalOpen,
    loadFilters,
    loadItems: filteredLoadItems,
    loadBusy,
    loadError,
    setLoadFilters,
    openLoadModal,
    closeLoadModal,
    handleSaveAgreement,
    handleLoadAgreement,
    refreshLoadList,
    resetFilters: () => setLoadFilters({ ...DEFAULT_FILTERS }),
  };
}
