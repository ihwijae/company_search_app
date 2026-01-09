// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // (?섏젙) searchCompanies???댁젣 criteria? file_type???④퍡 諛쏆뒿?덈떎.
  searchCompanies: (criteria, file_type, options) => (
    file_type === 'all'
      ? ipcRenderer.invoke('search-companies-all', { criteria, options })
      : ipcRenderer.invoke('search-companies', { criteria, file_type, options })
  ),
  searchManyCompanies: (names, file_type, options) => ipcRenderer.invoke('search-many-companies', { names, file_type, options }),
  smppCheckOne: (payload) => ipcRenderer.invoke('smpp:check-one', payload),
  smppGetCredentials: () => ipcRenderer.invoke('smpp:get-creds'),
  smppSetCredentials: (payload) => ipcRenderer.invoke('smpp:set-creds', payload),
  
  // (異붽?) ?덈줈??API?ㅼ쓣 ?깅줉?⑸땲??
  checkFiles: () => ipcRenderer.invoke('check-files'),
  getRegions: (file_type) => (
    file_type === 'all'
      ? ipcRenderer.invoke('get-regions-all')
      : ipcRenderer.invoke('get-regions', file_type)
  ),
  // [異붽?] ?뚯씪 ?좏깮 API
  selectFile: (fileType) => ipcRenderer.invoke('select-file', fileType),
  // [추가] 현재 등록된 파일 경로 조회
  getFilePaths: () => ipcRenderer.invoke('get-file-paths'),
  // [異붽?] ?곗씠??媛깆떊 ?대깽??援щ룆
  onDataUpdated: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('data-updated', handler);
    return () => ipcRenderer.removeListener('data-updated', handler);
  },
  // Agreements persistence APIs
  loadAgreements: () => ipcRenderer.invoke('agreements-load'),
  saveAgreements: (items) => ipcRenderer.invoke('agreements-save', items),
  agreementBoardSave: (payload) => ipcRenderer.invoke('agreement-board-save', payload),
  agreementBoardList: () => ipcRenderer.invoke('agreement-board-list'),
  agreementBoardLoad: (path) => ipcRenderer.invoke('agreement-board-load', path),

  // Formulas: load/save/evaluate
  formulasLoad: () => ipcRenderer.invoke('formulas-load'),
  formulasLoadDefaults: () => ipcRenderer.invoke('formulas-load-defaults'),
  formulasLoadOverrides: (payload) => ipcRenderer.invoke('formulas-load-overrides', payload),
  formulasSaveOverrides: (payload) => ipcRenderer.invoke('formulas-save-overrides', payload),
  formulasEvaluate: (payload) => ipcRenderer.invoke('formulas-evaluate', payload),
  excelHelperFormulasEvaluate: (payload) => ipcRenderer.invoke('excel-helper-formulas-evaluate', payload),

  // Agreements Rules (load/save)
  agreementsRulesLoad: () => ipcRenderer.invoke('agreements-rules-load'),
  agreementsRulesSave: (payload) => ipcRenderer.invoke('agreements-rules-save', payload),
  settingsExport: () => ipcRenderer.invoke('agreements-settings-export'),
  settingsImport: () => ipcRenderer.invoke('agreements-settings-import'),
  // Agreements: candidates fetch
  fetchCandidates: (params) => ipcRenderer.invoke('agreements-fetch-candidates', params),
  // Clipboard helper: write as 1-column CSV
  copyCsvColumn: (rows) => ipcRenderer.invoke('copy-csv-column', { rows }),
  clipboardWriteText: (text) => ipcRenderer.invoke('clipboard:writeText', text),
  agreementsExportExcel: (payload) => ipcRenderer.invoke('agreements-export-excel', payload),
  // Renderer persistence fallback
  stateLoadSync: (key) => ipcRenderer.sendSync('renderer-state-load-sync', key),
  stateSave: (key, value) => ipcRenderer.invoke('renderer-state-save', { key, value }),
  stateRemove: (key) => ipcRenderer.invoke('renderer-state-remove', key),
  stateClear: (prefix) => ipcRenderer.invoke('renderer-state-clear', prefix),

  excelHelper: {
    openWindow: () => ipcRenderer.invoke('excel-helper:open-window'),
    getSelection: () => ipcRenderer.invoke('excel-helper:get-selection'),
    applyOffsets: (payload) => ipcRenderer.invoke('excel-helper:apply-offsets', payload),
    readOffsets: (payload) => ipcRenderer.invoke('excel-helper:read-offsets', payload),
  },

  records: {
    listProjects: (filters) => ipcRenderer.invoke('records:list-projects', filters),
    getProject: (id) => ipcRenderer.invoke('records:get-project', { id }),
    createProject: (payload) => ipcRenderer.invoke('records:create-project', payload),
    updateProject: (id, data) => ipcRenderer.invoke('records:update-project', { id, data }),
    deleteProject: (id) => ipcRenderer.invoke('records:delete-project', { id }),
    removeAttachment: (projectId) => ipcRenderer.invoke('records:remove-attachment', { projectId }),
    replaceAttachment: (projectId, attachment) => ipcRenderer.invoke('records:replace-attachment', { projectId, attachment }),
    listCompanies: (options) => ipcRenderer.invoke('records:list-companies', options),
    saveCompany: (payload) => ipcRenderer.invoke('records:save-company', payload),
    deleteCompany: (id) => ipcRenderer.invoke('records:delete-company', { id }),
    listCategories: (options) => ipcRenderer.invoke('records:list-categories', options),
    saveCategory: (payload) => ipcRenderer.invoke('records:save-category', payload),
    deleteCategory: (id) => ipcRenderer.invoke('records:delete-category', { id }),
    openAttachment: (projectId) => ipcRenderer.invoke('records:open-attachment', { projectId }),
    exportDatabase: () => ipcRenderer.invoke('records:export-database'),
    importDatabase: () => ipcRenderer.invoke('records:import-database'),
  },
  mail: {
    sendTest: (payload) => ipcRenderer.invoke('mail:send-test', payload),
    sendBatch: (payload) => ipcRenderer.invoke('mail:send-batch', payload),
    onProgress: (channel, callback) => {
      if (!channel || typeof callback !== 'function') return () => {};
      const listener = (_event, data) => callback(data);
      ipcRenderer.on(channel, listener);
      return () => ipcRenderer.removeListener(channel, listener);
    },
  },
});
