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

const buildCredibilityFormula = (members, shareColumns, rowIndex, scaleValue = 1, scaleExpr = '') => {
  if (!Array.isArray(members) || !Array.isArray(shareColumns) || !rowIndex) return null;
  const parts = [];
  let result = 0;
  let hasResult = false;
  members.forEach((member) => {
    if (!member || typeof member !== 'object') return;
    const cred = Number(member.credibilityBonus);
    if (!Number.isFinite(cred) || cred === 0) return;
    const slotIndex = member.slotIndex;
    const shareColumn = shareColumns[slotIndex];
    if (!shareColumn) return;
    parts.push(`${cred}*${shareColumn}${rowIndex}`);
    const sharePercent = Number(member.sharePercent);
    if (Number.isFinite(sharePercent)) {
      const ratio = sharePercent >= 1 ? sharePercent / 100 : sharePercent;
      result += cred * ratio;
      hasResult = true;
    }
  });
  if (parts.length === 0) return null;
  const scale = Number(scaleValue);
  const scaleText = scaleExpr || (Number.isFinite(scale) && scale !== 1 ? String(scale) : '');
  const joined = parts.join('+');
  const formula = scaleText ? `(${joined})*${scaleText}` : joined;
  return {
    formula,
    result: hasResult ? (Number.isFinite(scale) ? result * scale : null) : null,
  };
};

