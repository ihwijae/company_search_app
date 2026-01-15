import React from 'react';
import '../../../../styles.css';
import '../../../../fonts.css';
import Sidebar from '../../../../components/Sidebar';
import { loadPersisted, savePersisted } from '../../../../shared/persistence.js';
import { BASE_ROUTES } from '../../../../shared/navigation.js';
import { generateMany, validateAgreement } from '../../../../shared/agreements/generator.js';
import { extractManagerNames, getQualityBadgeText, isWomenOwnedCompany } from '../../../../utils/companyIndicators.js';
import { INDUSTRY_AVERAGES } from '../../../../ratios.js';
import { useFeedback } from '../../../../components/FeedbackProvider.jsx';
import * as XLSX from 'xlsx'; // Import xlsx library

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
    id: 'ex',
    label: '한국도로공사',
    ownerToken: '한국도로공사',
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
  {
    id: 'krail',
    label: '국가철도공단',
    ownerToken: '국가철도공단',
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
const QUALITY_FIELDS = ['품질점수', '품질평가', '품질평가점수'];
const REGION_FIELDS = ['대표지역', '지역'];
const REPRESENTATIVE_FIELDS = ['대표자', '대표자명'];
const DEBT_RATIO_FIELDS = ['부채비율', '부채 비율', 'debtRatio', 'DebtRatio'];
const CURRENT_RATIO_FIELDS = ['유동비율', 'currentRatio', 'CurrentRatio'];
const BIZ_YEARS_FIELDS = ['영업기간', '업력', 'bizYears', 'bizyears', '업력(년)', '업력'];
const AGENCIES_ALWAYS_REQUIRE_BIZ_YEARS = new Set(['PPS', 'LH', 'EX', 'KRAIL']);
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
  ex: {
    under50: 50 * WON,
    '50to100': 100 * WON,
  },
  lh: {
    under50: 50 * WON,
    '50to100': 100 * WON,
  },
  krail: {
    under50: 50 * WON,
    '50to100': 100 * WON,
  },
};
const DEFAULT_RANGE_AMOUNT = 50 * WON;

const TECHNICIAN_GRADE_OPTIONS = [
  { value: 'special', label: '특급', points: 1.0 },
  { value: 'advanced', label: '고급', points: 0.75 },
  { value: 'intermediate', label: '중급', points: 0.5 },
  { value: 'entry', label: '초급', points: 0.25 },
];

const CAREER_COEFFICIENT_OPTIONS = [
  { value: 'none', label: '없음', multiplier: 1.0 },
  { value: '5plus', label: '5년 이상', multiplier: 1.1 },
  { value: '9plus', label: '9년 이상', multiplier: 1.15 },
  { value: '12plus', label: '12년 이상', multiplier: 1.2 },
];

const MANAGEMENT_COEFFICIENT_OPTIONS = [
  { value: 'none', label: '없음', multiplier: 1.0 },
  { value: '3plus', label: '3년 이상', multiplier: 1.1 },
  { value: '6plus', label: '6년 이상', multiplier: 1.15 },
  { value: '9plus', label: '9년 이상', multiplier: 1.2 },
];

const DEFAULT_SIPYUNG_COL_OFFSET = 38;

const getTechnicianGradePoints = (value) => {
  const target = TECHNICIAN_GRADE_OPTIONS.find((option) => option.value === value);
  return target ? Number(target.points) : 0;
};

const getCoefficientMultiplier = (value, options) => {
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
  const career = getCoefficientMultiplier(entry.careerCoeff, CAREER_COEFFICIENT_OPTIONS);
  const management = getCoefficientMultiplier(entry.managementCoeff, MANAGEMENT_COEFFICIENT_OPTIONS);
  const count = getTechnicianCount(entry.count);
  return base * career * management * count;
};

const DEFAULT_OFFSETS = [
  { key: 'name', label: '업체명', rowOffset: 0, colOffset: 0 },
  { key: 'share', label: '지분', rowOffset: 0, colOffset: 6 },
  { key: 'managementScore', label: '경영상태점수', rowOffset: 0, colOffset: 13 },
  { key: 'performanceAmount', label: '실적액', rowOffset: 0, colOffset: 20 },
  { key: 'sipyungAmount', label: '시평액', rowOffset: 0, colOffset: DEFAULT_SIPYUNG_COL_OFFSET },
];

const MAX_SLOTS = 5;
const DEFAULT_SELECTION_MESSAGE = '엑셀에서 업체명이 있는 셀을 선택한 뒤 동기화하세요.';
const EXCEL_HELPER_STORAGE_KEY = 'excel-helper:state';

const buildDefaultNoticeDate = () => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

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

const MANAGEMENT_WARNING_FILL = '#ffc000';
const REGION_HIGHLIGHT_FILL = '#ffff00';
const REGION_OPTIONS = [
  '강원', '경기', '경남', '경북', '광주', '대구', '대전', '부산',
  '서울', '세종', '울산', '인천', '전남', '전북', '제주', '충남', '충북',
];

const normalizeRegionLabel = (value) => String(value || '').replace(/\s+/g, '').toLowerCase();

const computeMetrics = (company) => {
  if (!company) return null;
  const name = pickFirstValue(company, NAME_FIELDS) || '';
  const bizNo = pickFirstValue(company, BIZ_FIELDS) || '';
  const representative = pickFirstValue(company, REPRESENTATIVE_FIELDS) || '';
  const region = pickFirstValue(company, REGION_FIELDS) || '';

  const managementRaw = pickFirstValue(company, MANAGEMENT_FIELDS);
  const performanceRaw = pickFirstValue(company, PERFORMANCE_FIELDS);
  const sipyungRaw = pickFirstValue(company, SIPYUNG_FIELDS);
  const qualityRaw = pickFirstValue(company, QUALITY_FIELDS);

  const managementScore = toNumeric(managementRaw) ?? managementRaw ?? '';
  const performanceAmount = toNumeric(performanceRaw) ?? performanceRaw ?? '';
  const sipyungAmount = toNumeric(sipyungRaw) ?? sipyungRaw ?? '';
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
    qualityScore,
    qualityDisplay: formatAmount(qualityRaw || qualityScore),
    raw: company,
  };
};

const resolveSipyungColumnOffset = (ownerId, rangeId) => {
  const ownerKey = String(ownerId || '').toLowerCase();
  if (ownerKey === 'lh') {
    if (rangeId === 'under50') {
      return 41;
    }
    if (rangeId === '50to100') {
      return 43;
    }
    return DEFAULT_SIPYUNG_COL_OFFSET;
  }

  if (ownerKey === 'krail') {
    if (rangeId === 'under50') {
      return 45; // AV (C 기준 +45)
    }
    return 46; // AW (C 기준 +46)
  }

  return DEFAULT_SIPYUNG_COL_OFFSET;
};

const getOffsetsForOwner = (ownerId, rangeId) => {
  const ownerKey = String(ownerId || '').toLowerCase();
  const sipyungOffset = resolveSipyungColumnOffset(ownerKey, rangeId);
  let ownerOffsets = DEFAULT_OFFSETS.map((item) => (
    item.key === 'sipyungAmount'
      ? { ...item, colOffset: sipyungOffset }
      : item
  ));

  if (ownerKey === 'lh') {
    ownerOffsets = [...ownerOffsets, { key: 'qualityScore', label: '품질점수', rowOffset: 1, colOffset: 6 }];
  }

  if (ownerKey === 'krail') {
    ownerOffsets = [
      ...ownerOffsets,
      { key: 'technicianScore', label: '기술자점수', rowOffset: 0, colOffset: 27 },
    ];
  }

  return ownerOffsets;
};

