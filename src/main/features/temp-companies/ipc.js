const { dialog, BrowserWindow } = require('electron');

function createResponse(data) {
  return { success: true, data };
}

function createErrorResponse(error) {
  const message = error && error.message ? error.message : 'Unknown error';
  return { success: false, error: message };
}

function registerTempCompaniesIpcHandlers({ ipcMain, tempCompaniesService, openWindow }) {
  if (!ipcMain) throw new Error('ipcMain is required');
  if (!tempCompaniesService) throw new Error('tempCompaniesService is required');

  const handle = (channel, handler) => {
    ipcMain.handle(channel, async (event, payload) => {
      try {
        const result = await handler(payload, event);
        return createResponse(result);
      } catch (error) {
        console.error(`[MAIN][temp-companies] ${channel} failed:`, error);
        return createErrorResponse(error);
      }
    });
  };

  handle('temp-companies:list', (payload) => tempCompaniesService.listCompanies(payload || {}));
  handle('temp-companies:get', (payload) => {
    if (!payload?.id) throw new Error('id is required');
    return tempCompaniesService.getCompany(payload.id);
  });
  handle('temp-companies:save', (payload) => tempCompaniesService.saveCompany(payload || {}));
  handle('temp-companies:delete', (payload) => {
    if (!payload?.id) throw new Error('id is required');
    return tempCompaniesService.deleteCompany(payload.id);
  });
  handle('temp-companies:open-window', (payload) => {
    if (typeof openWindow !== 'function') throw new Error('openWindow is not available');
    openWindow(payload || {});
    return { opened: true };
  });
  handle('temp-companies:export', async (_payload, event) => {
    const ownerWindow = (event && event.sender && BrowserWindow.fromWebContents(event.sender))
      || BrowserWindow.getFocusedWindow();
    const saveTo = await dialog.showSaveDialog(ownerWindow, {
      title: '임시 업체 데이터 내보내기',
      defaultPath: 'temp-companies.json',
      filters: [{ name: 'JSON 파일', extensions: ['json'] }],
    });
    if (saveTo.canceled || !saveTo.filePath) return { canceled: true };
    return tempCompaniesService.exportCompanies(saveTo.filePath);
  });
  handle('temp-companies:import', async (_payload, event) => {
    const ownerWindow = (event && event.sender && BrowserWindow.fromWebContents(event.sender))
      || BrowserWindow.getFocusedWindow();
    const selection = await dialog.showOpenDialog(ownerWindow, {
      title: '임시 업체 데이터 가져오기',
      filters: [{ name: 'JSON 파일', extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (selection.canceled || !selection.filePaths?.length) return { canceled: true };
    return tempCompaniesService.importCompanies(selection.filePaths[0]);
  });
}

module.exports = {
  registerTempCompaniesIpcHandlers,
};
