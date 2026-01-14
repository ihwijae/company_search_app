const { app, BrowserWindow, ipcMain, dialog, screen, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const chokidar = require('chokidar');
const { sanitizeXlsx } = require('./utils/sanitizeXlsx');
const { evaluateScores } = require('./src/shared/evaluator.js');
const { SearchLogic } = require('./searchLogic.js');
const { ensureRecordsDatabase } = require('./src/main/features/records/recordsDatabase.js');
const { RecordsService } = require('./src/main/features/records/recordsService.js');
const { registerRecordsIpcHandlers } = require('./src/main/features/records/ipc.js');
const industryAverages = require('./src/shared/industryAverages.json');
const { ExcelAutomationService } = require('./src/main/features/excel/excelAutomation.js');
const { sendTestMail, sendBulkMail } = require('./src/main/features/mail/smtpService.js');
const os = require('os');
const { execSync } = require('child_process');
const pkg = (() => { try { return require('./package.json'); } catch { return {}; } })();
const APP_DISPLAY_NAME = '협정보조';
const EXCEL_HELPER_TITLE = '엑셀 협정 도우미';
try { app.setName(APP_DISPLAY_NAME); } catch {}

const resolveAppIconPath = () => {
  const candidates = [
    path.join(process.resourcesPath || '', 'icon.ico'),
    path.join(process.resourcesPath || '', 'build', 'icon', 'icon.ico'),
    path.join(__dirname, 'build', 'icon', 'icon.ico'),
    path.join(__dirname, 'build', 'icon.ico'),
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      if (candidate && fs.existsSync(candidate)) return candidate;
    } catch {}
  }
  return null;
};

const APP_ICON_PATH = resolveAppIconPath();

let formulasCache = null;
let formulasDefaultsCache = null;
let recordsDbInstance = null;
let recordsServiceInstance = null;
let excelHelperWindow = null;
const excelAutomation = new ExcelAutomationService();
const loadMergedFormulasCached = () => {
  if (formulasCache) return formulasCache;
  try {
    const formulasModule = require('./src/shared/formulas.js');
    if (formulasModule && typeof formulasModule.loadFormulasMerged === 'function') {
      formulasCache = formulasModule.loadFormulasMerged();
    }
  } catch (e) {
    console.warn('[MAIN] formulas cache load failed:', e?.message || e);
  }
  return formulasCache;
};

const loadFormulasDefaultsCached = () => {
  if (formulasDefaultsCache) return formulasDefaultsCache;
  try {
    formulasDefaultsCache = require('./src/shared/formulas.defaults.json');
  } catch (e) {
    console.warn('[MAIN] formulas defaults load failed:', e?.message || e);
    formulasDefaultsCache = { agencies: [] };
  }
  return formulasDefaultsCache;
};

const resolveFormulasDocument = ({ preferDefaults = false } = {}) => {
  if (preferDefaults) {
    return loadFormulasDefaultsCached();
  }
  const merged = loadMergedFormulasCached();
  if (merged && Array.isArray(merged.agencies) && merged.agencies.length > 0) {
    return merged;
  }
  return loadFormulasDefaultsCached();
};

const invalidateFormulasCache = () => {
  formulasCache = null;
  formulasDefaultsCache = null;
  try { delete require.cache[require.resolve('./src/shared/formulas.defaults.json')]; } catch {}
};

// Minimize GPU shader cache errors on Windows (cannot create/move cache)
try { app.commandLine.appendSwitch('disable-gpu-shader-disk-cache'); } catch {}

// --- 설정 ---
let FILE_PATHS = { eung: '', tongsin: '', sobang: '' };
let SMPP_CREDENTIALS = { id: 'jium2635', password: 'jium2635' };

const registerSmppFallbackHandler = (message = 'SMPP 기능이 초기화되지 않았습니다.') => {
  try {
    if (ipcMain.removeHandler) {
      try { ipcMain.removeHandler('smpp:check-one'); } catch {}
    }
    ipcMain.handle('smpp:check-one', async () => ({ success: false, message }));
  } catch (err) {
    console.error('[MAIN] SMPP fallback 등록 실패:', err);
  }
};

registerSmppFallbackHandler();

const sanitizeSmppCredentials = (payload = {}) => {
  const id = typeof payload.id === 'string' ? payload.id.trim() : '';
  const password = typeof payload.password === 'string' ? payload.password.trim() : '';
  return { id, password };
};

const buildConfigSnapshot = () => ({
  filePaths: {
    eung: FILE_PATHS.eung || '',
    tongsin: FILE_PATHS.tongsin || '',
    sobang: FILE_PATHS.sobang || '',
  },
  smpp: sanitizeSmppCredentials(SMPP_CREDENTIALS),
  agreementBoardDir: AGREEMENT_BOARD_DIR,
});

const getSmppCredentials = () => sanitizeSmppCredentials(SMPP_CREDENTIALS);
const setSmppCredentials = (payload = {}) => {
  SMPP_CREDENTIALS = sanitizeSmppCredentials(payload);
  saveConfig();
  return getSmppCredentials();
};

const FILE_TYPE_ALIASES = {
  eung: 'eung',
  전기: 'eung',
  전기공사: 'eung',
  tongsin: 'tongsin',
  통신: 'tongsin',
  통신공사: 'tongsin',
  sobang: 'sobang',
  소방: 'sobang',
  소방시설: 'sobang',
  all: 'all',
  전체: 'all',
};

const normalizeFileType = (value, { fallback = null } = {}) => {
  if (value === undefined || value === null) return fallback;
  const token = String(value).trim();
  if (!token) return fallback;
  if (Object.prototype.hasOwnProperty.call(FILE_TYPE_ALIASES, token)) {
    return FILE_TYPE_ALIASES[token];
  }
  const lowered = token.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(FILE_TYPE_ALIASES, lowered)) {
    return FILE_TYPE_ALIASES[lowered];
  }
  return fallback;
};

const sanitizeFileTypeForAvg = (value) => {
  const normalized = normalizeFileType(value, { fallback: null });
  if (normalized) return normalized;
  if (value === undefined || value === null) return null;
  const token = String(value).trim();
  return token ? token.toLowerCase() : null;
};

const FILE_TYPE_LABELS = {
  eung: '전기',
  tongsin: '통신',
  sobang: '소방',
};

const resolveFileTypeLabel = (type) => FILE_TYPE_LABELS[type] || String(type || '');

const AGREEMENT_TEMPLATE_CONFIGS = {
  'mois-under30': {
    label: '행안부 30억 미만',
    path: path.join(__dirname, '템플릿', '행안부_30억미만.xlsx'),
    sheetName: '양식',
    startRow: 5,
    maxRows: 68,
    slotColumns: {
      name: ['C', 'D', 'E', 'F', 'G'],
      share: ['I', 'J', 'K', 'L', 'M'],
      management: ['P', 'Q', 'R', 'S', 'T'],
      performance: ['W', 'X', 'Y', 'Z', 'AA'],
      ability: ['AO', 'AP', 'AQ', 'AR', 'AS'],
    },
    clearColumns: [
      'B', 'C', 'D', 'E', 'F', 'G', 'H',
      'I', 'J', 'K', 'L', 'M',
      'O', 'P', 'Q', 'R', 'S', 'T',
      'W', 'X', 'Y', 'Z', 'AA',
      'AN', 'AO', 'AP', 'AQ', 'AR', 'AS', 'AT',
    ],
    approvalColumn: 'B',
    regionFill: {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFF00' },
      bgColor: { indexed: 64 },
    },
    summaryColumns: {},
  },
  'mois-30to50': {
    label: '행안부 30억~50억',
    path: path.join(__dirname, '템플릿', '행안부_30억~50억.xlsx'),
    sheetName: '양식',
    startRow: 5,
    maxRows: 68,
    slotColumns: {
      name: ['C', 'D', 'E', 'F', 'G'],
      share: ['I', 'J', 'K', 'L', 'M'],
      management: ['P', 'Q', 'R', 'S', 'T'],
      performance: ['W', 'X', 'Y', 'Z', 'AA'],
      ability: ['AP', 'AQ', 'AR', 'AS', 'AT'],
    },
    clearColumns: [
      'B', 'C', 'D', 'E', 'F', 'G', 'H',
      'I', 'J', 'K', 'L', 'M',
      'O', 'P', 'Q', 'R', 'S', 'T',
      'W', 'X', 'Y', 'Z', 'AA',
      'AN', 'AP', 'AQ', 'AR', 'AS', 'AT', 'AU',
    ],
    approvalColumn: 'B',
    regionFill: {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFF00' },
      bgColor: { indexed: 64 },
    },
    headerCells: {
      baseAmount: 'D1',
      estimatedAmount: 'D2',
    },
    summaryColumns: {},
  },
  'pps-under50': {
    label: '조달청 50억 미만',
    path: path.join(__dirname, '템플릿', '조달청50억미만.xlsx'),
    sheetName: '양식',
    startRow: 5,
    maxRows: 68,
    slotColumns: {
      name: ['C', 'D', 'E', 'F', 'G'],
      share: ['I', 'J', 'K', 'L', 'M'],
      management: ['P', 'Q', 'R', 'S', 'T'],
      performance: ['W', 'X', 'Y', 'Z', 'AA'],
      ability: ['AO', 'AP', 'AQ', 'AR', 'AS'],
    },
    clearColumns: [
      'B', 'C', 'D', 'E', 'F', 'G', 'H',
      'I', 'J', 'K', 'L', 'M',
      'O', 'P', 'Q', 'R', 'S', 'T',
      'W', 'X', 'Y', 'Z', 'AA',
      'AN', 'AO', 'AP', 'AQ', 'AR', 'AS', 'AT',
    ],
    headerCells: {
      estimatedAmount: 'D1',
      baseAmount: 'D2',
      bidAmount: 'F2',
      noticeTitle: 'M1',
      bidDeadline: 'P2',
      dutySummary: 'W2',
    },
    approvalColumn: 'B',
    summaryColumns: {
      credibility: 'AD',
    },
    regionFill: {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFF00' },
      bgColor: { indexed: 64 },
    },
  },
  'lh-under50': {
    label: 'LH 50억 미만',
    path: path.join(__dirname, '템플릿', 'LH50억미만.xlsx'),
    sheetName: '양식',
    startRow: 5,
    maxRows: 68,
    rowStep: 2,
    qualityRowOffset: 1,
    slotColumns: {
      name: ['C', 'D', 'E', 'F', 'G'],
      share: ['I', 'J', 'K', 'L', 'M'],
      management: ['P', 'Q', 'R', 'S', 'T'],
      performance: ['W', 'X', 'Y', 'Z', 'AA'],
      ability: ['AR', 'AS', 'AT', 'AU', 'AV'],
    },
    qualityColumns: ['I', 'J', 'K', 'L', 'M'],
    clearColumns: [
      'C', 'D', 'E', 'F', 'G',
      'I', 'J', 'K', 'L', 'M',
      'P', 'Q', 'R', 'S', 'T',
      'W', 'X', 'Y', 'Z', 'AA',
      'AD',
      'AF', 'AG',
      'AR', 'AS', 'AT', 'AU', 'AV',
    ],
    headerCells: {
      estimatedAmount: 'D1',
      baseAmount: 'D2',
      ratioBaseAmount: 'I1',
      entryAmount: 'AI1',
      noticeTitle: 'K1',
      bidDeadline: 'M2',
      dutySummary: 'Q2',
    },
    approvalColumn: 'B',
    summaryColumns: {
      credibility: 'AF',
      netCostBonus: 'AG',
      qualityPoints: 'AD',
    },
    managementBonusColumn: 'O',
    regionFill: {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFF00' },
      bgColor: { indexed: 64 },
    },
  },
  'krail-under50': {
    label: '국가철도공단 50억 미만',
    path: path.join(__dirname, '템플릿', '국가철도50억미만.xlsx'),
    sheetName: '양식',
    startRow: 5,
    maxRows: 68,
    slotColumns: {
      name: ['C', 'D', 'E', 'F', 'G'],
      share: ['I', 'J', 'K', 'L', 'M'],
      management: ['P', 'Q', 'R', 'S', 'T'],
      performance: ['W', 'X', 'Y', 'Z', 'AA'],
      technician: ['AD', 'AE'],
      ability: ['AV', 'AW'],
    },
    clearColumns: [
      'B', 'C', 'D', 'E', 'F', 'G', 'H',
      'I', 'J', 'K', 'L', 'M',
      'O', 'P', 'Q', 'R', 'S', 'T',
      'W', 'X', 'Y', 'Z', 'AA',
      'AD', 'AE',
      'AV', 'AW',
    ],
    headerCells: {
      baseAmount: 'D2',
      amountForScore: 'I1',
      noticeTitle: 'N1',
      bidDeadline: 'P2',
      dutySummary: 'U2',
      memo: 'AD1',
    },
    approvalColumn: 'B',
    summaryColumns: {},
    regionFill: {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFF00' },
      bgColor: { indexed: 64 },
    },
  },
  'ex-under50': {
    label: '한국도로공사 50억 미만',
    path: path.join(__dirname, '템플릿', '한국도로공사 50억미만.xlsx'),
    sheetName: '양식',
    startRow: 5,
    maxRows: 68,
    slotColumns: {
      name: ['C', 'D', 'E', 'F', 'G'],
      share: ['I', 'J', 'K', 'L', 'M'],
      management: ['P', 'Q', 'R', 'S', 'T'],
      performance: ['W', 'X', 'Y', 'Z', 'AA'],
      ability: ['AO', 'AP', 'AQ', 'AR', 'AS'],
    },
    clearColumns: [
      'B', 'C', 'D', 'E', 'F', 'G', 'H',
      'I', 'J', 'K', 'L', 'M',
      'O', 'P', 'Q', 'R', 'S', 'T',
      'W', 'X', 'Y', 'Z', 'AA',
      'AN', 'AO', 'AP', 'AQ', 'AR', 'AS', 'AT',
    ],
    headerCells: {
      estimatedAmount: 'D1',
      baseAmount: 'D2',
      noticeTitle: 'M1',
      bidDeadline: 'P2',
      dutySummary: 'AH1',
      memo: 'W2',
    },
    approvalColumn: 'B',
    summaryColumns: {},
    regionFill: {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFF00' },
      bgColor: { indexed: 64 },
    },
  },
};

