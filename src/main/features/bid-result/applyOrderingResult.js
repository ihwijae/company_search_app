const ExcelJS = require('exceljs');
const AdmZip = require('adm-zip');
const XLSX = require('xlsx');
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

const normalizeBizNumber = (value) => String(value || '').replace(/[^0-9]/g, '');

const findLastDataRow = (worksheet, columnIndex = 2) => {
  const maxRow = Math.max(worksheet.rowCount, 14);
  let lastRow = 0;
  for (let row = 14; row <= maxRow; row += 1) {
    const text = getCellText(worksheet.getCell(row, columnIndex)).trim();
    if (text) lastRow = row;
  }
  return lastRow || 13;
};

const escapeXml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

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
    ref: `${match[1].toUpperCase()}${match[2]}`,
  };
};

const resolveMergedAnchor = (sheetXml, cellRef) => {
  if (!sheetXml) return cellRef;
  const target = parseCell(cellRef);
  if (!target) return cellRef;
  const mergeRegex = /<mergeCell[^>]*ref="([^"]+)"/gi;
  let match = mergeRegex.exec(sheetXml);
  while (match) {
    const ref = match[1];
    const parts = ref.split(':');
    if (parts.length === 2) {
      const start = parseCell(parts[0]);
      const end = parseCell(parts[1]);
      if (start && end) {
        const minCol = Math.min(start.col, end.col);
        const maxCol = Math.max(start.col, end.col);
        const minRow = Math.min(start.row, end.row);
        const maxRow = Math.max(start.row, end.row);
        if (target.col >= minCol && target.col <= maxCol && target.row >= minRow && target.row <= maxRow) {
          return start.ref;
        }
      }
    }
    match = mergeRegex.exec(sheetXml);
  }
  return cellRef;
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

const parseStyleMap = (stylesXml) => {
  if (!stylesXml) return { xfs: [], fonts: [], fills: [] };
  const fontsBlock = stylesXml.match(/<fonts[^>]*>[\s\S]*?<\/fonts>/);
  const fillsBlock = stylesXml.match(/<fills[^>]*>[\s\S]*?<\/fills>/);
  const xfsBlock = stylesXml.match(/<cellXfs[^>]*>[\s\S]*?<\/cellXfs>/);
  const fonts = fontsBlock ? (fontsBlock[0].match(/<font>[\s\S]*?<\/font>/g) || []) : [];
  const fills = fillsBlock ? (fillsBlock[0].match(/<fill>[\s\S]*?<\/fill>/g) || []) : [];
  const xfs = xfsBlock ? (xfsBlock[0].match(/<xf[^>]*\/>|<xf[^>]*>[\s\S]*?<\/xf>/g) || []) : [];

  const fontFlags = fonts.map((font) => ({
    bold: /<b\s*\/>/.test(font) || /<b>/.test(font),
  }));
  const fillColors = fills.map((fill) => {
    const match = fill.match(/<fgColor[^>]*rgb="([^"]+)"/i);
    return match ? match[1] : '';
  });
  const xfStyles = xfs.map((xf) => {
    const fontIdMatch = xf.match(/fontId="(\d+)"/);
    const fillIdMatch = xf.match(/fillId="(\d+)"/);
    return {
      fontId: fontIdMatch ? Number(fontIdMatch[1]) : null,
      fillId: fillIdMatch ? Number(fillIdMatch[1]) : null,
    };
  });
  return { fontFlags, fillColors, xfStyles };
};

const normalizeRgb = (rgb) => {
  if (!rgb) return '';
  const cleaned = rgb.replace(/^FF/i, '').toUpperCase();
  return cleaned;
};

const isYellowBoldStyleId = (styleId, styleMap) => {
  if (styleId === null || styleId === undefined || !styleMap) return false;
  const xf = styleMap.xfStyles?.[styleId];
  if (!xf) return false;
  const fontBold = xf.fontId !== null && styleMap.fontFlags?.[xf.fontId]?.bold;
  const fillRgb = xf.fillId !== null ? styleMap.fillColors?.[xf.fillId] || '' : '';
  return fontBold && normalizeRgb(fillRgb) === 'FFFF00';
};

