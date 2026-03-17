/**
 * Common single-bid eligibility rule shared across owner/range flows.
 * CommonJS module so main/renderer can both reuse it.
 */

function parseAmount(v) {
  if (v === null || v === undefined) return 0;
  const s = String(v).replace(/[ ,]/g, '').trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/**
 * 회사 객체의 지역 문자열을 추출한다. 대표지역이 있으면 우선 사용.
 * @param {object} company
 * @returns {string}
 */
function getCompanyRegion(company) {
  const r = (company && (company['대표지역'] || company['지역'])) || '';
  return String(r || '').trim();
}

/**
 * 공통 단독입찰 가능 여부
 * 조건:
 *  - 금액: entryAmount > 0 인 경우에만 시평액 ≥ 입찰참가자격금액(entryAmount)
 *  - 실적만점: 5년실적 ≥ 기초금액(baseAmount)
 *  - 지역: dutyRegions가 비어있지 않다면 회사 지역 ∈ dutyRegions
 * @param {object} company - 검색 결과 한 건(시평/5년 실적/지역 키 포함)
 * @param {object} params
 * @param {number|string} params.entryAmount - 입찰참가자격금액(0 이하면 금액 조건 미적용)
 * @param {number|string} params.baseAmount - 기초금액
 * @param {string[]} params.dutyRegions - 의무 지역 목록(없으면 지역 조건 스킵)
 * @returns {{ ok: boolean, reasons: string[], facts: {sipyung:number, perf5y:number, entry:number, base:number, region:string} }}
 */
function isSingleBidEligible(company, { entryAmount, baseAmount, dutyRegions = [] } = {}) {
  const sipyung = parseAmount(company && company['시평']);
  const perf5y = parseAmount(company && company['5년 실적']);
  const entry = parseAmount(entryAmount);
  const base = parseAmount(baseAmount);
  const region = getCompanyRegion(company);

  const hasEntryLimit = entry > 0;
  const moneyOk = hasEntryLimit ? (sipyung >= entry) : true; // 참가자격 없으면 금액 조건 스킵
  const perfOk = base > 0 && perf5y >= base;     // 실적만점(≥ 기초금액)
  const regionOk = Array.isArray(dutyRegions) && dutyRegions.length > 0
    ? dutyRegions.includes(region)
    : true; // 의무지역 비어있으면 통과

  const ok = Boolean(moneyOk && perfOk && regionOk);
  const reasons = [];
  if (hasEntryLimit && !moneyOk) reasons.push(`시평 미달: ${sipyung.toLocaleString()} < 참가자격 ${entry.toLocaleString()}`);
  if (!perfOk) reasons.push(`5년 실적 미달(만점 기준): ${perf5y.toLocaleString()} < 기초금액 ${base.toLocaleString()}`);
  if (!regionOk) reasons.push(`의무지역 불일치: ${region || '지역없음'}`);

  return { ok, reasons, facts: { sipyung, perf5y, entry, base, region } };
}

module.exports = {
  parseAmount,
  getCompanyRegion,
  isSingleBidEligible,
};