const argbToHex = (argb) => {
  if (!argb) return null;
  const raw = String(argb).replace(/^#/, '').trim();
  if (raw.length === 8) return `#${raw.slice(2)}`;
  if (raw.length === 6) return `#${raw}`;
  return null;
};

const fillToHex = (fill) => {
  if (!fill || typeof fill !== 'object') return null;
  const fg = fill.fgColor?.argb;
  const bg = fill.bgColor?.argb;
  return argbToHex(fg || bg);
};

const MANAGEMENT_SCORE_MAX = 15;
const ORANGE_HEX = '#FFC000';
const YELLOW_HEX = '#FFFF00';
const RED_HEX = '#FF0000';

const pushValue = (updates, address, value, extra = {}) => {
  updates.push({ address, value, ...extra });
};

const pushFormula = (updates, address, formula, extra = {}) => {
  const normalized = formula ? (formula.startsWith('=') ? formula : `=${formula}`) : null;
  updates.push({ address, formula: normalized, ...extra });
};

const pushFill = (updates, address, fillColor) => {
  if (!fillColor) return;
  updates.push({ address, fillColor, noValueChange: true });
};

const pushClearFill = (updates, address) => {
  updates.push({ address, clearFill: true, noValueChange: true });
};

const buildAgreementExportUpdates = ({ config, payload, sheetName }) => {
  if (!config || !config.path) throw new Error('템플릿 설정이 올바르지 않습니다.');
  if (!payload) throw new Error('엑셀 내보내기 데이터가 없습니다.');

  const { header = {}, groups = [] } = payload;
  const updates = [];

  const resolvedSheetName = sheetName ? sanitizeSheetName(sheetName, '협정보드') : '';

  const regionFillHex = fillToHex(config.regionFill);

  const slotColumns = config.slotColumns || {};
  const nameColumns = Array.isArray(slotColumns.name) ? slotColumns.name : [];
  const slotCount = nameColumns.length;
  const summaryColumns = config.summaryColumns || {};
  const qualityColumns = Array.isArray(config.qualityColumns) ? config.qualityColumns : [];
  const rowStep = Number(config.rowStep) > 0 ? Number(config.rowStep) : 1;
  const qualityRowOffset = Number.isFinite(config.qualityRowOffset) ? Number(config.qualityRowOffset) : 0;
  const approvalColumn = config.approvalColumn || null;
  const managementBonusColumn = config.managementBonusColumn || null;
  const credibilityScaleValue = config.credibilityScale ?? 1;
  const credibilityScaleExpr = config.credibilityScaleExpr || '';

  const availableRows = config.maxRows
    ? Math.floor((config.maxRows - config.startRow) / rowStep) + 1
    : Infinity;
  if (groups.length > availableRows) {
    throw new Error(`템플릿이 지원하는 최대 협정 수(${availableRows}개)를 초과했습니다.`);
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

  if (amountForScoreCell) pushValue(updates, amountForScoreCell, amountForScore != null ? amountForScore : null);
  if (estimatedAmountCell && estimatedAmountCell !== baseAmountCell) {
    pushValue(updates, estimatedAmountCell, estimatedValue != null ? estimatedValue : null);
  }
  if (baseAmountCell) {
    const targetValue = baseValue != null ? baseValue : (estimatedAmountCell === baseAmountCell ? estimatedValue : null);
    pushValue(updates, baseAmountCell, targetValue != null ? targetValue : null);
  }
  if (bidAmountCell) pushValue(updates, bidAmountCell, bidValue != null ? bidValue : null);
  if (ratioBaseAmountCell) pushValue(updates, ratioBaseAmountCell, ratioBaseValue != null ? ratioBaseValue : null);
  if (entryAmountCell) pushValue(updates, entryAmountCell, entryAmountValue != null ? entryAmountValue : null);

  const compositeTitle = [header.noticeNo, header.noticeTitle]
    .map((part) => (part ? String(part).trim() : ''))
    .filter(Boolean)
    .join(' ');
  const noticeCell = headerCells.noticeTitle || 'M1';
  pushValue(updates, noticeCell, compositeTitle);
  const deadlineText = header.bidDeadline || header.rawBidDeadline || '';
  const deadlineCell = headerCells.bidDeadline || 'P2';
  const dutyCell = headerCells.dutySummary || 'W2';
  pushValue(updates, deadlineCell, deadlineText ? String(deadlineText) : '');
  pushValue(updates, dutyCell, header.dutySummary || '');
  if (memoCell) {
    const memoText = header.memoText
      ? String(header.memoText).trim()
      : toPlainText(header.memoHtml || '');
    pushValue(updates, memoCell, memoText || '');
  }

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
      const approvalValue = group?.approval ? String(group.approval) : '';
      pushValue(updates, `${approvalColumn}${rowIndex}`, approvalValue || null);
      if (approvalValue === '취소') {
        pushFill(updates, `${approvalColumn}${rowIndex}`, RED_HEX);
      }
    }
    if (managementBonusColumn) {
      const bonusValue = group?.summary?.managementBonusApplied ? 1.1 : null;
      if (bonusValue != null) {
        pushValue(updates, `${managementBonusColumn}${rowIndex}`, bonusValue);
        pushFill(updates, `${managementBonusColumn}${rowIndex}`, YELLOW_HEX);
      }
    }
    const indexValue = Number(group.index);
    if (Number.isFinite(indexValue)) {
      pushValue(updates, `A${rowIndex}`, indexValue);
    }
    if (approvalColumn !== 'B') {
      pushValue(updates, `B${rowIndex}`, '');
    }

    for (let slotIndex = 0; slotIndex < slotCount; slotIndex += 1) {
      const member = slotData[slotIndex];
      const nameColumn = slotColumns.name[slotIndex];
      const shareColumn = slotColumns.share?.[slotIndex];
      const managementColumn = slotColumns.management?.[slotIndex];
      const performanceColumn = slotColumns.performance?.[slotIndex];
      const abilityColumn = slotColumns.ability?.[slotIndex];
      const technicianColumn = slotColumns.technician?.[slotIndex];

      const nameAddr = `${nameColumn}${rowIndex}`;
      const shareAddr = shareColumn ? `${shareColumn}${rowIndex}` : null;
      const managementAddr = managementColumn ? `${managementColumn}${rowIndex}` : null;
      const performanceAddr = performanceColumn ? `${performanceColumn}${rowIndex}` : null;
      const abilityAddr = abilityColumn ? `${abilityColumn}${rowIndex}` : null;
      const technicianAddr = technicianColumn ? `${technicianColumn}${rowIndex}` : null;

      if (!member || member.empty) {
        pushValue(updates, nameAddr, '');
        pushClearFill(updates, nameAddr);
        if (shareAddr) pushValue(updates, shareAddr, null);
        if (managementAddr) pushValue(updates, managementAddr, null);
        if (performanceAddr) pushValue(updates, performanceAddr, null);
        if (abilityAddr) pushValue(updates, abilityAddr, null);
        if (technicianAddr) pushValue(updates, technicianAddr, null);
        continue;
      }

      const rawName = typeof member.name === 'string' ? member.name : '';
      const trimmedName = rawName.trim();
      const isEmptySlot = !trimmedName && !member.isRegion;

      if (isEmptySlot) {
        pushValue(updates, nameAddr, '');
        pushClearFill(updates, nameAddr);
        if (shareAddr) pushValue(updates, shareAddr, null);
        continue;
      }

      pushValue(updates, nameAddr, rawName);
      if (shareAddr) {
        const shareValueRaw = toExcelNumber(member.sharePercent);
        if (shareValueRaw != null) {
          const normalizedShare = shareValueRaw >= 1 ? shareValueRaw / 100 : shareValueRaw;
          pushValue(updates, shareAddr, normalizedShare);
        } else {
          pushValue(updates, shareAddr, null);
        }
      }
      if (managementAddr) {
        const managementValue = toExcelNumber(member.managementScore);
        pushValue(updates, managementAddr, managementValue);
        if (managementValue != null && managementValue < MANAGEMENT_SCORE_MAX) {
          pushFill(updates, managementAddr, ORANGE_HEX);
        } else {
          pushClearFill(updates, managementAddr);
        }
      }
      if (performanceAddr) pushValue(updates, performanceAddr, toExcelNumber(member.performanceAmount));
      if (abilityAddr) pushValue(updates, abilityAddr, toExcelNumber(member.sipyung));
      if (technicianAddr) pushValue(updates, technicianAddr, toExcelNumber(member.technicianScore));
      if (qualityColumns.length > 0 && member.qualityScore != null) {
        const qualityColumn = qualityColumns[slotIndex];
        if (qualityColumn) {
          const qualityRowIndex = rowIndex + qualityRowOffset;
          const qualityAddr = `${qualityColumn}${qualityRowIndex}`;
          const qualityValue = toExcelNumber(member.qualityScore);
          if (qualityValue != null) pushValue(updates, qualityAddr, qualityValue);
        }
      }

      if (member.isRegion && regionFillHex) {
        pushFill(updates, nameAddr, regionFillHex);
      } else {
        pushClearFill(updates, nameAddr);
      }
    }

    if (summaryColumns.credibility && summary?.credibilityScore != null) {
      const credAddr = `${summaryColumns.credibility}${rowIndex}`;
      const credibilityFormula = buildCredibilityFormula(
        members,
        slotColumns.share,
        rowIndex,
        credibilityScaleValue,
        credibilityScaleExpr
      );
      if (credibilityFormula) {
        pushFormula(updates, credAddr, credibilityFormula.formula);
      } else {
        const credValue = toExcelNumber(summary.credibilityScore);
        if (credValue != null) pushValue(updates, credAddr, credValue);
      }
    }
    if (summaryColumns.netCostBonus && summary?.netCostBonusScore != null) {
      const bonusAddr = `${summaryColumns.netCostBonus}${rowIndex}`;
      const bonusValue = toExcelNumber(summary.netCostBonusScore);
      if (bonusValue != null) pushValue(updates, bonusAddr, bonusValue);
    }
    if (summaryColumns.qualityPoints) {
      const qualityAddr = `${summaryColumns.qualityPoints}${rowIndex}`;
      const qualityValue = summary?.qualityPoints != null ? toExcelNumber(summary.qualityPoints) : null;
      pushValue(updates, qualityAddr, qualityValue != null ? qualityValue : null);
      const shouldWarn = qualityValue != null && Number.isFinite(qualityValue) && qualityValue < 2;
      if (shouldWarn) {
        pushFill(updates, qualityAddr, ORANGE_HEX);
      } else {
        pushClearFill(updates, qualityAddr);
      }
    }
  });

  return {
    updates,
    renameSheet: resolvedSheetName || '',
  };
};

module.exports = {
  sanitizeFileName,
  buildAgreementExportUpdates,
};
