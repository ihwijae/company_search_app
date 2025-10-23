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

const cloneFill = (fill) => {
  if (!fill) return null;
  try { return JSON.parse(JSON.stringify(fill)); } catch { return fill; }
};

async function exportAgreementExcel({ config, payload, outputPath }) {
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

  const availableRows = config.maxRows ? (config.maxRows - config.startRow + 1) : Infinity;
  if (groups.length > availableRows) {
    throw new Error(`템플릿이 지원하는 최대 협정 수(${availableRows}개)를 초과했습니다.`);
  }
  const clearColumns = Array.isArray(config.clearColumns) ? config.clearColumns : [];
  const endRow = config.maxRows || (config.startRow + availableRows - 1);
  for (let row = config.startRow; row <= endRow; row += 1) {
    clearColumns.forEach((col) => {
      const cell = worksheet.getCell(`${col}${row}`);
      cell.value = null;
      if (cell.fill) cell.fill = undefined;
    });
  }

  const amountForScore = (
    toExcelNumber(header.amountForScore)
    ?? toExcelNumber(header.estimatedAmount)
    ?? toExcelNumber(header.baseAmount)
  );
  const d2Cell = worksheet.getCell('D2');
  d2Cell.value = amountForScore != null ? amountForScore : null;
  const compositeTitle = [header.noticeNo, header.noticeTitle]
    .map((part) => (part ? String(part).trim() : ''))
    .filter(Boolean)
    .join(' ');
  worksheet.getCell('M1').value = compositeTitle;
  const deadlineText = header.bidDeadline || header.rawBidDeadline || '';
  worksheet.getCell('P2').value = deadlineText ? String(deadlineText) : '';
  worksheet.getCell('W2').value = header.dutySummary || '';

  const regionCells = [];
  const nonRegionCells = [];

  groups.forEach((group, index) => {
    const rowNumber = config.startRow + index;
    const members = Array.isArray(group.members) ? group.members : [];
    const slotData = Array(slotCount).fill(null);
    members.forEach((member) => {
      if (!member || typeof member !== 'object') return;
      const { slotIndex } = member;
      if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= slotCount) return;
      slotData[slotIndex] = member;
    });

    const rowIndex = rowNumber;
    const indexValue = Number(group.index);
    if (Number.isFinite(indexValue)) {
      worksheet.getCell(`A${rowIndex}`).value = indexValue;
    }
    worksheet.getCell(`B${rowIndex}`).value = '';

    for (let slotIndex = 0; slotIndex < slotCount; slotIndex += 1) {
      const member = slotData[slotIndex];
      const nameColumn = slotColumns.name[slotIndex];
      const shareColumn = slotColumns.share?.[slotIndex];
      const managementColumn = slotColumns.management?.[slotIndex];
      const performanceColumn = slotColumns.performance?.[slotIndex];
      const abilityColumn = slotColumns.ability?.[slotIndex];

      const nameCell = worksheet.getCell(`${nameColumn}${rowIndex}`);
      const shareCell = shareColumn ? worksheet.getCell(`${shareColumn}${rowIndex}`) : null;
      const managementCell = managementColumn ? worksheet.getCell(`${managementColumn}${rowIndex}`) : null;
      const performanceCell = performanceColumn ? worksheet.getCell(`${performanceColumn}${rowIndex}`) : null;
      const abilityCell = abilityColumn ? worksheet.getCell(`${abilityColumn}${rowIndex}`) : null;

      if (!member || member.empty) {
        nameCell.value = '';
        nameCell.fill = undefined;
        if (shareCell) { shareCell.value = null; shareCell.fill = undefined; }
        if (managementCell) { managementCell.value = null; managementCell.fill = undefined; }
        if (performanceCell) { performanceCell.value = null; performanceCell.fill = undefined; }
        if (abilityCell) { abilityCell.value = null; abilityCell.fill = undefined; }
        continue;
      }

      nameCell.value = member.name || '';
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
      if (managementCell) { managementCell.value = toExcelNumber(member.managementScore); managementCell.fill = undefined; }
      if (performanceCell) { performanceCell.value = toExcelNumber(member.performanceAmount); performanceCell.fill = undefined; }
      if (abilityCell) { abilityCell.value = toExcelNumber(member.sipyung); abilityCell.fill = undefined; }

      if (member.isRegion && regionFillTemplate) {
        regionCells.push({ column: nameColumn, row: rowIndex });
        nameCell.fill = cloneFill(regionFillTemplate);
        if (process.env.DEBUG_AGREEMENT_EXPORT === '1') {
          console.log('[exportExcel] set region fill', nameColumn, rowIndex);
        }
      } else {
        nonRegionCells.push({ column: nameColumn, row: rowIndex });
        const whiteFill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFFFFF' },
          bgColor: { argb: 'FFFFFFFF' },
        };
        nameCell.style = {
          ...nameCell.style,
          fill: cloneFill(whiteFill),
        };
        if (process.env.DEBUG_AGREEMENT_EXPORT === '1') {
          console.log('[exportExcel] set non-region fill', nameColumn, rowIndex, nameCell.fill);
        }
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
    if (!column || !column.style) return;
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
    const whiteFill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFFFF' },
      bgColor: { argb: 'FFFFFFFF' },
    };
    cell.style = {
      ...cell.style,
      fill: cloneFill(whiteFill),
    };
  });

  regionCells.forEach(({ column, row }) => {
    const cell = worksheet.getCell(`${column}${row}`);
    cell.fill = cloneFill(regionFillTemplate);
  });

  if (process.env.DEBUG_AGREEMENT_EXPORT === '1') {
    const debugCell = worksheet.getCell(`${slotColumns.name?.[1] || 'C'}${config.startRow}`);
    console.log('[exportExcel] debug fill', debugCell.fill, 'regionCells', regionCells);
    console.log('[exportExcel] sample non-region fill', worksheet.getCell(`${slotColumns.name?.[0] || 'C'}${config.startRow}`).fill);
  }

  await workbook.xlsx.writeFile(outputPath);
  return { path: outputPath };
}

module.exports = {
  sanitizeFileName,
  toExcelNumber,
  exportAgreementExcel,
};
