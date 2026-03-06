export const SIPYUNG_DIRECT_KEYS = ['_sipyung', 'sipyung', '시평', '시평액', '시평금액', '시평액(원)', '시평금액(원)', '기초금액', '기초금액(원)'];
export const SIPYUNG_KEYWORDS = [['시평', '심평', 'sipyung', '기초금액', '추정가격', '시평총액']];

export function getCandidateSipyungAmount(candidate, {
  toNumber,
  extractAmountValue,
} = {}) {
  if (!candidate || typeof candidate !== 'object') return null;
  if (candidate._agreementSipyungCleared) return null;
  if (candidate._agreementSipyungAmount != null) {
    const cached = toNumber(candidate._agreementSipyungAmount);
    if (cached != null) return cached;
  }
  const raw = candidate._sipyung ?? extractAmountValue(candidate, SIPYUNG_DIRECT_KEYS, SIPYUNG_KEYWORDS);
  const parsed = toNumber(raw);
  if (parsed != null) {
    candidate._agreementSipyungAmount = parsed;
    return parsed;
  }
  if (raw != null) {
    candidate._agreementSipyungAmount = raw;
  }
  return null;
}
