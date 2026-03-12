const ensureApi = () => {
  if (typeof window === 'undefined') return null;
  const api = window.electronAPI?.records;
  if (!api) {
    console.warn('[Renderer] records API is not available on window.electronAPI.records');
  }
  return api;
};

const wrapInvoke = async (method, ...args) => {
  const api = ensureApi();
  if (!api || typeof api[method] !== 'function') {
    throw new Error(`records API method ${method} is not available`);
  }
  const response = await api[method](...args);
  if (!response || response.success === undefined) return response;
  if (response.success) return response.data;
  const error = new Error(response.error || 'Records API call failed');
  error.payload = response;
  throw error;
};

const wrapEvent = (method, ...args) => {
  const api = ensureApi();
  if (!api || typeof api[method] !== 'function') {
    throw new Error(`records API method ${method} is not available`);
  }
  return api[method](...args);
};

export const recordsClient = {
  listProjects: (filters) => wrapInvoke('listProjects', filters),
  getProject: (id) => wrapInvoke('getProject', id),
  createProject: (payload) => wrapInvoke('createProject', payload),
  updateProject: (id, data) => wrapInvoke('updateProject', id, data),
  deleteProject: (id) => wrapInvoke('deleteProject', id),
  openEditorWindow: (payload) => wrapInvoke('openEditorWindow', payload),
  notifyProjectSaved: (payload) => wrapEvent('notifyProjectSaved', payload),
  onProjectSaved: (callback) => wrapEvent('onProjectSaved', callback),
  removeAttachment: (projectId, attachmentId) => wrapInvoke('removeAttachment', projectId, attachmentId),
  addAttachments: (projectId, attachments) => wrapInvoke('addAttachments', projectId, attachments),
  listCompanies: (options) => wrapInvoke('listCompanies', options),
  saveCompany: (payload) => wrapInvoke('saveCompany', payload),
  deleteCompany: (id) => wrapInvoke('deleteCompany', id),
  listCategories: (options) => wrapInvoke('listCategories', options),
  saveCategory: (payload) => wrapInvoke('saveCategory', payload),
  deleteCategory: (id) => wrapInvoke('deleteCategory', id),
  openAttachment: (projectId, attachmentId) => wrapInvoke('openAttachment', projectId, attachmentId),
  exportDatabase: () => wrapInvoke('exportDatabase'),
  importDatabase: () => wrapInvoke('importDatabase'),
};

export default recordsClient;