const { sanitizeFileName, exportAgreementExcel } = require('./src/main/features/agreements/exportExcel.js');

const isRunningInWSL = (() => {
    if (process.platform !== 'linux') return false;
    if (process.env.WSL_DISTRO_NAME) return true;
    try {
        const version = fs.readFileSync('/proc/version', 'utf-8').toLowerCase();
        return version.includes('microsoft');
    } catch {
        return false;
    }
})();

function toWSLPathIfNeeded(p) {
    if (!p || !isRunningInWSL) return p;
    if (!/^[A-Za-z]:\\/.test(p)) return p;
    try {
        return execSync(`wslpath -a ${JSON.stringify(p)}`, { encoding: 'utf-8' }).trim();
    } catch {
        const match = /^([A-Za-z]):\\(.*)$/.exec(p);
        if (!match) return p;
        const drive = match[1].toLowerCase();
        const rest = match[2].replace(/\\/g, '/');
        return `/mnt/${drive}/${rest}`;
    }
}

const defaultUserDataDir = app.getPath('userData');
const userDataDirNameCandidates = (() => {
    const set = new Set();
    const base = path.basename(defaultUserDataDir);
    if (base) {
        set.add(base);
        set.add(base.toLowerCase());
    }
    const appName = app.getName && app.getName();
    if (appName) {
        set.add(appName);
        set.add(appName.toLowerCase());
        set.add(appName.replace(/\s+/g, ''));
        set.add(appName.replace(/\s+/g, '').toLowerCase());
    }
    if (pkg && pkg.name) {
        set.add(pkg.name);
        set.add(String(pkg.name).toLowerCase());
    }
    set.add('company-search-electron');
    return Array.from(set).filter(Boolean);
})();

function getWindowsAppDataPath() {
    if (!isRunningInWSL) return null;
    const envAppData = process.env.APPDATA;
    if (envAppData && /^[A-Za-z]:\\/.test(envAppData)) return envAppData;
    try {
        const output = execSync('cmd.exe /C echo %APPDATA%', { encoding: 'utf-8' }).replace(/\r/g, '').trim();
        if (output && /^[A-Za-z]:\\/.test(output)) return output;
    } catch {}
    try {
        const output = execSync('powershell.exe -NoProfile -Command "$env:APPDATA"', { encoding: 'utf-8' }).replace(/\r/g, '').trim();
        if (output && /^[A-Za-z]:\\/.test(output)) return output;
    } catch {}
    return null;
}

function resolveWindowsUserDataDir(dirNames) {
    if (!isRunningInWSL) return null;
    const appDataWin = getWindowsAppDataPath();
    if (!appDataWin) return null;
    for (const dirName of dirNames) {
        if (!dirName) continue;
        const candidateWin = path.win32 ? path.win32.join(appDataWin, dirName) : path.join(appDataWin, dirName);
        const candidateWSL = toWSLPathIfNeeded(candidateWin);
        if (candidateWSL && fs.existsSync(candidateWSL)) return candidateWSL;
    }
    return null;
}

const windowsUserDataDir = resolveWindowsUserDataDir(userDataDirNameCandidates);
const userDataDir = windowsUserDataDir || defaultUserDataDir;
if (windowsUserDataDir) {
    console.log('[MAIN] WSL detected. Using Windows userData directory:', windowsUserDataDir);
}
const CONFIG_PATH = path.join(userDataDir, 'config.json');
const WINDOW_STATE_PATH = path.join(userDataDir, 'window-state.json');
const AGREEMENTS_PATH = path.join(userDataDir, 'agreements.json');
const DEFAULT_AGREEMENT_BOARD_DIR = path.join(userDataDir, 'agreement-board');
let AGREEMENT_BOARD_DIR = DEFAULT_AGREEMENT_BOARD_DIR;
const AGREEMENTS_RULES_PATH = path.join(userDataDir, 'agreements.rules.json');
const FORMULAS_PATH = path.join(userDataDir, 'formulas.json');
const RENDERER_STATE_PATH = path.join(userDataDir, 'renderer-state.json');

const RENDERER_STATE_MISSING = { __companySearchStateMissing: true };

const readRendererState = () => {
  try {
    if (fs.existsSync(RENDERER_STATE_PATH)) {
      const raw = fs.readFileSync(RENDERER_STATE_PATH, 'utf-8');
      if (raw && raw.trim()) {
        return JSON.parse(raw);
      }
    }
  } catch (err) {
    console.warn('[MAIN] renderer state read failed:', err?.message || err);
  }
  return {};
};

const writeRendererState = (state) => {
  try {
    fs.mkdirSync(path.dirname(RENDERER_STATE_PATH), { recursive: true });
    fs.writeFileSync(RENDERER_STATE_PATH, JSON.stringify(state, null, 2));
    return true;
  } catch (err) {
    console.warn('[MAIN] renderer state write failed:', err?.message || err);
    return false;
  }
};

const DATE_PATTERN = /(\d{2,4})[.\-/년\s]*(\d{1,2})[.\-/월\s]*(\d{1,2})/;

function parseDateToken(input) {
  if (!input) return null;
  const match = String(input).match(DATE_PATTERN);
  if (!match) return null;
  let year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (year < 100) year += year >= 70 ? 1900 : 2000;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function extractExpiryDate(text) {
  if (!text) return null;
  const source = String(text);
  let match = source.match(/~\s*([0-9]{2,4}[^0-9]*[0-9]{1,2}[^0-9]*[0-9]{1,2})/);
  if (match) {
    const parsed = parseDateToken(match[1]);
    if (parsed) return parsed;
  }
  match = source.match(/([0-9]{2,4}[^0-9]*[0-9]{1,2}[^0-9]*[0-9]{1,2})\s*(까지|만료|만기)/);
  if (match) {
    const parsed = parseDateToken(match[1]);
    if (parsed) return parsed;
  }
  const tokens = source.match(/[0-9]{2,4}[^0-9]*[0-9]{1,2}[^0-9]*[0-9]{1,2}/g);
  if (tokens && tokens.length) {
    for (let i = tokens.length - 1; i >= 0; i -= 1) {
      const parsed = parseDateToken(tokens[i]);
      if (parsed) return parsed;
    }
  }
  return null;
}

function loadConfig() {
    try {
        const readConfigFile = (filePath) => {
            try {
                if (fs.existsSync(filePath)) {
                    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) || {};
                }
            } catch (err) {
                console.warn('[MAIN] 설정 파일 읽기 실패:', err?.message || err);
            }
            return null;
        };
        let configSourcePath = CONFIG_PATH;
        let rawConfig = readConfigFile(CONFIG_PATH);
        if (!rawConfig) {
            const fallbackPaths = [
                defaultUserDataDir ? path.join(defaultUserDataDir, 'config.json') : null,
                windowsUserDataDir ? path.join(windowsUserDataDir, 'config.json') : null,
            ]
                .filter(Boolean)
                .filter((p) => p !== CONFIG_PATH);
            for (const candidatePath of fallbackPaths) {
                rawConfig = readConfigFile(candidatePath);
                if (rawConfig) {
                    configSourcePath = candidatePath;
                    break;
                }
            }
        }
        if (rawConfig) {
            const filePathSource = (rawConfig && typeof rawConfig.filePaths === 'object')
                ? rawConfig.filePaths
                : rawConfig;
            const normalizedConfig = { eung: '', tongsin: '', sobang: '' };
            Object.entries(filePathSource || {}).forEach(([key, value]) => {
                const normKey = normalizeFileType(key);
                if (!normKey || normKey === 'all') return;
                if (normKey === 'eung' || normKey === 'tongsin' || normKey === 'sobang') {
                    if (typeof value === 'string' && value.trim()) {
                        normalizedConfig[normKey] = value;
                    }
                }
            });
            FILE_PATHS = { ...FILE_PATHS, ...normalizedConfig };
            FILE_PATHS = {
                eung: FILE_PATHS.eung,
                tongsin: FILE_PATHS.tongsin,
                sobang: FILE_PATHS.sobang,
            };

            const smppSource = (rawConfig && typeof rawConfig.smpp === 'object') ? rawConfig.smpp : {};
            SMPP_CREDENTIALS = sanitizeSmppCredentials(smppSource);

            if (typeof rawConfig.agreementBoardDir === 'string' && rawConfig.agreementBoardDir.trim()) {
                AGREEMENT_BOARD_DIR = rawConfig.agreementBoardDir.trim();
            } else {
                AGREEMENT_BOARD_DIR = DEFAULT_AGREEMENT_BOARD_DIR;
            }

            const snapshot = buildConfigSnapshot();
            const shouldRewrite = JSON.stringify(rawConfig) !== JSON.stringify(snapshot);
            console.log('[MAIN] 설정 파일 로드 완료 (경로만 표시):', snapshot.filePaths);
            if (configSourcePath !== CONFIG_PATH || shouldRewrite) {
                if (configSourcePath !== CONFIG_PATH) {
                    console.log('[MAIN] 설정 파일 위치를 갱신합니다:', configSourcePath);
                }
                saveConfig(snapshot);
            }
        } else {
            console.log('[MAIN] 설정 파일이 없습니다. 기본값으로 동작합니다.');
            saveConfig();
        }
    } catch (err) {
        console.error('[MAIN] 설정 파일 로드 실패:', err);
    }
}

function saveConfig(payload) {
    try {
        const snapshot = payload || buildConfigSnapshot();
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(snapshot, null, 2));
        console.log('[MAIN] 설정 저장 완료 (경로만 표시):', snapshot.filePaths);
    } catch (err) {
        console.error('[MAIN] 설정 저장 실패:', err);
    }
}

function setAgreementBoardDir(nextPath) {
    if (!nextPath || typeof nextPath !== 'string') return;
    const trimmed = nextPath.trim();
    if (!trimmed) return;
    AGREEMENT_BOARD_DIR = trimmed;
    saveConfig();
}

loadConfig();
// ---

let mainWindowRef = null;
const DEBOUNCE_MS = 500;

// ?꾩떆 ?뺥솕蹂??좎? ?뺤콉
const SANITIZED_KEEP_PER_SOURCE = 3; // ?숈씪 ?먮낯??理쒖떊 3媛??좎?
const SANITIZED_TTL_MS = 24 * 60 * 60 * 1000; // 24?쒓컙
const CLEAN_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6?쒓컙

// ?먮낯 寃쎈줈蹂??뺥솕蹂?紐⑸줉 ?덉??ㅽ듃由?
const sanitizedRegistry = {}; // { sourcePath: [ tempPath, ... ] }

