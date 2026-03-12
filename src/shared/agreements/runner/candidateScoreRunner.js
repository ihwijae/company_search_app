export async function runAgreementCandidateScoreEvaluation({
  entries = [],
  isCanceled = () => false,
  getCandidateManagementScore,
  getCandidatePerformanceAmountForCurrentRange,
  performanceBaseReady = false,
  perfBase,
  ownerKey,
  fileType,
  selectedRangeKey,
  evaluationAmount,
  candidateScoreCache,
  buildCandidateKey,
  getCandidateNumericValue,
  resolveCandidateBizYears,
  noticeDate,
  estimatedValue,
  extractCreditGrade,
  isCreditScoreExpired,
  formulasEvaluate,
  getCompanyName,
  clampScore,
  getPerformanceCap,
  updatePerformanceCap,
  performanceCapVersion,
  managementScoreVersion,
  perfCoefficient,
  forceManagementEvaluation = false,
  forcePerformanceEvaluation = false,
}) {
  let updated = 0;

  for (const candidate of entries) {
    if (isCanceled() || !candidate || typeof candidate !== 'object') continue;

    const currentManagement = getCandidateManagementScore(candidate);
    const storedPerformanceMax = Number(candidate._agreementPerformanceMax);
    const storedCapVersion = Number(candidate._agreementPerformanceCapVersion);
    const capIsValid = Number.isFinite(storedPerformanceMax) && storedPerformanceMax > 0;
    const capVersionFresh = storedCapVersion === performanceCapVersion;
    if (capIsValid && capVersionFresh) {
      updatePerformanceCap(storedPerformanceMax);
    }
    const capForStored = (capIsValid && capVersionFresh)
      ? storedPerformanceMax
      : getPerformanceCap();
    const currentPerformanceScore = (candidate._agreementPerformanceScore != null && capVersionFresh)
      ? clampScore(candidate._agreementPerformanceScore, capForStored)
      : null;
    const performanceAmount = getCandidatePerformanceAmountForCurrentRange(candidate);
    const hasManualManagement = candidate._agreementManagementManual !== null
      && candidate._agreementManagementManual !== undefined
      && candidate._agreementManagementManual !== '';
    const hasManualPerformance = candidate._agreementPerformanceInput !== null
      && candidate._agreementPerformanceInput !== undefined
      && candidate._agreementPerformanceInput !== '';
    const needsManagement = (!hasManualManagement) && (forceManagementEvaluation || currentManagement == null);
    const needsPerformanceScore = performanceAmount != null && performanceAmount > 0
      && performanceBaseReady && ((!hasManualPerformance && forcePerformanceEvaluation) || currentPerformanceScore == null);

    if (!needsManagement && !needsPerformanceScore) continue;

    const candidateKey = buildCandidateKey(candidate);
    if (!candidateKey) continue;
    const cacheKey = `${ownerKey}|${String(fileType || '')}|${selectedRangeKey || ''}|${evaluationAmount || ''}|${perfBase || ''}|${candidateKey}`;
    const cacheEntry = candidateScoreCache.get(cacheKey);
    if (cacheEntry === 'pending') continue;
    if (cacheEntry === 'done' && !needsManagement && !needsPerformanceScore) continue;
    candidateScoreCache.set(cacheKey, 'pending');

    const debtRatio = getCandidateNumericValue(
      candidate,
      ['debtRatio', '부채비율', '부채율', '부채비율(%)'],
      [['부채', 'debt']]
    );
    const currentRatio = getCandidateNumericValue(
      candidate,
      ['currentRatio', '유동비율', '유동자산비율', '유동비율(%)'],
      [['유동', 'current']]
    );
    const bizYears = resolveCandidateBizYears(candidate, noticeDate);
    const qualityEval = getCandidateNumericValue(
      candidate,
      ['qualityEval', '품질평가', '품질점수'],
      [['품질', 'quality']]
    );
    const creditGradeRaw = extractCreditGrade(candidate);
    const creditExpired = isCreditScoreExpired(candidate);
    const creditGrade = creditExpired ? '' : creditGradeRaw;
    const candidatePerfAmount = performanceAmount;

    let resolvedManagement = currentManagement;
    let resolvedPerformanceScore = currentPerformanceScore;

    const payload = {
      agencyId: ownerKey,
      fileType,
      amount: Number.isFinite(evaluationAmount) && evaluationAmount > 0
        ? evaluationAmount
        : (Number.isFinite(perfBase) && perfBase > 0 ? perfBase : 0),
      inputs: {
        debtRatio,
        currentRatio,
        bizYears,
        qualityEval,
        perf5y: candidatePerfAmount,
        perf3y: candidatePerfAmount,
        baseAmount: perfBase,
        estimatedAmount: estimatedValue,
        perfCoefficient,
        fileType,
        creditGrade,
      },
    };

    if (!Number.isFinite(payload.inputs.debtRatio)) delete payload.inputs.debtRatio;
    if (!Number.isFinite(payload.inputs.currentRatio)) delete payload.inputs.currentRatio;
    if (!Number.isFinite(payload.inputs.bizYears)) delete payload.inputs.bizYears;
    if (!Number.isFinite(payload.inputs.qualityEval)) delete payload.inputs.qualityEval;
    if (!Number.isFinite(payload.inputs.perf5y)) delete payload.inputs.perf5y;
    if (!Number.isFinite(payload.inputs.perf3y)) delete payload.inputs.perf3y;
    if (!Number.isFinite(payload.inputs.baseAmount)) delete payload.inputs.baseAmount;
    if (!Number.isFinite(payload.inputs.estimatedAmount)) delete payload.inputs.estimatedAmount;
    if (!Number.isFinite(payload.inputs.perfCoefficient)) delete payload.inputs.perfCoefficient;
    if (!payload.inputs.fileType) delete payload.inputs.fileType;
    if (!payload.inputs.creditGrade) delete payload.inputs.creditGrade;

    try {
      if (typeof formulasEvaluate === 'function') {
        const response = await formulasEvaluate(payload);
        if (isCanceled()) {
          candidateScoreCache.delete(cacheKey);
          return updated;
        }
        if (response?.success && response.data) {
          const { management, performance } = response.data;
          if (needsManagement && management && management.score != null) {
            const mgmtScore = clampScore(management.score);
            if (mgmtScore != null) {
              resolvedManagement = mgmtScore;
              candidate._agreementManagementScore = mgmtScore;
              candidate._agreementManagementScoreVersion = managementScoreVersion;
            }
          }
          if (needsPerformanceScore && performance && performance.score != null) {
            const perfMax = updatePerformanceCap(performance.maxScore);
            const perfScore = clampScore(performance.score, perfMax);
            if (perfScore != null) {
              resolvedPerformanceScore = perfScore;
              candidate._agreementPerformanceScore = perfScore;
              candidate._agreementPerformanceMax = perfMax;
              candidate._agreementPerformanceCapVersion = performanceCapVersion;
            }
          }
        } else if (!response?.success) {
          console.warn('[AgreementBoard] formulasEvaluate failed:', response?.message);
        } else if (process.env.NODE_ENV !== 'production') {
          console.debug('[AgreementBoard] formulasEvaluate returned no data', getCompanyName(candidate), response);
        }
      } else if (needsPerformanceScore && performanceAmount != null && performanceBaseReady) {
        const ratio = performanceAmount / perfBase;
        if (Number.isFinite(ratio)) {
          const cap = getPerformanceCap();
          const fallbackScore = clampScore(Math.max(1, ratio * cap), cap);
          if (fallbackScore != null) {
            resolvedPerformanceScore = fallbackScore;
            candidate._agreementPerformanceScore = fallbackScore;
            candidate._agreementPerformanceMax = cap;
            candidate._agreementPerformanceCapVersion = performanceCapVersion;
          }
        }
      }
    } catch (err) {
      console.warn('[AgreementBoard] candidate score evaluate failed:', err?.message || err);
    } finally {
      candidateScoreCache.set(cacheKey, 'done');
    }

    if ((needsManagement && resolvedManagement != null) || (needsPerformanceScore && resolvedPerformanceScore != null)) {
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[AgreementBoard] candidate score updated', getCompanyName(candidate), {
          management: resolvedManagement,
          performance: resolvedPerformanceScore,
        });
      }
      updated += 1;
    }
  }

  return updated;
}
