const formulasDoc = require('../formulas.defaults.json');

const OWNER_ID_MAP = {
  lh: 'lh',
  'lh공사': 'lh',
  '한국토지주택공사': 'lh',
  '한국토지주택공사(LH)': 'lh',
  'land&housing': 'lh',
  'l.h.': 'lh',
  '행안부': 'mois',
  '행정안전부': 'mois',
  mois: 'mois',
  pps: 'pps',
  '조달청': 'pps',
  'public procurement service': 'pps',
};

const PERFORMANCE_OVERRIDES = {
  mois: {
    '30억 미만': { ratio: 0.8, basis: 'estimatedAmount', note: '행안부 30억 미만 = 추정 x80%' },
    '30억~50억': { ratio: 0.8, basis: 'estimatedAmount', note: '행안부 30~50억 = 추정 x80%' },
    '50억~100억': { ratio: 1.7, basis: 'estimatedAmount', note: '행안부 50~100억 = 추정 x1.7' },
    '100억 이상': { ratio: 1.7, basis: 'estimatedAmount', note: '행안부 100억 이상 = 추정 x1.7 (기본 추정)' },
  },
};

function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.-]/g, '').trim();
    if (!cleaned) return 0;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value == null) return 0;
  if (typeof value === 'object') {
    if (value.value != null) return toNumber(value.value);
  }
  return 0;
}

function normalizeOwnerId(owner) {
  const raw = String(owner || '').trim().toLowerCase();
  if (!raw) return null;
  return OWNER_ID_MAP[raw] || null;
}

function getAgency(ownerId) {
  if (!ownerId) return null;
  const agencies = Array.isArray(formulasDoc && formulasDoc.agencies) ? formulasDoc.agencies : [];
  return agencies.find((agency) => String(agency.id || '').toLowerCase() === ownerId) || null;
}

function parseKoreanAmount(text) {
  if (!text) return 0;
  const label = String(text);
  const match = label.match(/([0-9]+(?:\.[0-9]+)?)\s*억/);
  if (!match) return 0;
  const base = Number(match[1]);
  if (!Number.isFinite(base)) return 0;
  return base * 100000000;
}

function parseRangeAmountHint(ownerId, rangeLabel) {
  if (!rangeLabel) return 0;
  const label = String(rangeLabel);
  if (label.includes('~')) {
    const [minRaw, maxRaw] = label.split('~');
    const minVal = parseKoreanAmount(minRaw);
    const maxVal = parseKoreanAmount(maxRaw);
    if (minVal && maxVal) return Math.round((minVal + maxVal) / 2);
  }
  if (label.includes('미만')) {
    const target = parseKoreanAmount(label);
    return target > 0 ? Math.round(target * 0.9) : 0;
  }
  if (label.includes('이상')) {
    const target = parseKoreanAmount(label);
    if (target > 0) {
      return ownerId === 'mois' ? Math.round(target * 1.2) : Math.round(target * 1.1);
    }
  }
  const fallback = parseKoreanAmount(label);
  return fallback > 0 ? fallback : 0;
}

function selectTierForAmount(agency, amount) {
  const tiersRaw = Array.isArray(agency && agency.tiers) ? agency.tiers.slice() : [];
  if (!tiersRaw.length) return { tier: null, effectiveAmount: toNumber(amount) };
  const sorted = tiersRaw.sort((a, b) => toNumber(a && a.minAmount) - toNumber(b && b.minAmount));
  let effectiveAmount = toNumber(amount);
  if (!(effectiveAmount > 0)) {
    const firstMin = toNumber(sorted[0] && sorted[0].minAmount);
    effectiveAmount = firstMin > 0 ? firstMin : 0;
  }

  const findTier = (value) => {
    if (!(value > 0)) return null;
    return sorted.find((tier) => {
      const min = toNumber(tier && tier.minAmount);
      const maxRaw = tier && tier.maxAmount;
      const maxVal = maxRaw === null || maxRaw === undefined || maxRaw === '' ? Infinity : toNumber(maxRaw);
      const lower = Number.isFinite(min) ? min : 0;
      const upper = Number.isFinite(maxVal) && maxVal > 0 ? maxVal : Infinity;
      return value >= lower && value < upper;
    }) || null;
  };

  let tier = findTier(effectiveAmount);
  if (!tier) tier = findTier(toNumber(amount));
  if (!tier) tier = sorted[sorted.length - 1];
  return { tier, effectiveAmount };
}

function derivePerformanceRatio(perfConfig) {
  if (!perfConfig) return null;
  const thresholds = Array.isArray(perfConfig.thresholds) ? perfConfig.thresholds : [];
  if (perfConfig.mode !== 'ratio-bands' || !thresholds.length) return null;
  const parsed = thresholds
    .map((row) => ({ ratio: toNumber(row && row.minRatio), score: toNumber(row && row.score) }))
    .filter((row) => Number.isFinite(row.ratio) && Number.isFinite(row.score))
    .sort((a, b) => a.ratio - b.ratio);
  if (!parsed.length) return null;
  const targetScore = Number.isFinite(toNumber(perfConfig.maxScore)) && toNumber(perfConfig.maxScore) > 0
    ? toNumber(perfConfig.maxScore)
    : parsed.reduce((max, item) => Math.max(max, item.score), parsed[0].score);
  const perfectBand = parsed
    .filter((row) => row.score >= targetScore)
    .sort((a, b) => b.ratio - a.ratio)[0];
  if (perfectBand) return perfectBand.ratio;
  return parsed[parsed.length - 1].ratio;
}

