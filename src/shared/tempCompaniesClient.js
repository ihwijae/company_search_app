const ensureApi = () => {
  if (typeof window === 'undefined') return null;
  const api = window.electronAPI?.tempCompanies
    || window.opener?.electronAPI?.tempCompanies
    || null;
  if (!api) {
    console.warn('[Renderer] tempCompanies API is not available on window.electronAPI.tempCompanies');
  }
  return api;
};

const wrapInvoke = async (method, ...args) => {
  const api = ensureApi();
  if (!api || typeof api[method] !== 'function') {
    throw new Error(`tempCompanies API method ${method} is not available`);
  }
  const response = await api[method](...args);
  if (!response || response.success === undefined) return response;
  if (response.success) return response.data;
  const error = new Error(response.error || 'TempCompanies API call failed');
  error.payload = response;
  throw error;
};

export const tempCompaniesClient = {
  listCompanies: (filters) => wrapInvoke('list', filters),
  getCompany: (id) => wrapInvoke('get', id),
  saveCompany: (payload) => wrapInvoke('save', payload),
  deleteCompany: (id) => wrapInvoke('delete', id),
  openWindow: (payload) => wrapInvoke('openWindow', payload),
  exportCompanies: () => wrapInvoke('exportData'),
  importCompanies: () => wrapInvoke('importData'),
};

export default tempCompaniesClient;
