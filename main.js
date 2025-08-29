// main.js (문법 오류를 수정한 최종 버전)

const { app, BrowserWindow, ipcMain, dialog, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { SearchLogic } = require('./searchLogic.js');
const chokidar = require('chokidar');
const { sanitizeXlsx } = require('./utils/sanitizeXlsx');
const os = require('os');

// --- 설정 ---
const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');
const WINDOW_STATE_PATH = path.join(app.getPath('userData'), 'window-state.json');
let FILE_PATHS = { eung: '', tongsin: '', sobang: '' };

function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
            FILE_PATHS = { ...FILE_PATHS, ...config };
            console.log('[MAIN.JS LOG] 설정 파일 로드 성공:', FILE_PATHS);
        } else {
            console.log('[MAIN.JS LOG] 설정 파일이 없습니다. 기본값으로 시작합니다.');
        }
    } catch (err) {
        console.error('[MAIN.JS ERROR] 설정 파일 로딩 실패:', err);
    }
}

function saveConfig() {
    try {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(FILE_PATHS, null, 2));
        console.log('[MAIN.JS LOG] 설정이 저장되었습니다:', CONFIG_PATH);
    } catch (err) {
        console.error('[MAIN.JS ERROR] 설정 파일 저장 실패:', err);
    }
}

loadConfig();
// ---

const searchLogics = {};
const fileWatchers = {};
let mainWindowRef = null;
const DEBOUNCE_MS = 500;

// 임시 정화본 유지 정책
const SANITIZED_KEEP_PER_SOURCE = 3; // 동일 원본당 최신 3개 유지
const SANITIZED_TTL_MS = 24 * 60 * 60 * 1000; // 24시간
const CLEAN_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6시간

// 원본 경로별 정화본 목록 레지스트리
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
  // 최신순 정렬 후 보관 개수 초과분 삭제
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
const isDev = process.env.NODE_ENV !== 'production';

// ----- 창 상태 저장/복원 유틸 -----
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
    // 최소 크기 보정
    width = Math.max(800, Math.min(width || 1400, wa.width));
    height = Math.max(600, Math.min(height || 900, wa.height));
    // 위치 보정(화면 밖 방지)
    if (typeof x !== 'number') x = wa.x + Math.floor((wa.width - width) / 2);
    if (typeof y !== 'number') y = wa.y + Math.floor((wa.height - height) / 2);
    // 오른쪽/아래 경계 넘김 방지
    if (x + width > wa.x + wa.width) x = wa.x + wa.width - width;
    if (y + height > wa.y + wa.height) y = wa.y + wa.height - height;
    // 왼쪽/위 경계 방지
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

  // 창 상태 이벤트로 저장
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

  // 이전에 최대화 상태였다면 복원 시 최대화
  if (prevState.isMaximized) {
    mainWindow.maximize();
  }
}