const deriveNoticeFields = (noticeInfoContent) => {
  const raw = String(noticeInfoContent || '').trim();
  if (!raw) {
    return { noticeNo: '', title: '' };
  }
  const tokenMatch = raw.match(/^(\S+)\s+([\s\S]+)$/);
  if (tokenMatch && /\d/.test(tokenMatch[1])) {
    return { noticeNo: tokenMatch[1], title: tokenMatch[2].trim() };
  }
  return { noticeNo: '', title: raw };
};

const buildAgreementPayload = (ownerToken, noticeInfoContent, leaderEntry, memberEntries) => {
  if (!leaderEntry) return null;
  const noticeFields = deriveNoticeFields(noticeInfoContent);
  const isLH = ownerToken === 'LH';
  return {
    owner: ownerToken,
    noticeNo: noticeFields.noticeNo,
    title: noticeFields.title,
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

  // Subtract 1 to handle the exclusive upper bound (e.g., < 50억)
  // in the tier selection logic.
  return amount - 1;
};

const resolveIndustryAverage = (fileType) => {
  const key = String(fileType || '').toLowerCase();
  return INDUSTRY_AVERAGES[key] || null;
};

const CREDIT_DATE_PATTERN = /(\d{2,4})[^0-9]{0,3}(\d{1,2})[^0-9]{0,3}(\d{1,2})/; // Escaped backslashes for regex
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
  const explicit = source.match(/(~|부터|:)?\s*([0-9]{2,4}[^0-9]{0,3}[0-9]{1,2}[^0-9]{0,3}[0-9]{1,2})\s*(까지|만료|만기)/); // Escaped backslashes for regex
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
  return match ? match[1] : str.split(/[ (]/)[0];
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
  name = name.replace(/^(주|\(주\)|㈜|주\)|\(합\))/, '');
  name = name.replace(/(주|\(주\)|㈜|주\)|\(합\))$/, '');
  name = name.replace(/이앤/g, '이엔');
  name = name.replace(/앤/g, '엔');
  name = name.replace(/[^a-zA-Z0-9가-힣]/g, '');
  return name;
};

const EXCLUDED_SOLO_COMPANIES = new Set(['에코엠이엔씨', '아람이엔테크', '우진일렉트', '지음쏠라테크'].map((name) => normalizeName(name)));

const normalizeBizNumber = (value) => {
  if (!value && value !== 0) return '';
  return String(value).replace(/[^0-9]/g, '');
};

const buildCompanyOptionKey = (company) => {
  if (!company || typeof company !== 'object') return '';
  const typeToken = String(company?._file_type || '').trim().toLowerCase();
  const biz = normalizeBizNumber(pickFirstValue(company, BIZ_FIELDS));
  if (biz) return typeToken ? `${typeToken}|biz:${biz}` : `biz:${biz}`;
  const name = String(pickFirstValue(company, NAME_FIELDS) || '').trim();
  if (name) return typeToken ? `${typeToken}|name:${name}` : `name:${name}`;
  const fallback = String(company?.id || company?.rowIndex || company?.row || '');
  return fallback ? `${typeToken}|row:${fallback}` : typeToken || Math.random().toString(36).slice(2);
};

const COMMON_SURNAMES = new Set([
  '김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황',
  '안', '송', '류', '유', '홍', '전', '민', '구', '우', '문', '양', '손', '배', '백', '허', '노',
  '심', '하', '곽', '성', '차', '주', '우', '채', '남', '원', '방', '표', '변', '염', '여', '석',
  '설', '선', '현', '나', '진', '지', '위', '도', '연', '길', '엄', '복', '제', '탁', '공', '기',
]);

const COMPANY_SUFFIX_DENY = new Set([
  '건설', '공사', '전기', '전력', '토건', '토목', '산업', '정보', '통신', '소방', '기술', '기계', '기전', '기공',
  '환경', '시스템', '테크', '설비', '전설', '플랜트', '이엔지', '이엔씨', '엔지', '엔씨', '건축',
]);

const CORPORATE_PREFIX_PATTERN = /(주식회사|유한회사|농업회사법인|사단법인|재단법인|합자회사|합명회사|법인)$/;
const TRAILING_HANJA_PATTERN = /[\u3400-\u9FFF\uF900-\uFAFF]+$/u;
const JOB_TITLE_TOKENS = new Set(['부장', '차장', '과장', '팀장', '대리', '대표', '실장', '소장', '이사', '사장', '전무', '상무', '부사장', '주임', '사원']);

const looksLikePersonName = (token) => {
  if (!token) return false;
  const normalized = token.replace(/[^가-힣]/g, '');
  if (!/^[가-힣]{2,3}$/.test(normalized)) return false;
  if (!COMMON_SURNAMES.has(normalized[0])) return false;
  if (COMPANY_SUFFIX_DENY.has(normalized)) return false;
  for (const suffix of COMPANY_SUFFIX_DENY) {
    if (suffix && suffix !== normalized && normalized.endsWith(suffix)) return false;
  }
  return true;
};

const stripTrailingPersonSuffix = (text) => {
  if (!text) return '';
  const normalized = text.replace(/[^가-힣]/g, '');
  if (normalized.length <= 3) return text;
  for (let len = 3; len >= 2; len -= 1) {
    const suffix = normalized.slice(-len);
    if (!looksLikePersonName(suffix)) continue;
    const prefix = normalized.slice(0, -len);
    if (!prefix || prefix.length < 3) continue;
    if (looksLikePersonName(prefix) && prefix.length <= 3) continue;
    const idx = text.lastIndexOf(suffix);
    if (idx > 0) {
      const candidate = text.slice(0, idx).trim();
      if (candidate) return candidate;
    }
  }
  return text;
};

const cleanCompanyName = (rawName) => {
  if (!rawName) return '';
  const original = String(rawName);
  let primary = original.split('\n')[0];
  primary = primary.replace(/\r/g, '');
  const hasDelimiterHints = /[0-9_%]/.test(primary) || /[_\n\r]/.test(original);
  primary = primary.replace(/\s*[\d.,%][\s\S]*$/, '');
  primary = primary.split('_')[0];
  let trimmed = primary.replace(/\s+/g, ' ').trim();
  if (!trimmed) return '';

  let tokens = trimmed.split(' ').filter(Boolean);
  while (tokens.length > 1) {
    const last = tokens[tokens.length - 1];
    const normalized = last.replace(/[^가-힣]/g, '');
    if (!normalized) {
      tokens.pop();
      continue;
    }
    if (JOB_TITLE_TOKENS.has(normalized)) {
      tokens.pop();
      continue;
    }
    const precedingRaw = tokens.slice(0, -1).join(' ').trim();
    if (!precedingRaw) break;
    const precedingNormalized = precedingRaw.replace(/[^가-힣]/g, '');
    if (!looksLikePersonName(normalized)) break;
    if (CORPORATE_PREFIX_PATTERN.test(precedingNormalized)) break;
    tokens.pop();
    break;
  }
  let result = tokens.join(' ').trim();
  if (tokens.length <= 1 && hasDelimiterHints) {
    result = stripTrailingPersonSuffix(result);
  }
  if (hasDelimiterHints) {
    const strippedHanja = result.replace(TRAILING_HANJA_PATTERN, '').trim();
    if (strippedHanja && strippedHanja !== result && /[a-zA-Z0-9가-힣]/.test(strippedHanja)) {
      result = strippedHanja;
    }
  }
  return result;
};

