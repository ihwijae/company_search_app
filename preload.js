// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // (수정) searchCompanies는 이제 criteria와 file_type을 함께 받습니다.
  searchCompanies: (criteria, file_type) => ipcRenderer.invoke('search-companies', { criteria, file_type }),
  
  // (추가) 새로운 API들을 등록합니다.
  checkFiles: () => ipcRenderer.invoke('check-files'),
  getRegions: (file_type) => ipcRenderer.invoke('get-regions', file_type),
  // [추가] 파일 선택 API
  selectFile: (fileType) => ipcRenderer.invoke('select-file', fileType),
  // [추가] 데이터 갱신 이벤트 구독
  onDataUpdated: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('data-updated', handler);
    return () => ipcRenderer.removeListener('data-updated', handler);
  },
});
