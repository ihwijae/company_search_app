// Client-side constants for ratio highlighting
import industryAverages from './shared/industryAverages.json';

export const INDUSTRY_AVERAGES = industryAverages;

// Relative factors against the industry average
// Debt ratio: highlight if value >= average * 0.5 (50% of average)
export const DEBT_RATIO_WARN_FACTOR = 0.5;
// Current ratio: highlight if value <= average * 1.5 (150% of average)
export const CURRENT_RATIO_WARN_FACTOR = 1.5;
