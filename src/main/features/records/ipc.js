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
