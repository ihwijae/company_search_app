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
});