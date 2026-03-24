export function buildGroupSummaryMetrics({
  groupAssignments = [],
  participantMap,
  getSharePercent,
  getCandidateManagementScore,
  getCandidatePerformanceAmountForCurrentRange,
  technicianEditable = false,
  getTechnicianValue,
  credibilityEnabled = false,
  credibilityMode = 'weighted-credibility',
  regionalContributionTargetShare = 20,
  regionalContributionMaxScore = 0.3,
  regionalContributionAdjustmentCoefficient = 1,
  isDutyRegionCompany = () => false,
  getCredibilityValue,
  getCandidateSipyungAmount,
  entryModeResolved = 'ratio',
  entryLimitValue = null,
  isKrailOwner = false,
  krailCredibilityScale = 1,
}) {
  return groupAssignments.map((memberIds, groupIndex) => {
    const members = memberIds.map((uid, slotIndex) => {
      if (!uid) return null;
      const entry = participantMap.get(uid);
      if (!entry || !entry.candidate) return null;
      const candidate = entry.candidate;
      const sharePercent = getSharePercent(groupIndex, slotIndex, candidate);
      const managementScore = getCandidateManagementScore(candidate);
      const performanceAmount = getCandidatePerformanceAmountForCurrentRange(candidate);
      const technicianScore = technicianEditable ? getTechnicianValue(groupIndex, slotIndex) : null;
      const credibilityBonus = credibilityEnabled ? getCredibilityValue(groupIndex, slotIndex, candidate) : 0;
      const sipyungAmount = getCandidateSipyungAmount(candidate);
      return {
        sharePercent,
        managementScore,
        performanceAmount,
        technicianScore,
        credibility: credibilityBonus,
        isDutyRegion: credibilityMode === 'regional-share' ? Boolean(isDutyRegionCompany(candidate)) : false,
        sipyungAmount,
      };
    }).filter(Boolean);

    const shareSum = members.reduce((sum, member) => {
      const shareValue = Number(member.sharePercent);
      return Number.isFinite(shareValue) ? sum + shareValue : sum;
    }, 0);
    const missingShares = members.some((member) => member.sharePercent == null || Number.isNaN(Number(member.sharePercent)));
    const shareValid = shareSum > 0 && !missingShares;
    const shareComplete = shareValid && Math.abs(shareSum - 100) < 0.01;
    const normalizedMembers = members.map((member) => {
      const rawShare = Number(member.sharePercent);
      const safeShare = Number.isFinite(rawShare) ? Math.max(rawShare, 0) : 0;
      return {
        ...member,
        weight: safeShare / 100,
        credibility: Number.isFinite(member.credibility) ? Math.max(member.credibility, 0) : 0,
      };
    });

    const managementMissing = normalizedMembers.some((member) => member.managementScore == null);
    const performanceMissing = normalizedMembers.some((member) => member.performanceAmount == null);
    const technicianProvided = technicianEditable
      ? normalizedMembers.some((member) => member.technicianScore != null)
      : false;
    const technicianMissing = technicianEditable ? !technicianProvided : false;
    const sipyungMissing = normalizedMembers.some((member) => member.sipyungAmount == null);
    let aggregatedCredibility = null;
    if (credibilityEnabled && credibilityMode === 'regional-share') {
      if (shareValid) {
        const dutyRegionShare = normalizedMembers.reduce((acc, member) => {
          const rawShare = Number(member.sharePercent);
          if (!member.isDutyRegion || !Number.isFinite(rawShare)) return acc;
          return acc + Math.max(rawShare, 0);
        }, 0);
        if (dutyRegionShare >= 40) {
          aggregatedCredibility = 0.3;
        } else if (dutyRegionShare >= 35) {
          aggregatedCredibility = 0.2;
        } else if (dutyRegionShare > 30) {
          aggregatedCredibility = 0.1;
        } else {
          aggregatedCredibility = 0;
        }
      }
    } else if (credibilityEnabled) {
      aggregatedCredibility = shareValid
        ? normalizedMembers.reduce((acc, member) => acc + (member.credibility || 0) * member.weight, 0)
        : null;
    }
    if (aggregatedCredibility != null && isKrailOwner) {
      aggregatedCredibility *= krailCredibilityScale;
    }

    const aggregatedManagement = (!managementMissing && shareValid)
      ? normalizedMembers.reduce((acc, member) => acc + (member.managementScore || 0) * member.weight, 0)
      : null;
    const aggregatedPerformanceAmount = (!performanceMissing && shareValid)
      ? normalizedMembers.reduce((acc, member) => acc + (member.performanceAmount || 0) * member.weight, 0)
      : null;
    const aggregatedTechnicianScore = (technicianEditable && technicianProvided && shareValid)
      ? normalizedMembers.reduce((acc, member) => acc + (member.technicianScore || 0) * member.weight, 0)
      : null;

    let sipyungSum = null;
    if (!sipyungMissing && normalizedMembers.length > 0) {
      sipyungSum = normalizedMembers.reduce((acc, member) => {
        const value = Number(member.sipyungAmount);
        return Number.isFinite(value) ? acc + value : acc;
      }, 0);
    }

    let sipyungWeighted = null;
    if (!sipyungMissing && shareValid && normalizedMembers.length > 0) {
      sipyungWeighted = normalizedMembers.reduce((acc, member) => {
        const value = Number(member.sipyungAmount);
        const weight = Number(member.weight);
        if (!Number.isFinite(value) || !Number.isFinite(weight)) return acc;
        return acc + (value * weight);
      }, 0);
    }

    let qualificationValue = null;
    let qualificationReady = false;
    if (entryModeResolved === 'sum') {
      qualificationValue = sipyungSum;
      qualificationReady = sipyungSum != null;
    } else if (entryModeResolved === 'ratio') {
      qualificationValue = sipyungWeighted;
      qualificationReady = sipyungWeighted != null;
    }
    const qualificationLimit = entryModeResolved !== 'none' && entryLimitValue != null ? entryLimitValue : null;
    const qualificationSatisfied = (entryModeResolved !== 'none'
      && qualificationLimit != null && qualificationLimit >= 0 && qualificationValue != null)
      ? qualificationValue >= (qualificationLimit - 1e-6)
      : null;

    return {
      groupIndex,
      memberCount: members.length,
      shareSum,
      shareValid,
      shareComplete,
      missingShares,
      managementScore: aggregatedManagement,
      managementMissing,
      performanceAmount: aggregatedPerformanceAmount,
      performanceMissing,
      technicianScore: aggregatedTechnicianScore,
      technicianMissing,
      credibilityScore: aggregatedCredibility,
      sipyungSum,
      sipyungWeighted,
      sipyungMissing,
      entryModeResolved,
      qualificationLimit,
      qualificationValue,
      qualificationReady,
      qualificationSatisfied,
    };
  });
}

