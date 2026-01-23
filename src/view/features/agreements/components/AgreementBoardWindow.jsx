import React from 'react';
import { createPortal } from 'react-dom';
import CompanySearchModal from '../../../../components/CompanySearchModal.jsx';
import AgreementLoadModal from './AgreementLoadModal.jsx';
import useAgreementBoardStorage from '../hooks/useAgreementBoardStorage.js';
import AmountInput from '../../../../components/AmountInput.jsx';
import Modal from '../../../../components/Modal.jsx';
import { useFeedback } from '../../../../components/FeedbackProvider.jsx';
import { copyDocumentStyles } from '../../../../utils/windowBridge.js';
import {
  getRegionSearchState,
  openRegionSearch,
  subscribeRegionSearch,
  updateRegionSearchProps,
} from './regionSearchStore.js';
import { isWomenOwnedCompany, getQualityBadgeText, extractManagerNames } from '../../../../utils/companyIndicators.js';
import { generateMany } from '../../../../shared/agreements/generator.js';
import { AGREEMENT_GROUPS } from '../../../../shared/navigation.js';
import { sanitizeHtml } from '../../../../shared/sanitizeHtml.js';

const DEFAULT_GROUP_SIZE = 5;
const MIN_GROUPS = 4;
const BID_SCORE_DEFAULT = 65;
const EX_50_TO_100_BID_SCORE = 45;
const EX_50_TO_100_SUBCONTRACT_SCORE = 20;
const SUBCONTRACT_SCORE = 5;
const MANAGEMENT_SCORE_MAX = 15;
const KRAIL_TECHNICIAN_ABILITY_MAX = 5;
const PERFORMANCE_DEFAULT_MAX = 13;
const PERFORMANCE_MOIS_DEFAULT_MAX = 15;
const PERFORMANCE_CAP_VERSION = 2;
const MANAGEMENT_SCORE_VERSION = 3;
const LH_QUALITY_DEFAULT_UNDER_100B = 85;
const LH_QUALITY_DEFAULT_OVER_100B = 88;
const LH_UNDER_50_KEY = 'lh-under50';
const LH_50_TO_100_KEY = 'lh-50to100';
const PPS_UNDER_50_KEY = 'pps-under50';
const MOIS_UNDER_30_KEY = 'mois-under30';
const MOIS_30_TO_50_KEY = 'mois-30to50';
const KRAIL_UNDER_50_KEY = 'krail-under50';
const KRAIL_50_TO_100_KEY = 'krail-50to100';
const EX_UNDER_50_KEY = 'ex-under50';
const EX_50_TO_100_KEY = 'ex-50to100';
const KOREAN_UNIT = 100000000;
const BOARD_COPY_SLOT_COUNT = 5;
const BOARD_COPY_ACTIONS = [
  { kind: 'names', label: '업체명 복사', successMessage: '업체명 데이터가 복사되었습니다.' },
  { kind: 'shares', label: '지분 복사', successMessage: '지분 값이 복사되었습니다.' },
  { kind: 'management', label: '경영점수 복사', successMessage: '경영점수가 복사되었습니다.' },
  { kind: 'performance', label: '실적 복사', successMessage: '5년 실적이 복사되었습니다.' },
  { kind: 'sipyung', label: '시평액 복사', successMessage: '시평액이 복사되었습니다.' },
];
const BOARD_COPY_LOOKUP = BOARD_COPY_ACTIONS.reduce((acc, action) => {
  acc[action.kind] = action;
  return acc;
}, {});
const LH_FULL_SCORE = 95;
const PPS_FULL_SCORE = 95;
const INDUSTRY_OPTIONS = ['전기', '통신', '소방'];
const TECHNICIAN_GRADE_OPTIONS = [
  { value: 'special', label: '특급', points: 1.0 },
  { value: 'advanced', label: '고급', points: 0.75 },
  { value: 'intermediate', label: '중급', points: 0.5 },
  { value: 'entry', label: '초급', points: 0.25 },
];
const TECHNICIAN_CAREER_OPTIONS = [
  { value: 'none', label: '없음', multiplier: 1.0 },
  { value: '5plus', label: '5년 이상', multiplier: 1.1 },
  { value: '9plus', label: '9년 이상', multiplier: 1.15 },
  { value: '12plus', label: '12년 이상', multiplier: 1.2 },
];
const TECHNICIAN_MANAGEMENT_OPTIONS = [
  { value: 'none', label: '없음', multiplier: 1.0 },
  { value: '3plus', label: '3년 이상', multiplier: 1.1 },
  { value: '6plus', label: '6년 이상', multiplier: 1.15 },
  { value: '9plus', label: '9년 이상', multiplier: 1.2 },
];
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
const industryToFileType = (label) => {
  const normalized = String(label || '').trim();
  if (normalized === '전기') return 'eung';
  if (normalized === '통신') return 'tongsin';
  if (normalized === '소방') return 'sobang';
  return '';
};
const COLUMN_WIDTHS = {
  select: 32,
  order: 40,
  approval: 90,
  name: 100,
  share: 65,
  status: 45,
  management: 55,
  managementBonus: 50,
  shareTotal: 60,
  qualityPoints: 55,
  performanceCell: 90,
  performanceSummary: 50,
  technicianCell: 90,
  technicianSummary: 55,
  technicianAbilitySummary: 55,
  credibilityCell: 45,
  credibility: 55,
  bid: 32,
  subcontract: 55,
  netCostBonus: 55,
  total: 55,
  sipyungCell: 90,
  sipyungSummary: 60,
};
const COLLAPSED_COLUMN_WIDTHS = {
  select: 24,
  order: 26,
  approval: 28,
  name: 26,
  share: 26,
  status: 26,
  management: 28,
  managementBonus: 26,
  shareTotal: 28,
  qualityPoints: 28,
  performanceCell: 26,
  performanceSummary: 28,
  technicianCell: 26,
  technicianSummary: 28,
  technicianAbilitySummary: 28,
  credibilityCell: 26,
  credibility: 28,
  bid: 28,
  subcontract: 28,
  netCostBonus: 28,
  total: 28,
  sipyungCell: 26,
  sipyungSummary: 28,
};
const BOARD_ACTION_BUTTON_STYLE = { fontSize: '13px' };
const BOARD_COPY_BUTTON_STYLE_MAP = {
  names: { backgroundColor: '#ede9fe', color: '#5b21b6', borderColor: '#c4b5fd' },
  shares: { backgroundColor: '#ccfbf1', color: '#0f766e', borderColor: '#99f6e4' },
  management: { backgroundColor: '#fef9c3', color: '#92400e', borderColor: '#fde68a' },
  performance: { backgroundColor: '#ffe4e6', color: '#be123c', borderColor: '#fecdd3' },
  sipyung: { backgroundColor: '#dbeafe', color: '#1d4ed8', borderColor: '#bfdbfe' },
};
const resolveOwnerPerformanceMax = (ownerId) => {
  const upper = String(ownerId || '').toUpperCase();
  if (upper === 'MOIS') return PERFORMANCE_MOIS_DEFAULT_MAX;
  if (upper === 'PPS') return PERFORMANCE_MOIS_DEFAULT_MAX;
  return PERFORMANCE_DEFAULT_MAX;
};

const resolveLhQualityDefaultByRange = (rangeLabel, rangeKey) => {
  const label = String(rangeLabel || '').trim();
  const key = String(rangeKey || '').trim().toLowerCase();
  if (key === LH_50_TO_100_KEY) {
    return LH_QUALITY_DEFAULT_UNDER_100B;
  }
  if (label.includes('100억') || key.includes('over100') || key.includes('above100')) {
    return LH_QUALITY_DEFAULT_OVER_100B;
  }
  return LH_QUALITY_DEFAULT_UNDER_100B;
};

const selectTierByAmount = (tiers = [], amount) => {
  const sorted = Array.isArray(tiers)
    ? tiers.slice().sort((a, b) => toNumber(a?.minAmount) - toNumber(b?.minAmount))
    : [];
  if (!sorted.length) return null;
  const target = toNumber(amount);
  const findTier = (value) => {
    if (!(value > 0)) return null;
    return sorted.find((tier) => {
      const min = toNumber(tier?.minAmount) || 0;
      const rawMax = tier?.maxAmount;
      const maxVal = rawMax === null || rawMax === undefined || rawMax === '' ? Infinity : toNumber(rawMax);
      const upper = Number.isFinite(maxVal) && maxVal > 0 ? maxVal : Infinity;
      return value >= min && value < upper;
    }) || null;
  };
  return findTier(target) || sorted[sorted.length - 1];
};

const derivePerformanceMax = (performanceRules) => {
  const maxScore = toNumber(performanceRules?.maxScore);
  if (maxScore != null && maxScore > 0) return maxScore;
  const thresholds = Array.isArray(performanceRules?.thresholds) ? performanceRules.thresholds : [];
  const thresholdMax = thresholds.reduce((acc, item) => {
    const value = toNumber(item?.score);
    return value != null && value > acc ? value : acc;
  }, 0);
  return thresholdMax > 0 ? thresholdMax : null;
};

const resolvePerformanceRules = (performanceRules, { fileType, estimatedAmount }) => {
  if (!performanceRules || typeof performanceRules !== 'object') return performanceRules;
  const variants = Array.isArray(performanceRules.variants) ? performanceRules.variants : [];
  if (!variants.length) return performanceRules;
  const normalizedType = String(fileType || '').trim().toLowerCase();
  const estimatedValue = toNumber(estimatedAmount);
  if (!Number.isFinite(estimatedValue) && normalizedType) {
    const matching = variants.filter((variant) => {
      const when = variant?.when || {};
      if (!Array.isArray(when.fileTypes) || when.fileTypes.length === 0) return false;
      const allowed = when.fileTypes.map((value) => String(value || '').trim().toLowerCase()).filter(Boolean);
      return allowed.includes(normalizedType);
    });
    if (matching.length) {
      const best = matching.reduce((acc, variant) => {
        const score = toNumber(variant?.maxScore);
        if (score == null) return acc;
        if (!acc || (toNumber(acc?.maxScore) || 0) < score) return variant;
        return acc;
      }, null);
      if (best) {
        const { when: _when, ...variantConfig } = best;
        return { ...performanceRules, ...variantConfig };
      }
    }
  }
  for (const variant of variants) {
    if (!variant || typeof variant !== 'object') continue;
    const when = variant.when || {};
    if (Array.isArray(when.fileTypes) && when.fileTypes.length > 0) {
      const allowed = when.fileTypes.map((value) => String(value || '').trim().toLowerCase()).filter(Boolean);
      if (!normalizedType || !allowed.includes(normalizedType)) continue;
    }
    const lt = Number(when.estimatedAmountLt);
    if (Number.isFinite(lt)) {
      if (!Number.isFinite(estimatedValue) || !(estimatedValue < lt)) continue;
    }
    const gte = Number(when.estimatedAmountGte);
    if (Number.isFinite(gte)) {
      if (!Number.isFinite(estimatedValue) || !(estimatedValue >= gte)) continue;
    }
    const { when: _when, ...variantConfig } = variant;
    return { ...performanceRules, ...variantConfig };
  }
  return performanceRules;
};

const deriveManagementMax = (managementRules) => {
  const methods = Array.isArray(managementRules?.methods) ? managementRules.methods : [];
  const methodMaxes = methods
    .map((method) => toNumber(method?.maxScore))
    .filter((value) => value != null && value > 0);
  if (methodMaxes.length) return Math.max(...methodMaxes);
  return null;
};

const resolvePerformanceCap = (value, fallback = PERFORMANCE_DEFAULT_MAX) => {
  if (value === null || value === undefined) return fallback;
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.max(parsed, fallback);
  }
  return fallback;
};

const resolveTemplateKey = (ownerId, rangeId, fileType) => {
  const ownerKey = String(ownerId || '').toUpperCase();
  const rangeKey = String(rangeId || '').toLowerCase();
  const normalizedType = String(fileType || '').toLowerCase();
  if (ownerKey === 'MOIS' && rangeKey === 'mois-under30') return 'mois-under30';
  if (ownerKey === 'MOIS' && rangeKey === MOIS_30_TO_50_KEY) return 'mois-30to50';
  if (ownerKey === 'PPS' && rangeKey === PPS_UNDER_50_KEY) return 'pps-under50';
  if (ownerKey === 'LH' && rangeKey === LH_UNDER_50_KEY) return 'lh-under50';
  if (ownerKey === 'KRAIL' && rangeKey === KRAIL_UNDER_50_KEY) {
    if (normalizedType === 'eung' || normalizedType === 'tongsin') return 'krail-under50';
    return null;
  }
  if (ownerKey === 'EX' && rangeKey === EX_UNDER_50_KEY) return 'ex-under50';
  return null;
};

const parseNumeric = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const cleaned = String(value).replace(/[^0-9.\-]/g, '');
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatBidDeadline = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const pad = (num) => String(num).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = date.getHours();
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  const hourDisplay = pad(hour12);
  return `${year}-${month}-${day}  ${hourDisplay}:${minutes}:${seconds} ${period}`;
};

const formatNoticeDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const pad = (num) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const parseBidDeadlineParts = (value) => {
  if (!value) {
    return { date: '', period: 'AM', hour: '', minute: '' };
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { date: '', period: 'AM', hour: '', minute: '' };
  }
  const pad = (num) => String(num).padStart(2, '0');
  const hour24 = parsed.getHours();
  const minute = parsed.getMinutes();
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 || 12;
  const date = `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
  return { date, period, hour: pad(hour12), minute: pad(minute) };
};

const buildBidDeadline = (date, period, hour, minute) => {
  if (!date) return '';
  if (hour === '' || minute === '') return '';
  const hourNum = Number(hour);
  const minuteNum = Number(minute);
  if (!Number.isFinite(hourNum) || !Number.isFinite(minuteNum)) return null;
  if (hourNum < 1 || hourNum > 12 || minuteNum < 0 || minuteNum > 59) return null;
  const hour24 = period === 'PM'
    ? (hourNum % 12) + 12
    : (hourNum % 12);
  const pad = (num) => String(num).padStart(2, '0');
  return `${date}T${pad(hour24)}:${pad(minuteNum)}`;
};

const parseKoreanAmount = (text) => {
  if (!text) return 0;
  const label = String(text);
  const match = label.match(/([0-9]+(?:\.[0-9]+)?)\s*억/);
  if (!match) return 0;
  const base = Number(match[1]);
  if (!Number.isFinite(base)) return 0;
  return base * KOREAN_UNIT;
};

const parseRangeAmountHint = (ownerKeyUpper, rangeLabel) => {
  if (!rangeLabel) return 0;
  const label = String(rangeLabel);
  const ownerKey = String(ownerKeyUpper || '').toUpperCase();
  if (label.includes('~')) {
    const [minRaw, maxRaw] = label.split('~');
    const minVal = parseKoreanAmount(minRaw);
    const maxVal = parseKoreanAmount(maxRaw);
    if (minVal && maxVal) return Math.round((minVal + maxVal) / 2);
  }
  if (label.includes('미만')) {
    const target = parseKoreanAmount(label);
    return target > 0 ? Math.round(target * 0.9) : 0;
  }
  if (label.includes('이상')) {
    const target = parseKoreanAmount(label);
    if (target > 0) {
      return ownerKey === 'MOIS' ? Math.round(target * 1.2) : Math.round(target * 1.1);
    }
  }
  const fallback = parseKoreanAmount(label);
  return fallback > 0 ? fallback : 0;
};

const roundUpThousand = (value) => {
  if (value == null) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.ceil(numeric / 1000) * 1000;
};

const truncateScore = (value, digits = 2) => {
  if (value == null) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const factor = 10 ** digits;
  return Math.floor(numeric * factor) / factor;
};

const roundTo = (value, digits = 4) => {
  if (value == null) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const factor = 10 ** digits;
  return Math.round(numeric * factor) / factor;
};

const buildDutySummary = (regions = [], dutyRate = null, teamSize = null) => {
  const normalizedRegions = (Array.isArray(regions) ? regions : [])
    .map((entry) => (entry ? String(entry).trim() : ''))
    .filter(Boolean);
  const regionLabel = normalizedRegions.length === 0
    ? ''
    : normalizedRegions.join('/');
  const rateText = dutyRate != null ? `${Number(dutyRate)}%` : '';
  const regionPart = regionLabel ? `${regionLabel}${rateText ? `의무${rateText}` : ''}` : (rateText ? `의무${rateText}` : '의무지역 미지정');
  const teamPart = Number.isFinite(teamSize) && teamSize > 0 ? `${teamSize}개사` : null;
  return [regionPart, teamPart].filter(Boolean).join(', ');
};

const sanitizeCompanyName = (value) => {
  if (!value) return '';
  let result = String(value).trim();
  result = result.replace(/㈜/g, '');
  result = result.replace(/\(주\)/g, '');
  result = result.replace(/주식회사/g, '');
  result = result.replace(/\s+/g, ' ').trim();
  return result;
};

const MANAGER_KEYS = [
  '담당자명', '담당자', '담당', '주담당자', '부담당자', '협력담당자', '현장담당자', '사무담당자',
  'manager', 'managerName', 'manager_name', 'contactPerson', 'contact_person', 'contact',
  '담당자1', '담당자2', '담당자3', '담당자 1', '담당자 2', '담당자 3',
];
const MANAGER_KEY_SET = new Set(MANAGER_KEYS.map((key) => key.replace(/\s+/g, '').toLowerCase()));

const extractManagerNameToken = (raw) => {
  if (!raw) return '';
  let token = String(raw).trim();
  if (!token) return '';
  token = token.replace(/^[\[\(（【]([^\]\)）】]+)[\]\)】]?$/, '$1').trim();
  token = token.replace(/(과장|팀장|차장|대리|사원|부장|대표|실장|소장|님)$/g, '').trim();
  token = token.replace(/[0-9\-]+$/g, '').trim();
  if (/^[가-힣]{2,4}$/.test(token)) return token;
  return '';
};

const extractManagerNameFromText = (text) => {
  if (!text) return '';
  const normalized = String(text).replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  const firstToken = extractManagerNameToken(normalized.split(/[ ,\/\|·•∙ㆍ;:\-]+/).filter(Boolean)[0]);
  if (firstToken) return firstToken;
  const patterns = [
    /담당자?\s*[:：-]?\s*([가-힣]{2,4})/,
    /([가-힣]{2,4})\s*(과장|팀장|차장|대리|사원|부장|대표|실장|소장)/,
    /\b(?!확인서|등록증|증명서|평가|서류)([가-힣]{2,4})\b/,
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match && match[1]) {
      const token = extractManagerNameToken(match[1]);
      if (token) return token;
    }
  }
  return '';
};

const getCandidateManagerName = (candidate) => {
  if (!candidate || typeof candidate !== 'object') return '';
  const sources = [candidate, candidate.snapshot].filter(Boolean);
  for (const source of sources) {
    for (const [key, value] of Object.entries(source)) {
      if (value == null || value === '') continue;
      const normalizedKey = key.replace(/\s+/g, '').toLowerCase();
      if (MANAGER_KEY_SET.has(normalizedKey) || normalizedKey.includes('담당') || normalizedKey.includes('manager')) {
        const segments = String(value).split(/[\n,/·•∙ㆍ;|\\]/);
        for (const segment of segments) {
          const name = extractManagerNameToken(segment) || extractManagerNameFromText(segment);
          if (name) return name;
        }
      }
      if (normalizedKey === '비고') {
        const name = extractManagerNameFromText(value);
        if (name) return name;
      }
    }
  }
  return '';
};

const SHARE_DIRECT_KEYS = ['_share', '_pct', 'candidateShare', 'share', '지분', '기본지분'];
const SHARE_KEYWORDS = [['지분', 'share', '비율']];

const PERFORMANCE_DIRECT_KEYS = ['_performance5y', 'performance5y', 'perf5y', '5년 실적', '5년실적', '5년 실적 합계', '최근5년실적', '최근5년실적합계', '5년실적금액', '최근5년시공실적'];
const PERFORMANCE_KEYWORDS = [['5년실적', '최근5년', 'fiveyear', 'performance5', '시공실적']];

const SIPYUNG_DIRECT_KEYS = ['_sipyung', 'sipyung', '시평', '시평액', '시평금액', '시평액(원)', '시평금액(원)', '기초금액', '기초금액(원)'];
const SIPYUNG_KEYWORDS = [['시평', '심평', 'sipyung', '기초금액', '추정가격', '시평총액']];

const getCandidateNumericValue = (candidate, directKeys = [], keywordGroups = []) => {
  if (!candidate || typeof candidate !== 'object') return null;
  const value = extractAmountValue(candidate, directKeys, keywordGroups);
  const parsed = toNumber(value);
  return parsed;
};

const getCandidateSipyungAmount = (candidate) => {
  if (!candidate || typeof candidate !== 'object') return null;
  if (candidate._agreementSipyungAmount != null) {
    const cached = toNumber(candidate._agreementSipyungAmount);
    if (cached != null) return cached;
  }
  const raw = candidate._sipyung ?? extractAmountValue(candidate, SIPYUNG_DIRECT_KEYS, SIPYUNG_KEYWORDS);
  const parsed = toNumber(raw);
  if (parsed != null) {
    candidate._agreementSipyungAmount = parsed;
    return parsed;
  }
  if (raw != null) {
    candidate._agreementSipyungAmount = raw;
  }
  return null;
};

const getCandidateCreditGrade = (candidate) => {
  if (!candidate || typeof candidate !== 'object') return '';
  const sources = [
    candidate.creditGrade,
    candidate.creditGradeText,
    candidate.creditNote,
    candidate['신용평가'],
    candidate['신용등급'],
    candidate['신용평가등급'],
    candidate.snapshot?.['신용평가'],
    candidate.snapshot?.['신용등급'],
  ];
  for (const src of sources) {
    if (!src) continue;
    const str = String(src).trim().toUpperCase();
    if (!str) continue;
    const match = str.match(/^([A-Z]{1,3}[0-9]?(?:[+-])?)/);
    return match ? match[1] : str.split(/[\s(]/)[0];
  }
  return '';
};

const normalizeRuleEntry = (entry = {}) => ({
  bizNo: entry.bizNo ? String(entry.bizNo) : '',
  name: entry.name ? String(entry.name) : '',
  note: entry.note ? String(entry.note) : '',
  region: entry.region ? String(entry.region) : '',
  snapshot: entry.snapshot && typeof entry.snapshot === 'object' ? { ...entry.snapshot } : null,
});

const getCompanyName = (company) => (
  company?.name
  || company?.companyName
  || company?.bizName
  || company?.['업체명']
  || company?.['검색된 회사']
  || '이름 미확인'
);

const getRegionLabel = (company) => (
  company?.region
  || company?.['대표지역']
  || company?.['지역']
  || company?.snapshot?.['대표지역']
  || company?.snapshot?.['지역']
  || '지역 미지정'
);

const normalizeRegion = (value) => {
  if (!value) return '';
  return String(value).replace(/\s+/g, '').trim();
};

const toNumber = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const normalized = String(value)
    .replace(/[,\s]/g, '')
    .trim();
  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatScore = (score, digits = 3) => {
  const value = toNumber(score);
  if (value === null) return '-';
  if (Math.abs(value) >= 1000) {
    try { return value.toLocaleString('ko-KR'); } catch (err) { return String(value); }
  }
  return value.toFixed(digits);
};

const normalizeSheetNameToken = (value) => String(value || '')
  .replace(/[\\/:*?\[\]]/g, '')
  .trim();

const buildDefaultSheetName = (title = '') => {
  const trimmed = String(title || '').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  if (!trimmed) return '';
  const tokens = trimmed.split(' ').filter(Boolean);
  const picked = tokens.slice(0, 4).join('');
  return normalizeSheetNameToken(picked || tokens.join(''));
};

const ensureSheetNameSuffix = (name, fileType) => {
  const base = normalizeSheetNameToken(name);
  if (!base) return base;
  if (fileType === 'tongsin' && !base.includes('(통신)')) return `${base}(통신)`;
  if (fileType === 'sobang' && !base.includes('(소방)')) return `${base}(소방)`;
  return base;
};

const formatPlainAmount = (value) => {
  const number = toNumber(value);
  if (number === null) return '';
  const rounded = Math.round(number);
  return Number.isFinite(rounded) ? String(rounded) : String(number);
};

const formatAmount = (value) => {
  const number = toNumber(value);
  if (number === null) return '-';
  try { return number.toLocaleString('ko-KR'); } catch (err) { return String(number); }
};

const formatPercentInput = (value) => {
  const number = toNumber(value);
  if (number === null) return '';
  const fixed = Number(number).toFixed(3).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
  return `${fixed}%`;
};

const formatPercent = (value) => {
  if (value === null || value === undefined) return '-%';
  const number = Number(value);
  if (!Number.isFinite(number)) return '-%';
  const integerDiff = Math.abs(number - Math.round(number));
  if (integerDiff < 0.01) return `${Math.round(number)}%`;
  return `${number.toFixed(2)}%`;
};

const parsePercentValue = (value) => {
  const number = toNumber(value);
  if (number === null) return NaN;
  return number / 100;
};

const parseAmountValue = (value) => {
  const parsed = toNumber(value);
  return parsed === null ? null : parsed;
};

const normalizeAmountToken = (value) => String(value ?? '').replace(/[,\s]/g, '');

const formatShareForName = (value) => {
  if (value === null || value === undefined || value === '') return '';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '';
  const normalized = numeric > 0 && numeric < 1 ? numeric * 100 : numeric;
  const fixed = normalized.toFixed(2);
  return fixed.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
};

const clampScore = (value, max = MANAGEMENT_SCORE_MAX) => {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  if (number < 0) return 0;
  if (number > max) return max;
  return number;
};

const getCandidateManagementScore = (candidate) => {
  if (!candidate || typeof candidate !== 'object') return null;
  const normalizeFlag = (value) => {
    if (value === true) return true;
    if (value === null || value === undefined) return false;
    const str = String(value).trim().toUpperCase();
    if (!str) return false;
    return ['Y', 'YES', 'TRUE', '만점', 'MAX', '완료', 'O', '1'].includes(str);
  };
  const explicitPerfectSources = [
    candidate.managementIsPerfect,
    candidate.snapshot?.managementIsPerfect,
  ];
  const explicitPerfect = explicitPerfectSources.some(normalizeFlag);
  if (explicitPerfect) {
    candidate._agreementManagementScore = MANAGEMENT_SCORE_MAX;
    candidate._agreementManagementScoreVersion = MANAGEMENT_SCORE_VERSION;
    return MANAGEMENT_SCORE_MAX;
  }
  if (
    candidate._agreementManagementScore != null
    && candidate._agreementManagementScoreVersion === MANAGEMENT_SCORE_VERSION
  ) {
    const cached = clampScore(toNumber(candidate._agreementManagementScore));
    if (cached != null) return cached;
  }
  const directFields = [
    'managementScore',
    '_managementScore',
    '경영점수',
    '경영평가점수',
    '경영점수합',
  ];
  for (const field of directFields) {
    if (candidate[field] != null) {
      const parsed = clampScore(toNumber(candidate[field]));
      if (parsed != null) {
        candidate._agreementManagementScore = parsed;
        candidate._agreementManagementScoreVersion = MANAGEMENT_SCORE_VERSION;
        return parsed;
      }
    }
  }

  const compositeCandidates = [
    candidate.managementTotalScore,
    candidate.totalManagementScore,
    candidate.managementScoreTotal,
    candidate['경영점수합'],
    candidate['경영점수총점'],
  ];
  let composite = null;
  for (const value of compositeCandidates) {
    const parsed = clampScore(toNumber(value));
    if (parsed != null) { composite = parsed; break; }
  }

  if (composite == null) {
    const debt = clampScore(toNumber(
      candidate.debtScore
      ?? candidate.debtRatioScore
      ?? candidate['부채점수']
      ?? candidate['부채비율점수']
    ), MANAGEMENT_SCORE_MAX);
    const current = clampScore(toNumber(
      candidate.currentScore
      ?? candidate.currentRatioScore
      ?? candidate['유동점수']
      ?? candidate['유동비율점수']
    ), MANAGEMENT_SCORE_MAX);
    if (debt != null || current != null) {
      const sum = (debt || 0) + (current || 0);
      composite = clampScore(sum);
    }
  }

  let credit = clampScore(toNumber(candidate.creditScore));
  if (credit == null && candidate._creditScore != null) {
    credit = clampScore(toNumber(candidate._creditScore));
  }
  if (credit == null && candidate['신용점수'] != null) {
    credit = clampScore(toNumber(candidate['신용점수']));
  }
  if (credit == null && candidate['신용평가점수'] != null) {
    credit = clampScore(toNumber(candidate['신용평가점수']));
  }
  if (credit == null && candidate.creditGrade != null && composite != null) {
    // 일부 데이터는 신용점수를 별도로 주지 않고 composite에 포함시킴
    credit = null;
  }
  if (credit != null && isCreditScoreExpired(candidate)) {
    credit = null;
  }

  const candidates = [composite, credit].filter((value) => value != null && Number.isFinite(value));
  if (candidates.length === 0) return null;
  const best = Math.max(...candidates);
  const clamped = clampScore(best);
  candidate._agreementManagementScore = clamped;
  candidate._agreementManagementScoreVersion = MANAGEMENT_SCORE_VERSION;
  return clamped;
};

const getCandidatePerformanceAmount = (candidate) => {
  if (!candidate || typeof candidate !== 'object') return null;
  const directCandidates = [
    candidate._agreementPerformance5y,
    candidate._performance5y,
    candidate.performance5y,
    candidate.perf5y,
    candidate.performanceTotal,
    candidate['performance5y'],
    candidate['5년 실적'],
    candidate['5년실적'],
    candidate['5년 실적 합계'],
    candidate['최근5년실적'],
    candidate['최근5년실적합계'],
    candidate['5년실적금액'],
    candidate['최근5년시공실적'],
  ];
  for (const value of directCandidates) {
    const parsed = toNumber(value);
    if (parsed != null) {
      candidate._agreementPerformance5y = parsed;
      return parsed;
    }
  }
  const extracted = extractAmountValue(candidate, PERFORMANCE_DIRECT_KEYS, PERFORMANCE_KEYWORDS);
  const parsed = toNumber(extracted);
  if (parsed != null) {
    candidate._agreementPerformance5y = parsed;
    return parsed;
  }
  return null;
};

const extractCreditGrade = (candidate) => {
  if (!candidate || typeof candidate !== 'object') return '';
  const sources = [
    candidate.creditGrade,
    candidate.creditGradeText,
    candidate.creditNote,
    candidate['신용평가'],
    candidate['신용등급'],
    candidate['신용평가등급'],
    candidate.snapshot?.['신용평가'],
    candidate.snapshot?.['신용등급'],
  ];
  for (const src of sources) {
    if (!src) continue;
    const str = String(src).trim().toUpperCase();
    if (!str) continue;
    const match = str.match(/^([A-Z]{1,3}[0-9]?(?:[+-])?)/);
    return match ? match[1] : str.split(/[\s(]/)[0];
  }
  return '';
};

const CREDIT_DATE_PATTERN = /(\d{2,4})[^0-9]{0,3}(\d{1,2})[^0-9]{0,3}(\d{1,2})/;
const CREDIT_DATE_PATTERN_GLOBAL = new RegExp(CREDIT_DATE_PATTERN.source, 'g');
const CREDIT_EXPIRED_REGEX = /(expired|만료|기한\s*경과|유효\s*기간\s*만료|기간\s*만료|만기)/i;
const CREDIT_OVERAGE_REGEX = /(over[-\s]?age|기간\s*초과|인정\s*기간\s*초과)/i;
const CREDIT_STATUS_STALE_REGEX = /(경과)/i;

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

const isCreditScoreExpired = (candidate) => {
  if (!candidate || typeof candidate !== 'object') return false;
  const flagFields = [
    candidate.creditExpired,
    candidate.snapshot?.creditExpired,
  ];
  for (const flag of flagFields) {
    if (flag === true) return true;
    if (typeof flag === 'string') {
      const upper = flag.trim().toUpperCase();
      if (upper === 'Y' || upper === 'TRUE' || upper === 'EXPIRED') return true;
    }
  }

  const explicitExpirySources = [
    candidate.creditExpiry,
    candidate.creditExpiryDate,
    candidate.creditValidUntil,
    candidate.creditExpiryText,
    candidate.creditExpiryLabel,
    candidate['신용평가 유효기간'],
    candidate['신용평가유효기간'],
    candidate['신용평가 기간'],
    candidate['신용평가기간'],
    candidate['신용평가 만료일'],
    candidate['신용만료일'],
    candidate.snapshot?.creditExpiry,
    candidate.snapshot?.creditExpiryDate,
    candidate.snapshot?.creditValidUntil,
    candidate.snapshot?.creditExpiryText,
    candidate.snapshot?.creditExpiryLabel,
    candidate.snapshot?.['신용평가 유효기간'],
    candidate.snapshot?.['신용평가유효기간'],
    candidate.snapshot?.['신용평가 기간'],
    candidate.snapshot?.['신용평가기간'],
    candidate.snapshot?.['신용평가 만료일'],
    candidate.snapshot?.['신용만료일'],
  ].filter(Boolean);
  const parsedExplicit = (() => {
    for (const raw of explicitExpirySources) {
      const parsed = extractExpiryDateFromText(raw);
      if (parsed) return parsed;
    }
    return null;
  })();

  const creditTextKeys = [
    'creditNoteText',
    'creditNote',
    'creditGradeText',
    'creditGrade',
    'creditInfo',
    'creditDetails',
    'creditStatus',
    'creditStatusText',
    'creditValidityText',
    'creditExpiryText',
    '신용평가',
    '신용평가등급',
    '신용등급',
    '신용평가비고',
    '신용평가 비고',
    '신용평가상태',
    '신용상태',
    '신용평가 상태',
  ];

  const collectCreditTexts = (source) => {
    if (!source || typeof source !== 'object') return [];
    return creditTextKeys
      .map((key) => source[key])
      .filter((value) => value !== undefined && value !== null && value !== '')
      .map((value) => String(value));
  };

  const textSources = [
    ...collectCreditTexts(candidate),
    ...collectCreditTexts(candidate.snapshot),
  ];

  const expiryFromText = (() => {
    for (const text of textSources) {
      const parsed = extractExpiryDateFromText(text);
      if (parsed) return parsed;
    }
    return null;
  })();

  const finalExpiry = parsedExplicit || expiryFromText;
  if (finalExpiry) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(finalExpiry.getTime());
    expiry.setHours(0, 0, 0, 0);
    if (expiry < today) return true;
  }

  if (textSources.some((text) => CREDIT_EXPIRED_REGEX.test(text) || CREDIT_OVERAGE_REGEX.test(text))) {
    return true;
  }

  const statusSources = [
    candidate.dataStatus,
    candidate['데이터상태'],
    candidate.snapshot?.dataStatus,
    candidate.snapshot?.['데이터상태'],
  ].filter((value) => value && typeof value === 'object');

  for (const status of statusSources) {
    const statusTexts = [
      status.credit,
      status.creditStatus,
      status.creditValidity,
      status['신용평가'],
      status['신용'],
    ].filter((value) => value !== undefined && value !== null && value !== '')
      .map((value) => String(value));
    if (statusTexts.some((text) => CREDIT_EXPIRED_REGEX.test(text)
      || CREDIT_OVERAGE_REGEX.test(text)
      || CREDIT_STATUS_STALE_REGEX.test(text))) {
      return true;
    }
  }

  return false;
};

const extractValue = (candidate, keys = []) => {
  if (!candidate) return null;
  for (const key of keys) {
    if (candidate[key] !== undefined && candidate[key] !== null && candidate[key] !== '') {
      return candidate[key];
    }
    if (candidate.snapshot && candidate.snapshot[key] !== undefined && candidate.snapshot[key] !== null && candidate.snapshot[key] !== '') {
      return candidate.snapshot[key];
    }
  }
  return null;
};

const extractByKeywords = (candidate, keywordGroups = []) => {
  if (!candidate || typeof candidate !== 'object') return null;
  for (const keywords of keywordGroups) {
    for (const key of Object.keys(candidate)) {
      if (typeof key !== 'string') continue;
      const normalized = key.replace(/\s+/g, '').toLowerCase();
      if (!normalized) continue;
      if (keywords.some((keyword) => normalized.includes(keyword))) {
        const value = candidate[key];
        if (value !== undefined && value !== null && value !== '') return value;
      }
    }
  }
  return null;
};

const extractAmountValue = (candidate, directKeys = [], keywordGroups = []) => {
  const direct = extractValue(candidate, directKeys);
  if (direct !== null && direct !== undefined && direct !== '') return direct;
  const sources = [candidate, candidate?.snapshot].filter(Boolean);
  for (const source of sources) {
    const value = extractByKeywords(source, keywordGroups);
    if (value !== null && value !== undefined && value !== '') return value;
  }
  return null;
};

const getBizNo = (company = {}) => {
  const raw = company.bizNo
    || company.biz_no
    || company.bizno
    || company.bizNumber
    || company.biznumber
    || company.businessNumber
    || company['사업자번호']
    || company['사업자 번호']
    || company['사업자등록번호']
    || company['사업자등록 번호']
    || company['법인등록번호']
    || company['법인등록 번호']
    || company['법인번호'];
  if (raw === null || raw === undefined) return '';
  return typeof raw === 'number' ? String(raw) : String(raw || '').trim();
};

const normalizeBizNo = (value) => (value ? String(value).replace(/[^0-9]/g, '') : '');

const isRegionExplicitlySelected = (candidate) => {
  if (!candidate || typeof candidate !== 'object') return false;
  const flagKeys = ['regionSelected', 'isRegionSelected', '_regionSelected', 'selectedRegion'];
  for (const key of flagKeys) {
    if (candidate[key] === true || candidate[key] === 'Y') return true;
  }
  const textKeys = ['지역선택', '지역지정'];
  for (const key of textKeys) {
    const value = candidate[key];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed === '선택' || trimmed === 'Y' || trimmed === '사용') return true;
    }
  }
  return false;
};


const buildEntryUid = (prefix, candidate, index, seen) => {
  const rawId = candidate?.id
    || candidate?.bizNo
    || candidate?.사업자번호
    || candidate?.companyCode
    || candidate?.companyId
    || candidate?.['검색된 회사']
    || candidate?.['업체명']
    || `${prefix}-${index}`;
  const base = `${prefix}-${String(rawId).trim() || index}`;
  const count = seen.get(base) || 0;
  const uid = count === 0 ? base : `${base}-${count + 1}`;
  seen.set(base, count + 1);
  return uid;
};

export default function AgreementBoardWindow({
  open,
  onClose,
  candidates = [],
  pinned = [],
  excluded = [],
  groupAssignments: initialGroupAssignments = [],
  groupShares: initialGroupShares = [],
  groupShareRawInputs: initialGroupShareRawInputs = [],
  groupCredibility: initialGroupCredibility = [],
  groupTechnicianScores: initialGroupTechnicianScores = [],
  groupApprovals: initialGroupApprovals = [],
  groupManagementBonus: initialGroupManagementBonus = [],
  groupQualityScores: initialGroupQualityScores = [],
  technicianEntriesByTarget: initialTechnicianEntriesByTarget = {},
  dutyRegions = [],
  groupSize = DEFAULT_GROUP_SIZE,
  title = '협정보드',
  alwaysInclude = [],
  fileType,
  ownerId = 'LH',
  rangeId: _rangeId = null,
  onAddRepresentatives = () => {},
  onRemoveRepresentative = () => {},
  onUpdateBoard = () => {},
  noticeNo = '',
  noticeTitle = '',
  noticeDate = '',
  industryLabel = '',
  entryAmount = '',
  entryMode = 'ratio',
  baseAmount = '',
  estimatedAmount = '',
  bidAmount = '',
  ratioBaseAmount = '',
  bidRate = '',
  adjustmentRate = '',
  bidDeadline = '',
  regionDutyRate = '',
  participantLimit = DEFAULT_GROUP_SIZE,
  netCostAmount = '',
  aValue = '',
  memoHtml = '',
  inlineMode = false,
}) {
  const rangeId = _rangeId;
  const boardWindowRef = React.useRef(null);
  const [portalContainer, setPortalContainer] = React.useState(null);
  const [groupAssignments, setGroupAssignments] = React.useState(() => (
    Array.isArray(initialGroupAssignments) ? initialGroupAssignments.map((row) => (Array.isArray(row) ? row.slice() : [])) : []
  ));
  const [draggingId, setDraggingId] = React.useState(null);
  const [dropTarget, setDropTarget] = React.useState(null);
  const [dragSource, setDragSource] = React.useState(null);
  const [groupShares, setGroupShares] = React.useState(() => (
    Array.isArray(initialGroupShares) ? initialGroupShares.map((row) => (Array.isArray(row) ? row.slice() : [])) : []
  ));
  const [groupShareRawInputs, setGroupShareRawInputs] = React.useState(() => (
    Array.isArray(initialGroupShareRawInputs) ? initialGroupShareRawInputs.map((row) => (Array.isArray(row) ? row.slice() : [])) : []
  ));
  const [groupApprovals, setGroupApprovals] = React.useState(() => (
    Array.isArray(initialGroupApprovals) ? initialGroupApprovals.slice() : []
  ));
  const [groupManagementBonus, setGroupManagementBonus] = React.useState(() => (
    Array.isArray(initialGroupManagementBonus) ? initialGroupManagementBonus.slice() : []
  ));
  const [selectedGroups, setSelectedGroups] = React.useState(() => new Set());
  const [groupSummaries, setGroupSummaries] = React.useState([]);
  const [groupCredibility, setGroupCredibility] = React.useState(() => (
    Array.isArray(initialGroupCredibility) ? initialGroupCredibility.map((row) => (Array.isArray(row) ? row.slice() : [])) : []
  ));
  const [groupTechnicianScores, setGroupTechnicianScores] = React.useState(() => (
    Array.isArray(initialGroupTechnicianScores) ? initialGroupTechnicianScores.map((row) => (Array.isArray(row) ? row.slice() : [])) : []
  ));
  const [groupQualityScores, setGroupQualityScores] = React.useState(() => (
    Array.isArray(initialGroupQualityScores) ? initialGroupQualityScores.map((row) => (Array.isArray(row) ? row.slice() : [])) : []
  ));
  const [formulasDoc, setFormulasDoc] = React.useState(null);
  const [memoOpen, setMemoOpen] = React.useState(false);
  const [memoDraft, setMemoDraft] = React.useState('');
  const memoEditorRef = React.useRef(null);
  const [copyModalOpen, setCopyModalOpen] = React.useState(false);
  const [exportModalOpen, setExportModalOpen] = React.useState(false);
  const [exportTargetPath, setExportTargetPath] = React.useState('');
  const [exportTargetName, setExportTargetName] = React.useState('');
  const [exportSheetName, setExportSheetName] = React.useState('');
  const exportFileInputRef = React.useRef(null);
  const regionSearchSessionRef = React.useRef(null);
  const [technicianModalOpen, setTechnicianModalOpen] = React.useState(false);
  const [technicianEntries, setTechnicianEntries] = React.useState([]);
  const technicianEntriesByTargetRef = React.useRef({});
  const technicianEntriesTargetKeyRef = React.useRef('0:0');
  const [technicianTarget, setTechnicianTarget] = React.useState({ groupIndex: 0, slotIndex: 0 });
  const [minRatingOpen, setMinRatingOpen] = React.useState(false);
  const [minRatingRequiredShare, setMinRatingRequiredShare] = React.useState('');
  const [minRatingNetCostBonus, setMinRatingNetCostBonus] = React.useState('');
  const [minRatingCredibilityScore, setMinRatingCredibilityScore] = React.useState('');
  const [minRatingCredibilityShare, setMinRatingCredibilityShare] = React.useState('');
  const [bidDatePart, setBidDatePart] = React.useState('');
  const [bidTimePeriod, setBidTimePeriod] = React.useState('AM');
  const [bidHourInput, setBidHourInput] = React.useState('');
  const [bidMinuteInput, setBidMinuteInput] = React.useState('');
  const [collapsedColumns, setCollapsedColumns] = React.useState(() => ({
    select: false,
    order: false,
    approval: false,
    name: false,
    share: false,
    credibility: false,
    status: false,
    managementBonus: false,
    performance: false,
    technician: false,
    technicianSummary: false,
    technicianAbility: false,
    subcontract: false,
    sipyung: false,
  }));
  const ownerKeyUpper = React.useMemo(() => String(ownerId || '').toUpperCase(), [ownerId]);
  const isLHOwner = ownerKeyUpper === 'LH';
  const isKrailOwner = ownerKeyUpper === 'KRAIL';
  const isMoisOwner = ownerKeyUpper === 'MOIS';
  const isExOwner = ownerKeyUpper === 'EX';
  const selectedGroup = React.useMemo(
    () => AGREEMENT_GROUPS.find((group) => String(group.ownerId || '').toUpperCase() === ownerKeyUpper) || AGREEMENT_GROUPS[0],
    [ownerKeyUpper],
  );
  const ownerSelectValue = selectedGroup?.id || AGREEMENT_GROUPS[0]?.id || '';
  const rangeOptions = React.useMemo(() => selectedGroup?.items || [], [selectedGroup]);
  const selectedRangeOption = React.useMemo(() => (
    rangeOptions.find((item) => item.key === rangeId) || rangeOptions[0] || null
  ), [rangeId, rangeOptions]);
  const selectedRangeKey = selectedRangeOption?.key || '';
  const isMois30To50 = isMoisOwner && selectedRangeKey === MOIS_30_TO_50_KEY;
  const isMoisUnderOr30To50 = isMoisOwner && (selectedRangeKey === MOIS_UNDER_30_KEY || selectedRangeKey === MOIS_30_TO_50_KEY);
  const isPpsUnder50 = ownerKeyUpper === 'PPS' && selectedRangeKey === PPS_UNDER_50_KEY;
  const isKrailUnder50 = ownerKeyUpper === 'KRAIL' && selectedRangeKey === KRAIL_UNDER_50_KEY;
  const isKrail50To100 = ownerKeyUpper === 'KRAIL' && selectedRangeKey === KRAIL_50_TO_100_KEY;
  const isExUnder50 = isExOwner && selectedRangeKey === EX_UNDER_50_KEY;
  const isEx50To100 = isExOwner && selectedRangeKey === EX_50_TO_100_KEY;
  const technicianEnabled = isKrailOwner;
  const technicianEditable = technicianEnabled && String(fileType || '').toLowerCase() !== 'sobang';
  const technicianAbilityMax = technicianEnabled ? KRAIL_TECHNICIAN_ABILITY_MAX : null;
  const managementScale = isMois30To50 ? (10 / 15) : 1;
  const roundForKrailUnder50 = React.useCallback(
    (value) => (isKrailUnder50 ? roundTo(value, 2) : value),
    [isKrailUnder50],
  );
  const roundUpForPpsUnder50 = React.useCallback(
    (value) => {
      if (!isPpsUnder50) return value;
      if (value == null) return value;
      const numeric = toNumber(value);
      if (!Number.isFinite(numeric)) return value;
      const factor = 100;
      return Math.ceil(numeric * factor) / factor;
    },
    [isPpsUnder50],
  );
  const roundForMoisManagement = React.useCallback(
    (value) => (isMoisUnderOr30To50 ? roundTo(value, 4) : value),
    [isMoisUnderOr30To50],
  );
  const roundForLhTotals = React.useCallback(
    (value) => (isLHOwner ? roundTo(value, 2) : value),
    [isLHOwner],
  );
  const roundForPerformanceTotals = React.useCallback(
    (value) => (isExOwner ? roundTo(value, 2) : value),
    [isExOwner],
  );
  const roundForExManagement = React.useCallback(
    (value) => ((isExUnder50 || isEx50To100) ? roundTo(value, 2) : value),
    [isExUnder50, isEx50To100],
  );
  const krailCredibilityScale = React.useMemo(() => {
    if (isKrailUnder50) return 0.5 / 3;
    if (isKrail50To100) return 0.9 / 3;
    return 1;
  }, [isKrailUnder50, isKrail50To100]);
  const resolveKrailTechnicianAbilityScore = React.useCallback(
    (value) => {
      if (!technicianEnabled) return null;
      const numeric = toNumber(value);
      if (!Number.isFinite(numeric)) return null;
      if (isKrailUnder50) {
        if (numeric >= 2) return 5;
        if (numeric >= 1.5) return 4;
        if (numeric >= 0.75) return 3;
        return 0;
      }
      if (isKrail50To100) {
        if (numeric >= 3) return 5;
        if (numeric >= 2) return 4;
        if (numeric >= 1) return 3;
        return 0;
      }
      return null;
    },
    [isKrail50To100, isKrailUnder50, technicianEnabled],
  );
  const resolveSummaryDigits = React.useCallback(
    (kind) => {
      if (kind === 'technicianAbility') return 0;
      if (kind === 'technician') return technicianEnabled ? 2 : 3;
      if (kind === 'bid') return 0;
      if (kind === 'subcontract') return 0;
      if (isPpsUnder50) return 2;
      if (isKrailUnder50) return 2;
      if (isMoisUnderOr30To50 && kind === 'management') return 4;
      if (isMoisUnderOr30To50 && kind === 'performance') return 2;
      if (isMoisUnderOr30To50 && kind === 'total') return 4;
      if (isLHOwner && kind === 'performance') return 2;
      if (isLHOwner && kind === 'credibility') return 2;
      if (isLHOwner && kind === 'total') return 2;
      if (kind === 'management') return 2;
      if (kind === 'netCost') return 2;
      if (kind === 'quality') return 2;
      return 3;
    },
    [isKrailUnder50, isLHOwner, isMoisUnderOr30To50, isPpsUnder50, technicianEnabled],
  );
  const ownerDisplayLabel = selectedGroup?.label || '발주처 미지정';
  const rangeDisplayLabel = selectedRangeOption?.label || '금액대 선택';
  const entryModeResolved = entryMode === 'sum' ? 'sum' : (entryMode === 'none' ? 'none' : 'ratio');

  const handleOwnerSelectChange = React.useCallback((event) => {
    const groupId = event.target.value;
    const group = AGREEMENT_GROUPS.find((item) => item.id === groupId);
    if (!group) return;
    const nextRange = group.items && group.items.length > 0 ? group.items[0].key : null;
    if (typeof onUpdateBoard === 'function') onUpdateBoard({ ownerId: group.ownerId, rangeId: nextRange });
  }, [onUpdateBoard]);

  const handleRangeSelectChange = React.useCallback((event) => {
    const nextKey = event.target.value || null;
    if (nextKey === rangeId) return;
    if (typeof onUpdateBoard === 'function') onUpdateBoard({ rangeId: nextKey });
  }, [onUpdateBoard, rangeId]);

  const handleNoticeNoChange = React.useCallback((event) => {
    if (typeof onUpdateBoard === 'function') onUpdateBoard({ noticeNo: event.target.value });
  }, [onUpdateBoard]);

  const handleNoticeTitleChange = React.useCallback((event) => {
    if (typeof onUpdateBoard === 'function') onUpdateBoard({ noticeTitle: event.target.value });
  }, [onUpdateBoard]);

  const handleIndustryLabelChange = React.useCallback((event) => {
    const nextLabel = event.target.value;
    if (typeof onUpdateBoard !== 'function') return;
    const payload = { industryLabel: nextLabel };
    const nextFileType = industryToFileType(nextLabel);
    if (nextFileType) payload.fileType = nextFileType;
    onUpdateBoard(payload);
  }, [onUpdateBoard]);

  const searchFileType = React.useMemo(
    () => industryToFileType(industryLabel),
    [industryLabel],
  );

  const handleNoticeDateChange = React.useCallback((event) => {
    if (typeof onUpdateBoard === 'function') onUpdateBoard({ noticeDate: event.target.value });
  }, [onUpdateBoard]);

  const updateBidDeadlineFromParts = React.useCallback((date, period, hour, minute) => {
    const nextValue = buildBidDeadline(date, period, hour, minute);
    if (nextValue === null) return;
    if (typeof onUpdateBoard === 'function') onUpdateBoard({ bidDeadline: nextValue });
  }, [onUpdateBoard]);

  const handleBidDatePartChange = React.useCallback((event) => {
    const nextDate = event.target.value;
    setBidDatePart(nextDate);
    updateBidDeadlineFromParts(nextDate, bidTimePeriod, bidHourInput, bidMinuteInput);
  }, [bidTimePeriod, bidHourInput, bidMinuteInput, updateBidDeadlineFromParts]);

  const handleBidPeriodChange = React.useCallback((event) => {
    const nextPeriod = event.target.value === 'PM' ? 'PM' : 'AM';
    setBidTimePeriod(nextPeriod);
    updateBidDeadlineFromParts(bidDatePart, nextPeriod, bidHourInput, bidMinuteInput);
  }, [bidDatePart, bidHourInput, bidMinuteInput, updateBidDeadlineFromParts]);

  const handleBidHourChange = React.useCallback((event) => {
    const nextHour = String(event.target.value || '').replace(/\D/g, '').slice(0, 2);
    setBidHourInput(nextHour);
    updateBidDeadlineFromParts(bidDatePart, bidTimePeriod, nextHour, bidMinuteInput);
  }, [bidDatePart, bidTimePeriod, bidMinuteInput, updateBidDeadlineFromParts]);

  const handleBidMinuteChange = React.useCallback((event) => {
    const nextMinute = String(event.target.value || '').replace(/\D/g, '').slice(0, 2);
    setBidMinuteInput(nextMinute);
    updateBidDeadlineFromParts(bidDatePart, bidTimePeriod, bidHourInput, nextMinute);
  }, [bidDatePart, bidTimePeriod, bidHourInput, updateBidDeadlineFromParts]);

  const handleBaseAmountChange = React.useCallback((value) => {
    const nextValue = String(value ?? '');
    setBaseTouched(Boolean(nextValue.trim()));
    if (typeof onUpdateBoard === 'function') onUpdateBoard({ baseAmount: value });
  }, [onUpdateBoard]);

  const handleEstimatedAmountChange = React.useCallback((value) => {
    if (typeof onUpdateBoard === 'function') onUpdateBoard({ estimatedAmount: value });
  }, [onUpdateBoard]);

  const handleRatioBaseAmountChange = React.useCallback((value) => {
    if (typeof onUpdateBoard === 'function') onUpdateBoard({ ratioBaseAmount: value });
  }, [onUpdateBoard]);

  const handleNetCostAmountChange = React.useCallback((value) => {
    if (typeof onUpdateBoard === 'function') onUpdateBoard({ netCostAmount: value });
  }, [onUpdateBoard]);

  const handleAValueChange = React.useCallback((value) => {
    if (typeof onUpdateBoard === 'function') onUpdateBoard({ aValue: value });
  }, [onUpdateBoard]);

  const sanitizedMemoHtml = React.useMemo(() => sanitizeHtml(memoHtml || ''), [memoHtml]);
  const memoHasContent = React.useMemo(() => {
    const text = sanitizedMemoHtml.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
    return Boolean(text);
  }, [sanitizedMemoHtml]);

  const openMemoModal = React.useCallback(() => {
    setMemoDraft(sanitizedMemoHtml || '');
    setMemoOpen(true);
  }, [sanitizedMemoHtml]);

  const closeMemoModal = React.useCallback(() => {
    setMemoOpen(false);
  }, []);

  const openCopyModal = React.useCallback(() => {
    setCopyModalOpen(true);
  }, []);

  const closeCopyModal = React.useCallback(() => {
    setCopyModalOpen(false);
  }, []);

  const openTechnicianModal = React.useCallback(() => {
    setTechnicianModalOpen(true);
  }, []);

  const closeTechnicianModal = React.useCallback(() => {
    setTechnicianModalOpen(false);
  }, []);

  const technicianTargetKey = React.useMemo(
    () => `${technicianTarget.groupIndex}:${technicianTarget.slotIndex}`,
    [technicianTarget.groupIndex, technicianTarget.slotIndex],
  );

  React.useEffect(() => {
    technicianEntriesByTargetRef.current = (
      initialTechnicianEntriesByTarget && typeof initialTechnicianEntriesByTarget === 'object'
        ? { ...initialTechnicianEntriesByTarget }
        : {}
    );
  }, [initialTechnicianEntriesByTarget]);

  React.useEffect(() => {
    if (!technicianModalOpen) return;
    technicianEntriesTargetKeyRef.current = technicianTargetKey;
    const stored = technicianEntriesByTargetRef.current[technicianTargetKey];
    setTechnicianEntries(Array.isArray(stored) ? stored : []);
  }, [technicianModalOpen, technicianTargetKey]);

  React.useEffect(() => {
    if (!technicianModalOpen) return;
    const key = technicianEntriesTargetKeyRef.current || technicianTargetKey;
    const nextMap = { ...technicianEntriesByTargetRef.current, [key]: technicianEntries };
    technicianEntriesByTargetRef.current = nextMap;
    if (typeof onUpdateBoard === 'function') onUpdateBoard({ technicianEntriesByTarget: nextMap });
  }, [technicianEntries, technicianModalOpen, onUpdateBoard, technicianTargetKey]);

  const handleMemoSave = React.useCallback(() => {
    const cleaned = sanitizeHtml(memoDraft || '');
    if (typeof onUpdateBoard === 'function') onUpdateBoard({ memoHtml: cleaned });
  }, [memoDraft, onUpdateBoard]);

  const handleMemoInput = React.useCallback((event) => {
    setMemoDraft(event.currentTarget.innerHTML);
  }, []);

  const applyMemoCommand = React.useCallback((command, value) => {
    if (!memoEditorRef.current) return;
    memoEditorRef.current.focus();
    try {
      document.execCommand('styleWithCSS', false, true);
    } catch {}
    document.execCommand(command, false, value);
    setMemoDraft(memoEditorRef.current.innerHTML);
  }, []);

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

  const technicianScoreTotal = React.useMemo(() => (
    technicianEntries.reduce((sum, entry) => sum + computeTechnicianScore(entry), 0)
  ), [technicianEntries]);

  const handleAdjustmentRateChange = React.useCallback((event) => {
    const nextValue = event.target.value;
    setAdjustmentRateTouched(Boolean(String(nextValue || '').trim()));
    if (typeof onUpdateBoard === 'function') onUpdateBoard({ adjustmentRate: nextValue });
  }, [onUpdateBoard]);

  const handleBidRateChange = React.useCallback((event) => {
    const nextValue = event.target.value;
    setBidRateTouched(Boolean(String(nextValue || '').trim()));
    if (typeof onUpdateBoard === 'function') onUpdateBoard({ bidRate: nextValue });
  }, [onUpdateBoard]);

  const handleRegionDutyRateChange = React.useCallback((event) => {
    if (typeof onUpdateBoard === 'function') onUpdateBoard({ regionDutyRate: event.target.value });
  }, [onUpdateBoard]);

  const handleParticipantLimitChange = React.useCallback((event) => {
    if (typeof onUpdateBoard !== 'function') return;
    const nextValue = Number(event.target.value);
    onUpdateBoard({ participantLimit: nextValue, groupSize: nextValue });
  }, [onUpdateBoard]);

  const safeDutyRegions = React.useMemo(
    () => (Array.isArray(dutyRegions) ? dutyRegions.filter((name) => typeof name === 'string' && name.trim()) : []),
    [dutyRegions],
  );
  const [regionOptions, setRegionOptions] = React.useState([]);
  const [regionPickerOpen, setRegionPickerOpen] = React.useState(false);
  const [regionFilter, setRegionFilter] = React.useState('');

  React.useEffect(() => {
    let canceled = false;
    const fetchRegions = async () => {
      if (!window?.electronAPI?.getRegions) return;
      try {
        const response = await window.electronAPI.getRegions(fileType || 'all');
        if (!response?.success || !Array.isArray(response.data)) return;
        const list = response.data
          .filter((name) => name && name !== '전체')
          .map((name) => String(name).trim())
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b, 'ko-KR'));
        if (!canceled) setRegionOptions(list);
      } catch {
        /* ignore */
      }
    };
    fetchRegions();
    return () => {
      canceled = true;
    };
  }, [fileType]);

  const filteredRegionOptions = React.useMemo(() => {
    const keyword = regionFilter.trim();
    if (!keyword) return regionOptions;
    const lowered = keyword.toLowerCase();
    return regionOptions.filter((name) => name.toLowerCase().includes(lowered));
  }, [regionOptions, regionFilter]);

  const handleDutyRegionToggle = React.useCallback((region) => {
    if (!region || typeof onUpdateBoard !== 'function') return;
    const exists = safeDutyRegions.includes(region);
    const updated = exists
      ? safeDutyRegions.filter((name) => name !== region)
      : [...safeDutyRegions, region];
    onUpdateBoard({ dutyRegions: updated });
  }, [onUpdateBoard, safeDutyRegions]);

  const handleDutyRegionsClear = React.useCallback(() => {
    if (typeof onUpdateBoard === 'function') onUpdateBoard({ dutyRegions: [] });
  }, [onUpdateBoard]);

  const toggleRegionPicker = React.useCallback(() => {
    setRegionPickerOpen((prev) => !prev);
  }, []);

  const closeRegionModal = React.useCallback(() => {
    setRegionPickerOpen(false);
  }, []);

  const handleRegionFilterChange = React.useCallback((event) => {
    setRegionFilter(event.target.value);
  }, []);

  React.useEffect(() => {
    if (!noticeDate && typeof onUpdateBoard === 'function') {
      const today = new Date();
      const pad = (value) => String(value).padStart(2, '0');
      const iso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
      onUpdateBoard({ noticeDate: iso });
    }
  }, [noticeDate, onUpdateBoard]);

  const openMinRatingModal = React.useCallback(() => {
    setMinRatingOpen(true);
  }, []);
  const closeMinRatingModal = React.useCallback(() => {
    setMinRatingOpen(false);
  }, []);

  React.useEffect(() => {
    if (!minRatingOpen) return;
    const dutyShare = parseNumeric(regionDutyRate);
    if (Number.isFinite(dutyShare) && dutyShare > 0) {
      setMinRatingRequiredShare(String(dutyShare));
    } else {
      setMinRatingRequiredShare('');
    }
  }, [minRatingOpen, regionDutyRate]);

  const credibilityConfig = React.useMemo(() => {
    if (ownerKeyUpper === 'LH') return { enabled: true, max: null };
    if (ownerKeyUpper === 'PPS') return { enabled: true, max: null };
    if (ownerKeyUpper === 'KRAIL') return { enabled: true, max: null };
    if (ownerKeyUpper === 'EX') return { enabled: true, max: null };
    return { enabled: false, max: null };
  }, [ownerKeyUpper]);
  const credibilityEnabled = credibilityConfig.enabled;
  const ownerCredibilityMax = credibilityConfig.max;
  const ownerPerformanceFallback = React.useMemo(() => {
    if (isKrailUnder50) {
      const normalizedType = String(fileType || '').toLowerCase();
      if (normalizedType === 'sobang') return 15;
      return 10;
    }
    if (isKrail50To100) return 15;
    return resolveOwnerPerformanceMax(ownerKeyUpper);
  }, [fileType, isKrail50To100, isKrailUnder50, ownerKeyUpper]);
  const candidateScoreCacheRef = React.useRef(new Map());
  const performanceCapRef = React.useRef(ownerPerformanceFallback);
  const getPerformanceCap = React.useCallback(() => (
    resolvePerformanceCap(performanceCapRef.current, ownerPerformanceFallback)
  ), [ownerPerformanceFallback]);
  const updatePerformanceCap = (value) => {
    const resolved = resolvePerformanceCap(value, ownerPerformanceFallback);
    performanceCapRef.current = resolved;
    return resolved;
  };
  React.useEffect(() => {
    performanceCapRef.current = ownerPerformanceFallback;
  }, [ownerPerformanceFallback]);
  const [candidateMetricsVersion, setCandidateMetricsVersion] = React.useState(0);
  const prevAssignmentsRef = React.useRef(groupAssignments);
  const [representativeSearchOpen, setRepresentativeSearchOpen] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [editableBidAmount, setEditableBidAmount] = React.useState(bidAmount);
  const [editableEntryAmount, setEditableEntryAmount] = React.useState(entryAmount);
  const [excelCopying, setExcelCopying] = React.useState(false);
  const [copyingKind, setCopyingKind] = React.useState(null);
  const [baseTouched, setBaseTouched] = React.useState(false);
  const [bidTouched, setBidTouched] = React.useState(false);
  const [bidRateTouched, setBidRateTouched] = React.useState(false);
  const [adjustmentRateTouched, setAdjustmentRateTouched] = React.useState(false);
  const baseAutoRef = React.useRef('');
  const bidAutoRef = React.useRef('');
  const { notify, confirm, showLoading, hideLoading } = useFeedback();
  const searchTargetRef = React.useRef(null);
  const pendingPlacementRef = React.useRef(null);
  const rootRef = React.useRef(null);
  const boardMainRef = React.useRef(null);
  const skipAssignmentSyncRef = React.useRef(false);

  const markSkipAssignmentSync = React.useCallback(() => {
    skipAssignmentSyncRef.current = true;
  }, []);

  const showHeaderAlert = React.useCallback((message) => {
    if (!message) return;
    notify({ type: 'info', message });
  }, [notify]);

  const possibleShareBase = React.useMemo(() => {
    const sources = ownerKeyUpper === 'LH'
      ? [ratioBaseAmount]
      : [editableBidAmount, bidAmount];
    for (const source of sources) {
      const parsed = parseAmountValue(source);
      if (parsed !== null && parsed > 0) return parsed;
    }
    if (ownerKeyUpper === 'MOIS' && selectedRangeKey === MOIS_30_TO_50_KEY) {
      const baseValue = parseAmountValue(baseAmount);
      const bidRateValue = parsePercentValue(bidRate);
      const adjustmentValue = parsePercentValue(adjustmentRate);
      if (baseValue && baseValue > 0 && Number.isFinite(bidRateValue) && Number.isFinite(adjustmentValue)) {
        const computed = Math.round(baseValue * bidRateValue * adjustmentValue);
        if (computed > 0) return computed;
      }
    }
    return null;
  }, [ownerKeyUpper, selectedRangeKey, ratioBaseAmount, editableBidAmount, bidAmount, baseAmount, bidRate, adjustmentRate]);

  const { perfectPerformanceAmount, perfectPerformanceBasis } = React.useMemo(() => {
    const rangeKey = String(selectedRangeOption?.key || '').toLowerCase();
    const estimated = parseAmountValue(estimatedAmount) || 0;
    const base = parseAmountValue(baseAmount) || 0;

    if (ownerKeyUpper === 'PPS') {
      return base > 0
        ? { perfectPerformanceAmount: base, perfectPerformanceBasis: '기초금액 × 1배' }
        : { perfectPerformanceAmount: 0, perfectPerformanceBasis: '' };
    }

    if (ownerKeyUpper === 'MOIS') {
      if (rangeKey === 'mois-under30' || rangeKey === 'mois-30to50') {
        return estimated > 0
          ? { perfectPerformanceAmount: Math.round(estimated * 0.8), perfectPerformanceBasis: '추정가격 × 80%' }
          : { perfectPerformanceAmount: 0, perfectPerformanceBasis: '' };
      }
      if (rangeKey === 'mois-50to100') {
        return estimated > 0
          ? { perfectPerformanceAmount: Math.round(estimated * 1.7), perfectPerformanceBasis: '추정가격 × 1.7배' }
          : { perfectPerformanceAmount: 0, perfectPerformanceBasis: '' };
      }
    }

    if (ownerKeyUpper === 'LH') {
      if (rangeKey === 'lh-under50') {
        return base > 0
          ? { perfectPerformanceAmount: base, perfectPerformanceBasis: '기초금액 × 1배' }
          : { perfectPerformanceAmount: 0, perfectPerformanceBasis: '' };
      }
      if (rangeKey === 'lh-50to100') {
        return base > 0
          ? { perfectPerformanceAmount: base * 2, perfectPerformanceBasis: '기초금액 × 2배' }
          : { perfectPerformanceAmount: 0, perfectPerformanceBasis: '' };
      }
    }

    if (ownerKeyUpper === 'KRAIL' && rangeKey === KRAIL_UNDER_50_KEY) {
      if (base <= 0) return { perfectPerformanceAmount: 0, perfectPerformanceBasis: '' };
      const normalizedType = String(fileType || '').toLowerCase();
      if (normalizedType === 'sobang') {
        const threshold = 30 * KOREAN_UNIT;
        const estimatedValue = parseAmountValue(estimatedAmount) || 0;
        const multiplier = estimatedValue >= threshold ? 3 : 2;
        return { perfectPerformanceAmount: base * multiplier, perfectPerformanceBasis: `기초금액 × ${multiplier}배` };
      }
      return { perfectPerformanceAmount: base, perfectPerformanceBasis: '기초금액 × 1배' };
    }

    if (ownerKeyUpper === 'EX' && rangeKey === EX_UNDER_50_KEY) {
      return base > 0
        ? { perfectPerformanceAmount: base, perfectPerformanceBasis: '기초금액 × 1배' }
        : { perfectPerformanceAmount: 0, perfectPerformanceBasis: '' };
    }

    return { perfectPerformanceAmount: 0, perfectPerformanceBasis: '' };
  }, [ownerKeyUpper, selectedRangeOption?.key, estimatedAmount, baseAmount, fileType]);

  const perfectPerformanceDisplay = React.useMemo(() => {
    if (!perfectPerformanceAmount || perfectPerformanceAmount <= 0) return '';
    const formatted = Math.round(perfectPerformanceAmount).toLocaleString();
    return perfectPerformanceBasis ? `${formatted} (${perfectPerformanceBasis})` : formatted;
  }, [perfectPerformanceAmount, perfectPerformanceBasis]);

  const buildRegionSearchPayload = React.useCallback(() => ({
    ownerId,
    menuKey: selectedRangeKey,
    rangeId: selectedRangeKey,
    fileType,
    noticeNo,
    noticeTitle,
    noticeDate,
    industryLabel,
    entryAmount,
    entryMode: entryModeResolved,
    baseAmount,
    estimatedAmount,
    bidAmount,
    bidRate,
    adjustmentRate,
    perfectPerformanceAmount,
    dutyRegions,
    ratioBaseAmount: isPpsUnder50 ? (bidAmount || ratioBaseAmount || '') : (ratioBaseAmount || bidAmount || ''),
    defaultExcludeSingle: true,
    readOnly: true,
  }), [
    ownerId,
    selectedRangeKey,
    fileType,
    noticeNo,
    noticeTitle,
    noticeDate,
    industryLabel,
    entryAmount,
    entryModeResolved,
    baseAmount,
    estimatedAmount,
    bidAmount,
    bidRate,
    adjustmentRate,
    perfectPerformanceAmount,
    dutyRegions,
    ratioBaseAmount,
    isPpsUnder50,
  ]);

  const handleOpenRegionSearch = React.useCallback(() => {
    const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    regionSearchSessionRef.current = sessionId;
    const payload = { ...buildRegionSearchPayload(), sessionId };
    openRegionSearch(payload);
  }, [buildRegionSearchPayload]);

  React.useEffect(() => {
    const unsubscribe = subscribeRegionSearch((next) => {
      if (!next.open && next.props?.sessionId === regionSearchSessionRef.current) {
        regionSearchSessionRef.current = null;
      }
    });
    return unsubscribe;
  }, []);

  React.useEffect(() => {
    const sessionId = regionSearchSessionRef.current;
    if (!sessionId) return;
    const currentState = getRegionSearchState();
    if (!currentState.open || currentState.props?.sessionId !== sessionId) return;
    updateRegionSearchProps(buildRegionSearchPayload(), sessionId);
  }, [buildRegionSearchPayload]);


  const formatPercentValue = React.useCallback((value, digits = 1) => {
    if (value == null) return '-';
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '-';
    return `${numeric.toFixed(digits).replace(/\.0$/, '')}%`;
  }, []);

  const derivePendingPlacementHint = React.useCallback((picked) => {
    if (!picked || typeof picked !== 'object') {
      return { candidateId: null, matchBizNo: '', matchNameKey: '' };
    }
    const snapshot = picked.snapshot && typeof picked.snapshot === 'object' ? picked.snapshot : {};
    const bizRaw = picked.bizNo
      || snapshot.bizNo
      || snapshot.BizNo
      || snapshot['사업자번호']
      || snapshot['사업자 번호']
      || snapshot['사업자등록번호']
      || '';
    const matchBizNo = normalizeBizNo(bizRaw);
    const candidateName = sanitizeCompanyName(
      picked.name
      || snapshot['검색된 회사']
      || snapshot['업체명']
      || snapshot['회사명']
      || snapshot.companyName
      || '',
    );
    let candidateId = picked.id || null;
    if (!candidateId) {
      if (matchBizNo) {
        candidateId = `search:${matchBizNo}`;
      } else if (candidateName) {
        candidateId = `search:${candidateName}`;
      }
    }
    return {
      candidateId,
      matchBizNo,
      matchNameKey: candidateName ? candidateName.toLowerCase() : '',
    };
  }, []);

  const isLH = ownerId === 'LH';
  const lhQualityDefault = React.useMemo(() => {
    if (!isLHOwner) return null;
    return resolveLhQualityDefaultByRange(selectedRangeOption?.label, selectedRangeOption?.key);
  }, [isLHOwner, selectedRangeOption?.label, selectedRangeOption?.key]);

  const resolveQualityPoints = React.useCallback((qualityTotal, rangeKey) => {
    if (!Number.isFinite(qualityTotal)) return null;
    if (rangeKey === LH_50_TO_100_KEY) {
      if (qualityTotal >= 90) return 5;
      if (qualityTotal >= 88) return 3;
      if (qualityTotal >= 85) return 2;
      if (qualityTotal >= 83) return 1.5;
      if (qualityTotal >= 80) return 1;
      return 0;
    }
    if (qualityTotal >= 88) return 3;
    if (qualityTotal >= 85) return 2;
    if (qualityTotal >= 83) return 1.5;
    if (qualityTotal >= 80) return 1;
    return 0;
  }, []);

  const resolveQualityPointsMax = React.useCallback((rangeKey) => (
    rangeKey === LH_50_TO_100_KEY ? 5 : 3
  ), []);

  const netCostBonusScore = React.useMemo(() => {
    if (!isLHOwner) return 0;
    const rangeKey = selectedRangeOption?.key;
    if (rangeKey !== LH_UNDER_50_KEY && rangeKey !== LH_50_TO_100_KEY) return 0;
    const base = toNumber(baseAmount);
    const netCost = toNumber(netCostAmount);
    const aValueNumber = toNumber(aValue);
    if (!base || !netCost || !aValueNumber) return 0;
    const expectedMin = roundUpThousand(base * 0.988);
    const expectedMax = roundUpThousand(base * 1.012);
    if (!expectedMin || !expectedMax) return 0;
    if (expectedMin <= aValueNumber || expectedMax <= aValueNumber) return 0;
    const bidMin = netCost * (expectedMin / base) * 0.98;
    const bidMax = netCost * (expectedMax / base) * 0.98;
    const rMinRaw = (bidMin - aValueNumber) / (expectedMin - aValueNumber);
    const rMaxRaw = (bidMax - aValueNumber) / (expectedMax - aValueNumber);
    const rMin = roundTo(rMinRaw, 4);
    const rMax = roundTo(rMaxRaw, 4);
    if (!Number.isFinite(rMin) || !Number.isFinite(rMax)) return 0;
    const priceScore = (ratio) => (
      rangeKey === LH_50_TO_100_KEY
        ? 50 - (2 * Math.abs((0.88 - ratio) * 100))
        : 70 - (4 * Math.abs((0.88 - ratio) * 100))
    );
    const baseline = rangeKey === LH_50_TO_100_KEY ? 45 : 65;
    const bonusMin = priceScore(rMin) - baseline;
    const bonusMax = priceScore(rMax) - baseline;
    const conservative = Math.min(bonusMin, bonusMax);
    if (!(conservative > 0)) return 0;
    const truncated = truncateScore(conservative, 2);
    return truncated != null ? clampScore(truncated, 999) : 0;
  }, [isLHOwner, selectedRangeOption?.key, baseAmount, netCostAmount, aValue]);

  const netCostPenaltyNotice = React.useMemo(() => {
    if (!isLHOwner) return false;
    const rangeKey = selectedRangeOption?.key;
    if (rangeKey !== LH_UNDER_50_KEY && rangeKey !== LH_50_TO_100_KEY) return false;
    const base = toNumber(baseAmount);
    const netCost = toNumber(netCostAmount);
    const aValueNumber = toNumber(aValue);
    if (!base || !netCost || !aValueNumber) return false;
    const expectedMin = roundUpThousand(base * 0.988);
    const expectedMax = roundUpThousand(base * 1.012);
    if (!expectedMin || !expectedMax) return false;
    if (expectedMin <= aValueNumber || expectedMax <= aValueNumber) return false;
    const bidMin = netCost * (expectedMin / base) * 0.98;
    const bidMax = netCost * (expectedMax / base) * 0.98;
    const rMin = roundTo((bidMin - aValueNumber) / (expectedMin - aValueNumber), 4);
    const rMax = roundTo((bidMax - aValueNumber) / (expectedMax - aValueNumber), 4);
    return Number.isFinite(rMin) && Number.isFinite(rMax) && (rMin > 0.88 || rMax > 0.88);
  }, [isLHOwner, selectedRangeOption?.key, baseAmount, netCostAmount, aValue]);

  React.useEffect(() => {
    if (!minRatingOpen) return;
    setMinRatingNetCostBonus(formatScore(netCostBonusScore, 2));
  }, [minRatingOpen, netCostBonusScore]);

  React.useEffect(() => {
    let canceled = false;
    const load = async () => {
      if (!open) return;
      const api = typeof window !== 'undefined' ? window.electronAPI : null;
      if (!api?.formulasLoad) return;
      try {
        const response = await api.formulasLoad();
        if (canceled) return;
        if (response?.data) {
          setFormulasDoc(response.data);
        }
      } catch (err) {
        console.warn('[AgreementBoard] formulasLoad failed:', err?.message || err);
      }
    };
    load();
    return () => {
      canceled = true;
    };
  }, [open]);
  const safeGroupSize = React.useMemo(() => {
    const parsed = Number(groupSize);
    if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_GROUP_SIZE;
    return Math.max(1, Math.floor(parsed));
  }, [groupSize]);
  const safeParticipantLimit = React.useMemo(() => {
    const parsed = Number(participantLimit);
    const fallback = Math.min(DEFAULT_GROUP_SIZE, safeGroupSize);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    const clamped = Math.min(Math.max(Math.floor(parsed), 2), Math.min(5, safeGroupSize));
    return clamped;
  }, [participantLimit, safeGroupSize]);

  React.useEffect(() => {
    if (typeof onUpdateBoard !== 'function') return;
    onUpdateBoard({
      groupAssignments,
      groupShares,
      groupShareRawInputs,
      groupCredibility,
      groupTechnicianScores,
      groupApprovals,
      groupManagementBonus,
      groupQualityScores,
    });
  }, [
    groupAssignments,
    groupShares,
    groupShareRawInputs,
    groupCredibility,
    groupTechnicianScores,
    groupApprovals,
    groupManagementBonus,
    groupQualityScores,
    onUpdateBoard,
  ]);

  const slotLabels = React.useMemo(() => (
    Array.from({ length: safeGroupSize }, (_, index) => (index === 0 ? '대표사' : `구성원${index}`))
  ), [safeGroupSize]);

  const {
    loadModalOpen,
    loadFilters,
    loadItems: filteredLoadItems,
    loadBusy,
    loadError,
    loadRootPath,
    dutyRegionOptions,
    setLoadFilters,
    openLoadModal,
    closeLoadModal,
    handleSaveAgreement,
    handleLoadAgreement,
    handleDeleteAgreement,
    handlePickRoot,
    resetFilters,
  } = useAgreementBoardStorage({
    ownerId,
    ownerDisplayLabel,
    selectedRangeOption,
    industryLabel,
    estimatedAmount,
    noticeDate,
    baseAmount,
    bidAmount,
    ratioBaseAmount,
    bidRate,
    adjustmentRate,
    entryAmount,
    entryModeResolved,
    noticeNo,
    noticeTitle,
    bidDeadline,
    regionDutyRate,
    participantLimit,
    dutyRegions,
    safeGroupSize,
    fileType,
    netCostAmount,
    aValue,
    memoHtml,
    candidates,
    pinned,
    excluded,
    alwaysInclude,
    groupAssignments,
    groupShares,
    groupShareRawInputs,
    groupCredibility,
    groupTechnicianScores,
    groupApprovals,
    groupManagementBonus,
    groupQualityScores,
    technicianEntriesByTarget: initialTechnicianEntriesByTarget,
    setGroupAssignments,
    setGroupShares,
    setGroupShareRawInputs,
    setGroupCredibility,
    setGroupTechnicianScores,
    setGroupApprovals,
    setGroupManagementBonus,
    setGroupQualityScores,
    markSkipAssignmentSync,
    onUpdateBoard,
    showHeaderAlert,
    parseNumeric,
  });

  const loadRangeOptions = React.useMemo(() => {
    if (loadFilters.ownerId) {
      const group = AGREEMENT_GROUPS.find((item) => item.ownerId === loadFilters.ownerId);
      return group?.items || [];
    }
    const map = new Map();
    AGREEMENT_GROUPS.forEach((group) => {
      (group.items || []).forEach((item) => {
        if (!map.has(item.key)) {
          map.set(item.key, { key: item.key, label: item.label });
        }
      });
    });
    return Array.from(map.values());
  }, [loadFilters.ownerId]);

  const toggleColumnCollapse = React.useCallback((key) => {
    setCollapsedColumns((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

  const resolveColWidth = React.useCallback((widthKey, collapsedKey = widthKey) => {
    const baseWidth = COLUMN_WIDTHS[widthKey];
    const collapsedWidth = COLLAPSED_COLUMN_WIDTHS[widthKey]
      ?? COLLAPSED_COLUMN_WIDTHS[collapsedKey]
      ?? 26;
    const isCollapsed = collapsedColumns[collapsedKey];
    return `${isCollapsed ? collapsedWidth : baseWidth}px`;
  }, [collapsedColumns]);

  const tableCollapseClasses = React.useMemo(() => (
    Object.entries(collapsedColumns)
      .filter(([, value]) => value)
      .map(([key]) => `is-collapsed-${key}`)
      .join(' ')
  ), [collapsedColumns]);

  const renderColToggle = React.useCallback((key, label, options = {}) => {
    const collapsed = collapsedColumns[key];
    const displayLabel = collapsed && options.collapsedLabel != null ? options.collapsedLabel : label;
    return (
      <button
        type="button"
        className={`col-toggle${collapsed ? ' collapsed' : ''}`}
        onClick={() => toggleColumnCollapse(key)}
        aria-pressed={collapsed}
      >
        <span className="col-toggle-label">{displayLabel}</span>
        <span className="col-toggle-caret" aria-hidden="true">{collapsed ? '▸' : '▾'}</span>
      </button>
    );
  }, [collapsedColumns, toggleColumnCollapse]);

  const tableMinWidth = React.useMemo(() => {
    const nameWidth = slotLabels.length * (collapsedColumns.name ? COLLAPSED_COLUMN_WIDTHS.name : COLUMN_WIDTHS.name);
    const shareWidth = slotLabels.length * (collapsedColumns.share ? COLLAPSED_COLUMN_WIDTHS.share : COLUMN_WIDTHS.share);
    const credibilityWidth = credibilityEnabled
      ? slotLabels.length * (collapsedColumns.credibility ? COLLAPSED_COLUMN_WIDTHS.credibilityCell : COLUMN_WIDTHS.credibilityCell)
      : 0;
    const statusWidth = slotLabels.length * (collapsedColumns.status ? COLLAPSED_COLUMN_WIDTHS.status : COLUMN_WIDTHS.status);
    const perfCellsWidth = slotLabels.length * (collapsedColumns.performance ? COLLAPSED_COLUMN_WIDTHS.performanceCell : COLUMN_WIDTHS.performanceCell);
    const technicianCellsWidth = technicianEnabled
      ? slotLabels.length * (collapsedColumns.technician ? COLLAPSED_COLUMN_WIDTHS.technicianCell : COLUMN_WIDTHS.technicianCell)
      : 0;
    const sipyungCellsWidth = slotLabels.length * (collapsedColumns.sipyung ? COLLAPSED_COLUMN_WIDTHS.sipyungCell : COLUMN_WIDTHS.sipyungCell);
    const base = (collapsedColumns.order ? COLLAPSED_COLUMN_WIDTHS.order : COLUMN_WIDTHS.order)
      + (collapsedColumns.select ? COLLAPSED_COLUMN_WIDTHS.select : COLUMN_WIDTHS.select)
      + (collapsedColumns.approval ? COLLAPSED_COLUMN_WIDTHS.approval : COLUMN_WIDTHS.approval)
      + COLUMN_WIDTHS.management
      + (collapsedColumns.managementBonus ? COLLAPSED_COLUMN_WIDTHS.managementBonus : COLUMN_WIDTHS.managementBonus)
      + COLUMN_WIDTHS.shareTotal
      + (isLHOwner ? COLUMN_WIDTHS.qualityPoints : 0)
      + (credibilityEnabled ? COLUMN_WIDTHS.credibility : 0)
      + COLUMN_WIDTHS.performanceSummary
      + (technicianEnabled
        ? (collapsedColumns.technicianSummary ? COLLAPSED_COLUMN_WIDTHS.technicianSummary : COLUMN_WIDTHS.technicianSummary)
          + (collapsedColumns.technicianAbility ? COLLAPSED_COLUMN_WIDTHS.technicianAbilitySummary : COLUMN_WIDTHS.technicianAbilitySummary)
        : 0)
      + ((isMois30To50 || isEx50To100)
        ? (collapsedColumns.subcontract ? COLLAPSED_COLUMN_WIDTHS.subcontract : COLUMN_WIDTHS.subcontract)
        : 0)
      + COLUMN_WIDTHS.bid
      + COLUMN_WIDTHS.netCostBonus
      + COLUMN_WIDTHS.total
      + COLUMN_WIDTHS.sipyungSummary;
    const total = base + nameWidth + shareWidth + credibilityWidth + statusWidth
      + perfCellsWidth + technicianCellsWidth + sipyungCellsWidth;
    return Math.max(1200, total);
  }, [slotLabels.length, credibilityEnabled, isLHOwner, isMois30To50, isEx50To100, technicianEnabled, collapsedColumns]);

  const derivedMaxScores = React.useMemo(() => {
    if (!formulasDoc) return { managementMax: null, performanceMax: null };
    const agencyId = String(ownerId || '').toLowerCase();
    const agencies = Array.isArray(formulasDoc.agencies) ? formulasDoc.agencies : [];
    const agency = agencies.find((item) => String(item?.id || '').toLowerCase() === agencyId) || null;
    if (!agency) return { managementMax: null, performanceMax: null };
    const amountHint = parseRangeAmountHint(ownerKeyUpper, selectedRangeOption?.label);
    const tier = selectTierByAmount(agency.tiers || [], amountHint);
    if (!tier) return { managementMax: null, performanceMax: null };
    const resolvedPerformanceRules = resolvePerformanceRules(tier.rules?.performance, {
      fileType,
      estimatedAmount,
    });
    return {
      managementMax: deriveManagementMax(tier.rules?.management),
      performanceMax: derivePerformanceMax(resolvedPerformanceRules),
    };
  }, [formulasDoc, ownerId, ownerKeyUpper, selectedRangeOption?.label, fileType, estimatedAmount]);

  const managementMax = React.useMemo(() => (
    isMois30To50 ? 10 : (derivedMaxScores.managementMax ?? MANAGEMENT_SCORE_MAX)
  ), [isMois30To50, derivedMaxScores.managementMax]);


  const minRatingResult = React.useMemo(() => {
    if (!isLHOwner) return { status: 'inactive' };
    const requiredShareRaw = parseNumeric(minRatingRequiredShare);
    const requiredShare = Number.isFinite(requiredShareRaw)
      ? Math.min(Math.max(requiredShareRaw, 0), 100)
      : null;
    const ratioBaseValue = parseAmountValue(ratioBaseAmount);
    if (!(requiredShare > 0)) return { status: 'needShare' };
    if (!(ratioBaseValue > 0)) return { status: 'needRatioBase', requiredShare };
    const credibilityScoreRaw = parseNumeric(minRatingCredibilityScore);
    const credibilityShareRaw = parseNumeric(minRatingCredibilityShare);
    const credibilityShare = Number.isFinite(credibilityShareRaw)
      ? Math.min(Math.max(credibilityShareRaw, 0), 100)
      : 0;
    const netCostBonusValue = parseNumeric(minRatingNetCostBonus) || 0;
    const credibilityBonusRaw = (Number.isFinite(credibilityScoreRaw) && credibilityScoreRaw > 0 && credibilityShare > 0)
      ? credibilityScoreRaw * (credibilityShare / 100)
      : 0;
    const credibilityBonus = roundForLhTotals(credibilityBonusRaw) || 0;
    const bonusTotal = roundForLhTotals(netCostBonusValue + credibilityBonus) || 0;
    const performanceMax = (derivedMaxScores.performanceMax ?? ownerPerformanceFallback ?? 0) || 0;
    const managementMaxValue = Number.isFinite(managementMax) ? managementMax : MANAGEMENT_SCORE_MAX;
    const step = 0.1;
    const maxShare = Math.min(requiredShare, 100);
    const steps = Math.max(0, Math.round(maxShare / step));
    let best = null;
    for (let i = 0; i <= steps; i += 1) {
      const possibleShare = roundTo(i * step, 1);
      const effectiveShare = Math.min(100, (100 - requiredShare) + Math.min(possibleShare, requiredShare));
      const shareRatio = Math.max(0, Math.min(effectiveShare / 100, 1));
      const managementScore = roundForLhTotals(managementMaxValue * shareRatio) || 0;
      const qualityTotal = 85 * shareRatio;
      const qualityPoints = resolveQualityPoints(qualityTotal, selectedRangeOption?.key) || 0;
      const totalScore = roundForLhTotals(
        managementScore
          + performanceMax
          + BID_SCORE_DEFAULT
          + (netCostBonusValue || 0)
          + credibilityBonus
          + qualityPoints
      ) || 0;
      if (totalScore >= (LH_FULL_SCORE - 1e-6)) {
        best = {
          possibleShare,
          effectiveShare,
          managementScore,
          qualityTotal,
          qualityPoints,
          totalScore,
        };
        break;
      }
    }
    if (!best) {
      const reason = bonusTotal <= 0 ? '가점 없음' : '가점 부족';
      return {
        status: 'impossible',
        requiredShare,
        netCostBonusValue,
        credibilityBonus,
        performanceMax,
        bonusTotal,
        reason,
      };
    }
    const minRatingAmount = Math.ceil(ratioBaseValue * (best.possibleShare / 100));
    return {
      status: 'ok',
      requiredShare,
      ratioBaseValue,
      performanceMax,
      netCostBonusValue,
      credibilityBonus,
      bonusTotal,
      minRatingAmount,
      ...best,
    };
  }, [
    derivedMaxScores.performanceMax,
    isLHOwner,
    managementMax,
    minRatingCredibilityScore,
    minRatingCredibilityShare,
    minRatingNetCostBonus,
    minRatingRequiredShare,
    netCostBonusScore,
    ownerPerformanceFallback,
    ratioBaseAmount,
    resolveQualityPoints,
    roundForLhTotals,
    selectedRangeOption?.key,
  ]);

  React.useEffect(() => {
    if (open) {
      setEditableBidAmount(bidAmount);
      setEditableEntryAmount(entryAmount);
    }
  }, [bidAmount, entryAmount, open]);

  React.useEffect(() => {
    if (!open) return;
    const parts = parseBidDeadlineParts(bidDeadline);
    setBidDatePart(parts.date);
    setBidTimePeriod(parts.period);
    setBidHourInput(parts.hour);
    setBidMinuteInput(parts.minute);
  }, [open, bidDeadline]);

  React.useEffect(() => {
    if (!memoOpen) return;
    if (memoEditorRef.current) {
      memoEditorRef.current.innerHTML = memoDraft || '';
    }
  }, [memoOpen]);

  React.useEffect(() => {
    setBaseTouched(false);
    setBidTouched(false);
    baseAutoRef.current = '';
    bidAutoRef.current = '';
  }, [ownerKeyUpper]);

  const bidAutoConfig = React.useMemo(() => {
    if (ownerKeyUpper === 'PPS' && selectedRangeOption?.key === PPS_UNDER_50_KEY) {
      return { bidRate: '86.745', adjustmentRate: '101.6', baseMultiplier: 1.1 };
    }
    if (ownerKeyUpper === 'MOIS' && selectedRangeOption?.key === MOIS_30_TO_50_KEY) {
      return { bidRate: '88.745', adjustmentRate: '101.8', baseMultiplier: 1.1 };
    }
    return null;
  }, [ownerKeyUpper, selectedRangeOption?.key]);

  React.useEffect(() => {
    if (!bidAutoConfig) return;
    const { bidRate: defaultBidRate, adjustmentRate: defaultAdjustmentRate } = bidAutoConfig;
    const currentBidRate = String(bidRate || '').trim();
    const currentAdjustmentRate = String(adjustmentRate || '').trim();
    if (!currentBidRate && !bidRateTouched) {
      if (typeof onUpdateBoard === 'function') onUpdateBoard({ bidRate: defaultBidRate });
    }
    if (!currentAdjustmentRate && !adjustmentRateTouched) {
      if (typeof onUpdateBoard === 'function') onUpdateBoard({ adjustmentRate: defaultAdjustmentRate });
    }
  }, [
    bidAutoConfig,
    bidRate,
    adjustmentRate,
    bidRateTouched,
    adjustmentRateTouched,
    onUpdateBoard,
  ]);

  React.useEffect(() => {
    if (!bidAutoConfig) return;
    const estimated = parseAmountValue(estimatedAmount);
    const autoValue = estimated && estimated > 0
      ? Math.round(estimated * bidAutoConfig.baseMultiplier)
      : 0;
    const autoFormatted = formatPlainAmount(autoValue);
    const current = baseAmount || '';
    const lastAuto = baseAutoRef.current;
    const normalizedCurrent = normalizeAmountToken(current);
    const normalizedLastAuto = normalizeAmountToken(lastAuto);
    const normalizedAuto = normalizeAmountToken(autoFormatted);
    baseAutoRef.current = autoFormatted;
    if (baseTouched) return;
    if (normalizedCurrent && normalizedCurrent !== normalizedLastAuto && normalizedCurrent !== normalizedAuto) return;
    if (normalizedCurrent === normalizedAuto) return;
    if (!normalizedAuto && !normalizedCurrent) return;
    if (typeof onUpdateBoard === 'function') onUpdateBoard({ baseAmount: autoFormatted });
  }, [bidAutoConfig, estimatedAmount, baseAmount, baseTouched, onUpdateBoard]);

  React.useEffect(() => {
    if (!bidAutoConfig) return;
    const base = parseAmountValue(baseAmount);
    const bidRateValue = parsePercentValue(bidRate);
    const adjustmentValue = parsePercentValue(adjustmentRate);
    const autoValue = base && base > 0 && Number.isFinite(bidRateValue) && Number.isFinite(adjustmentValue)
      ? Math.round(base * bidRateValue * adjustmentValue)
      : 0;
    const autoFormatted = formatPlainAmount(autoValue);
    const current = editableBidAmount || '';
    const lastAuto = bidAutoRef.current;
    bidAutoRef.current = autoFormatted;
    if (bidTouched && current !== lastAuto) return;
    if (current && current !== lastAuto && current !== autoFormatted) return;
    if (current === (autoFormatted || '')) return;
    if (!autoFormatted && current === '') return;
    setEditableBidAmount(autoFormatted);
    if (typeof onUpdateBoard === 'function') onUpdateBoard({ bidAmount: autoFormatted });
  }, [bidAutoConfig, baseAmount, bidRate, adjustmentRate, editableBidAmount, bidTouched, onUpdateBoard]);

  const handleBidAmountChange = (value) => {
    setEditableBidAmount(value);
    setBidTouched(true);
    if (onUpdateBoard) {
      onUpdateBoard && onUpdateBoard({ bidAmount: value });
    }
  };

  const handleEntryAmountChange = (value) => {
    if (entryMode === 'none') return;
    setEditableEntryAmount(value);
    if (onUpdateBoard) {
      onUpdateBoard && onUpdateBoard({ entryAmount: value });
    }
  };

  const handleEntryModeChange = (mode) => {
    const normalized = mode === 'sum'
      ? 'sum'
      : (mode === 'none' ? 'none' : 'ratio');
    if (normalized === entryModeResolved) return;
    if (normalized === 'none') {
      setEditableEntryAmount('');
    }
    if (onUpdateBoard) {
      const payload = { entryMode: normalized };
      if (normalized === 'none') payload.entryAmount = '';
      onUpdateBoard(payload);
    }
  };

  const getSharePercent = React.useCallback((groupIndex, slotIndex, candidate) => {
    const stored = groupShares[groupIndex]?.[slotIndex];
    if (stored !== undefined && stored !== null && stored !== '') {
      const parsedStored = toNumber(stored);
      if (parsedStored !== null) return parsedStored;
    }
    return 0;
  }, [groupShares]);

  const getCredibilityValue = React.useCallback((groupIndex, slotIndex) => {
    const stored = groupCredibility[groupIndex]?.[slotIndex];
    if (stored === undefined || stored === null || stored === '') return 0;
    const parsed = Number(stored);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [groupCredibility]);

  const getTechnicianValue = React.useCallback((groupIndex, slotIndex) => {
    const stored = groupTechnicianScores[groupIndex]?.[slotIndex];
    if (stored === undefined || stored === null || stored === '') return null;
    const parsed = Number(stored);
    return Number.isFinite(parsed) ? parsed : null;
  }, [groupTechnicianScores]);

  const getQualityScoreValue = React.useCallback((groupIndex, slotIndex, candidate) => {
    const stored = groupQualityScores[groupIndex]?.[slotIndex];
    const storedNumeric = parseNumeric(stored);
    if (storedNumeric != null) return storedNumeric;
    const qualityText = isLHOwner ? getQualityBadgeText(candidate) : null;
    const qualityNumeric = isLHOwner ? toNumber(qualityText) : null;
    return qualityNumeric != null ? qualityNumeric : lhQualityDefault;
  }, [groupQualityScores, isLHOwner, lhQualityDefault, parseNumeric]);

  const openRepresentativeSearch = React.useCallback((target = null) => {
    if (!String(industryLabel || '').trim()) {
      showHeaderAlert('공종을 먼저 선택해 주세요.');
      return;
    }
    searchTargetRef.current = target;
    setRepresentativeSearchOpen(true);
  }, [industryLabel, showHeaderAlert]);

  const closeRepresentativeSearch = React.useCallback(() => {
    setRepresentativeSearchOpen(false);
    searchTargetRef.current = null;
  }, []);

  React.useEffect(() => {
    if (!open) {
      setRepresentativeSearchOpen(false);
    }
  }, [open]);

  const placeEntryInSlot = React.useCallback((uid, groupIndex, slotIndex) => {
    if (groupIndex == null || slotIndex == null) return;
    setGroupAssignments((prev) => {
      const next = prev.map((group) => group.slice());
      next.forEach((group) => {
        for (let i = 0; i < group.length; i += 1) {
          if (group[i] === uid) group[i] = null;
        }
      });
      while (next.length <= groupIndex) {
        next.push(Array(safeGroupSize).fill(null));
      }
      const targetRow = next[groupIndex];
      while (targetRow.length < safeGroupSize) targetRow.push(null);
      targetRow[slotIndex] = uid;
      return next;
    });
    setGroupShares((prev) => {
      const next = prev.map((row) => row.slice());
      while (next.length <= groupIndex) next.push([]);
      while (next[groupIndex].length <= slotIndex) next[groupIndex].push('');
      next[groupIndex][slotIndex] = '';
      return next;
    });
    setGroupShareRawInputs((prev) => {
      const next = prev.map((row) => row.slice());
      while (next.length <= groupIndex) next.push([]);
      while (next[groupIndex].length <= slotIndex) next[groupIndex].push('');
      next[groupIndex][slotIndex] = '';
      return next;
    });
    setGroupTechnicianScores((prev) => {
      const next = prev.map((row) => row.slice());
      while (next.length <= groupIndex) next.push([]);
      while (next[groupIndex].length <= slotIndex) next[groupIndex].push('');
      if (next[groupIndex][slotIndex] == null) next[groupIndex][slotIndex] = '';
      return next;
    });
  }, [safeGroupSize]);

  // handleRepresentativePicked defined later after participant map is ready

  const closeWindow = React.useCallback(() => {
    if (inlineMode) return;
    const win = boardWindowRef.current;
    if (win && !win.closed) {
      if (win.__agreementBoardCleanup) {
        try { win.__agreementBoardCleanup(); } catch {}
        delete win.__agreementBoardCleanup;
      }
      win.close();
    }
    boardWindowRef.current = null;
    setPortalContainer(null);
  }, [inlineMode]);

  const ensureWindow = React.useCallback(() => {
    if (inlineMode) return;
    if (typeof window === 'undefined') return;
    if (boardWindowRef.current && boardWindowRef.current.closed) {
      boardWindowRef.current = null;
      setPortalContainer(null);
    }

    if (!boardWindowRef.current) {
      const width = Math.min(1480, Math.max(1080, window.innerWidth - 80));
      const height = Math.min(1040, Math.max(780, window.innerHeight - 72));
      const dualScreenLeft = window.screenLeft !== undefined ? window.screenLeft : window.screenX;
      const dualScreenTop = window.screenTop !== undefined ? window.screenTop : window.screenY;
      const left = Math.max(24, dualScreenLeft + Math.max(0, (window.innerWidth - width) / 2));
      const top = Math.max(32, dualScreenTop + Math.max(0, (window.innerHeight - height) / 3));
      const features = `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`;
      const child = window.open('', 'company-search-agreement-board', features);
      if (!child) return;
      child.document.title = title;
      child.document.body.style.margin = '0';
      child.document.body.style.background = '#f3f4f6';
      child.document.body.innerHTML = '';
      const root = child.document.createElement('div');
      root.id = 'agreement-board-root';
      child.document.body.appendChild(root);
      copyDocumentStyles(document, child.document);
      boardWindowRef.current = child;
      setPortalContainer(root);
      const handleBeforeUnload = () => {
        boardWindowRef.current = null;
        setPortalContainer(null);
        onClose?.();
      };
      child.addEventListener('beforeunload', handleBeforeUnload);
      child.__agreementBoardCleanup = () => child.removeEventListener('beforeunload', handleBeforeUnload);
    } else {
      const win = boardWindowRef.current;
      if (win.document && win.document.readyState === 'complete') {
        copyDocumentStyles(document, win.document);
      }
      if (!portalContainer && win.document) {
        const existingRoot = win.document.getElementById('agreement-board-root');
        if (existingRoot) setPortalContainer(existingRoot);
      }
      try { win.focus(); } catch {}
    }
  }, [inlineMode, onClose, portalContainer, title]);

  React.useEffect(() => {
    if (inlineMode) return undefined;
    if (open) {
      ensureWindow();
    } else {
      closeWindow();
    }
    return undefined;
  }, [inlineMode, open, ensureWindow, closeWindow]);

  React.useEffect(() => () => { closeWindow(); }, [closeWindow]);

  React.useEffect(() => {
    if (inlineMode) return;
    if (!open) return;
    const win = boardWindowRef.current;
    if (!win || win.closed || !win.document) return;
    win.document.title = title || '협정보드';
  }, [inlineMode, title, open]);

  const dutyRegionSet = React.useMemo(() => {
    const entries = Array.isArray(dutyRegions) ? dutyRegions : [];
    return new Set(entries.map((entry) => normalizeRegion(entry)).filter(Boolean));
  }, [dutyRegions]);

  const pinnedSet = React.useMemo(() => new Set(pinned || []), [pinned]);
  const excludedSet = React.useMemo(() => new Set(excluded || []), [excluded]);

  const representativeCandidatesRaw = React.useMemo(
    () => (candidates || []).filter((candidate) => candidate && !excludedSet.has(candidate.id)),
    [candidates, excludedSet],
  );

  const isDutyRegionCompany = React.useCallback((company) => {
    if (!company) return false;
    if (dutyRegionSet.size === 0) return false;
    const region = normalizeRegion(getRegionLabel(company));
    if (!region) return false;
    if (dutyRegionSet.has(region)) return true;
    for (const entry of dutyRegionSet.values()) {
      if (region.startsWith(entry) || entry.startsWith(region)) return true;
    }
    return false;
  }, [dutyRegionSet]);

  const isSingleBidEligible = React.useCallback((candidate) => {
    if (!candidate) return false;
    const entryValue = parseAmountValue(entryAmount) || 0;
    const sipyungAmount = getCandidateSipyungAmount(candidate);
    const entryOk = entryValue > 0
      ? (sipyungAmount != null && sipyungAmount >= entryValue)
      : true;

    const perfTarget = perfectPerformanceAmount || 0;
    const performanceAmount = getCandidatePerformanceAmount(candidate);
    const perfOk = perfTarget > 0
      ? (performanceAmount != null && performanceAmount >= perfTarget)
      : false;

    const managementScore = getCandidateManagementScore(candidate);
    const maxScore = Number.isFinite(managementMax) ? managementMax : MANAGEMENT_SCORE_MAX;
    const managementOk = managementScore != null && managementScore >= (maxScore - 0.01);

    const regionOk = dutyRegionSet.size === 0 ? true : isDutyRegionCompany(candidate);

    return entryOk && perfOk && managementOk && regionOk;
  }, [
    entryAmount,
    perfectPerformanceAmount,
    managementMax,
    dutyRegionSet,
    isDutyRegionCompany,
  ]);

  const representativeCandidates = React.useMemo(
    () => representativeCandidatesRaw.filter((candidate) => (
      candidate && !isDutyRegionCompany(candidate)
    )),
    [representativeCandidatesRaw, isDutyRegionCompany],
  );

  const regionCandidates = React.useMemo(
    () => representativeCandidatesRaw.filter((candidate) => (
      candidate && isDutyRegionCompany(candidate)
    )),
    [representativeCandidatesRaw, isDutyRegionCompany],
  );

  const regionCandidateKeys = React.useMemo(() => {
    const bizSet = new Set();
    const nameSet = new Set();
    regionCandidates.forEach((candidate) => {
      const bizNo = normalizeBizNo(getBizNo(candidate));
      if (bizNo) bizSet.add(bizNo);
      const nameKey = String(getCompanyName(candidate) || '').trim().toLowerCase();
      if (nameKey) nameSet.add(nameKey);
    });
    return { bizSet, nameSet };
  }, [regionCandidates]);

  const alwaysIncludeItems = React.useMemo(() => (
    Array.isArray(alwaysInclude)
      ? alwaysInclude.filter((item) => item && (item.bizNo || item.name)).map((item) => normalizeRuleEntry(item))
      : []
  ), [alwaysInclude]);

  const alwaysIncludeMap = React.useMemo(() => {
    const map = new Map();
    alwaysIncludeItems.forEach((entry) => {
      const bizKey = normalizeBizNo(entry.bizNo);
      const nameKey = String(entry.name || '').trim().toLowerCase();
      if (bizKey && !map.has(`biz:${bizKey}`)) map.set(`biz:${bizKey}`, entry);
      if (nameKey && !map.has(`name:${nameKey}`)) map.set(`name:${nameKey}`, entry);
    });
    return map;
  }, [alwaysIncludeItems]);

  const { representativeEntries, extraRegionCandidates } = React.useMemo(() => {
    const seen = new Map();
    const matchedRuleBiz = new Set();
    const repEntries = representativeCandidates.map((candidate, index) => {
      const bizNo = normalizeBizNo(getBizNo(candidate));
      const nameKey = String(getCompanyName(candidate) || '').trim().toLowerCase();
      const pinnedEntry = (bizNo && alwaysIncludeMap.get(`biz:${bizNo}`))
        || (nameKey && alwaysIncludeMap.get(`name:${nameKey}`))
        || null;
      const pinnedByRule = !!pinnedEntry;
      if (pinnedByRule && bizNo) matchedRuleBiz.add(bizNo);
      return {
        uid: buildEntryUid('rep', candidate, index, seen),
        candidate,
        type: 'representative',
        pinned: pinnedSet.has(candidate?.id) || pinnedByRule,
        ruleSnapshot: pinnedEntry?.snapshot || null,
      };
    });

    const regionExtras = [];

    let syntheticIndex = representativeCandidates.length;
    alwaysIncludeItems.forEach((item) => {
      const bizNo = normalizeBizNo(item.bizNo);
      const nameKey = String(item.name || '').trim().toLowerCase();
      const alreadyRepresented = (bizNo && (matchedRuleBiz.has(bizNo) || regionCandidateKeys.bizSet.has(bizNo)))
        || repEntries.some((entry) => {
          const entryBiz = normalizeBizNo(getBizNo(entry.candidate));
          const entryName = String(getCompanyName(entry.candidate) || '').trim().toLowerCase();
          if (bizNo && entryBiz === bizNo) return true;
          if (nameKey && entryName === nameKey) return true;
          return false;
        })
        || (nameKey && regionCandidateKeys.nameSet.has(nameKey));
      if (alreadyRepresented) return;

      const snapshot = item.snapshot && typeof item.snapshot === 'object' ? { ...item.snapshot } : null;
      let candidate;
      if (snapshot) {
        candidate = { ...snapshot };
        if (!candidate['검색된 회사'] && item.name) candidate['검색된 회사'] = item.name;
        if (!candidate['사업자번호'] && bizNo) candidate['사업자번호'] = bizNo;
      } else {
        candidate = {
          bizNo: item.bizNo || '',
          사업자번호: item.bizNo || '',
          name: item.name || item.bizNo || '대표사',
          업체명: item.name || item.bizNo || '대표사',
          '검색된 회사': item.name || item.bizNo || '대표사',
          대표지역: item.region || '',
          region: item.region || '',
          note: item.note || '',
        };
      }
      candidate.id = candidate.id || (bizNo ? `rules:${bizNo}` : undefined);
      candidate._synthetic = true;
      const canonicalSipyung = candidate._sipyung ?? extractAmountValue(
        candidate,
        ['_sipyung', 'sipyung', '시평', '시평액', '시평액(원)', '시평금액', '기초금액', '기초금액(원)'],
        [['시평', '심평', 'sipyung', '기초금액', '추정가격', '시평총액']]
      );
      if (canonicalSipyung !== null && canonicalSipyung !== undefined) candidate._sipyung = canonicalSipyung;
      const canonicalPerformance = candidate._performance5y ?? extractAmountValue(
        candidate,
        ['_performance5y', 'performance5y', '5년 실적', '5년실적', '5년 실적 합계', '최근5년실적', '최근5년실적합계', '5년실적금액', '최근5년시공실적'],
        [['5년실적', '최근5년', 'fiveyear', 'performance5', '시공실적']]
      );
      if (canonicalPerformance !== null && canonicalPerformance !== undefined) candidate._performance5y = canonicalPerformance;
      const canonicalScore = candidate._score ?? extractAmountValue(
        candidate,
        ['_score', 'score', 'totalScore', '총점', '평균점수', '적격점수', '종합점수', '평가점수'],
        [['총점', '평균점수', 'score', '점수', '적격점수', '종합점수', '평가점수']]
      );
      if (canonicalScore !== null && canonicalScore !== undefined) candidate._score = canonicalScore;
      const canonicalShare = candidate._share ?? extractAmountValue(
        candidate,
        ['_share', '_pct', 'candidateShare', 'share', '지분', '기본지분'],
        [['지분', 'share', '비율']]
      );
      if (canonicalShare !== null && canonicalShare !== undefined) candidate._share = canonicalShare;

      const candidateIsRegion = isDutyRegionCompany(candidate);

      const entryMeta = {
        candidate,
        pinned: true,
        synthetic: true,
        index: syntheticIndex,
      };

      if (candidateIsRegion) {
        regionExtras.push(entryMeta);
      } else {
        const entry = {
          uid: buildEntryUid('rep-rule', candidate, syntheticIndex, seen),
          candidate,
          type: 'representative',
          pinned: true,
          synthetic: true,
        };
        repEntries.push(entry);
      }

      syntheticIndex += 1;
    });

    return { representativeEntries: repEntries, extraRegionCandidates: regionExtras };
  }, [representativeCandidates, pinnedSet, alwaysIncludeItems, alwaysIncludeMap, isDutyRegionCompany, regionCandidateKeys]);

  const selectedRegionCandidates = React.useMemo(() => {
    const pinnedMatches = regionCandidates.filter((candidate) => pinnedSet.has(candidate?.id));
    if (pinnedMatches.length > 0) return pinnedMatches;
    const explicit = regionCandidates.filter((candidate) => isRegionExplicitlySelected(candidate));
    if (explicit.length > 0) return explicit;
    return regionCandidates;
  }, [regionCandidates, pinnedSet]);

  const regionEntries = React.useMemo(() => {
    const seen = new Map();
    const base = selectedRegionCandidates.map((candidate, index) => ({
      uid: buildEntryUid('region', candidate, index, seen),
      candidate,
      type: 'region',
      pinned: pinnedSet.has(candidate?.id),
    }));

    let syntheticIndex = selectedRegionCandidates.length;
    const extras = extraRegionCandidates.map((meta) => {
      const entry = meta || {};
      const candidate = entry.candidate;
      const uid = buildEntryUid('region-rule', candidate, syntheticIndex, seen);
      syntheticIndex += 1;
      return {
        uid,
        candidate,
        type: 'region',
        pinned: true,
        synthetic: true,
      };
    });

    return [...base, ...extras];
  }, [selectedRegionCandidates, extraRegionCandidates, pinnedSet]);

  const participantMap = React.useMemo(() => {
    const map = new Map();
    representativeEntries.forEach((entry) => {
      let mergedCandidate = entry.candidate;
      if (entry.ruleSnapshot) {
        mergedCandidate = { ...entry.ruleSnapshot, ...mergedCandidate };
      }
      if (mergedCandidate?.snapshot && typeof mergedCandidate.snapshot === 'object') {
        mergedCandidate = { ...mergedCandidate.snapshot, ...mergedCandidate };
      }
      map.set(entry.uid, { ...entry, candidate: mergedCandidate });
    });
    regionEntries.forEach((entry) => {
      let mergedCandidate = entry.candidate;
      if (mergedCandidate?.snapshot && typeof mergedCandidate.snapshot === 'object') {
        mergedCandidate = { ...mergedCandidate.snapshot, ...mergedCandidate };
      }
      map.set(entry.uid, { ...entry, candidate: mergedCandidate });
    });
    if (process.env.NODE_ENV !== 'production') {
      try {
        window.__agreementBoard = {
          participantMap: map,
        };
      } catch (err) {
        /* ignore */
      }
    }
    return map;
  }, [representativeEntries, regionEntries]);

  const technicianTargetOptions = React.useMemo(() => (
    groupAssignments.flatMap((row, groupIndex) => (
      slotLabels.map((label, slotIndex) => {
        const uid = row?.[slotIndex];
        const entry = uid ? participantMap.get(uid) : null;
        const name = entry?.candidate ? getCompanyName(entry.candidate) : '';
        const suffix = name ? ` - ${name}` : '';
        return {
          key: `${groupIndex}:${slotIndex}`,
          groupIndex,
          slotIndex,
          label: `${groupIndex + 1}번 ${label}${suffix}`,
        };
      })
    ))
  ), [groupAssignments, participantMap, slotLabels]);

  React.useEffect(() => {
    if (!technicianTargetOptions.length) return;
    const exists = technicianTargetOptions.some(
      (option) => option.groupIndex === technicianTarget.groupIndex && option.slotIndex === technicianTarget.slotIndex,
    );
    if (!exists) {
      const first = technicianTargetOptions[0];
      setTechnicianTarget({ groupIndex: first.groupIndex, slotIndex: first.slotIndex });
    }
  }, [technicianTargetOptions, technicianTarget.groupIndex, technicianTarget.slotIndex]);

  const applyTechnicianScoreToTarget = React.useCallback(() => {
    if (!technicianEditable) return;
    if (!technicianTargetOptions.length) return;
    const resolved = roundTo(technicianScoreTotal, 2);
    if (resolved == null) return;
    setGroupTechnicianScores((prev) => {
      const next = prev.map((row) => row.slice());
      const { groupIndex, slotIndex } = technicianTarget;
      while (next.length <= groupIndex) next.push([]);
      while (next[groupIndex].length <= slotIndex) next[groupIndex].push('');
      next[groupIndex][slotIndex] = String(resolved);
      return next;
    });
  }, [technicianEditable, technicianScoreTotal, technicianTarget, technicianTargetOptions.length]);

  const attemptPendingPlacement = React.useCallback(() => {
    const pending = pendingPlacementRef.current;
    if (!pending) return false;
    const {
      candidateId,
      groupIndex,
      slotIndex,
      matchBizNo,
      matchNameKey,
    } = pending;
    let targetUid = null;
    for (const [uid, entry] of participantMap.entries()) {
      if (candidateId && entry?.candidate?.id === candidateId) {
        targetUid = uid;
        break;
      }
      if (!entry?.candidate) continue;
      if (!targetUid && matchBizNo) {
        const candidateBiz = normalizeBizNo(getBizNo(entry.candidate));
        if (candidateBiz && candidateBiz === matchBizNo) {
          targetUid = uid;
          break;
        }
      }
      if (!targetUid && matchNameKey) {
        const candidateNameKey = sanitizeCompanyName(getCompanyName(entry.candidate) || '').toLowerCase();
        if (candidateNameKey && candidateNameKey === matchNameKey) {
          targetUid = uid;
          break;
        }
      }
    }
    if (!targetUid) return false;
    placeEntryInSlot(targetUid, groupIndex, slotIndex);
    pendingPlacementRef.current = null;
    return true;
  }, [participantMap, placeEntryInSlot]);

  const handleRepresentativePicked = React.useCallback((picked) => {
    if (!picked) return;
    const target = searchTargetRef.current;
    if (target) {
      const hints = derivePendingPlacementHint(picked);
      pendingPlacementRef.current = {
        candidateId: hints.candidateId,
        matchBizNo: hints.matchBizNo,
        matchNameKey: hints.matchNameKey,
        groupIndex: target.groupIndex,
        slotIndex: target.slotIndex,
      };
    }
    const placed = attemptPendingPlacement();
    if (!placed) {
      onAddRepresentatives?.([picked]);
    }
    closeRepresentativeSearch();
  }, [onAddRepresentatives, closeRepresentativeSearch, derivePendingPlacementHint, attemptPendingPlacement]);

  const buildInitialAssignments = React.useCallback(() => {
    const baseCount = representativeEntries.length > 0
      ? Math.ceil(representativeEntries.length / safeGroupSize)
      : 1;
    const groupCount = Math.max(MIN_GROUPS, baseCount);
    const result = [];
    for (let g = 0; g < groupCount; g += 1) {
      result.push(Array(safeGroupSize).fill(null));
    }
    return result;
  }, [representativeEntries.length, safeGroupSize]);

  React.useEffect(() => {
    if (open) {
      candidateScoreCacheRef.current.clear();
    }
  }, [open]);

  const participantSignature = React.useMemo(() => {
    const repIds = representativeEntries.map((entry) => entry?.candidate?.id || entry?.uid || 'rep');
    const regionIds = regionEntries.map((entry) => entry?.candidate?.id || entry?.uid || 'region');
    return [...repIds, '|', ...regionIds].join('|');
  }, [representativeEntries, regionEntries]);

  React.useEffect(() => {
    candidateScoreCacheRef.current.clear();
    setCandidateMetricsVersion((prev) => prev + 1);
  }, [participantSignature]);

  React.useEffect(() => {
    if (!open) return;
    const validIds = new Set([
      ...representativeEntries.map((entry) => entry.uid),
      ...regionEntries.map((entry) => entry.uid),
    ]);
    setGroupAssignments((prev) => {
      if (!prev || prev.length === 0) {
        return buildInitialAssignments();
      }
      const groupCount = Math.max(
        MIN_GROUPS,
        Math.ceil(representativeEntries.length / safeGroupSize),
        prev.length,
      );
      const trimmed = prev.slice(0, groupCount).map((group) => {
        const nextGroup = Array.isArray(group) ? group.slice(0, safeGroupSize) : [];
        while (nextGroup.length < safeGroupSize) {
          nextGroup.push(null);
        }
        return nextGroup;
      });
      while (trimmed.length < groupCount) {
        trimmed.push(Array(safeGroupSize).fill(null));
      }
      const cleaned = trimmed.map((group) => group.map((id) => (id && validIds.has(id) ? id : null)));
      const used = new Set();
      cleaned.forEach((group) => group.forEach((id) => { if (id) used.add(id); }));
      return cleaned;
    });
  }, [open, representativeEntries, regionEntries, safeGroupSize, buildInitialAssignments]);

  const assignedIds = React.useMemo(() => {
    const set = new Set();
    groupAssignments.forEach((group) => group.forEach((id) => { if (id) set.add(id); }));
    return set;
  }, [groupAssignments]);

  const summaryByGroup = React.useMemo(() => {
    const map = new Map();
    groupSummaries.forEach((entry) => {
      map.set(entry.groupIndex, entry);
    });
    return map;
  }, [groupSummaries]);

  const summary = React.useMemo(() => ({
    performanceTotal: representativeEntries.length,
    regionTotal: regionEntries.length,
    groups: groupAssignments.length,
  }), [representativeEntries.length, regionEntries.length, groupAssignments.length]);

  React.useEffect(() => {
    setGroupApprovals((prev) => (
      groupAssignments.map((_, index) => (prev[index] ?? ''))
    ));
  }, [groupAssignments]);

  React.useEffect(() => {
    setGroupManagementBonus((prev) => (
      groupAssignments.map((_, index) => Boolean(prev[index]))
    ));
  }, [groupAssignments]);

  const dutySummaryText = React.useMemo(() => {
    const rateNumber = parseNumeric(regionDutyRate);
    return buildDutySummary(dutyRegions, rateNumber, safeParticipantLimit);
  }, [regionDutyRate, dutyRegions, safeGroupSize]);

  const rangeBadgeLabel = selectedRangeOption?.label || '기본 구간';

  const bidDeadlineLabel = React.useMemo(() => formatBidDeadline(bidDeadline), [bidDeadline]);

  const handleExportExcel = React.useCallback(async (options = {}) => {
    if (exporting) return;
    const api = typeof window !== 'undefined' ? window.electronAPI : null;
    if (!api?.agreementsExportExcel) {
      showHeaderAlert('엑셀 내보내기 채널이 준비되지 않았습니다. 데스크탑 앱에서만 실행 가능합니다.');
      return;
    }
    const templateKey = resolveTemplateKey(ownerId, rangeId, fileType);
    if (!templateKey) {
      showHeaderAlert('현재 선택한 발주처/구간은 엑셀 템플릿이 아직 준비되지 않았습니다.');
      return;
    }

    setExporting(true);
    showLoading({ title: '엑셀 내보내기', message: '엑셀 시트를 생성하는 중입니다...' });
    try {
      const estimatedValue = parseAmountValue(estimatedAmount);
      const baseValue = parseAmountValue(baseAmount);
      const ratioBaseValue = parseAmountValue(ratioBaseAmount);
      const entryAmountValue = parseAmountValue(entryAmount);
      const bidAmountValue = parseAmountValue(bidAmount);
      const amountForScore = (estimatedValue != null && estimatedValue > 0)
        ? estimatedValue
        : (baseValue != null && baseValue > 0 ? baseValue : null);
      const amountForScoreResolved = ownerKeyUpper === 'KRAIL'
        ? (baseValue != null && baseValue > 0 ? baseValue : null)
        : amountForScore;
      const possibleShareBase = ownerKeyUpper === 'LH'
        ? ratioBaseValue
        : (bidAmountValue != null ? bidAmountValue : null);
      const includePossibleShare = (ownerKeyUpper === 'PPS' && rangeId === PPS_UNDER_50_KEY)
        || (ownerKeyUpper === 'LH' && rangeId === LH_UNDER_50_KEY)
        || (ownerKeyUpper === 'MOIS' && rangeId === MOIS_30_TO_50_KEY);
      const dutyRateNumber = parseNumeric(regionDutyRate);
      const dutySummaryText = buildDutySummary(dutyRegions, dutyRateNumber, safeParticipantLimit);
      const formattedDeadline = formatBidDeadline(bidDeadline);

      let exportIndex = 1;
      const groupPayloads = groupAssignments.flatMap((memberIds, groupIndex) => {
        const hasMembers = Array.isArray(memberIds) && memberIds.some((uid) => Boolean(uid));
        if (!hasMembers) return [];
        const summaryEntry = summaryByGroup.get(groupIndex) || null;
        const approvalValue = String(groupApprovals[groupIndex] || '').trim();
        const members = memberIds.map((uid, slotIndex) => {
          if (!uid) {
            return {
              slotIndex,
              role: slotIndex === 0 ? 'representative' : 'member',
              empty: true,
            };
          }
          const entry = participantMap.get(uid);
          if (!entry || !entry.candidate) {
            return {
              slotIndex,
              role: slotIndex === 0 ? 'representative' : 'member',
              empty: true,
            };
          }
          const candidate = entry.candidate;
          const storedShare = groupShares[groupIndex]?.[slotIndex];
          const shareSource = (storedShare !== undefined && storedShare !== null && storedShare !== '')
            ? storedShare
            : getSharePercent(groupIndex, slotIndex, candidate);
          const sharePercent = parseNumeric(shareSource);
          const managementScore = getCandidateManagementScore(candidate);
          const performanceAmount = getCandidatePerformanceAmount(candidate);
          const technicianValue = technicianEnabled
            ? getTechnicianValue(groupIndex, slotIndex)
            : null;
          const sipyungValue = candidate._sipyung ?? extractAmountValue(
            candidate,
            ['_sipyung', 'sipyung', '시평', '시평액', '시평액(원)', '시평금액', '기초금액', '기초금액(원)'],
            [['시평', '심평', 'sipyung', '기초금액', '추정가격', '시평총액']]
          );
          const sipyung = parseNumeric(sipyungValue);
          const credibilitySource = credibilityEnabled ? groupCredibility[groupIndex]?.[slotIndex] : null;
          const credibilityBonus = credibilityEnabled ? parseNumeric(credibilitySource) : null;
          const isRegionMember = entry.type === 'region' || isDutyRegionCompany(candidate);
          const companyName = sanitizeCompanyName(getCompanyName(candidate));
          const managerName = getCandidateManagerName(candidate);
          const possibleShareRatio = (includePossibleShare && possibleShareBase && sipyung && sipyung > 0)
            ? (sipyung / possibleShareBase) * 100
            : null;
          const shareLabel = (includePossibleShare && possibleShareRatio != null && possibleShareRatio < 100)
            ? formatShareForName(possibleShareRatio)
            : '';
          const nameLine = shareLabel ? `${companyName} ${shareLabel}` : companyName;
          const qualityScore = isLHOwner
            ? getQualityScoreValue(groupIndex, slotIndex, candidate)
            : null;
          const displayName = managerName ? `${nameLine}\n${managerName}` : nameLine;
          return {
            slotIndex,
            role: slotIndex === 0 ? 'representative' : 'member',
            type: entry.type,
            isRegion: Boolean(isRegionMember),
            name: displayName,
            manager: managerName,
            region: getRegionLabel(candidate),
            bizNo: normalizeBizNo(getBizNo(candidate)),
            sharePercent,
            managementScore: managementScore != null ? Number(managementScore) : null,
            performanceAmount: performanceAmount != null ? Number(performanceAmount) : null,
            technicianScore: technicianValue != null ? Number(technicianValue) : null,
            sipyung,
            credibilityBonus: credibilityBonus != null ? Number(credibilityBonus) : null,
            qualityScore: qualityScore != null ? Number(qualityScore) : null,
          };
        });
        let qualityPoints = null;
        if (isLHOwner) {
          let qualityTotal = 0;
          let hasQuality = false;
          members.forEach((member) => {
            const shareValue = Number(member.sharePercent);
            const scoreValue = Number(member.qualityScore);
            if (!Number.isFinite(shareValue) || !Number.isFinite(scoreValue)) return;
            if (shareValue <= 0) return;
            qualityTotal += scoreValue * (shareValue / 100);
            hasQuality = true;
          });
          if (hasQuality) {
            qualityPoints = resolveQualityPoints(qualityTotal, selectedRangeOption?.key);
          }
        }
        const payload = {
          index: exportIndex,
          approval: approvalValue,
          members,
          summary: summaryEntry ? {
            shareSum: summaryEntry.shareSum ?? null,
            shareComplete: Boolean(summaryEntry.shareComplete),
            shareReady: Boolean(summaryEntry.shareReady),
            managementScore: summaryEntry.managementScore ?? null,
            performanceScore: summaryEntry.performanceScore ?? null,
            performanceAmount: summaryEntry.performanceAmount ?? null,
            performanceBase: summaryEntry.performanceBase ?? null,
            credibilityScore: summaryEntry.credibilityScore ?? null,
            credibilityMax: summaryEntry.credibilityMax ?? null,
            totalScoreBase: summaryEntry.totalScoreBase ?? null,
            totalScoreWithCred: summaryEntry.totalScoreWithCred ?? null,
            totalScore: summaryEntry.totalScoreWithCred ?? null,
            bidScore: summaryEntry.bidScore ?? null,
            managementMax: summaryEntry.managementMax ?? null,
            performanceMax: summaryEntry.performanceMax ?? null,
            totalMaxBase: summaryEntry.totalMaxBase ?? null,
            totalMaxWithCred: summaryEntry.totalMaxWithCred ?? null,
            totalMax: summaryEntry.totalMaxBase ?? null,
            netCostBonusScore: summaryEntry.netCostBonusScore ?? null,
            subcontractScore: summaryEntry.subcontractScore ?? null,
            qualityPoints,
            managementBonusApplied: Boolean(groupManagementBonus[groupIndex]),
          } : null,
        };
        exportIndex += 1;
        return payload;
      });

      const payload = {
        templateKey,
        appendTargetPath: options.appendTargetPath || '',
        sheetName: options.sheetName || '',
        context: {
          ownerId,
          rangeId,
        },
        header: {
          noticeNo: noticeNo || '',
          noticeTitle: noticeTitle || '',
          industryLabel: industryLabel || '',
          baseAmount: baseValue ?? null,
          estimatedAmount: estimatedValue ?? null,
          bidAmount: bidAmountValue ?? null,
          ratioBaseAmount: ratioBaseValue ?? null,
          entryAmount: entryAmountValue ?? null,
          amountForScore: amountForScoreResolved,
          bidDeadline: formattedDeadline,
          rawBidDeadline: bidDeadline || '',
          dutyRegions: Array.isArray(dutyRegions) ? dutyRegions : [],
          dutyRegionRate: dutyRateNumber,
          dutySummary: dutySummaryText,
          teamSize: safeGroupSize,
          summary,
          memoHtml,
        },
        groups: groupPayloads,
      };

      const response = await api.agreementsExportExcel(payload);
      if (response?.success) {
        showHeaderAlert('엑셀 파일을 저장했습니다.');
        return true;
      }
      showHeaderAlert(response?.message || '엑셀 내보내기에 실패했습니다.');
      return false;
    } catch (error) {
      console.error('[AgreementBoard] Excel export failed:', error);
      showHeaderAlert('엑셀 내보내기 중 오류가 발생했습니다.');
      return false;
    } finally {
      setExporting(false);
      hideLoading();
    }
  }, [
    exporting,
    showLoading,
    hideLoading,
    ownerId,
    ownerKeyUpper,
    rangeId,
    fileType,
    baseAmount,
    estimatedAmount,
    ratioBaseAmount,
    entryAmount,
    bidAmount,
    bidDeadline,
    regionDutyRate,
    noticeNo,
    noticeTitle,
    industryLabel,
    dutyRegions,
    groupAssignments,
    groupShares,
    getSharePercent,
    getTechnicianValue,
    groupApprovals,
    participantMap,
    summaryByGroup,
    summary,
    safeGroupSize,
    isLHOwner,
    technicianEnabled,
    resolveQualityPoints,
    selectedRangeOption?.key,
    groupManagementBonus,
  ]);

  const handleGenerateText = React.useCallback(async () => {
    const soloExclusionSet = new Set([
      '아람이엔테크㈜',
      '㈜우진일렉트',
      '에코엠이엔씨㈜',
      '㈜지음쏠라테크',
    ]);
    const items = groupAssignments
      .map((memberIds, groupIndex) => {
        const members = memberIds.map((uid) => (uid ? participantMap.get(uid) : null)).filter(Boolean);
        if (members.length === 0) return null;

        const leaderEntry = members[0];
        const memberEntries = members.slice(1);
        const leaderName = String(getCompanyName(leaderEntry.candidate) || '').trim();
        if (members.length === 1 && soloExclusionSet.has(leaderName)) {
          return null;
        }
        const approvalValue = String(groupApprovals[groupIndex] || '').trim();
        if (approvalValue === '알림' || approvalValue === '취소') {
          return null;
        }

        return {
          owner: ownerId,
          noticeNo,
          title: noticeTitle,
          approval: approvalValue,
          leader: {
            name: getCompanyName(leaderEntry.candidate),
            bizNo: normalizeBizNo(getBizNo(leaderEntry.candidate)),
            share: groupShares[groupIndex]?.[0] || '0',
          },
          members: memberEntries.map((entry, memberIndex) => ({
            name: getCompanyName(entry.candidate),
            bizNo: normalizeBizNo(getBizNo(entry.candidate)),
            share: groupShares[groupIndex]?.[memberIndex + 1] || '0',
          })),
        };
      })
      .filter(Boolean);

    if (items.length === 0) {
      showHeaderAlert('문자를 생성할 협정 정보가 없습니다. 업체를 배치하고 지분율을 입력해주세요.');
      return;
    }

    try {
      const text = generateMany(items);
      const result = await window.electronAPI.clipboardWriteText(text);
      if (result.success) {
        showHeaderAlert('협정 문자 내용이 클립보드에 복사되었습니다.');
      } else {
        throw new Error(result.message || 'Clipboard write failed');
      }
    } catch (err) {
      console.error('Failed to copy text: ', err);
      showHeaderAlert('클립보드 복사에 실패했습니다.');
    }
  }, [groupAssignments, participantMap, groupShares, groupApprovals, ownerId, noticeNo, noticeTitle]);

  React.useEffect(() => {
    if (skipAssignmentSyncRef.current) {
      skipAssignmentSyncRef.current = false;
      prevAssignmentsRef.current = groupAssignments;
      return;
    }
    const prevAssignments = prevAssignmentsRef.current || [];
    setGroupShares((prevShares) => {
      const shareMap = new Map();
      prevAssignments.forEach((group, gIdx) => {
        group.forEach((id, idx) => {
          if (id) {
            const value = prevShares[gIdx]?.[idx] ?? '';
            shareMap.set(id, value);
          }
        });
      });
      return groupAssignments.map((group) => (
        group.map((id) => (id ? (shareMap.get(id) ?? '') : ''))
      ));
    });
    setGroupShareRawInputs((prevRaw) => {
      const rawMap = new Map();
      prevAssignments.forEach((group, gIdx) => {
        group.forEach((id, idx) => {
          if (id) {
            const value = prevRaw[gIdx]?.[idx] ?? '';
            rawMap.set(id, value);
          }
        });
      });
      return groupAssignments.map((group) => (
        group.map((id) => (id ? (rawMap.get(id) ?? '') : ''))
      ));
    });
    setGroupCredibility((prevCred) => {
      const credMap = new Map();
      prevAssignments.forEach((group, gIdx) => {
        group.forEach((id, idx) => {
          if (id) {
            const value = prevCred[gIdx]?.[idx] ?? '';
            credMap.set(id, value);
          }
        });
      });
      return groupAssignments.map((group) => (
        group.map((id) => (id ? (credMap.get(id) ?? '') : ''))
      ));
    });
    setGroupTechnicianScores((prevTech) => {
      const techMap = new Map();
      prevAssignments.forEach((group, gIdx) => {
        group.forEach((id, idx) => {
          if (id) {
            const value = prevTech[gIdx]?.[idx] ?? '';
            techMap.set(id, value);
          }
        });
      });
      return groupAssignments.map((group) => (
        group.map((id) => (id ? (techMap.get(id) ?? '') : ''))
      ));
    });
    prevAssignmentsRef.current = groupAssignments;
  }, [groupAssignments]);

  React.useEffect(() => {
    if (!open) {
      setGroupSummaries([]);
      return;
    }

    const baseValue = parseAmountValue(baseAmount);
    const estimatedValue = parseAmountValue(estimatedAmount);
    const perfBase = ownerKeyUpper === 'EX'
      ? (baseValue != null && baseValue > 0 ? baseValue : (estimatedValue != null && estimatedValue > 0 ? estimatedValue : null))
      : ((estimatedValue != null && estimatedValue > 0)
        ? estimatedValue
        : (baseValue != null && baseValue > 0 ? baseValue : null));
    const rangeAmountHint = parseRangeAmountHint(ownerKeyUpper, selectedRangeOption?.label);
    const evaluationAmount = rangeAmountHint > 0 ? rangeAmountHint : 0;
    const ownerKey = String(ownerId || 'lh').toLowerCase();
    const performanceBaseReady = perfBase != null && perfBase > 0;

    const entryLimitValue = parseAmountValue(entryAmount);
    const entryModeForCalc = entryModeResolved;
    const performanceFallback = ownerPerformanceFallback;
    const derivedManagementMax = managementMax;
    const derivedPerformanceMax = derivedMaxScores.performanceMax ?? performanceFallback;

    const metrics = groupAssignments.map((memberIds, groupIndex) => {
      const members = memberIds.map((uid, slotIndex) => {
        if (!uid) return null;
        const entry = participantMap.get(uid);
        if (!entry || !entry.candidate) return null;
        const candidate = entry.candidate;
        const sharePercent = getSharePercent(groupIndex, slotIndex, candidate);
        const managementScore = getCandidateManagementScore(candidate);
        const performanceAmount = getCandidatePerformanceAmount(candidate);
        const technicianScore = technicianEditable ? getTechnicianValue(groupIndex, slotIndex) : null;
        const credibilityBonus = credibilityEnabled ? getCredibilityValue(groupIndex, slotIndex) : 0;
        const sipyungAmount = getCandidateSipyungAmount(candidate);
        return {
          sharePercent,
          managementScore,
          performanceAmount,
          technicianScore,
          credibility: credibilityBonus,
          sipyungAmount,
        };
      }).filter(Boolean);

      const shareSum = members.reduce((sum, member) => {
        const shareValue = Number(member.sharePercent);
        return Number.isFinite(shareValue) ? sum + shareValue : sum;
      }, 0);
      const missingShares = members.some((member) => member.sharePercent == null || Number.isNaN(Number(member.sharePercent)));
      const shareValid = shareSum > 0 && !missingShares;
      const shareComplete = shareValid && Math.abs(shareSum - 100) < 0.01;
      const normalizedMembers = members.map((member) => {
        const rawShare = Number(member.sharePercent);
        const safeShare = Number.isFinite(rawShare) ? Math.max(rawShare, 0) : 0;
        return {
          ...member,
          weight: safeShare / 100,
          credibility: Number.isFinite(member.credibility) ? Math.max(member.credibility, 0) : 0,
        };
      });

      const managementMissing = normalizedMembers.some((member) => member.managementScore == null);
      const performanceMissing = normalizedMembers.some((member) => member.performanceAmount == null);
      const technicianProvided = technicianEditable
        ? normalizedMembers.some((member) => member.technicianScore != null)
        : false;
      const technicianMissing = technicianEditable ? !technicianProvided : false;
      const sipyungMissing = normalizedMembers.some((member) => member.sipyungAmount == null);
      let aggregatedCredibility = credibilityEnabled
        ? (shareValid
          ? normalizedMembers.reduce((acc, member) => acc + (member.credibility || 0) * member.weight, 0)
          : null)
        : null;
      if (aggregatedCredibility != null && isKrailOwner) {
        aggregatedCredibility *= krailCredibilityScale;
      }

      const aggregatedManagement = (!managementMissing && shareValid)
        ? normalizedMembers.reduce((acc, member) => acc + (member.managementScore || 0) * member.weight, 0)
        : null;

      const aggregatedPerformanceAmount = (!performanceMissing && shareValid)
        ? normalizedMembers.reduce((acc, member) => acc + (member.performanceAmount || 0) * member.weight, 0)
        : null;
      const aggregatedTechnicianScore = (technicianEditable && technicianProvided && shareValid)
        ? normalizedMembers.reduce((acc, member) => acc + (member.technicianScore || 0) * member.weight, 0)
        : null;

      let sipyungSum = null;
      if (!sipyungMissing && normalizedMembers.length > 0) {
        sipyungSum = normalizedMembers.reduce((acc, member) => {
          const value = Number(member.sipyungAmount);
          return Number.isFinite(value) ? acc + value : acc;
        }, 0);
      }

      let sipyungWeighted = null;
      if (!sipyungMissing && shareValid && normalizedMembers.length > 0) {
        sipyungWeighted = normalizedMembers.reduce((acc, member) => {
          const value = Number(member.sipyungAmount);
          const weight = Number(member.weight);
          if (!Number.isFinite(value) || !Number.isFinite(weight)) return acc;
          return acc + (value * weight);
        }, 0);
      }

      let qualificationValue = null;
      let qualificationReady = false;
      if (entryModeForCalc === 'sum') {
        qualificationValue = sipyungSum;
        qualificationReady = sipyungSum != null;
      } else if (entryModeForCalc === 'ratio') {
        qualificationValue = sipyungWeighted;
        qualificationReady = sipyungWeighted != null;
      }
      const qualificationLimit = entryModeForCalc !== 'none' && entryLimitValue != null ? entryLimitValue : null;
      const qualificationSatisfied = (entryModeForCalc !== 'none'
        && qualificationLimit != null && qualificationLimit >= 0 && qualificationValue != null)
        ? qualificationValue >= (qualificationLimit - 1e-6)
        : null;

      return {
        groupIndex,
        memberCount: members.length,
        shareSum,
        shareValid,
        shareComplete,
        missingShares,
        managementScore: aggregatedManagement,
        managementMissing,
        performanceAmount: aggregatedPerformanceAmount,
        performanceMissing,
        technicianScore: aggregatedTechnicianScore,
        technicianMissing,
        credibilityScore: aggregatedCredibility,
        sipyungSum,
        sipyungWeighted,
        sipyungMissing,
        entryModeResolved: entryModeForCalc,
        qualificationLimit,
        qualificationValue,
        qualificationReady,
        qualificationSatisfied,
      };
    });

    let canceled = false;

    const evaluatePerformanceScore = async (perfAmount) => {
      if (!performanceBaseReady || perfAmount == null) return null;
      const payload = {
        agencyId: ownerKey,
        fileType,
        amount: evaluationAmount != null ? evaluationAmount : (perfBase != null ? perfBase : 0),
        inputs: {
          perf5y: perfAmount,
          baseAmount: perfBase,
          estimatedAmount: estimatedValue,
          fileType,
        },
      };
      if (typeof window !== 'undefined' && window.electronAPI?.formulasEvaluate) {
        try {
          const response = await window.electronAPI.formulasEvaluate(payload);
          if (response?.success && response.data?.performance) {
            const perfData = response.data.performance;
            const perfMax = updatePerformanceCap(perfData.maxScore);
            const { score, capped, raw } = perfData;
            const numericCandidates = [score, capped, raw]
              .map((value) => toNumber(value))
              .filter((value) => value !== null);
            if (numericCandidates.length > 0) {
              const resolved = clampScore(Math.max(...numericCandidates), perfMax);
              if (resolved != null) return resolved;
            }
          }
        } catch (err) {
          console.warn('[AgreementBoard] performance evaluate failed:', err?.message || err);
        }
      }

      if (!performanceBaseReady || perfBase <= 0) return null;
      const ratio = perfAmount / perfBase;
      if (!Number.isFinite(ratio)) return null;
      const cap = getPerformanceCap();
      const fallback = Math.max(1, ratio * cap);
      return clampScore(fallback, cap);
    };

    const run = async () => {
      const results = await Promise.all(metrics.map(async (metric) => {
        const shareReady = metric.memberCount > 0 && metric.shareValid;
        const managementScoreBase = shareReady && !metric.managementMissing
          ? clampScore(metric.managementScore, MANAGEMENT_SCORE_MAX)
          : null;
        const bonusEnabled = Boolean(groupManagementBonus[metric.groupIndex]);
        const managementWithBonus = (managementScoreBase != null && bonusEnabled)
          ? clampScore(managementScoreBase * 1.1, MANAGEMENT_SCORE_MAX)
          : managementScoreBase;
        let managementScore = managementWithBonus != null
          ? clampScore(managementWithBonus * managementScale, managementMax)
          : managementWithBonus;
        managementScore = roundForMoisManagement(managementScore);
        managementScore = roundForLhTotals(roundUpForPpsUnder50(roundForKrailUnder50(managementScore)));
        managementScore = roundForExManagement(managementScore);

        let performanceScore = null;
        let performanceRatio = null;
        let technicianScore = null;
        let technicianAbilityScore = null;

        if (shareReady && !metric.performanceMissing && metric.performanceAmount != null && performanceBaseReady) {
          performanceScore = await evaluatePerformanceScore(metric.performanceAmount);
          if (perfBase && perfBase > 0) {
            performanceRatio = metric.performanceAmount / perfBase;
          }
        }
        performanceScore = roundForLhTotals(roundUpForPpsUnder50(roundForKrailUnder50(performanceScore)));
        performanceScore = roundForPerformanceTotals(performanceScore);
        performanceRatio = roundForKrailUnder50(performanceRatio);

        if (shareReady && !metric.technicianMissing && metric.technicianScore != null) {
          technicianScore = roundForKrailUnder50(metric.technicianScore);
          technicianAbilityScore = resolveKrailTechnicianAbilityScore(technicianScore);
        }

        const perfCapCurrent = getPerformanceCap();
        const performanceMax = perfCapCurrent || derivedPerformanceMax;
        let credibilityScore = null;
        if (credibilityEnabled && shareReady) {
          if (metric.credibilityScore != null) {
            const rawCredibility = Number(metric.credibilityScore);
            if (Number.isFinite(rawCredibility)) {
              credibilityScore = Number.isFinite(ownerCredibilityMax)
                ? clampScore(rawCredibility, ownerCredibilityMax)
                : rawCredibility;
            }
          } else {
            credibilityScore = 0;
          }
        }
        credibilityScore = roundForLhTotals(roundUpForPpsUnder50(roundForKrailUnder50(credibilityScore)));
        const credibilityMax = (credibilityEnabled && Number.isFinite(ownerCredibilityMax)) ? ownerCredibilityMax : null;
        const hasMembers = metric.memberCount > 0;
        const subcontractScore = hasMembers
          ? (isMois30To50 ? SUBCONTRACT_SCORE : (isEx50To100 ? EX_50_TO_100_SUBCONTRACT_SCORE : null))
          : null;
        const bidScoreValue = hasMembers
          ? (isEx50To100 ? EX_50_TO_100_BID_SCORE : BID_SCORE_DEFAULT)
          : null;
        const technicianScoreForTotal = (technicianEnabled && technicianAbilityScore != null)
          ? technicianAbilityScore
          : null;
        const technicianRequired = technicianEnabled && technicianEditable;
        const technicianReady = !technicianRequired || technicianScoreForTotal != null;
        let totalScoreBase = (managementScore != null && performanceScore != null && technicianReady)
          ? managementScore + performanceScore + (technicianScoreForTotal || 0) + (bidScoreValue || 0) + netCostBonusScore + (subcontractScore || 0)
          : null;
        let totalScoreWithCred = (totalScoreBase != null)
          ? totalScoreBase + (credibilityScore != null ? credibilityScore : 0)
          : null;
        totalScoreBase = roundUpForPpsUnder50(roundForKrailUnder50(totalScoreBase));
        totalScoreWithCred = roundUpForPpsUnder50(roundForKrailUnder50(totalScoreWithCred));
        const totalMaxBase = managementMax + performanceMax + (isEx50To100 ? EX_50_TO_100_BID_SCORE : BID_SCORE_DEFAULT) + netCostBonusScore
          + (isMois30To50 ? SUBCONTRACT_SCORE : (isEx50To100 ? EX_50_TO_100_SUBCONTRACT_SCORE : 0))
          + (technicianRequired && technicianAbilityMax ? technicianAbilityMax : 0);
        const totalMaxWithCred = credibilityEnabled ? totalMaxBase + (credibilityMax || 0) : totalMaxBase;

      return {
        ...metric,
        shareReady,
        shareComplete: metric.shareComplete,
        managementScore,
        managementMissing: metric.managementMissing,
        performanceScore,
        performanceMissing: metric.performanceMissing,
        performanceRatio,
        performanceBase: perfBase,
        performanceBaseReady,
        technicianMissing: metric.technicianMissing,
        credibilityScore,
        credibilityMax,
        technicianScore,
        technicianAbilityScore,
        technicianAbilityMax,
        totalScoreBase,
        totalScoreWithCred,
        totalMaxBase,
        totalMaxWithCred,
        totalScore: totalScoreWithCred,
        bidScore: bidScoreValue,
        netCostBonusScore,
        subcontractScore,
        managementMax,
        performanceMax,
        totalMax: totalMaxBase,
        entryMode: metric.entryModeResolved,
        entryLimit: metric.qualificationLimit,
        entryValue: metric.qualificationValue,
        entryReady: metric.qualificationReady,
        entrySatisfied: metric.qualificationSatisfied,
        sipyungSum: metric.sipyungSum,
        sipyungWeighted: metric.sipyungWeighted,
        sipyungMissing: metric.sipyungMissing,
      };
      }));
      if (!canceled) setGroupSummaries(results);
    };

    run();

    return () => {
      canceled = true;
    };
  }, [open, groupAssignments, groupShares, groupCredibility, groupTechnicianScores, participantMap, ownerId, ownerKeyUpper, selectedRangeOption?.label, estimatedAmount, baseAmount, entryAmount, entryMode, getSharePercent, getCredibilityValue, getTechnicianValue, credibilityEnabled, ownerCredibilityMax, candidateMetricsVersion, derivedMaxScores, groupManagementBonus, netCostBonusScore, managementScale, managementMax, isMois30To50, isMoisUnderOr30To50, isKrailUnder50, isPpsUnder50, roundForLhTotals, roundForMoisManagement, roundForKrailUnder50, roundUpForPpsUnder50, roundForExManagement, resolveKrailTechnicianAbilityScore, resolveSummaryDigits, technicianEditable, technicianEnabled, technicianAbilityMax]);

  React.useEffect(() => {
    attemptPendingPlacement();
  }, [participantMap, attemptPendingPlacement]);

  React.useEffect(() => {
    if (!open) return;
    const evalApi = typeof window !== 'undefined' ? window.electronAPI?.formulasEvaluate : null;
    const baseValue = parseAmountValue(baseAmount);
    const estimatedValue = parseAmountValue(estimatedAmount);
    const perfBase = (estimatedValue != null && estimatedValue > 0)
      ? estimatedValue
      : (baseValue != null && baseValue > 0 ? baseValue : null);
    const rangeAmountHint = parseRangeAmountHint(ownerKeyUpper, selectedRangeOption?.label);
    const evaluationAmount = rangeAmountHint > 0 ? rangeAmountHint : 0;
    const ownerKey = String(ownerId || 'lh').toLowerCase();
    const performanceBaseReady = perfBase != null && perfBase > 0;

    const entries = Array.from(participantMap.values()).map((entry) => entry?.candidate).filter(Boolean);
    if (entries.length === 0) return;

    if (process.env.NODE_ENV !== 'production') {
      const sample = entries.slice(0, 5).map((candidate) => ({
        name: getCompanyName(candidate),
        debtRatio: getCandidateNumericValue(candidate, ['debtRatio', '부채비율']),
        currentRatio: getCandidateNumericValue(candidate, ['currentRatio', '유동비율']),
        credit: extractCreditGrade(candidate),
        perf5y: getCandidatePerformanceAmount(candidate),
        managementScore: candidate.managementTotalScore ?? candidate.managementScore ?? null,
      }));
      console.debug('[AgreementBoard] candidate sample', sample);
    }

    const hasManagementValues = entries.some((candidate) => {
      if (!candidate || typeof candidate !== 'object') return false;
      if (
        candidate.managementScore != null || candidate._managementScore != null
        || candidate.managementTotalScore != null || candidate.totalManagementScore != null
        || candidate.managementScoreTotal != null
        || candidate.debtScore != null || candidate.currentScore != null
        || candidate.debtRatio != null || candidate.currentRatio != null
        || candidate['부채비율'] != null || candidate['유동비율'] != null
        || candidate.snapshot?.['부채비율'] != null || candidate.snapshot?.['유동비율'] != null
        || candidate.debtRatioScore != null || candidate.currentRatioScore != null
        || candidate['부채점수'] != null || candidate['유동점수'] != null
        || candidate['경영점수'] != null || candidate['경영평가점수'] != null
      ) {
        return true;
      }
      return false;
    });

    const hasPerfValues = entries.some((candidate) => {
      if (!candidate || typeof candidate !== 'object') return false;
      if (
        candidate._performance5y != null || candidate.performance5y != null
        || candidate.perf5y != null || candidate.performanceTotal != null
        || candidate['5년 실적'] != null || candidate['5년실적'] != null
        || candidate['최근5년실적'] != null || candidate['5년실적금액'] != null
      ) {
        return true;
      }
      return false;
    });

    if (!hasManagementValues && !hasPerfValues) {
      console.warn('[AgreementBoard] 후보 데이터에 경영/실적 점수 관련 값이 없습니다. main.js 후보 산출 로직을 확인하세요.');
      return;
    }

    let canceled = false;

    const normalizeCandidateKey = (candidate) => {
      if (!candidate || typeof candidate !== 'object') return '';
      if (candidate.id) return String(candidate.id);
      const biz = normalizeBizNo(getBizNo(candidate));
      if (biz) return `biz:${biz}`;
      const name = getCompanyName(candidate);
      return name ? `name:${name}` : '';
    };

    const resolveCandidateScores = async () => {
      let updated = 0;

      for (const candidate of entries) {
        if (canceled || !candidate || typeof candidate !== 'object') continue;

        const currentManagement = getCandidateManagementScore(candidate);
        const storedPerformanceMax = Number(candidate._agreementPerformanceMax);
        const storedCapVersion = Number(candidate._agreementPerformanceCapVersion);
        const capIsValid = Number.isFinite(storedPerformanceMax) && storedPerformanceMax > 0;
        const capVersionFresh = storedCapVersion === PERFORMANCE_CAP_VERSION;
        if (capIsValid && capVersionFresh) {
          updatePerformanceCap(storedPerformanceMax);
        }
        const capForStored = (capIsValid && capVersionFresh)
          ? storedPerformanceMax
          : getPerformanceCap();
        const currentPerformanceScore = (candidate._agreementPerformanceScore != null && capVersionFresh)
          ? clampScore(candidate._agreementPerformanceScore, capForStored)
          : null;
        const performanceAmount = getCandidatePerformanceAmount(candidate);
        const needsManagement = currentManagement == null;
        const needsPerformanceScore = performanceAmount != null && performanceAmount > 0
          && performanceBaseReady && currentPerformanceScore == null;

        if (!needsManagement && !needsPerformanceScore) continue;

        const candidateKey = normalizeCandidateKey(candidate);
        if (!candidateKey) continue;
        const cacheKey = `${ownerKey}|${String(fileType || '')}|${selectedRangeOption?.key || ''}|${evaluationAmount || ''}|${perfBase || ''}|${candidateKey}`;
        const cacheEntry = candidateScoreCacheRef.current.get(cacheKey);
        if (cacheEntry === 'pending') continue;
        if (cacheEntry === 'done' && !needsManagement && !needsPerformanceScore) continue;
        candidateScoreCacheRef.current.set(cacheKey, 'pending');

        const debtRatio = getCandidateNumericValue(
          candidate,
          ['debtRatio', '부채비율', '부채율', '부채비율(%)'],
          [['부채', 'debt']]
        );
        const currentRatio = getCandidateNumericValue(
          candidate,
          ['currentRatio', '유동비율', '유동자산비율', '유동비율(%)'],
          [['유동', 'current']]
        );
        const bizYears = getCandidateNumericValue(
          candidate,
          ['bizYears', '영업기간', '설립연수', '업력'],
          [['영업기간', '업력', 'bizyears']]
        );
        const qualityEval = getCandidateNumericValue(
          candidate,
          ['qualityEval', '품질평가', '품질점수'],
          [['품질', 'quality']]
        );
        const creditGradeRaw = extractCreditGrade(candidate);
        const creditExpired = isCreditScoreExpired(candidate);
        const creditGrade = creditExpired ? '' : creditGradeRaw;
        const candidatePerfAmount = performanceAmount;

        let resolvedManagement = currentManagement;
        let resolvedPerformanceScore = currentPerformanceScore;

        const payload = {
          agencyId: ownerKey,
          fileType,
          amount: Number.isFinite(evaluationAmount) && evaluationAmount > 0
            ? evaluationAmount
            : (Number.isFinite(perfBase) && perfBase > 0 ? perfBase : 0),
          inputs: {
            debtRatio,
            currentRatio,
            bizYears,
            qualityEval,
            perf5y: candidatePerfAmount,
            baseAmount: perfBase,
            estimatedAmount: estimatedValue,
            fileType,
            creditGrade,
          },
        };

        if (!Number.isFinite(payload.inputs.debtRatio)) delete payload.inputs.debtRatio;
        if (!Number.isFinite(payload.inputs.currentRatio)) delete payload.inputs.currentRatio;
        if (!Number.isFinite(payload.inputs.bizYears)) delete payload.inputs.bizYears;
        if (!Number.isFinite(payload.inputs.qualityEval)) delete payload.inputs.qualityEval;
        if (!Number.isFinite(payload.inputs.perf5y)) delete payload.inputs.perf5y;
        if (!Number.isFinite(payload.inputs.baseAmount)) delete payload.inputs.baseAmount;
        if (!Number.isFinite(payload.inputs.estimatedAmount)) delete payload.inputs.estimatedAmount;
        if (!payload.inputs.fileType) delete payload.inputs.fileType;
        if (!payload.inputs.creditGrade) delete payload.inputs.creditGrade;

        try {
          if (evalApi) {
            const response = await evalApi(payload);
            if (canceled) {
              candidateScoreCacheRef.current.delete(cacheKey);
              return;
            }
            if (response?.success && response.data) {
              const { management, performance } = response.data;
              if (needsManagement && management && management.score != null) {
                const mgmtScore = clampScore(management.score);
                if (mgmtScore != null) {
                  resolvedManagement = mgmtScore;
                  candidate._agreementManagementScore = mgmtScore;
                  candidate._agreementManagementScoreVersion = MANAGEMENT_SCORE_VERSION;
                }
              }
              if (needsPerformanceScore && performance && performance.score != null) {
                const perfMax = updatePerformanceCap(performance.maxScore);
                const perfScore = clampScore(performance.score, perfMax);
                if (perfScore != null) {
                  candidate._agreementPerformanceScore = perfScore;
                  candidate._agreementPerformanceMax = perfMax;
                  candidate._agreementPerformanceCapVersion = PERFORMANCE_CAP_VERSION;
                  resolvedPerformanceScore = perfScore;
                }
              }
            } else if (!response?.success) {
              console.warn('[AgreementBoard] formulasEvaluate failed:', response?.message);
            } else if (process.env.NODE_ENV !== 'production') {
              console.debug('[AgreementBoard] formulasEvaluate returned no data', getCompanyName(candidate), response);
            }
          } else if (needsPerformanceScore && performanceAmount != null && performanceBaseReady) {
            const ratio = performanceAmount / perfBase;
            if (Number.isFinite(ratio)) {
              const cap = getPerformanceCap();
              const fallbackScore = clampScore(Math.max(1, ratio * cap), cap);
              if (fallbackScore != null) {
                candidate._agreementPerformanceScore = fallbackScore;
                candidate._agreementPerformanceMax = cap;
                candidate._agreementPerformanceCapVersion = PERFORMANCE_CAP_VERSION;
                resolvedPerformanceScore = fallbackScore;
              }
            }
          }
        } catch (err) {
          console.warn('[AgreementBoard] candidate score evaluate failed:', err?.message || err);
        } finally {
          candidateScoreCacheRef.current.set(cacheKey, 'done');
        }

        if ((needsManagement && resolvedManagement != null) || (needsPerformanceScore && resolvedPerformanceScore != null)) {
          if (process.env.NODE_ENV !== 'production') {
            console.debug('[AgreementBoard] candidate score updated', getCompanyName(candidate), {
              management: resolvedManagement,
              performance: resolvedPerformanceScore,
            });
          }
          updated += 1;
        }
      }

      if (!canceled && updated > 0) {
        setCandidateMetricsVersion((prev) => prev + 1);
      }
    };

    resolveCandidateScores();

    return () => {
      canceled = true;
    };
  }, [open, participantMap, ownerId, ownerKeyUpper, selectedRangeOption?.label, baseAmount, estimatedAmount, fileType]);

  const handleDragStart = (id, groupIndex, slotIndex) => (event) => {
    if (!id) return;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', id);
    setDraggingId(id);
    setDragSource({ groupIndex, slotIndex, id });
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDropTarget(null);
    setDragSource(null);
  };

  const handleRemove = (groupIndex, slotIndex) => {
    setGroupAssignments((prev) => {
      const next = prev.map((group) => group.slice());
      if (next[groupIndex]) next[groupIndex][slotIndex] = null;
      return next;
    });
    setGroupShares((prev) => {
      const next = prev.map((row) => row.slice());
      if (next[groupIndex] && next[groupIndex][slotIndex] !== undefined) {
        next[groupIndex][slotIndex] = '';
      }
      return next;
    });
    setGroupShareRawInputs((prev) => {
      const next = prev.map((row) => row.slice());
      if (next[groupIndex] && next[groupIndex][slotIndex] !== undefined) {
        next[groupIndex][slotIndex] = '';
      }
      return next;
    });
    setGroupCredibility((prev) => {
      const next = prev.map((row) => row.slice());
      if (next[groupIndex] && next[groupIndex][slotIndex] !== undefined) {
        next[groupIndex][slotIndex] = '';
      }
      return next;
    });
  };

  const handleDropInternal = (groupIndex, slotIndex, id) => {
    if (!id || !participantMap.has(id)) return;
    setGroupAssignments((prev) => {
      const next = prev.map((group) => group.slice());
      if (!next[groupIndex]) {
        next[groupIndex] = Array(safeGroupSize).fill(null);
      }
      const targetId = next[groupIndex][slotIndex] || null;
      const isSource = dragSource && dragSource.id === id;
      if (isSource && dragSource.groupIndex === groupIndex && dragSource.slotIndex === slotIndex) {
        return next;
      }
      if (isSource) {
        if (next[dragSource.groupIndex]) {
          next[dragSource.groupIndex][dragSource.slotIndex] = targetId;
        }
        next[groupIndex][slotIndex] = id;
        return next;
      }
      next.forEach((group, gIdx) => {
        for (let i = 0; i < group.length; i += 1) {
          if (group[i] === id) {
            next[gIdx][i] = null;
          }
        }
      });
      next[groupIndex][slotIndex] = id;
      return next;
    });
    setDraggingId(null);
    setDropTarget(null);
    setDragSource(null);
  };

  const handleDropFromEvent = (groupIndex, slotIndex) => (event) => {
    event.preventDefault();
    const id = event.dataTransfer.getData('text/plain');
    handleDropInternal(groupIndex, slotIndex, id);
  };

  const handleDragOver = (groupIndex, slotIndex) => (event) => {
    event.preventDefault();
    if (!dropTarget || dropTarget.groupIndex !== groupIndex || dropTarget.slotIndex !== slotIndex) {
      setDropTarget({ groupIndex, slotIndex });
    }
  };

  const handleDragLeave = (groupIndex, slotIndex) => () => {
    if (dropTarget && dropTarget.groupIndex === groupIndex && dropTarget.slotIndex === slotIndex) {
      setDropTarget(null);
    }
  };

  const handleAddGroup = () => {
    setGroupAssignments((prev) => [...prev, Array(safeGroupSize).fill(null)]);
    setGroupTechnicianScores((prev) => [...prev, Array(safeGroupSize).fill('')]);
  };

  const handleResetGroups = async () => {
    const ok = await confirm({
      title: '초기화 하시겠습니까?',
      message: '현재 입력한 협정 내용이 모두 초기화됩니다.',
      confirmText: '예',
      cancelText: '아니오',
      tone: 'warning',
    });
    if (!ok) return;
    setGroupAssignments(buildInitialAssignments());
    setDropTarget(null);
    setGroupShares([]);
    setGroupShareRawInputs([]);
    setGroupCredibility([]);
    setGroupTechnicianScores([]);
    setGroupApprovals([]);
    setGroupManagementBonus([]);
    setGroupQualityScores([]);
    setMemoDraft('');
    setEditableBidAmount('');
    setEditableEntryAmount('');
    setBaseTouched(false);
    setBidTouched(false);
    if (typeof onUpdateBoard === 'function') {
      onUpdateBoard({
        memoHtml: '',
        noticeNo: '',
        noticeTitle: '',
        noticeDate: '',
        bidDeadline: '',
        industryLabel: '',
        estimatedAmount: '',
        baseAmount: '',
        bidAmount: '',
        ratioBaseAmount: '',
        bidRate: '',
        adjustmentRate: '',
        entryAmount: '',
        entryMode: 'none',
        netCostAmount: '',
        aValue: '',
        dutyRegions: [],
        regionDutyRate: '',
        participantLimit: safeGroupSize,
      });
    }
  };

  const toggleGroupSelection = (groupIndex) => {
    setSelectedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupIndex)) next.delete(groupIndex);
      else next.add(groupIndex);
      return next;
    });
  };

  const clearSelectedGroups = () => setSelectedGroups(new Set());

  const handleDeleteGroups = async () => {
    if (selectedGroups.size === 0) {
      showHeaderAlert('삭제할 협정을 선택해 주세요.');
      return;
    }
    const ok = await confirm({
      title: '협정을 삭제하시겠습니까?',
      message: '선택한 협정은 복구할 수 없습니다.',
      confirmText: '예',
      cancelText: '아니오',
      tone: 'warning',
    });
    if (!ok) return;
    const selected = new Set(selectedGroups);
    setGroupAssignments((prev) => prev.filter((_, idx) => !selected.has(idx)));
    setGroupShares((prev) => prev.filter((_, idx) => !selected.has(idx)));
    setGroupShareRawInputs((prev) => prev.filter((_, idx) => !selected.has(idx)));
    setGroupCredibility((prev) => prev.filter((_, idx) => !selected.has(idx)));
    setGroupTechnicianScores((prev) => prev.filter((_, idx) => !selected.has(idx)));
    setGroupApprovals((prev) => prev.filter((_, idx) => !selected.has(idx)));
    setGroupManagementBonus((prev) => prev.filter((_, idx) => !selected.has(idx)));
    setDropTarget(null);
    clearSelectedGroups();
  };

  const handleShareInput = (groupIndex, slotIndex, rawValue) => {
    const original = rawValue ?? '';
    const sanitized = original.replace(/[^0-9.]/g, '');
    if ((sanitized.match(/\./g) || []).length > 1) return;
    setGroupShares((prev) => {
      const next = prev.map((row) => row.slice());
      while (next.length <= groupIndex) next.push([]);
      while (next[groupIndex].length <= slotIndex) next[groupIndex].push('');
      next[groupIndex][slotIndex] = sanitized;
      return next;
    });
    setGroupShareRawInputs((prev) => {
      const next = prev.map((row) => row.slice());
      while (next.length <= groupIndex) next.push([]);
      while (next[groupIndex].length <= slotIndex) next[groupIndex].push('');
      next[groupIndex][slotIndex] = original;
      return next;
    });
  };

  const handleTechnicianInput = (groupIndex, slotIndex, rawValue) => {
    const original = rawValue ?? '';
    const sanitized = original.replace(/[^0-9.]/g, '');
    if ((sanitized.match(/\./g) || []).length > 1) return;
    setGroupTechnicianScores((prev) => {
      const next = prev.map((row) => row.slice());
      while (next.length <= groupIndex) next.push([]);
      while (next[groupIndex].length <= slotIndex) next[groupIndex].push('');
      next[groupIndex][slotIndex] = sanitized;
      return next;
    });
  };

  const handleCredibilityInput = (groupIndex, slotIndex, rawValue) => {
    const original = rawValue ?? '';
    const sanitized = original.replace(/[^0-9.]/g, '');
    if ((sanitized.match(/\./g) || []).length > 1) return;
    setGroupCredibility((prev) => {
      const next = prev.map((row) => row.slice());
      while (next.length <= groupIndex) next.push([]);
      while (next[groupIndex].length <= slotIndex) next[groupIndex].push('');
      next[groupIndex][slotIndex] = sanitized;
      return next;
    });
  };

  const handleApprovalChange = React.useCallback((groupIndex, value) => {
    setGroupApprovals((prev) => {
      const next = prev.slice();
      while (next.length <= groupIndex) next.push('');
      next[groupIndex] = value;
      return next;
    });
  }, []);

  const groups = React.useMemo(() => (
    groupAssignments.map((group, index) => ({
      id: index + 1,
      memberIds: group,
      members: group.map((uid) => (uid ? participantMap.get(uid) || null : null)),
      summary: summaryByGroup.get(index) || null,
    }))
  ), [groupAssignments, participantMap, summaryByGroup, candidateMetricsVersion]);

  const formatShareDecimal = (value) => {
    if (value === null || value === undefined) return '';
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '';
    let text = numeric.toFixed(6);
    text = text.replace(/(\.\d*?[1-9])0+$/u, '$1');
    text = text.replace(/\.0+$/u, '');
    if (text === '' || text === '-0') return '0';
    return text;
  };

  const copyToClipboard = React.useCallback(async (payload) => {
    if (window.electronAPI?.clipboardWriteText) {
      const result = await window.electronAPI.clipboardWriteText(payload);
      if (!result?.success) {
        throw new Error(result?.message || 'clipboard failed');
      }
      return;
    }
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(payload);
      return;
    }
    throw new Error('clipboard unavailable');
  }, []);

  const copyBoardDataset = React.useCallback(async (kind) => {
    if (excelCopying) return;
    const action = BOARD_COPY_LOOKUP[kind];
    if (!action) return;

    const formatNumeric = (value) => {
      const numeric = toNumber(value);
      if (numeric === null) return '0';
      if (Math.abs(numeric - Math.round(numeric)) < 0.0001) return String(Math.round(numeric));
      return numeric.toFixed(3).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
    };

    const formatAmountForExcel = (value) => {
      const plain = formatPlainAmount(value);
      if (!plain || plain === '-') return '0';
      return plain;
    };

    const encodeCell = (value) => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (!str) return '';
      if (/[\t\n\r"]/g.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const getShareDisplayValue = (groupIndex, slotIndex) => {
      const rawInput = groupShareRawInputs[groupIndex]?.[slotIndex];
      if (rawInput !== undefined && rawInput !== null) {
        const trimmed = String(rawInput).trim();
        if (trimmed) return trimmed;
      }
      const stored = groupShares[groupIndex]?.[slotIndex];
      if (stored !== undefined && stored !== null) {
        const trimmed = String(stored).trim();
        if (trimmed) return trimmed;
      }
      return '';
    };

    const buildNameCell = (candidate, groupIndex, slotIndex) => {
      const rawName = getCompanyName(candidate) || '';
      const cleanName = sanitizeCompanyName(rawName) || rawName;
      const managerName = getCandidateManagerName(candidate);
      const shareDisplay = getShareDisplayValue(groupIndex, slotIndex);

      const sipyungAmountRaw = getCandidateSipyungAmount(candidate);
      const sipyungAmount = parseAmountValue(sipyungAmountRaw);
      let possibleShareDisplay = '';
      let possibleShareRatio = null;
      if (possibleShareBase !== null && possibleShareBase > 0 && sipyungAmount !== null && sipyungAmount > 0) {
        const ratio = (sipyungAmount / possibleShareBase) * 100;
        if (Number.isFinite(ratio) && ratio > 0) {
          possibleShareRatio = ratio;
          if (ratio < 100) {
            possibleShareDisplay = formatNumeric(ratio);
          }
        }
      }

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
    };

    const rows = groups
      .map((group, groupIndex) => {
        if (!group || !Array.isArray(group.memberIds) || group.memberIds.every((id) => !id)) return null;
        const row = new Array(BOARD_COPY_SLOT_COUNT).fill('');
        for (let slotIndex = 0; slotIndex < BOARD_COPY_SLOT_COUNT; slotIndex += 1) {
          const uid = group.memberIds[slotIndex];
          if (!uid) continue;
          const entry = participantMap.get(uid);
          if (!entry || !entry.candidate) continue;
          const candidate = entry.candidate;
          let value = '';
          if (kind === 'names') {
            value = buildNameCell(candidate, groupIndex, slotIndex);
          } else if (kind === 'shares') {
            const shareStored = groupShares[groupIndex]?.[slotIndex];
            if (shareStored !== undefined && shareStored !== null && String(shareStored).trim() !== '') {
              const numeric = Number(shareStored);
              if (Number.isFinite(numeric)) {
                value = formatShareDecimal(numeric / 100);
              } else {
                value = String(shareStored).trim();
              }
            } else {
              value = '';
            }
          } else if (kind === 'management') {
        const managementScore = getCandidateManagementScore(candidate);
            if (managementScore != null && managementScore !== '') {
              value = formatNumeric(managementScore);
            }
          } else if (kind === 'performance') {
            const performanceAmount = getCandidatePerformanceAmount(candidate);
            if (performanceAmount != null && performanceAmount !== '') {
              value = formatAmountForExcel(performanceAmount);
            }
          } else if (kind === 'sipyung') {
            const sipyungAmount = getCandidateSipyungAmount(candidate);
            if (sipyungAmount != null && sipyungAmount !== '') {
              value = formatAmountForExcel(sipyungAmount);
            }
          }
          row[slotIndex] = value ?? '';
        }
        return row.map(encodeCell).join('\t');
      })
      .filter(Boolean);

    const payload = rows.join('\r\n');
    if (!payload.trim()) {
      showHeaderAlert('복사할 협정이 없습니다.');
      return;
    }

    try {
      setExcelCopying(true);
      setCopyingKind(kind);
      await copyToClipboard(payload);
      showHeaderAlert(action.successMessage || '복사가 완료되었습니다.');
    } catch (error) {
      console.error('[AgreementBoard] Excel copy failed:', error);
      showHeaderAlert('복사에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setCopyingKind(null);
      setExcelCopying(false);
    }
  }, [copyToClipboard, excelCopying, groups, participantMap, groupShares, groupShareRawInputs, possibleShareBase]);


  const copyGroupMetric = React.useCallback(async (groupIndex, metric) => {
    const group = groups[groupIndex];
    if (!group) {
      showHeaderAlert('협정 조합을 찾을 수 없습니다.');
      return;
    }

    const metricConfig = {
      management: {
        label: '경영점수',
        extractor: (candidate) => {
          const scoreRaw = getCandidateManagementScore(candidate);
          const numeric = scoreRaw != null ? toNumber(scoreRaw) : null;
          return numeric == null ? '' : formatScore(numeric);
        },
      },
      perf5y: {
        label: '5년 실적',
        extractor: (candidate) => formatPlainAmount(getCandidatePerformanceAmount(candidate)),
      },
      sipyung: {
        label: '시평액',
        extractor: (candidate) => formatPlainAmount(getCandidateSipyungAmount(candidate)),
      },
    };

    const config = metricConfig[metric];
    if (!config) return;

    const values = group.members.map((entry) => {
      const candidate = entry && entry.candidate;
      if (!candidate) return '';
      const value = config.extractor(candidate);
      return value != null ? String(value) : '';
    });

    const text = values.join('\t');
    try {
      if (window.electronAPI?.clipboardWriteText) {
        const result = await window.electronAPI.clipboardWriteText(text);
        if (!result?.success) throw new Error(result?.message || 'clipboard write failed');
      } else if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error('clipboard unavailable');
      }
      showHeaderAlert(`${config.label} 복사 완료`);
    } catch (err) {
      console.error('[AgreementBoard] copy failed', err);
      showHeaderAlert('복사에 실패했습니다. 다시 시도해 주세요.');
    }
  }, [groups, showHeaderAlert]);

  const tableColumnCount = React.useMemo(() => {
    const perSlotCols = (credibilityEnabled ? 6 : 5) + (technicianEnabled ? 1 : 0);
    const baseColumns = 12
      + (credibilityEnabled ? 1 : 0)
      + (technicianEnabled ? 2 : 0)
      + (isLHOwner ? 1 : 0)
      + ((isMois30To50 || isEx50To100) ? 1 : 0);
    return baseColumns + (slotLabels.length * perSlotCols);
  }, [credibilityEnabled, isLHOwner, isMois30To50, isEx50To100, slotLabels.length, technicianEnabled]);

  const buildSlotMeta = (group, groupIndex, slotIndex, label) => {
    const memberIds = Array.isArray(group.memberIds) ? group.memberIds : [];
    const uid = memberIds[slotIndex];
    if (!uid) {
      return { empty: true, slotIndex, groupIndex, label };
    }
    const entry = participantMap.get(uid);
    if (!entry || !entry.candidate) {
      return { empty: true, slotIndex, groupIndex, label };
    }
    const candidate = entry.candidate;
    const isDutyRegion = entry.type === 'region' || isDutyRegionCompany(candidate);
    const qualityInputRaw = groupQualityScores[groupIndex]?.[slotIndex];
    const qualityScore = isLHOwner
      ? getQualityScoreValue(groupIndex, slotIndex, candidate)
      : null;
    const shareRaw = groupShareRawInputs[groupIndex]?.[slotIndex];
    const storedShare = groupShares[groupIndex]?.[slotIndex];
    const shareValue = shareRaw !== undefined ? shareRaw : (storedShare !== undefined ? storedShare : '');
    const shareNumeric = parseNumeric(shareValue);
    const shareFallback = getSharePercent(groupIndex, slotIndex, candidate);
    const shareForCalc = shareNumeric != null ? shareNumeric : shareFallback;
    const sipyungAmount = getCandidateSipyungAmount(candidate);
    const performanceAmount = getCandidatePerformanceAmount(candidate);
    let possibleShare = null;
    if (possibleShareBase !== null && possibleShareBase > 0 && sipyungAmount && sipyungAmount > 0) {
      possibleShare = (sipyungAmount / possibleShareBase) * 100;
    }
    const possibleShareText = (possibleShare != null && possibleShare > 0 && possibleShare < 100)
      ? `${possibleShare >= 100 ? possibleShare.toFixed(0) : possibleShare.toFixed(2)}%`
      : '';
    const tags = [];
    if (entry.type === 'region' || isDutyRegionCompany(candidate)) {
      tags.push({ key: 'region', label: '지역사' });
    }
    if (isSingleBidEligible(candidate)) {
      tags.push({ key: 'single-bid', label: '단독가능' });
    }
    if (isWomenOwnedCompany(candidate)) {
      tags.push({ key: 'female', label: '女' });
    }
    const managerName = getCandidateManagerName(candidate);
    const managementScore = getCandidateManagementScore(candidate);
    const perSlotMax = isMois30To50 ? MANAGEMENT_SCORE_MAX : managementMax;
    const managementNumeric = clampScore(toNumber(managementScore), perSlotMax);
    const credibilityStored = groupCredibility[groupIndex]?.[slotIndex];
    const credibilityValue = credibilityStored != null ? String(credibilityStored) : '';
    const credibilityNumeric = parseNumeric(credibilityValue);
    const credibilityProductRaw = (credibilityNumeric != null && shareForCalc != null)
      ? credibilityNumeric * (shareForCalc / 100)
      : null;
    const credibilityProduct = credibilityProductRaw != null
      ? credibilityProductRaw * krailCredibilityScale
      : null;
    const technicianStored = groupTechnicianScores[groupIndex]?.[slotIndex];
    const technicianValue = technicianStored != null ? String(technicianStored) : '';
    const technicianNumeric = parseNumeric(technicianValue);

    return {
      empty: false,
      slotIndex,
      groupIndex,
      label,
      uid,
      companyName: getCompanyName(candidate),
      isDutyRegion,
      managerName,
      tags,
      shareValue: shareValue != null ? String(shareValue) : '',
      shareForCalc,
      sharePlaceholder: possibleShareText || '0',
      possibleShareText,
      sipyungDisplay: formatAmount(sipyungAmount),
      performanceDisplay: formatAmount(performanceAmount),
      managementDisplay: formatScore(managementNumeric, 2),
      managementAlert: managementNumeric != null && managementNumeric < (perSlotMax - 0.01),
      qualityScore,
      qualityInput: qualityInputRaw,
      credibilityValue,
      credibilityProduct: credibilityProduct != null ? `${credibilityProduct.toFixed(2)}점` : '',
      technicianValue,
      technicianNumeric,
    };
  };

  const renderNameCell = (meta) => {
    const isDropTarget = dropTarget && dropTarget.groupIndex === meta.groupIndex && dropTarget.slotIndex === meta.slotIndex;
    const cellClasses = ['excel-cell', 'excel-name-cell'];
    if (!meta.empty && meta.isDutyRegion) cellClasses.push('duty-region');
    if (isDropTarget) cellClasses.push('drop-target');
    return (
      <td
        key={`name-${meta.groupIndex}-${meta.slotIndex}`}
        className={cellClasses.join(' ')}
        onDragOver={handleDragOver(meta.groupIndex, meta.slotIndex)}
        onDragEnter={handleDragOver(meta.groupIndex, meta.slotIndex)}
        onDragLeave={handleDragLeave(meta.groupIndex, meta.slotIndex)}
        onDrop={handleDropFromEvent(meta.groupIndex, meta.slotIndex)}
      >
        {meta.empty ? (
          <button
            type="button"
            className="excel-add-button"
            aria-label="업체 검색"
            onClick={() => openRepresentativeSearch({ groupIndex: meta.groupIndex, slotIndex: meta.slotIndex })}
          >
            <span aria-hidden="true">＋</span>
          </button>
        ) : (
          <div
            className={`excel-member-card${draggingId === meta.uid ? ' dragging' : ''}`}
            draggable
            onDragStart={handleDragStart(meta.uid, meta.groupIndex, meta.slotIndex)}
            onDragEnd={handleDragEnd}
          >
            <div className="excel-member-tags">
              {meta.tags.map((tag) => (
                <span key={`${meta.uid}-${tag.key}`} className={`excel-tag excel-tag-${tag.key}`}>{tag.label}</span>
              ))}
            </div>
            <div className="excel-member-header">
              <div className="excel-member-name" title={meta.companyName}>{meta.companyName}</div>
              <button
                type="button"
                className="excel-remove-btn"
                onClick={() => handleRemove(meta.groupIndex, meta.slotIndex)}
              >제거</button>
            </div>
            {meta.managerName && (
              <div className="excel-member-sub">
                <span className="excel-badge">{meta.managerName}</span>
              </div>
            )}
            {meta.possibleShareText && (
              <div className="excel-member-hint">가능 {meta.possibleShareText}</div>
            )}
            {meta.overLimit && (
              <div className="excel-member-warning">참여업체수 초과</div>
            )}
          </div>
        )}
      </td>
    );
  };

  const renderShareCell = (meta) => (
    <td key={`share-${meta.groupIndex}-${meta.slotIndex}`} className="excel-cell excel-share-cell">
      {meta.empty ? null : (
        <>
          <input
            type="text"
            value={meta.shareValue}
            onChange={(event) => handleShareInput(meta.groupIndex, meta.slotIndex, event.target.value)}
            placeholder={meta.sharePlaceholder}
          />
        </>
      )}
    </td>
  );

  const renderCredibilityCell = (meta, rowSpan) => (
    <td key={`cred-${meta.groupIndex}-${meta.slotIndex}`} className="excel-cell excel-credibility-cell" rowSpan={rowSpan}>
      {meta.empty ? null : (
        <>
          <input
            type="text"
            value={meta.credibilityValue || ''}
            onChange={(event) => handleCredibilityInput(meta.groupIndex, meta.slotIndex, event.target.value)}
            placeholder="0"
          />
          {meta.credibilityProduct && (
            <div className="excel-hint">반영 {meta.credibilityProduct}</div>
          )}
        </>
      )}
    </td>
  );

  const renderTechnicianCell = (meta, rowSpan) => (
    <td
      key={`tech-${meta.groupIndex}-${meta.slotIndex}`}
      className={`excel-cell excel-technician-cell${technicianEditable ? '' : ' technician-disabled'}`}
      rowSpan={rowSpan}
    >
      {meta.empty ? null : (
        <input
          type="text"
          value={meta.technicianValue || ''}
          onChange={(event) => handleTechnicianInput(meta.groupIndex, meta.slotIndex, event.target.value)}
          placeholder="0"
          disabled={!technicianEditable}
        />
      )}
    </td>
  );

  const renderStatusCell = (meta, rowSpan) => (
    <td key={`status-${meta.groupIndex}-${meta.slotIndex}`} className="excel-cell excel-status-cell" rowSpan={rowSpan}>
      {meta.empty ? null : (
        <div className={`excel-status score-only ${meta.managementAlert ? 'warn' : ''}`}>
          <span className="status-score" title="경영점수">{meta.managementDisplay}</span>
        </div>
      )}
    </td>
  );

  const renderPerformanceCell = (meta, rowSpan) => (
    <td key={`perf-${meta.groupIndex}-${meta.slotIndex}`} className="excel-cell excel-perf-cell" rowSpan={rowSpan}>
      {meta.empty ? null : (
        <div className="excel-performance">
          <span className="perf-label">5년 실적</span>
          <strong className="perf-value">{meta.performanceDisplay}</strong>
        </div>
      )}
    </td>
  );

  const renderSipyungCell = (meta, rowSpan, entryDisabled) => (
    <td
      key={`sipyung-${meta.groupIndex}-${meta.slotIndex}`}
      className={`excel-cell excel-sipyung-cell${entryDisabled ? ' entry-disabled' : ''}`}
      rowSpan={rowSpan}
    >
      {meta.empty ? null : (
        <div className="excel-performance">
          <span className="perf-label">시평액</span>
          <strong className="perf-value">{meta.sipyungDisplay}</strong>
        </div>
      )}
    </td>
  );

  const managementHeaderMax = managementMax;
    const performanceHeaderMax = derivedMaxScores.performanceMax ?? ownerPerformanceFallback;
  const sipyungSummaryLabel = React.useMemo(() => {
    if (entryModeResolved === 'sum') return '시평액 합(단순합산)';
    if (entryModeResolved === 'ratio') return '시평액 합(비율제)';
    return '시평액 합';
  }, [entryModeResolved]);

  const handleManagementBonusToggle = (groupIndex) => {
    setGroupManagementBonus((prev) => {
      const next = prev.slice();
      next[groupIndex] = !next[groupIndex];
      return next;
    });
  };

  const sheetNameFileType = React.useMemo(() => {
    const normalized = String(fileType || '').toLowerCase();
    if (normalized) return normalized;
    return String(industryToFileType(industryLabel) || '').toLowerCase();
  }, [fileType, industryLabel]);

  const resolveSheetName = React.useCallback((rawName) => {
    const normalized = normalizeSheetNameToken(rawName);
    if (!normalized) return '';
    return ensureSheetNameSuffix(normalized, sheetNameFileType);
  }, [sheetNameFileType]);

  const handleOpenExportModal = React.useCallback(() => {
    const baseName = buildDefaultSheetName(noticeTitle || noticeNo || '') || '협정';
    const nextName = resolveSheetName(baseName);
    setExportSheetName(nextName);
    setExportModalOpen(true);
  }, [noticeTitle, noticeNo, resolveSheetName]);

  const handleExportFilePick = React.useCallback((event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    setExportTargetPath(file.path || '');
    setExportTargetName(file.name || '');
    if (event.target) event.target.value = '';
  }, []);

  const handleClearExportFile = React.useCallback(() => {
    setExportTargetPath('');
    setExportTargetName('');
  }, []);

  const handleQualityScoreChange = (groupIndex, slotIndex, value) => {
    setGroupQualityScores((prev) => {
      const next = prev.map((row) => (Array.isArray(row) ? row.slice() : []));
      while (next.length <= groupIndex) next.push([]);
      while (next[groupIndex].length <= slotIndex) next[groupIndex].push('');
      next[groupIndex][slotIndex] = value;
      return next;
    });
  };

  const renderQualityRow = (group, groupIndex, slotMetas, qualityTotal, entryFailed) => {
    if (!isLHOwner) return null;
    const qualityGuide = (selectedRangeOption?.key === 'lh-50to100')
      ? '90점이상:5점/88점이상:3점/85점이상:2점/83점이상:1.5점/80점이상:1점'
      : '품질 88점이상:3점/85점이상:2점/83점이상:1.5점/80점이상:1점';
    const guideSpan = 1 + slotMetas.length;
    const usedColumns = 4 + (slotMetas.length * 2);
    const fillerSpan = Math.max(tableColumnCount - usedColumns, 0);
    const resolvedQualityTotal = qualityTotal ?? slotMetas.reduce((acc, meta) => {
      if (meta.empty) return acc;
      const share = toNumber(meta.shareForCalc);
      const score = toNumber(meta.qualityScore);
      if (share == null || score == null) return acc;
      return acc + (score * (share / 100));
    }, 0);
    const qualityTotalDisplay = slotMetas.some((meta) => !meta.empty)
      ? formatScore(resolvedQualityTotal, 2)
      : '-';
    return (
      <tr key={`${group.id}-quality`} className={`excel-board-row quality-row${entryFailed ? ' entry-failed' : ''}`}>
        <td className="excel-cell quality-empty" />
        <td className="excel-cell order-cell quality-label">품질</td>
        <td className="excel-cell quality-guide" colSpan={guideSpan}>
          {qualityGuide}
        </td>
        {slotMetas.map((meta) => (
          <td
            key={`quality-share-${groupIndex}-${meta.slotIndex}`}
            className="excel-cell excel-share-cell quality-score"
          >
            {meta.empty ? '' : (
              <input
                type="text"
                inputMode="decimal"
                className="quality-score-input"
                value={meta.qualityInput !== undefined && meta.qualityInput !== null
                  ? String(meta.qualityInput)
                  : (meta.qualityScore != null ? String(meta.qualityScore) : '')}
                onChange={(event) => handleQualityScoreChange(groupIndex, meta.slotIndex, event.target.value)}
                placeholder={meta.qualityScore != null ? String(meta.qualityScore) : ''}
              />
            )}
          </td>
        ))}
        <td className="excel-cell total-cell quality-total">{qualityTotalDisplay}</td>
        {fillerSpan > 0 && (
          <td className="excel-cell quality-empty" colSpan={fillerSpan} />
        )}
      </tr>
    );
  };

  const renderSheetRow = (group, groupIndex) => {
    const summaryInfo = group.summary;
    let scoreState = null;
    const slotMetas = slotLabels.map((label, slotIndex) => buildSlotMeta(group, groupIndex, slotIndex, label));
    const memberCount = slotMetas.filter((meta) => !meta.empty).length;
    const participantLimitExceeded = safeParticipantLimit > 0 && memberCount > safeParticipantLimit;
    const slotMetasWithLimit = slotMetas.map((meta) => ({
      ...meta,
      overLimit: participantLimitExceeded && !meta.empty && meta.slotIndex >= safeParticipantLimit,
    }));
    const qualityTotal = isLHOwner
      ? slotMetasWithLimit.reduce((acc, meta) => {
        if (meta.empty) return acc;
        const share = toNumber(meta.shareForCalc);
        const score = toNumber(meta.qualityScore);
        if (share == null || score == null) return acc;
        return acc + (score * (share / 100));
      }, 0)
      : null;
    const dutyRateValue = parseNumeric(regionDutyRate);
    const dutyShareTotal = slotMetasWithLimit.reduce((acc, meta) => {
      if (meta.empty || !meta.isDutyRegion) return acc;
      const share = toNumber(meta.shareForCalc);
      if (share == null) return acc;
      return acc + share;
    }, 0);
    const dutyShareInsufficient = dutyRateValue != null
      && dutyRateValue > 0
      && dutyShareTotal < (dutyRateValue - 0.01);
    const baseTotalScore = credibilityEnabled
      ? summaryInfo?.totalScoreWithCred
      : summaryInfo?.totalScoreBase;
    const baseTotalMax = credibilityEnabled
      ? summaryInfo?.totalMaxWithCred
      : summaryInfo?.totalMaxBase;
    const qualityPoints = isLHOwner ? resolveQualityPoints(qualityTotal, selectedRangeOption?.key) : null;
    const qualityMax = isLHOwner ? resolveQualityPointsMax(selectedRangeOption?.key) : 0;
    const totalScore = baseTotalScore != null
      ? baseTotalScore + (qualityPoints || 0)
      : null;
    const totalMax = baseTotalMax != null
      ? baseTotalMax + (isLHOwner ? (qualityPoints || 0) : 0)
      : null;
    if (totalScore != null && (isLHOwner ? LH_FULL_SCORE : (ownerKeyUpper === 'PPS' ? PPS_FULL_SCORE : totalMax)) != null) {
      const threshold = isLHOwner ? LH_FULL_SCORE : (ownerKeyUpper === 'PPS' ? PPS_FULL_SCORE : totalMax);
      scoreState = totalScore >= (threshold - 0.01) ? 'full' : 'partial';
    }
    const managementSummary = summaryInfo?.managementScore != null
      ? formatScore(summaryInfo.managementScore, resolveSummaryDigits('management'))
      : '-';
    const performanceSummary = summaryInfo?.performanceScore != null
      ? formatScore(summaryInfo.performanceScore, resolveSummaryDigits('performance'))
      : '-';
    const technicianScoreThreshold = isKrailUnder50 ? 2 : (isKrail50To100 ? 3 : null);
    const technicianScoreWarn = technicianScoreThreshold != null
      && summaryInfo?.technicianScore != null
      && summaryInfo.technicianScore < technicianScoreThreshold;
    const technicianScoreGood = technicianScoreThreshold != null
      && summaryInfo?.technicianScore != null
      && summaryInfo.technicianScore >= technicianScoreThreshold;
    const technicianSummary = technicianEnabled
      ? (summaryInfo?.technicianScore != null
        ? formatScore(summaryInfo.technicianScore, resolveSummaryDigits('technician'))
        : (technicianEditable ? '-' : '평가제외'))
      : null;
    const technicianAbilitySummary = technicianEnabled
      ? (summaryInfo?.technicianAbilityScore != null
        ? formatScore(summaryInfo.technicianAbilityScore, resolveSummaryDigits('technicianAbility'))
        : (technicianEditable ? '-' : '평가제외'))
      : null;
    const shareSumDisplay = summaryInfo?.shareSum != null ? formatPercent(summaryInfo.shareSum) : '-';
    const shareSummaryClass = summaryInfo?.shareComplete ? 'ok' : 'warn';
    const credibilitySummary = credibilityEnabled
      ? (summaryInfo?.credibilityScore != null
        ? formatScore(summaryInfo.credibilityScore, resolveSummaryDigits('credibility'))
        : '-')
      : null;
    const qualityPointsDisplay = isLHOwner
      ? (qualityPoints != null ? formatScore(qualityPoints, resolveSummaryDigits('quality')) : '-')
      : null;
    const qualityPointsState = (isLHOwner && qualityPoints != null && qualityPoints < 2) ? 'warn' : '';
        const subcontractDisplay = (isMois30To50 || isEx50To100)
      ? (summaryInfo?.subcontractScore != null ? formatScore(summaryInfo.subcontractScore, resolveSummaryDigits('subcontract')) : '-')
      : null;
    const bidScoreDisplay = summaryInfo?.bidScore != null ? formatScore(summaryInfo.bidScore, resolveSummaryDigits('bid')) : '-';
    const netCostBonusDisplay = summaryInfo?.netCostBonusScore != null
      ? formatScore(summaryInfo.netCostBonusScore, resolveSummaryDigits('netCost'))
      : '0';
    const totalScoreDisplay = totalScore != null ? formatScore(totalScore, resolveSummaryDigits('total')) : '-';
    const entryDisabled = entryModeResolved === 'none';
    const sipyungValue = entryModeResolved === 'sum'
      ? summaryInfo?.sipyungSum
      : (entryModeResolved === 'ratio' ? summaryInfo?.sipyungWeighted : null);
    const sipyungSummaryDisplay = sipyungValue != null ? formatAmount(sipyungValue) : '-';
    const approvalValue = groupApprovals[groupIndex] || '';
    const rightRowSpan = isLHOwner ? 2 : undefined;
    const bonusChecked = Boolean(groupManagementBonus[groupIndex]);

    const managementState = summaryInfo?.managementScore != null
      ? (summaryInfo.managementScore >= ((summaryInfo.managementMax ?? managementMax) - 0.01) ? 'ok' : 'warn')
      : '';
    const performanceState = summaryInfo?.performanceScore != null
      ? (summaryInfo.performanceScore >= ((summaryInfo.performanceMax ?? ownerPerformanceFallback) - 0.01) ? 'ok' : 'warn')
      : '';

    const entryFailed = summaryInfo?.entryLimit != null
      && summaryInfo.entryMode !== 'none'
      && summaryInfo.entrySatisfied === false;

    return (
      <React.Fragment key={group.id}>
        <tr className={`excel-board-row${entryFailed ? ' entry-failed' : ''}`}>
        <td className="excel-cell select-cell">
          <input
            type="checkbox"
            checked={selectedGroups.has(groupIndex)}
            onChange={() => toggleGroupSelection(groupIndex)}
            aria-label={`${group.id}번 협정 선택`}
          />
        </td>
        <td className={`excel-cell order-cell${scoreState ? ` score-${scoreState}` : ''}`}>{group.id}</td>
        <td className={`excel-cell approval-cell${approvalValue === '취소' ? ' approval-cancel' : ''}`}>
          <select
            value={approvalValue}
            onChange={(event) => handleApprovalChange(groupIndex, event.target.value)}
          >
            <option value="">선택</option>
            <option value="알림">알림</option>
            <option value="정정">정정</option>
            <option value="취소">취소</option>
          </select>
        </td>
        {slotMetasWithLimit.map((meta) => renderNameCell(meta))}
        {slotMetasWithLimit.map(renderShareCell)}
        <td className={`excel-cell total-cell share-total-cell ${summaryInfo?.shareComplete ? 'ok' : 'warn'}`}>
          <div>{shareSumDisplay}</div>
          {dutyShareInsufficient && (
            <div className="excel-warning">의무지분 미충족</div>
          )}
        </td>
        {credibilityEnabled && slotMetas.map((meta) => renderCredibilityCell(meta, rightRowSpan))}
        {credibilityEnabled && (
          <td className="excel-cell total-cell credibility-total-cell" rowSpan={rightRowSpan}>{credibilitySummary}</td>
        )}
        {slotMetas.map((meta) => renderStatusCell(meta, rightRowSpan))}
        <td className={`excel-cell total-cell management-summary-cell ${managementState}`} rowSpan={rightRowSpan}>
          {managementSummary}
        </td>
        <td className="excel-cell management-bonus-cell" rowSpan={rightRowSpan}>
          <input
            type="checkbox"
            checked={bonusChecked}
            onChange={() => handleManagementBonusToggle(groupIndex)}
            aria-label="경영점수 가점 적용"
          />
        </td>
        {slotMetas.map((meta) => renderPerformanceCell(meta, rightRowSpan))}
        <td className={`excel-cell total-cell performance-summary-cell ${performanceState}`} rowSpan={rightRowSpan}>
          {performanceSummary}
        </td>
        {technicianEnabled && slotMetas.map((meta) => renderTechnicianCell(meta, rightRowSpan))}
        {technicianEnabled && (
          <td
            className={`excel-cell total-cell technician-summary-cell${
              technicianScoreWarn ? ' technician-warn' : (technicianScoreGood ? ' technician-good' : '')
            }`}
            rowSpan={rightRowSpan}
          >
            {technicianSummary}
          </td>
        )}
        {technicianEnabled && (
          <td
            className={`excel-cell total-cell technician-ability-cell${
              technicianScoreWarn ? ' technician-warn' : (technicianScoreGood ? ' technician-good' : '')
            }`}
            rowSpan={rightRowSpan}
          >
            {technicianAbilitySummary}
          </td>
        )}
        {isLHOwner && (
          <td
            className={`excel-cell total-cell quality-points-cell ${qualityPointsState}`}
            rowSpan={rightRowSpan}
          >
            {qualityPointsDisplay}
          </td>
        )}
        {(isMois30To50 || isEx50To100) && (
          <td className="excel-cell total-cell subcontract-cell" rowSpan={rightRowSpan}>{subcontractDisplay}</td>
        )}
        <td className="excel-cell total-cell bid-score-cell" rowSpan={rightRowSpan}>{bidScoreDisplay}</td>
        <td className="excel-cell total-cell netcost-bonus-cell" rowSpan={rightRowSpan}>{netCostBonusDisplay}</td>
        <td
          className={`excel-cell total-cell total-score-cell total-score${scoreState ? ` score-${scoreState}` : ''}`}
          rowSpan={rightRowSpan}
        >
          {totalScoreDisplay}
        </td>
        {slotMetas.map((meta) => renderSipyungCell(meta, rightRowSpan, entryDisabled))}
        <td
          className={`excel-cell total-cell sipyung-summary-cell${entryDisabled ? ' entry-disabled' : ''}`}
          rowSpan={rightRowSpan}
        >
          {entryDisabled ? '-' : sipyungSummaryDisplay}
        </td>
        </tr>
        {renderQualityRow(group, groupIndex, slotMetas, qualityTotal, entryFailed)}
      </React.Fragment>
    );
  };


  React.useEffect(() => {
    const rootEl = rootRef.current;
    const mainEl = boardMainRef.current;
    if (!rootEl || !mainEl) return undefined;

    const handleMainWheel = (event) => {
      if (!event.shiftKey) return;
      if (mainEl.scrollWidth <= mainEl.clientWidth + 1) return;
      const deltaX = event.deltaX;
      const deltaY = event.deltaY;
      const legacyDelta = typeof event.wheelDelta === 'number'
        ? -event.wheelDelta
        : (typeof event.wheelDeltaY === 'number' ? -event.wheelDeltaY : 0);
      const delta = (Math.abs(deltaX) > 0.1 ? deltaX : (Math.abs(deltaY) > 0.1 ? deltaY : legacyDelta));
      if (Math.abs(delta) < 0.1) return;
      mainEl.scrollBy({ left: delta, behavior: 'auto' });
      event.preventDefault();
      event.stopPropagation();
    };

    const handleWheel = (event) => {
      if (!mainEl) return;
      if (event.shiftKey) return;
      if (mainEl.contains(event.target)) return;
      const deltaY = event.deltaY;
      if (Math.abs(deltaY) < 0.1) return;
      const atTop = mainEl.scrollTop <= 0;
      const atBottom = (mainEl.scrollHeight - mainEl.clientHeight - mainEl.scrollTop) <= 1;
      if ((deltaY < 0 && atTop) || (deltaY > 0 && atBottom)) {
        event.preventDefault();
        return;
      }
      mainEl.scrollBy({ top: deltaY, behavior: 'auto' });
      event.preventDefault();
    };

    mainEl.addEventListener('wheel', handleMainWheel, { passive: false, capture: true });
    rootEl.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      mainEl.removeEventListener('wheel', handleMainWheel, { passive: false, capture: true });
      rootEl.removeEventListener('wheel', handleWheel, { passive: false });
    };
  }, [portalContainer, open, inlineMode]);

  const headerDutySummary = buildDutySummary(safeDutyRegions, regionDutyRate, safeParticipantLimit);

  const boardMarkup = (
    <>
      <div className="agreement-board-root" ref={rootRef}>
        <div className="excel-board-shell">
          <div className="excel-board-header">
            <div className="excel-header-grid condensed">
              <div className="header-stack stack-owner">
                <div className="excel-select-block">
                  <label>발주처</label>
                  <select value={ownerSelectValue} onChange={handleOwnerSelectChange}>
                    {AGREEMENT_GROUPS.map((group) => (
                      <option key={group.id} value={group.id}>{group.label}</option>
                    ))}
                  </select>
                </div>
                <div className="excel-select-block">
                  <label>금액 구간</label>
                  <select value={selectedRangeKey} onChange={handleRangeSelectChange}>
                    {rangeOptions.map((item) => (
                      <option key={item.key} value={item.key}>{item.label}</option>
                    ))}
                  </select>
                </div>
                <div className="excel-field-block size-xs">
                  <span className="field-label">공종</span>
                  <select className="input" value={industryLabel || ''} onChange={handleIndustryLabelChange}>
                    <option value="">선택</option>
                    {INDUSTRY_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
                <div className="excel-field-block size-xs">
                  <span className="field-label">지역사</span>
                  <button type="button" className="excel-btn excel-btn-region" onClick={handleOpenRegionSearch}>
                    지역사 찾기
                  </button>
                </div>
              </div>

              <div className="header-stack stack-amount">
                <div className="excel-field-block accent size-lg">
                  <span className="field-label">추정가격</span>
                  <AmountInput value={estimatedAmount || ''} onChange={handleEstimatedAmountChange} placeholder="원" />
                </div>
                <div className="excel-field-block size-lg">
                  <span className="field-label">기초금액</span>
                  {(ownerKeyUpper === 'PPS' || isMois30To50) && (
                    <span className="field-label sub">(추정가격 × 1.1배)</span>
                  )}
                  <AmountInput value={baseAmount || ''} onChange={handleBaseAmountChange} placeholder="원" />
                </div>
                {isLH && (
                  <>
                    <div className="excel-field-block size-lg">
                      <span className="field-label">순공사원가</span>
                      <AmountInput value={netCostAmount || ''} onChange={handleNetCostAmountChange} placeholder="원" />
                    </div>
                    <div className="excel-field-block size-lg">
                      <span className="field-label">A값</span>
                      <AmountInput value={aValue || ''} onChange={handleAValueChange} placeholder="원" />
                    </div>
                  </>
                )}
              </div>

      <div className="header-stack stack-rate">
        <div className="excel-field-block size-xs">
          <span className="field-label">사정율</span>
          <input className="input" value={adjustmentRate || ''} onChange={handleAdjustmentRateChange} placeholder="예: 101.5" />
        </div>
        <div className="excel-field-block size-xs">
          <span className="field-label">투찰율</span>
          <input className="input" value={bidRate || ''} onChange={handleBidRateChange} placeholder="예: 86.745" />
        </div>
        {isLH && (
          <>
            <div className="excel-field-block size-xs readonly">
              <span className="field-label">순공사원가가점</span>
              <div className="readonly-value">{formatScore(netCostBonusScore, 2)}</div>
              {netCostPenaltyNotice && (
                <div className="readonly-note">올라탈수록 점수 깎임</div>
              )}
            </div>
            <div className="excel-field-block size-xs">
              <span className="field-label">최소 시평액</span>
              <button type="button" className="excel-btn" onClick={openMinRatingModal}>계산</button>
            </div>
          </>
        )}
      </div>

              <div className="header-stack stack-bid">
                <div className="excel-field-block size-sm">
                  <span className="field-label">공고일</span>
                  <input className="input" type="date" value={noticeDate || ''} onChange={handleNoticeDateChange} />
                </div>
                <div className="excel-field-block size-md">
                  <span className="field-label">{isLH ? '시공비율기준금액' : '투찰금액'}</span>
                  {isLH ? (
                    <AmountInput value={ratioBaseAmount || ''} onChange={handleRatioBaseAmountChange} placeholder="원" />
                  ) : (
                    <AmountInput value={editableBidAmount} onChange={handleBidAmountChange} placeholder="원" />
                  )}
                </div>
                <div className="excel-field-block size-md">
                  <span className="field-label">실적만점금액</span>
                  <input
                    className="input"
                    value={perfectPerformanceDisplay}
                    readOnly
                    placeholder="금액 입력 시 자동 계산"
                  />
                </div>
              </div>

              <div className="header-stack stack-notice">
                <div className="excel-field-block notice-merged">
                  <span className="field-label">공고번호 / 공고명</span>
                  <div className="notice-combined-box">
                    <input className="dual" value={noticeNo || ''} onChange={handleNoticeNoChange} placeholder="예: R26BK..." />
                    <input className="dual" value={noticeTitle || ''} onChange={handleNoticeTitleChange} placeholder="공고명을 입력" />
                  </div>
                </div>
                <div className="excel-field-block size-md">
                  <span className="field-label">개찰일</span>
                  <div className="datetime-inputs">
                    <input
                      className="input"
                      type="date"
                      value={bidDatePart}
                      onChange={handleBidDatePartChange}
                    />
                    <select
                      className="input"
                      value={bidTimePeriod}
                      onChange={handleBidPeriodChange}
                    >
                      <option value="AM">오전</option>
                      <option value="PM">오후</option>
                    </select>
                    <input
                      className="input"
                      type="text"
                      inputMode="numeric"
                      value={bidHourInput}
                      onChange={handleBidHourChange}
                      placeholder="시"
                      aria-label="개찰 시"
                    />
                    <span className="datetime-sep">:</span>
                    <input
                      className="input"
                      type="text"
                      inputMode="numeric"
                      value={bidMinuteInput}
                      onChange={handleBidMinuteChange}
                      placeholder="분"
                      aria-label="개찰 분"
                    />
                  </div>
                </div>
              </div>

              <div className="header-stack stack-entry-duty">
                <div className="excel-field-block entry-amount-block">
                  <div className="entry-amount-heading">
                    <span className="field-label">참가자격금액</span>
                    <span className="field-label mode">산출방식</span>
                  </div>
                  <div className="entry-amount-body">
                    <div className="entry-amount-input">
                      {entryModeResolved === 'none' ? (
                        <span className="excel-placeholder">없음</span>
                      ) : (
                        <AmountInput value={editableEntryAmount} onChange={handleEntryAmountChange} placeholder="0" />
                      )}
                    </div>
                    <div className="entry-mode-control">
                      <div className="excel-toggle-group">
                        <button
                          type="button"
                          className={entryModeResolved === 'ratio' ? 'active' : ''}
                          onClick={() => handleEntryModeChange('ratio')}
                        >비율제</button>
                        <button
                          type="button"
                          className={entryModeResolved === 'sum' ? 'active' : ''}
                          onClick={() => handleEntryModeChange('sum')}
                        >단순합산제</button>
                        <button
                          type="button"
                          className={entryModeResolved === 'none' ? 'active' : ''}
                          onClick={() => handleEntryModeChange('none')}
                        >없음</button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="excel-field-block size-xs">
                  <span className="field-label">참여업체수</span>
                  <select className="input" value={safeParticipantLimit} onChange={handleParticipantLimitChange}>
                    {[2, 3, 4, 5].map((count) => (
                      <option key={count} value={count}>{count}개</option>
                    ))}
                  </select>
                </div>
                <div className={`excel-field-block duty-combo ${regionPickerOpen ? 'open' : ''}`}>
                  <div className="duty-combo-header">
                    <span className="field-label">의무지역 / 의무지분</span>
                    <div className="picker-actions">
                      {safeDutyRegions.length > 0 && (
                        <button type="button" className="excel-btn" onClick={handleDutyRegionsClear}>초기화</button>
                      )}
                      <button type="button" className="excel-btn" onClick={toggleRegionPicker}>{regionPickerOpen ? '닫기' : '지역 선택'}</button>
                    </div>
                  </div>
                  <div className="duty-combo-body" title={headerDutySummary || '의무지역 미지정'}>
                    <span className="duty-summary-text">{headerDutySummary || '의무지역 미지정'}</span>
                    <div className="duty-rate">
                      <label>지분(%)</label>
                      <input className="input" value={regionDutyRate || ''} onChange={handleRegionDutyRateChange} placeholder="예: 49" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

              <div className="excel-toolbar">
              <div className="excel-toolbar-actions">
                <button
                  type="button"
                  onClick={handleOpenExportModal}
                  className="excel-btn"
                  disabled={exporting}
                >엑셀로 내보내기</button>
                <button type="button" className="excel-btn" onClick={handleGenerateText}>협정 문자 생성</button>
                <button type="button" className="excel-btn" onClick={openCopyModal}>복사</button>
                <button type="button" className="excel-btn" onClick={handleAddGroup}>빈 행 추가</button>
                <button type="button" className="excel-btn" onClick={handleDeleteGroups}>선택 삭제</button>
                <button type="button" className="excel-btn" onClick={handleResetGroups}>초기화</button>
                <button type="button" className="excel-btn" onClick={handleSaveAgreement}>저장</button>
                <button type="button" className="excel-btn" onClick={openLoadModal}>불러오기</button>
                <button
                  type="button"
                  className={`excel-btn memo-btn${memoHasContent ? ' active' : ''}`}
                  onClick={openMemoModal}
                >메모</button>
                {technicianEnabled && (
                  <button
                    type="button"
                    className="excel-btn"
                    onClick={openTechnicianModal}
                    disabled={!technicianEditable}
                  >
                    기술자점수 계산
                  </button>
                )}
                {!inlineMode && (
                  <button type="button" className="excel-close-btn" onClick={onClose}>닫기</button>
                )}
              </div>
            </div>
          </div>

        <div className="excel-table-wrapper" ref={boardMainRef}>
          <div className="excel-table-inner">
              <table
                className={`excel-board-table ${tableCollapseClasses}`}
                style={{ minWidth: `${tableMinWidth}px`, width: `${tableMinWidth}px` }}
              >
            <colgroup>
              <col className="col-select" style={{ width: resolveColWidth('select') }} />
              <col className="col-order" style={{ width: resolveColWidth('order') }} />
              <col className="col-approval" style={{ width: resolveColWidth('approval') }} />
              {slotLabels.map((_, index) => (
                <col key={`col-name-${index}`} className="col-name" style={{ width: resolveColWidth('name') }} />
              ))}
                {slotLabels.map((_, index) => (
                  <col key={`col-share-${index}`} className="col-share" style={{ width: resolveColWidth('share') }} />
                ))}
                <col className="col-share-total" style={{ width: `${COLUMN_WIDTHS.shareTotal}px` }} />
                {credibilityEnabled && slotLabels.map((_, index) => (
                  <col
                    key={`col-credibility-slot-${index}`}
                    className="col-credibility-slot"
                    style={{ width: resolveColWidth('credibilityCell', 'credibility') }}
                  />
                ))}
                {credibilityEnabled && (
                  <col className="col-credibility" style={{ width: `${COLUMN_WIDTHS.credibility}px` }} />
                )}
                  {slotLabels.map((_, index) => (
                    <col key={`col-status-${index}`} className="col-status" style={{ width: resolveColWidth('status') }} />
                  ))}
                  <col className="col-management" style={{ width: `${COLUMN_WIDTHS.management}px` }} />
                  <col className="col-management-bonus" style={{ width: resolveColWidth('managementBonus') }} />
              {slotLabels.map((_, index) => (
                <col
                  key={`col-performance-${index}`}
                  className="col-performance"
                  style={{ width: resolveColWidth('performanceCell', 'performance') }}
                />
              ))}
              <col className="col-performance-summary" style={{ width: `${COLUMN_WIDTHS.performanceSummary}px` }} />
              {technicianEnabled && slotLabels.map((_, index) => (
                <col
                  key={`col-technician-${index}`}
                  className="col-technician"
                  style={{ width: resolveColWidth('technicianCell', 'technician') }}
                />
              ))}
              {technicianEnabled && (
                <col className="col-technician-summary" style={{ width: resolveColWidth('technicianSummary') }} />
              )}
              {technicianEnabled && (
                <col
                  className="col-technician-ability-summary"
                  style={{ width: resolveColWidth('technicianAbilitySummary', 'technicianAbility') }}
                />
              )}
              {isLHOwner && <col className="col-quality-points" style={{ width: `${COLUMN_WIDTHS.qualityPoints}px` }} />}
              {(isMois30To50 || isEx50To100) && (
                <col className="col-subcontract" style={{ width: resolveColWidth('subcontract') }} />
              )}
              <col className="col-bid" style={{ width: `${COLUMN_WIDTHS.bid}px` }} />
              <col className="col-netcost-bonus" style={{ width: `${COLUMN_WIDTHS.netCostBonus}px` }} />
              <col className="col-total" style={{ width: `${COLUMN_WIDTHS.total}px` }} />
              {slotLabels.map((_, index) => (
                <col
                  key={`col-sipyung-${index}`}
                  className="col-sipyung"
                  style={{ width: resolveColWidth('sipyungCell', 'sipyung') }}
                />
              ))}
              <col className="col-sipyung-summary" style={{ width: `${COLUMN_WIDTHS.sipyungSummary}px` }} />
            </colgroup>
            <thead>
              <tr>
                <th rowSpan="2" className="col-header select-header">{renderColToggle('select', '선택')}</th>
                <th rowSpan="2" className="col-header order-header">{renderColToggle('order', '연번')}</th>
                <th rowSpan="2" className="col-header approval-header">{renderColToggle('approval', '승인')}</th>
                <th colSpan={slotLabels.length} className="col-header name-header">{renderColToggle('name', '업체명')}</th>
                <th colSpan={slotLabels.length} className="col-header share-header">{renderColToggle('share', '지분(%)')}</th>
                  <th rowSpan="2" className="col-header share-total-header-cell">
                    {isLHOwner ? (
                      <span className="share-total-header">
                        <span>지분합계</span>
                        <span className="sub">품질총점</span>
                      </span>
                    ) : (
                      '지분합계'
                    )}
                  </th>
                    {credibilityEnabled && (
                      <th colSpan={slotLabels.length} className="col-header credibility-header">
                        {renderColToggle('credibility', '신인도')}
                      </th>
                    )}
                  {credibilityEnabled && (
                    <th rowSpan="2" className="col-header credibility-total-header">
                      {Number.isFinite(ownerCredibilityMax)
                        ? `신인도 합(${formatScore(ownerCredibilityMax, 1)}점)`
                        : '신인도 합'}
                    </th>
                  )}
                <th colSpan={slotLabels.length} className="col-header status-header">{renderColToggle('status', '경영상태')}</th>
                <th rowSpan="2" className="col-header management-header">
                  {`경영(${formatScore(managementHeaderMax, 0)}점)`}
                </th>
                <th rowSpan="2" className="col-header management-bonus-header">{renderColToggle('managementBonus', '가점')}</th>
                <th colSpan={slotLabels.length} className="col-header performance-header">{renderColToggle('performance', '시공실적')}</th>
                <th rowSpan="2" className="col-header performance-summary-header">
                  {`실적(${formatScore(performanceHeaderMax, 0)}점)`}
                </th>
                {technicianEnabled && (
                  <th colSpan={slotLabels.length} className="col-header technician-header">
                    {renderColToggle('technician', '기술자점수')}
                  </th>
                )}
                {technicianEnabled && (
                  <th rowSpan="2" className="col-header technician-summary-header">
                    {renderColToggle('technicianSummary', '기술자합산')}
                  </th>
                )}
                {technicianEnabled && (
                  <th rowSpan="2" className="col-header technician-ability-header">
                    {renderColToggle(
                      'technicianAbility',
                      technicianAbilityMax != null ? `기술능력(${formatScore(technicianAbilityMax, 0)}점)` : '기술능력',
                      { collapsedLabel: '기술능력' },
                    )}
                  </th>
                )}
                {isLHOwner && (
                  <th rowSpan="2" className="col-header quality-points-header">
                    품질점수
                  </th>
                )}
                {isMois30To50 && (
                  <th rowSpan="2" className="col-header subcontract-header">
                    {renderColToggle('subcontract', '하도급')}
                  </th>
                )}
                {isEx50To100 && (
                  <th rowSpan="2" className="col-header subcontract-header">
                    {renderColToggle('subcontract', '하도급및자재', { collapsedLabel: '하도급' })}
                  </th>
                )}
                <th rowSpan="2" className="col-header bid-header">입찰점수</th>
                <th rowSpan="2" className="col-header netcost-header">순공사원가가점</th>
                <th rowSpan="2" className="col-header total-header">예상점수</th>
                <th colSpan={slotLabels.length} className="col-header sipyung-header">{renderColToggle('sipyung', '시평액')}</th>
                <th rowSpan="2" className="col-header sipyung-summary-header">
                  {sipyungSummaryLabel}
                </th>
              </tr>
              <tr>
                {slotLabels.map((label, index) => (
                  <th key={`name-head-${index}`} className="subheader-name">{label}</th>
                ))}
                {slotLabels.map((label, index) => (
                  <th key={`share-head-${index}`} className="subheader-share">{label}</th>
                ))}
                {credibilityEnabled && slotLabels.map((label, index) => (
                  <th key={`credibility-head-${index}`} className="subheader-credibility">{label}</th>
                ))}
                {slotLabels.map((label, index) => (
                  <th key={`status-head-${index}`} className="subheader-status">{label}</th>
                ))}
                {slotLabels.map((label, index) => (
                  <th key={`perf-head-${index}`} className="subheader-performance">{label}</th>
                ))}
                {technicianEnabled && slotLabels.map((label, index) => (
                  <th key={`tech-head-${index}`} className="subheader-technician">{label}</th>
                ))}
                {slotLabels.map((label, index) => (
                  <th key={`sipyung-head-${index}`} className="subheader-sipyung">{label}</th>
                ))}
              </tr>
            </thead>
                <tbody>
                  {groups.length === 0 ? (
                    <tr className="excel-board-row empty">
                      <td colSpan={tableColumnCount}>협정을 추가하거나 업체를 배치하세요.</td>
                    </tr>
                  ) : (
                    groups.map((group, groupIndex) => renderSheetRow(group, groupIndex))
                  )}
                </tbody>
              </table>
              <div className="excel-table-spacer" aria-hidden="true" />
            </div>
        </div>
        </div>
      </div>
      {representativeSearchOpen && (
        <CompanySearchModal
          open={representativeSearchOpen}
          onClose={closeRepresentativeSearch}
          onPick={handleRepresentativePicked}
          fileType={searchFileType}
          allowAll={false}
        />
      )}
      <Modal
        open={memoOpen}
        title="메모"
        onClose={closeMemoModal}
        onCancel={closeMemoModal}
        onSave={handleMemoSave}
        closeOnSave
        size="lg"
        boxClassName="memo-modal"
        initialFocusRef={memoEditorRef}
      >
        <div className="memo-editor">
          <div className="memo-editor-toolbar">
            <button
              type="button"
              className="memo-toolbar-btn"
              onClick={() => applyMemoCommand('bold')}
            >볼드</button>
            <div className="memo-toolbar-group">
              <label className="memo-toolbar-label" htmlFor="memo-font-size">글자크기</label>
              <select
                id="memo-font-size"
                className="memo-toolbar-select"
                onChange={(event) => {
                  const next = event.target.value;
                  if (next) applyMemoCommand('fontSize', next);
                }}
              >
                <option value="">선택</option>
                <option value="2">12px</option>
                <option value="3">14px</option>
                <option value="4">16px</option>
                <option value="5">18px</option>
                <option value="6">20px</option>
              </select>
            </div>
            <div className="memo-toolbar-group">
              <label className="memo-toolbar-label" htmlFor="memo-color">글자색</label>
              <input
                id="memo-color"
                className="memo-toolbar-color"
                type="color"
                onChange={(event) => applyMemoCommand('foreColor', event.target.value)}
              />
            </div>
          </div>
          <div
            className="memo-editor-canvas"
            ref={memoEditorRef}
            contentEditable
            tabIndex={0}
            suppressContentEditableWarning
            onInput={handleMemoInput}
            data-placeholder="메모를 입력하세요."
          />
          <div className="memo-editor-hint">저장하면 협정 저장 데이터에 포함됩니다.</div>
        </div>
      </Modal>
      <Modal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        title="엑셀 내보내기"
        closeOnSave={false}
        confirmLabel="실행"
        cancelLabel="취소"
        onSave={async () => {
          const resolvedSheetName = resolveSheetName(exportSheetName);
          if (!resolvedSheetName) {
            showHeaderAlert('시트명을 입력해 주세요.');
            return;
          }
          const ok = await handleExportExcel({
            appendTargetPath: exportTargetPath || '',
            sheetName: resolvedSheetName,
          });
          if (ok) {
            setExportModalOpen(false);
          }
        }}
        size="sm"
      >
        <div className="export-sheet-modal">
          <div className="export-sheet-field">
            <span className="export-sheet-label">대상 파일</span>
            <div className="export-sheet-file">
              <button type="button" className="excel-btn" onClick={() => exportFileInputRef.current?.click()}>
                파일 선택
              </button>
              <span className="export-sheet-file__name">
                {exportTargetName || '선택 안 함 (새 파일 생성)'}
              </span>
              {exportTargetName && (
                <button type="button" className="excel-btn" onClick={handleClearExportFile}>
                  선택 해제
                </button>
              )}
            </div>
            <input
              ref={exportFileInputRef}
              type="file"
              accept=".xlsx"
              style={{ display: 'none' }}
              onChange={handleExportFilePick}
            />
            <p className="export-sheet-hint">파일을 선택하지 않으면 새 파일로 저장됩니다.</p>
          </div>
          <div className="export-sheet-field">
            <span className="export-sheet-label">시트명</span>
            <input
              type="text"
              value={exportSheetName}
              onChange={(event) => setExportSheetName(event.target.value)}
              placeholder="예: 2026년익산청교통정체잦은곳"
            />
            <p className="export-sheet-hint">통신/소방 공고는 자동으로 (통신)/(소방)이 붙습니다.</p>
          </div>
        </div>
      </Modal>
      <Modal
        open={copyModalOpen}
        title="복사"
        onClose={closeCopyModal}
        onCancel={closeCopyModal}
        onSave={closeCopyModal}
        closeOnSave
        size="sm"
        boxClassName="copy-modal"
      >
        <div className="copy-modal-body">
          {BOARD_COPY_ACTIONS.map((action) => (
            <button
              key={action.kind}
              type="button"
              className="excel-btn"
              onClick={() => copyBoardDataset(action.kind)}
              disabled={excelCopying}
            >
              {excelCopying && copyingKind === action.kind ? '복사 중…' : action.label}
            </button>
          ))}
        </div>
      </Modal>
      <Modal
        open={minRatingOpen}
        title="최소 시평액 계산"
        onClose={closeMinRatingModal}
        onCancel={closeMinRatingModal}
        onSave={closeMinRatingModal}
        closeOnSave
        confirmLabel="닫기"
        size="sm"
      >
        <div className="export-sheet-modal">
          <div className="export-sheet-field">
            <span className="export-sheet-label">순공사원가가점</span>
            <input
              type="text"
              value={minRatingNetCostBonus}
              onChange={(event) => setMinRatingNetCostBonus(event.target.value)}
              placeholder="예: 3.11"
            />
          </div>
          <div className="export-sheet-field">
            <span className="export-sheet-label">신인도가점</span>
            <input
              type="text"
              value={minRatingCredibilityScore}
              onChange={(event) => setMinRatingCredibilityScore(event.target.value)}
              placeholder="예: 1.5"
            />
            <p className="export-sheet-hint">신인도 가점이 없으면 비워두세요.</p>
          </div>
          <div className="export-sheet-field">
            <span className="export-sheet-label">신인도 적용 지분(%)</span>
            <input
              type="text"
              value={minRatingCredibilityShare}
              onChange={(event) => setMinRatingCredibilityShare(event.target.value)}
              placeholder="예: 70"
            />
          </div>
          <div className="export-sheet-field">
            <span className="export-sheet-label">의무지분(%)</span>
            <input
              type="text"
              value={minRatingRequiredShare}
              onChange={(event) => setMinRatingRequiredShare(event.target.value)}
              placeholder="예: 30"
            />
            <p className="export-sheet-hint">의무지분이 필요한 업체의 지분을 입력하세요.</p>
          </div>
          <div className="export-sheet-field">
            <span className="export-sheet-label">결과</span>
            {minRatingResult.status === 'needShare' && (
              <p className="export-sheet-hint">의무지분(%)을 입력해 주세요.</p>
            )}
            {minRatingResult.status === 'needRatioBase' && (
              <p className="export-sheet-hint">시공비율기준금액을 입력해 주세요.</p>
            )}
            {minRatingResult.status === 'impossible' && (
              <p className="export-sheet-hint" style={{ color: '#b91c1c' }}>
                현재 가점 기준으로는 만점에 도달할 수 없습니다. ({minRatingResult.reason || '사유 미확인'})
              </p>
            )}
            {minRatingResult.status === 'ok' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div>최소 가능지분: <strong>{formatPercentValue(minRatingResult.possibleShare)}</strong></div>
                <div>가능지분 합계: {formatPercentValue(minRatingResult.effectiveShare)}</div>
                <div>예상 총점: {formatScore(minRatingResult.totalScore, 2)}</div>
                <div>최소 시평액: <strong>{formatAmount(minRatingResult.minRatingAmount)}</strong></div>
              </div>
            )}
            {minRatingResult.status === 'ok'
              && minRatingResult.bonusTotal <= 0
              && minRatingResult.possibleShare >= (minRatingResult.requiredShare - 0.0001) && (
                <p className="export-sheet-hint" style={{ color: '#b91c1c' }}>
                  가점 없음: 의무지분만으로 계산됩니다.
                </p>
            )}
            <p className="export-sheet-hint">기준: 경영 15점, 실적 만점, 품질 85점, 입찰 65점 기준.</p>
          </div>
        </div>
      </Modal>
      <Modal
        open={technicianModalOpen}
        title="기술자점수 계산"
        onClose={closeTechnicianModal}
        onCancel={closeTechnicianModal}
        onSave={applyTechnicianScoreToTarget}
        closeOnSave
        size="lg"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, color: '#475569' }}>적용 대상</span>
              <select
                className="filter-input"
                value={`${technicianTarget.groupIndex}:${technicianTarget.slotIndex}`}
                onChange={(event) => {
                  const [groupIndex, slotIndex] = event.target.value.split(':').map((v) => Number(v));
                  setTechnicianTarget({ groupIndex, slotIndex });
                }}
              >
                {technicianTargetOptions.map((option) => (
                  <option key={option.key} value={option.key}>{option.label}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, color: '#475569' }}>총점</span>
              <strong style={{ fontSize: 18, color: '#0f172a' }}>{roundTo(technicianScoreTotal, 2).toFixed(2)}점</strong>
            </div>
            <button
              type="button"
              className="excel-btn"
              onClick={addTechnicianEntry}
              disabled={!technicianEditable}
            >
              기술자 추가
            </button>
          </div>
          {!technicianEditable && (
            <div style={{ fontSize: 12, color: '#b91c1c' }}>
              소방 공종은 기술자점수가 평가제외입니다.
            </div>
          )}
          {technicianEntries.length === 0 && (
            <div style={{ padding: 12, border: '1px dashed #cbd5f5', borderRadius: 10, color: '#64748b' }}>
              추가된 기술자가 없습니다. "기술자 추가" 버튼을 눌러 입력을 시작하세요.
            </div>
          )}
          {technicianEntries.map((entry) => (
            <div
              key={entry.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '120px 120px 120px 80px 1fr auto',
                gap: 10,
                alignItems: 'center',
              }}
            >
              <select
                className="filter-input"
                value={entry.grade}
                onChange={(event) => updateTechnicianEntry(entry.id, 'grade', event.target.value)}
              >
                <option value="">등급을 선택하세요</option>
                {TECHNICIAN_GRADE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <select
                className="filter-input"
                value={entry.careerCoeff}
                onChange={(event) => updateTechnicianEntry(entry.id, 'careerCoeff', event.target.value)}
              >
                {TECHNICIAN_CAREER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <select
                className="filter-input"
                value={entry.managementCoeff}
                onChange={(event) => updateTechnicianEntry(entry.id, 'managementCoeff', event.target.value)}
              >
                {TECHNICIAN_MANAGEMENT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <input
                className="filter-input"
                value={entry.count}
                onChange={(event) => updateTechnicianEntry(entry.id, 'count', event.target.value.replace(/[^0-9]/g, ''))}
                placeholder="인원"
              />
              <div style={{ fontSize: 13, color: '#0f172a' }}>
                점수 {computeTechnicianScore(entry).toFixed(2)}
              </div>
              <button type="button" className="excel-btn" onClick={() => removeTechnicianEntry(entry.id)}>삭제</button>
            </div>
          ))}
        </div>
      </Modal>
      <AgreementLoadModal
        open={loadModalOpen}
        onClose={closeLoadModal}
        filters={loadFilters}
        setFilters={setLoadFilters}
        rootPath={loadRootPath}
        onPickRoot={handlePickRoot}
        dutyRegionOptions={dutyRegionOptions}
        rangeOptions={loadRangeOptions}
        agreementGroups={AGREEMENT_GROUPS}
        industryOptions={INDUSTRY_OPTIONS}
        items={filteredLoadItems}
        busy={loadBusy}
        error={loadError}
        onLoad={handleLoadAgreement}
        onResetFilters={resetFilters}
        onDelete={(path) => handleDeleteAgreement(path, confirm)}
        formatAmount={formatAmount}
      />
      {regionPickerOpen && (
        <div className="region-modal-backdrop" onClick={closeRegionModal}>
          <div className="region-modal" onClick={(event) => event.stopPropagation()}>
            <div className="region-modal-header">
              <div>
                <h3>의무지역 선택</h3>
                <p>의무지역을 선택하고 지분을 입력해 주세요.</p>
              </div>
              <button type="button" className="region-modal-close" onClick={closeRegionModal}>×</button>
            </div>
            <div className="region-modal-search">
              <input
                className="input"
                value={regionFilter}
                onChange={handleRegionFilterChange}
                placeholder="지역명 검색"
              />
              <div className="region-modal-actions">
                {safeDutyRegions.length > 0 && (
                  <button type="button" className="excel-btn" onClick={handleDutyRegionsClear}>선택 초기화</button>
                )}
                <button type="button" className="excel-btn primary" onClick={closeRegionModal}>선택 완료</button>
              </div>
            </div>
            <div className="region-modal-list">
              {filteredRegionOptions.length === 0 && (
                <div className="region-panel-empty">검색 결과가 없습니다.</div>
              )}
              {filteredRegionOptions.map((region) => (
                <label key={region}>
                  <input
                    type="checkbox"
                    checked={safeDutyRegions.includes(region)}
                    onChange={() => handleDutyRegionToggle(region)}
                  />
                  <span>{region}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (inlineMode) {
    if (!open) return null;
    return boardMarkup;
  }

  if (!open || !portalContainer) return null;
  return createPortal(boardMarkup, portalContainer);
}
