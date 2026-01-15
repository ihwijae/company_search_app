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

const findLastDataRow = (worksheet) => {
  const maxRow = Math.max(worksheet.rowCount, 14);
  let lastRow = 0;
  for (let row = 14; row <= maxRow; row += 1) {
    const text = getCellText(worksheet.getCell(row, 2)).trim();
    if (text) lastRow = row;
  }
  return lastRow || 13;
};

const buildTemplateBizMap = (worksheet) => {
  const map = new Map();
  const lastRow = findLastDataRow(worksheet);
  for (let row = 14; row <= lastRow; row += 1) {
    const raw = getCellText(worksheet.getCell(row, 3));
    const normalized = normalizeBizNumber(raw);
    if (!normalized) continue;
    if (!map.has(normalized)) map.set(normalized, row);
  }
  return map;
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

  const templateMap = buildTemplateBizMap(templateSheet);
  let matchedCount = 0;
  const scannedCount = entries.length;

  entries.forEach((entry) => {
    const normalized = normalizeBizNumber(entry?.bizNo);
    if (!normalized) return;
    const targetRow = templateMap.get(normalized);
    if (!targetRow) return;
    const targetCell = templateSheet.getCell(targetRow, 2); // B
    targetCell.fill = entry?.special ? SPECIAL_FILL : DEFAULT_FILL;
    matchedCount += 1;
  });

  await templateWorkbook.xlsx.writeFile(templatePath);
  return { path: templatePath, matchedCount, scannedCount };
};

module.exports = { applyAgreementToTemplate };
