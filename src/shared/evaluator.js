// Evaluation engine skeleton: computes scores from merged formulas
// CommonJS module to be usable from Electron main and renderer bundles.

const { loadFormulasMerged, loadFormulasDefaults } = require('./formulas');

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

function getThresholdMaxScore(thresholds) {
  if (!Array.isArray(thresholds)) return 0;
  return thresholds.reduce((max, item) => {
    const val = toNumber(item && item.score);
    return Number.isFinite(val) ? Math.max(max, val) : max;
  }, 0);
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
    const scoreRaw = toNumber(debtScore) + toNumber(currentScore) + toNumber(yearsScore) + (rules.agencyId !== 'lh' ? toNumber(qualityScore) : 0);
  
    console.log('[EVAL DEBUG] Composite Scores:');
    console.log('[EVAL DEBUG]   Debt Score:    ', debtScore);
    console.log('[EVAL DEBUG]   Current Score: ', currentScore);
    console.log('[EVAL DEBUG]   Years Score:   ', yearsScore);
    console.log('[EVAL DEBUG]   Raw Total:     ', scoreRaw);
    console.log('[EVAL DEBUG] --------------------------');
  
  const score = applyRounding(scoreRaw, rules.management.rounding);
  const debtMax = getThresholdMaxScore(def.debtRatio && def.debtRatio.thresholds);
  const currentMax = getThresholdMaxScore(def.currentRatio && def.currentRatio.thresholds);
  const yearsMax = getThresholdMaxScore(def.bizYears && def.bizYears.thresholds);
  const qualityMax = getThresholdMaxScore(def.qualityEval && def.qualityEval.thresholds);
  let compositeMaxScore = Number(comps.maxScore);
  if (!Number.isFinite(compositeMaxScore) || compositeMaxScore <= 0) {
    compositeMaxScore = toNumber(debtMax) + toNumber(currentMax) + toNumber(yearsMax) + (rules.agencyId !== 'lh' ? toNumber(qualityMax) : 0);
  }
  return {
    score,
    parts: { debtScore, currentScore, yearsScore, qualityScore },
    methodId: 'composite',
    maxScore: Number.isFinite(compositeMaxScore) && compositeMaxScore > 0 ? compositeMaxScore : null,
  };
}

function evalManagementCredit(inputs, rules) {
  const credit = (rules.management && rules.management.methods && rules.management.methods.find(m => m.id === 'credit')) || null;
  if (!credit) return { score: 0, methodId: 'credit' };
  const grade = String(inputs.creditGrade || '').trim().toUpperCase();
  const found = (credit.gradeTable || []).find(g => String(g.grade).toUpperCase() === grade);
  const raw = found ? toNumber(found.score) : 0;
  const score = applyRounding(raw, rules.management.rounding);
  const maxFromTable = getThresholdMaxScore(credit.gradeTable);
  const creditMaxScore = Number.isFinite(Number(credit.maxScore)) && Number(credit.maxScore) > 0
    ? Number(credit.maxScore)
    : (maxFromTable > 0 ? maxFromTable : null);
  return { score, methodId: 'credit', grade, base: found ? found.base : null, maxScore: creditMaxScore };
}

function evalManagement(inputs, rules, industryAvg) {
  const composite = evalManagementComposite(inputs, rules, industryAvg);
  const credit = evalManagementCredit(inputs, rules);
  const selection = (rules.management && rules.management.methodSelection) || 'max';
  const result = (() => {
    if (selection === 'max') {
      return composite.score >= credit.score
        ? { chosen: 'composite', composite, credit, score: composite.score }
        : { chosen: 'credit', composite, credit, score: credit.score };
    }
    return { chosen: 'composite', composite, credit, score: composite.score };
  })();
  const compositeMax = Number.isFinite(Number(composite.maxScore)) ? Number(composite.maxScore) : null;
  const creditMax = Number.isFinite(Number(credit.maxScore)) ? Number(credit.maxScore) : null;
  const resolvedMax = Math.max(compositeMax || 0, creditMax || 0) || compositeMax || creditMax || null;
  const isPerfect = Number.isFinite(resolvedMax) && resolvedMax > 0
    ? Math.abs(result.score - resolvedMax) < 1e-6
    : false;
  return { ...result, meta: { maxScore: resolvedMax, isPerfect } };
}

