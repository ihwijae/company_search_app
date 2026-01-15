const ExcelJS = require('exceljs');
const AdmZip = require('adm-zip');
const { sanitizeXlsx } = require('../../../../utils/sanitizeXlsx');

const readXml = (zip, name) => {
  const entry = zip.getEntry(name);
  if (!entry) return '';
  return entry.getData().toString('utf8');
};

const writeXml = (zip, name, content) => {
  zip.deleteFile(name);
  zip.addFile(name, Buffer.from(content, 'utf8'));
};

const resolveSheetPath = (zip, sheetName) => {
  const workbookXml = readXml(zip, 'xl/workbook.xml');
  const relsXml = readXml(zip, 'xl/_rels/workbook.xml.rels');
  if (!workbookXml || !relsXml) return '';
  const sheetMatch = new RegExp(`<sheet[^>]*name="${sheetName.replace(/[-/\\\\^$*+?.()|[\\]{}]/g, '\\\\$&')}"[^>]*>`);
  const sheetTag = workbookXml.match(sheetMatch);
  if (!sheetTag) return '';
  const ridMatch = sheetTag[0].match(/r:id="([^"]+)"/);
  if (!ridMatch) return '';
  const rid = ridMatch[1];
  const relMatch = new RegExp(`<Relationship[^>]*Id="${rid}"[^>]*>`);
  const relTag = relsXml.match(relMatch);
  if (!relTag) return '';
  const targetMatch = relTag[0].match(/Target="([^"]+)"/);
  if (!targetMatch) return '';
  const target = targetMatch[1];
  return target.startsWith('xl/') ? target : `xl/${target}`;
};

