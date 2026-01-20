const ExcelJS = require('exceljs');
const { sanitizeXlsx } = require('../../../../utils/sanitizeXlsx');

const EXCLUDED_MANAGERS = ['조정', '서권형', '구본진'];

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

const cleanCompanyName = (rawName) => {
  if (!rawName) return '';
  const original = String(rawName);
  let primary = original.split('\n')[0].replace(/\r/g, '').trim();
  primary = primary.replace(/\s*[\d.,%][\s\S]*$/, '');
  primary = primary.replace(/㈜/g, '');
  primary = primary.replace(/\(주\)/g, '');
  primary = primary.replace(/주식회사/g, '');
  const cleaned = primary.replace(/\s+/g, ' ').trim();
  return cleaned || original.split('\n')[0].trim();
};

const hasExcludedManager = (value) => (
  EXCLUDED_MANAGERS.some((token) => String(value || '').includes(token))
);

const normalizeRemark = (value) => String(value || '').replace(/\s+/g, '');

const classifyRemark = (value) => {
  const normalized = normalizeRemark(value);
  const quality = normalized.includes('품질만점');
  const tie = normalized.includes('동가주의');
  return { quality, tie };
};

const findLastDataRow = (worksheet, columnIndex, startRow = 8) => {
  const maxRow = Math.max(worksheet.rowCount || 0, startRow);
  let lastRow = startRow - 1;
  for (let row = startRow; row <= maxRow; row += 1) {
    const text = getCellText(worksheet.getCell(row, columnIndex)).trim();
    if (text) lastRow = row;
  }
  return lastRow >= startRow ? lastRow : (startRow - 1);
};

const buildCenterSequence = (total) => {
  const center = Math.ceil(total / 2);
  const indices = [];
  for (let offset = 0; offset < total; offset += 1) {
    const up = center + offset;
    const down = center - offset;
    if (offset === 0) {
      indices.push(center);
      continue;
    }
    if (up <= total) indices.push(up);
    if (down >= 1) indices.push(down);
    if (indices.length >= total) break;
  }
  return indices;
};

const applyBidAmountTemplate = async ({ templatePath, agreementPath, agreementSheet }) => {
  if (!templatePath) throw new Error('투찰금액 템플릿 파일을 선택하세요.');
  if (!agreementPath) throw new Error('협정파일을 선택하세요.');
  if (!agreementSheet) throw new Error('협정파일 시트를 선택하세요.');

  const { sanitizedPath: agreementSanitized } = sanitizeXlsx(agreementPath);
  const agreementWorkbook = new ExcelJS.Workbook();
  await agreementWorkbook.xlsx.readFile(agreementSanitized);
  const agreementSheetRef = agreementWorkbook.getWorksheet(agreementSheet);
  if (!agreementSheetRef) throw new Error('협정파일 시트를 찾을 수 없습니다.');

  const entries = [];
  let emptyStreak = 0;
  for (let row = 5; row <= 1000; row += 1) {
    const seqText = getCellText(agreementSheetRef.getCell(row, 1)).trim();
    if (!seqText) {
      emptyStreak += 1;
      if (emptyStreak >= 2) break;
      continue;
    }
    emptyStreak = 0;
    const rawName = getCellText(agreementSheetRef.getCell(row, 3)).trim();
    if (!rawName) continue;
    if (hasExcludedManager(rawName)) continue;
    const name = cleanCompanyName(rawName);
    if (!name) continue;
    const remark = getCellText(agreementSheetRef.getCell(row, 8)).trim();
    const flags = classifyRemark(remark);
    entries.push({
      name,
      remark,
      isQuality: flags.quality,
      isTie: flags.tie,
    });
  }

  if (!entries.length) throw new Error('협정파일에서 업체명을 찾지 못했습니다.');

  const qualityEntries = [];
  const tieEntries = [];
  const normalEntries = [];
  entries.forEach((entry) => {
    if (entry.isTie) {
      tieEntries.push(entry);
    } else if (entry.isQuality) {
      qualityEntries.push(entry);
    } else {
      normalEntries.push(entry);
    }
  });

  const totalCount = entries.length;
  const slots = Array(totalCount).fill(null);
  const centerSequence = buildCenterSequence(totalCount);
  let qualityIndex = 0;
  centerSequence.forEach((index) => {
    if (qualityIndex >= qualityEntries.length) return;
    const slotIndex = index - 1;
    if (!slots[slotIndex]) {
      slots[slotIndex] = qualityEntries[qualityIndex];
      qualityIndex += 1;
    }
  });

  let tieIndex = 0;
  for (let index = totalCount; index >= 1; index -= 1) {
    if (tieIndex >= tieEntries.length) break;
    const slotIndex = index - 1;
    if (!slots[slotIndex]) {
      slots[slotIndex] = tieEntries[tieIndex];
      tieIndex += 1;
    }
  }

  let normalIndex = 0;
  for (let index = 1; index <= totalCount; index += 1) {
    if (normalIndex >= normalEntries.length) break;
    const slotIndex = index - 1;
    if (!slots[slotIndex]) {
      slots[slotIndex] = normalEntries[normalIndex];
      normalIndex += 1;
    }
  }

  const ordered = slots.filter(Boolean);
  const { sanitizedPath: templateSanitized } = sanitizeXlsx(templatePath);
  const templateWorkbook = new ExcelJS.Workbook();
  await templateWorkbook.xlsx.readFile(templateSanitized);
  const templateSheet = templateWorkbook.worksheets[0];
  if (!templateSheet) throw new Error('투찰금액 템플릿 시트를 찾을 수 없습니다.');

  const lastRow = Math.max(
    findLastDataRow(templateSheet, 2, 8),
    findLastDataRow(templateSheet, 3, 8),
  );
  for (let row = 8; row <= lastRow; row += 1) {
    templateSheet.getCell(row, 2).value = null;
    templateSheet.getCell(row, 3).value = null;
  }

  ordered.forEach((entry, index) => {
    const row = 8 + index;
    templateSheet.getCell(row, 2).value = index + 1;
    templateSheet.getCell(row, 3).value = entry.name;
  });

  await templateWorkbook.xlsx.writeFile(templatePath);
  return {
    path: templatePath,
    totalCount,
    qualityCount: qualityEntries.length,
    tieCount: tieEntries.length,
  };
};

module.exports = { applyBidAmountTemplate };