function parseTimestampFromSanitized(p) {
  const m = /\.sanitized\.(\d+)\.xlsx$/i.exec(p);
  if (!m) return 0;
  try { return Number(m[1]); } catch { return 0; }
}

function registerSanitized(sourcePath, tempPath) {
  if (!sourcePath || !tempPath) return;
  if (!sanitizedRegistry[sourcePath]) sanitizedRegistry[sourcePath] = [];
  sanitizedRegistry[sourcePath].push(tempPath);
  // 理쒖떊???뺣젹 ??蹂닿? 媛쒖닔 珥덇낵遺???젣
  sanitizedRegistry[sourcePath].sort((a, b) => parseTimestampFromSanitized(b) - parseTimestampFromSanitized(a));
  while (sanitizedRegistry[sourcePath].length > SANITIZED_KEEP_PER_SOURCE) {
    const oldPath = sanitizedRegistry[sourcePath].pop();
    try { if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath); } catch {}
  }
}

function cleanOldTempFiles() {
  try {
    const dir = os.tmpdir();
    const files = fs.readdirSync(dir);
    const now = Date.now();
    files.forEach((name) => {
      if (!/\.sanitized\.(\d+)\.xlsx$/i.test(name)) return;
      const full = path.join(dir, name);
      const ts = parseTimestampFromSanitized(name);
      if (ts && now - ts > SANITIZED_TTL_MS) {
        try { fs.unlinkSync(full); } catch {}
      }
    });
  } catch {}
}

function debounce(fn, delay) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}
// Packaged 앱에서도 확실히 프로덕션 분기되도록 app.isPackaged 사용
const isDev = !app.isPackaged;

// ----- 李??곹깭 ???蹂듭썝 ?좏떥 -----
function loadWindowState() {
  try {
    if (fs.existsSync(WINDOW_STATE_PATH)) {
      const raw = JSON.parse(fs.readFileSync(WINDOW_STATE_PATH, 'utf-8'));
      if (raw && raw.width && raw.height) return raw;
    }
  } catch {}
  return { width: 1400, height: 900, isMaximized: false };
}

function clampBoundsToDisplay(bounds) {
  try {
    const display = screen.getDisplayMatching(bounds);
    const wa = display.workArea; // {x,y,width,height}
    let { x, y, width, height } = bounds;
    // 理쒖냼 ?ш린 蹂댁젙
    width = Math.max(800, Math.min(width || 1400, wa.width));
    height = Math.max(600, Math.min(height || 900, wa.height));
    // ?꾩튂 蹂댁젙(?붾㈃ 諛?諛⑹?)
    if (typeof x !== 'number') x = wa.x + Math.floor((wa.width - width) / 2);
    if (typeof y !== 'number') y = wa.y + Math.floor((wa.height - height) / 2);
    // ?ㅻⅨ履??꾨옒 寃쎄퀎 ?섍? 諛⑹?
    if (x + width > wa.x + wa.width) x = wa.x + wa.width - width;
    if (y + height > wa.y + wa.height) y = wa.y + wa.height - height;
    // ?쇱そ/??寃쎄퀎 諛⑹?
    if (x < wa.x) x = wa.x;
    if (y < wa.y) y = wa.y;
    return { x, y, width, height };
  } catch {
    return { x: undefined, y: undefined, width: 1400, height: 900 };
  }
}

function saveWindowState(win) {
  try {
    if (!win || win.isDestroyed()) return;
    const isMaximized = win.isMaximized();
    const normal = win.getNormalBounds();
    const state = { ...normal, isMaximized };
    fs.writeFileSync(WINDOW_STATE_PATH, JSON.stringify(state, null, 2));
  } catch {}
}

const saveWindowStateDebounced = debounce(() => {
  if (mainWindowRef) saveWindowState(mainWindowRef);
}, 400);

