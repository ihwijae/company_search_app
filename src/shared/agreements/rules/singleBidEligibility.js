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

function toNullableNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = parseAmount(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function compareRegions(region, dutyRegions = []) {
  if (!Array.isArray(dutyRegions) || dutyRegions.length === 0) return true;
  const target = String(region || '').trim();
  if (!target) return false;
  if (dutyRegions.includes(target)) return true;
  return dutyRegions.some((entry) => {
    const normalized = String(entry || '').trim();
    if (!normalized) return false;
    return target.startsWith(normalized) || normalized.startsWith(target);
  });
}

function evaluateSingleBidEligibility({
  company = null,
  entryAmount = 0,
  performanceTarget = null,
  performanceLabel = '기초금액',
  baseAmount = null,
  dutyRegions = [],
  sipyungAmount = null,
  performanceAmount = null,
  region = '',
  regionOk = null,
  managementScore = null,
  managementMax = null,
  managementRequired = false,
} = {}) {
  const sipyung = toNullableNumber(sipyungAmount) ?? parseAmount(company && company['시평']);
  const perf5y = toNullableNumber(performanceAmount) ?? parseAmount(company && company['5년 실적']);
  const entry = parseAmount(entryAmount);
  const perfTarget = toNullableNumber(performanceTarget);
  const base = toNullableNumber(baseAmount);
  const resolvedPerfTarget = perfTarget != null ? perfTarget : base;
  const resolvedRegion = String(region || getCompanyRegion(company) || '').trim();

  const hasEntryLimit = entry > 0;
  const entryOk = hasEntryLimit ? sipyung >= entry : true;

  const hasPerformanceLimit = resolvedPerfTarget != null && resolvedPerfTarget > 0;
  const performanceOk = hasPerformanceLimit ? perf5y >= resolvedPerfTarget : false;

  const hasManagementLimit = managementRequired && Number.isFinite(Number(managementMax)) && Number(managementMax) > 0;
  const managementScoreValue = toNullableNumber(managementScore);
  const managementMaxValue = hasManagementLimit ? Number(managementMax) : null;
  const managementOk = hasManagementLimit
    ? (managementScoreValue != null && managementScoreValue >= (managementMaxValue - 0.01))
    : true;

  const regionApplied = Array.isArray(dutyRegions) && dutyRegions.length > 0;
  const resolvedRegionOk = typeof regionOk === 'boolean' ? regionOk : compareRegions(resolvedRegion, dutyRegions);
  const finalRegionOk = regionApplied ? resolvedRegionOk : true;

  const ok = Boolean(entryOk && performanceOk && managementOk && finalRegionOk);
  const reasons = [];
  if (hasEntryLimit && !entryOk) reasons.push(`시평 미달: ${sipyung.toLocaleString()} < 참가자격 ${entry.toLocaleString()}`);
  if (hasPerformanceLimit && !performanceOk) {
    const label = performanceLabel || '기초금액';
    reasons.push(`5년 실적 미달(만점 기준): ${perf5y.toLocaleString()} < ${label} ${resolvedPerfTarget.toLocaleString()}`);
  }
  if (hasManagementLimit && !managementOk) reasons.push('경영점수 만점 미달');
  if (regionApplied && !finalRegionOk) reasons.push(`의무지역 불일치: ${resolvedRegion || '지역없음'}`);

  return {
    ok,
    reasons,
    facts: {
      sipyung,
      perf5y,
      entry,
      base: resolvedPerfTarget,
      region: resolvedRegion,
    },
    entry: {
      applied: hasEntryLimit,
      amount: entry,
      sipyung,
      ok: entryOk,
    },
    performance: {
      applied: hasPerformanceLimit,
      amount: perf5y,
      target: resolvedPerfTarget,
      label: performanceLabel || '기초금액',
      ok: performanceOk,
    },
    management: {
      applied: hasManagementLimit,
      score: managementScoreValue,
      max: managementMaxValue,
      ok: managementOk,
    },
    region: {
      applied: regionApplied,
      companyRegion: resolvedRegion,
      dutyRegions: Array.isArray(dutyRegions) ? [...dutyRegions] : [],
      ok: finalRegionOk,
    },
  };
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
  return evaluateSingleBidEligibility({
    company,
    entryAmount,
    baseAmount,
    performanceTarget: baseAmount,
    performanceLabel: '기초금액',
    dutyRegions,
  });
}

module.exports = {
  parseAmount,
  getCompanyRegion,
  evaluateSingleBidEligibility,
  isSingleBidEligible,
};
