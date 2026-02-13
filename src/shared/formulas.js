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

const isRunningInWSL = (() => {
  if (process.platform !== 'linux') return false;
  if (process.env.WSL_DISTRO_NAME) return true;
  try {
    const release = fs.readFileSync('/proc/version', 'utf-8').toLowerCase();
    return release.includes('microsoft');
  } catch {
    return false;
  }
})();

function toWSLPathIfNeeded(p) {
  if (!p || !isRunningInWSL) return p;
  const match = /^([A-Za-z]):\\(.*)$/.exec(p);
  if (!match) return p;
  const drive = match[1].toLowerCase();
  const rest = match[2].replace(/\\/g, '/');
  return `/mnt/${drive}/${rest}`;
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
      return toWSLPathIfNeeded(app.getPath('userData'));
    }
  } catch (_) {
    // non-electron context
  }
  // Fallback to local project folder .userData
  return toWSLPathIfNeeded(path.join(process.cwd(), '.userData'));
}

function loadFormulasMerged() {
  // Force defaults-only mode: ignore any userData/formulas.json overrides.
  return deepClone(defaults);
}

function loadFormulasDefaults() {
  return deepClone(defaults);
}

module.exports = {
  loadFormulasMerged,
  loadFormulasDefaults,
  _internals: { mergeAgencies, mergeTiers, loadUserOverrides, getUserDataDirSafe }
};
