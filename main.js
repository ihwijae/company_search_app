// main.js (문법 오류를 수정한 최종 버전)

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { SearchLogic } = require('./searchLogic.js');

// --- 설정 ---
const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');
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
const isDev = process.env.NODE_ENV !== 'production';

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

app.whenReady().then(async () => {
  console.log('[main.js] 앱 준비 완료. 저장된 파일 경로 자동 로딩 시작...');
  for (const fileType in FILE_PATHS) {
    const filePath = FILE_PATHS[fileType];
    if (filePath && fs.existsSync(filePath)) {
      console.log(`[main.js] '${fileType}' 파일 로딩 시도: ${filePath}`);
      searchLogics[fileType] = new SearchLogic(filePath);
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

// --- IPC 핸들러 ---

ipcMain.handle('select-file', async (event, fileType) => {
    console.log(`[MAIN.JS LOG] 'select-file' 요청 받음: [${fileType}]`);
    const mainWindow = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(mainWindow, {
        title: `${fileType} 엑셀 파일 선택`,
        properties: ['openFile'],
        filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }],
    });

    if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        FILE_PATHS[fileType] = filePath;
        saveConfig();
        
        console.log(`[MAIN.JS LOG] 새로운 파일 선택됨: ${filePath}. SearchLogic 인스턴스 생성 및 로딩 시작...`);
        searchLogics[fileType] = new SearchLogic(filePath);
        try {
            await searchLogics[fileType].load();
            console.log(`[MAIN.JS LOG] [${fileType}] 파일 로딩 성공 완료.`);
            return { success: true, path: filePath };
        } catch (err) {
            console.error(`[MAIN.JS ERROR] [${fileType}] 새 파일 로딩 중 심각한 오류 발생:`, err);
            delete searchLogics[fileType];
            return { success: false, message: err.message };
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