function resolvePerformanceVariant(perf, inputs = {}) {
  if (!perf || typeof perf !== 'object') return perf;
  const variants = Array.isArray(perf.variants) ? perf.variants : [];
  if (!variants.length) return perf;
  const fileType = String(inputs.fileType || inputs.industryLabel || '').trim().toLowerCase();
  const estimatedRaw = inputs.estimatedAmount;
  const estimatedAmount = (estimatedRaw === null || estimatedRaw === undefined || estimatedRaw === '')
    ? null
    : toNumber(estimatedRaw);
  for (const variant of variants) {
    if (!variant || typeof variant !== 'object') continue;
    const when = variant.when || {};
    if (Array.isArray(when.fileTypes) && when.fileTypes.length > 0) {
      const allowed = when.fileTypes.map((value) => String(value || '').trim().toLowerCase()).filter(Boolean);
      if (!fileType || !allowed.includes(fileType)) continue;
    }
    const lt = Number(when.estimatedAmountLt);
    if (Number.isFinite(lt) && Number.isFinite(estimatedAmount) && !(estimatedAmount < lt)) continue;
    if (Number.isFinite(lt) && !Number.isFinite(estimatedAmount)) continue;
    const gte = Number(when.estimatedAmountGte);
    if (Number.isFinite(gte) && Number.isFinite(estimatedAmount) && !(estimatedAmount >= gte)) continue;
    if (Number.isFinite(gte) && !Number.isFinite(estimatedAmount)) continue;
    const { when: _when, ...variantConfig } = variant;
    return { ...perf, ...variantConfig };
  }
  return perf;
}

function evalPerformanceFormula(formula, context) {
  if (!formula || typeof formula !== 'string') return null;
  try {
    const fn = new Function('perf5y', 'baseAmount', 'estimatedAmount', `return (${formula});`);
    const value = fn(context.perf5y, context.baseAmount, context.estimatedAmount);
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  } catch {
    return null;
  }
}

function evalPerformance(inputs, rules) {
  const perf = resolvePerformanceVariant(rules.performance || {}, inputs);
  const perf5y = toNumber(inputs.perf5y);
  const base = toNumber(inputs.baseAmount);
  const estimatedAmount = toNumber(inputs.estimatedAmount);
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

  const formulaScore = evalPerformanceFormula(perf.formula, { perf5y, baseAmount: base, estimatedAmount });
  const raw = formulaScore != null ? formulaScore : (base > 0 ? ratio * maxScore : 0);
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

function resolveFormulasDocument(useDefaultsOnly) {
  if (useDefaultsOnly) {
    return loadFormulasDefaults();
  }
  return loadFormulasMerged();
}

function evaluateScores({ agencyId, amount, inputs = {}, industryAvg, useDefaultsOnly } = {}) {
  const formulas = resolveFormulasDocument(useDefaultsOnly);
  const agency = (formulas.agencies || []).find(a => String(a.id || '').toLowerCase() === String(agencyId || '').toLowerCase()) || (formulas.agencies || [])[0];
  if (!agency) return { ok: false, error: 'NO_AGENCY' };
  const tier = pickTierByAmount(agency.tiers || [], amount);
  if (!tier) return { ok: false, error: 'NO_TIER' };
  const rules = tier.rules || {};

  console.log('[EVAL DEBUG] Selected Agency:', agency.name, '(' + agency.id + ')');
  console.log('[EVAL DEBUG] Selected Tier:', tier.minAmount, '~', tier.maxAmount);
  console.log('[EVAL DEBUG] Rules for Management:', JSON.stringify(rules.management));

  rules.agencyId = agency.id; // Pass agencyId down to subsequent evaluations

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
