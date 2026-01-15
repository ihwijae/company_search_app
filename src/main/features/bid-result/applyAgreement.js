const ExcelJS = require('exceljs');
const { sanitizeXlsx } = require('../../../../utils/sanitizeXlsx');

const SPECIAL_NAMES = ['조정', '서권형', '구본진'];
const SPECIAL_FILL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF00B050' },
};
const DEFAULT_FILL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF00B0F0' },
};
const CLEAR_FILL = { type: 'pattern', pattern: 'none' };
const HIGHLIGHT_ARGB = new Set(['FF00B050', 'FF00B0F0']);

const getCellText = (cell) => {
  if (!cell) return '';
  if (cell.text !== undefined && cell.text !== null) {
    const text = String(cell.text);
    if (text) return text;
  }
  const value = cell.value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if (Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text || '').join('');
    }
    if (value.formula) {
      return value.result !== undefined && value.result !== null ? String(value.result) : '';
    }
    if (value.text) return String(value.text);
    if (value.hyperlink) return String(value.text || value.hyperlink);
    return '';
  }
  return String(value);
};

const normalizeName = (value) => {
  let name = String(value || '').replace(/\s+/g, '').toLowerCase();
  name = name.replace(/^(주|\(주\)|㈜|주\)|\(합\))/, '');
  name = name.replace(/(주|\(주\)|㈜|주\)|\(합\))$/, '');
  name = name.replace(/이앤/g, '이엔');
  name = name.replace(/앤/g, '엔');
  name = name.replace(/[^a-zA-Z0-9가-힣]/g, '');
  return name;
};

const COMMON_SURNAMES = new Set([
  '김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황',
  '안', '송', '류', '유', '홍', '전', '민', '구', '우', '문', '양', '손', '배', '백', '허', '노',
  '심', '하', '곽', '성', '차', '주', '우', '채', '남', '원', '방', '표', '변', '염', '여', '석',
  '설', '선', '현', '나', '진', '지', '위', '도', '연', '길', '엄', '복', '제', '탁', '공', '기',
]);
const COMPANY_SUFFIX_DENY = new Set([
  '건설', '공사', '전기', '전력', '토건', '토목', '산업', '정보', '통신', '소방', '기술', '기계', '기전', '기공',
  '환경', '시스템', '테크', '설비', '전설', '플랜트', '이엔지', '이엔씨', '엔지', '엔씨', '건축',
]);
const CORPORATE_PREFIX_PATTERN = /(주식회사|유한회사|농업회사법인|사단법인|재단법인|합자회사|합명회사|법인)$/;
const TRAILING_HANJA_PATTERN = /[\u3400-\u9FFF\uF900-\uFAFF]+$/u;
const JOB_TITLE_TOKENS = new Set(['부장', '차장', '과장', '팀장', '대리', '대표', '실장', '소장', '이사', '사장', '전무', '상무', '부사장', '주임', '사원']);

const looksLikePersonName = (token) => {
  if (!token) return false;
  const normalized = token.replace(/[^가-힣]/g, '');
  if (!/^[가-힣]{2,3}$/.test(normalized)) return false;
  if (!COMMON_SURNAMES.has(normalized[0])) return false;
  if (COMPANY_SUFFIX_DENY.has(normalized)) return false;
  for (const suffix of COMPANY_SUFFIX_DENY) {
    if (suffix && suffix !== normalized && normalized.endsWith(suffix)) return false;
  }
  return true;
};

const stripTrailingPersonSuffix = (text) => {
  if (!text) return '';
  const normalized = text.replace(/[^가-힣]/g, '');
  if (normalized.length <= 3) return text;
  for (let len = 3; len >= 2; len -= 1) {
    const suffix = normalized.slice(-len);
    if (!looksLikePersonName(suffix)) continue;
    const prefix = normalized.slice(0, -len);
    if (!prefix || prefix.length < 3) continue;
    if (looksLikePersonName(prefix) && prefix.length <= 3) continue;
    const idx = text.lastIndexOf(suffix);
    if (idx > 0) {
      const candidate = text.slice(0, idx).trim();
      if (candidate) return candidate;
    }
  }
  return text;
};

const cleanCompanyName = (rawName) => {
  if (!rawName) return '';
  const original = String(rawName);
  let primary = original.split('\n')[0];
  primary = primary.replace(/\r/g, '');
  const hasDelimiterHints = /[0-9_%]/.test(primary) || /[_\n\r]/.test(original);
  primary = primary.replace(/\s*[\d.,%][\s\S]*$/, '');
  primary = primary.split('_')[0];
  let trimmed = primary.replace(/\s+/g, ' ').trim();
  if (!trimmed) return '';

  let tokens = trimmed.split(' ').filter(Boolean);
  while (tokens.length > 1) {
    const last = tokens[tokens.length - 1];
    const normalized = last.replace(/[^가-힣]/g, '');
    if (!normalized) {
      tokens.pop();
      continue;
    }
    if (JOB_TITLE_TOKENS.has(normalized)) {
      tokens.pop();
      continue;
    }
    const precedingRaw = tokens.slice(0, -1).join(' ').trim();
    if (!precedingRaw) break;
    const precedingNormalized = precedingRaw.replace(/[^가-힣]/g, '');
    if (!looksLikePersonName(normalized)) break;
    if (CORPORATE_PREFIX_PATTERN.test(precedingNormalized)) break;
    tokens.pop();
    break;
  }
  let result = tokens.join(' ').trim();
  if (tokens.length <= 1 && hasDelimiterHints) {
    result = stripTrailingPersonSuffix(result);
  }
  if (hasDelimiterHints) {
    const strippedHanja = result.replace(TRAILING_HANJA_PATTERN, '').trim();
    if (strippedHanja && strippedHanja !== result && /[a-zA-Z0-9가-힣]/.test(strippedHanja)) {
      result = strippedHanja;
    }
  }
  return result;
};

