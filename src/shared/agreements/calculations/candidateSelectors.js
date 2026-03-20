import { calculatePossibleShareRatio, formatPossibleShareText } from './possibleShare.js';

export function buildCandidateDrawerEntries({
  representativeEntries = [],
  regionEntries = [],
  participantMap,
  assignedIds,
  candidatePoolFlag,
  getCompanyName,
  getCandidateManagerName,
  getRegionLabel,
  getCandidateCreditGrade,
  getCandidateManagementScore,
  getCandidateSipyungAmount,
  getCandidatePerformanceAmountForCurrentRange,
  isDutyRegionCompany,
  isMois30To50 = false,
  managementMax,
  managementScoreMax,
  possibleShareBase,
  toNumber,
  clampScore,
  hasRecentAwardHistory = () => false,
  noticeDate = '',
  possibleShareFormatMode = 'round',
}) {
  const perSlotMax = isMois30To50 ? managementScoreMax : managementMax;

  const list = [...representativeEntries, ...regionEntries]
    .map((entry) => {
      const merged = participantMap.get(entry.uid) || entry;
      let candidate = merged?.candidate || entry?.candidate;
      if (candidate?.snapshot && typeof candidate.snapshot === 'object') {
        candidate = { ...candidate.snapshot, ...candidate };
      }
      if (entry?.ruleSnapshot && typeof entry.ruleSnapshot === 'object') {
        candidate = { ...entry.ruleSnapshot, ...candidate };
      }
      if (!candidate || assignedIds.has(entry.uid)) return null;
      if (candidate[candidatePoolFlag] !== true) return null;

      const companyName = getCompanyName(candidate);
      const managerName = getCandidateManagerName(candidate);
      const regionLabel = getRegionLabel(candidate);
      const creditGrade = getCandidateCreditGrade(candidate);
      const managementScore = clampScore(toNumber(getCandidateManagementScore(candidate)), perSlotMax);
      const sipyungAmount = getCandidateSipyungAmount(candidate);
      const possibleShareText = formatPossibleShareText(
        calculatePossibleShareRatio(possibleShareBase, sipyungAmount),
        { mode: possibleShareFormatMode }
      );
      const searchText = [
        companyName,
        managerName,
        regionLabel,
        candidate.bizNo,
        creditGrade,
      ].filter(Boolean).join(' ').toLowerCase();

      return {
        uid: entry.uid,
        candidate,
        companyName,
        hasRecentAwardHistory: hasRecentAwardHistory(companyName, noticeDate),
        isTempCompany: Boolean(candidate._is_temp_company || candidate.snapshot?._is_temp_company),
        managerName,
        regionLabel,
        isDutyRegion: entry.type === 'region' || isDutyRegionCompany(candidate),
        managementScore,
        managementAlert: managementScore != null && managementScore < (perSlotMax - 0.01),
        performanceAmount: getCandidatePerformanceAmountForCurrentRange(candidate),
        sipyungAmount,
        possibleShareText,
        creditGrade,
        searchText,
        synthetic: Boolean(entry.synthetic || candidate._synthetic),
      };
    })
    .filter(Boolean);

  list.sort((a, b) => {
    if (a.isDutyRegion !== b.isDutyRegion) return a.isDutyRegion ? -1 : 1;
    return a.companyName.localeCompare(b.companyName, 'ko');
  });
  return list;
}

export function filterCandidateDrawerEntries(entries = [], query = '') {
  const normalized = String(query || '').trim().toLowerCase();
  if (!normalized) return entries;
  return entries.filter((entry) => entry.searchText.includes(normalized));
}
