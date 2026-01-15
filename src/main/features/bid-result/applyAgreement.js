const ExcelJS = require('exceljs');
const AdmZip = require('adm-zip');
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

const readXml = (zip, name) => {
  const entry = zip.getEntry(name);
  if (!entry) return '';
  return entry.getData().toString('utf8');
};

const writeXml = (zip, name, content) => {
  zip.deleteFile(name);
  zip.addFile(name, Buffer.from(content, 'utf8'));
};

const buildStyleIds = (stylesXml, baseStyleId) => {
  const xfMatches = stylesXml.match(/<cellXfs[^>]*>[\s\S]*?<\/cellXfs>/);
  if (!xfMatches) throw new Error('스타일 정보를 찾을 수 없습니다.');
  const cellXfsBlock = xfMatches[0];
  const xfList = cellXfsBlock.match(/<xf[^>]*\/>/g) || [];
  const baseXf = xfList[baseStyleId];
  if (!baseXf) throw new Error('기본 스타일을 찾을 수 없습니다.');

  const fillsMatch = stylesXml.match(/<fills[^>]*>[\s\S]*?<\/fills>/);
  if (!fillsMatch) throw new Error('fill 정보를 찾을 수 없습니다.');
  const fillsBlock = fillsMatch[0];
  const fillList = fillsBlock.match(/<fill>[\s\S]*?<\/fill>/g) || [];
  const greenFillId = fillList.length;
  const greenFill = '<fill><patternFill patternType="solid"><fgColor rgb="FF00B050"/></patternFill></fill>';
  const nextFills = fillsBlock.replace(/<\/fills>/, `${greenFill}</fills>`)
    .replace(/count="(\d+)"/, `count="${fillList.length + 1}"`);

  const clearXf = baseXf.replace(/fillId="\\d+"/, 'fillId="0"');
  const greenXf = baseXf.replace(/fillId="\\d+"/, `fillId="${greenFillId}"`);
  const clearStyleId = xfList.length;
  const greenStyleId = xfList.length + 1;
  const nextCellXfs = cellXfsBlock
    .replace(/<\/cellXfs>/, `${clearXf}${greenXf}</cellXfs>`)
    .replace(/count="(\d+)"/, `count="${xfList.length + 2}"`);

  let nextStyles = stylesXml.replace(cellXfsBlock, nextCellXfs);
  nextStyles = nextStyles.replace(fillsBlock, nextFills);

  return {
    stylesXml: nextStyles,
    clearStyleId,
    greenStyleId,
  };
};

const updateSheetStyles = (sheetXml, { baseStyleId, clearStyleId, greenStyleId, lastRow, specialRows, matchedRows }) => {
  return sheetXml.replace(/<c[^>]*r="B(\\d+)"[^>]*>/g, (match, rowStr) => {
    const row = Number(rowStr);
    if (Number.isNaN(row) || row < 14 || row > lastRow) return match;
    let targetStyle = clearStyleId;
    if (matchedRows.has(row)) {
      targetStyle = specialRows.has(row) ? greenStyleId : baseStyleId;
    }
    if (match.includes(' s="')) {
      return match.replace(/ s="\\d+"/, ` s="${targetStyle}"`);
    }
    return match.replace('<c ', `<c s="${targetStyle}" `);
  });
};

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

const parseColumnOnly = (ref = '') => {
  const match = /^([A-Z]+)$/i.exec(ref.trim());
  if (!match) return null;
  return { col: columnToNumber(match[1]) };
};

const parseRange = (ref = '') => {
  const cleaned = ref.replace(/\$/g, '').trim();
  if (!cleaned) return null;
  if (!cleaned.includes(':')) {
    const cell = parseCell(cleaned);
    if (cell) return { start: cell, end: cell };
    const colOnly = parseColumnOnly(cleaned);
    if (colOnly) {
      return { start: { col: colOnly.col, row: 1 }, end: { col: colOnly.col, row: 1048576 } };
    }
    return null;
  }
  const [startRef, endRef] = cleaned.split(':');
  const startCell = parseCell(startRef);
  const endCell = parseCell(endRef);
  if (startCell && endCell) {
    return {
      start: { col: Math.min(startCell.col, endCell.col), row: Math.min(startCell.row, endCell.row) },
      end: { col: Math.max(startCell.col, endCell.col), row: Math.max(startCell.row, endCell.row) },
    };
  }
  const startCol = parseColumnOnly(startRef);
  const endCol = parseColumnOnly(endRef);
  if (startCol && endCol) {
    return {
      start: { col: Math.min(startCol.col, endCol.col), row: 1 },
      end: { col: Math.max(startCol.col, endCol.col), row: 1048576 },
    };
  }
  if (startCell && endCol) {
    return {
      start: { col: Math.min(startCell.col, endCol.col), row: startCell.row },
      end: { col: Math.max(startCell.col, endCol.col), row: 1048576 },
    };
  }
  if (startCol && endCell) {
    return {
      start: { col: Math.min(startCol.col, endCell.col), row: 1 },
      end: { col: Math.max(startCol.col, endCell.col), row: endCell.row },
    };
  }
  return null;
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
    : Array.isArray(worksheet.model?.conditionalFormattings)
      ? worksheet.model.conditionalFormattings
      : [];
  const filtered = list.filter((rule) => !touchesB14(rule?.ref || ''));
  worksheet.conditionalFormattings = filtered;
  if (worksheet.model) {
    worksheet.model.conditionalFormattings = filtered;
  }
  console.log('[bid-result] conditional formats total:', list.length, 'removed:', list.length - filtered.length);
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

  const matchedRows = new Set();
  const specialRows = new Set();
  for (let row = 14; row <= lastRow; row += 1) {
    const rawBiz = getCellText(templateSheet.getCell(row, 3));
    const normalized = normalizeBizNumber(rawBiz);
    if (!normalized || normalized.length !== 10) continue;
    templateValidCount += 1;
    if (!entryMap.has(normalized)) continue;
    matchedRows.add(row);
    if (entryMap.get(normalized)) specialRows.add(row);
    matchedCount += 1;
    if (matchLogCount < 5) {
      console.log('[bid-result] match', { row, biz: normalized, special: entryMap.get(normalized) });
      matchLogCount += 1;
    }
  }
  console.log('[bid-result] template valid:', templateValidCount, 'matched:', matchedCount);
  const sheetId = templateSheet.id || 1;
  const sheetPath = `xl/worksheets/sheet${sheetId}.xml`;
  const zip = new AdmZip(templatePath);
  const sheetXml = readXml(zip, sheetPath);
  if (!sheetXml) throw new Error('시트 XML을 찾을 수 없습니다.');
  const baseMatch = sheetXml.match(/<c[^>]*r="B14"[^>]*s="(\\d+)"[^>]*>/);
  const baseStyleId = baseMatch ? Number(baseMatch[1]) : 0;
  const stylesXml = readXml(zip, 'xl/styles.xml');
  const { stylesXml: nextStyles, clearStyleId, greenStyleId } = buildStyleIds(stylesXml, baseStyleId);
  const nextSheetXml = updateSheetStyles(sheetXml, {
    baseStyleId,
    clearStyleId,
    greenStyleId,
    lastRow,
    specialRows,
    matchedRows,
  });
  writeXml(zip, 'xl/styles.xml', nextStyles);
  writeXml(zip, sheetPath, nextSheetXml);
  zip.writeZip(templatePath);
  return { path: templatePath, matchedCount, scannedCount: entryMap.size };
};

module.exports = { applyAgreementToTemplate };
