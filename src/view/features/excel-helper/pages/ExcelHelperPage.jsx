import React from 'react';
import '../../../../styles.css';
import '../../../../fonts.css';
import { generateMany, validateAgreement } from '../../../../shared/agreements/generator.js';
import { extractManagerNames, getQualityBadgeText, isWomenOwnedCompany } from '../../../../utils/companyIndicators.js';
import { INDUSTRY_AVERAGES } from '../../../../ratios.js';

const OWNER_OPTIONS = [
  {
    id: 'mois',
    label: '행안부',
    ownerToken: 'MOIS',
    ranges: [
      { id: 'under30', label: '30억 미만' },
      { id: '30to50', label: '30억~50억' },
      { id: '50to100', label: '50억~100억' },
    ],
  },
  {
    id: 'pps',
    label: '조달청',
    ownerToken: 'PPS',
    ranges: [
      { id: 'under50', label: '50억 미만' },
      { id: '50to100', label: '50억~100억' },
    ],
  },
  {
    id: 'lh',
    label: 'LH',
    ownerToken: 'LH',
    ranges: [
      { id: 'under50', label: '50억 미만' },
      { id: '50to100', label: '50억~100억' },
    ],
  },
];

const FILE_TYPE_OPTIONS = [
  { value: 'eung', label: '전기' },
  { value: 'tongsin', label: '통신' },
  { value: 'sobang', label: '소방' },
];

const FILE_TYPE_LABELS = {
  eung: '전기',
  tongsin: '통신',
  sobang: '소방',
};

const NAME_FIELDS = ['검색된 회사', '업체명', '회사명', 'name'];
const BIZ_FIELDS = ['사업자번호', 'bizNo', '사업자 번호'];
const MANAGEMENT_FIELDS = ['경영상태점수', '경영점수', '관리점수', '경영상태 점수'];
const PERFORMANCE_FIELDS = ['5년 실적', '5년실적', '최근5년실적합계', '최근5년실적'];
const SIPYUNG_FIELDS = ['시평', '시평액', '시평금액', '시평액(원)', '시평금액(원)'];
const ABILITY_FIELDS = ['시공능력평가액', '시공능력평가', '시공능력 평가'];
const QUALITY_FIELDS = ['품질점수', '품질평가', '품질평가점수'];
const REGION_FIELDS = ['대표지역', '지역'];
const REPRESENTATIVE_FIELDS = ['대표자', '대표자명'];
const DEBT_RATIO_FIELDS = ['부채비율', '부채 비율', 'debtRatio', 'DebtRatio'];
const CURRENT_RATIO_FIELDS = ['유동비율', 'currentRatio', 'CurrentRatio'];
const BIZ_YEARS_FIELDS = ['영업기간', '업력', 'bizYears', 'bizyears', '업력(년)', '업력'];
const CREDIT_GRADE_FIELDS = ['creditGrade', 'creditGradeText', '신용등급', '신용평가등급', '신용평가', '신용등급(최근)'];
const CREDIT_EXPIRED_FIELDS = ['creditExpired', '신용만료', '신용평가만료'];
const CREDIT_TRUE_SET = new Set(['Y', 'YES', 'TRUE', 'EXPIRED']);
const WON = 100000000;
const RANGE_AMOUNT_PRESETS = {
  mois: {
    under30: 30 * WON,
    '30to50': 50 * WON,
    '50to100': 100 * WON,
  },
  pps: {
    under50: 50 * WON,
    '50to100': 100 * WON,
  },
  lh: {
    under50: 50 * WON,
    '50to100': 100 * WON,
  },
};
const DEFAULT_RANGE_AMOUNT = 50 * WON;

const DEFAULT_OFFSETS = [
  { key: 'name', label: '업체명', rowOffset: 0, colOffset: 0 },
  { key: 'share', label: '지분', rowOffset: 0, colOffset: 6 },
  { key: 'managementScore', label: '경영상태점수', rowOffset: 0, colOffset: 13 },
  { key: 'performanceAmount', label: '실적액', rowOffset: 0, colOffset: 20 },
  { key: 'sipyungAmount', label: '시평액', rowOffset: 0, colOffset: 38 },
];

const LH_EXTRA_OFFSETS = [
  { key: 'qualityScore', label: '품질점수', rowOffset: 1, colOffset: 6 },
  { key: 'abilityAmount', label: '시공능력평가액', rowOffset: 0, colOffset: 41 },
];

const MAX_SLOTS = 5;

const pickFirstValue = (company, keys) => {
  if (!company || !Array.isArray(keys)) return '';
  const sources = [company, company?.snapshot];
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    for (const key of keys) {
      if (!key) continue;
      if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
      const value = source[key];
      if (value === undefined || value === null) continue;
      if (typeof value === 'string' && !value.trim()) continue;
      return value;
    }
  }
  return '';
};

const toNumeric = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const raw = String(value).trim();
  if (!raw) return null;
  const cleaned = raw
    .replace(/,/g, '')
    .replace(/(억원|억|만원|만|원)$/g, '')
    .replace(/[^0-9.+-]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

const formatAmount = (value) => {
  const numeric = toNumeric(value);
  if (Number.isFinite(numeric)) return numeric.toLocaleString();
  const text = String(value || '').trim();
  return text;
};

const coerceExcelValue = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const numeric = toNumeric(value);
  if (Number.isFinite(numeric)) return numeric;
  return String(value).trim();
};

