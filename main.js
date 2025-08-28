// main.js (중복 코드가 제거된 최종 버전)

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
    }
  } catch (err) {
    console.error('설정 파일 로딩 실패:', err);
  }
}

function saveConfig() {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(FILE_PATHS, null, 2));
    console.log('설정이 저장되었습니다:', CONFIG_PATH);
  } catch (err) {
    console.error('설정 파일 저장 실패:', err);
  }
}

loadConfig();
// ---

const searchLogics = {};
for (const key in FILE_PATHS) {
    if (FILE_PATHS[key]) {
        searchLogics[key] = new SearchLogic(FILE_PATHS[key]);
    }
}

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
    // mainWindow.webContents.openDevTools(); // 개발자 도구는 필요할 때만 주석 해제
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

app.whenReady().then(async () => {
  for (const key in searchLogics) {
    try {
      if (FILE_PATHS[key] && fs.existsSync(FILE_PATHS[key])) {
        await searchLogics[key].load();
        console.log(`${key} 파일 로딩 성공: ${FILE_PATHS[key]}`);
      }
    } catch (err) {
      console.error(`${key} 파일 로딩 실패:`, err.message);
    }
  }
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// --- IPC 핸들러 ---

ipcMain.handle('search-companies', (event, { criteria, file_type }) => {
  try {
    const logic = searchLogics[file_type];
    if (!logic || !logic.isLoaded()) {
      throw new Error(`${file_type} 파일이 로드되지 않았습니다. 먼저 경로를 설정해주세요.`);
    }
    const results = logic.search(criteria);
     // [로그 추가] 백엔드가 보내려는 시트 목록을 터미널에 출력합니다.
    console.log(`[백엔드 LOG] '${file_type}'의 지역 목록을 프론트엔드로 보냅니다:`, regions);

    return { success: true, data: results };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('check-files', () => {
  const statuses = {};
  for (const key in FILE_PATHS) {
    statuses[key] = !!(FILE_PATHS[key] && fs.existsSync(FILE_PATHS[key]));
  }
  return statuses;
});

ipcMain.handle('get-regions', async (event, file_type) => {
    try {
        const logic = searchLogics[file_type];
        if (!logic || !logic.isLoaded()) {
             throw new Error(`${file_type} 파일을 먼저 설정하고 로드해주세요.`);
        }
        const regions = logic.getUniqueRegions();
        return { success: true, data: regions };
    } catch (error) {
        return { success: false, message: error.message };
    }
});

ipcMain.handle('select-file', async (event, fileType) => {
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

        searchLogics[fileType] = new SearchLogic(filePath);
        try {
            await searchLogics[fileType].load();
            console.log(`새로운 ${fileType} 파일 로딩 성공: ${filePath}`);
            return { success: true, path: filePath };
        } catch (err) {
            console.error('새 파일 로딩 실패:', err);
            return { success: false, message: err.message };
        }
    }
    return { success: false, message: '파일 선택이 취소되었습니다.' };
});