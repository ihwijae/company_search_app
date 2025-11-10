// Evaluation engine skeleton: computes scores from merged formulas
// CommonJS module to be usable from Electron main and renderer bundles.

const { loadFormulasMerged } = require('./formulas');

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function applyRounding(num, rounding) {
  if (rounding == null) return num;
  const digits = Number(rounding.digits || 0);
  const f = 10 ** digits;
  const method = rounding.method || 'round';
  switch (method) {
    case 'truncate':
      // Truncate toward zero
      return Math.trunc(num * f) / f;
    case 'floor':
      return Math.floor(num * f) / f;
    case 'ceil':
      return Math.ceil(num * f) / f;
    case 'round':
    default:
      return Math.round(num * f) / f;
  }
}

function evaluateThresholdScore(value, thresholds) {
  // thresholds is ordered. Rules may contain lt/gte, or year-based fields.
  for (const t of thresholds || []) {
    if (typeof t.lt === 'number' && value < t.lt) return toNumber(t.score);
    if (typeof t.gte === 'number' && value >= t.gte && (t.lt == null || value < t.lt)) return toNumber(t.score);
  }
  // If not matched, return last score if present
  const last = thresholds && thresholds[thresholds.length - 1];
  return toNumber(last && last.score);
}

function evaluateBizYearsScore(years, thresholds) {
  for (const t of thresholds || []) {
    if (typeof t.gteYears === 'number' && years >= t.gteYears) return toNumber(t.score);
    if (typeof t.ltYears === 'number' && years < t.ltYears) return toNumber(t.score);
  }
  const last = thresholds && thresholds[thresholds.length - 1];
  return toNumber(last && last.score);
}

function getIndustryAverages(rules, provided) {
  // Prefer explicit override in rules
  const cfg = (rules && rules.management && rules.management.industryAverage) || {};
  if (cfg.override && typeof cfg.override === 'object') return cfg.override;
  // Else use provided from caller; fallback neutral 100% so ratios become 1x
  return provided || { debtRatio: 100, currentRatio: 100 };
}

function evalManagementComposite(inputs, rules, industryAvg) {
  const comps = (rules.management && rules.management.methods && rules.management.methods.find(m => m.id === 'composite')) || null;
  if (!comps) return { score: 0, parts: {}, methodId: 'composite' };
  const def = comps.components || {};
  const avg = getIndustryAverages(rules, industryAvg);
  const debt = toNumber(inputs.debtRatio);
  const current = toNumber(inputs.currentRatio);
  const years = toNumber(inputs.bizYears);
  const quality = toNumber(inputs.qualityEval || 85); // default 85 if absent
  const debtNorm = avg.debtRatio ? debt / avg.debtRatio : debt; // lower is better
  const currentNorm = avg.currentRatio ? current / avg.currentRatio : current; // higher is better

  const debtScore = evaluateThresholdScore(debtNorm, def.debtRatio && def.debtRatio.thresholds);
  const currentScore = evaluateThresholdScore(currentNorm, def.currentRatio && def.currentRatio.thresholds);
  const yearsScore = evaluateBizYearsScore(years, def.bizYears && def.bizYears.thresholds);
  const qualityScore = evaluateThresholdScore(quality, def.qualityEval && def.qualityEval.thresholds);
  const scoreRaw = toNumber(debtScore) + toNumber(currentScore) + toNumber(yearsScore) + toNumber(qualityScore);

  console.log('[SCORE DEBUG] --------------------------');
  console.log('[SCORE DEBUG] Debt Score:    ', debtScore);
  console.log('[SCORE DEBUG] Current Score: ', currentScore);
  console.log('[SCORE DEBUG] Years Score:   ', yearsScore);
  console.log('[SCORE DEBUG] Quality Score: ', qualityScore);
  console.log('[SCORE DEBUG] Raw Total:     ', scoreRaw);
  console.log('[SCORE DEBUG] --------------------------');

  const score = applyRounding(scoreRaw, rules.management.rounding);
  return { score, parts: { debtScore, currentScore, yearsScore, qualityScore }, methodId: 'composite' };
}

function evalManagementCredit(inputs, rules) {
  const credit = (rules.management && rules.management.methods && rules.management.methods.find(m => m.id === 'credit')) || null;
  if (!credit) return { score: 0, methodId: 'credit' };
  const grade = String(inputs.creditGrade || '').trim().toUpperCase();
  const found = (credit.gradeTable || []).find(g => String(g.grade).toUpperCase() === grade);
  const raw = found ? toNumber(found.score) : 0;
  const score = applyRounding(raw, rules.management.rounding);
  return { score, methodId: 'credit', grade, base: found ? found.base : null };
}