const computeMetrics = (company) => {
  if (!company) return null;
  const name = pickFirstValue(company, NAME_FIELDS) || '';
  const bizNo = pickFirstValue(company, BIZ_FIELDS) || '';
  const representative = pickFirstValue(company, REPRESENTATIVE_FIELDS) || '';
  const region = pickFirstValue(company, REGION_FIELDS) || '';

  const managementRaw = pickFirstValue(company, MANAGEMENT_FIELDS);
  const performanceRaw = pickFirstValue(company, PERFORMANCE_FIELDS);
  const sipyungRaw = pickFirstValue(company, SIPYUNG_FIELDS);
  const abilityRaw = pickFirstValue(company, ABILITY_FIELDS);
  const qualityRaw = pickFirstValue(company, QUALITY_FIELDS);

  const managementScore = toNumeric(managementRaw) ?? managementRaw ?? '';
  const performanceAmount = toNumeric(performanceRaw) ?? performanceRaw ?? '';
  const sipyungAmount = toNumeric(sipyungRaw) ?? sipyungRaw ?? '';
  const abilityAmount = toNumeric(abilityRaw) ?? abilityRaw ?? '';
  const qualityScore = toNumeric(qualityRaw) ?? qualityRaw ?? '';

  return {
    name,
    bizNo,
    representative,
    region,
    managementScore,
    managementDisplay: formatAmount(managementRaw || managementScore),
    performanceAmount,
    performanceDisplay: formatAmount(performanceRaw || performanceAmount),
    sipyungAmount,
    sipyungDisplay: formatAmount(sipyungRaw || sipyungAmount),
    abilityAmount,
    abilityDisplay: formatAmount(abilityRaw || abilityAmount),
    qualityScore,
    qualityDisplay: formatAmount(qualityRaw || qualityScore),
    raw: company,
  };
};

const getOffsetsForOwner = (ownerId) => {
  if (ownerId === 'lh') return [...DEFAULT_OFFSETS, ...LH_EXTRA_OFFSETS];
  return DEFAULT_OFFSETS;
};

const buildAgreementPayload = (ownerToken, noticeInfoContent, leaderEntry, memberEntries) => {
  if (!leaderEntry) return null;
  const isLH = ownerToken === 'LH';
  return {
    owner: ownerToken,
    noticeNo: '', // noticeNo 필드는 비워둠
    title: noticeInfoContent,    // noticeInfo의 전체 내용을 title로 사용
    leader: {
      name: leaderEntry.name,
      share: leaderEntry.share,
      ...(isLH && { bizNo: leaderEntry.bizNo }), // Conditionally include bizNo for LH leader
    },
    members: memberEntries.map((item) => ({
      name: item.name,
      share: item.share,
      bizNo: item.bizNo, // Always include bizNo for members
    })),
  };
};

const parseNumericInput = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const text = String(value)
    .replace(/[%]/g, '')
    .replace(/점/g, '')
    .trim();
  if (!text) return null;
  return toNumeric(text);
};