app.whenReady().then(async () => {
  console.log('[main.js] 앱 준비 완료. 저장된 파일 경로 자동 로딩 시작...');
  // 주기적 임시 파일 정리 시작
  cleanOldTempFiles();
  setInterval(cleanOldTempFiles, CLEAN_INTERVAL_MS);
  for (const fileType in FILE_PATHS) {
    const filePath = FILE_PATHS[fileType];
    if (filePath && fs.existsSync(filePath)) {
      console.log(`[main.js] '${fileType}' 파일 로딩 시도: ${filePath}`);
      // 댓글/메모 자동 정화 후 로딩
      const { sanitizedPath, sanitized } = sanitizeXlsx(filePath);
      if (sanitized) {
        console.log(`[main.js] 정화된 임시 파일 사용: ${sanitizedPath}`);
        registerSanitized(filePath, sanitizedPath);
      }
      searchLogics[fileType] = new SearchLogic(sanitizedPath);
      try {
        await searchLogics[fileType].load();
      } catch (err) {
        console.error(`[main.js] '${fileType}' 파일 자동 로딩 실패:`, err);
        delete searchLogics[fileType];
      }
    }
  }
  console.log('[main.js] 자동 로딩 완료. 윈도우 생성.');
  createWindow();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// 종료 직전, 소스별 보관 개수 정책을 한 번 더 적용
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

// --- IPC 핸들러 ---

ipcMain.handle('select-file', async (event, fileType) => {
    console.log(`[MAIN.JS LOG] 'select-file' 요청 받음: [${fileType}]`);
    const mainWindow = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(mainWindow, {
        title: `${fileType} 엑셀 파일 선택`,
        properties: ['openFile'],
        filters: [{ name: 'Excel Files', extensions: ['xlsx'] }],
    });

    if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        if (!filePath.toLowerCase().endsWith('.xlsx')) {
            return { success: false, message: '지원되지 않는 형식입니다. .xlsx 파일만 선택해주세요.' };
        }
        FILE_PATHS[fileType] = filePath;
        saveConfig();
        
        console.log(`[MAIN.JS LOG] 새로운 파일 선택됨: ${filePath}. SearchLogic 인스턴스 생성 및 로딩 시작...`);
        // 댓글/메모 자동 정화 후 로딩
        const { sanitizedPath, sanitized } = sanitizeXlsx(filePath);
        if (sanitized) {
          console.log(`[MAIN.JS LOG] 댓글/메모 정화를 수행했습니다. 임시 파일: ${sanitizedPath}`);
          registerSanitized(filePath, sanitizedPath);
        }
        searchLogics[fileType] = new SearchLogic(sanitizedPath);
        try {
            await searchLogics[fileType].load();
            console.log(`[MAIN.JS LOG] [${fileType}] 파일 로딩 성공 완료.`);
            // 기존 watcher가 있으면 해제
            if (fileWatchers[fileType]) {
              await fileWatchers[fileType].close().catch(() => {});
              delete fileWatchers[fileType];
            }
            // 파일 변경 감시 시작(원본 파일 경로 기준)
            const debouncedReload = debounce(async () => {
              try {
                const { sanitizedPath: sp2, sanitized: san2 } = sanitizeXlsx(filePath);
                if (san2) console.log(`[MAIN.JS LOG] 변경 감지 후 정화 파일 생성: ${sp2}`);
                registerSanitized(filePath, sp2);
                const logic = new SearchLogic(sp2);
                await logic.load();
                searchLogics[fileType] = logic;
                if (mainWindowRef && !mainWindowRef.isDestroyed()) {
                  mainWindowRef.webContents.send('data-updated', { type: fileType });
                }
                console.log(`[MAIN.JS LOG] [${fileType}] 변경 사항 반영 완료.`);
              } catch (e) {
                console.error(`[MAIN.JS ERROR] [${fileType}] 변경 반영 중 오류:`, e);
              }
            }, DEBOUNCE_MS);

            const watcher = chokidar.watch(filePath, { ignoreInitial: true });
            watcher.on('change', () => {
              console.log(`[MAIN.JS LOG] 파일 변경 감지: ${filePath}`);
              debouncedReload();
            });
            fileWatchers[fileType] = watcher;
            return { success: true, path: filePath };
        } catch (err) {
            console.error(`[MAIN.JS ERROR] [${fileType}] 새 파일 로딩 중 심각한 오류 발생:`, err);
            delete searchLogics[fileType];
            let msg = err.message || '파일 로딩 실패';
            if (/comments/i.test(msg)) {
              msg += '\n※ 엑셀 파일의 댓글/메모가 포함된 것으로 보입니다. 파일의 댓글/메모를 제거 후 다시 시도하거나, 파일을 새 문서로 복사 저장(.xlsx)해주세요.';
            }
            return { success: false, message: msg };
        }
    }
    console.log(`[MAIN.JS LOG] 파일 선택이 취소되었습니다.`);
    return { success: false, message: '파일 선택이 취소되었습니다.' };
});

ipcMain.handle('get-regions', (event, file_type) => {
    console.log(`[MAIN.JS LOG] 'get-regions' 요청 받음: [${file_type}]`);
    const logic = searchLogics[file_type];

    if (logic && logic.isLoaded()) {
        const regions = logic.getUniqueRegions();
        console.log(`[MAIN.JS LOG] [${file_type}]의 지역 목록 응답:`, regions);
        return { success: true, data: regions };
    } else {
        console.warn(`[MAIN.JS WARN] [${file_type}]에 대한 SearchLogic 인스턴스가 없거나 로드되지 않았습니다.`);
        return { success: true, data: ['전체'] };
    }
});

ipcMain.handle('check-files', () => {
    console.log(`[MAIN.JS LOG] 'check-files' 요청 받음`);
    const statuses = {};
    for (const key in FILE_PATHS) {
      statuses[key] = !!(searchLogics[key] && searchLogics[key].isLoaded());
    }
    return statuses;
});

ipcMain.handle('search-companies', (event, { criteria, file_type }) => {
    console.log(`[MAIN.JS LOG] 'search-companies' 요청 받음:`, { criteria, file_type });
    const logic = searchLogics[file_type];
    if (!logic || !logic.isLoaded()) {
        return { success: false, message: `${file_type} 파일이 로드되지 않았습니다.` };
    }
    const results = logic.search(criteria);
    return { success: true, data: results };
});