function evalManagement(inputs, rules, industryAvg) {
  const composite = evalManagementComposite(inputs, rules, industryAvg);
  const credit = evalManagementCredit(inputs, rules);
  const selection = (rules.management && rules.management.methodSelection) || 'max';
  if (selection === 'max') {
    return composite.score >= credit.score ? { chosen: 'composite', composite, credit, score: composite.score } : { chosen: 'credit', composite, credit, score: credit.score };
  }
  // Otherwise, fall back to composite
  return { chosen: 'composite', composite, credit, score: composite.score };
}

function evalPerformance(inputs, rules) {
  const perf = rules.performance || {};
  const perf5y = toNumber(inputs.perf5y);
  const base = toNumber(inputs.baseAmount);
  const configMaxScoreRaw = Number(perf.maxScore);
  const configMaxScore = Number.isFinite(configMaxScoreRaw) ? configMaxScoreRaw : null;

  const thresholdsArray = Array.isArray(perf.thresholds) ? perf.thresholds : [];
  const thresholdMax = thresholdsArray.reduce((acc, item) => {
    const scoreRaw = Number(item && item.score);
    return Number.isFinite(scoreRaw) ? Math.max(acc, scoreRaw) : acc;
  }, 0);

  let resolvedMaxScore = null;
  if (perf.mode === 'ratio-bands') {
    if (thresholdMax > 0 || configMaxScore != null) {
      // If both exist, keep the higher one so manual caps never shrink band scores.
      const candidate = thresholdMax > 0 ? thresholdMax : 0;
      const fallback = configMaxScore != null ? configMaxScore : 0;
      const best = Math.max(candidate, fallback);
      resolvedMaxScore = best > 0 ? best : null;
    }
  } else if (configMaxScore != null) {
    resolvedMaxScore = configMaxScore;
  } else {
    resolvedMaxScore = 13;
  }

  const hasCap = Number.isFinite(resolvedMaxScore) && resolvedMaxScore > 0;
  const maxScore = hasCap ? resolvedMaxScore : null;

  const ratio = base > 0 ? (perf5y / base) : 0;

  if (perf.mode === 'ratio-bands' && Array.isArray(perf.thresholds) && perf.thresholds.length > 0) {
    const sorted = [...perf.thresholds]
      .map((item) => ({
        minRatio: typeof item.minRatio === 'number' ? item.minRatio : toNumber(item.minRatio),
        score: typeof item.score === 'number' ? item.score : toNumber(item.score),
      }))
      .filter((item) => Number.isFinite(item.minRatio) && Number.isFinite(item.score))
      .sort((a, b) => a.minRatio - b.minRatio);

    let bandScore = null;
    for (const band of sorted) {
      if (ratio >= band.minRatio) {
        bandScore = band.score;
      } else {
        break;
      }
    }
    const usable = bandScore != null ? bandScore : 0;
    const clamped = maxScore != null ? Math.min(usable, maxScore) : usable;
    const score = applyRounding(clamped, perf.rounding);
    return { score, raw: usable, capped: clamped, mode: 'ratio-bands', ratio, maxScore };
  }

  const raw = base > 0 ? ratio * maxScore : 0;
  const capped = maxScore != null ? Math.min(raw, maxScore) : raw;
  const score = applyRounding(capped, perf.rounding);
  return { score, raw, capped, mode: 'formula', ratio, maxScore };
}

function pickTierByAmount(tiers = [], amount) {
  const a = toNumber(amount);
  if (!Number.isFinite(a)) return tiers && tiers[0];
  // inclusive min, exclusive max
  return tiers.find(t => a >= toNumber(t.minAmount) && a < toNumber(t.maxAmount)) || tiers[0];
}

function evaluateScores({ agencyId, amount, inputs = {}, industryAvg } = {}) {
  const formulas = loadFormulasMerged();
  const agency = (formulas.agencies || []).find(a => a.id === agencyId) || (formulas.agencies || [])[0];
  if (!agency) return { ok: false, error: 'NO_AGENCY' };
  const tier = pickTierByAmount(agency.tiers || [], amount);
  if (!tier) return { ok: false, error: 'NO_TIER' };
  const rules = tier.rules || {};

  const management = evalManagement(inputs, rules, industryAvg);
  const performance = evalPerformance(inputs, rules);

  return {
    ok: true,
    agency: { id: agency.id, name: agency.name },
    tier: { minAmount: tier.minAmount, maxAmount: tier.maxAmount },
    management,
    performance,
    meta: { methodSelection: (rules.management && rules.management.methodSelection) || 'max' }
  };
}

module.exports = {
  evaluateScores,
  pickTierByAmount,
  applyRounding,
};
