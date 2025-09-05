// Shared loader for evaluation formulas: defaults + user overrides
// CommonJS to be usable from Electron main and renderer (via bundler)

const fs = require('fs');
const path = require('path');

const defaults = require('./formulas.defaults.json');

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function indexByAgencyId(arr) {
  const map = new Map();
  for (const a of arr || []) map.set(a.id, a);
  return map;
}

function mergeTiers(baseTiers = [], overrideTiers = []) {
  if (!overrideTiers || overrideTiers.length === 0) return deepClone(baseTiers);
  const result = deepClone(baseTiers);
  for (const ot of overrideTiers) {
    const idx = result.findIndex(bt => bt.minAmount === ot.minAmount && bt.maxAmount === ot.maxAmount);
    if (idx >= 0) {
      result[idx] = { ...result[idx], ...ot, rules: { ...(result[idx].rules || {}), ...(ot.rules || {}) } };
    } else {
      result.push(deepClone(ot));
    }
  }
  return result;
}

function mergeAgencies(baseAgencies = [], overrideAgencies = []) {
  const baseMap = indexByAgencyId(baseAgencies);
  const result = [];
  // First, copy all base agencies
  for (const a of baseAgencies) {
    result.push(deepClone(a));
  }
  // Apply overrides
  for (const oa of overrideAgencies || []) {
    const idx = result.findIndex(x => x.id === oa.id);
    if (idx >= 0) {
      result[idx] = {
        ...result[idx],
        ...oa,
        tiers: mergeTiers(result[idx].tiers, oa.tiers)
      };
    } else {
      result.push(deepClone(oa));
    }
  }
  return result;
}

function loadUserOverrides(userDataDir) {
  try {
    const file = path.join(userDataDir, 'formulas.json');
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, 'utf8');
      const json = JSON.parse(raw);
      return json;
    }
  } catch (e) {
    console.warn('[formulas] Failed to load user overrides:', e?.message || e);
  }
  return null;
}

function getUserDataDirSafe() {
  try {
    // Try Electron app if available
    // eslint-disable-next-line global-require
    const electron = require('electron');
    const app = electron.app || (electron.remote && electron.remote.app);
    if (app && typeof app.getPath === 'function') {
      return app.getPath('userData');
    }
  } catch (_) {
    // non-electron context
  }
  // Fallback to local project folder .userData
  return path.join(process.cwd(), '.userData');
}

function loadFormulasMerged() {
  const base = deepClone(defaults);
  const userDir = getUserDataDirSafe();
  const overrides = loadUserOverrides(userDir);
  if (!overrides || !overrides.agencies) return base;
  const merged = deepClone(base);
  merged.agencies = mergeAgencies(base.agencies, overrides.agencies);
  merged.version = Math.max(base.version || 1, overrides.version || 1);
  return merged;
}

module.exports = {
  loadFormulasMerged,
  _internals: { mergeAgencies, mergeTiers, loadUserOverrides, getUserDataDirSafe }
};