const getNumericValue = (company, fields) => {
  const raw = pickFirstValue(company, fields);
  const parsed = parseNumericInput(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

const resolveRangeAmount = (ownerId, rangeId) => {
  const ownerKey = String(ownerId || '').toLowerCase();
  const ownerMap = RANGE_AMOUNT_PRESETS[ownerKey];
  let amount = null;
  if (ownerMap && ownerMap[rangeId]) {
    amount = ownerMap[rangeId];
  } else if (ownerMap) {
    const values = Object.values(ownerMap);
    if (values.length > 0) amount = values[0];
  }
  if (amount === null) amount = DEFAULT_RANGE_AMOUNT;

  // Adjust amount for "under X" ranges to ensure correct tier selection
  if (rangeId.startsWith('under')) {
    return amount - 1;
  }
  return amount;
};

const resolveIndustryAverage = (fileType) => {
  const key = String(fileType || '').toLowerCase();
  return INDUSTRY_AVERAGES[key] || null;
};

const CREDIT_DATE_PATTERN = /(\d{2,4})[^0-9]{0,3}(\d{1,2})[^0-9]{0,3}(\d{1,2})/;
const CREDIT_DATE_PATTERN_GLOBAL = new RegExp(CREDIT_DATE_PATTERN.source, 'g');

const parseExpiryDateToken = (token) => {
  if (!token) return null;
  const match = String(token).match(CREDIT_DATE_PATTERN);
  if (!match) return null;
  let year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (year < 100) year += year >= 70 ? 1900 : 2000;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
};

const extractExpiryDateFromText = (text) => {
  if (!text) return null;
  const source = String(text);
  const explicit = source.match(/(~|부터|:)?\s*([0-9]{2,4}[^0-9]{0,3}[0-9]{1,2}[^0-9]{0,3}[0-9]{1,2})\s*(까지|만료|만기)/);
  if (explicit) {
    const parsed = parseExpiryDateToken(explicit[2]);
    if (parsed) return parsed;
  }
  const tokens = source.match(CREDIT_DATE_PATTERN_GLOBAL);
  if (tokens) {
    for (let i = tokens.length - 1; i >= 0; i -= 1) {
      const parsed = parseExpiryDateToken(tokens[i]);
      if (parsed) return parsed;
    }
  }
  return null;
};

const collectCreditTexts = (source) => {
  if (!source || typeof source !== 'object') return [];
  const keys = [
    'creditNote', 'creditNoteText', 'creditGrade', 'creditGradeText',
    'creditInfo', 'creditDetails', 'creditStatus', 'creditStatusText',
    'creditValidityText', 'creditExpiryText', '신용평가', '신용등급',
    '신용평가등급', '신용평가비고', '신용상태', '신용평가 상태',
  ];
  return keys
    .map((key) => source[key])
    .filter((value) => value !== undefined && value !== null && value !== '')
    .map((value) => String(value));
};

const isCreditExpiredDetailed = (company) => {
  if (!company || typeof company !== 'object') return false;
  const explicitFlags = [
    pickFirstValue(company, CREDIT_EXPIRED_FIELDS),
    company?.creditExpired,
    company?.snapshot?.creditExpired,
  ];
  if (explicitFlags.some((flag) => {
    if (flag === true) return true;
    if (typeof flag === 'string') {
      const upper = flag.trim().toUpperCase();
      return CREDIT_TRUE_SET.has(upper);
    }
    return false;
  })) {
    return true;
  }

  const textSources = [
    ...collectCreditTexts(company),
    ...collectCreditTexts(company?.snapshot),
  ];
  const expiryFromText = (() => {
    for (const text of textSources) {
      const parsed = extractExpiryDateFromText(text);
      if (parsed) return parsed;
    }
    return null;
  })();

  if (expiryFromText) {
    const now = new Date();
    const diff = now.getTime() - expiryFromText.getTime();
    if (diff > 0) return true;
  }

  return false;
};

const extractCreditGradeDetailed = (company) => {
  const raw = pickFirstValue(company, CREDIT_GRADE_FIELDS);
  if (!raw) return '';
  const str = String(raw).trim().toUpperCase();
  if (!str) return '';
  const match = str.match(/^([A-Z]{1,3}[0-9]?(?:[+-])?)/);
  return match ? match[1] : str.split(/[\s(]/)[0];
};

const normalizeShareInput = (input) => {
  if (input === null || input === undefined) return '';
  const stripped = String(input).replace(/[%]/g, '').trim();
  if (!stripped) return '';
  const numeric = Number(stripped);
  if (!Number.isFinite(numeric)) return stripped;
  if (numeric > 1.5) {
    return numeric / 100;
  }
  return numeric;
};

const normalizeName = (value) => {
  let name = String(value || '').replace(/\s+/g, '').toLowerCase();
  // Remove (주), ㈜, 주), (합) from the beginning or end of the name
  name = name.replace(/^(주|\(주\)|㈜|주\)|\(합\))/, ''); // Remove from beginning
  name = name.replace(/(주|\(주\)|㈜|주\)|\(합\))$/, ''); // Remove from end
  // Remove any remaining special characters or punctuation that might interfere with matching
  // Keep only alphanumeric (excluding underscore), and Korean characters
  name = name.replace(/[^a-zA-Z0-9가-힣]/g, ''); // 언더바 및 기타 특수문자, 한자 제거 (한글만 남김)
  return name;
};

const makeLocationKey = ({ workbook, worksheet, row, column }) => (
  `${workbook || ''}|${worksheet || ''}|${row || 0}|${column || 0}`
);

// --- BizYears Calculation Utilities (Copied from main.js) ---
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_YEAR = 365.2425 * MS_PER_DAY;
const EXCEL_DATE_EPOCH = new Date(Date.UTC(1899, 11, 30)); // Excel's date epoch

const isValidDate = (value) => value instanceof Date && !Number.isNaN(value.getTime());

const fromExcelSerial = (serial) => {
  const num = Number(serial);
  if (!Number.isFinite(num)) return null;
  if (num <= 0) return null;
  const milliseconds = Math.round(num * MS_PER_DAY);
  const date = new Date(EXCEL_DATE_EPOCH.getTime() + milliseconds);
  if (!isValidDate(date)) return null;
  return date;
};

const DATE_PATTERN = /(\d{2,4})[.\-/년\s]*(\d{1,2})[.\-/월\s]*(\d{1,2})/;

const parseDateToken = (input) => {
  if (!input) return null;
  const match = String(input).match(DATE_PATTERN);
  if (!match) return null;
  let year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (year < 100) year += year >= 70 ? 1900 : 2000;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
};

const parseDateLike = (raw) => {
  if (!raw && raw !== 0) return null;
  if (raw instanceof Date) {
    return isValidDate(raw) ? raw : null;
  }
  if (typeof raw === 'number') {
    if (raw > 1000) { // Heuristic: assume numbers > 1000 are Excel serial dates
      const excelDate = fromExcelSerial(raw);
      if (excelDate) return excelDate;
    }
    return null;
  }
  const text = String(raw || '').trim();
  if (!text) return null;

  // Try YYYY-MM-DD or YYYY.MM.DD
  const dateMatch = text.match(/(\d{4})[^0-9]*(\d{1,2})[^0-9]*(\d{1,2})/);
  if (dateMatch) {
    const year = Number(dateMatch[1]);
    const month = Number(dateMatch[2]);
    const day = Number(dateMatch[3]);
    if (year >= 1900 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const date = new Date(year, month - 1, day);
      if (isValidDate(date)) return date;
    }
  }

  // Try YYYYMMDD
  const digitsOnly = text.replace(/[^0-9]/g, '');
  if (digitsOnly.length === 8) {
    const year = Number(digitsOnly.slice(0, 4));
    const month = Number(digitsOnly.slice(4, 6));
    const day = Number(digitsOnly.slice(6, 8));
    if (year >= 1900 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const date = new Date(year, month - 1, day);
      if (isValidDate(date)) return date;
    }
  }

  return null;
};

const parseBizYearsFromText = (text) => {
  const normalized = String(text || '').trim();
  if (!normalized) return null;
  const yearMonthMatch = normalized.match(/(\d+(?:\.\d+)?)\s*년\s*(\d+(?:\.\d+)?)?\s*개월?/);
  if (yearMonthMatch) {
    const yearsPart = Number(yearMonthMatch[1]);
    const monthsPart = yearMonthMatch[2] != null ? Number(yearMonthMatch[2]) : 0;
    const total = (Number.isFinite(yearsPart) ? yearsPart : 0) + (Number.isFinite(monthsPart) ? monthsPart / 12 : 0);
    return Number.isFinite(total) && total > 0 ? total : null;
  }
  const monthsOnlyMatch = normalized.match(/(\d+(?:\.\d+)?)\s*개월/);
  if (monthsOnlyMatch) {
    const months = Number(monthsOnlyMatch[1]);
    if (Number.isFinite(months) && months > 0) return months / 12;
  }
  return null;
};

const computeBizYears = (rawValue, baseDate) => {
  if (!rawValue && rawValue !== 0) return { years: null, startDate: null };

  const base = isValidDate(baseDate) ? baseDate : new Date(); // Default to today if no baseDate
  const startDate = parseDateLike(rawValue);
  if (startDate && base && isValidDate(base)) {
    const diff = base.getTime() - startDate.getTime();
    const years = diff > 0 ? (diff / MS_PER_YEAR) : 0;
    return { years: Number.isFinite(years) ? Number(years.toFixed(4)) : 0, startDate };
  }

  if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
    if (rawValue > 0 && rawValue <= 200) { // Assuming max 200 years
      return { years: Number(rawValue.toFixed(4)), startDate: null };
    }
  }

  const fromText = parseBizYearsFromText(rawValue);
  if (Number.isFinite(fromText) && fromText > 0) {
    return { years: Number(fromText.toFixed(4)), startDate: null };
  }

  const numericString = toNumeric(rawValue); // Use toNumeric for general numeric parsing
  if (Number.isFinite(numericString) && numericString > 0 && numericString <= 200) {
    return { years: Number(numericString.toFixed(4)), startDate: null };
  }

  return { years: null, startDate: null };
};
// --- End BizYears Calculation Utilities ---

