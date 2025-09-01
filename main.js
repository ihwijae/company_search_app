const { app, BrowserWindow, ipcMain, dialog, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const chokidar = require('chokidar');
const { sanitizeXlsx } = require('./utils/sanitizeXlsx');
const os = require('os');

// --- ?ㅼ젙 ---
const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');
const WINDOW_STATE_PATH = path.join(app.getPath('userData'), 'window-state.json');
let FILE_PATHS = { eung: '', tongsin: '', sobang: '' };

function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
            FILE_PATHS = { ...FILE_PATHS, ...config };
            console.log('[MAIN] 설정 파일 로드 완료:', FILE_PATHS);
        } else {
            console.log('[MAIN] 설정 파일이 없습니다. 기본값으로 동작합니다.');
        }
    } catch (err) {
        console.error('[MAIN] 설정 파일 로드 실패:', err);
    }
}

function saveConfig() {
    try {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(FILE_PATHS, null, 2));
        console.log('[MAIN] 설정 저장:', CONFIG_PATH);
    } catch (err) {
        console.error('[MAIN] 설정 저장 실패:', err);
    }
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
    backgroundColor: '#4A154B',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#4A154B',
      symbolColor: '#FFFFFF',
      height: 32,
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  mainWindowRef = mainWindow;

  // 李??곹깭 ?대깽?몃줈 ???
  ['resize', 'move', 'maximize', 'unmaximize', 'restore'].forEach(evt => {
    mainWindow.on(evt, saveWindowStateDebounced);
  });
  mainWindow.on('close', () => saveWindowState(mainWindow));

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

app.whenReady().then(async () => {
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
        const p = FILE_PATHS[ft];
        if (p && fs.existsSync(p)) { try { await svc.loadAndWatch(ft, p); } catch {} }
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

  // File selection and per-type routes
  if (ipcMain.removeHandler) ipcMain.removeHandler('select-file');
  ipcMain.handle('select-file', async (_event, fileType) => {
    const mainWindow = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(mainWindow, { title: `${fileType} file`, properties: ['openFile'], filters: [{ name: 'Excel Files', extensions: ['xlsx'] }] });
    if (result.canceled || result.filePaths.length === 0) return { success: false, message: 'Selection canceled' };
    const filePath = result.filePaths[0];
    if (!filePath.toLowerCase().endsWith('.xlsx')) return { success: false, message: 'Please select a .xlsx file' };
    FILE_PATHS[fileType] = filePath; saveConfig();
    try { await svc.loadAndWatch(fileType, filePath); return { success: true, path: filePath }; }
    catch (e) { return { success: false, message: e?.message || 'Load failed' }; }
  });

  if (ipcMain.removeHandler) ipcMain.removeHandler('get-regions');
  ipcMain.handle('get-regions', (_event, file_type) => {
    try { return { success: true, data: svc.getRegions(file_type) }; }
    catch { return { success: true, data: ['전체'] }; }
  });

  if (ipcMain.removeHandler) ipcMain.removeHandler('check-files');
  ipcMain.handle('check-files', () => svc.getStatuses());

  // get-file-paths: expose currently registered original paths
  if (ipcMain.removeHandler) ipcMain.removeHandler('get-file-paths');
  ipcMain.handle('get-file-paths', () => ({ success: true, data: FILE_PATHS }));

  if (ipcMain.removeHandler) ipcMain.removeHandler('search-companies');
  ipcMain.handle('search-companies', (_event, { criteria, file_type }) => {
    try { const data = svc.search(file_type, criteria); return { success: true, data }; }
    catch (e) { return { success: false, message: e?.message || 'Search failed' }; }
  });
} catch (e) {
  console.error('[MAIN] SearchService 초기화/바인딩 실패:', e);
}



