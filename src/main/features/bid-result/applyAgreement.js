const ExcelJS = require('exceljs');
const { sanitizeXlsx } = require('../../../../utils/sanitizeXlsx');

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

const normalizeBizNumber = (value) => String(value || '').replace(/[^0-9]/g, '');

const columnToNumber = (letters = '') => {
  let num = 0;
  for (let i = 0; i < letters.length; i += 1) {
    const code = letters.toUpperCase().charCodeAt(i) - 64;
    if (code < 1 || code > 26) continue;
    num = num * 26 + code;
  }
  return num;
};

const parseCell = (ref = '') => {
  const match = /^([A-Z]+)(\d+)$/i.exec(ref.trim());
  if (!match) return null;
  return {
    col: columnToNumber(match[1]),
    row: Number(match[2]),
  };
};

const parseRange = (ref = '') => {
  const cleaned = ref.replace(/\$/g, '').trim();
  if (!cleaned) return null;
  if (!cleaned.includes(':')) {
    const cell = parseCell(cleaned);
    return cell ? { start: cell, end: cell } : null;
  }
  const [startRef, endRef] = cleaned.split(':');
  const start = parseCell(startRef);
  const end = parseCell(endRef);
  if (!start || !end) return null;
  return {
    start: { col: Math.min(start.col, end.col), row: Math.min(start.row, end.row) },
    end: { col: Math.max(start.col, end.col), row: Math.max(start.row, end.row) },
  };
};

const touchesB14 = (ref = '') => {
  const tokens = ref.split(/\s+/).filter(Boolean);
  const targetCol = 2; // B
  for (const token of tokens) {
    const range = parseRange(token);
    if (!range) continue;
    if (range.end.col < targetCol || range.start.col > targetCol) continue;
    if (range.end.row < 14) continue;
    return true;
  }
  return false;
};

const removeConditionalFormatting = (worksheet) => {
  const list = Array.isArray(worksheet.conditionalFormattings)
    ? worksheet.conditionalFormattings
    : [];
  const filtered = list.filter((rule) => !touchesB14(rule?.ref || ''));
  worksheet.conditionalFormattings = filtered;
  if (worksheet.model) {
    worksheet.model.conditionalFormattings = filtered;
  }
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

const applyAgreementToTemplate = async ({ templatePath, entries = [] }) => {
  if (!templatePath) throw new Error('파일 경로가 필요합니다.');
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('협정파일에서 매칭할 사업자번호가 없습니다.');
  }

  const { sanitizedPath: templateSanitized } = sanitizeXlsx(templatePath);

  const templateWorkbook = new ExcelJS.Workbook();
  await templateWorkbook.xlsx.readFile(templateSanitized);
  const templateSheet = templateWorkbook.worksheets[0];
  if (!templateSheet) throw new Error('개찰결과 파일 시트를 찾을 수 없습니다.');

  removeConditionalFormatting(templateSheet);

  const entryMap = new Map();
  entries.forEach((entry) => {
    const normalized = normalizeBizNumber(entry?.bizNo);
    if (!normalized || normalized.length !== 10) return;
    const existing = entryMap.get(normalized);
    if (existing) {
      entryMap.set(normalized, existing || entry?.special);
    } else {
      entryMap.set(normalized, Boolean(entry?.special));
    }
  });

  const lastRow = findLastDataRow(templateSheet);
  let matchedCount = 0;
  let templateValidCount = 0;
  let matchLogCount = 0;
  console.log('[bid-result] entries size:', entries.length, 'normalized:', entryMap.size);
  for (let row = 14; row <= lastRow; row += 1) {
    templateSheet.getCell(row, 2).fill = CLEAR_FILL;
  }
  for (let row = 14; row <= lastRow; row += 1) {
    const rawBiz = getCellText(templateSheet.getCell(row, 3));
    const normalized = normalizeBizNumber(rawBiz);
    if (!normalized || normalized.length !== 10) continue;
    templateValidCount += 1;
    if (!entryMap.has(normalized)) continue;
    const targetCell = templateSheet.getCell(row, 2); // B
    targetCell.fill = entryMap.get(normalized) ? SPECIAL_FILL : DEFAULT_FILL;
    matchedCount += 1;
    if (matchLogCount < 5) {
      console.log('[bid-result] match', { row, biz: normalized, special: entryMap.get(normalized) });
      matchLogCount += 1;
    }
  }
  console.log('[bid-result] template valid:', templateValidCount, 'matched:', matchedCount);

  await templateWorkbook.xlsx.writeFile(templatePath);
  return { path: templatePath, matchedCount, scannedCount: entryMap.size };
};

module.exports = { applyAgreementToTemplate };