export async function computeGroupSummaries({
  metrics = [],
  evaluatePerformanceScore,
  performanceBaseReady = false,
  perfBase = null,
  groupManagementBonus = [],
  managementScale = 1,
  managementMax,
  managementScoreMax,
  clampScore,
  roundForMoisManagement,
  roundForLhTotals,
  roundUpForPpsUnder50,
  roundForKrailUnder50,
  roundForExManagement,
  roundForPerformanceTotals,
  resolveKrailTechnicianAbilityScore,
  getPerformanceCap,
  derivedPerformanceMax,
  credibilityEnabled = false,
  ownerCredibilityMax,
  isMois30To50 = false,
  isMois50To100 = false,
  isEx50To100 = false,
  isKrail50To100 = false,
  isLh50To100 = false,
  technicianEnabled = false,
  technicianEditable = false,
  technicianAbilityMax = 0,
  netCostBonusScore = 0,
  bidScoreDefault,
  subcontractScoreDefault,
  mois50To100SubcontractScore,
  ex50To100SubcontractScore,
  krail50To100SubcontractMaterialScore,
  lh50To100SubcontractScore,
  lh50To100MaterialScore,
  mois50To100MaterialScore,
  ex50To100BidScore,
  krail50To100BidScore,
  lh50To100BidScore,
  mois50To100BidScore,
}) {
  const results = await Promise.all(metrics.map(async (metric) => {
    const shareReady = metric.memberCount > 0 && metric.shareValid;
    const managementScoreBase = shareReady && !metric.managementMissing
      ? clampScore(metric.managementScore, managementScoreMax)
      : null;
    const bonusEnabled = Boolean(groupManagementBonus[metric.groupIndex]);
    const managementWithBonus = (managementScoreBase != null && bonusEnabled)
      ? clampScore(managementScoreBase * 1.1, managementScoreMax)
      : managementScoreBase;
    let managementScore = managementWithBonus != null
      ? clampScore(managementWithBonus * managementScale, managementMax)
      : managementWithBonus;
    managementScore = roundForMoisManagement(managementScore);
    managementScore = roundForLhTotals(roundUpForPpsUnder50(roundForKrailUnder50(managementScore)));
    managementScore = roundForExManagement(managementScore);

    let performanceScore = null;
    let performanceRatio = null;
    let technicianScore = null;
    let technicianAbilityScore = null;

    if (shareReady && !metric.performanceMissing && metric.performanceAmount != null && performanceBaseReady) {
      performanceScore = await evaluatePerformanceScore(metric.performanceAmount);
      if (perfBase && perfBase > 0) {
        performanceRatio = metric.performanceAmount / perfBase;
      }
    }

    const isKrailUnder50SobangDebug = !isKrail50To100
      && Number.isFinite(Number(derivedPerformanceMax))
      && Number(derivedPerformanceMax) === 15
      && technicianEnabled
      && !technicianEditable;
    if (isKrailUnder50SobangDebug) {
      console.warn('[KRAIL_UNDER50_SOBANG][groupSummary] before rounding', {
        groupIndex: metric.groupIndex,
        shareReady,
        performanceMissing: metric.performanceMissing,
        performanceAmount: metric.performanceAmount,
        perfBase,
        performanceBaseReady,
        performanceRatioRaw: perfBase && perfBase > 0 ? (metric.performanceAmount / perfBase) : null,
        performanceScoreRaw: performanceScore,
        derivedPerformanceMax,
      });
    }

    performanceScore = roundForLhTotals(roundUpForPpsUnder50(roundForKrailUnder50(performanceScore)));
    performanceScore = roundForPerformanceTotals(performanceScore);
    performanceRatio = roundForKrailUnder50(performanceRatio);
    if (isKrailUnder50SobangDebug) {
      console.warn('[KRAIL_UNDER50_SOBANG][groupSummary] after rounding', {
        groupIndex: metric.groupIndex,
        performanceScore,
        performanceRatio,
      });
    }

    if (shareReady && !metric.technicianMissing && metric.technicianScore != null) {
      technicianScore = roundForKrailUnder50(metric.technicianScore);
      technicianAbilityScore = resolveKrailTechnicianAbilityScore(technicianScore);
    }

    const perfCapCurrent = getPerformanceCap();
    const performanceMax = perfCapCurrent || derivedPerformanceMax;
    let credibilityScore = null;
    if (credibilityEnabled && shareReady) {
      if (metric.credibilityScore != null) {
        const rawCredibility = Number(metric.credibilityScore);
        if (Number.isFinite(rawCredibility)) {
          credibilityScore = Number.isFinite(ownerCredibilityMax)
            ? clampScore(rawCredibility, ownerCredibilityMax)
            : rawCredibility;
        }
      } else {
        credibilityScore = 0;
      }
    }
    credibilityScore = roundForLhTotals(roundUpForPpsUnder50(roundForKrailUnder50(credibilityScore)));
    const credibilityMax = (credibilityEnabled && Number.isFinite(ownerCredibilityMax)) ? ownerCredibilityMax : null;
    const hasMembers = metric.memberCount > 0;
    const subcontractScore = hasMembers
      ? (isMois30To50
        ? subcontractScoreDefault
        : (isMois50To100
          ? mois50To100SubcontractScore
          : (isEx50To100
            ? ex50To100SubcontractScore
            : (isKrail50To100
              ? krail50To100SubcontractMaterialScore
              : (isLh50To100 ? lh50To100SubcontractScore : null)))))
      : null;
    const materialScore = hasMembers
      ? (isLh50To100
        ? lh50To100MaterialScore
        : (isMois50To100 ? mois50To100MaterialScore : null))
      : null;
    const bidScoreValue = hasMembers
      ? (isEx50To100
        ? ex50To100BidScore
        : (isKrail50To100
          ? krail50To100BidScore
          : (isLh50To100
            ? lh50To100BidScore
            : (isMois50To100 ? mois50To100BidScore : bidScoreDefault))))
      : null;
    const technicianScoreForTotal = (technicianEnabled && technicianAbilityScore != null)
      ? technicianAbilityScore
      : null;
    const technicianRequired = technicianEnabled && technicianEditable;
    const technicianReady = !technicianRequired || technicianScoreForTotal != null;
    let totalScoreBase = (managementScore != null && performanceScore != null && technicianReady)
      ? managementScore + performanceScore + (technicianScoreForTotal || 0) + (bidScoreValue || 0) + netCostBonusScore + (subcontractScore || 0) + (materialScore || 0)
      : null;
    let totalScoreWithCred = (totalScoreBase != null)
      ? totalScoreBase + (credibilityScore != null ? credibilityScore : 0)
      : null;
    totalScoreBase = roundUpForPpsUnder50(roundForKrailUnder50(totalScoreBase));
    totalScoreWithCred = roundUpForPpsUnder50(roundForKrailUnder50(totalScoreWithCred));
    const totalMaxBase = managementMax + performanceMax
      + (isEx50To100
        ? ex50To100BidScore
        : (isKrail50To100
          ? krail50To100BidScore
          : (isLh50To100
            ? lh50To100BidScore
            : (isMois50To100 ? mois50To100BidScore : bidScoreDefault))))
      + netCostBonusScore
      + (isMois30To50
        ? subcontractScoreDefault
        : (isMois50To100
          ? mois50To100SubcontractScore
          : (isEx50To100
            ? ex50To100SubcontractScore
            : (isKrail50To100
              ? krail50To100SubcontractMaterialScore
              : (isLh50To100 ? lh50To100SubcontractScore : 0)))))
      + (isLh50To100
        ? lh50To100MaterialScore
        : (isMois50To100 ? mois50To100MaterialScore : 0))
      + (technicianRequired && technicianAbilityMax ? technicianAbilityMax : 0);
    const totalMaxWithCred = credibilityEnabled ? totalMaxBase + (credibilityMax || 0) : totalMaxBase;

    return {
      ...metric,
      shareReady,
      shareComplete: metric.shareComplete,
      managementScore,
      managementMissing: metric.managementMissing,
      performanceScore,
      performanceMissing: metric.performanceMissing,
      performanceRatio,
      performanceBase: perfBase,
      performanceBaseReady,
      technicianMissing: metric.technicianMissing,
      credibilityScore,
      credibilityMax,
      technicianScore,
      technicianAbilityScore,
      technicianAbilityMax,
      totalScoreBase,
      totalScoreWithCred,
      totalMaxBase,
      totalMaxWithCred,
      totalScore: totalScoreWithCred,
      bidScore: bidScoreValue,
      netCostBonusScore,
      subcontractScore,
      materialScore,
      managementMax,
      performanceMax,
      totalMax: totalMaxBase,
      entryMode: metric.entryModeResolved,
      entryLimit: metric.qualificationLimit,
      entryValue: metric.qualificationValue,
      entryReady: metric.qualificationReady,
      entrySatisfied: metric.qualificationSatisfied,
      sipyungSum: metric.sipyungSum,
      sipyungWeighted: metric.sipyungWeighted,
      sipyungMissing: metric.sipyungMissing,
    };
  }));

  return results;
}
