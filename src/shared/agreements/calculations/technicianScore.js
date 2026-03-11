const TECHNICIAN_GRADE_OPTIONS = [
  { value: 'special', label: '특급 (1)', points: 1.0 },
  { value: 'advanced', label: '고급 (0.75)', points: 0.75 },
  { value: 'intermediate', label: '중급 (0.5)', points: 0.5 },
  { value: 'entry', label: '초급 (0.25)', points: 0.25 },
];

const TECHNICIAN_CAREER_OPTIONS = [
  { value: 'none', label: '없음 (1.0)', multiplier: 1.0 },
  { value: '5plus', label: '5년 이상 (1.1)', multiplier: 1.1 },
  { value: '9plus', label: '9년 이상 (1.15)', multiplier: 1.15 },
  { value: '12plus', label: '12년 이상 (1.2)', multiplier: 1.2 },
];

const TECHNICIAN_MANAGEMENT_OPTIONS = [
  { value: 'none', label: '없음 (1.0)', multiplier: 1.0 },
  { value: '3plus', label: '3년 이상 (1.1)', multiplier: 1.1 },
  { value: '6plus', label: '6년 이상 (1.15)', multiplier: 1.15 },
  { value: '9plus', label: '9년 이상 (1.2)', multiplier: 1.2 },
];

const roundTo = (value, digits = 2) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const factor = 10 ** digits;
  return Math.round(numeric * factor) / factor;
};

const getTechnicianGradePoints = (value) => {
  const target = TECHNICIAN_GRADE_OPTIONS.find((option) => option.value === value);
  return target ? Number(target.points) : 0;
};

const getTechnicianMultiplier = (value, options) => {
  const target = options.find((option) => option.value === value);
  return target ? Number(target.multiplier) : 1;
};

const getTechnicianCount = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 1) return 1;
  return Math.floor(num);
};

const computeTechnicianScore = (entry) => {
  if (!entry) return 0;
  const base = getTechnicianGradePoints(entry.grade);
  if (base <= 0) return 0;
  const career = getTechnicianMultiplier(entry.careerCoeff, TECHNICIAN_CAREER_OPTIONS);
  const management = getTechnicianMultiplier(entry.managementCoeff, TECHNICIAN_MANAGEMENT_OPTIONS);
  const count = getTechnicianCount(entry.count);
  return base * career * management * count;
};

const formatTechnicianScore = (value, digits = 2) => {
  const rounded = roundTo(value, digits);
  if (rounded == null) return '-';
  return rounded.toFixed(digits);
};

export {
  TECHNICIAN_GRADE_OPTIONS,
  TECHNICIAN_CAREER_OPTIONS,
  TECHNICIAN_MANAGEMENT_OPTIONS,
  computeTechnicianScore,
  formatTechnicianScore,
  getTechnicianCount,
  getTechnicianGradePoints,
  getTechnicianMultiplier,
  roundTo,
};