const buildRerunNameCandidates = (name) => {
  if (!name) return [];
  const base = String(name).trim();
  if (!base) return [];
  const variants = new Set();
  const swapToAen = base.replace(/이엔/g, '이앤');
  if (swapToAen !== base) variants.add(swapToAen);
  const swapToEn = base.replace(/이앤/g, '이엔');
  if (swapToEn !== base) variants.add(swapToEn);
  return Array.from(variants);
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
  const dateMatch = text.match(/(\d{4})[^0-9]*(\d{1,2})[^0-9]*(\d{1,2})/); // Escaped backslashes for regex
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
  const yearMonthMatch = normalized.match(/(\d+(?:\.\d+)?)\s*년\s*(\d+(?:\.\d+)?)?\s*개월?/); // Escaped backslashes for regex
  if (yearMonthMatch) {
    const yearsPart = Number(yearMonthMatch[1]);
    const monthsPart = yearMonthMatch[2] != null ? Number(yearMonthMatch[2]) : 0;
    const total = (Number.isFinite(yearsPart) ? yearsPart : 0) + (Number.isFinite(monthsPart) ? monthsPart / 12 : 0);
    return Number.isFinite(total) && total > 0 ? total : null;
  }
  const monthsOnlyMatch = normalized.match(/(\d+(?:\.\d+)?)\s*개월/); // Escaped backslashes for regex
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

const getValidatedQualityScore = (company) => {
  const defaultScore = 85;
  const qualityRaw = pickFirstValue(company, QUALITY_FIELDS);

  if (!qualityRaw || typeof qualityRaw !== 'string') {
    return defaultScore;
  }

  const match = String(qualityRaw).match(/(\d+\.?\d*)\s*\((\d{2,4})[.-](\d{1,2})[.-](\d{1,2})\)/); // Escaped backslashes for regex

  if (!match) {
    return defaultScore;
  }

  const score = parseFloat(match[1]);
  let year = parseInt(match[2], 10);
  const month = parseInt(match[3], 10);
  const day = parseInt(match[4], 10);

  if (year < 100) {
    year += 2000;
  }

  const issueDate = new Date(year, month - 1, day);
  // The score is valid until May 1st of the year after the issue date.
  const expiryDate = new Date(issueDate.getFullYear() + 1, 4, 1); // Month is 0-indexed, so 4 is May.
  const now = new Date();

  if (now >= expiryDate) {
    return defaultScore; // Expired
  }

  return score; // Valid
};

export default function ExcelHelperPage() {
  React.useEffect(() => {
    const previousTitle = document.title;
    document.title = '엑셀 협정 도우미';
    return () => {
      document.title = previousTitle || '협정보조';
    };
  }, []);

  const persistedState = React.useMemo(() => loadPersisted(EXCEL_HELPER_STORAGE_KEY, null) || {}, []);
  const getPersisted = (key, fallback) => (
    Object.prototype.hasOwnProperty.call(persistedState, key)
      ? persistedState[key]
      : fallback
  );
  const initialNoticeDate = React.useMemo(() => (
    getPersisted('noticeDateInput', buildDefaultNoticeDate())
  ), [persistedState]);

  const strongLabelStyle = React.useMemo(() => ({
    display: 'block',
    marginBottom: '6px',
    fontWeight: 600,
    fontSize: '14px',
    color: '#0f172a',
  }), []);
  const searchFileHighlightStyle = React.useMemo(() => ({
    border: '2px solid #2563eb',
    background: '#eff6ff',
    borderRadius: '10px',
    padding: '10px 12px',
    boxShadow: '0 1px 2px rgba(37, 99, 235, 0.15)',
  }), []);

  const handleSidebarSelect = React.useCallback((key) => {
    if (!key) return;
    if (key === 'search') { window.location.hash = BASE_ROUTES.search; return; }
    if (key === 'agreements') { window.location.hash = BASE_ROUTES.agreementBoard; return; }
    if (key === 'region-search') { window.location.hash = BASE_ROUTES.regionSearch; return; }
    if (key === 'agreements-sms') { window.location.hash = BASE_ROUTES.agreements; return; }
    if (key === 'auto-agreement') { window.location.hash = BASE_ROUTES.autoAgreement; return; }
    if (key === 'records') { window.location.hash = '#/records'; return; }
    if (key === 'mail') { window.location.hash = '#/mail'; return; }
    if (key === 'excel-helper') { window.location.hash = '#/excel-helper'; return; }
    if (key === 'settings') { window.location.hash = BASE_ROUTES.settings; return; }
    if (key === 'upload') { window.location.hash = BASE_ROUTES.agreementBoard; }
  }, []);

  const [ownerId, setOwnerId] = React.useState(() => getPersisted('ownerId', ''));
  const [rangeId, setRangeId] = React.useState(() => getPersisted('rangeId', ''));
  const [fileType, setFileType] = React.useState(() => getPersisted('fileType', ''));
  const [selection, setSelection] = React.useState(() => getPersisted('selection', null));
  const [selectionMessage, setSelectionMessage] = React.useState(() => getPersisted('selectionMessage', DEFAULT_SELECTION_MESSAGE));
  const [companyQuery, setCompanyQuery] = React.useState(() => getPersisted('companyQuery', ''));
  const [searchResults, setSearchResults] = React.useState([]);
  const [searchLoading, setSearchLoading] = React.useState(false);
  const [searchError, setSearchError] = React.useState('');
  const [selectedCompany, setSelectedCompany] = React.useState(null);
  const [shareInput, setShareInput] = React.useState(() => getPersisted('shareInput', ''));
  const [noticeInfo, setNoticeInfo] = React.useState(() => getPersisted('noticeInfo', ''));
  const [noticeDateInput, setNoticeDateInput] = React.useState(initialNoticeDate);
  const [baseAmountInput, setBaseAmountInput] = React.useState(() => getPersisted('baseAmountInput', ''));
  const [excelStatus, setExcelStatus] = React.useState(() => getPersisted('excelStatus', ''));
  const [messageStatus, setMessageStatus] = React.useState(() => getPersisted('messageStatus', ''));
  const [messagePreview, setMessagePreview] = React.useState(() => getPersisted('messagePreview', ''));
  const [evaluatedManagementScore, setEvaluatedManagementScore] = React.useState(null);
  const [managementScoreMeta, setManagementScoreMeta] = React.useState({ maxScore: null, isPerfect: false });
  const [isGeneratingAgreement, setIsGeneratingAgreement] = React.useState(false); // 새 상태 추가
  const [technicianEntries, setTechnicianEntries] = React.useState(() => getPersisted('technicianEntries', []));
  const [selectedRegions, setSelectedRegions] = React.useState(() => getPersisted('selectedRegions', []));
  const [regionMenuOpen, setRegionMenuOpen] = React.useState(false);
  const regionMenuContainerRef = React.useRef(null);

  // New states for file upload
  const [uploadedFile, setUploadedFile] = React.useState(null);
  const [uploadedWorkbook, setUploadedWorkbook] = React.useState(null);
  const [sheetNames, setSheetNames] = React.useState([]);
  const [selectedSheet, setSelectedSheet] = React.useState('');
  const [formatFile, setFormatFile] = React.useState(null);
  const [isFormatting, setIsFormatting] = React.useState(false);
  const [pendingAgreementContext, setPendingAgreementContext] = React.useState(null);
  const [companyConflictSelections, setCompanyConflictSelections] = React.useState(() => getPersisted('companyConflictSelections', {}));
  const [companyConflictModal, setCompanyConflictModal] = React.useState({ open: false, entries: [], isResolving: false });

  React.useEffect(() => {
    savePersisted(EXCEL_HELPER_STORAGE_KEY, {
      ownerId,
      rangeId,
      fileType,
      selection,
      selectionMessage,
      companyQuery,
      shareInput,
      noticeInfo,
      noticeDateInput,
      baseAmountInput,
      excelStatus,
      messageStatus,
      messagePreview,
      selectedRegions,
      technicianEntries,
      companyConflictSelections,
    });
  }, [
    ownerId,
    rangeId,
    fileType,
    selection,
    selectionMessage,
    companyQuery,
    shareInput,
    noticeInfo,
    noticeDateInput,
    baseAmountInput,
    excelStatus,
    messageStatus,
    messagePreview,
    selectedRegions,
    technicianEntries,
    companyConflictSelections,
  ]);

  const resetAgreementContext = React.useCallback(() => {
    setNoticeInfo('');
    setBaseAmountInput('');
    setOwnerId('');
    setRangeId('');
    setFileType('');
    setSelectedRegions([]);
  }, []);

  const appliedCellsRef = React.useRef(new Map());

  const activeOwner = React.useMemo(() => OWNER_OPTIONS.find((o) => o.id === ownerId) || null, [ownerId]);
  const ownerToken = activeOwner?.ownerToken || '';
  const availableRanges = activeOwner?.ranges || [];
  const isKrailOwner = ownerId === 'krail';

  React.useEffect(() => {
    if (!isKrailOwner && technicianEntries.length > 0) {
      setTechnicianEntries([]);
    }
  }, [isKrailOwner, technicianEntries.length]);

  const addTechnicianEntry = React.useCallback(() => {
    setTechnicianEntries((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        grade: '',
        careerCoeff: 'none',
        managementCoeff: 'none',
        count: '1',
      },
    ]);
  }, []);

  const updateTechnicianEntry = React.useCallback((id, field, value) => {
    setTechnicianEntries((prev) => prev.map((entry) => (
      entry.id === id ? { ...entry, [field]: value } : entry
    )));
  }, []);

  const removeTechnicianEntry = React.useCallback((id) => {
    setTechnicianEntries((prev) => prev.filter((entry) => entry.id !== id));
  }, []);

  const technicianScoreTotal = React.useMemo(() => {
    return technicianEntries.reduce((sum, entry) => sum + computeTechnicianScore(entry), 0);
  }, [technicianEntries]);

  React.useEffect(() => {
    if (!availableRanges.length) {
      if (rangeId !== '') setRangeId('');
      return;
    }
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

  const selectedRegionSet = React.useMemo(() => (
    new Set(selectedRegions.map((region) => normalizeRegionLabel(region)))
  ), [selectedRegions]);

  React.useEffect(() => {
    setShareInput('');
    setEvaluatedManagementScore(null); // selectedCompany 변경 시 초기화
    setManagementScoreMeta({ maxScore: null, isPerfect: false });
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

    const agencyNeedsBizYears = AGENCIES_ALWAYS_REQUIRE_BIZ_YEARS.has(agencyId)
      || (agencyId === 'MOIS' && (rangeId === '30to50' || rangeId === '50to100'));
    if (agencyNeedsBizYears) {
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
      const metaMax = Number(response?.data?.management?.meta?.maxScore);
      const metaIsPerfect = Boolean(response?.data?.management?.meta?.isPerfect);
      if (Number.isFinite(score)) {
        setEvaluatedManagementScore(score); // 계산된 점수 상태에 저장
        setManagementScoreMeta({
          maxScore: Number.isFinite(metaMax) ? metaMax : null,
          isPerfect: metaIsPerfect || (Number.isFinite(metaMax) && Math.abs(score - metaMax) < 1e-6),
        });
        return score;
      }
    } catch (err) {
      console.warn('[ExcelHelper] excelHelperFormulasEvaluate failed:', err?.message || err);
    }
    setEvaluatedManagementScore(null); // 에러 발생 시 초기화
    setManagementScoreMeta({ maxScore: null, isPerfect: false });
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

  const handleToggleRegion = React.useCallback((region) => {
    if (!region) return;
    setSelectedRegions((prev) => (
      prev.includes(region)
        ? prev.filter((item) => item !== region)
        : [...prev, region]
    ));
  }, []);

  const handleClearRegions = React.useCallback(() => {
    setSelectedRegions([]);
  }, []);

  React.useEffect(() => {
    if (!regionMenuOpen) return undefined;
    const handleClickOutside = (event) => {
      if (regionMenuContainerRef.current && !regionMenuContainerRef.current.contains(event.target)) {
        setRegionMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [regionMenuOpen]);

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

    const offsets = getOffsetsForOwner(ownerId, rangeId);
    const updates = offsets
      .map((field) => {
        let source = null;
        let finalValue = null;
        let fillColor = null;
        let clearFill = false;

        if (ownerId === 'lh' && field.key === 'qualityScore') {
          source = getValidatedQualityScore(selectedCompany);
          finalValue = coerceExcelValue(source);
        } else if (field.key === 'share') {
          source = normalizeShareInput(shareInput);
          finalValue = coerceExcelValue(source);
        } else if (field.key === 'managementScore') {
          source = managementScore ?? selectedMetrics[field.key];
          finalValue = coerceExcelValue(source);
          const numericScore = Number(source);
          const numericMax = Number(managementScoreMeta.maxScore);
          if (Number.isFinite(numericScore) && Number.isFinite(numericMax)) {
            if (Math.abs(numericScore - numericMax) > 1e-6) {
              fillColor = MANAGEMENT_WARNING_FILL;
            } else {
              clearFill = true;
            }
          } else if (managementScoreMeta.isPerfect) {
            clearFill = true;
          }
        } else if (field.key === 'name') {
          const rawCompanyName = selectedMetrics?.name || '';
          const companyName = normalizeName(rawCompanyName);
          const availableShareValue = selectedMetrics?.availableShare;
          const availableShare = (Number.isFinite(availableShareValue) && availableShareValue < 100)
            ? ` ${availableShareValue}` : '';
          const managers = extractManagerNames(selectedCompany);
          const managerNames = managers.length > 0 ? ` ${managers.join(', ')}` : '';
          source = `${companyName}${availableShare}${managerNames}`;
          finalValue = source;
          const normalizedCompanyRegion = normalizeRegionLabel(selectedMetrics?.region);
          if (selectedRegionSet.size > 0 && normalizedCompanyRegion && selectedRegionSet.has(normalizedCompanyRegion)) {
            fillColor = REGION_HIGHLIGHT_FILL;
          } else if (selectedRegionSet.size > 0) {
            clearFill = true;
          }
        } else if (field.key === 'technicianScore') {
          if (!technicianEntries.length) {
            return null;
          }
          source = Number(technicianScoreTotal.toFixed(2));
          finalValue = coerceExcelValue(source);
        } else {
          source = selectedMetrics[field.key];
          finalValue = coerceExcelValue(source);
        }
        
        const updatePayload = {
          rowOffset: field.rowOffset || 0,
          colOffset: field.colOffset || 0,
          value: finalValue,
          field: field.key,
        };
        if (fillColor) updatePayload.fillColor = fillColor;
        if (clearFill) updatePayload.clearFill = true;
        return updatePayload;
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
      setSelection(null);
      setSelectionMessage('엑셀에서 업체명이 있는 셀을 선택한 뒤 동기화하세요.');
    } catch (err) {
      setExcelStatus(err.message || '엑셀 쓰기에 실패했습니다.');
    }
  };

  // Handle file upload
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setUploadedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        setUploadedWorkbook(workbook);
        setSheetNames(workbook.SheetNames || []);
        setSelectedSheet(workbook.SheetNames?.[0] || '');
      };
      reader.readAsArrayBuffer(file);
    } else {
      setUploadedFile(null);
      setUploadedWorkbook(null);
      setSheetNames([]);
      setSelectedSheet('');
    }
  };

  const fileInputRef = React.useRef(null);
  const formatFileInputRef = React.useRef(null);

  const handleClearUploadedFile = React.useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setUploadedFile(null);
    setUploadedWorkbook(null);
    setSheetNames([]);
    setSelectedSheet('');
  }, []);

  const { notify } = useFeedback();

  const handleFormatFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setFormatFile(file);
    } else {
      setFormatFile(null);
    }
  };

  const handleClearFormatFile = React.useCallback(() => {
    if (formatFileInputRef.current) {
      formatFileInputRef.current.value = '';
    }
    setFormatFile(null);
  }, []);

  const handleFormatWorkbook = async () => {
    if (!formatFile?.path) {
      notify({ type: 'info', message: '엑셀 파일을 선택하세요.' });
      return;
    }
    if (!window.electronAPI?.excelHelper?.formatUploaded) {
      notify({ type: 'error', message: '엑셀 서식 변환 기능을 사용할 수 없습니다.' });
      return;
    }
    setIsFormatting(true);
    try {
      const response = await window.electronAPI.excelHelper.formatUploaded({ path: formatFile.path });
      if (!response?.success) throw new Error(response?.message || '엑셀 서식 변환에 실패했습니다.');
      notify({
        type: 'success',
        message: response?.path ? `변환이 완료되었습니다. (${response.path})` : '변환이 완료되었습니다.',
      });
    } catch (err) {
      notify({ type: 'error', message: err.message || '엑셀 서식 변환에 실패했습니다.' });
    } finally {
      setIsFormatting(false);
    }
  };

  // Handle sheet selection
  const handleSheetSelect = (event) => {
    setSelectedSheet(event.target.value);
  };

  const continueAgreementGeneration = React.useCallback(async (context, selectionOverrides = null) => {
    const agreements = Array.isArray(context?.agreements) ? context.agreements : [];
    const candidateEntries = context?.candidatesMap instanceof Map
      ? Array.from(context.candidatesMap.entries())
      : Array.isArray(context?.candidatesMap)
        ? context.candidatesMap
        : [];
    const candidatesMap = new Map(candidateEntries);
    if (!agreements.length) {
      throw new Error('유효한 협정 데이터를 찾지 못했습니다.');
    }

    const selectionMap = selectionOverrides || companyConflictSelections;

    const allPayloads = agreements.map((agreement) => {
      const participants = agreement.participants.map((p) => {
        const normalizedParticipantName = normalizeName(p.name);
        let candidates = normalizedParticipantName ? (candidatesMap.get(normalizedParticipantName) || []) : [];
        if (normalizedParticipantName && !candidates.length) {
          for (const [key, list] of candidatesMap.entries()) {
            if (key.startsWith(normalizedParticipantName) && list.length) {
              candidates = list;
              break;
            }
          }
        }

        let foundCompany = null;
        if (candidates.length === 1) {
          foundCompany = candidates[0];
        } else if (candidates.length > 1) {
          const savedKey = selectionMap?.[normalizedParticipantName];
          if (savedKey) {
            foundCompany = candidates.find((candidate) => buildCompanyOptionKey(candidate) === savedKey) || null;
          }
          if (!foundCompany) {
            foundCompany = candidates[0];
          }
        }

        const targetCompany = foundCompany || candidates[0] || null;
        const bizNo = targetCompany ? (pickFirstValue(targetCompany, BIZ_FIELDS) || '') : '';
        const fullNameRaw = targetCompany ? (pickFirstValue(targetCompany, NAME_FIELDS) || p.name) : p.name;
        const fullName = cleanCompanyName(fullNameRaw) || cleanCompanyName(p.name) || fullNameRaw;

        let finalShare = p.share;
        const shareAsNumber = parseFloat(String(p.share).replace('%', ''));
        if (Number.isFinite(shareAsNumber)) {
          if (shareAsNumber > 0 && shareAsNumber <= 1) {
            finalShare = shareAsNumber * 100;
          } else {
            finalShare = shareAsNumber;
          }
          finalShare = parseFloat(finalShare.toPrecision(12));
        }

        return { ...p, name: fullName, bizNo, share: finalShare };
      }).filter(Boolean);

      if (participants.length === 0) {
        return null;
      }

      const leader = participants[0];
      const members = participants.slice(1);
      const isSoloBid = members.length === 0 && Number(leader.share) === 100;
      const normalizedLeaderName = normalizeName(leader.name);
      if (isSoloBid && EXCLUDED_SOLO_COMPANIES.has(normalizedLeaderName)) {
        console.log(`[generateAgreementMessages] Excluding solo bid by blacklisted company: ${leader.name}`);
        return null;
      }

      const payload = buildAgreementPayload(ownerToken, noticeInfo, leader, members);
      const validation = validateAgreement(payload);
      return validation.ok ? payload : null;
    }).filter(Boolean);

    console.log('[generateAgreementMessages] Final allPayloads before generation:', allPayloads);

    if (!allPayloads.length) {
      throw new Error('유효한 협정 데이터를 찾지 못했습니다.');
    }

    const text = generateMany(allPayloads);
    if (window.electronAPI?.clipboardWriteText) {
      await window.electronAPI.clipboardWriteText(text);
    } else {
      await navigator.clipboard.writeText(text);
    }
    alert(`${allPayloads.length}건의 협정 문자가 클립보드에 복사되었습니다.`);
    resetAgreementContext();
    setPendingAgreementContext(null);
  }, [companyConflictSelections, noticeInfo, ownerToken, resetAgreementContext]);

  const handleCompanyConflictPick = React.useCallback((normalizedName, company) => {
    if (!normalizedName || !company) return;
    const key = buildCompanyOptionKey(company);
    setCompanyConflictSelections((prev) => ({
      ...prev,
      [normalizedName]: key,
    }));
  }, []);

  const handleCompanyConflictCancel = React.useCallback(() => {
    setCompanyConflictModal({ open: false, entries: [], isResolving: false });
    setPendingAgreementContext(null);
  }, []);

  const handleCompanyConflictConfirm = React.useCallback(async () => {
    if (!pendingAgreementContext) {
      setCompanyConflictModal({ open: false, entries: [], isResolving: false });
      return;
    }

    const unresolved = (companyConflictModal.entries || []).filter((entry) => {
      const selectedKey = companyConflictSelections?.[entry.normalizedName];
      if (!selectedKey) return true;
      return !entry.options.some((option) => buildCompanyOptionKey(option) === selectedKey);
    });

    if (unresolved.length > 0) {
      alert('중복된 업체마다 하나씩 선택해 주세요.');
      return;
    }

    setCompanyConflictModal((prev) => ({ ...prev, isResolving: true }));
    setIsGeneratingAgreement(true);
    try {
      await continueAgreementGeneration(pendingAgreementContext, companyConflictSelections);
      setCompanyConflictModal({ open: false, entries: [], isResolving: false });
      setPendingAgreementContext(null);
    } catch (err) {
      alert(err.message || '협정 문자 생성에 실패했습니다.');
      setCompanyConflictModal((prev) => ({ ...prev, isResolving: false }));
    } finally {
      setIsGeneratingAgreement(false);
    }
  }, [companyConflictModal.entries, companyConflictSelections, continueAgreementGeneration, pendingAgreementContext]);

  const generateAgreementMessages = React.useCallback(async () => {
    setIsGeneratingAgreement(true); // 로딩 시작
    setPendingAgreementContext(null);
    setCompanyConflictModal({ open: false, entries: [], isResolving: false });
    // 0. Validation
    if (!ownerId) {
      setIsGeneratingAgreement(false);
      alert('발주처를 선택하세요.');
      return;
    }
    if (!fileType) {
      setIsGeneratingAgreement(false); // alert 전에 로딩 종료
      alert('검색 파일(전기/통신/소방)을 먼저 선택하세요.'); // 팝업으로 변경
      return;
    }
    if (!uploadedWorkbook) {
      setIsGeneratingAgreement(false);
      alert('협정 대상 엑셀 파일을 업로드하세요.');
      return;
    }
    if (!selectedSheet) {
      setIsGeneratingAgreement(false);
      alert('엑셀 시트를 선택하세요.');
      return;
    }
    if (!noticeInfo.trim()) { // noticeTitle.trim() || !noticeNo.trim() 대신 noticeInfo.trim() 사용
      setIsGeneratingAgreement(false); // alert 전에 로딩 종료
      alert('공고명/공고번호를 입력하세요.'); // 팝업으로 변경
      return;
    }
    
    try {
      // Determine data source: uploaded file or live Excel
      let sourceWorkbook = null;
      let sourceWorksheet = null;
      let isUploadedFileSource = false;

      if (uploadedWorkbook && selectedSheet) {
        sourceWorkbook = uploadedWorkbook;
        sourceWorksheet = selectedSheet;
        isUploadedFileSource = true;
        console.log('[generateAgreementMessages] Using uploaded file as source:', uploadedFile.name, 'Sheet:', selectedSheet);
      } else if (window.electronAPI?.excelHelper) {
        const selectionResponse = await window.electronAPI.excelHelper.getSelection();
        if (!selectionResponse?.success) throw new Error(selectionResponse?.message || '현재 활성화된 엑셀 시트 정보를 가져올 수 없습니다.');
        sourceWorkbook = selectionResponse.data?.Workbook || selectionResponse.data?.workbook || '';
        sourceWorksheet = selectionResponse.data?.Worksheet || selectionResponse.data?.worksheet || '';
        console.log('[generateAgreementMessages] Using live Excel as source:', sourceWorkbook, 'Sheet:', sourceWorksheet);
      } else {
        throw new Error('엑셀 데이터 소스를 찾을 수 없습니다. 파일을 업로드하거나 엑셀을 동기화해주세요.');
      }

      if (!sourceWorkbook || !sourceWorksheet) {
        throw new Error('유효한 엑셀 워크북 또는 워크시트 정보를 찾을 수 없습니다.');
      }

      // 1. GATHER ALL COMPANY NAMES
      console.log('[generateAgreementMessages] Step 1: Gathering Company Names');
      const allCompanyNames = new Set();
      const allAgreementsData = []; // Will store { row, participants: [{ name, share }] }
      const normalizedCompanyDisplayMap = new Map();
      let currentRow = 5;
      const isLhOwner = ownerId === 'lh';
      const maxConsecutiveEmptyRows = isLhOwner ? 2 : 1;
      let consecutiveEmptyRows = 0;

      while (currentRow < 100) { // Safety break at 100 rows
        let cellValue = null;
        let slotResponses = [];

        if (isUploadedFileSource) {
          const sheet = sourceWorkbook.Sheets[sourceWorksheet];
          const cellAddress = XLSX.utils.encode_cell({ r: currentRow - 1, c: 0 }); // Column A
          cellValue = sheet[cellAddress] ? XLSX.utils.format_cell(sheet[cellAddress]) : null;
          console.log(`[generateAgreementMessages] Uploaded File - Row ${currentRow}, Column A (check cell):`, cellValue);

          if (cellValue) {
            for (let i = 0; i < MAX_SLOTS; i += 1) {
              const col = 3 + i; // Column D onwards (C is 3rd column, so D is 4th, which is index 3)
              const nameCellAddress = XLSX.utils.encode_cell({ r: currentRow - 1, c: col - 1 }); // C column is index 2, D is 3
              const shareCellAddress = XLSX.utils.encode_cell({ r: currentRow - 1, c: col + 6 - 1 }); // colOffset 6
              
              const nameItem = sheet[nameCellAddress] ? XLSX.utils.format_cell(sheet[nameCellAddress]) : '';
              const shareItem = sheet[shareCellAddress] ? XLSX.utils.format_cell(sheet[shareCellAddress]) : null;
              
              console.log(`[generateAgreementMessages] Uploaded File - Row ${currentRow}, Slot ${i}: Name Cell: ${nameCellAddress}, Value: "${nameItem}" | Share Cell: ${shareCellAddress}, Value: "${shareItem}"`);

              slotResponses.push({
                success: true,
                items: [
                  { key: 'name', text: nameItem, value: nameItem },
                  { key: 'share', text: shareItem, value: shareItem },
                ]
              });
            }
          }
        } else { // Live Excel
          const checkCellResponse = await window.electronAPI.excelHelper.readOffsets({
            workbook: sourceWorkbook,
            worksheet: sourceWorksheet,
            baseRow: currentRow,
            baseColumn: 1, // Column A
            requests: [{ key: 'check', rowOffset: 0, colOffset: 0 }],
          });
          cellValue = checkCellResponse?.items?.[0]?.text || checkCellResponse?.items?.[0]?.value;
          console.log(`[generateAgreementMessages] Live Excel - Row ${currentRow}, Column A (check cell):`, cellValue);

          if (cellValue) {
            for (let i = 0; i < MAX_SLOTS; i += 1) {
              const col = 3 + i;
              const slotResponse = await window.electronAPI.excelHelper.readOffsets({
                workbook: sourceWorkbook,
                worksheet: sourceWorksheet,
                baseRow: currentRow,
                baseColumn: col,
                requests: [{ key: 'name', rowOffset: 0, colOffset: 0 }, { key: 'share', rowOffset: 0, colOffset: 6 }],
              });
              slotResponses.push(slotResponse);
            }
          }
        }

        if (!cellValue) {
          console.log(`[generateAgreementMessages] Stopping at row ${currentRow} due to empty check cell.`);
          consecutiveEmptyRows += 1;
          if (!isLhOwner || consecutiveEmptyRows >= maxConsecutiveEmptyRows) {
            break; // Stop
          }
          currentRow += 1;
          continue;
        }

        const rowParticipants = [];
        for (const slotResponse of slotResponses) {
          if (slotResponse.success && slotResponse.items) {
            const nameItem = slotResponse.items.find(item => item.key === 'name');
            const shareItem = slotResponse.items.find(item => item.key === 'share');
            const rawName = nameItem?.text ?? nameItem?.value ?? '';
            const cleanedName = cleanCompanyName(rawName);
            if (cleanedName) {
              allCompanyNames.add(cleanedName);
              const normalizedCompanyName = normalizeName(cleanedName);
              if (normalizedCompanyName && !normalizedCompanyDisplayMap.has(normalizedCompanyName)) {
                normalizedCompanyDisplayMap.set(normalizedCompanyName, cleanedName);
              }
              rowParticipants.push({
                name: cleanedName,
                share: shareItem?.value ?? null,
              });
            }
          }
        }
        
        if (rowParticipants.length > 0) {
          allAgreementsData.push({ row: currentRow, participants: rowParticipants });
          console.log(`[generateAgreementMessages] Row ${currentRow} participants:`, rowParticipants);
          consecutiveEmptyRows = 0;
        } else {
          console.log(`[generateAgreementMessages] Row ${currentRow}: No valid participants found.`);
          if (isLhOwner) {
            consecutiveEmptyRows += 1;
            if (consecutiveEmptyRows >= maxConsecutiveEmptyRows) {
              break;
            }
          } else {
            consecutiveEmptyRows = 0;
          }
          currentRow += 1;
          continue;
        }

        currentRow += 1;
      }
      console.log('[generateAgreementMessages] Final allCompanyNames:', Array.from(allCompanyNames));
      console.log('[generateAgreementMessages] Final allAgreementsData:', allAgreementsData);

      if (allCompanyNames.size === 0) {
        setIsGeneratingAgreement(false); // alert 전에 로딩 종료
        alert('엑셀에서 처리할 업체를 찾지 못했습니다.'); // 팝업으로 변경
        return;
      }

      // 2. BULK SEARCH
      console.log('[generateAgreementMessages] Step 2: Bulk Search for companies.');
      const searchResponse = await window.electronAPI.searchManyCompanies(Array.from(allCompanyNames), fileType);
      console.log('[generateAgreementMessages] Bulk search response:', searchResponse);

      if (!searchResponse.success) {
        throw new Error('업체 정보 대량 조회에 실패했습니다: ' + searchResponse.message);
      }
      
      const companySearchResultMap = new Map();
      (searchResponse.data || []).forEach((company) => {
        const name = pickFirstValue(company, NAME_FIELDS);
        const normalized = normalizeName(name);
        if (!normalized) return;
        if (!companySearchResultMap.has(normalized)) {
          companySearchResultMap.set(normalized, []);
        }
        companySearchResultMap.get(normalized).push(company);
      });
      console.log('[generateAgreementMessages] companySearchResultMap:', companySearchResultMap);

      const rerunNames = new Set();
      normalizedCompanyDisplayMap.forEach((displayName, normalized) => {
        if (companySearchResultMap.has(normalized)) return;
        const candidates = buildRerunNameCandidates(displayName);
        candidates.forEach((candidate) => rerunNames.add(candidate));
      });

      if (rerunNames.size > 0) {
        console.log('[generateAgreementMessages] Rerunning search for candidates:', Array.from(rerunNames));
        const rerunResponse = await window.electronAPI.searchManyCompanies(Array.from(rerunNames), fileType);
        console.log('[generateAgreementMessages] Rerun search response:', rerunResponse);
        if (rerunResponse.success) {
          (rerunResponse.data || []).forEach((company) => {
            const name = pickFirstValue(company, NAME_FIELDS);
            const normalized = normalizeName(name);
            if (!normalized) return;
            if (!companySearchResultMap.has(normalized)) {
              companySearchResultMap.set(normalized, []);
            }
            companySearchResultMap.get(normalized).push(company);
          });
        }
      }

      const conflictDisplayMap = new Map();
      allAgreementsData.forEach((agreement) => {
        agreement.participants.forEach((participant) => {
          const normalized = normalizeName(participant.name);
          if (normalized && !conflictDisplayMap.has(normalized)) {
            conflictDisplayMap.set(normalized, participant.name);
          }
        });
      });

      const conflictEntries = [];
      for (const [normalized, displayName] of conflictDisplayMap.entries()) {
        const candidates = companySearchResultMap.get(normalized) || [];
        if (candidates.length <= 1) continue;
        const savedKey = companyConflictSelections?.[normalized];
        const hasValidSelection = savedKey
          ? candidates.some((candidate) => buildCompanyOptionKey(candidate) === savedKey)
          : false;
        if (hasValidSelection) continue;
        conflictEntries.push({
          normalizedName: normalized,
          displayName: normalizedCompanyDisplayMap.get(normalized) || displayName || normalized,
          options: candidates,
        });
      }

      const context = {
        agreements: allAgreementsData,
        candidatesMap: Array.from(companySearchResultMap.entries()),
      };

      if (conflictEntries.length > 0) {
        setPendingAgreementContext(context);
        setCompanyConflictModal({ open: true, entries: conflictEntries, isResolving: false });
        setIsGeneratingAgreement(false);
        return;
      }

      await continueAgreementGeneration(context);
      setIsGeneratingAgreement(false);

    } catch (err) {
      setIsGeneratingAgreement(false); // alert 전에 로딩 종료
      alert(err.message || '협정 문자 생성에 실패했습니다.'); // 팝업으로 변경
    }
  }, [fileType, noticeInfo, ownerToken, uploadedWorkbook, selectedSheet, ownerId, uploadedFile, companyConflictSelections, continueAgreementGeneration, resetAgreementContext]);

  const handleGenerateAgreement = () => {
    generateAgreementMessages();
  };

  return (
    <div className="app-shell">
      <Sidebar active="excel-helper" onSelect={handleSidebarSelect} fileStatuses={{}} collapsed={true} />
      <div className="main">
        <div className="title-drag" />
        <div className="topbar" />
        <div className="stage excel-helper-stage">
          <div className="excel-helper-shell">
            <h1 className="excel-helper-title">엑셀 협정 도우미</h1>
            <div className="excel-helper-body" style={{ display: 'flex', flexDirection: 'row', gap: '16px' }}>
        {/* Sidebar */}
        <div style={{ width: '450px', borderRight: '1px solid #e5e7eb', paddingRight: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <section className="excel-helper-section">
            <div className="helper-grid">
              <div>
                <label className="field-label" style={strongLabelStyle}>공고명/공고번호</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input className="input" value={noticeInfo} onChange={(e) => setNoticeInfo(e.target.value)} placeholder="예: 2024-0000 ○○○ 공사" />
                  <div ref={regionMenuContainerRef} style={{ position: 'relative' }}>
                    <button type="button" className="btn-soft" onClick={() => setRegionMenuOpen((prev) => !prev)}>
                      {selectedRegions.length > 0 ? `지역사 강조 (${selectedRegions.length})` : '지역사 강조'}
                    </button>
                    {regionMenuOpen && (
                      <div
                        className="region-dropdown-menu"
                        style={{
                          position: 'absolute',
                          right: 0,
                          marginTop: '6px',
                          background: '#fff',
                          border: '1px solid #e5e7eb',
                          borderRadius: '12px',
                          padding: '12px',
                          width: '260px',
                          boxShadow: '0 10px 25px rgba(15, 23, 42, 0.2)',
                          zIndex: 20,
                        }}
                      >
                        <div style={{ marginBottom: '8px', fontWeight: 600, fontSize: '13px', color: '#0f172a' }}>지역사 강조</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '160px', overflowY: 'auto' }}>
                          {REGION_OPTIONS.map((region) => {
                            const active = selectedRegions.includes(region);
                            return (
                              <label
                                key={region}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '2px 4px',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={active}
                                  onChange={() => handleToggleRegion(region)}
                                />
                                <span style={{ fontSize: '13px' }}>{region}</span>
                              </label>
                            );
                          })}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '12px', color: '#475569' }}>
                          <button type="button" className="btn-soft" onClick={handleClearRegions} disabled={selectedRegions.length === 0}>선택 해제</button>
                          <button type="button" className="btn-soft" onClick={() => setRegionMenuOpen(false)}>닫기</button>
                        </div>
                        <div style={{ marginTop: '6px', fontSize: '11px', color: '#94a3b8' }}>선택한 지역 업체의 이름 셀을 노란색으로 표시합니다.</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <label className="field-label" style={strongLabelStyle}>공고일</label>
                <input className="input" type="date" value={noticeDateInput} onChange={(e) => setNoticeDateInput(e.target.value)} />
              </div>
              <div>
                <label className="field-label" style={strongLabelStyle}>기준금액 (원)</label>
                <input
                  className="input"
                  value={formatAmount(baseAmountInput)}
                  onChange={(e) => {
                    const numericValue = toNumeric(e.target.value);
                    setBaseAmountInput(numericValue !== null ? String(numericValue) : '');
                  }}
                  onBlur={(e) => {
                    const numericValue = toNumeric(e.target.value);
                    setBaseAmountInput(numericValue !== null ? String(numericValue) : '');
                  }}
                  placeholder="예: 1,000,000,000 (10억)"
                />
              </div>
            </div>
            <div className="helper-grid" style={{ marginTop: 12 }}>
              <div>
                <label className="field-label" style={strongLabelStyle}>발주처</label>
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
                <label className="field-label" style={strongLabelStyle}>금액대</label>
                <select
                  className="input"
                  value={rangeId}
                  onChange={(e) => setRangeId(e.target.value)}
                  disabled={!ownerId}
                >
                  <option value="">
                    {ownerId ? '금액대를 선택하세요' : '발주처를 먼저 선택하세요'}
                  </option>
                  {availableRanges.map((range) => (
                    <option key={range.id} value={range.id}>{range.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <div style={searchFileHighlightStyle}>
                  <label className="field-label" style={strongLabelStyle}>검색 파일 (필수)</label>
                  <div className="button-group">
                    {FILE_TYPE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={fileType === option.value ? 'btn-chip active' : 'btn-chip'}
                        onClick={() => setFileType(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
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

          <section className="excel-helper-section" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h2>협정 문자 생성</h2>
            <p className="section-help">엑셀에서 협정 목록을 자동으로 읽어 문자를 생성합니다. (A열에 순번이 있는 행을 기준으로 C열부터 업체를 읽습니다)</p>
            
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ marginBottom: '12px' }}>
                  <label className="field-label" style={strongLabelStyle}>엑셀 파일 선택</label>
                  <input
                    type="file"
                    className="input"
                    accept=".xlsx, .xls"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    onClick={(e) => { e.target.value = ''; }}
                  />
                  <button
                    type="button"
                    className="btn-soft"
                    style={{ marginTop: '8px' }}
                    onClick={handleClearUploadedFile}
                    disabled={!uploadedFile}
                  >
                    업로드 파일 지우기
                  </button>
                </div>
                <div>
                  <label className="field-label" style={strongLabelStyle}>시트 선택</label>
                  <select className="input" value={selectedSheet} onChange={handleSheetSelect} disabled={sheetNames.length === 0}>
                    <option value="">시트를 선택하세요</option>
                    {sheetNames.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
                {uploadedFile && <p className="section-help" style={{ marginTop: 10 }}>선택된 파일: {uploadedFile.name} (시트: {selectedSheet || '없음'})</p>}
              </div>

              <div className="excel-helper-actions" style={{ marginTop: 'auto' }}>
                <button
                  type="button"
                  className="primary"
                  onClick={handleGenerateAgreement}
                  disabled={isGeneratingAgreement}
                  style={{ width: '100%' }}
                >
                  {isGeneratingAgreement ? '생성 중...' : '협정 문자 생성'}
                </button>
                {isGeneratingAgreement && <span style={{ marginTop: '8px', textAlign: 'center', display: 'block' }}>잠시만 기다려주세요...</span>}
              </div>
            </div>
          </section>

          <section className="excel-helper-section">
            <h2>엑셀 서식 변환</h2>
            <p className="section-help">업로드한 엑셀 파일의 서식/수식을 자동으로 정리합니다. (B열 순번 기준으로 마지막 행까지 적용)</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label className="field-label" style={strongLabelStyle}>엑셀 파일 선택</label>
                <input
                  type="file"
                  className="input"
                  accept=".xlsx"
                  ref={formatFileInputRef}
                  onChange={handleFormatFileUpload}
                  onClick={(e) => { e.target.value = ''; }}
                />
                <button
                  type="button"
                  className="btn-soft"
                  style={{ marginTop: '8px' }}
                  onClick={handleClearFormatFile}
                  disabled={!formatFile}
                >
                  업로드 파일 지우기
                </button>
                {formatFile && (
                  <p className="section-help" style={{ marginTop: 8 }}>
                    선택된 파일: {formatFile.name}
                  </p>
                )}
              </div>
              <div className="excel-helper-actions">
                <button
                  type="button"
                  className="primary"
                  onClick={handleFormatWorkbook}
                  disabled={isFormatting}
                  style={{ width: '100%' }}
                >
                  {isFormatting ? '변환 중...' : '엑셀 서식 변환 실행'}
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <section className="excel-helper-section" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
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
            <div className="table-scroll" style={{ flex: 1 }}>
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
                </>
              )}
            </div>

            {isKrailOwner && (
              <div className="excel-helper-technicians-panel">
                <div className="excel-helper-technicians-header">
                  <div>
                    <div className="detail-label">기술자 점수 합계</div>
                    <div className="excel-helper-technicians-total">{technicianScoreTotal.toFixed(2)}</div>
                  </div>
                  <button type="button" className="btn-soft" onClick={addTechnicianEntry}>
                    기술자 추가
                  </button>
                </div>
                <p className="excel-helper-technicians-hint">각 기술자별 등급과 경력/관리 계수를 입력하면 자동으로 점수가 합산됩니다. 경력·관리 계수는 기본값이 "없음"입니다.</p>
                <div className="excel-helper-technicians-list">
                  {technicianEntries.length === 0 && (
                    <div className="excel-helper-technicians-empty">추가된 기술자가 없습니다. "기술자 추가" 버튼을 눌러 입력을 시작하세요.</div>
                  )}
                  {technicianEntries.map((entry, index) => (
                    <div key={entry.id} className="excel-helper-technician-row">
                      <div className="excel-helper-technician-index">기술자 {index + 1}</div>
                      <div className="excel-helper-technician-field">
                        <label>등급</label>
                        <select
                          value={entry.grade}
                          onChange={(e) => updateTechnicianEntry(entry.id, 'grade', e.target.value)}
                        >
                          <option value="">등급을 선택하세요</option>
                          {TECHNICIAN_GRADE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="excel-helper-technician-field">
                        <label>경력계수</label>
                        <select
                          value={entry.careerCoeff}
                          onChange={(e) => updateTechnicianEntry(entry.id, 'careerCoeff', e.target.value)}
                        >
                          {CAREER_COEFFICIENT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="excel-helper-technician-field">
                        <label>관리능력계수</label>
                        <select
                          value={entry.managementCoeff}
                          onChange={(e) => updateTechnicianEntry(entry.id, 'managementCoeff', e.target.value)}
                        >
                          {MANAGEMENT_COEFFICIENT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="excel-helper-technician-field technician-count-field">
                        <label>인원수</label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={entry.count || '1'}
                          onChange={(e) => updateTechnicianEntry(entry.id, 'count', e.target.value)}
                        />
                      </div>
                      <div className="excel-helper-technician-score">
                        점수 {computeTechnicianScore(entry).toFixed(2)}
                      </div>
                      <button
                        type="button"
                        className="btn-icon"
                        onClick={() => removeTechnicianEntry(entry.id)}
                        aria-label="기술자 삭제"
                      >
                        삭제
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
        </div>
      </div>
          </div>
        </div>
      </div>
      {companyConflictModal.open && (
        <div className="excel-helper-modal-overlay" role="presentation">
          <div className="excel-helper-modal" role="dialog" aria-modal="true">
            <header className="excel-helper-modal__header">
              <h3>중복된 업체 선택</h3>
              <p>동일한 이름의 업체가 여러 건 조회되었습니다. 각 업체에 맞는 자료를 선택해 주세요.</p>
            </header>
            <div className="excel-helper-modal__body">
              {(companyConflictModal.entries || []).map((entry) => (
                <div key={entry.normalizedName} className="excel-helper-modal__conflict">
                  <div className="excel-helper-modal__conflict-title">{entry.displayName}</div>
                  <div className="excel-helper-modal__options">
                    {entry.options.map((option) => {
                      const optionKey = buildCompanyOptionKey(option);
                      const selectedKey = companyConflictSelections?.[entry.normalizedName];
                      const isActive = selectedKey === optionKey;
                      const bizNo = pickFirstValue(option, BIZ_FIELDS) || '-';
                      const representative = pickFirstValue(option, REPRESENTATIVE_FIELDS) || '-';
                      const region = pickFirstValue(option, REGION_FIELDS) || '-';
                      const typeKey = String(option?._file_type || '').toLowerCase();
                      const typeLabel = FILE_TYPE_LABELS[typeKey] || '';
                      const managers = extractManagerNames(option);
                      return (
                        <button
                          key={optionKey}
                          type="button"
                          className={isActive ? 'excel-helper-modal__option active' : 'excel-helper-modal__option'}
                          onClick={() => handleCompanyConflictPick(entry.normalizedName, option)}
                        >
                          <div className="excel-helper-modal__option-name">
                            {pickFirstValue(option, NAME_FIELDS) || entry.displayName}
                            {typeLabel && <span className={`file-type-badge-small file-type-${typeKey}`}>{typeLabel}</span>}
                          </div>
                          <div className="excel-helper-modal__option-meta">사업자번호 {bizNo}</div>
                          <div className="excel-helper-modal__option-meta">대표자 {representative} · 지역 {region}</div>
                          {managers.length > 0 && (
                            <div className="excel-helper-modal__option-managers">
                              {managers.map((manager) => (
                                <span key={`${optionKey}-${manager}`} className="badge-person">{manager}</span>
                              ))}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <footer className="excel-helper-modal__footer">
              <button type="button" className="btn-soft" onClick={handleCompanyConflictCancel} disabled={companyConflictModal.isResolving}>취소</button>
              <button
                type="button"
                className="primary"
                onClick={handleCompanyConflictConfirm}
                disabled={companyConflictModal.isResolving}
              >
                {companyConflictModal.isResolving ? '처리 중...' : '선택 완료'}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
