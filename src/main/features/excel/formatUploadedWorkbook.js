const ExcelJS = require('exceljs');
const { sanitizeXlsx } = require('../../../../utils/sanitizeXlsx');

const isEmptyCell = (cell) => {
  if (!cell) return true;
  const value = cell.value;
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  return false;
};

const setFontSize = (cell, size) => {
  if (!cell) return;
  const target = cell.isMerged && cell.master ? cell.master : cell;
  if (!target) return;
  const nextFont = { ...(target.font || {}), size };
  target.font = nextFont;
  target.style = { ...(target.style || {}), font: { ...(target.style?.font || {}), size } };
  if (target.value && Array.isArray(target.value.richText)) {
    target.value = {
      ...target.value,
      richText: target.value.richText.map((part) => ({
        ...part,
        font: { ...(part.font || {}), size },
      })),
    };
  }
};

const cloneFont = (font) => {
  if (!font) return font;
  try { return JSON.parse(JSON.stringify(font)); } catch { return font; }
};

const getCellText = (cell) => {
  if (!cell) return '';
  if (cell.text !== undefined && cell.text !== null && String(cell.text).length) {
    return String(cell.text);
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

const autoFitColumn = (worksheet, columnNumber, maxRow, { minWidth = 10, maxWidth = 60 } = {}) => {
  let maxLen = 0;
  for (let row = 1; row <= maxRow; row += 1) {
    const text = getCellText(worksheet.getCell(row, columnNumber));
    if (!text) continue;
    const lineLen = Math.max(...text.split('\n').map((line) => line.length));
    if (lineLen > maxLen) maxLen = lineLen;
  }
  const width = Math.min(maxWidth, Math.max(minWidth, maxLen + 2));
  worksheet.getColumn(columnNumber).width = width;
};

const autoFitDiffColumn = (worksheet, maxRow, { minWidth = 8, maxWidth = 20 } = {}) => {
  let maxLen = 0;
  for (let row = 15; row <= maxRow; row += 1) {
    const current = worksheet.getCell(row, 5).value;
    const prev = worksheet.getCell(row - 1, 5).value;
    const currentNum = typeof current === 'number' ? current : Number(String(current || '').replace(/[^0-9.\-]/g, ''));
    const prevNum = typeof prev === 'number' ? prev : Number(String(prev || '').replace(/[^0-9.\-]/g, ''));
    if (!Number.isFinite(currentNum) || !Number.isFinite(prevNum)) continue;
    const diff = currentNum - prevNum;
    const text = diff.toLocaleString('en-US');
    if (text.length > maxLen) maxLen = text.length;
  }
  const width = Math.min(maxWidth, Math.max(minWidth, maxLen + 2));
  worksheet.getColumn(16).width = width;
};

const findLastDataRow = (worksheet) => {
  const maxRow = Math.max(worksheet.rowCount, 14);
  let lastRow = 0;
  for (let row = 14; row <= maxRow; row += 1) {
    const cell = worksheet.getCell(row, 2); // Column B
    const text = getCellText(cell).trim();
    if (text || !isEmptyCell(cell)) lastRow = row;
  }
  return lastRow || 13;
};

const formatUploadedWorkbook = async ({ sourcePath, outputPath }) => {
  if (!sourcePath) throw new Error('엑셀 파일 경로가 필요합니다.');
  if (!outputPath) throw new Error('저장할 경로가 필요합니다.');

  const { sanitizedPath } = sanitizeXlsx(sourcePath);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(sanitizedPath);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error('엑셀 시트를 찾을 수 없습니다.');

  const lastDataRow = findLastDataRow(worksheet);
  const preservedFonts = new Map();
  if (lastDataRow >= 14) {
    for (let row = 14; row <= lastDataRow; row += 1) {
      for (let col = 1; col <= 16; col += 1) {
        if (col === 4 || col === 5 || col === 16) continue;
        const font = worksheet.getCell(row, col).font;
        if (font) preservedFonts.set(`${row}:${col}`, cloneFont(font));
      }
    }
  }

  for (let row = 5; row <= 10; row += 1) {
    for (let col = 2; col <= 13; col += 1) {
      setFontSize(worksheet.getCell(row, col), 11);
    }
  }

  setFontSize(worksheet.getCell('B3'), 12);
  setFontSize(worksheet.getCell('K3'), 12);

  if (lastDataRow >= 14) {
    for (let row = 14; row <= lastDataRow; row += 1) {
      setFontSize(worksheet.getCell(row, 4), 12); // D
      setFontSize(worksheet.getCell(row, 5), 12); // E
      worksheet.getRow(row).height = 25;
    }
  }

  worksheet.getColumn('N').hidden = true;

  if (lastDataRow >= 15) {
    for (let row = 15; row <= lastDataRow; row += 1) {
      const cell = worksheet.getCell(row, 16);
      cell.value = { formula: `E${row}-E${row - 1}` };
      cell.numFmt = '#,##0';
      cell.font = { ...(cell.font || {}), size: 12, bold: true };
    }
  }

  const maxAutoRow = Math.max(lastDataRow, worksheet.rowCount);
  autoFitColumn(worksheet, 15, maxAutoRow); // O
  autoFitDiffColumn(worksheet, maxAutoRow); // P

  preservedFonts.forEach((font, key) => {
    const [row, col] = key.split(':').map(Number);
    worksheet.getCell(row, col).font = font;
  });

  workbook.calcProperties = {
    ...(workbook.calcProperties || {}),
    fullCalcOnLoad: true,
  };

  await workbook.xlsx.writeFile(outputPath);
  return { path: outputPath };
};

module.exports = { formatUploadedWorkbook };
