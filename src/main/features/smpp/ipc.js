const { checkSingleCorp } = require('./smppService');

const sanitizeString = (value) => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

const sanitizeBizNumber = (value) => {
  const text = typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : '';
  return text.replace(/[^0-9]/g, '');
};

function registerSmppIpcHandlers({ ipcMain, getSmppCredentials }) {
  if (!ipcMain) return;

  if (ipcMain.removeHandler) {
    try { ipcMain.removeHandler('smpp:check-one'); } catch (_) {}
  }

  ipcMain.handle('smpp:check-one', async (_event, args = {}) => {
    try {
      const bizNo = sanitizeBizNumber(args.bizNo || args.businessNo || '');
      if (!bizNo) {
        return { success: false, message: '사업자등록번호가 필요합니다.' };
      }

      const creds = typeof getSmppCredentials === 'function' ? getSmppCredentials() : null;
      const id = sanitizeString(creds?.id || '');
      const password = sanitizeString(creds?.password || '');
      if (!id || !password) {
        return { success: false, message: 'CONFIG_PATH에 SMPP ID/PW를 저장한 뒤 다시 시도하세요.' };
      }

      const result = await checkSingleCorp(id, password, bizNo);
      if (result.error) {
        return { success: false, message: result.error, data: result };
      }
      return { success: true, data: result };
    } catch (err) {
      return { success: false, message: err?.message || 'SMPP 조회 실패' };
    }
  });
}

module.exports = { registerSmppIpcHandlers };
