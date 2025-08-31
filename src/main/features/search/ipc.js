// src/main/features/search/ipc.js
// IPC handlers for aggregated 'all' queries (feature-scoped)

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
  ipcMain.handle('search-companies-all', (event, { criteria }) => {
    if (searchService) {
      const merged = searchService.searchAll(criteria);
      return { success: true, data: merged };
    }
    const merged = [];
    Object.keys(searchLogics || {}).forEach((key) => {
      const logic = (searchLogics || {})[key];
      if (logic && logic.isLoaded && logic.isLoaded()) {
        try {
          const res = logic.search(criteria) || [];
          res.forEach((item) => merged.push({ ...item, _file_type: key }));
        } catch {}
      }
    });
    return { success: true, data: merged };
  });
}

module.exports = { registerAllIpcHandlers };