const fallbackSheetPath = (zip) => {
  const entries = zip.getEntries().map((entry) => entry.entryName);
  const sheetRe = new RegExp('^xl/worksheets/sheet\\d+\\.xml$', 'i');
  const sheet = entries.find((name) => sheetRe.test(name));
  return sheet || '';
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

const normalizeSequence = (value) => {
  const digits = String(value || '').replace(/[^0-9]/g, '');
  if (!digits) return null;
  const parsed = Number.parseInt(digits, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const findLastDataRow = (worksheet, columnIndex = 2) => {
  const maxRow = Math.max(worksheet.rowCount, 14);
  let lastRow = 0;
  for (let row = 14; row <= maxRow; row += 1) {
    const text = getCellText(worksheet.getCell(row, columnIndex)).trim();
    if (text) lastRow = row;
  }
  return lastRow || 13;
};

const buildFillStyle = (stylesXml, baseStyleId, fillRgb) => {
  const xfMatches = stylesXml.match(/<cellXfs[^>]*>[\s\S]*?<\/cellXfs>/);
  if (!xfMatches) throw new Error('스타일 정보를 찾을 수 없습니다.');
  const cellXfsBlock = xfMatches[0];
  const xfList = cellXfsBlock.match(/<xf[^>]*\/>|<xf[^>]*>[\s\S]*?<\/xf>/g) || [];
  const baseXf = xfList[baseStyleId] || xfList[0];
  if (!baseXf) throw new Error('기본 스타일을 찾을 수 없습니다.');

  const fillsMatch = stylesXml.match(/<fills[^>]*>[\s\S]*?<\/fills>/);
  if (!fillsMatch) throw new Error('fill 정보를 찾을 수 없습니다.');
  const fillsBlock = fillsMatch[0];
  const fillList = fillsBlock.match(/<fill>[\s\S]*?<\/fill>/g) || [];
  const fillId = fillList.length;
  const fill = `<fill><patternFill patternType="solid"><fgColor rgb="${fillRgb}"/></patternFill></fill>`;
  const nextFills = fillsBlock.replace(/<\/fills>/, `${fill}</fills>`)
    .replace(/count="(\d+)"/, `count="${fillList.length + 1}"`);

  const setFillId = (xf, id) => {
    let next = xf;
    if (/fillId=/.test(next)) {
      next = next.replace(/fillId="\d+"/, `fillId="${id}"`);
    } else {
      next = next.replace('<xf ', `<xf fillId="${id}" `);
    }
    if (/applyFill=/.test(next)) {
      next = next.replace(/applyFill="\d+"/, 'applyFill="1"');
    } else {
      next = next.replace('<xf ', '<xf applyFill="1" ');
    }
    return next;
  };

  const redXf = setFillId(baseXf, fillId);
  const styleId = xfList.length;
  const nextCellXfs = cellXfsBlock
    .replace(/<\/cellXfs>/, `${redXf}</cellXfs>`)
    .replace(/count="(\d+)"/, `count="${xfList.length + 1}"`);

  let nextStyles = stylesXml.replace(cellXfsBlock, nextCellXfs);
  nextStyles = nextStyles.replace(fillsBlock, nextFills);

  return { stylesXml: nextStyles, styleId };
};

const buildRedFontStyle = (stylesXml, baseStyleId) => {
  const fontsMatch = stylesXml.match(/<fonts[^>]*>[\s\S]*?<\/fonts>/);
  if (!fontsMatch) throw new Error('font 정보를 찾을 수 없습니다.');
  const fontsBlock = fontsMatch[0];
  const fontList = fontsBlock.match(/<font>[\s\S]*?<\/font>/g) || [];
  const redFont = '<font><b/><color rgb="FFFF0000"/></font>';
  const fontId = fontList.length;
  const nextFonts = fontsBlock.replace(/<\/fonts>/, `${redFont}</fonts>`)
    .replace(/count="(\d+)"/, `count="${fontList.length + 1}"`);

  const xfMatches = stylesXml.match(/<cellXfs[^>]*>[\s\S]*?<\/cellXfs>/);
  if (!xfMatches) throw new Error('스타일 정보를 찾을 수 없습니다.');
  const cellXfsBlock = xfMatches[0];
  const xfList = cellXfsBlock.match(/<xf[^>]*\/>|<xf[^>]*>[\s\S]*?<\/xf>/g) || [];
  const baseXf = xfList[baseStyleId] || xfList[0];
  if (!baseXf) throw new Error('기본 스타일을 찾을 수 없습니다.');

  const setFontId = (xf, id) => {
    let next = xf;
    if (/fontId=/.test(next)) {
      next = next.replace(/fontId="\d+"/, `fontId="${id}"`);
    } else {
      next = next.replace('<xf ', `<xf fontId="${id}" `);
    }
    if (/applyFont=/.test(next)) {
      next = next.replace(/applyFont="\d+"/, 'applyFont="1"');
    } else {
      next = next.replace('<xf ', '<xf applyFont="1" ');
    }
    return next;
  };

  const redXf = setFontId(baseXf, fontId);
  const styleId = xfList.length;
  const nextCellXfs = cellXfsBlock
    .replace(/<\/cellXfs>/, `${redXf}</cellXfs>`)
    .replace(/count="(\d+)"/, `count="${xfList.length + 1}"`);

  let nextStyles = stylesXml.replace(cellXfsBlock, nextCellXfs);
  nextStyles = nextStyles.replace(fontsBlock, nextFonts);

  return { stylesXml: nextStyles, styleId };
};

const updateInvalidRows = (sheetXml, { redStyleId, invalidRows }) => {
  let updatedCount = 0;
  const nextXml = sheetXml.replace(/<c[^>]*r=['"]B(\d+)['"][^>]*>/gi, (match, rowStr) => {
    const row = Number(rowStr);
    if (Number.isNaN(row) || !invalidRows.has(row)) return match;
    let updated = match;
    if (match.includes(' s="') || match.includes(" s='")) {
      updated = match.replace(/ s=['"]\d+['"]/, ` s="${redStyleId}"`);
    } else {
      updated = updated.replace('<c ', `<c s="${redStyleId}" `);
    }
    if (updated !== match) updatedCount += 1;
    return updated;
  });
  return { xml: nextXml, updatedCount };
};

const updateInvalidSummary = (sheetXml, { b4StyleId, invalidCount }) => {
  const label = `무효 ${invalidCount}건`;
  const cellMarkup = `<c r="B4" t="inlineStr" s="${b4StyleId}"><is><t>${label}</t></is></c>`;
  if (/<row[^>]*r="4"[^>]*>[\s\S]*?<\/row>/.test(sheetXml)) {
    return sheetXml.replace(/<row[^>]*r="4"[^>]*>[\s\S]*?<\/row>/, (rowBlock) => {
      if (/<c[^>]*r=['"]B4['"][^>]*>[\s\S]*?<\/c>/.test(rowBlock) || /<c[^>]*r=['"]B4['"][^>]*\/>/.test(rowBlock)) {
        return rowBlock.replace(/<c[^>]*r=['"]B4['"][^>]*>([\s\S]*?)<\/c>|<c[^>]*r=['"]B4['"][^>]*\/>/, cellMarkup);
      }
      return rowBlock.replace(/<\/row>/, `${cellMarkup}</row>`);
    });
  }
  return sheetXml.replace(/<row[^>]*r="5"[^>]*>/, (match) => `<row r="4">${cellMarkup}</row>${match}`);
};

const applyOrderingResult = async ({ templatePath, orderingPath }) => {
  if (!templatePath) throw new Error('개찰결과파일을 먼저 선택하세요.');
  if (!orderingPath) throw new Error('발주처결과 파일을 먼저 선택하세요.');

  const { sanitizedPath: orderingSanitized } = sanitizeXlsx(orderingPath);
  const orderingWorkbook = new ExcelJS.Workbook();
  await orderingWorkbook.xlsx.readFile(orderingSanitized);
  const orderingSheet = orderingWorkbook.worksheets.find((sheet) => sheet.name.replace(/\s+/g, '') === '입찰금액점수');
  if (!orderingSheet) throw new Error('발주처결과 파일에서 "입찰금액점수" 시트를 찾을 수 없습니다.');

  const validNumbers = new Set();
  let started = false;
  let emptyStreak = 0;
  for (let row = 5; row <= 5000; row += 1) {
    const raw = getCellText(orderingSheet.getCell(row, 1));
    const seq = normalizeSequence(raw);
    if (seq) {
      validNumbers.add(seq);
      started = true;
      emptyStreak = 0;
    } else if (started) {
      emptyStreak += 1;
      if (emptyStreak >= 3) break;
    }
  }

  const { sanitizedPath: templateSanitized } = sanitizeXlsx(templatePath);
  const templateWorkbook = new ExcelJS.Workbook();
  await templateWorkbook.xlsx.readFile(templateSanitized);
  const templateSheet = templateWorkbook.worksheets[0];
  if (!templateSheet) throw new Error('개찰결과 파일 시트를 찾을 수 없습니다.');

  const lastRow = findLastDataRow(templateSheet, 2);
  const invalidRows = new Set();
  for (let row = 14; row <= lastRow; row += 1) {
    const raw = getCellText(templateSheet.getCell(row, 2));
    const seq = normalizeSequence(raw);
    if (!seq) continue;
    if (!validNumbers.has(seq)) invalidRows.add(row);
  }

  const zip = new AdmZip(templatePath);
  const sheetPath = readXml(zip, 'xl/worksheets/sheet1.xml')
    ? 'xl/worksheets/sheet1.xml'
    : (resolveSheetPath(zip, templateSheet.name) || fallbackSheetPath(zip));
  const sheetXml = readXml(zip, sheetPath);
  if (!sheetXml) throw new Error('시트 XML을 찾을 수 없습니다.');
  let stylesXml = readXml(zip, 'xl/styles.xml');

  const b14Tag = sheetXml.match(/<c[^>]*r=['"]B14['"][^>]*>/i);
  const b14StyleMatch = b14Tag ? b14Tag[0].match(/s=['"](\d+)['"]/) : null;
  const b14StyleId = b14StyleMatch ? Number(b14StyleMatch[1]) : 0;
  const b4Tag = sheetXml.match(/<c[^>]*r=['"]B4['"][^>]*>/i);
  const b4StyleMatch = b4Tag ? b4Tag[0].match(/s=['"](\d+)['"]/) : null;
  const b4BaseStyleId = b4StyleMatch ? Number(b4StyleMatch[1]) : 0;

  const redFillResult = buildFillStyle(stylesXml, b14StyleId, 'FFFF0000');
  stylesXml = redFillResult.stylesXml;
  const redFontResult = buildRedFontStyle(stylesXml, b4BaseStyleId);
  stylesXml = redFontResult.stylesXml;

  let nextSheetXml = sheetXml;
  if (invalidRows.size > 0) {
    const updated = updateInvalidRows(nextSheetXml, { redStyleId: redFillResult.styleId, invalidRows });
    nextSheetXml = updated.xml;
  }
  nextSheetXml = updateInvalidSummary(nextSheetXml, { b4StyleId: redFontResult.styleId, invalidCount: invalidRows.size });

  writeXml(zip, 'xl/styles.xml', stylesXml);
  writeXml(zip, sheetPath, nextSheetXml);
  zip.writeZip(templatePath);

  return {
    path: templatePath,
    invalidCount: invalidRows.size,
  };
};

module.exports = { applyOrderingResult };
