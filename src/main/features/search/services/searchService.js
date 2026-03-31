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
    this.loadedSourcePaths = {}; // { type: sourcePath }
    this.sourceModes = {}; // { type: auto|manual }
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

  getLoadedSourcePath(type) {
    return this.loadedSourcePaths[type] || '';
  }

  getSourceMode(type) {
    return this.sourceModes[type] || 'auto';
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

  async loadAndWatch(fileType, sourcePath, options = {}) {
    const resolveSourcePath = typeof options.resolveSourcePath === 'function'
      ? options.resolveSourcePath
      : () => sourcePath;
    const watchPath = options.watchPath || sourcePath;
    const initialSourcePath = resolveSourcePath() || sourcePath;
    const { sanitizedPath, sanitized } = this.sanitizeXlsx(initialSourcePath);
    if (sanitized) this.registerSanitized(initialSourcePath, sanitizedPath);
    const logic = new SearchLogic(sanitizedPath);
    await logic.load();
    this.searchLogics[fileType] = logic;
    this.loadedSourcePaths[fileType] = initialSourcePath;
    this.sourceModes[fileType] = options.mode || this.sourceModes[fileType] || 'auto';
    console.log('[SearchService] loaded', { type: fileType, sourcePath: initialSourcePath, sanitizedPath });
    try { this.notifyUpdated(fileType); } catch {}

    if (this.fileWatchers[fileType]) {
      try { await this.fileWatchers[fileType].close(); } catch {}
      delete this.fileWatchers[fileType];
    }

    const debouncedReload = this.debounce(async () => {
      try {
        const nextSourcePath = resolveSourcePath() || sourcePath;
        const { sanitizedPath: sp2, sanitized: san2 } = this.sanitizeXlsx(nextSourcePath);
        if (san2) this.registerSanitized(nextSourcePath, sp2);
        const lg = new SearchLogic(sp2);
        await lg.load();
        this.searchLogics[fileType] = lg;
        this.loadedSourcePaths[fileType] = nextSourcePath;
        this.notifyUpdated(fileType);
      } catch {}
    }, this.debounceMs);

    const watcher = this.chokidar.watch(watchPath, { ignoreInitial: true });
    watcher.on('change', () => debouncedReload());
    watcher.on('add', () => debouncedReload());
    watcher.on('unlink', () => debouncedReload());
    this.fileWatchers[fileType] = watcher;
  }
}

module.exports = { SearchService };
