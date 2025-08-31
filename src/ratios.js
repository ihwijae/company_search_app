// Client-side constants for ratio highlighting
export const INDUSTRY_AVERAGES = {
  eung: { debtRatio: 124.41, currentRatio: 142.58 },
  tongsin: { debtRatio: 124.03, currentRatio: 140.06 },
  sobang: { debtRatio: 110.08, currentRatio: 139.32 },
};

// Relative factors against the industry average
// Debt ratio: highlight if value >= average * 0.5 (50% of average)
export const DEBT_RATIO_WARN_FACTOR = 0.5;
// Current ratio: highlight if value <= average * 1.5 (150% of average)
export const CURRENT_RATIO_WARN_FACTOR = 1.5;
