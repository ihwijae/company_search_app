import { calculatePossibleShareRatio, formatPossibleShareText } from './possibleShare.js';

export function buildBoardMemberMeta({
  group,
  groupIndex,
  slotIndex,
  label,
  participantMap,
  isDutyRegionCompany,
  groupQualityScores,
  isLHOwner,
  getQualityScoreValue,
  groupShareRawInputs,
  groupShares,
  parseNumeric,
  getSharePercent,
  getCandidateSipyungAmount,
  getCandidatePerformanceAmountForCurrentRange,
  getCandidateSummaryStatus,
  formatAmount,
  possibleShareBase,
  isSingleBidEligible,
  isWomenOwnedCompany,
  getCandidateManagerName,
  getCandidateManagementScore,
  isMois30To50,
  managementMax,
  managementScoreMax,
  clampScore,
  toNumber,
  formatScore,
  groupCredibility,
  krailCredibilityScale,
  groupTechnicianScores,
  conflictNotesByGroup,
  getCompanyName,
  hasRecentAwardHistory = () => false,
  noticeDate = '',
  possibleShareFormatMode = 'round',
}) {
  const memberIds = Array.isArray(group?.memberIds) ? group.memberIds : [];
  const uid = memberIds[slotIndex];
  if (!uid) {
    return { empty: true, slotIndex, groupIndex, label };
  }

  const entry = participantMap.get(uid);
  if (!entry || !entry.candidate) {
    return { empty: true, slotIndex, groupIndex, label };
  }

  const candidate = entry.candidate;
  const isDutyRegion = entry.type === 'region' || isDutyRegionCompany(candidate);
  const qualityInputRaw = groupQualityScores[groupIndex]?.[slotIndex];
  const qualityScore = isLHOwner
    ? getQualityScoreValue(groupIndex, slotIndex, candidate)
    : null;
  const shareRaw = groupShareRawInputs[groupIndex]?.[slotIndex];
  const storedShare = groupShares[groupIndex]?.[slotIndex];
  const shareValue = shareRaw !== undefined ? shareRaw : (storedShare !== undefined ? storedShare : '');
  const shareNumeric = parseNumeric(shareValue);
  const shareFallback = getSharePercent(groupIndex, slotIndex, candidate);
  const shareForCalc = shareNumeric != null ? shareNumeric : shareFallback;
  const sipyungAmount = getCandidateSipyungAmount(candidate);
  const performanceAmount = getCandidatePerformanceAmountForCurrentRange(candidate);
  const summaryStatus = getCandidateSummaryStatus(candidate);
  const dataStatusLabel = summaryStatus && summaryStatus !== '최신' ? `자료 ${summaryStatus}` : '';
  const dataStatusTone = summaryStatus
    ? (summaryStatus.includes('1년 이상') ? 'overdue' : (summaryStatus === '미지정' ? 'unknown' : 'stale'))
    : '';
  const hasPerformanceOverride = Object.prototype.hasOwnProperty.call(candidate, '_agreementPerformanceInput')
    || candidate._agreementPerformanceCleared === true;
  const hasSipyungOverride = Object.prototype.hasOwnProperty.call(candidate, '_agreementSipyungInput')
    || candidate._agreementSipyungCleared === true;
  const performanceInput = hasPerformanceOverride
    ? candidate._agreementPerformanceInput
    : (performanceAmount != null ? formatAmount(performanceAmount) : '');
  const sipyungInput = hasSipyungOverride
    ? candidate._agreementSipyungInput
    : (sipyungAmount != null ? formatAmount(sipyungAmount) : '');
  const possibleShareText = formatPossibleShareText(
    calculatePossibleShareRatio(possibleShareBase, sipyungAmount),
    { mode: possibleShareFormatMode }
  );
  const tags = [];
  if (candidate._is_temp_company || candidate.snapshot?._is_temp_company) {
    tags.push({ key: 'temp', label: '임시' });
  }
  if (isSingleBidEligible(candidate)) {
    tags.push({ key: 'single-bid', label: '단독가능' });
  }
  if (isWomenOwnedCompany(candidate)) {
    tags.push({ key: 'female', label: '女' });
  }
  const managerName = getCandidateManagerName(candidate);
  const managementScore = getCandidateManagementScore(candidate);
  const perSlotMax = isMois30To50 ? managementScoreMax : managementMax;
  const managementNumeric = clampScore(toNumber(managementScore), perSlotMax);
  const managementInputRaw = candidate._agreementManagementInput;
  const managementInput = managementInputRaw !== undefined && managementInputRaw !== null
    ? String(managementInputRaw)
    : (managementNumeric != null ? formatScore(managementNumeric, 2) : '');
  const managementModified = candidate._agreementManagementManual !== undefined
    && candidate._agreementManagementManual !== null
    && candidate._agreementManagementManual !== '';
  const credibilityStored = groupCredibility[groupIndex]?.[slotIndex];
  const credibilityValue = credibilityStored != null ? String(credibilityStored) : '';
  const credibilityNumeric = parseNumeric(credibilityValue);
  const credibilityProductRaw = (credibilityNumeric != null && shareForCalc != null)
    ? credibilityNumeric * (shareForCalc / 100)
    : null;
  const credibilityProduct = credibilityProductRaw != null
    ? credibilityProductRaw * krailCredibilityScale
    : null;
  const technicianStored = groupTechnicianScores[groupIndex]?.[slotIndex];
  const technicianValue = technicianStored != null ? String(technicianStored) : '';
  const technicianNumeric = parseNumeric(technicianValue);
  const groupRemarks = conflictNotesByGroup.get(groupIndex);
  const conflictNotes = Array.isArray(groupRemarks) ? groupRemarks : [];

  return {
    empty: false,
    slotIndex,
    groupIndex,
    label,
    uid,
    companyName: getCompanyName(candidate),
    hasRecentAwardHistory: hasRecentAwardHistory(getCompanyName(candidate), noticeDate),
    isDutyRegion,
    managerName,
    tags,
    shareValue: shareValue != null ? String(shareValue) : '',
    shareForCalc,
    sharePlaceholder: possibleShareText || '0',
    possibleShareText,
    sipyungDisplay: formatAmount(sipyungAmount),
    sipyungInput,
    sipyungModified: hasSipyungOverride,
    performanceDisplay: formatAmount(performanceAmount),
    performanceInput,
    performanceModified: hasPerformanceOverride,
    managementDisplay: formatScore(managementNumeric, 2),
    managementOk: managementNumeric != null && managementNumeric >= (perSlotMax - 0.01),
    managementAlert: managementNumeric != null && managementNumeric < (perSlotMax - 0.01),
    managementInput,
    managementModified,
    qualityScore,
    qualityInput: qualityInputRaw,
    credibilityValue,
    credibilityProduct: credibilityProduct != null ? `${credibilityProduct.toFixed(2)}점` : '',
    technicianValue,
    technicianNumeric,
    dataStatusLabel,
    dataStatusTone,
    remarks: conflictNotes,
  };
}
