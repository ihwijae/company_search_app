import { calculatePossibleShareRatio, formatPossibleShareValue } from './possibleShare.js';

export function buildBoardNameCellText({
  candidate,
  groupIndex,
  slotIndex,
  getCompanyName,
  sanitizeCompanyName,
  getCandidateManagerName,
  getShareDisplayValue,
  getCandidateSipyungAmount,
  parseAmountValue,
  possibleShareBase,
  toNumber,
  possibleShareFormatMode = 'round',
}) {
  const rawName = getCompanyName(candidate) || '';
  const cleanName = sanitizeCompanyName(rawName) || rawName;
  const managerName = getCandidateManagerName(candidate);
  const shareDisplay = getShareDisplayValue(groupIndex, slotIndex);

  const sipyungAmountRaw = getCandidateSipyungAmount(candidate);
  const sipyungAmount = parseAmountValue(sipyungAmountRaw);
  const possibleShareRatio = calculatePossibleShareRatio(possibleShareBase, sipyungAmount);
  const possibleShareDisplay = formatPossibleShareValue(possibleShareRatio, { mode: possibleShareFormatMode });

  const lines = [cleanName];
  if (possibleShareDisplay) {
    lines.push(possibleShareDisplay);
  } else if (!(possibleShareRatio != null && possibleShareRatio >= 100) && shareDisplay) {
    const shareNumeric = toNumber(shareDisplay);
    if (!(shareNumeric != null && shareNumeric >= 100)) {
      lines.push(shareDisplay);
    }
  }
  if (managerName) lines.push(managerName);
  return lines.filter(Boolean).join('\n');
}
