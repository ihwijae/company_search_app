// src/main/features/search/services/searchService.js
// Search domain orchestration using feature-scoped adapter

const { SearchLogic } = require('../../../../../searchLogic.js');

class SearchService {
  constructor({ sanitizeXlsx, chokidar, registerSanitized, debounceMs = 500, notifyUpdated }) {
    this.sanitizeXlsx = sanitizeXlsx;
    this.chokidar = chokidar;
    this.registerSanitized = registerSanitized || (() => {});
    this.debounceMs = debounceMs;
    this.notifyUpdated = typeof notifyUpdated === 'function' ? notifyUpdated : () => {};
    this.searchLogics = {}; // { eung|tongsin|sobang: SearchLogic }
    this.fileWatchers = {}; // { type: FSWatcher }
  }

  debounce(fn, delay) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
  }

  isLoaded(type) {
    const logic = this.searchLogics[type];
    return !!(logic && logic.isLoaded && logic.isLoaded());
  }

  getStatuses() {
    const keys = ['eung', 'tongsin', 'sobang'];
    const status = {};
    keys.forEach((k) => { status[k] = this.isLoaded(k); });
    return status;
  }

  getRegions(type) {
    const logic = this.searchLogics[type];
    if (logic && logic.isLoaded && logic.isLoaded()) return logic.getUniqueRegions();
    return ['전체'];
  }

  getRegionsAll() {
    const set = new Set(['전체']);
    Object.keys(this.searchLogics).forEach((k) => {
      const logic = this.searchLogics[k];
      if (logic && logic.isLoaded && logic.isLoaded()) {
        try { logic.getUniqueRegions().forEach((r) => set.add(r)); } catch {}
      }
    });
    return Array.from(set);
  }

  search(type, criteria, options = {}) {
    const logic = this.searchLogics[type];
    if (!logic || !logic.isLoaded || !logic.isLoaded()) {
      throw new Error(`${type} 파일이 로드되지 않았습니다`);
    }
    console.log('[SearchService] search', { type, filePath: logic.filePath || '' });
    const results = logic.search(criteria, options || {});
    return Array.isArray(results)
      ? results.map((item) => ({ ...item, _file_type: type }))
      : results;
  }

  searchAll(criteria, options = {}) {
    const merged = [];
    Object.keys(this.searchLogics).forEach((key) => {
      const logic = this.searchLogics[key];
      if (logic && logic.isLoaded && logic.isLoaded()) {
        try {
          const subset = logic.search(criteria) || [];
          subset.forEach((item) => merged.push({ ...item, _file_type: key }));
        } catch {}
      }
    });
    const processed = SearchLogic.postProcessResults(merged, options || {});
    if (processed && processed.paginated) {
      return { items: processed.items, meta: processed.meta };
    }
    return processed.items;
  }

  searchMany(type, names, options = {}) {
    const logic = this.searchLogics[type];
    if (!logic || !logic.isLoaded || !logic.isLoaded()) {
      throw new Error(`${type} 파일이 로드되지 않았습니다`);
    }
    const results = logic.searchMany(names, options || {});
    return results.map(item => ({ ...item, _file_type: type }));
  }

  async loadAndWatch(fileType, sourcePath) {
    const { sanitizedPath, sanitized } = this.sanitizeXlsx(sourcePath);
    if (sanitized) this.registerSanitized(sourcePath, sanitizedPath);
    const logic = new SearchLogic(sanitizedPath);
    await logic.load();
    this.searchLogics[fileType] = logic;
    console.log('[SearchService] loaded', { type: fileType, sourcePath, sanitizedPath });
    try { this.notifyUpdated(fileType); } catch {}

    if (this.fileWatchers[fileType]) {
      try { await this.fileWatchers[fileType].close(); } catch {}
      delete this.fileWatchers[fileType];
    }

    const debouncedReload = this.debounce(async () => {
      try {
        const { sanitizedPath: sp2, sanitized: san2 } = this.sanitizeXlsx(sourcePath);
        if (san2) this.registerSanitized(sourcePath, sp2);
        const lg = new SearchLogic(sp2);
        await lg.load();
        this.searchLogics[fileType] = lg;
        this.notifyUpdated(fileType);
      } catch {}
    }, this.debounceMs);

    const watcher = this.chokidar.watch(sourcePath, { ignoreInitial: true });
    watcher.on('change', () => debouncedReload());
    this.fileWatchers[fileType] = watcher;
  }
}

module.exports = { SearchService };
