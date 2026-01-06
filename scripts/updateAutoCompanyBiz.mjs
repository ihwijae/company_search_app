import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const CONFIG_PATH = path.resolve(ROOT, 'src/shared/autoCompanyPresets.js');
const EXCEL_DIR = path.resolve(ROOT, '원본엑셀');

const normalizeName = (name = '') => name
  .replace(/[\s·.,\-\/]/g, '')
  .replace(/주식회사|유한회사|합자회사|재단법인|사단법인/gi, '')
  .replace(/\(주\)|\(유\)|\(합\)|\(재\)|\(사\)|㈜|㈔/gi, '')
  .toLowerCase();

const formatBizNo = (value = '') => {
  const digits = String(value).replace(/[^0-9]/g, '');
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
  }
  return digits;
};

const loadWorkbookVendors = (filePath) => {
  const result = new Map();
  const wb = XLSX.readFile(filePath);
  wb.SheetNames.forEach((sheetName) => {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });
    let currentNames = null;
    rows.forEach((row) => {
      if (!row || !row.length) return;
      const labelRaw = String(row[0] || '').trim();
      if (!labelRaw) {
        currentNames = null;
        return;
      }
      if (labelRaw.includes('회사명')) {
        currentNames = row;
        return;
      }
      if (labelRaw.includes('사업자번호') && currentNames) {
        for (let col = 1; col < row.length; col += 1) {
          const name = String(currentNames[col] || '').trim();
          const biz = String(row[col] || '').trim();
          if (!name || !biz) continue;
          const key = normalizeName(name);
          if (!key) continue;
          const formattedBiz = formatBizNo(biz);
          if (!formattedBiz) continue;
          if (!result.has(key)) {
            result.set(key, { name, bizNo: formattedBiz });
          }
        }
      }
    });
  });
  return result;
};

const collectVendors = () => {
  const vendorMap = new Map();
  if (!fs.existsSync(EXCEL_DIR)) {
    console.error('[updateAutoCompanyBiz] 원본엑셀 폴더를 찾을 수 없습니다:', EXCEL_DIR);
    process.exit(1);
  }
  const files = fs.readdirSync(EXCEL_DIR).filter((file) => file.toLowerCase().endsWith('.xlsx'));
  if (!files.length) {
    console.error('[updateAutoCompanyBiz] 엑셀 파일이 없습니다.');
    process.exit(1);
  }
  files.forEach((file) => {
    const fullPath = path.join(EXCEL_DIR, file);
    const sheetVendors = loadWorkbookVendors(fullPath);
    sheetVendors.forEach((value, key) => {
      if (!vendorMap.has(key)) {
        vendorMap.set(key, value);
      }
    });
  });
  return vendorMap;
};

const loadConfig = async () => {
  const moduleUrl = pathToFileURL(CONFIG_PATH).href;
  const imported = await import(moduleUrl);
  const config = imported?.default || imported;
  if (!config || typeof config !== 'object') {
    throw new Error('Config를 불러오지 못했습니다.');
  }
  return JSON.parse(JSON.stringify(config));
};

const updateConfigBizNos = (config, vendorMap) => {
  const updatedNames = [];
  const missingNames = [];
  Object.entries(config.regions || {}).forEach(([, industries]) => {
    Object.entries(industries || {}).forEach(([, entries]) => {
      entries.forEach((entry) => {
        if (!entry || !entry.name) return;
        if (entry.bizNo) return;
        const key = normalizeName(entry.name);
        const vendor = vendorMap.get(key);
        if (vendor) {
          entry.bizNo = vendor.bizNo;
          updatedNames.push(entry.name);
        } else {
          missingNames.push(entry.name);
        }
      });
    });
  });
  return { config, updatedNames, missingNames };
};

const writeConfig = (config) => {
  const banner = 'const AUTO_COMPANY_PRESETS = ';
  const serialized = JSON.stringify(config, null, 2);
  const footer = '\nexport default AUTO_COMPANY_PRESETS;\n';
  fs.writeFileSync(CONFIG_PATH, `${banner}${serialized};${footer}`);
};

(async () => {
  try {
    const vendorMap = collectVendors();
    console.log(`[updateAutoCompanyBiz] 총 ${vendorMap.size}개 업체 정보를 수집했습니다.`);
    const config = await loadConfig();
    const { updatedNames, missingNames } = updateConfigBizNos(config, vendorMap);
    writeConfig(config);
    console.log(`[updateAutoCompanyBiz] bizNo를 추가한 업체 수: ${updatedNames.length}`);
    if (missingNames.length) {
      console.warn('[updateAutoCompanyBiz] 사업자번호를 찾지 못한 업체:', missingNames.slice(0, 20));
      if (missingNames.length > 20) {
        console.warn(`...총 ${missingNames.length}건 미매칭`);
      }
    }
  } catch (error) {
    console.error('[updateAutoCompanyBiz] 실행 실패:', error);
    process.exit(1);
  }
})();
