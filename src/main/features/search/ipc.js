// src/main/features/search/ipc.js
// IPC handlers for aggregated 'all' queries (feature-scoped)

const { SearchLogic } = require('../../../../searchLogic.js');

const sanitizeIpcPayload = (payload) => {
  if (payload === null || payload === undefined) return payload;
  const type = typeof payload;
  if (type === 'string' || type === 'number' || type === 'boolean') return payload;
  if (Array.isArray(payload)) {
    try { return JSON.parse(JSON.stringify(payload)); }
    catch (err) { console.warn('[MAIN][all] sanitize array failed:', err); return payload.map((item) => sanitizeIpcPayload(item)); }
  }
  try { return JSON.parse(JSON.stringify(payload)); }
  catch (err) {
    console.warn('[MAIN][all] sanitize payload failed:', err);
    const clone = {};
    Object.keys(payload || {}).forEach((key) => { clone[key] = sanitizeIpcPayload(payload[key]); });
    return clone;
  }
};

const parseMaybeJson = (value, label = 'payload') => {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); }
  catch (err) {
    console.warn(`[MAIN][all] ${label} JSON.parse failed:`, err?.message || err);
    return value;
  }
};

function registerAllIpcHandlers({ ipcMain, searchService, searchLogics }) {
  if (!ipcMain) return;

  // Aggregate regions across all loaded datasets
  ipcMain.handle('get-regions-all', () => {
    try {
      if (searchService) {
        const regions = searchService.getRegionsAll();
        return { success: true, data: regions };
      }
      // fallback: aggregate from provided searchLogics map
      const set = new Set(['전체']);
      Object.keys(searchLogics || {}).forEach((key) => {
        const logic = (searchLogics || {})[key];
        if (logic && logic.isLoaded && logic.isLoaded()) {
          try { logic.getUniqueRegions().forEach(r => set.add(r)); } catch {}
        }
      });
      return { success: true, data: Array.from(set) };
    } catch (e) {
      return { success: true, data: ['전체'] };
    }
  });

  // Search across all loaded datasets and annotate origin type
  ipcMain.handle('search-companies-all', (event, { criteria, options }) => {
    if (searchService) {
      const normalizedCriteria = parseMaybeJson(criteria, 'criteria');
      const normalizedOptions = parseMaybeJson(options, 'options');
      const result = searchService.searchAll(normalizedCriteria, normalizedOptions || {});
      if (result && typeof result === 'object' && !Array.isArray(result) && result.meta && result.items) {
        return {
          success: true,
          data: sanitizeIpcPayload(result.items),
          meta: sanitizeIpcPayload(result.meta),
        };
      }
      return { success: true, data: sanitizeIpcPayload(result) };
    }
    const merged = [];
    const normalizedCriteria = parseMaybeJson(criteria, 'criteria');
    Object.keys(searchLogics || {}).forEach((key) => {
      const logic = (searchLogics || {})[key];
      if (logic && logic.isLoaded && logic.isLoaded()) {
        try {
          const res = logic.search(normalizedCriteria) || [];
          res.forEach((item) => merged.push({ ...item, _file_type: key }));
        } catch {}
      }
    });
    const normalizedOptions = parseMaybeJson(options, 'options');
    const processed = SearchLogic.postProcessResults(merged, normalizedOptions || {});
    if (processed && processed.paginated) {
      return {
        success: true,
        data: sanitizeIpcPayload(processed.items),
        meta: sanitizeIpcPayload(processed.meta),
      };
    }
    return { success: true, data: sanitizeIpcPayload(processed.items) };
  });
}

module.exports = { registerAllIpcHandlers };