const buildRerunNameCandidates = (name) => {
  if (!name) return [];
  const base = String(name).trim();
  if (!base) return [];
  const variants = new Set();
  const swapToAen = base.replace(/이엔/g, '이앤');
  if (swapToAen !== base) variants.add(swapToAen);
  const swapToEn = base.replace(/이앤/g, '이엔');
  if (swapToEn !== base) variants.add(swapToEn);
  return Array.from(variants);
};

const hasSpecialName = (raw) => {
  const normalized = String(raw || '').replace(/\s+/g, '');
  return SPECIAL_NAMES.some((token) => normalized.includes(token));
};

const findLastDataRow = (worksheet) => {
  const maxRow = Math.max(worksheet.rowCount, 14);
  let lastRow = 0;
  for (let row = 14; row <= maxRow; row += 1) {
    const text = getCellText(worksheet.getCell(row, 2)).trim();
    if (text) lastRow = row;
  }
  return lastRow || 13;
};

const buildTemplateNameMap = (worksheet) => {
  const map = new Map();
  const lastRow = findLastDataRow(worksheet);
  for (let row = 14; row <= lastRow; row += 1) {
    const raw = getCellText(worksheet.getCell(row, 4));
    const cleaned = cleanCompanyName(raw);
    const normalized = normalizeName(cleaned);
    if (!normalized) continue;
    const entry = {
      row,
      cleaned,
      compact: cleaned.replace(/\s+/g, ''),
    };
    if (!map.has(normalized)) {
      map.set(normalized, [entry]);
    } else {
      map.get(normalized).push(entry);
    }
  }
  return map;
};

const applyAgreementToTemplate = async ({ templatePath, agreementPath, sheetName }) => {
  if (!templatePath || !agreementPath) throw new Error('파일 경로가 필요합니다.');
  if (!sheetName) throw new Error('협정파일 시트를 선택하세요.');

  const { sanitizedPath: templateSanitized } = sanitizeXlsx(templatePath);
  const { sanitizedPath: agreementSanitized } = sanitizeXlsx(agreementPath);

  const templateWorkbook = new ExcelJS.Workbook();
  await templateWorkbook.xlsx.readFile(templateSanitized);
  const templateSheet = templateWorkbook.worksheets[0];
  if (!templateSheet) throw new Error('개찰결과 파일 시트를 찾을 수 없습니다.');

  const agreementWorkbook = new ExcelJS.Workbook();
  await agreementWorkbook.xlsx.readFile(agreementSanitized);
  const agreementSheet = agreementWorkbook.getWorksheet(sheetName);
  if (!agreementSheet) throw new Error('협정파일 시트를 찾을 수 없습니다.');

  const templateMap = buildTemplateNameMap(templateSheet);
  const templateLastRow = findLastDataRow(templateSheet);
  for (let row = 14; row <= templateLastRow; row += 1) {
    const cell = templateSheet.getCell(row, 2);
    const fill = cell.fill;
    const argb = fill?.fgColor?.argb;
    if (fill?.pattern === 'solid' && HIGHLIGHT_ARGB.has(argb)) {
      cell.fill = CLEAR_FILL;
    }
  }
  const maxRow = agreementSheet.rowCount;
  let matchedCount = 0;
  let scannedCount = 0;
  for (let row = 5; row <= maxRow; row += 2) {
    const cell = agreementSheet.getCell(row, 3); // C
    const rawName = getCellText(cell).trim();
    if (!rawName) break;
    const special = hasSpecialName(rawName);
    const cleaned = cleanCompanyName(rawName);
    const normalized = normalizeName(cleaned);
    const compact = cleaned.replace(/\s+/g, '');
    if (!normalized || compact.length < 2) continue;
    scannedCount += 1;

    const candidates = templateMap.get(normalized);
    let targetRow = null;
    if (!candidates || candidates.length === 0) {
      for (const candidate of buildRerunNameCandidates(cleaned)) {
        const rerun = templateMap.get(normalizeName(candidate));
        if (rerun && rerun.length) {
          targetRow = rerun[0].row;
          break;
        }
      }
    } else if (candidates.length === 1) {
      targetRow = candidates[0].row;
    } else {
      const exact = candidates.find((item) => item.compact === compact);
      targetRow = exact ? exact.row : candidates[0].row;
    }
    if (!targetRow) continue;

    const targetCell = templateSheet.getCell(targetRow, 2); // B
    targetCell.fill = special ? SPECIAL_FILL : DEFAULT_FILL;
    matchedCount += 1;
  }

  await templateWorkbook.xlsx.writeFile(templatePath);
  return { path: templatePath, matchedCount, scannedCount };
};

module.exports = { applyAgreementToTemplate };
