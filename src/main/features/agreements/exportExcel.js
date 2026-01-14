const ExcelJS = require('exceljs');

const sanitizeFileName = (value, fallback = '협정보드') => {
  const text = String(value || '').replace(/[\\/:*?"<>|]/g, '').trim();
  return text || fallback;
};

const toExcelNumber = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const cleaned = String(value).replace(/[^0-9.\-]/g, '');
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

const toPlainText = (value) => {
  if (!value) return '';
  return String(value)
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/p\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{2,}/g, '\n')
    .trim();
};

const sanitizeSheetName = (value, fallback = '협정보드') => {
  const cleaned = String(value || '')
    .replace(/[\\/:*?\[\]]/g, '')
    .trim();
  const truncated = cleaned.slice(0, 31);
  return truncated || fallback;
};

const ensureUniqueSheetName = (workbook, name) => {
  const existing = new Set(workbook.worksheets.map((sheet) => sheet.name));
  if (!existing.has(name)) return name;
  const base = name.replace(/\(\d+\)$/, '').trim();
  for (let i = 2; i < 1000; i += 1) {
    const suffix = `(${i})`;
    const candidateBase = base.slice(0, Math.max(0, 31 - suffix.length));
    const candidate = `${candidateBase}${suffix}`;
    if (!existing.has(candidate)) return candidate;
  }
  return sanitizeSheetName(`${name}-${Date.now()}`);
};

const cloneCellStyle = (style) => {
  if (!style) return style;
  try { return JSON.parse(JSON.stringify(style)); } catch { return style; }
};

const copyWorksheet = (source, target) => {
  source.columns.forEach((column, index) => {
    const targetColumn = target.getColumn(index + 1);
    targetColumn.width = column.width;
    targetColumn.hidden = column.hidden;
    targetColumn.style = cloneCellStyle(column.style);
  });

  source.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const targetRow = target.getRow(rowNumber);
    targetRow.height = row.height;
    targetRow.hidden = row.hidden;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const targetCell = targetRow.getCell(colNumber);
      targetCell.value = cell.value;
      targetCell.style = cloneCellStyle(cell.style);
      targetCell.numFmt = cell.numFmt;
      targetCell.alignment = cloneCellStyle(cell.alignment);
      targetCell.border = cloneCellStyle(cell.border);
      targetCell.font = cloneCellStyle(cell.font);
      targetCell.fill = cloneCellStyle(cell.fill);
      targetCell.protection = cloneCellStyle(cell.protection);
      targetCell.dataValidation = cell.dataValidation;
    });
  });

  const merges = source.model?.merges || [];
  merges.forEach((range) => target.mergeCells(range));
};

const cloneFill = (fill) => {
  if (!fill) return null;
  try { return JSON.parse(JSON.stringify(fill)); } catch { return fill; }
};

const MANAGEMENT_SCORE_MAX = 15;
const ORANGE_FILL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFFC000' },
  bgColor: { indexed: 64 },
};
const YELLOW_FILL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFFFF00' },
  bgColor: { indexed: 64 },
};
const RED_FILL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFF0000' },
  bgColor: { indexed: 64 },
};
const CLEAR_FILL = { type: 'pattern', pattern: 'none' };

