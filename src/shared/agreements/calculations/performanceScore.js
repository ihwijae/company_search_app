const PERFORMANCE_DEFAULT_MAX = 13;

export function resolvePerformanceCap(value, fallback = PERFORMANCE_DEFAULT_MAX) {
  if (value === null || value === undefined) return fallback;
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return fallback;
}

export async function evaluateAgreementPerformanceScore(perfAmount, {
  performanceBaseReady = false,
  agencyId,
  fileType,
  evaluationAmount,
  perfBase,
  estimatedValue,
  perfCoefficient,
  formulasEvaluate,
  updatePerformanceCap,
  getPerformanceCap,
  toNumber,
  clampScore,
} = {}) {
  if (!performanceBaseReady || perfAmount == null) return null;

  const payload = {
    agencyId,
    fileType,
    amount: evaluationAmount != null ? evaluationAmount : (perfBase != null ? perfBase : 0),
    inputs: {
      perf5y: perfAmount,
      perf3y: perfAmount,
      baseAmount: perfBase,
      estimatedAmount: estimatedValue,
      perfCoefficient,
      fileType,
    },
  };

  if (typeof formulasEvaluate === 'function') {
    try {
      const response = await formulasEvaluate(payload);
      if (response?.success && response.data?.performance) {
        const perfData = response.data.performance;
        const perfMax = updatePerformanceCap(perfData.maxScore);
        const { score, capped, raw } = perfData;
        const numericCandidates = [score, capped, raw]
          .map((value) => toNumber(value))
          .filter((value) => value !== null);
        if (numericCandidates.length > 0) {
          const resolved = clampScore(Math.max(...numericCandidates), perfMax);
          if (resolved != null) return resolved;
        }
      }
    } catch (err) {
      console.warn('[AgreementBoard] performance evaluate failed:', err?.message || err);
    }
  }

  if (!performanceBaseReady || perfBase <= 0) return null;
  const ratio = perfAmount / perfBase;
  if (!Number.isFinite(ratio)) return null;
  const cap = getPerformanceCap();
  const fallback = Math.max(1, ratio * cap);
  return clampScore(fallback, cap);
}