function createWindow() {
  const prevState = loadWindowState();
  const bounds = clampBoundsToDisplay(prevState);
  const mainWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    backgroundColor: '#e0ecff',
    title: APP_DISPLAY_NAME,
    icon: APP_ICON_PATH || undefined,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#e0ecff',
      symbolColor: '#1f2937',
      height: 32,
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  mainWindowRef = mainWindow;
  try { mainWindow.setTitle(APP_DISPLAY_NAME); } catch {}

  // 李??곹깭 ?대깽?몃줈 ???
  ['resize', 'move', 'maximize', 'unmaximize', 'restore'].forEach(evt => {
    mainWindow.on(evt, saveWindowStateDebounced);
  });
  mainWindow.on('close', (event) => {
    event.preventDefault();
    dialog.showMessageBox(mainWindow, {
      type: 'question',
      buttons: ['예', '아니오'],
      title: '프로그램 종료',
      message: '프로그램을 종료하시겠습니까?',
      defaultId: 0,
      cancelId: 1
    }).then(response => {
      if (response.response === 0) {
        saveWindowState(mainWindow);
        mainWindow.destroy();
      }
    });
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  // ?댁쟾??理쒕????곹깭??ㅻ㈃ 蹂듭썝 ??理쒕???
  if (prevState.isMaximized) {
    mainWindow.maximize();
  }
}

function createExcelHelperWindow() {
  if (excelHelperWindow && !excelHelperWindow.isDestroyed()) {
    excelHelperWindow.focus();
    return excelHelperWindow;
  }

  const win = new BrowserWindow({
    width: 1600,
    height: 900,
    backgroundColor: '#f5f6fa',
    title: EXCEL_HELPER_TITLE,
    icon: APP_ICON_PATH || undefined,
    autoHideMenuBar: true,
    showInTaskbar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#e0ecff',
      symbolColor: '#1f2937',
      height: 32,
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  excelHelperWindow = win;
  win.on('closed', () => {
    excelHelperWindow = null;
  });

  if (isDev) {
    win.loadURL('http://localhost:5173/#/excel-helper');
  } else {
    win.loadFile(path.join(__dirname, 'dist', 'index.html'), { hash: '/excel-helper' });
  }

  try { win.setTitle(EXCEL_HELPER_TITLE); } catch {}

  return win;
}

app.whenReady().then(async () => {
  try {
    recordsDbInstance = await ensureRecordsDatabase({ userDataDir });
    if (recordsDbInstance?.path) {
      console.log('[MAIN] Records database ready:', recordsDbInstance.path);
    }
    recordsServiceInstance = new RecordsService({ userDataDir });
    registerRecordsIpcHandlers({ ipcMain, recordsService: recordsServiceInstance });
  } catch (err) {
    console.error('[MAIN] Failed to initialize records database:', err);
  }

  console.log('[MAIN] 초기화 완료. 저장된 경로 자동 로딩 시작...');
  // 二쇨린???꾩떆 ?뚯씪 ?뺣━ ?쒖옉
  cleanOldTempFiles();
  setInterval(cleanOldTempFiles, CLEAN_INTERVAL_MS);

  console.log('[MAIN] 초기화 완료. 윈도우 생성...');
  createWindow();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// keep only the newest N sanitized temp files per source on quit
app.on('before-quit', () => {
  try {
    Object.keys(sanitizedRegistry).forEach((src) => {
      const list = sanitizedRegistry[src] || [];
      list.sort((a, b) => parseTimestampFromSanitized(b) - parseTimestampFromSanitized(a));
      while (list.length > SANITIZED_KEEP_PER_SOURCE) {
        const p = list.pop();
        try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch {}
      }
      sanitizedRegistry[src] = list;
    });
  } catch {}
});

// Wire IPC using SearchService (feature-scoped)
try {
  const { SearchService } = require('./src/main/features/search/services/searchService');
  const svc = new SearchService({
    sanitizeXlsx,
    chokidar,
    registerSanitized,
    debounceMs: DEBOUNCE_MS,
    notifyUpdated: (type) => { try { if (mainWindowRef && !mainWindowRef.isDestroyed()) { mainWindowRef.webContents.send('data-updated', { type }); } } catch {} }
  });

  // Preload previously saved files so UI can use immediately
  (async () => {
    try {
      for (const ft in FILE_PATHS) {
        const originalPath = FILE_PATHS[ft];
        const runtimePath = toWSLPathIfNeeded(originalPath);
        if (runtimePath && fs.existsSync(runtimePath)) {
          try { await svc.loadAndWatch(ft, runtimePath); } catch {}
        }
      }
    } catch {}
  })();

  // Aggregate IPC routes (all types)
  try {
    const { registerAllIpcHandlers } = require('./src/main/features/search/ipc');
    if (ipcMain.removeHandler) {
      try { ipcMain.removeHandler('get-regions-all'); } catch {}
      try { ipcMain.removeHandler('search-companies-all'); } catch {}
    }
    registerAllIpcHandlers({ ipcMain, searchService: svc });
  } catch {}

  ipcMain.on('renderer-state-load-sync', (event, key) => {
    const store = readRendererState();
    if (!key || typeof key !== 'string') {
      event.returnValue = store;
      return;
    }
    if (Object.prototype.hasOwnProperty.call(store, key)) {
      event.returnValue = store[key];
    } else {
      event.returnValue = RENDERER_STATE_MISSING;
    }
  });

  ipcMain.handle('renderer-state-save', async (_event, { key, value }) => {
    if (!key || typeof key !== 'string' || !key.trim()) {
      return { success: false, message: 'invalid key' };
    }
    const store = readRendererState();
    store[key] = value;
    const ok = writeRendererState(store);
    return ok ? { success: true } : { success: false, message: 'write failed' };
  });

  ipcMain.handle('renderer-state-remove', async (_event, key) => {
    if (!key || typeof key !== 'string' || !key.trim()) {
      return { success: false, message: 'invalid key' };
    }
    const store = readRendererState();
    if (Object.prototype.hasOwnProperty.call(store, key)) {
      delete store[key];
      const ok = writeRendererState(store);
      return ok ? { success: true } : { success: false, message: 'write failed' };
    }
    return { success: true };
  });

  ipcMain.handle('renderer-state-clear', async (_event, prefix = '') => {
    const store = readRendererState();
    if (!prefix || typeof prefix !== 'string' || !prefix.trim()) {
      const ok = writeRendererState({});
      return ok ? { success: true } : { success: false, message: 'write failed' };
    }
    const filtered = {};
    Object.keys(store || {}).forEach((k) => {
      if (!k.startsWith(prefix)) {
        filtered[k] = store[k];
      }
    });
    const ok = writeRendererState(filtered);
    return ok ? { success: true } : { success: false, message: 'write failed' };
  });

  if (ipcMain.removeHandler) {
    try { ipcMain.removeHandler('smpp:get-creds'); } catch {}
    try { ipcMain.removeHandler('smpp:set-creds'); } catch {}
  }
  ipcMain.handle('smpp:get-creds', async () => ({ success: true, data: getSmppCredentials() }));
  ipcMain.handle('smpp:set-creds', async (_event, payload = {}) => {
    const sanitized = sanitizeSmppCredentials(payload);
    if (!sanitized.id || !sanitized.password) {
      return { success: false, message: 'ID와 비밀번호를 모두 입력하세요.' };
    }
    const stored = setSmppCredentials(sanitized);
    return { success: true, data: stored };
  });

  // File selection and per-type routes
  if (ipcMain.removeHandler) ipcMain.removeHandler('select-file');
  ipcMain.handle('select-file', async (_event, fileType) => {
    const normalizedType = normalizeFileType(fileType);
    if (!normalizedType || normalizedType === 'all') {
      return { success: false, message: '유효하지 않은 검색 대상입니다.' };
    }
    const typeLabel = resolveFileTypeLabel(normalizedType);
    const mainWindow = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(mainWindow, {
      title: `${typeLabel || normalizedType} 파일 선택`,
      properties: ['openFile'],
      filters: [{ name: 'Excel Files', extensions: ['xlsx'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return { success: false, message: 'Selection canceled' };
    const filePath = result.filePaths[0];
    if (!filePath.toLowerCase().endsWith('.xlsx')) return { success: false, message: 'Please select a .xlsx file' };
    FILE_PATHS = {
      eung: normalizedType === 'eung' ? filePath : FILE_PATHS.eung,
      tongsin: normalizedType === 'tongsin' ? filePath : FILE_PATHS.tongsin,
      sobang: normalizedType === 'sobang' ? filePath : FILE_PATHS.sobang,
    };
    saveConfig();
    const runtimePath = toWSLPathIfNeeded(filePath);
    try {
      await svc.loadAndWatch(normalizedType, runtimePath);
      return { success: true, path: filePath };
    }
    catch (e) { return { success: false, message: e?.message || 'Load failed' }; }
});

  if (ipcMain.removeHandler) ipcMain.removeHandler('get-regions');
  ipcMain.handle('get-regions', (_event, file_type) => {
    try {
      const normalizedType = normalizeFileType(file_type, { fallback: 'eung' });
      if (normalizedType === 'all') {
        return { success: true, data: svc.getRegionsAll() };
      }
      return { success: true, data: svc.getRegions(normalizedType) };
    }
    catch {
      return { success: true, data: ['전체'] };
    }
  });

  if (ipcMain.removeHandler) ipcMain.removeHandler('check-files');
  ipcMain.handle('check-files', () => svc.getStatuses());

  // get-file-paths: expose currently registered original paths
  if (ipcMain.removeHandler) ipcMain.removeHandler('get-file-paths');
  ipcMain.handle('get-file-paths', () => ({ success: true, data: FILE_PATHS }));

  if (ipcMain.removeHandler) ipcMain.removeHandler('search-companies');
  ipcMain.handle('search-companies', (_event, { criteria, file_type, options }) => {
    try {
      const normalizedType = normalizeFileType(file_type, { fallback: null });
      if (!normalizedType) {
        throw new Error(`지원하지 않는 검색 대상입니다: ${file_type}`);
      }
      const sanitizedCriteria = parseMaybeJson(criteria, 'criteria');
      const sanitizedOptions = parseMaybeJson(options, 'options');
      const result = normalizedType === 'all'
        ? svc.searchAll(sanitizedCriteria, sanitizedOptions || {})
        : svc.search(normalizedType, sanitizedCriteria, sanitizedOptions || {});
      if (result && typeof result === 'object' && !Array.isArray(result) && result.meta && result.items) {
        return {
          success: true,
          data: sanitizeIpcPayload(result.items),
          meta: sanitizeIpcPayload(result.meta),
        };
      }
      return { success: true, data: sanitizeIpcPayload(result) };
    }
    catch (e) { return { success: false, message: e?.message || 'Search failed' }; }
  });

  if (ipcMain.removeHandler) ipcMain.removeHandler('search-many-companies');
  ipcMain.handle('search-many-companies', (_event, { names, file_type, options }) => {
    try {
      const normalizedType = normalizeFileType(file_type, { fallback: null });
      if (!normalizedType || normalizedType === 'all') {
        throw new Error(`지원하지 않는 검색 대상입니다: ${file_type}`);
      }
      const sanitizedNames = Array.isArray(names) ? names : [];
      const sanitizedOptions = parseMaybeJson(options, 'options');
      
      const result = svc.searchMany(normalizedType, sanitizedNames, sanitizedOptions || {});
      
      return { success: true, data: sanitizeIpcPayload(result) };
    }
    catch (e) { return { success: false, message: e?.message || 'Search many failed' }; }
  });
} catch (e) {
  console.error('[MAIN] SearchService 초기화/바인딩 실패:', e);
}

try {
  const { registerSmppIpcHandlers } = require('./src/main/features/smpp/ipc');
  registerSmppIpcHandlers({ ipcMain, getSmppCredentials });
  console.log('[MAIN] SMPP IPC 핸들러 등록 완료');
} catch (err) {
  console.error('[MAIN] SMPP IPC 등록 실패:', err);
  registerSmppFallbackHandler('SMPP IPC 초기화에 실패했습니다. 설정을 확인하세요.');
}

// Copy 1-column CSV to clipboard (preserve in-cell line breaks for Excel)
try {
  if (ipcMain.removeHandler) ipcMain.removeHandler('copy-csv-column');
  ipcMain.handle('copy-csv-column', (_event, { rows }) => {
    try {
      const esc = (s) => '"' + String(s ?? '').replaceAll('"', '""') + '"';
      const csv = Array.isArray(rows) ? rows.map(esc).join('\r\n') : '';
      // Write as CSV first so Excel prefers it
      try { clipboard.writeBuffer('text/csv', Buffer.from(csv, 'utf8')); } catch {}
      // Also write plain text as fallback (same content)
      try { clipboard.writeText(csv); } catch {}
      return { success: true };
    } catch (e) {
      return { success: false, message: e?.message || 'Clipboard write failed' };
    }
  });
} catch {}

try {
  if (ipcMain.removeHandler) ipcMain.removeHandler('clipboard:writeText');
  ipcMain.handle('clipboard:writeText', async (_event, text) => {
    try {
      clipboard.writeText(String(text || ''));
      return { success: true };
    } catch (e) {
      return { success: false, message: e?.message || 'Clipboard write failed' };
    }
  });
} catch (e) {
  console.error('[MAIN] clipboard:writeText IPC wiring failed:', e);
}

try {
  if (ipcMain.removeHandler) ipcMain.removeHandler('mail:send-test');
  ipcMain.handle('mail:send-test', async (_event, payload = {}) => {
    try {
      const result = await sendTestMail(payload);
      return { success: true, data: result };
    } catch (err) {
      console.error('[MAIN] mail:send-test failed:', err?.message || err);
      return { success: false, message: err?.message || '테스트 메일 발송에 실패했습니다.' };
    }
  });
} catch (err) {
  console.error('[MAIN] mail:send-test IPC wiring failed:', err);
}

try {
  if (ipcMain.removeHandler) ipcMain.removeHandler('mail:send-batch');
  ipcMain.handle('mail:send-batch', async (event, payload = {}) => {
    try {
      const { progressChannel, ...rest } = payload || {};
      const results = await sendBulkMail({
        ...rest,
        onProgress: (count) => {
          if (progressChannel) {
            try { event.sender.send(progressChannel, count); } catch {}
          }
        },
      });
      return { success: true, results };
    } catch (err) {
      console.error('[MAIN] mail:send-batch failed:', err?.message || err);
      return { success: false, message: err?.message || '메일 발송에 실패했습니다.' };
    }
  });
} catch (err) {
  console.error('[MAIN] mail:send-batch IPC wiring failed:', err);
}

try {
  if (ipcMain.removeHandler) ipcMain.removeHandler('excel-helper:open-window');
  ipcMain.handle('excel-helper:open-window', async () => {
    try {
      createExcelHelperWindow();
      return { success: true };
    } catch (err) {
      return { success: false, message: err?.message || '엑셀 도우미 창을 열 수 없습니다.' };
    }
  });
  if (ipcMain.removeHandler) ipcMain.removeHandler('excel-helper:get-selection');
  ipcMain.handle('excel-helper:get-selection', async () => excelAutomation.getSelection());
  if (ipcMain.removeHandler) ipcMain.removeHandler('excel-helper:apply-offsets');
  ipcMain.handle('excel-helper:apply-offsets', async (_event, payload = {}) => excelAutomation.applyOffsets(payload));
  if (ipcMain.removeHandler) ipcMain.removeHandler('excel-helper:read-offsets');
  ipcMain.handle('excel-helper:read-offsets', async (_event, payload = {}) => excelAutomation.readOffsets(payload));
} catch (e) {
  console.error('[MAIN] excel-helper IPC wiring failed:', e);
}

// Agreements: Fetch candidates (skeleton implementation)
try {
  const { isSingleBidEligible } = require('./src/shared/agreements/rules/lh.js');
  if (ipcMain.removeHandler) { try { ipcMain.removeHandler('agreements-fetch-candidates'); } catch {} }
  ipcMain.handle('agreements-fetch-candidates', async (_event, params = {}) => {
    try {
      const ownerId = params.ownerId || 'LH';
      const rawFileType = params.fileType || 'eung';
      const fileType = normalizeFileType(rawFileType, { fallback: 'eung' }) || 'eung';
      const entryAmount = params.entryAmount || params.estimatedPrice || 0;
      const baseAmount = params.baseAmount || 0;
      const menuKey = params.menuKey || '';
      const perfectPerformanceAmount = params.perfectPerformanceAmount || 0;
      const dutyRegions = Array.isArray(params.dutyRegions) ? params.dutyRegions : [];
      const excludeSingleBidEligible = params.excludeSingleBidEligible !== false; // default true
      const filterByRegion = !!params.filterByRegion; // only include region-matching when dutyRegions provided
      const isMoisUnder30 = ownerId === 'MOIS' && menuKey === 'mois-under30';

      // Load rules
      let rulesDoc = null;
      try { if (fs.existsSync(AGREEMENTS_RULES_PATH)) rulesDoc = JSON.parse(fs.readFileSync(AGREEMENTS_RULES_PATH, 'utf-8')); } catch {}
      const owners = (rulesDoc && rulesDoc.owners) || [];
      const owner = owners.find((o) => o.id === ownerId) || null;

      const pickRuleFromKinds = (kinds = []) => {
        if (!Array.isArray(kinds)) return null;
        const normalizedType = normalizeFileType(fileType, { fallback: null }) || fileType;
        const match = kinds.find((k) => {
          if (!k || typeof k.id === 'undefined') return false;
          if (k.id === fileType) return true;
          const normalizedId = normalizeFileType(k.id, { fallback: null });
          return normalizedId === normalizedType;
        }) || kinds.find((k) => k && k.id);
        return match && match.rules ? match.rules : null;
      };

      const globalRuleSet = pickRuleFromKinds(rulesDoc && rulesDoc.globalRules && rulesDoc.globalRules.kinds);

      let rangeRuleSet = null;
      if (owner && Array.isArray(owner.ranges) && owner.ranges.length > 0) {
        let range = null;
        if (menuKey) {
          range = owner.ranges.find((r) => r && r.id === menuKey) || null;
        }
        if (!range) {
          range = owner.ranges.find((r) => r && r.id) || null;
        }
        if (range) {
          rangeRuleSet = pickRuleFromKinds(range.kinds);
        }
      }

      let ownerKindRuleSet = null;
      if (owner) {
        ownerKindRuleSet = pickRuleFromKinds(owner.kinds);
      }

      const normalizeRegionKey = (value) => String(value || '').replace(/\s+/g, '').trim().toLowerCase();
      const regionTargets = dutyRegions.map((region) => normalizeRegionKey(region)).filter(Boolean);
      const regionRuleSets = [];
      if (regionTargets.length > 0 && rulesDoc && Array.isArray(rulesDoc.regions)) {
        rulesDoc.regions.forEach((region) => {
          const key = normalizeRegionKey(region?.id || region?.label || region?.region);
          if (!key || !regionTargets.includes(key)) return;
          const ruleSet = pickRuleFromKinds(region?.kinds || []);
          if (ruleSet) regionRuleSets.push(ruleSet);
        });
      }

      const ruleSets = [globalRuleSet, rangeRuleSet, ownerKindRuleSet, ...regionRuleSets].filter(Boolean);

      // Access SearchService instance created above
      let data = [];
      try {
        // Reach into the earlier service by calling the same search IPC logic path
        // We can't call renderer IPC from main; instead, reuse svc captured in this file's scope if available
        // eslint-disable-next-line no-undef
        if (typeof svc !== 'undefined' && svc && svc.search) {
          data = svc.search(fileType, {});
        }
      } catch {}

      if (!Array.isArray(data)) data = [];
      // Fallback: if service instance not reachable, read from source file directly
      if (data.length === 0) {
        try {
          const srcPath = FILE_PATHS[fileType];
          const runtimePath = toWSLPathIfNeeded(srcPath);
          if (runtimePath && fs.existsSync(runtimePath)) {
            const { sanitizedPath } = sanitizeXlsx(runtimePath);
            const lg = new SearchLogic(sanitizedPath);
            await lg.load();
            data = lg.search({});
          }
        } catch (e) { console.warn('[MAIN] fallback loading for candidates failed:', e?.message || e); }
      }

      const norm = (s) => String(s || '').trim();
      const excludeBiz = new Set();
      const excludeName = new Set();

      const applyRuleSet = (ruleSet) => {
        if (!ruleSet || typeof ruleSet !== 'object') return;
        (ruleSet.alwaysExclude || []).forEach((entry) => {
          const biz = norm(entry?.bizNo);
          const name = norm(entry?.name);
          if (biz) excludeBiz.add(biz);
          if (name) excludeName.add(name);
        });
      };

      ruleSets.forEach(applyRuleSet);

      const combinedExcludeSingleBid = ruleSets.every((set) => set?.excludeSingleBidEligible !== false);
      const shouldExcludeSingle = excludeSingleBidEligible && combinedExcludeSingleBid;

      const out = [];
      const toNumber = (v) => {
        if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
        const s = String(v || '').replace(/[^0-9]/g, '');
        return s ? Number(s) : 0;
      };
      const parseNumeric = (value) => {
        if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
        if (typeof value === 'string') {
          const cleaned = value.replace(/[^0-9.+-]/g, '').trim();
          if (!cleaned) return 0;
          const num = Number(cleaned);
          return Number.isFinite(num) ? num : 0;
        }
        return 0;
      };
      const estimatedAmount = params.estimatedAmount || params.estimatedPrice || 0;
      let tierAmount = toNumber(estimatedAmount || baseAmount || entryAmount);
      const baseAmountNumber = toNumber(baseAmount);
      const perfectPerformanceNumber = isMoisUnder30
        ? (toNumber(perfectPerformanceAmount) || baseAmountNumber)
        : baseAmountNumber;
      const matchesRegion = (value) => {
        if (!Array.isArray(dutyRegions) || dutyRegions.length === 0) return true;
        const target = String(value || '').trim();
        if (!target) return false;
        return dutyRegions.includes(target);
      };
      const industryAvg = (() => {
        if (!industryAverages || typeof industryAverages !== 'object') return null;
        const direct = industryAverages[fileType];
        if (direct && typeof direct === 'object') return direct;
        const lower = industryAverages[String(fileType || '').toLowerCase()];
        return (lower && typeof lower === 'object') ? lower : null;
      })();

      const todayMidnight = new Date();
      todayMidnight.setHours(0, 0, 0, 0);

      const normalizedOwnerId = String(ownerId || '').toLowerCase();
      const normalizedMenuKey = String(menuKey || '').toLowerCase();

      const toScore = (value) => {
        const num = Number(value);
        return Number.isFinite(num) ? num : 0;
      };

      const MS_PER_DAY = 24 * 60 * 60 * 1000;
      const MS_PER_YEAR = 365.2425 * MS_PER_DAY;
      const EXCEL_DATE_EPOCH = new Date(Date.UTC(1899, 11, 30));

      const isValidDate = (value) => value instanceof Date && !Number.isNaN(value.getTime());

      const fromExcelSerial = (serial) => {
        const num = Number(serial);
        if (!Number.isFinite(num)) return null;
        if (num <= 0) return null;
        const milliseconds = Math.round(num * MS_PER_DAY);
        const date = new Date(EXCEL_DATE_EPOCH.getTime() + milliseconds);
        if (!isValidDate(date)) return null;
        return date;
      };

      const parseDateLike = (raw) => {
        if (!raw && raw !== 0) return null;
        if (raw instanceof Date) {
          return isValidDate(raw) ? raw : null;
        }
        if (typeof raw === 'number') {
          if (raw > 1000) {
            const excelDate = fromExcelSerial(raw);
            if (excelDate) return excelDate;
          }
          return null;
        }
        const text = String(raw || '').trim();
        if (!text) return null;

        const matchFourDigit = text.match(/(19|20)\d{2}/);
        if (matchFourDigit) {
          const dateMatch = text.match(/(\d{4})[^0-9]*(\d{1,2})[^0-9]*(\d{1,2})/);
          if (dateMatch) {
            const year = Number(dateMatch[1]);
            const month = Number(dateMatch[2]);
            const day = Number(dateMatch[3]);
            if (year >= 1900 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
              const date = new Date(year, month - 1, day);
              if (isValidDate(date)) return date;
            }
          }
        }

        const digitsOnly = text.replace(/[^0-9]/g, '');
        if (digitsOnly.length === 8) {
          const year = Number(digitsOnly.slice(0, 4));
          const month = Number(digitsOnly.slice(4, 6));
          const day = Number(digitsOnly.slice(6, 8));
          if (year >= 1900 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            const date = new Date(year, month - 1, day);
            if (isValidDate(date)) return date;
          }
        }

        return null;
      };

      const parseBizYearsFromText = (text) => {
        const normalized = String(text || '').trim();
        if (!normalized) return null;
        const yearMonthMatch = normalized.match(/(\d+(?:\.\d+)?)\s*년\s*(\d+(?:\.\d+)?)?\s*개월?/);
        if (yearMonthMatch) {
          const yearsPart = Number(yearMonthMatch[1]);
          const monthsPart = yearMonthMatch[2] != null ? Number(yearMonthMatch[2]) : 0;
          const total = (Number.isFinite(yearsPart) ? yearsPart : 0) + (Number.isFinite(monthsPart) ? monthsPart / 12 : 0);
          return Number.isFinite(total) && total > 0 ? total : null;
        }
        const monthsOnlyMatch = normalized.match(/(\d+(?:\.\d+)?)\s*개월/);
        if (monthsOnlyMatch) {
          const months = Number(monthsOnlyMatch[1]);
          if (Number.isFinite(months) && months > 0) return months / 12;
        }
        return null;
      };

      const computeBizYears = (rawValue, baseDate) => {
        if (!rawValue && rawValue !== 0) return { years: null, startDate: null };

        const base = isValidDate(baseDate) ? baseDate : todayMidnight;
        const startDate = parseDateLike(rawValue);
        if (startDate && base && isValidDate(base)) {
          const diff = base.getTime() - startDate.getTime();
          const years = diff > 0 ? (diff / MS_PER_YEAR) : 0;
          return { years: Number.isFinite(years) ? Number(years.toFixed(4)) : 0, startDate };
        }

        if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
          if (rawValue > 0 && rawValue <= 200) {
            return { years: Number(rawValue.toFixed(4)), startDate: null };
          }
        }

        const fromText = parseBizYearsFromText(rawValue);
        if (Number.isFinite(fromText) && fromText > 0) {
          return { years: Number(fromText.toFixed(4)), startDate: null };
        }

        const numericString = Number(parseNumeric(rawValue));
        if (Number.isFinite(numericString) && numericString > 0 && numericString <= 200) {
          return { years: Number(numericString.toFixed(4)), startDate: null };
        }

        return { years: null, startDate: null };
      };

      const evaluationDateRaw = params.evaluationDate || params.noticeDate || null;
      const evaluationDateParsed = parseDateLike(evaluationDateRaw);
      const bizEvaluationDate = (() => {
        if (evaluationDateParsed && isValidDate(evaluationDateParsed)) {
          const copy = new Date(evaluationDateParsed.getTime());
          copy.setHours(0, 0, 0, 0);
          return copy;
        }
        return todayMidnight;
      })();

      const buildOverridesFromTier = (tier, effectiveAmount) => {
        if (!tier || !tier.rules) return null;
        const mgRules = tier.rules.management || {};
        const methods = Array.isArray(mgRules.methods) ? mgRules.methods : [];
        const composite = methods.find((m) => m.id === 'composite') || null;
        const components = (composite && composite.components) || {};
        const debtThresholds = Array.isArray(components.debtRatio && components.debtRatio.thresholds)
          ? components.debtRatio.thresholds
          : [];
        const currentThresholds = Array.isArray(components.currentRatio && components.currentRatio.thresholds)
          ? components.currentRatio.thresholds
          : [];
        const bizYearsThresholds = Array.isArray(components.bizYears && components.bizYears.thresholds)
          ? components.bizYears.thresholds
          : [];
        const maxByThresholds = (arr) => {
          if (!Array.isArray(arr) || arr.length === 0) return null;
          return arr.reduce((max, item) => {
            const val = toScore(item && item.score);
            return Number.isFinite(val) ? Math.max(max, val) : max;
          }, 0);
        };
        const creditMethod = methods.find((m) => m.id === 'credit') || {};
        const creditTable = Array.isArray(creditMethod.gradeTable) ? creditMethod.gradeTable : [];
        const creditMaxScore = creditTable.reduce((max, row) => {
          const val = toScore(row && row.score);
          return Number.isFinite(val) ? Math.max(max, val) : max;
        }, 0) || null;
        return {
          creditTable,
          debtThresholds,
          currentThresholds,
          bizYearsThresholds,
          debtMaxScore: maxByThresholds(debtThresholds),
          currentMaxScore: maxByThresholds(currentThresholds),
          bizYearsMaxScore: maxByThresholds(bizYearsThresholds),
          creditMaxScore,
          tierAmountForEval: Number.isFinite(effectiveAmount) && effectiveAmount > 0 ? effectiveAmount : null,
        };
      };

      const selectTierForAgency = (agency, amount) => {
        const tiersRaw = Array.isArray(agency && agency.tiers) ? agency.tiers.slice() : [];
        if (!tiersRaw.length) return { tier: null, effectiveAmount: amount };
        const tiersSorted = tiersRaw.slice().sort((a, b) => toNumber(a && a.minAmount) - toNumber(b && b.minAmount));

        const findByAmount = (amt) => {
          if (!Number.isFinite(amt) || amt <= 0) return null;
          return tiersSorted.find((t) => {
            const min = toNumber(t && t.minAmount);
            const rawMax = t && t.maxAmount;
            const maxNumber = rawMax === null || rawMax === undefined || rawMax === '' ? NaN : toNumber(rawMax);
            const upper = Number.isFinite(maxNumber) && maxNumber > 0 ? maxNumber : Infinity;
            const lower = Number.isFinite(min) ? min : 0;
            return amt >= lower && amt < upper;
          }) || null;
        };

        let effectiveAmount = Number.isFinite(amount) ? amount : 0;
        if (effectiveAmount < 0) effectiveAmount = 0;

        let chosen = null;

        if (normalizedOwnerId === 'mois' && (!Number.isFinite(amount) || amount <= 0)) {
          const indexMap = {
            'mois-under30': 0,
            'mois-30to50': 1,
            'mois-50to100': 2,
          };
          const idx = indexMap[normalizedMenuKey];
          if (typeof idx === 'number' && idx >= 0 && idx < tiersSorted.length) {
            chosen = tiersSorted[idx];
            const minVal = toNumber(chosen && chosen.minAmount);
            if (!Number.isFinite(effectiveAmount) || effectiveAmount <= 0) {
              effectiveAmount = minVal > 0 ? minVal : effectiveAmount;
            }
          }
        }

        if (!chosen) {
          const byEffective = findByAmount(effectiveAmount);
          if (byEffective) chosen = byEffective;
        }

        if (!chosen) {
          const byRaw = findByAmount(amount);
          if (byRaw) chosen = byRaw;
        }

        if (!chosen) {
          chosen = tiersSorted[tiersSorted.length - 1] || null;
        }

        if (chosen && (!Number.isFinite(effectiveAmount) || effectiveAmount <= 0)) {
          const minVal = toNumber(chosen && chosen.minAmount);
          if (minVal > 0) effectiveAmount = minVal;
        }

        return { tier: chosen, effectiveAmount };
      };

      const getAgencyOverrides = () => {
        const formulasDoc = resolveFormulasDocument({ preferDefaults: true });
        const agencies = Array.isArray(formulasDoc && formulasDoc.agencies) ? formulasDoc.agencies : [];
        if (!agencies.length) return {};
        const agency = agencies.find((a) => String(a.id || '').toLowerCase() === normalizedOwnerId) || null;
        if (!agency) return {};
        const { tier, effectiveAmount } = selectTierForAgency(agency, tierAmount);
        return buildOverridesFromTier(tier, effectiveAmount) || {};
      };

      const overrides = getAgencyOverrides();
      if (overrides && overrides.tierAmountForEval != null) {
        const amt = Number(overrides.tierAmountForEval);
        if (Number.isFinite(amt) && amt > 0) tierAmount = amt;
      }
      const debtThresholdsBase = overrides.debtThresholds || [];
      const currentThresholdsBase = overrides.currentThresholds || [];
      const debtMaxScoreBase = overrides.debtMaxScore != null ? overrides.debtMaxScore : null;
      const currentMaxScoreBase = overrides.currentMaxScore != null ? overrides.currentMaxScore : null;
      const creditTableBase = overrides.creditTable || [];
      const creditMaxScoreBase = overrides.creditMaxScore != null ? overrides.creditMaxScore : null;
      const bizYearsMaxScoreBase = overrides.bizYearsMaxScore != null ? overrides.bizYearsMaxScore : null;

      const evaluateThresholdScore = (value, thresholds = []) => {
        if (value == null || !Number.isFinite(value)) return null;
        for (const threshold of thresholds) {
          const lt = threshold.lt;
          const gte = threshold.gte;
          if (typeof lt === 'number' && value < lt) return toScore(threshold.score);
          if (typeof gte === 'number') {
            const ltCond = threshold.lt;
            if (ltCond == null) {
              if (value >= gte) return toScore(threshold.score);
            } else if (value >= gte && value < ltCond) {
              return toScore(threshold.score);
            }
          }
        }
        const last = thresholds[thresholds.length - 1];
        return last ? toScore(last.score) : null;
      };
      for (const c of data) {
        const name = norm(c['검색된 회사'] || c['회사명']);
        const bizNo = norm(c['사업자번호']);
        const managerFromNotes = (() => {
          try {
            const raw = c['비고'];
            if (raw) {
              const extracted = SearchLogic && typeof SearchLogic.extractManagerName === 'function'
                ? SearchLogic.extractManagerName(raw)
                : null;
              return norm(extracted);
            }
          } catch (err) {
            console.warn('[MAIN] manager extraction failed:', err?.message || err);
          }
          return '';
        })();
        const manager = norm(c['담당자명'] || managerFromNotes || '');
        const region = norm(c['대표지역'] || c['지역'] || '');
        const summaryStatus = norm(c['요약상태']);
        const dataStatus = (c && c['데이터상태']) || null;
        let isLatest = summaryStatus === '최신';
        if (!isLatest && dataStatus && typeof dataStatus === 'object') {
          try {
            const critical = ['시평', '3년 실적', '5년 실적'];
            isLatest = critical.every((field) => {
              const value = dataStatus[field];
              return (typeof value === 'string' ? value.trim() : '') === '최신';
            });
          } catch {
            /* ignore */
          }
        }
        const rating = toNumber(c['시평']);
        const perf5y = toNumber(c['5년 실적']);
        const debtRatio = parseNumeric(c['부채비율']);
        const currentRatio = parseNumeric(c['유동비율']);
        const bizYearsInfo = computeBizYears(c['영업기간'], bizEvaluationDate);
        const bizYears = bizYearsInfo.years;
        const bizYearsStartDate = bizYearsInfo.startDate;
        const qualityEval = parseNumeric(c['품질평가']);
        const creditRawFull = norm(c['신용평가']);
        const creditNoteRawFull = norm(c['신용메모']);
        const creditExpiryDate = extractExpiryDate(creditRawFull) || extractExpiryDate(creditNoteRawFull);
        const expiredByDate = creditExpiryDate ? creditExpiryDate.getTime() < todayMidnight.getTime() : false;
        const extractCreditGrade = (value) => {
          const str = norm(value);
          if (!str) return '';
          const cleaned = str.replace(/\s+/g, ' ').trim();
          const match = cleaned.match(/^([A-Z]{1,3}[0-9]?(?:[+-])?)/i);
          return match ? match[1].toUpperCase() : cleaned.split(/[\s(]/)[0].toUpperCase();
        };
        const creditGradeRaw = extractCreditGrade(creditRawFull);

        const wasAlwaysExcluded = (bizNo && excludeBiz.has(bizNo)) || (!bizNo && excludeName.has(name));
        if (wasAlwaysExcluded) continue;

        const isPpsOwner = normalizedOwnerId === 'pps';
        let sbe = null;
        if (!isPpsOwner) {
          try { sbe = isSingleBidEligible(c, { entryAmount, baseAmount, dutyRegions }); } catch {}
        }

        let moneyOk = null;
        let perfOk = null;
        let regionOk = matchesRegion(region);
        let singleBidEligible = false;
        let debtScore = null;
        let currentScore = null;
        let bizYearsScore = null;
        let debtAgainstAverage = null;
        let currentAgainstAverage = null;

        if (debtRatio > 0 && industryAvg && Number(industryAvg.debtRatio) > 0) {
          debtAgainstAverage = debtRatio / Number(industryAvg.debtRatio);
        }
        if (currentRatio > 0 && industryAvg && Number(industryAvg.currentRatio) > 0) {
          currentAgainstAverage = currentRatio / Number(industryAvg.currentRatio);
        }

        const deriveScoresFromRules = () => {
          if (debtScore == null && debtAgainstAverage != null) {
            debtScore = evaluateThresholdScore(debtAgainstAverage, debtThresholdsBase);
          }
          if (currentScore == null && currentAgainstAverage != null) {
            currentScore = evaluateThresholdScore(currentAgainstAverage, currentThresholdsBase);
          }
        };

        deriveScoresFromRules();

        if (debtScore == null || currentScore == null || bizYearsScore == null) {
          try {
            const evalResult = evaluateScores({
              agencyId: String(ownerId || '').toLowerCase(),
              amount: tierAmount,
              inputs: {
                debtRatio,
                currentRatio,
                bizYears,
                qualityEval,
                perf5y,
                baseAmount: baseAmountNumber,
              },
              industryAvg,
              useDefaultsOnly: true,
            });
            const parts = evalResult && evalResult.management && evalResult.management.composite && evalResult.management.composite.parts;
            if (parts) {
              if (debtScore == null && parts.debtScore != null) debtScore = toScore(parts.debtScore);
              if (currentScore == null && parts.currentScore != null) currentScore = toScore(parts.currentScore);
              if (bizYearsScore == null && parts.yearsScore != null) bizYearsScore = toScore(parts.yearsScore);
            }
          } catch (e) {
            console.warn('[MAIN] evaluateScores fallback failed:', e?.message || e);
          }
        }

        deriveScoresFromRules();

        let creditScore = null;
        let creditGradeResolved = creditGradeRaw || null;
        let creditNote = null;

        try {
          const evalResult = evaluateScores({
            agencyId: String(ownerId || '').toLowerCase(),
            amount: tierAmount,
            inputs: {
              debtRatio,
              currentRatio,
              bizYears,
              qualityEval,
              perf5y,
              baseAmount: baseAmountNumber,
              creditGrade: creditGradeRaw,
            },
            industryAvg,
            useDefaultsOnly: true,
          });
          const parts = evalResult && evalResult.management && evalResult.management.composite && evalResult.management.composite.parts;
          if (parts) {
            if (debtScore == null && parts.debtScore != null) debtScore = toScore(parts.debtScore);
            if (currentScore == null && parts.currentScore != null) currentScore = toScore(parts.currentScore);
            if (bizYearsScore == null && parts.yearsScore != null) bizYearsScore = toScore(parts.yearsScore);
          }
          const creditEval = evalResult && evalResult.management && evalResult.management.credit;
          if (creditEval) {
            if (creditEval.score != null) creditScore = toScore(creditEval.score);
            if (creditEval.grade) creditGradeResolved = String(creditEval.grade).trim();
            if (creditScore == null && creditEval.grade) {
              const upperGrade = String(creditEval.grade).trim().toUpperCase();
              const match = creditTableBase.find((item) => String(item.grade || '').trim().toUpperCase() === upperGrade);
              if (match && match.score != null) creditScore = toScore(match.score);
            }
            if (creditEval.meta && creditEval.meta.expired) {
              creditNote = 'expired';
              creditScore = null;
            }
            if (creditEval.meta && creditEval.meta.overAgeLimit) {
              creditNote = creditNote || 'over-age';
              creditScore = creditScore ?? null;
            }
          }
        } catch (e) {
          console.warn('[MAIN] evaluateScores fallback failed:', e?.message || e);
        }

        if (!creditNote && creditRawFull) {
          if (creditRawFull.includes('만료')) creditNote = 'expired';
        }

        if (expiredByDate) {
          creditNote = 'expired';
          creditScore = null;
        }

        deriveScoresFromRules();

        const debtMax = Number.isFinite(Number(debtMaxScoreBase)) ? Number(debtMaxScoreBase) : 0;
        const currentMax = Number.isFinite(Number(currentMaxScoreBase)) ? Number(currentMaxScoreBase) : 0;
        const bizYearsMax = Number.isFinite(Number(bizYearsMaxScoreBase)) ? Number(bizYearsMaxScoreBase) : 0;
        const creditMax = Number.isFinite(Number(creditMaxScoreBase)) ? Number(creditMaxScoreBase) : 0;
        const debtScoreValue = Number.isFinite(Number(debtScore)) ? Number(debtScore) : 0;
        const currentScoreValue = Number.isFinite(Number(currentScore)) ? Number(currentScore) : 0;
        const bizYearsScoreValue = Number.isFinite(Number(bizYearsScore)) ? Number(bizYearsScore) : 0;
        const combinedScoreValue = debtScoreValue + currentScoreValue + (bizYearsMax > 0 ? bizYearsScoreValue : 0);
        const combinedMaxValue = (Number.isFinite(debtMax) ? debtMax : 0)
          + (Number.isFinite(currentMax) ? currentMax : 0)
          + (bizYearsMax > 0 ? bizYearsMax : 0);
        let managementScore = combinedScoreValue;
        let managementMax = combinedMaxValue;
        if (Number.isFinite(creditScore)) {
          if (creditScore > managementScore) managementScore = creditScore;
          managementMax = Math.max(managementMax, creditMax);
        }
        const managementIsPerfect = managementMax > 0 && Math.abs(managementScore - managementMax) < 1e-6;

        if (isPpsOwner) {
          const entryNum = toNumber(entryAmount);
          const baseNum = toNumber(baseAmount);
          const sipValue = rating;
          const perfValue = perf5y;
          const hasEntry = entryNum > 0;
          const moneyCondition = hasEntry ? (sipValue >= entryNum) : true;
          const perfCondition = baseNum > 0 && perfValue >= baseNum;
          const managementCondition = managementIsPerfect;

          moneyOk = hasEntry ? moneyCondition : null;
          perfOk = perfCondition;

          const reasons = [];
          const toLocale = (num) => (Number.isFinite(num) ? num.toLocaleString() : String(num || '0'));
          if (hasEntry && !moneyCondition) {
            reasons.push(`시평 미달: ${toLocale(sipValue)} < 참가자격 ${toLocale(entryNum)}`);
          }
          if (!perfCondition) {
            reasons.push(`5년 실적 미달: ${toLocale(perfValue)} < 기초금액 ${toLocale(baseNum)}`);
          }
          if (!managementCondition) {
            reasons.push('경영점수 만점 미달');
          }

          sbe = {
            ok: Boolean((!hasEntry || moneyCondition) && perfCondition && managementCondition),
            reasons,
            facts: {
              sipyung: sipValue,
              perf5y: perfValue,
              entry: entryNum,
              base: baseNum,
              managementScore,
              managementMax,
            },
          };
        } else if (sbe) {
          const facts = sbe.facts || {};
          const entryFact = toNumber(facts.entry);
          const baseFact = toNumber(facts.base);
          const sipFact = toNumber(facts.sipyung);
          const perfFact = toNumber(facts.perf5y);
          if (entryFact > 0) {
            moneyOk = sipFact >= entryFact;
          }
          if (baseFact > 0) {
            perfOk = perfFact >= baseFact;
          }
          if (Array.isArray(dutyRegions) && dutyRegions.length > 0) {
            const factRegion = facts.region != null ? String(facts.region).trim() : region;
            if (factRegion) {
              regionOk = matchesRegion(factRegion);
            }
          }
        }

        singleBidEligible = Boolean(sbe && sbe.ok);

        if (isMoisUnder30) {
          const entryNum = toNumber(entryAmount);
          const perfTargetRaw = perfectPerformanceNumber;
          const sipNumeric = parseNumeric(rating);
          const perfNumeric = parseNumeric(perf5y);
          const perfTarget = toNumber(perfTargetRaw);
          const hasEntry = entryNum > 0;
          const toLocale = (num) => (Number.isFinite(num) ? num.toLocaleString() : String(num || '0'));

          const moneyCondition = hasEntry ? (sipNumeric >= entryNum) : true;
          moneyOk = hasEntry ? moneyCondition : null;

          const hasPerfTarget = perfTarget > 0;
          const perfCondition = hasPerfTarget ? (perfNumeric >= perfTarget) : true;
          perfOk = hasPerfTarget ? perfCondition : null;

          regionOk = matchesRegion(region);

          const singleBidOk = moneyCondition && perfCondition && regionOk !== false;
          const reasons = [];

          if (hasEntry && moneyOk === false) {
            reasons.push(`시평 미달: ${toLocale(sipNumeric)} < 참가자격 ${toLocale(entryNum)}`);
          }
          if (perfOk === false) {
            reasons.push(`5년 실적 미달: ${toLocale(perfNumeric)} < 기초금액 ${toLocale(perfTarget)}`);
          }
          sbe = {
            ok: singleBidOk,
            reasons,
            facts: {
              sipyung: sipNumeric,
              perf5y: perfNumeric,
              entry: hasEntry ? entryNum : 0,
              base: perfTarget,
              region,
            },
          };

          singleBidEligible = singleBidOk;
        }

        if (shouldExcludeSingle && singleBidEligible) continue;
        if (filterByRegion && dutyRegions.length > 0 && regionOk === false) continue;

        out.push({
          id: bizNo || name,
          name,
          bizNo,
          manager,
          region,
          rating,
          perf5y,
          sipyung: rating,
          '시평금액': rating,
          '기초금액': rating,
          '기초금액(원)': rating,
          performance5y: perf5y,
          '시평': rating,
          '시평액': rating,
          '시평액(원)': rating,
          '5년 실적': perf5y,
          '5년실적': perf5y,
          '5년 실적 합계': perf5y,
          '최근5년실적': perf5y,
          '최근5년실적합계': perf5y,
          '5년실적금액': perf5y,
          '최근5년시공실적': perf5y,
          '여성기업': c['여성기업'],
          '품질평가': c['품질평가'],
          summaryStatus,
          isLatest,
          '요약상태': summaryStatus,
          debtRatio,
          currentRatio,
          debtScore,
          currentScore,
          bizYears,
          bizYearsStartDate: bizYearsStartDate && isValidDate(bizYearsStartDate) ? bizYearsStartDate.toISOString().slice(0, 10) : null,
          bizYearsScore: Number.isFinite(Number(bizYearsScore)) ? Number(bizYearsScore) : null,
          bizYearsMaxScore: bizYearsMax > 0 ? bizYearsMax : null,
          debtAgainstAverage,
          currentAgainstAverage,
          debtMaxScore: debtMaxScoreBase,
          currentMaxScore: currentMaxScoreBase,
          creditMaxScore: creditMaxScoreBase,
          creditScore,
          creditGrade: creditGradeResolved,
          creditNote,
          creditNoteText: creditNoteRawFull,
          managementTotalScore: (debtScore != null || currentScore != null || bizYearsScore != null)
            ? ((Number(debtScore) || 0) + (Number(currentScore) || 0) + (Number(bizYearsScore) || 0))
            : null,
          managementScore,
          managementMaxScore: managementMax,
          managementIsPerfect,
          moneyOk,
          perfOk,
          regionOk,
          singleBidReasons: Array.isArray(sbe && sbe.reasons) ? sbe.reasons.filter(Boolean) : [],
          singleBidFacts: sbe && sbe.facts ? {
            sipyung: toNumber(sbe.facts.sipyung),
            perf5y: toNumber(sbe.facts.perf5y),
            entry: toNumber(sbe.facts.entry),
            base: toNumber(sbe.facts.base),
            region: sbe.facts.region || region,
          } : null,
          singleBidEligible,
          wasAlwaysExcluded,
          qualityEval,
          reasons: [
            (shouldExcludeSingle && singleBidEligible) ? '단독 가능' : null,
            moneyOk === false ? '시평 미달' : null,
            perfOk === false ? '실적 미달' : null,
            regionOk === false ? '지역 불일치' : null,
          ].filter(Boolean),
        });
      }

      return { success: true, data: out };
    } catch (e) {
      return { success: false, message: e?.message || 'Failed to fetch candidates' };
    }
  });
} catch (e) {
  console.error('[MAIN] agreements-fetch-candidates IPC failed:', e);
}

// Agreements persistence IPC
try {
  if (ipcMain.removeHandler) {
    try { ipcMain.removeHandler('agreements-load'); } catch {}
    try { ipcMain.removeHandler('agreements-save'); } catch {}
  }
  ipcMain.handle('agreements-load', async () => {
    try {
      if (!fs.existsSync(AGREEMENTS_PATH)) return { success: true, data: [] };
      const raw = JSON.parse(fs.readFileSync(AGREEMENTS_PATH, 'utf-8'));
      return { success: true, data: Array.isArray(raw) ? raw : [] };
    } catch (e) {
      return { success: false, message: e?.message || 'Failed to load agreements' };
    }
  });
  ipcMain.handle('agreements-save', async (_event, items) => {
    try {
      if (!Array.isArray(items)) throw new Error('Invalid payload');
      fs.writeFileSync(AGREEMENTS_PATH, JSON.stringify(items, null, 2));
      return { success: true };
    } catch (e) {
      return { success: false, message: e?.message || 'Failed to save agreements' };
    }
  });
} catch {}

// Agreement board save/load (file-based)
try {
  const resolveAgreementBoardRuntimeDir = () => (
    toWSLPathIfNeeded(AGREEMENT_BOARD_DIR) || AGREEMENT_BOARD_DIR
  );

  const ensureAgreementBoardDir = () => {
    try {
      if (!AGREEMENT_BOARD_DIR || !String(AGREEMENT_BOARD_DIR).trim()) {
        AGREEMENT_BOARD_DIR = DEFAULT_AGREEMENT_BOARD_DIR;
      }
      const runtimeDir = resolveAgreementBoardRuntimeDir();
      if (!fs.existsSync(runtimeDir)) fs.mkdirSync(runtimeDir, { recursive: true });
    } catch (err) {
      console.error('[MAIN] agreement board dir create failed:', err);
    }
  };

  const listAgreementBoardFiles = (rootDir) => {
    const results = [];
    const stack = [rootDir];
    while (stack.length) {
      const current = stack.pop();
      let entries = null;
      try {
        entries = fs.readdirSync(current, { withFileTypes: true });
      } catch (err) {
        try {
          entries = fs.readdirSync(current).map((name) => {
            const fullPath = path.join(current, name);
            let stat = null;
            try { stat = fs.statSync(fullPath); } catch {}
            return {
              name,
              isDirectory: () => Boolean(stat?.isDirectory?.()),
              isFile: () => Boolean(stat?.isFile?.()),
            };
          });
        } catch {
          continue;
        }
      }
      for (const entry of entries || []) {
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(fullPath);
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
          results.push(fullPath);
        }
      }
    }
    return results;
  };

  const sanitizeFileName = (value = '') => (
    String(value)
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
  );

  if (ipcMain.removeHandler) {
    try { ipcMain.removeHandler('agreement-board-save'); } catch {}
    try { ipcMain.removeHandler('agreement-board-list'); } catch {}
    try { ipcMain.removeHandler('agreement-board-load'); } catch {}
    try { ipcMain.removeHandler('agreement-board-get-root'); } catch {}
    try { ipcMain.removeHandler('agreement-board-set-root'); } catch {}
    try { ipcMain.removeHandler('agreement-board-pick-root'); } catch {}
    try { ipcMain.removeHandler('agreement-board-delete'); } catch {}
  }

  ipcMain.handle('agreement-board-get-root', async () => {
    try {
      ensureAgreementBoardDir();
      return { success: true, path: AGREEMENT_BOARD_DIR };
    } catch (e) {
      return { success: false, message: e?.message || 'Failed to get agreement board path' };
    }
  });

  ipcMain.handle('agreement-board-set-root', async (_event, nextPath) => {
    try {
      if (!nextPath || typeof nextPath !== 'string') throw new Error('Invalid path');
      setAgreementBoardDir(nextPath);
      ensureAgreementBoardDir();
      return { success: true, path: AGREEMENT_BOARD_DIR };
    } catch (e) {
      return { success: false, message: e?.message || 'Failed to set agreement board path' };
    }
  });

  ipcMain.handle('agreement-board-pick-root', async () => {
    try {
      const targetWindow = BrowserWindow.getFocusedWindow();
      const result = await dialog.showOpenDialog(targetWindow, {
        title: '협정 저장 폴더 선택',
        properties: ['openDirectory', 'createDirectory'],
      });
      if (result.canceled || !result.filePaths?.[0]) {
        return { success: false, canceled: true };
      }
      setAgreementBoardDir(result.filePaths[0]);
      ensureAgreementBoardDir();
      return { success: true, path: AGREEMENT_BOARD_DIR };
    } catch (e) {
      return { success: false, message: e?.message || 'Failed to choose agreement board path' };
    }
  });

  ipcMain.handle('agreement-board-save', async (_event, payload) => {
    try {
      if (!payload || typeof payload !== 'object') throw new Error('Invalid payload');
      ensureAgreementBoardDir();
      const meta = payload.meta && typeof payload.meta === 'object' ? payload.meta : {};
      const noticeLabel = [meta.noticeNo, meta.noticeTitle].filter(Boolean).join('-');
      const fileLabelParts = [
        noticeLabel,
        meta.ownerLabel || meta.ownerId,
        meta.rangeLabel || meta.rangeId,
        meta.industryLabel,
        meta.estimatedAmountLabel || meta.estimatedAmount,
        meta.noticeDate,
      ].filter(Boolean);
      const baseName = sanitizeFileName(fileLabelParts.join('_') || '협정');
      const defaultPath = path.join(AGREEMENT_BOARD_DIR, `${baseName}.json`);
      const targetWindow = BrowserWindow.getFocusedWindow();
      const saveDialogResult = await dialog.showSaveDialog(targetWindow, {
        title: '협정 저장',
        defaultPath,
        filters: [{ name: '협정 파일', extensions: ['json'] }],
      });
      if (saveDialogResult.canceled || !saveDialogResult.filePath) {
        return { success: false, message: '사용자 취소' };
      }
      const savePayload = {
        meta: { ...meta, savedAt: new Date().toISOString() },
        payload: payload.payload || {},
      };
      const runtimeSavePath = toWSLPathIfNeeded(saveDialogResult.filePath) || saveDialogResult.filePath;
      fs.writeFileSync(runtimeSavePath, JSON.stringify(savePayload, null, 2));
      return { success: true, path: saveDialogResult.filePath };
    } catch (e) {
      return { success: false, message: e?.message || 'Failed to save agreement board' };
    }
  });

  ipcMain.handle('agreement-board-list', async () => {
    try {
      ensureAgreementBoardDir();
      const runtimeRoot = resolveAgreementBoardRuntimeDir();
      if (!fs.existsSync(runtimeRoot)) return { success: true, data: [] };
      const entries = listAgreementBoardFiles(runtimeRoot)
        .map((fullPath) => {
          try {
            const raw = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
            const meta = raw && raw.meta && typeof raw.meta === 'object' ? raw.meta : {};
            return { path: fullPath, meta };
          } catch (err) {
            return null;
          }
        })
        .filter(Boolean);
      entries.sort((a, b) => String(b.meta?.savedAt || '').localeCompare(String(a.meta?.savedAt || '')));
      return { success: true, data: entries };
    } catch (e) {
      return { success: false, message: e?.message || 'Failed to list agreement boards' };
    }
  });

  ipcMain.handle('agreement-board-load', async (_event, filePath) => {
    try {
      if (!filePath) throw new Error('Missing path');
      const runtimePath = toWSLPathIfNeeded(filePath) || filePath;
      const raw = JSON.parse(fs.readFileSync(runtimePath, 'utf-8'));
      return { success: true, data: raw?.payload || {} };
    } catch (e) {
      return { success: false, message: e?.message || 'Failed to load agreement board' };
    }
  });

  ipcMain.handle('agreement-board-delete', async (_event, filePath) => {
    try {
      if (!filePath) throw new Error('Missing path');
      const runtimePath = toWSLPathIfNeeded(filePath) || filePath;
      if (fs.existsSync(runtimePath)) {
        fs.unlinkSync(runtimePath);
      }
      return { success: true };
    } catch (e) {
      return { success: false, message: e?.message || 'Failed to delete agreement board' };
    }
  });
} catch (e) {
  console.error('[MAIN] agreement board IPC setup failed:', e);
}


// Formulas (defaults + overrides) and evaluation IPC
try {
  const formulasMod = require('./src/shared/formulas.js');
  const evaluator = require('./src/shared/evaluator.js');

  if (ipcMain.removeHandler) {
    try { ipcMain.removeHandler('formulas-load'); } catch {}
    try { ipcMain.removeHandler('formulas-load-defaults'); } catch {}
    try { ipcMain.removeHandler('formulas-load-overrides'); } catch {}
    try { ipcMain.removeHandler('formulas-save-overrides'); } catch {}
    try { ipcMain.removeHandler('formulas-evaluate'); } catch {}
  }

  ipcMain.handle('formulas-load', async () => {
    try {
      // Bust cache so defaults/merger reflect latest edits during dev
      try { delete require.cache[require.resolve('./src/shared/formulas.js')]; } catch {}
      try { delete require.cache[require.resolve('./src/shared/formulas.defaults.json')]; } catch {}
      const fresh = require('./src/shared/formulas.js');
      const data = fresh.loadFormulasMerged();
      formulasCache = data;
      return { success: true, data };
    } catch (e) {
      return { success: false, message: e?.message || 'Failed to load formulas' };
    }
  });

  ipcMain.handle('formulas-load-defaults', async () => {
    try {
      try { delete require.cache[require.resolve('./src/shared/formulas.defaults.json')]; } catch {}
      const defaults = require('./src/shared/formulas.defaults.json');
      return { success: true, data: defaults };
    } catch (e) {
      return { success: false, message: e?.message || 'Failed to load default formulas' };
    }
  });

  ipcMain.handle('formulas-load-overrides', async () => {
    try {
      if (!fs.existsSync(FORMULAS_PATH)) return { success: true, data: { version: 1, agencies: [] } };
      const raw = JSON.parse(fs.readFileSync(FORMULAS_PATH, 'utf-8'));
      return { success: true, data: raw };
    } catch (e) {
      return { success: false, message: e?.message || 'Failed to load overrides' };
    }
  });

  ipcMain.handle('formulas-save-overrides', async (_event, payload) => {
    try {
      const incoming = payload && payload.agencies ? payload : { agencies: [] };
      let base = { version: 1, agencies: [] };
      try { if (fs.existsSync(FORMULAS_PATH)) base = JSON.parse(fs.readFileSync(FORMULAS_PATH, 'utf-8')); } catch {}
      const mergedAgencies = formulasMod._internals.mergeAgencies(base.agencies, incoming.agencies);
      const out = { version: Math.max(base.version || 1, incoming.version || 1), agencies: mergedAgencies };
      fs.writeFileSync(FORMULAS_PATH, JSON.stringify(out, null, 2));
      invalidateFormulasCache();
      return { success: true };
    } catch (e) {
      return { success: false, message: e?.message || 'Failed to save overrides' };
    }
  });

  ipcMain.handle('formulas-evaluate', async (_event, payload) => {
    try {
      const sanitized = payload && typeof payload === 'object' ? { ...payload } : {};
      if (!sanitized.industryAvg) {
        const normalizedType = sanitizeFileTypeForAvg(sanitized.fileType);
        if (normalizedType) {
          const avg = industryAverages[normalizedType]
            || industryAverages[String(normalizedType).toLowerCase()]
            || null;
          if (avg) sanitized.industryAvg = avg;
        }
      }
      const r = evaluator.evaluateScores(sanitized);
      return { success: true, data: r };
    } catch (e) {
      return { success: false, message: e?.message || 'Failed to evaluate' };
    }
  });

  // New IPC handler for Excel Helper - now uses standard formula loading
  ipcMain.handle('excel-helper-formulas-evaluate', async (_event, payload) => {
    try {
      const sanitized = payload && typeof payload === 'object' ? { ...payload } : {};
      if (!sanitized.industryAvg) {
        const normalizedType = sanitizeFileTypeForAvg(sanitized.fileType);
        if (normalizedType) {
          const avg = industryAverages[normalizedType]
            || industryAverages[String(normalizedType).toLowerCase()]
            || null;
          if (avg) sanitized.industryAvg = avg;
        }
      }
      sanitized.useDefaultsOnly = true;
      const r = evaluator.evaluateScores(sanitized);
      return { success: true, data: r };
    } catch (e) {
      console.error('[MAIN] excel-helper-formulas-evaluate failed:', e?.message || e);
      return { success: false, message: e?.message || 'Failed to evaluate for Excel Helper' };
    }
  });
} catch (e) {
  console.error('[MAIN] formulas/evaluator IPC wiring failed:', e);
}


// Agreements Rules (load/save)
try {
  if (ipcMain.removeHandler) {
    try { ipcMain.removeHandler('agreements-rules-load'); } catch {}
    try { ipcMain.removeHandler('agreements-rules-save'); } catch {}
  }
  ipcMain.handle('agreements-rules-load', async () => {
    try {
      if (!fs.existsSync(AGREEMENTS_RULES_PATH)) {
        // Seed from packaged defaults if present, else use schema default
        try {
          const defaultsDir = path.join(process.resourcesPath || app.getAppPath(), 'defaults');
          const presetPath = path.join(defaultsDir, 'agreements.rules.json');
          if (fs.existsSync(presetPath)) {
            const preset = JSON.parse(fs.readFileSync(presetPath, 'utf-8'));
            fs.writeFileSync(AGREEMENTS_RULES_PATH, JSON.stringify(preset, null, 2));
          } else {
            const schema = require('./src/shared/agreements/rules/schema.js');
            const def = schema.defaultRules();
            fs.writeFileSync(AGREEMENTS_RULES_PATH, JSON.stringify(def, null, 2));
          }
        } catch {}
      }
      const raw = JSON.parse(fs.readFileSync(AGREEMENTS_RULES_PATH, 'utf-8'));
      return { success: true, data: raw };
    } catch (e) {
      return { success: false, message: e?.message || 'Failed to load agreement rules' };
    }
  });
  ipcMain.handle('agreements-rules-save', async (_event, payload) => {
    try {
      const schema = require('./src/shared/agreements/rules/schema.js');
      const v = schema.validateRules(payload);
      if (!v.ok) return { success: false, message: v.errors.join(' / ') };
      fs.writeFileSync(AGREEMENTS_RULES_PATH, JSON.stringify(payload, null, 2));
      return { success: true };
    } catch (e) {
      return { success: false, message: e?.message || 'Failed to save agreement rules' };
    }
  });
} catch {}

// Settings import/export (rules + formulas overrides)
try {
  if (ipcMain.removeHandler) {
    try { ipcMain.removeHandler('agreements-settings-export'); } catch {}
    try { ipcMain.removeHandler('agreements-settings-import'); } catch {}
  }

  ipcMain.handle('agreements-settings-export', async () => {
    try {
      const saveTo = await dialog.showSaveDialog(BrowserWindow.getFocusedWindow(), {
        title: '설정 내보내기',
        defaultPath: 'agreements-settings.json',
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (saveTo.canceled || !saveTo.filePath) return { success: false, message: '사용자 취소' };

      let rules = null; let formulas = null;
      try { if (fs.existsSync(AGREEMENTS_RULES_PATH)) rules = JSON.parse(fs.readFileSync(AGREEMENTS_RULES_PATH, 'utf-8')); } catch {}
      try { if (fs.existsSync(FORMULAS_PATH)) formulas = JSON.parse(fs.readFileSync(FORMULAS_PATH, 'utf-8')); } catch {}
      const payload = { version: 1, exportedAt: Date.now(), rules, formulas };
      fs.writeFileSync(saveTo.filePath, JSON.stringify(payload, null, 2));
      return { success: true, path: saveTo.filePath };
    } catch (e) {
      return { success: false, message: e?.message || '내보내기 실패' };
    }
  });

  ipcMain.handle('agreements-settings-import', async () => {
    try {
      const pick = await dialog.showOpenDialog(BrowserWindow.getFocusedWindow(), {
        title: '설정 가져오기',
        properties: ['openFile'],
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (pick.canceled || !pick.filePaths.length) return { success: false, message: '사용자 취소' };
      const filePath = pick.filePaths[0];
      const payload = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (!payload || typeof payload !== 'object') throw new Error('JSON 형식이 아닙니다');

      // Backup existing
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      try { if (fs.existsSync(AGREEMENTS_RULES_PATH)) fs.copyFileSync(AGREEMENTS_RULES_PATH, AGREEMENTS_RULES_PATH + '.' + stamp + '.bak'); } catch {}
      try { if (fs.existsSync(FORMULAS_PATH)) fs.copyFileSync(FORMULAS_PATH, FORMULAS_PATH + '.' + stamp + '.bak'); } catch {}

      // Validate and write rules if present
      if (payload.rules) {
        try {
          const schema = require('./src/shared/agreements/rules/schema.js');
          const v = schema.validateRules(payload.rules);
          if (!v.ok) throw new Error('규칙 스키마 불일치: ' + v.errors.join(', '));
          fs.writeFileSync(AGREEMENTS_RULES_PATH, JSON.stringify(payload.rules, null, 2));
        } catch (e) {
          return { success: false, message: '규칙 처리 실패: ' + (e?.message || e) };
        }
      }

      // Write formulas overrides if present
      if (payload.formulas) {
        try {
          fs.writeFileSync(FORMULAS_PATH, JSON.stringify(payload.formulas, null, 2));
          invalidateFormulasCache();
        } catch (e) {
          return { success: false, message: '산식 처리 실패: ' + (e?.message || e) };
        }
      }

      return { success: true };
    } catch (e) {
      return { success: false, message: e?.message || '가져오기 실패' };
    }
  });

  if (ipcMain.removeHandler) {
    try { ipcMain.removeHandler('agreements-export-excel'); } catch {}
  }

  ipcMain.handle('agreements-export-excel', async (_event, payload = {}) => {
    try {
      const templateKey = payload.templateKey;
      if (!templateKey || !AGREEMENT_TEMPLATE_CONFIGS[templateKey]) {
        throw new Error('지원하지 않는 템플릿입니다.');
      }
      const config = AGREEMENT_TEMPLATE_CONFIGS[templateKey];
      if (!config.path || !fs.existsSync(config.path)) {
        throw new Error('템플릿 파일을 찾을 수 없습니다.');
      }

      const header = payload.header || {};
      const appendTargetPath = payload.appendTargetPath ? String(payload.appendTargetPath) : '';
      const sheetName = payload.sheetName ? String(payload.sheetName) : '';
      const baseFileSegments = [];
      if (header.noticeNo) baseFileSegments.push(sanitizeFileName(header.noticeNo));
      if (config.label) baseFileSegments.push(sanitizeFileName(config.label));
      baseFileSegments.push('협정보드');
      const defaultFileName = sanitizeFileName(baseFileSegments.filter(Boolean).join('_')) || '협정보드';

      let outputPath = '';
      if (appendTargetPath) {
        if (!appendTargetPath.toLowerCase().endsWith('.xlsx')) {
          throw new Error('xlsx 파일만 선택할 수 있습니다.');
        }
        if (!fs.existsSync(appendTargetPath)) {
          throw new Error('선택한 엑셀 파일을 찾을 수 없습니다.');
        }
        outputPath = appendTargetPath;
      } else {
        const targetWindow = BrowserWindow.getFocusedWindow();
        const saveDialogResult = await dialog.showSaveDialog(targetWindow, {
          title: '협정보드 엑셀 내보내기',
          defaultPath: `${defaultFileName}.xlsx`,
          filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
        });
        if (saveDialogResult.canceled || !saveDialogResult.filePath) {
          return { success: false, message: '사용자 취소' };
        }
        outputPath = saveDialogResult.filePath;
      }

      const result = await exportAgreementExcel({
        config,
        payload,
        outputPath,
        appendToPath: appendTargetPath,
        sheetName,
        sheetColor: 'FF00B050',
      });

      return { success: true, path: result?.path || outputPath, sheetName: result?.sheetName || sheetName };
    } catch (error) {
      console.error('[MAIN] agreements-export-excel failed:', error);
      return { success: false, message: error?.message || '엑셀 내보내기에 실패했습니다.' };
    }
  });
} catch {}
const sanitizeIpcPayload = (payload) => {
  if (payload === null || payload === undefined) return payload;
  const type = typeof payload;
  if (type === 'string' || type === 'number' || type === 'boolean') return payload;
  if (Array.isArray(payload)) {
    try { return JSON.parse(JSON.stringify(payload)); }
    catch (err) { console.warn('[MAIN] sanitize array failed:', err); return payload.map((item) => sanitizeIpcPayload(item)); }
  }
  try { return JSON.parse(JSON.stringify(payload)); }
  catch (err) {
    console.warn('[MAIN] sanitize payload failed:', err);
    const clone = {};
    Object.keys(payload || {}).forEach((key) => { clone[key] = sanitizeIpcPayload(payload[key]); });
    return clone;
  }
};

const parseMaybeJson = (value, label = 'payload') => {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); }
  catch (err) {
    console.warn(`[MAIN] ${label} JSON.parse failed:`, err?.message || err);
    return value;
  }
};
