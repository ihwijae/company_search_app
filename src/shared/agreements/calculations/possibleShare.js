export function calculatePossibleShareRatio(possibleShareBase, sipyungAmount) {
  const base = Number(possibleShareBase);
  const sipyung = Number(sipyungAmount);
  if (!Number.isFinite(base) || base <= 0) return null;
  if (!Number.isFinite(sipyung) || sipyung <= 0) return null;
  const ratio = (sipyung / base) * 100;
  return Number.isFinite(ratio) && ratio > 0 ? ratio : null;
}

export function formatPossibleShareValue(ratio) {
  const numeric = Number(ratio);
  if (!Number.isFinite(numeric) || numeric <= 0 || numeric >= 100) return '';
  return numeric.toFixed(2).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
}

export function formatPossibleShareText(ratio) {
  const value = formatPossibleShareValue(ratio);
  return value ? `${value}%` : '';
}