function resolvePerformanceOverride(ownerId, rangeLabel) {
  if (!ownerId) return null;
  const ownerOverrides = PERFORMANCE_OVERRIDES[ownerId];
  if (!ownerOverrides) return null;
  const label = rangeLabel ? String(rangeLabel).trim() : '';
  if (label && ownerOverrides[label]) return ownerOverrides[label];
  return null;
}

function resolvePerformanceTarget({ ownerId, rangeLabel, perfConfig, baseAmount, estimatedAmount }) {
  const override = resolvePerformanceOverride(ownerId, rangeLabel);
  const ratioFromConfig = derivePerformanceRatio(perfConfig);
  const base = toNumber(baseAmount);
  const estimated = toNumber(estimatedAmount);
  const resolvedRatio = override && override.ratio != null
    ? override.ratio
    : (Number.isFinite(ratioFromConfig) ? ratioFromConfig : 1);
  let preferredBasis = override && override.basis ? override.basis : (base > 0 ? 'baseAmount' : 'estimatedAmount');
  let basisValue = preferredBasis === 'estimatedAmount' ? estimated : base;
  if (!(basisValue > 0)) {
    basisValue = preferredBasis === 'estimatedAmount' ? base : estimated;
    if (basisValue > 0) {
      preferredBasis = preferredBasis === 'estimatedAmount' ? 'baseAmount' : 'estimatedAmount';
    }
  }
  if (!(basisValue > 0)) {
    basisValue = base || estimated;
    preferredBasis = basisValue === base ? 'baseAmount' : (basisValue === estimated ? 'estimatedAmount' : preferredBasis);
  }
  const amount = basisValue > 0 ? Math.round(basisValue * resolvedRatio) : 0;
  return {
    amount,
    ratio: resolvedRatio,
    basis: preferredBasis,
    overrideApplied: Boolean(override),
  };
}

function extractCompanyMetric(company, keys) {
  if (!company || typeof company !== 'object') return 0;
  for (const key of keys) {
    if (company[key] != null) return toNumber(company[key]);
  }
  return 0;
}

function extractCompanyRegion(company) {
  if (!company || typeof company !== 'object') return '';
  const value = company.region || company['대표지역'] || company['지역'] || '';
  return String(value || '').trim();
}

function evaluateSingleBidByConfig({
  owner,
  rangeLabel,
  estimatedAmount,
  baseAmount,
  entryAmount,
  dutyRegions = [],
  company = {},
}) {
  const ownerId = normalizeOwnerId(owner);
  const agency = getAgency(ownerId);
  if (!agency) {
    return { ok: false, ownerId, reasons: ['해당 발주처 규칙을 찾을 수 없습니다.'] };
  }
  const entry = toNumber(entryAmount);
  const estimated = toNumber(estimatedAmount);
  const base = toNumber(baseAmount);
  const tierHint = estimated || base || entry || parseRangeAmountHint(ownerId, rangeLabel) || 0;
  const { tier } = selectTierForAmount(agency, tierHint);
  const performanceInfo = resolvePerformanceTarget({
    ownerId,
    rangeLabel,
    perfConfig: tier && tier.rules ? tier.rules.performance : null,
    baseAmount: base,
    estimatedAmount: estimated,
  });
  const sipValue = extractCompanyMetric(company, ['시평', '시평액', '시평금액', 'rating', 'sipyung']);
  const perfValue = extractCompanyMetric(company, ['5년 실적', '최근5년실적', 'perf5y', 'performance5y']);
  const region = extractCompanyRegion(company);

  const entryOk = entry > 0
    ? (sipValue > 0 ? sipValue >= entry : null)
    : null;
  const perfTarget = performanceInfo.amount;
  const perfOk = perfTarget > 0
    ? (perfValue > 0 ? perfValue >= perfTarget : null)
    : null;
  const regionOk = Array.isArray(dutyRegions) && dutyRegions.length > 0
    ? (region ? dutyRegions.includes(region) : null)
    : null;

  const ok = [entryOk, perfOk, regionOk].every((flag) => flag !== false);
  const fmt = (num) => (Number.isFinite(num) && num > 0 ? num.toLocaleString() : '0');
  const reasons = [];
  if (entryOk === false) reasons.push(`시평 미달: ${fmt(sipValue)} < 참가자격 ${fmt(entry)}`);
  if (perfOk === false) reasons.push(`5년 실적 미달: ${fmt(perfValue)} < 기준 ${fmt(perfTarget)}`);
  if (regionOk === false) reasons.push(`의무지역 불일치: ${region || '지역 없음'}`);

  return {
    ok,
    ownerId,
    entryOk,
    perfOk,
    regionOk,
    reasons,
    facts: {
      sipyung: sipValue,
      perf5y: perfValue,
      entry,
      performanceTarget: perfTarget,
      performanceBasis: performanceInfo.basis,
      performanceRatio: performanceInfo.ratio,
      region,
    },
    tierAmount: tierHint,
    performanceInfo,
  };
}

module.exports = {
  evaluateSingleBidByConfig,
  resolvePerformanceTarget,
  normalizeOwnerId,
};
