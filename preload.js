// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // (?섏젙) searchCompanies???댁젣 criteria? file_type???④퍡 諛쏆뒿?덈떎.
  searchCompanies: (criteria, file_type) => (
    file_type === 'all'
      ? ipcRenderer.invoke('search-companies-all', { criteria })
      : ipcRenderer.invoke('search-companies', { criteria, file_type })
  ),
  
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
});
