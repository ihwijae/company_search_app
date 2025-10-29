const { dialog, BrowserWindow } = require('electron');

function createResponse(data) {
  return { success: true, data };
}

function createErrorResponse(error) {
  const message = error && error.message ? error.message : 'Unknown error';
  return { success: false, error: message };
}

function registerRecordsIpcHandlers({ ipcMain, recordsService }) {
  if (!ipcMain) throw new Error('ipcMain is required');
  if (!recordsService) throw new Error('recordsService is required');

  const handle = (channel, handler) => {
    ipcMain.handle(channel, async (event, payload) => {
      try {
        const result = await handler(payload, event);
        return createResponse(result);
      } catch (error) {
        console.error(`[MAIN][records] ${channel} failed:`, error);
        return createErrorResponse(error);
      }
    });
  };

  handle('records:list-projects', (payload) => recordsService.listProjects(payload));
  handle('records:get-project', (payload) => {
    if (!payload || !payload.id) throw new Error('id is required');
    return recordsService.getProject(payload.id);
  });
  handle('records:create-project', (payload) => recordsService.createProject(payload));
  handle('records:update-project', (payload) => {
    if (!payload || !payload.id) throw new Error('id is required');
    return recordsService.updateProject(payload.id, payload.data || {});
  });
  handle('records:delete-project', (payload) => {
    if (!payload || !payload.id) throw new Error('id is required');
    return recordsService.deleteProject(payload.id);
  });
  handle('records:remove-attachment', (payload) => {
    if (!payload || !payload.projectId) throw new Error('projectId is required');
    return recordsService.removeAttachment(payload.projectId);
  });
  handle('records:replace-attachment', (payload) => {
    if (!payload || !payload.projectId) throw new Error('projectId is required');
    return recordsService.replaceAttachment(payload.projectId, payload.attachment || {});
  });
  handle('records:open-attachment', (payload) => {
    if (!payload || !payload.projectId) throw new Error('projectId is required');
    return recordsService.openAttachment(payload.projectId);
  });
  handle('records:export-database', async (_payload, event) => {
    const dbPath = recordsService.getDatabasePath();
    if (!dbPath) throw new Error('DB 파일을 찾을 수 없습니다.');
    const ownerWindow = (event && event.sender && BrowserWindow.fromWebContents(event.sender))
      || BrowserWindow.getFocusedWindow();
    const saveTo = await dialog.showSaveDialog(ownerWindow, {
      title: '실적 DB 내보내기',
      defaultPath: 'records.sqlite',
      filters: [{ name: 'SQLite 파일', extensions: ['sqlite', 'db'] }],
    });
    if (saveTo.canceled || !saveTo.filePath) {
      return { canceled: true };
    }
    const result = recordsService.exportDatabase(saveTo.filePath);
    return result;
  });

  handle('records:list-companies', (payload) => recordsService.listCompanies(payload || {}));
  handle('records:save-company', (payload) => recordsService.saveCompany(payload));
  handle('records:delete-company', (payload) => {
    if (!payload || !payload.id) throw new Error('id is required');
    return recordsService.deleteCompany(payload.id);
  });

  handle('records:list-categories', (payload) => recordsService.listCategories(payload || {}));
  handle('records:save-category', (payload) => recordsService.saveCategory(payload));
  handle('records:delete-category', (payload) => {
    if (!payload || !payload.id) throw new Error('id is required');
    return recordsService.deleteCategory(payload.id);
  });
}

module.exports = {
  registerRecordsIpcHandlers,
};