async function exportAgreementExcel({
  config,
  payload,
  outputPath,
  appendToPath = '',
  sheetName = '',
  sheetColor = 'FF00B050',
}) {
  if (!config || !config.path) throw new Error('템플릿 설정이 올바르지 않습니다.');
  if (!payload) throw new Error('엑셀 내보내기 데이터가 없습니다.');
  const { header = {}, groups = [] } = payload;

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(config.path);
  const worksheet = config.sheetName
    ? workbook.getWorksheet(config.sheetName)
    : workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('엑셀 템플릿 시트를 찾을 수 없습니다.');
  }
  if (sheetName) {
    worksheet.name = sanitizeSheetName(sheetName, worksheet.name);
  }
  if (sheetColor) {
    worksheet.properties.tabColor = { argb: sheetColor };
  }
  if (!workbook.calcProperties) workbook.calcProperties = {};
  workbook.calcProperties.fullCalcOnLoad = true;

  const preservedColumns = worksheet.columns.map((column) => ({
    width: column?.width,
    hidden: column?.hidden,
  }));
  const preservedRowHeights = new Map();
  const maxRowToPreserve = config.maxRows || worksheet.rowCount;
  for (let rowIdx = 1; rowIdx <= maxRowToPreserve; rowIdx += 1) {
    const row = worksheet.getRow(rowIdx);
    if (row && row.height != null) {
      preservedRowHeights.set(rowIdx, row.height);
    }
  }

  const regionFillTemplate = config.regionFill ? cloneFill(config.regionFill) : null;
  const slotColumns = config.slotColumns || {};
  const nameColumns = Array.isArray(slotColumns.name) ? slotColumns.name : [];
  const slotCount = nameColumns.length;
  const summaryColumns = config.summaryColumns || {};
  const qualityColumns = Array.isArray(config.qualityColumns) ? config.qualityColumns : [];
  const rowStep = Number(config.rowStep) > 0 ? Number(config.rowStep) : 1;
  const qualityRowOffset = Number.isFinite(config.qualityRowOffset) ? Number(config.qualityRowOffset) : 0;
  const approvalColumn = config.approvalColumn || null;
  const managementBonusColumn = config.managementBonusColumn || null;

  const availableRows = config.maxRows
    ? Math.floor((config.maxRows - config.startRow) / rowStep) + 1
    : Infinity;
  if (groups.length > availableRows) {
    throw new Error(`템플릿이 지원하는 최대 협정 수(${availableRows}개)를 초과했습니다.`);
  }
  const clearColumns = Array.isArray(config.clearColumns) ? config.clearColumns : [];
  const endRow = config.maxRows || (config.startRow + (availableRows - 1) * rowStep);
  for (let row = config.startRow; row <= endRow; row += 1) {
    const rowObj = worksheet.getRow(row);
    if (rowObj && rowObj.style) {
      rowObj.style = {
        ...rowObj.style,
        fill: { type: 'pattern', pattern: 'none' },
      };
    }
    const isQualityRow = rowStep > 1 && qualityRowOffset > 0
      && ((row - config.startRow) % rowStep) === qualityRowOffset;
    if (!isQualityRow) {
      clearColumns.forEach((col) => {
        const cell = worksheet.getCell(`${col}${row}`);
        cell.value = null;
        if (cell.fill) cell.fill = undefined;
      });
    }
  }

  const amountForScore = (
    toExcelNumber(header.amountForScore)
    ?? toExcelNumber(header.estimatedAmount)
    ?? toExcelNumber(header.baseAmount)
  );
  const headerCells = config.headerCells || {};
  const amountForScoreCell = headerCells.amountForScore
    || (Object.keys(headerCells).length > 0 ? null : 'D2');
  const estimatedAmountCell = headerCells.estimatedAmount || null;
  const baseAmountCell = headerCells.baseAmount || null;
  const bidAmountCell = headerCells.bidAmount || null;
  const ratioBaseAmountCell = headerCells.ratioBaseAmount || null;
  const entryAmountCell = headerCells.entryAmount || null;
  const memoCell = headerCells.memo || null;

  const estimatedValue = toExcelNumber(header.estimatedAmount);
  const baseValue = toExcelNumber(header.baseAmount);
  const bidValue = toExcelNumber(header.bidAmount);
  const ratioBaseValue = toExcelNumber(header.ratioBaseAmount);
  const entryAmountValue = toExcelNumber(header.entryAmount);

  if (amountForScoreCell) {
    worksheet.getCell(amountForScoreCell).value = amountForScore != null ? amountForScore : null;
  }
  if (estimatedAmountCell && estimatedAmountCell !== baseAmountCell) {
    worksheet.getCell(estimatedAmountCell).value = estimatedValue != null ? estimatedValue : null;
  }
  if (baseAmountCell) {
    const targetValue = baseValue != null ? baseValue : (estimatedAmountCell === baseAmountCell ? estimatedValue : null);
    worksheet.getCell(baseAmountCell).value = targetValue != null ? targetValue : null;
  }
  if (bidAmountCell) {
    worksheet.getCell(bidAmountCell).value = bidValue != null ? bidValue : null;
  }
  if (ratioBaseAmountCell) {
    worksheet.getCell(ratioBaseAmountCell).value = ratioBaseValue != null ? ratioBaseValue : null;
  }
  if (entryAmountCell) {
    worksheet.getCell(entryAmountCell).value = entryAmountValue != null ? entryAmountValue : null;
  }
  const compositeTitle = [header.noticeNo, header.noticeTitle]
    .map((part) => (part ? String(part).trim() : ''))
    .filter(Boolean)
    .join(' ');
  const noticeCell = headerCells.noticeTitle || 'M1';
  worksheet.getCell(noticeCell).value = compositeTitle;
  const deadlineText = header.bidDeadline || header.rawBidDeadline || '';
  const deadlineCell = headerCells.bidDeadline || 'P2';
  const dutyCell = headerCells.dutySummary || 'W2';
  worksheet.getCell(deadlineCell).value = deadlineText ? String(deadlineText) : '';
  worksheet.getCell(dutyCell).value = header.dutySummary || '';
  if (memoCell) {
    const memoText = header.memoText
      ? String(header.memoText).trim()
      : toPlainText(header.memoHtml || '');
    worksheet.getCell(memoCell).value = memoText || '';
  }

  const regionCells = [];
  const nonRegionCells = [];

  groups.forEach((group, index) => {
    const rowNumber = config.startRow + (index * rowStep);
    const members = Array.isArray(group.members) ? group.members : [];
    const slotData = Array(slotCount).fill(null);
    members.forEach((member) => {
      if (!member || typeof member !== 'object') return;
      const { slotIndex } = member;
      if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= slotCount) return;
      slotData[slotIndex] = member;
    });

    const rowIndex = rowNumber;
    const summary = group?.summary || null;
    if (approvalColumn) {
      const approvalCell = worksheet.getCell(`${approvalColumn}${rowIndex}`);
      const approvalValue = group?.approval ? String(group.approval) : '';
      approvalCell.value = approvalValue || null;
      if (approvalValue === '취소') {
        const baseStyle = approvalCell.style ? { ...approvalCell.style } : {};
        approvalCell.style = {
          ...baseStyle,
          fill: cloneFill(RED_FILL),
        };
      }
    }
    if (managementBonusColumn) {
      const bonusCell = worksheet.getCell(`${managementBonusColumn}${rowIndex}`);
      const bonusValue = group?.summary?.managementBonusApplied ? 1.1 : null;
      if (bonusValue != null) {
        bonusCell.value = bonusValue;
        const baseStyle = bonusCell.style ? { ...bonusCell.style } : {};
        bonusCell.style = {
          ...baseStyle,
          fill: cloneFill(YELLOW_FILL),
        };
      }
    }
    const indexValue = Number(group.index);
    if (Number.isFinite(indexValue)) {
      worksheet.getCell(`A${rowIndex}`).value = indexValue;
    }
    if (approvalColumn !== 'B') {
      worksheet.getCell(`B${rowIndex}`).value = '';
    }

    for (let slotIndex = 0; slotIndex < slotCount; slotIndex += 1) {
      const member = slotData[slotIndex];
      const nameColumn = slotColumns.name[slotIndex];
      const shareColumn = slotColumns.share?.[slotIndex];
      const managementColumn = slotColumns.management?.[slotIndex];
      const performanceColumn = slotColumns.performance?.[slotIndex];
      const abilityColumn = slotColumns.ability?.[slotIndex];
      const technicianColumn = slotColumns.technician?.[slotIndex];

      const nameCell = worksheet.getCell(`${nameColumn}${rowIndex}`);
      const shareCell = shareColumn ? worksheet.getCell(`${shareColumn}${rowIndex}`) : null;
      const managementCell = managementColumn ? worksheet.getCell(`${managementColumn}${rowIndex}`) : null;
      const performanceCell = performanceColumn ? worksheet.getCell(`${performanceColumn}${rowIndex}`) : null;
      const abilityCell = abilityColumn ? worksheet.getCell(`${abilityColumn}${rowIndex}`) : null;
      const technicianCell = technicianColumn ? worksheet.getCell(`${technicianColumn}${rowIndex}`) : null;

      if (!member || member.empty) {
        nameCell.value = '';
        nameCell.fill = undefined;
        if (shareCell) { shareCell.value = null; shareCell.fill = undefined; }
        if (managementCell) { managementCell.value = null; managementCell.fill = undefined; }
        if (performanceCell) { performanceCell.value = null; performanceCell.fill = undefined; }
        if (abilityCell) { abilityCell.value = null; abilityCell.fill = undefined; }
        if (technicianCell) { technicianCell.value = null; technicianCell.fill = undefined; }
        continue;
      }

      const rawName = typeof member.name === 'string' ? member.name : '';
      const trimmedName = rawName.trim();
      const isEmptySlot = !trimmedName && !member.isRegion;

      if (isEmptySlot) {
        nameCell.value = '';
        nameCell.fill = { type: 'pattern', pattern: 'none' };
        if (shareCell) { shareCell.value = null; }
        continue;
      }

      nameCell.value = rawName;
      if (shareCell) {
        const shareValueRaw = toExcelNumber(member.sharePercent);
        if (shareValueRaw != null) {
          const normalizedShare = shareValueRaw >= 1 ? shareValueRaw / 100 : shareValueRaw;
          shareCell.value = normalizedShare;
        } else {
          shareCell.value = null;
        }
        shareCell.fill = undefined;
      }
      if (managementCell) {
        const managementValue = toExcelNumber(member.managementScore);
        managementCell.value = managementValue;
        const baseStyle = managementCell.style ? { ...managementCell.style } : {};
        managementCell.style = {
          ...baseStyle,
          fill: cloneFill(CLEAR_FILL),
        };
        if (managementValue != null && managementValue < MANAGEMENT_SCORE_MAX) {
          managementCell.style = {
            ...baseStyle,
            fill: cloneFill(ORANGE_FILL),
          };
        }
      }
      if (performanceCell) { performanceCell.value = toExcelNumber(member.performanceAmount); performanceCell.fill = undefined; }
      if (abilityCell) { abilityCell.value = toExcelNumber(member.sipyung); abilityCell.fill = undefined; }
      if (technicianCell) { technicianCell.value = toExcelNumber(member.technicianScore); technicianCell.fill = undefined; }
      if (qualityColumns.length > 0 && member.qualityScore != null) {
        const qualityColumn = qualityColumns[slotIndex];
        if (qualityColumn) {
          const qualityRowIndex = rowIndex + qualityRowOffset;
          const qualityCell = worksheet.getCell(`${qualityColumn}${qualityRowIndex}`);
          const qualityValue = toExcelNumber(member.qualityScore);
          if (qualityValue != null) qualityCell.value = qualityValue;
        }
      }

      if (member.isRegion && regionFillTemplate) {
        regionCells.push({ column: nameColumn, row: rowIndex });
        const baseStyle = nameCell.style ? { ...nameCell.style } : {};
        nameCell.style = {
          ...baseStyle,
          fill: cloneFill(regionFillTemplate),
        };
        if (process.env.DEBUG_AGREEMENT_EXPORT === '1') {
          console.log('[exportExcel] set region fill', nameColumn, rowIndex);
        }
      } else {
        nonRegionCells.push({ column: nameColumn, row: rowIndex });
        const baseStyle = nameCell.style ? { ...nameCell.style } : {};
        nameCell.style = {
          ...baseStyle,
          fill: { type: 'pattern', pattern: 'none' },
        };
        if (process.env.DEBUG_AGREEMENT_EXPORT === '1') {
          console.log('[exportExcel] set non-region fill', nameColumn, rowIndex, nameCell.fill);
        }
      }
    }

    if (summaryColumns.credibility && summary?.credibilityScore != null) {
      const credCell = worksheet.getCell(`${summaryColumns.credibility}${rowIndex}`);
      const credValue = toExcelNumber(summary.credibilityScore);
      if (credValue != null) {
        credCell.value = credValue;
      }
    }
    if (summaryColumns.netCostBonus && summary?.netCostBonusScore != null) {
      const bonusCell = worksheet.getCell(`${summaryColumns.netCostBonus}${rowIndex}`);
      const bonusValue = toExcelNumber(summary.netCostBonusScore);
      if (bonusValue != null) {
        bonusCell.value = bonusValue;
      }
    }
    if (summaryColumns.qualityPoints) {
      const qualityCell = worksheet.getCell(`${summaryColumns.qualityPoints}${rowIndex}`);
      const qualityValue = summary?.qualityPoints != null ? toExcelNumber(summary.qualityPoints) : null;
      qualityCell.value = qualityValue != null ? qualityValue : null;
      const shouldWarn = qualityValue != null && Number.isFinite(qualityValue) && qualityValue < 2;
      const baseStyle = qualityCell.style ? { ...qualityCell.style } : {};
      qualityCell.style = {
        ...baseStyle,
        fill: cloneFill(CLEAR_FILL),
      };
      if (shouldWarn) {
        qualityCell.style = {
          ...baseStyle,
          fill: cloneFill(ORANGE_FILL),
        };
      }
    }
  });

  if (Array.isArray(preservedColumns) && preservedColumns.length > 0) {
    worksheet.columns.forEach((column, index) => {
      const preset = preservedColumns[index];
      if (!preset) return;
      if (preset.width != null) {
        column.width = preset.width;
        column.customWidth = true;
      }
      if (preset.hidden != null) column.hidden = preset.hidden;
    });
  }

  nameColumns.forEach((columnKey) => {
    const column = worksheet.getColumn(columnKey);
    if (!column) return;
    column.style = {
      ...column.style,
      fill: { type: 'pattern', pattern: 'none' },
    };
  });

  preservedRowHeights.forEach((height, rowIdx) => {
    const row = worksheet.getRow(rowIdx);
    if (row) row.height = height;
  });

  nonRegionCells.forEach(({ column, row }) => {
    const cell = worksheet.getCell(`${column}${row}`);
    const baseStyle = cell.style ? { ...cell.style } : {};
    cell.style = {
      ...baseStyle,
      fill: { type: 'pattern', pattern: 'none' },
    };
    if (process.env.DEBUG_AGREEMENT_EXPORT === '1') {
      console.log('[exportExcel] applied non-region final fill', column, row, cell.fill);
    }
  });

  regionCells.forEach(({ column, row }) => {
    const cell = worksheet.getCell(`${column}${row}`);
    const baseStyle = cell.style ? { ...cell.style } : {};
    cell.style = {
      ...baseStyle,
      fill: cloneFill(regionFillTemplate),
    };
  });

  if (process.env.DEBUG_AGREEMENT_EXPORT === '1') {
    const debugCell = worksheet.getCell(`${slotColumns.name?.[1] || 'C'}${config.startRow}`);
    console.log('[exportExcel] debug fill', debugCell.fill, 'regionCells', regionCells);
    ['C','D','E','F','G'].forEach((col) => {
      const cell = worksheet.getCell(`${col}${config.startRow}`);
      console.log('[exportExcel] final cell state', col, cell.fill);
    });
  }

  if (appendToPath) {
    const targetWorkbook = new ExcelJS.Workbook();
    await targetWorkbook.xlsx.readFile(appendToPath);
    const resolvedName = ensureUniqueSheetName(targetWorkbook, worksheet.name);
    const targetSheet = targetWorkbook.addWorksheet(resolvedName);
    if (sheetColor) {
      targetSheet.properties.tabColor = { argb: sheetColor };
    }
    copyWorksheet(worksheet, targetSheet);
    await targetWorkbook.xlsx.writeFile(appendToPath);
    return { path: appendToPath, sheetName: resolvedName };
  }

  await workbook.xlsx.writeFile(outputPath);
  return { path: outputPath, sheetName: worksheet.name };
}

module.exports = {
  sanitizeFileName,
  toExcelNumber,
  exportAgreementExcel,
};