const isYellowBold = (cell, styleMap) => {
  if (!cell) return false;
  const style = cell.s;
  let fontBold = false;
  let fillRgb = '';
  if (style && typeof style === 'object') {
    fontBold = Boolean(style.font?.bold || style.font?.b);
    fillRgb = style.fill?.fgColor?.rgb || style.fgColor?.rgb || '';
    if (!fillRgb && style.fill?.fgColor?.theme !== undefined) {
      fillRgb = String(style.fill.fgColor.theme || '');
    }
  } else if (typeof style === 'number' && styleMap?.xfStyles?.length) {
    const xf = styleMap.xfStyles[style];
    const fontId = xf?.fontId;
    const fillId = xf?.fillId;
    fontBold = fontId !== null && styleMap.fontFlags?.[fontId]?.bold;
    fillRgb = fillId !== null ? styleMap.fillColors?.[fillId] || '' : '';
  }
  const normalized = normalizeRgb(fillRgb);
  return fontBold && normalized === 'FFFF00';
};

const findWinnerRowByXml = (sheetXml, styleMap) => {
  if (!sheetXml || !styleMap) return null;
  let winnerRow = null;
  const cellRegex = /<c[^>]*r=['"]A(\d+)['"][^>]*s=['"](\d+)['"][^>]*>/gi;
  let match = cellRegex.exec(sheetXml);
  while (match) {
    const row = Number(match[1]);
    const styleId = Number(match[2]);
    if (!Number.isNaN(row) && isYellowBoldStyleId(styleId, styleMap)) {
      winnerRow = row;
      break;
    }
    match = cellRegex.exec(sheetXml);
  }
  if (winnerRow) return winnerRow;
  const rowRegex = /<row[^>]*r=['"](\d+)['"][^>]*s=['"](\d+)['"][^>]*>/gi;
  match = rowRegex.exec(sheetXml);
  while (match) {
    const row = Number(match[1]);
    const styleId = Number(match[2]);
    if (!Number.isNaN(row) && isYellowBoldStyleId(styleId, styleMap)) {
      return row;
    }
    match = rowRegex.exec(sheetXml);
  }
  return null;
};

const getCellStyleId = (sheetXml, cellRef) => {
  const cellMatch = sheetXml.match(new RegExp(`<c[^>]*r=['"]${cellRef}['"][^>]*>`, 'i'));
  if (!cellMatch) return null;
  const styleMatch = cellMatch[0].match(/s=['"](\d+)['"]/);
  return styleMatch ? Number(styleMatch[1]) : null;
};

const upsertInlineStringCell = (sheetXml, cellRef, value, styleId = null) => {
  const rowMatch = cellRef.match(/(\d+)$/);
  if (!rowMatch) return sheetXml;
  const row = rowMatch[1];
  const safeValue = escapeXml(value);
  const styleAttr = styleId !== null ? ` s="${styleId}"` : '';
  const cellMarkup = `<c r="${cellRef}" t="inlineStr"${styleAttr}><is><t>${safeValue}</t></is></c>`;

  const rowRegex = new RegExp(`<row[^>]*r="${row}"[^>]*>[\\s\\S]*?<\\/row>`);
  if (rowRegex.test(sheetXml)) {
    return sheetXml.replace(rowRegex, (rowBlock) => {
      if (new RegExp(`<c[^>]*r=['"]${cellRef}['"][^>]*>`).test(rowBlock)
        || new RegExp(`<c[^>]*r=['"]${cellRef}['"][^>]*\\/>`).test(rowBlock)) {
        return rowBlock.replace(
          new RegExp(`<c[^>]*r=['"]${cellRef}['"][^>]*>([\\s\\S]*?)<\\/c>|<c[^>]*r=['"]${cellRef}['"][^>]*\\/>`),
          cellMarkup,
        );
      }
      return rowBlock.replace(/<\/row>/, `${cellMarkup}</row>`);
    });
  }

  const anchorRegex = new RegExp(`<row[^>]*r="${Number(row) + 1}"[^>]*>`);
  if (anchorRegex.test(sheetXml)) {
    return sheetXml.replace(anchorRegex, `<row r="${row}">${cellMarkup}</row>$&`);
  }
  return sheetXml.replace(/<\/sheetData>/, `<row r="${row}">${cellMarkup}</row></sheetData>`);
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

const clearOColumnMarks = (sheetXml, { lastRow, keepRow }) => {
  if (!sheetXml) return sheetXml;
  return sheetXml.replace(
    /<c[^>]*r=['"]O(\d+)['"][^>]*>([\s\S]*?)<\/c>|<c[^>]*r=['"]O(\d+)['"][^>]*\/>/gi,
    (match, rowA, _content, rowB) => {
      const row = Number(rowA || rowB);
      if (Number.isNaN(row) || row < 14 || row > lastRow) return match;
      if (keepRow && row === keepRow) return match;
      return '';
    },
  );
};

const applyOrderingResult = async ({ templatePath, orderingPath }) => {
  if (!templatePath) throw new Error('개찰결과파일을 먼저 선택하세요.');
  if (!orderingPath) throw new Error('발주처결과 파일을 먼저 선택하세요.');

  let orderingReadPath = orderingPath;
  if (orderingPath.toLowerCase().endsWith('.xlsx')) {
    const { sanitizedPath: orderingSanitized } = sanitizeXlsx(orderingPath);
    orderingReadPath = orderingSanitized;
  }
  const orderingWorkbook = XLSX.readFile(orderingReadPath, { cellStyles: true });
  const orderingSheetName = (orderingWorkbook.SheetNames || []).find(
    (name) => name.replace(/\s+/g, '') === '입찰금액점수',
  );
  if (!orderingSheetName) throw new Error('발주처결과 파일에서 "입찰금액점수" 시트를 찾을 수 없습니다.');
  const orderingSheet = orderingWorkbook.Sheets[orderingSheetName];
  if (!orderingSheet) throw new Error('발주처결과 파일에서 "입찰금액점수" 시트를 찾을 수 없습니다.');

  let styleMap = null;
  let winnerRowFromXml = null;
  if (orderingReadPath.toLowerCase().endsWith('.xlsx')) {
    try {
      const orderingZip = new AdmZip(orderingReadPath);
      styleMap = parseStyleMap(readXml(orderingZip, 'xl/styles.xml'));
      const orderingSheetPath = resolveSheetPath(orderingZip, orderingSheetName) || fallbackSheetPath(orderingZip);
      if (orderingSheetPath) {
        const orderingSheetXml = readXml(orderingZip, orderingSheetPath);
        winnerRowFromXml = findWinnerRowByXml(orderingSheetXml, styleMap);
      }
    } catch (e) {
      styleMap = null;
    }
  }
  console.log('[bid-result] ordering styles:', styleMap ? 'xlsx-style' : 'none/xls');
  if (winnerRowFromXml) {
    console.log('[bid-result] winner row from xml:', winnerRowFromXml);
  }

  const validNumbers = new Set();
  let winnerInfo = null;
  if (winnerRowFromXml) {
    const seqCell = orderingSheet[XLSX.utils.encode_cell({ r: winnerRowFromXml - 1, c: 0 })];
    const bizCell = orderingSheet[XLSX.utils.encode_cell({ r: winnerRowFromXml - 1, c: 2 })];
    const nameCell = orderingSheet[XLSX.utils.encode_cell({ r: winnerRowFromXml - 1, c: 3 })];
    const seqRaw = seqCell ? XLSX.utils.format_cell(seqCell) : '';
    const bizRaw = bizCell ? XLSX.utils.format_cell(bizCell) : '';
    const nameRaw = nameCell ? XLSX.utils.format_cell(nameCell) : '';
    const bizNo = normalizeBizNumber(bizRaw);
    const rank = normalizeSequence(seqRaw);
    const companyName = String(nameRaw || '').trim();
    if (bizNo) {
      winnerInfo = { bizNo, rank, companyName };
    }
  }
  let started = false;
  let emptyStreak = 0;
  for (let row = 5; row <= 5000; row += 1) {
    const cellAddress = XLSX.utils.encode_cell({ r: row - 1, c: 0 });
    const cell = orderingSheet[cellAddress];
    const raw = cell ? XLSX.utils.format_cell(cell) : '';
    const seq = normalizeSequence(raw);
    if (!winnerInfo && isYellowBold(cell, styleMap)) {
      const bizAddress = XLSX.utils.encode_cell({ r: row - 1, c: 2 });
      const nameAddress = XLSX.utils.encode_cell({ r: row - 1, c: 3 });
      const bizCell = orderingSheet[bizAddress];
      const nameCell = orderingSheet[nameAddress];
      const bizRaw = bizCell ? XLSX.utils.format_cell(bizCell) : '';
      const nameRaw = nameCell ? XLSX.utils.format_cell(nameCell) : '';
      const bizNo = normalizeBizNumber(bizRaw);
      const companyName = String(nameRaw || '').trim();
      const rank = seq || normalizeSequence(raw) || null;
      if (bizNo) {
        winnerInfo = {
          bizNo,
          rank,
          companyName,
        };
        console.log('[bid-result] winner found:', { row, rank, bizNo, companyName });
      }
    }
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

  let winnerRow = null;
  if (winnerInfo?.bizNo) {
    for (let row = 14; row <= lastRow; row += 1) {
      const rawBiz = getCellText(templateSheet.getCell(row, 3));
      const normalizedBiz = normalizeBizNumber(rawBiz);
      if (normalizedBiz && normalizedBiz === winnerInfo.bizNo) {
        winnerRow = row;
        break;
      }
    }
    console.log('[bid-result] winner match row:', winnerRow || 'not-found');
  } else {
    console.log('[bid-result] winner not found in ordering file');
  }
  if (winnerRow) {
    if (!winnerInfo.companyName) {
      const templateName = getCellText(templateSheet.getCell(winnerRow, 4)).trim();
      if (templateName) winnerInfo.companyName = templateName;
    }
    if (!winnerInfo.rank) {
      const templateRank = normalizeSequence(getCellText(templateSheet.getCell(winnerRow, 2)));
      if (templateRank) winnerInfo.rank = templateRank;
    }
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
  nextSheetXml = clearOColumnMarks(nextSheetXml, { lastRow, keepRow: winnerRow });

  if (winnerRow) {
    const oStyleId = getCellStyleId(nextSheetXml, `O${winnerRow}`);
    nextSheetXml = upsertInlineStringCell(nextSheetXml, `O${winnerRow}`, 'Y', oStyleId);
  }

  if (winnerInfo?.rank && winnerInfo?.companyName) {
    const summary = `실제낙찰사: 균형근접 ${winnerInfo.rank}순위 ${winnerInfo.companyName}`;
    const summaryRef = resolveMergedAnchor(nextSheetXml, 'K4');
    const k5StyleId = getCellStyleId(nextSheetXml, summaryRef);
    nextSheetXml = upsertInlineStringCell(nextSheetXml, summaryRef, summary, k5StyleId);
  }

  writeXml(zip, 'xl/styles.xml', stylesXml);
  writeXml(zip, sheetPath, nextSheetXml);
  zip.writeZip(templatePath);

  return {
    path: templatePath,
    invalidCount: invalidRows.size,
    winnerRow,
    winnerInfo,
  };
};

module.exports = { applyOrderingResult };
