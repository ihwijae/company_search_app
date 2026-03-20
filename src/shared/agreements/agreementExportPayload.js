import {
  calculatePossibleShareRatio,
  formatPossibleShareValue,
} from './calculations/possibleShare.js';

const LH_100_TO_300_KEY = 'lh-100to300';
const LH_QUALITY_DEFAULT_OVER_100B = 88;

function buildExportDisplayName({
  companyName = '',
  managerName = '',
  shareLabel = '',
  qualityScore = null,
  includeQuality = false,
}) {
  const parts = [];
  const trimmedCompanyName = String(companyName || '').trim();
  const trimmedManagerName = String(managerName || '').trim();
  const trimmedShareLabel = String(shareLabel || '').trim();

  if (trimmedCompanyName) {
    parts.push(trimmedCompanyName);
  }

  const managerAndShare = `${trimmedManagerName}${trimmedShareLabel}`;
  if (managerAndShare) {
    parts.push(managerAndShare);
  }

  if (includeQuality && Number.isFinite(Number(qualityScore))) {
    parts.push(`품질${Number(qualityScore).toFixed(2)}`);
  }

  return parts.filter(Boolean).join('_');
}

export function buildAgreementExportPayload({
  templateKey,
  appendTargetPath = '',
  sheetName = '',
  ownerId,
  rangeId,
  noticeNo = '',
  noticeTitle = '',
  industryLabel = '',
  baseValue = null,
  estimatedValue = null,
  bidAmountValue = null,
  ratioBaseValue = null,
  entryAmountValue = null,
  entryModeResolved = 'none',
  amountForScoreResolved = null,
  formattedDeadline = '',
  bidDeadline = '',
  dutyRegions = [],
  dutyRateNumber = null,
  dutySummaryText = '',
  safeGroupSize = 5,
  summary = null,
  memoHtml = '',
  netCostPenaltyNotice = false,
  groupAssignments = [],
  groupApprovals = [],
  groupShares = [],
  groupCredibility = [],
  groupManagementBonus = [],
  participantMap,
  summaryByGroup,
  netCostBonusScore = null,
  isLHOwner = false,
  technicianEnabled = false,
  selectedRangeKey = '',
  includePossibleShare = false,
  possibleShareBase = null,
  candidateDrawerEntries = [],
  parseNumeric,
  getSharePercent,
  getCandidateManagementScore,
  getCandidatePerformanceAmountForCurrentRange,
  getTechnicianValue,
  getCandidateSipyungAmount,
  isDutyRegionCompany,
  sanitizeCompanyName,
  getCompanyName,
  getCandidateManagerName,
  getRegionLabel,
  normalizeBizNo,
  getBizNo,
  getQualityScoreValue,
  resolveQualityPoints,
  hasRecentAwardHistory = () => false,
}) {
  const isLh100To300 = isLHOwner && selectedRangeKey === LH_100_TO_300_KEY;
  let exportIndex = 1;
  const groupPayloads = groupAssignments.flatMap((memberIds, groupIndex) => {
    const hasMembers = Array.isArray(memberIds) && memberIds.some((uid) => Boolean(uid));
    if (!hasMembers) return [];
    const summaryEntry = summaryByGroup.get(groupIndex) || null;
    const resolvedNetCostBonus = isLHOwner
      ? (summaryEntry?.netCostBonusScore ?? (netCostBonusScore ?? null))
      : null;
    const approvalValue = String(groupApprovals[groupIndex] || '').trim();
    const members = memberIds.map((uid, slotIndex) => {
      if (!uid) {
        return {
          slotIndex,
          role: slotIndex === 0 ? 'representative' : 'member',
          empty: true,
        };
      }
      const entry = participantMap.get(uid);
      if (!entry || !entry.candidate) {
        return {
          slotIndex,
          role: slotIndex === 0 ? 'representative' : 'member',
          empty: true,
        };
      }
      const candidate = entry.candidate;
      const storedShare = groupShares[groupIndex]?.[slotIndex];
      const shareSource = (storedShare !== undefined && storedShare !== null && storedShare !== '')
        ? storedShare
        : getSharePercent(groupIndex, slotIndex, candidate);
      const sharePercent = parseNumeric(shareSource);
      const managementScore = getCandidateManagementScore(candidate);
      const performanceAmount = getCandidatePerformanceAmountForCurrentRange(candidate);
      const technicianValue = technicianEnabled
        ? getTechnicianValue(groupIndex, slotIndex)
        : null;
      const sipyung = getCandidateSipyungAmount(candidate);
      const credibilitySource = groupCredibility[groupIndex]?.[slotIndex];
      const credibilityBonus = parseNumeric(credibilitySource);
      const isRegionMember = entry.type === 'region' || isDutyRegionCompany(candidate);
      const companyName = sanitizeCompanyName(getCompanyName(candidate));
      const managerName = getCandidateManagerName(candidate);
      const possibleShareRatio = includePossibleShare
        ? calculatePossibleShareRatio(possibleShareBase, sipyung)
        : null;
      const shareLabel = includePossibleShare
        ? formatPossibleShareValue(possibleShareRatio, { mode: isLh100To300 ? 'truncate' : 'round' })
        : '';
      const qualityScore = isLHOwner
        ? getQualityScoreValue(groupIndex, slotIndex, candidate)
        : null;
      const includeQuality = (
        isLh100To300
        && qualityScore != null
        && Number.isFinite(Number(qualityScore))
        && Number(qualityScore) > LH_QUALITY_DEFAULT_OVER_100B
      );
      const displayName = buildExportDisplayName({
        companyName,
        managerName,
        shareLabel,
        qualityScore,
        includeQuality,
      });
      return {
        slotIndex,
        role: slotIndex === 0 ? 'representative' : 'member',
        type: entry.type,
        isRegion: Boolean(isRegionMember),
        hasRecentAwardHistory: hasRecentAwardHistory(getCompanyName(candidate), bidDeadline),
        name: displayName,
        manager: managerName,
        region: getRegionLabel(candidate),
        bizNo: normalizeBizNo(getBizNo(candidate)),
        sharePercent,
        managementScore: managementScore != null ? Number(managementScore) : null,
        performanceAmount: performanceAmount != null ? Number(performanceAmount) : null,
        technicianScore: technicianValue != null ? Number(technicianValue) : null,
        sipyung,
        credibilityBonus: credibilityBonus != null ? Number(credibilityBonus) : null,
        qualityScore: qualityScore != null ? Number(qualityScore) : null,
      };
    });

    let qualityPoints = null;
    if (isLHOwner) {
      let qualityTotal = 0;
      let hasQuality = false;
      members.forEach((member) => {
        const shareValue = Number(member.sharePercent);
        const scoreValue = Number(member.qualityScore);
        if (!Number.isFinite(shareValue) || !Number.isFinite(scoreValue)) return;
        if (shareValue <= 0) return;
        qualityTotal += scoreValue * (shareValue / 100);
        hasQuality = true;
      });
      if (hasQuality) {
        qualityPoints = resolveQualityPoints(qualityTotal, selectedRangeKey);
      }
    }

    const summaryPayload = summaryEntry ? {
      shareSum: summaryEntry.shareSum ?? null,
      shareComplete: Boolean(summaryEntry.shareComplete),
      shareReady: Boolean(summaryEntry.shareReady),
      managementScore: summaryEntry.managementScore ?? null,
      performanceScore: summaryEntry.performanceScore ?? null,
      performanceAmount: summaryEntry.performanceAmount ?? null,
      performanceBase: summaryEntry.performanceBase ?? null,
      credibilityScore: summaryEntry.credibilityScore ?? null,
      credibilityMax: summaryEntry.credibilityMax ?? null,
      totalScoreBase: summaryEntry.totalScoreBase ?? null,
      totalScoreWithCred: summaryEntry.totalScoreWithCred ?? null,
      totalScore: summaryEntry.totalScoreWithCred ?? null,
      bidScore: summaryEntry.bidScore ?? null,
      managementMax: summaryEntry.managementMax ?? null,
      performanceMax: summaryEntry.performanceMax ?? null,
      totalMaxBase: summaryEntry.totalMaxBase ?? null,
      totalMaxWithCred: summaryEntry.totalMaxWithCred ?? null,
      totalMax: summaryEntry.totalMaxBase ?? null,
      netCostBonusScore: resolvedNetCostBonus,
      subcontractScore: summaryEntry.subcontractScore ?? null,
      materialScore: summaryEntry.materialScore ?? null,
      qualityPoints,
      managementBonusApplied: Boolean(groupManagementBonus[groupIndex]),
    } : (resolvedNetCostBonus != null ? { netCostBonusScore: resolvedNetCostBonus } : null);

    const payload = {
      index: exportIndex,
      approval: approvalValue,
      members,
      summary: summaryPayload,
    };
    exportIndex += 1;
    return payload;
  });

  const candidatePayloads = candidateDrawerEntries.map((entry, index) => {
    const candidate = entry?.candidate;
    if (!candidate) return null;
    const companyName = sanitizeCompanyName(getCompanyName(candidate));
    const managerName = getCandidateManagerName(candidate);
    const shareLabel = entry.possibleShareText ? String(entry.possibleShareText).replace(/%$/, '') : '';
    const qualityScore = isLh100To300 ? Number(entry.qualityScore) : null;
    const displayName = buildExportDisplayName({
      companyName,
      managerName,
      shareLabel,
      qualityScore,
      includeQuality: isLh100To300 && Number.isFinite(qualityScore) && qualityScore > LH_QUALITY_DEFAULT_OVER_100B,
    });
    return {
      candidateIndex: index + 1,
      isRegion: Boolean(entry.isDutyRegion),
      hasRecentAwardHistory: Boolean(entry.hasRecentAwardHistory),
      name: displayName,
      manager: managerName,
      region: getRegionLabel(candidate),
      bizNo: normalizeBizNo(getBizNo(candidate)),
      managementScore: entry.managementScore != null ? Number(entry.managementScore) : null,
      performanceAmount: entry.performanceAmount != null ? Number(entry.performanceAmount) : null,
      sipyung: entry.sipyungAmount != null ? Number(entry.sipyungAmount) : null,
      possibleShareText: entry.possibleShareText || '',
    };
  }).filter(Boolean);

  return {
    templateKey,
    appendTargetPath,
    sheetName,
    context: {
      ownerId,
      rangeId,
    },
    header: {
      noticeNo,
      noticeTitle,
      industryLabel,
      baseAmount: baseValue ?? null,
      estimatedAmount: estimatedValue ?? null,
      bidAmount: bidAmountValue ?? null,
      ratioBaseAmount: ratioBaseValue ?? null,
      entryAmount: entryAmountValue ?? null,
      entryMode: entryModeResolved || 'none',
      amountForScore: amountForScoreResolved,
      bidDeadline: formattedDeadline,
      rawBidDeadline: bidDeadline || '',
      dutyRegions: Array.isArray(dutyRegions) ? dutyRegions : [],
      dutyRegionRate: dutyRateNumber,
      dutySummary: dutySummaryText,
      teamSize: safeGroupSize,
      summary,
      memoHtml,
      netCostPenaltyNotice: Boolean(netCostPenaltyNotice),
    },
    groups: groupPayloads,
    candidates: candidatePayloads,
  };
}