const calculateAvailableShare = (sipyungAmount, baseAmount) => {
  const sipyung = toNumeric(sipyungAmount);
  const base = toNumeric(baseAmount);

  if (!Number.isFinite(sipyung) || sipyung <= 0 || !Number.isFinite(base) || base <= 0) {
    return null; // 유효하지 않은 값이면 계산하지 않음
  }

  const share = (sipyung / base) * 100; // 퍼센트로 계산
  return Number(share.toFixed(2)); // 소수점 둘째 자리까지 반올림
};

export default function ExcelHelperPage() {
  const [ownerId, setOwnerId] = React.useState('mois');
  const [rangeId, setRangeId] = React.useState(OWNER_OPTIONS[0].ranges[0].id);
  const [fileType, setFileType] = React.useState('');
  const [selection, setSelection] = React.useState(null);
  const [selectionMessage, setSelectionMessage] = React.useState('엑셀에서 업체명이 있는 셀을 선택한 뒤 동기화하세요.');
  const [companyQuery, setCompanyQuery] = React.useState('');
  const [searchResults, setSearchResults] = React.useState([]);
  const [searchLoading, setSearchLoading] = React.useState(false);
  const [searchError, setSearchError] = React.useState('');
  const [selectedCompany, setSelectedCompany] = React.useState(null);
  const [shareInput, setShareInput] = React.useState('');
  const [noticeInfo, setNoticeInfo] = React.useState(''); // 새 상태 추가
  const [noticeDateInput, setNoticeDateInput] = React.useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [baseAmountInput, setBaseAmountInput] = React.useState(''); // 새 상태 추가 (기준금액)
  const [excelStatus, setExcelStatus] = React.useState('');
  const [messageStatus, setMessageStatus] = React.useState('');
  const [messagePreview, setMessagePreview] = React.useState('');
  const [evaluatedManagementScore, setEvaluatedManagementScore] = React.useState(null);
  const [isGeneratingAgreement, setIsGeneratingAgreement] = React.useState(false); // 새 상태 추가

  const appliedCellsRef = React.useRef(new Map());

  const activeOwner = OWNER_OPTIONS.find((o) => o.id === ownerId) || OWNER_OPTIONS[0];
  const availableRanges = activeOwner.ranges;

  React.useEffect(() => {
    if (!availableRanges.some((r) => r.id === rangeId)) {
      setRangeId(availableRanges[0]?.id || '');
    }
  }, [availableRanges, rangeId]);

  const selectedMetrics = React.useMemo(() => {
    const metrics = computeMetrics(selectedCompany);
    if (metrics) {
      const availableShare = calculateAvailableShare(metrics.sipyungAmount, baseAmountInput);
      return {
        ...metrics,
        availableShare,
        availableShareDisplay: availableShare !== null ? `${availableShare}%` : '-',
      };
    }
    return null;
  }, [selectedCompany, baseAmountInput]); // baseAmountInput을 의존성 배열에 추가

  React.useEffect(() => {
    setShareInput('');
    setEvaluatedManagementScore(null); // selectedCompany 변경 시 초기화
    if (selectedCompany) {
      evaluateManagementScore(selectedCompany, fileType);
    }
  }, [selectedCompany, fileType, ownerId, rangeId, noticeDateInput]);

  const evaluateManagementScore = React.useCallback(async (company, fileType) => {
    if (!company || !window.electronAPI?.excelHelperFormulasEvaluate) return null;
    const agencyId = String(ownerId || '').toUpperCase();
    if (!agencyId) return null;
    const amount = resolveRangeAmount(ownerId, rangeId);
    
    const bizYearsInfo = computeBizYears(pickFirstValue(company, BIZ_YEARS_FIELDS), parseDateLike(noticeDateInput));

    const inputs = {
      debtRatio: getNumericValue(company, DEBT_RATIO_FIELDS),
      currentRatio: getNumericValue(company, CURRENT_RATIO_FIELDS),
      perf5y: getNumericValue(company, PERFORMANCE_FIELDS),
      baseAmount: amount,
    };

    if (agencyId === 'PPS' || agencyId === 'LH') {
      inputs.bizYears = bizYearsInfo.years;
    }

    const creditGrade = extractCreditGradeDetailed(company);
    if (creditGrade && !isCreditExpiredDetailed(company)) {
      inputs.creditGrade = creditGrade;
    }

    Object.keys(inputs).forEach((key) => {
      if (inputs[key] === null || Number.isNaN(inputs[key])) {
        delete inputs[key];
      }
    });

    if (Object.keys(inputs).length === 0) return null;

    try {
      const industryAvg = resolveIndustryAverage(fileType || company?._file_type);
      const payload = industryAvg
        ? { agencyId, amount, inputs, industryAvg, noticeDate: noticeDateInput }
        : { agencyId, amount, inputs, noticeDate: noticeDateInput };
      const response = await window.electronAPI.excelHelperFormulasEvaluate(payload);
      const score = Number(response?.data?.management?.score);
      if (Number.isFinite(score)) {
        setEvaluatedManagementScore(score); // 계산된 점수 상태에 저장
        return score;
      }
    } catch (err) {
      console.warn('[ExcelHelper] excelHelperFormulasEvaluate failed:', err?.message || err);
    }
    setEvaluatedManagementScore(null); // 에러 발생 시 초기화
    return null;
  }, [ownerId, rangeId, noticeDateInput]);

  const rememberAppliedCell = React.useCallback((location, companyInfo) => {
    if (!location) return;
    const key = makeLocationKey(location);
    appliedCellsRef.current.set(key, {
      name: companyInfo?.name || '',
      bizNo: companyInfo?.bizNo || '',
      location,
    });
  }, []);

  const handleFetchSelection = async () => {
    setSelectionMessage('엑셀 선택 정보를 확인 중...');
    try {
      if (!window.electronAPI?.excelHelper) {
        throw new Error('Excel 연동 기능을 사용할 수 없습니다. (Windows 전용)');
      }
      const response = await window.electronAPI.excelHelper.getSelection();
      if (!response?.success) throw new Error(response?.message || '선택 정보를 찾을 수 없습니다.');
      const raw = response.data || {};
      const normalizedSelection = {
        workbook: raw.Workbook || raw.workbook || '',
        worksheet: raw.Worksheet || raw.worksheet || '',
        address: raw.Address || raw.address || '',
        row: Number(raw.Row ?? raw.row ?? 0) || 0,
        column: Number(raw.Column ?? raw.column ?? 0) || 0,
      };
      if (!normalizedSelection.row || !normalizedSelection.column) {
        throw new Error('선택한 셀 좌표를 확인할 수 없습니다. 다시 선택해 주세요.');
      }
      setSelection(normalizedSelection);
      setSelectionMessage(`기준 셀: ${normalizedSelection.worksheet}!${normalizedSelection.address}`);
    } catch (err) {
      setSelectionMessage(err.message || '엑셀 선택 정보 확인에 실패했습니다.');
    }
  };

  const handleSearch = async () => {
    if (!companyQuery.trim()) {
      setSearchError('업체명을 입력하세요.');
      return;
    }
    if (!fileType) {
      setSearchError('검색 파일(전기/통신/소방)을 먼저 선택하세요.');
      return;
    }
    if (!window.electronAPI?.searchCompanies) {
      setSearchError('검색 기능을 사용할 수 없습니다. (Electron 환경 필요)');
      return;
    }
    setSearchLoading(true);
    setSearchError('');
    setSearchResults([]);
    try {
      const criteria = { name: companyQuery.trim() };
      const response = await window.electronAPI.searchCompanies(criteria, fileType);
      if (!response?.success) throw new Error(response?.message || '검색에 실패했습니다.');
      setSearchResults(response.data || []);
      if ((response.data || []).length > 0) {
        setSelectedCompany(response.data[0]);
      }
    } catch (err) {
      setSearchError(err.message || '검색에 실패했습니다.');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleApplyToExcel = async () => {
    setExcelStatus('');
    if (!selectedMetrics || !selectedCompany) {
      setExcelStatus('먼저 업체를 선택하세요.');
      return;
    }
    if (!selection) {
      setExcelStatus('엑셀 기준 셀을 먼저 동기화해주세요.');
      return;
    }
    const baseRow = Number(selection.row || 0);
    const baseColumn = Number(selection.column || 0);
    if (!baseRow || !baseColumn) {
      setExcelStatus('기준 셀 좌표를 확인할 수 없습니다. 다시 동기화해주세요.');
      return;
    }
    if (!window.electronAPI?.excelHelper?.applyOffsets) {
      setExcelStatus('Excel 연동 기능을 사용할 수 없습니다.');
      return;
    }
    const shareValue = shareInput.trim();
    if (!shareValue) {
      setExcelStatus('지분(%)을 입력하세요.');
      return;
    }
    const evaluatedManagement = await evaluateManagementScore(selectedCompany, fileType || selectedCompany?._file_type);
    const managementScore = Number.isFinite(evaluatedManagement)
      ? evaluatedManagement
      : parseNumericInput(selectedMetrics.managementScore);

    const offsets = getOffsetsForOwner(ownerId);
    const updates = offsets
      .map((field) => {
        let source;
        if (field.key === 'share') {
          source = normalizeShareInput(shareValue);
        } else if (field.key === 'managementScore') {
          source = managementScore ?? selectedMetrics[field.key];
        } else if (field.key === 'name') { // 'name' 필드 처리 추가
          const companyName = selectedMetrics?.name || '';
          const availableShare = selectedMetrics?.availableShareDisplay && selectedMetrics.availableShareDisplay !== '-'
            ? ` ${selectedMetrics.availableShareDisplay}` : '';
          const managers = extractManagerNames(selectedCompany);
          const managerNames = managers.length > 0 ? ` ${managers.join(', ')}` : '';
          source = `${companyName}${availableShare}${managerNames}`;
          console.log(`[handleApplyToExcel] name field update: companyName="${companyName}", availableShare="${availableShare}", managerNames="${managerNames}", final source="${source}"`); // 디버깅 로그 추가
        } else {
          source = selectedMetrics[field.key];
        }
        if (source === undefined || source === null || source === '') return null;
        const value = coerceExcelValue(source);
        if (value === null || value === '') return null;
        return {
          rowOffset: field.rowOffset || 0,
          colOffset: field.colOffset || 0,
          value,
          field: field.key,
        };
      })
      .filter(Boolean);

    if (updates.length === 0) {
      setExcelStatus('엑셀에 쓸 데이터가 없습니다.');
      return;
    }

    try {
      const payload = {
        workbook: selection.workbook,
        worksheet: selection.worksheet,
        baseRow,
        baseColumn,
        updates,
      };
      const response = await window.electronAPI.excelHelper.applyOffsets(payload);
      if (!response?.success) throw new Error(response?.message || '엑셀 쓰기에 실패했습니다.');
      rememberAppliedCell({
        workbook: selection.workbook,
        worksheet: selection.worksheet,
        row: baseRow,
        column: baseColumn,
      }, selectedMetrics);
      setExcelStatus('엑셀에 값이 반영되었습니다.');
      setSelection(null); // 선택된 셀 동기화 초기화
      setSelectionMessage('엑셀에서 업체명이 있는 셀을 선택한 뒤 동기화하세요.'); // 메시지 초기화
    } catch (err) {
      setExcelStatus(err.message || '엑셀 쓰기에 실패했습니다.');
    }
  };

  const generateAgreementMessages = React.useCallback(async ({ rowIncrement = 1 } = {}) => {
    setIsGeneratingAgreement(true); // 로딩 시작
    // 0. Validation
    if (!fileType) {
      setIsGeneratingAgreement(false); // alert 전에 로딩 종료
      alert('검색 파일(전기/통신/소방)을 먼저 선택하세요.'); // 팝업으로 변경
      return;
    }
    if (!noticeInfo.trim()) { // noticeTitle.trim() || !noticeNo.trim() 대신 noticeInfo.trim() 사용
      setIsGeneratingAgreement(false); // alert 전에 로딩 종료
      alert('공고명/공고번호를 입력하세요.'); // 팝업으로 변경
      return;
    }
    
    try {
      if (!window.electronAPI?.excelHelper || !window.electronAPI?.searchManyCompanies) {
        throw new Error('필수 기능(Excel 연동 또는 업체 검색)을 사용할 수 없습니다.');
      }
      const selectionResponse = await window.electronAPI.excelHelper.getSelection();
      if (!selectionResponse?.success) throw new Error(selectionResponse?.message || '현재 활성화된 엑셀 시트 정보를 가져올 수 없습니다.');
      const activeWorkbook = selectionResponse.data?.Workbook || selectionResponse.data?.workbook || '';
      const activeWorksheet = selectionResponse.data?.Worksheet || selectionResponse.data?.worksheet || '';
      if (!activeWorkbook || !activeWorksheet) {
        throw new Error('현재 활성화된 엑셀 시트 정보를 가져올 수 없습니다. 엑셀이 열려있는지 확인해주세요.');
      }

      // 1. GATHER ALL COMPANY NAMES
      console.log('--- Step 1: Gathering Company Names ---'); // 디버깅 로그 추가
      const allCompanyNames = new Set();
      const allAgreementsData = []; // Will store { row, participants: [{ name, share }] }
      let currentRow = 5;

      while (currentRow < 100) { // Safety break at 100 rows
        const checkCellResponse = await window.electronAPI.excelHelper.readOffsets({
          workbook: activeWorkbook,
          worksheet: activeWorksheet,
          baseRow: currentRow,
          baseColumn: 1, // Column A
          requests: [{ key: 'check', rowOffset: 0, colOffset: 0 }],
        });

        const cellValue = checkCellResponse?.items?.[0]?.text || checkCellResponse?.items?.[0]?.value;
        if (!checkCellResponse?.success || !cellValue) {
          console.log(`Row ${currentRow}: No cell value or read failed. Stopping.`); // 디버깅 로그 추가
          break; // Stop
        }

        const rowParticipants = [];
        for (let i = 0; i < MAX_SLOTS; i += 1) {
          const col = 3 + i;
          const slotResponse = await window.electronAPI.excelHelper.readOffsets({
            workbook: activeWorkbook,
            worksheet: activeWorksheet,
            baseRow: currentRow,
            baseColumn: col,
            requests: [{ key: 'name', rowOffset: 0, colOffset: 0 }, { key: 'share', rowOffset: 0, colOffset: 6 }],
          });
          if (slotResponse.success && slotResponse.items) {
            const nameItem = slotResponse.items.find(item => item.key === 'name');
            const shareItem = slotResponse.items.find(item => item.key === 'share');
            const rawName = nameItem?.text ?? nameItem?.value ?? '';
            console.log(`Row ${currentRow}, Slot ${i}: rawName = "${rawName}"`); // 디버깅 로그 추가
            if (rawName) {
              let cleanedName = String(rawName).split('\n')[0].replace(/\s*[\d.,%].*$/, '').trim();
              cleanedName = cleanedName.split('_')[0].trim(); // 언더바 뒤의 내용 제거
              const name = cleanedName; // 최종 이름
              console.log(`Row ${currentRow}, Slot ${i}: cleanedName = "${cleanedName}", final name = "${name}"`); // 디버깅 로그 추가
              if (name) {
                allCompanyNames.add(name);
                rowParticipants.push({
                  name,
                  share: shareItem?.value ?? null,
                });
              }
            }
          }
        }
        
        if (rowParticipants.length > 0) {
          allAgreementsData.push({ row: currentRow, participants: rowParticipants });
          console.log(`Row ${currentRow}: Participants added:`, rowParticipants); // 디버깅 로그 추가
        } else {
          console.log(`Row ${currentRow}: No participants found.`); // 디버깅 로그 추가
        }

        currentRow += rowIncrement;
      }

      console.log('All company names gathered:', Array.from(allCompanyNames)); // 디버깅 로그 추가

      if (allCompanyNames.size === 0) {
        setIsGeneratingAgreement(false); // alert 전에 로딩 종료
        alert('엑셀에서 처리할 업체를 찾지 못했습니다.'); // 팝업으로 변경
        return;
      }

      // 2. BULK SEARCH
      console.log('--- Step 2: Bulk Search ---'); // 디버깅 로그 추가
      console.log('Names to search:', Array.from(allCompanyNames));
      const searchResponse = await window.electronAPI.searchManyCompanies(Array.from(allCompanyNames), fileType);
      console.log('Bulk search response:', searchResponse);

      if (!searchResponse.success) {
        throw new Error('업체 정보 대량 조회에 실패했습니다: ' + searchResponse.message);
      }
      
      const companySearchResultMap = new Map();
      (searchResponse.data || []).forEach(company => {
        const name = pickFirstValue(company, NAME_FIELDS);
        console.log(`Search result company: raw name = "${name}", normalized name = "${normalizeName(name)}"`); // 디버깅 로그 추가
        if (name) {
          companySearchResultMap.set(normalizeName(name), company);
        }
      });
      console.log('Created companySearchResultMap:', companySearchResultMap);

      // 3. PROCESS AND GENERATE
      console.log('--- Step 3: Process and Generate ---'); // 디버깅 로그 추가
      const allPayloads = allAgreementsData.map(agreement => {
        const participants = agreement.participants.map(p => {
          const normalizedParticipantName = normalizeName(p.name);
          console.log(`Processing participant: original name = "${p.name}", normalized name = "${normalizedParticipantName}"`); // 디버깅 로그 추가
          
          let foundCompany = companySearchResultMap.get(normalizedParticipantName);
          if (!foundCompany) {
            console.log(`Exact match not found for "${normalizedParticipantName}". Trying startsWith.`); // 디버깅 로그 추가
            for (const [key, company] of companySearchResultMap.entries()) {
              if (key.startsWith(normalizedParticipantName)) {
                foundCompany = company;
                console.log(`Found company by startsWith: "${key}" for "${normalizedParticipantName}"`); // 디버깅 로그 추가
                break;
              }
            }
          }
          console.log(`Found company for "${p.name}":`, foundCompany); // 디버깅 로그 추가

          const bizNo = foundCompany ? (pickFirstValue(foundCompany, BIZ_FIELDS) || '') : '';
          const fullName = foundCompany ? (pickFirstValue(foundCompany, NAME_FIELDS) || p.name) : p.name;
          
          let finalShare = p.share;
          if (typeof p.share === 'number' && p.share > 0 && p.share <= 1) {
            finalShare = parseFloat((p.share * 100).toFixed(2));
          } else if (typeof p.share === 'number') {
            finalShare = parseFloat(p.share.toFixed(2));
          }
          
          return { ...p, name: fullName, bizNo, share: finalShare };
        });

        if (participants.length === 0) {
          console.log(`Agreement for row ${agreement.row}: No valid participants. Returning null.`); // 디버깅 로그 추가
          return null;
        }

        const leader = participants[0];
        const members = participants.slice(1);
        const payload = buildAgreementPayload(activeOwner.ownerToken, noticeInfo, leader, members); // noticeInfoContent에 noticeInfo만 전달
        
        const validation = validateAgreement(payload);
        console.log(`Agreement for row ${agreement.row}: Payload =`, payload, `Validation =`, validation, `Validation Errors =`, validation.errors); // 디버깅 로그 추가
        return validation.ok ? payload : null;
      }).filter(Boolean);

      console.log('Final allPayloads:', allPayloads); // 디버깅 로그 추가

      if (allPayloads.length === 0) {
        setIsGeneratingAgreement(false); // alert 전에 로딩 종료
        alert('유효한 협정 데이터를 찾지 못했습니다.'); // 팝업으로 변경
        return;
      }

      const text = generateMany(allPayloads);
      console.log('Generated agreement text:', text); // 디버깅 로그 추가

      if (window.electronAPI?.clipboardWriteText) {
        await window.electronAPI.clipboardWriteText(text);
      } else {
        await navigator.clipboard.writeText(text);
      }
      setIsGeneratingAgreement(false); // alert 전에 로딩 종료
      alert(`${allPayloads.length}건의 협정 문자가 클립보드에 복사되었습니다.`); // 팝업으로 변경

    } catch (err) {
      setIsGeneratingAgreement(false); // alert 전에 로딩 종료
      alert(err.message || '협정 문자 생성에 실패했습니다.'); // 팝업으로 변경
    }
  }, [fileType, noticeInfo, activeOwner.ownerToken]);

  const handleGenerateAgreement = () => {
    const rowIncrement = ownerId === 'lh' ? 2 : 1;
    generateAgreementMessages({ rowIncrement });
  };

  return (
    <div className="excel-helper-shell">
      <div className="excel-helper-header title-drag">엑셀 협정 도우미</div>
      <div className="excel-helper-body">
        <section className="excel-helper-section">
          <h1>공고 정보</h1>
          <p className="section-help">공고 정보와 발주처/금액대를 먼저 선택한 뒤, 엑셀 기준 셀을 동기화하세요.</p>
          <div className="helper-grid">
            <div>
              <label className="field-label">공고명/공고번호</label>
              <input className="input" value={noticeInfo} onChange={(e) => setNoticeInfo(e.target.value)} placeholder="예: 2024-0000 ○○○ 공사" />
            </div>
            <div>
              <label className="field-label">공고일</label>
              <input className="input" type="date" value={noticeDateInput} onChange={(e) => setNoticeDateInput(e.target.value)} />
            </div>
            <div>
              <label className="field-label">기준금액 (원)</label>
              <input className="input" value={baseAmountInput} onChange={(e) => setBaseAmountInput(e.target.value)} placeholder="예: 1000000000 (10억)" />
            </div>
          </div>
          <div className="helper-grid" style={{ marginTop: 12 }}>
            <div>
              <label className="field-label">발주처</label>
              <div className="button-group">
                {OWNER_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={option.id === ownerId ? 'btn-chip active' : 'btn-chip'}
                    onClick={() => { setOwnerId(option.id); setRangeId(option.ranges[0]?.id || ''); }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="field-label">금액대</label>
              <select className="input" value={rangeId} onChange={(e) => setRangeId(e.target.value)}>
                {availableRanges.map((range) => (
                  <option key={range.id} value={range.id}>{range.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">검색 파일 (필수)</label>
              <select className="input" value={fileType} onChange={(e) => setFileType(e.target.value)}>
                <option value="">선택하세요</option>
                {FILE_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="excel-helper-section">
          <h2>엑셀 기준 셀 지정</h2>
          <p className="section-help">엑셀에서 대표사(첫 번째) 업체명이 입력된 셀을 선택한 뒤 버튼을 눌러 좌표를 동기화하세요.</p>
          <div className="excel-helper-actions">
            <button type="button" className="primary" onClick={handleFetchSelection}>선택 셀 동기화</button>
            <span>{selectionMessage}</span>
          </div>
        </section>

        <section className="excel-helper-section">
          <h2>업체 검색 및 엑셀 반영</h2>
          <div className="excel-helper-search-row">
            <input
              className="input"
              placeholder="업체명 또는 키워드"
              value={companyQuery}
              onChange={(e) => setCompanyQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
            />
            <button type="button" className="btn-soft" onClick={handleSearch} disabled={searchLoading}>
              {searchLoading ? '검색 중...' : '검색'}
            </button>
          </div>
          {searchError && <div className="error-message" style={{ marginBottom: 12 }}>{searchError}</div>}
          <div className="table-scroll">
            <table className="details-table">
              <thead>
                <tr>
                  <th>업체명</th>
                  <th>대표자</th>
                  <th>지역</th>
                  <th>시평액</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(searchResults || []).map((company, idx) => {
                  const metrics = computeMetrics(company);
                  const isActive = selectedCompany === company;
                  const managers = extractManagerNames(company);
                  const typeKey = String(company?._file_type || fileType || '').toLowerCase();
                  const typeLabel = FILE_TYPE_LABELS[typeKey] || '';
                  const femaleOwned = isWomenOwnedCompany(company);
                  const qualityBadge = getQualityBadgeText(company);
                  return (
                    <tr key={idx} className={isActive ? 'row-active' : ''}>
                      <td>
                        <div className="company-cell">
                          <div className="company-name-line">
                            <span className="company-name-text">{metrics?.name || ''}</span>
                            {typeLabel && (
                              <span className={`file-type-badge-small file-type-${typeKey}`}>
                                {typeLabel}
                              </span>
                            )}
                            {femaleOwned && <span className="badge-female badge-inline" title="여성기업">女</span>}
                            {qualityBadge && <span className="badge-quality badge-inline">품질 {qualityBadge}</span>}
                          </div>
                          {managers.length > 0 && (
                            <div className="company-manager-badges">
                              {managers.map((name) => (
                                <span key={`${idx}-${name}`} className="badge-person">{name}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>{metrics?.representative || ''}</td>
                      <td>{metrics?.region || ''}</td>
                      <td>{metrics?.sipyungDisplay || ''}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button type="button" className="btn-sm" onClick={() => setSelectedCompany(company)}>선택</button>
                      </td>
                    </tr>
                  );
                })}
                {(!searchResults || searchResults.length === 0) && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: '#9ca3af', padding: 16 }}>
                      {searchLoading ? '검색 중입니다...' : '검색 결과가 없습니다.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="excel-helper-selected">
            <div>
              <div className="detail-label">선택된 업체</div>
              <div className="detail-value">{selectedMetrics?.name || '-'}</div>
            </div>
            <div>
              <div className="detail-label">사업자번호</div>
              <div className="detail-value">{selectedMetrics?.bizNo || '-'}</div>
            </div>
            <div>
              <div className="detail-label">경영상태점수</div>
              <div className="detail-value">{evaluatedManagementScore !== null ? formatAmount(evaluatedManagementScore) : (selectedMetrics?.managementDisplay || '-')}</div>
            </div>
            <div>
              <div className="detail-label">실적액</div>
              <div className="detail-value">{selectedMetrics?.performanceDisplay || '-'}</div>
            </div>
            <div>
              <div className="detail-label">시평액</div>
              <div className="detail-value">{selectedMetrics?.sipyungDisplay || '-'}</div>
            </div>
            <div>
              <div className="detail-label">가능지분</div>
              <div className="detail-value">{selectedMetrics?.availableShareDisplay || '-'}</div>
            </div>
            {ownerId === 'lh' && (
              <>
                <div>
                  <div className="detail-label">품질점수</div>
                  <div className="detail-value">{selectedMetrics?.qualityDisplay || '-'}</div>
                </div>
                <div>
                  <div className="detail-label">시공능력평가액</div>
                  <div className="detail-value">{selectedMetrics?.abilityDisplay || '-'}</div>
                </div>
              </>
            )}
          </div>

          <div className="excel-helper-actions">
            <div className="excel-helper-share-input">
              <label className="field-label" style={{ marginBottom: 4 }}>지분 (%)</label>
              <input
                className="input"
                value={shareInput}
                onChange={(e) => setShareInput(e.target.value)}
                placeholder="예: 40"
              />
            </div>
            <button type="button" className="primary" onClick={handleApplyToExcel}>엑셀에 채우기</button>
            {excelStatus && <span>{excelStatus}</span>}
          </div>
        </section>

        <section className="excel-helper-section">
          <h2>협정 문자 생성</h2>
          <p className="section-help">엑셀에서 협정 목록을 자동으로 읽어 문자를 생성합니다. (A열에 순번이 있는 행을 기준으로 C열부터 업체를 읽습니다)</p>
          <div className="excel-helper-actions">
            <button
              type="button"
              className="primary"
              onClick={handleGenerateAgreement}
              disabled={isGeneratingAgreement} // 로딩 중 비활성화
            >
              {isGeneratingAgreement ? '생성 중...' : '협정 문자 생성'} {/* 로딩 텍스트 */}
            </button>
            {isGeneratingAgreement && <span style={{ marginLeft: '10px' }}>잠시만 기다려주세요...</span>} {/* 추가 로딩 메시지 */}
          </div>
        </section>
      </div>
    </div>
  );
}
