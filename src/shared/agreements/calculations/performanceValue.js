export const PERFORMANCE_DIRECT_KEYS = ['_performance5y', 'performance5y', 'perf5y', '5년 실적', '5년실적', '5년 실적 합계', '최근5년실적', '최근5년실적합계', '5년실적금액', '최근5년시공실적'];
export const PERFORMANCE_KEYWORDS = [['5년실적', '최근5년', 'fiveyear', 'performance5', '시공실적']];

const PERFORMANCE_3Y_DIRECT_KEYS = ['_performance3y', 'performance3y', 'perf3y', '3년 실적', '3년실적', '3년 실적 합계', '최근3년실적', '최근3년실적합계', '3년실적금액', '최근3년시공실적'];
const PERFORMANCE_3Y_KEYWORDS = [['3년실적', '최근3년', 'threeyear', 'performance3', '시공실적']];

export function getCandidatePerformanceAmount(candidate, {
  toNumber,
  extractAmountValue,
} = {}) {
  if (!candidate || typeof candidate !== 'object') return null;
  if (candidate._agreementPerformanceCleared) return null;
  const directCandidates = [
    candidate._agreementPerformance5y,
    candidate._performance5y,
    candidate.performance5y,
    candidate.perf5y,
    candidate['performance5y'],
    candidate['5년 실적'],
    candidate['5년실적'],
    candidate['5년 실적 합계'],
    candidate['최근5년실적'],
    candidate['최근5년실적합계'],
    candidate['5년실적금액'],
    candidate['최근5년시공실적'],
  ];
  for (const value of directCandidates) {
    const parsed = toNumber(value);
    if (parsed != null) {
      candidate._agreementPerformance5y = parsed;
      return parsed;
    }
  }
  const extracted = extractAmountValue(candidate, PERFORMANCE_DIRECT_KEYS, PERFORMANCE_KEYWORDS);
  const parsed = toNumber(extracted);
  if (parsed != null) {
    candidate._agreementPerformance5y = parsed;
    return parsed;
  }
  return null;
}

export function getCandidatePerformanceAmountForCurrentRange(candidate, {
  isMois50To100 = false,
  toNumber,
  extractAmountValue,
  getCandidatePerformanceAmount: getBasePerformanceAmount,
} = {}) {
  if (!candidate || typeof candidate !== 'object') return null;
  if (!isMois50To100) return getBasePerformanceAmount(candidate, { toNumber, extractAmountValue });

  if (candidate._agreementPerformanceCleared) return null;
  const hasManualOverride = Object.prototype.hasOwnProperty.call(candidate, '_agreementPerformanceInput');
  if (hasManualOverride) {
    const manual = toNumber(candidate._agreementPerformance5y ?? candidate._agreementPerformanceInput);
    if (manual != null) return manual;
  }

  const direct3yCandidates = [
    candidate._agreementPerformance3y,
    candidate._performance3y,
    candidate.performance3y,
    candidate.perf3y,
    candidate['performance3y'],
    candidate['3년 실적'],
    candidate['3년실적'],
    candidate['3년 실적 합계'],
    candidate['최근3년실적'],
    candidate['최근3년실적합계'],
    candidate['3년실적금액'],
    candidate['최근3년시공실적'],
  ];
  for (const value of direct3yCandidates) {
    const parsed = toNumber(value);
    if (parsed != null) return parsed;
  }

  const extracted3y = extractAmountValue(candidate, PERFORMANCE_3Y_DIRECT_KEYS, PERFORMANCE_3Y_KEYWORDS);
  const parsed3y = toNumber(extracted3y);
  if (parsed3y != null) return parsed3y;

  return getBasePerformanceAmount(candidate, { toNumber, extractAmountValue });
}
