import React from 'react';
import { createPortal } from 'react-dom';
import CompanySearchModal from '../../../../components/CompanySearchModal.jsx';
import AgreementLoadModal from './AgreementLoadModal.jsx';
import TechnicianScoreWindow from './TechnicianScoreWindow.jsx';
import AgreementCandidateWindow from './AgreementCandidateWindow.jsx';
import LhAwardHistoryWindow from './LhAwardHistoryWindow.jsx';
import useAgreementBoardStorage from '../hooks/useAgreementBoardStorage.js';
import useBoardSearch from '../hooks/useBoardSearch.js';
import useBoardInlineEditing from '../hooks/useBoardInlineEditing.js';
import useTechnicianScoreWorkflow from '../hooks/useTechnicianScoreWorkflow.js';
import useLhAwardHistoryWindow from '../hooks/useLhAwardHistoryWindow.js';
import AmountInput from '../../../../components/AmountInput.jsx';
import Modal from '../../../../components/Modal.jsx';
import { useFeedback } from '../../../../components/FeedbackProvider.jsx';
import { copyDocumentStyles } from '../../../../utils/windowBridge.js';
import {
  openRegionSearch,
  subscribeRegionSearch,
} from './regionSearchStore.js';
import { isWomenOwnedCompany, getQualityBadgeText, extractManagerNames } from '../../../../utils/companyIndicators.js';
import { generateMany } from '../../../../shared/agreements/generator.js';
import { AGREEMENT_GROUPS } from '../../../../shared/navigation.js';
import { sanitizeHtml } from '../../../../shared/sanitizeHtml.js';
import { AGREEMENT_BAN_CONFIG } from '../../../../shared/agreements/banConfig.js';
import { buildAgreementExportPayload } from '../../../../shared/agreements/agreementExportPayload.js';
import {
  calculatePossibleShareRatio,
  formatPossibleShareText,
  formatPossibleShareValue,
} from '../../../../shared/agreements/calculations/possibleShare.js';
import {
  buildCandidateDrawerEntries,
  filterCandidateDrawerEntries,
} from '../../../../shared/agreements/calculations/candidateSelectors.js';
import { buildBoardMemberMeta } from '../../../../shared/agreements/calculations/boardMemberMeta.js';
import {
  buildGroupSummaryMetrics,
  computeGroupSummaries,
} from '../../../../shared/agreements/calculations/groupSummary.js';
import { buildInconMemoText } from '../../../../shared/agreements/calculations/inconMemo.js';
import {
  extractCreditGrade,
  getCandidateManagementScore as resolveCandidateManagementScore,
  isCreditScoreExpired,
} from '../../../../shared/agreements/calculations/managementScore.js';
import {
  getCandidatePerformanceAmount as resolveCandidatePerformanceAmount,
  getCandidatePerformanceAmountForCurrentRange as resolveCandidatePerformanceAmountForCurrentRange,
  PERFORMANCE_DIRECT_KEYS,
  PERFORMANCE_KEYWORDS,
} from '../../../../shared/agreements/calculations/performanceValue.js';
import {
  getCandidateSipyungAmount as resolveCandidateSipyungAmount,
  SIPYUNG_DIRECT_KEYS,
  SIPYUNG_KEYWORDS,
} from '../../../../shared/agreements/calculations/sipyungValue.js';
import {
  evaluateAgreementPerformanceScore,
  resolvePerformanceCap,
} from '../../../../shared/agreements/calculations/performanceScore.js';
import {
  TECHNICIAN_CAREER_OPTIONS,
  TECHNICIAN_GRADE_OPTIONS,
  TECHNICIAN_MANAGEMENT_OPTIONS,
  computeTechnicianScore,
  formatTechnicianScore,
} from '../../../../shared/agreements/calculations/technicianScore.js';
import { runAgreementCandidateScoreEvaluation } from '../../../../shared/agreements/runner/candidateScoreRunner.js';
import { evaluateSingleBidEligibility } from '../../../../shared/agreements/rules/singleBidEligibility.js';
import {
  getLhAwardHistoryText,
  hasRecentLhAwardHistory,
} from '../../../../shared/agreements/lhAwardHistory.js';
import {
  applyDropToAssignments,
  buildBoardMoveConfirmPayload,
  buildCandidatePlacementNotice,
  createPendingMoveSource,
  placeEntryInAssignments,
  placeEntryOnBoard,
  resetSlotInMatrix,
  shouldResetPendingMove,
  swapOrMoveBoardEntries,
} from '../../../../shared/agreements/placement/boardPlacement.js';

const DEFAULT_GROUP_SIZE = 5;
const MIN_GROUPS = 4;
const BID_SCORE_DEFAULT = 65;
const LH_50_TO_100_BID_SCORE = 45;
const LH_50_TO_100_SUBCONTRACT_SCORE = 10;
const LH_50_TO_100_MATERIAL_SCORE = 10;
const EX_50_TO_100_BID_SCORE = 45;
const KRAIL_50_TO_100_BID_SCORE = 45;
const KRAIL_50_TO_100_SUBCONTRACT_MATERIAL_SCORE = 20;
const EX_50_TO_100_SUBCONTRACT_SCORE = 20;
const MOIS_50_TO_100_BID_SCORE = 45;
const MOIS_50_TO_100_SUBCONTRACT_SCORE = 10;
const MOIS_50_TO_100_MATERIAL_SCORE = 10;
const SUBCONTRACT_SCORE = 5;
const MANAGEMENT_SCORE_MAX = 15;
const CONSTRUCTION_EXPERIENCE_SCORE_MAX = 15;
const KRAIL_TECHNICIAN_ABILITY_MAX = 5;
const PERFORMANCE_DEFAULT_MAX = 13;
const PERFORMANCE_MOIS_DEFAULT_MAX = 15;
const PERFORMANCE_CAP_VERSION = 2;
const MANAGEMENT_SCORE_VERSION = 3;
const LH_QUALITY_DEFAULT_UNDER_100B = 85;
const LH_QUALITY_DEFAULT_OVER_100B = 88;
const LH_SIMPLE_PERFORMANCE_COEFFICIENT = 3;
const LH_SIMPLE_REGION_ADJUSTMENT_COEFFICIENT = 1;
const LH_UNDER_50_KEY = 'lh-under50';
const LH_50_TO_100_KEY = 'lh-50to100';
const LH_100_TO_300_KEY = 'lh-100to300';
const PPS_UNDER_50_KEY = 'pps-under50';
const MOIS_UNDER_30_KEY = 'mois-under30';
const MOIS_30_TO_50_KEY = 'mois-30to50';
const MOIS_50_TO_100_KEY = 'mois-50to100';
const KRAIL_UNDER_50_KEY = 'krail-under50';
const KRAIL_50_TO_100_KEY = 'krail-50to100';
const EX_UNDER_50_KEY = 'ex-under50';
const EX_50_TO_100_KEY = 'ex-50to100';
const KOREAN_UNIT = 100000000;
const LH_FULL_SCORE = 95;
const PPS_FULL_SCORE = 95;
const INDUSTRY_OPTIONS = ['전기', '통신', '소방'];
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
  share: 56,
  status: 42,
  management: 46,
  managementBonus: 50,
  shareTotal: 52,
  qualityPoints: 42,
  constructionExperience: 70,
  performanceCell: 64,
  performanceSummary: 42,
  performanceCoefficient: 50,
  technicianCell: 90,
  technicianSummary: 55,
  technicianAbilitySummary: 55,
  credibilityCell: 45,
  credibility: 40,
  bid: 32,
  subcontract: 55,
  material: 55,
  netCostBonus: 55,
  total: 55,
  sipyungCell: 90,
  sipyungSummary: 120,
};

const getApprovalCellClassName = (value) => {
  const approval = String(value || '').trim();
  if (approval === '알림' || approval === '추가' || approval === '정정') return ' approval-info';
  if (approval === '취소' || approval === '취솔') return ' approval-cancel';
  return '';
};
const COLLAPSED_COLUMN_WIDTHS = {
  select: 24,
  order: 26,
  approval: 28,
  name: 26,
  share: 26,
  status: 20,
  management: 24,
  managementBonus: 26,
  shareTotal: 24,
  qualityPoints: 20,
  constructionExperience: 32,
  performanceCell: 18,
  performanceSummary: 24,
  performanceCoefficient: 24,
  technicianCell: 26,
  technicianSummary: 28,
  technicianAbilitySummary: 28,
  credibilityCell: 26,
  credibility: 20,
  bid: 28,
  subcontract: 28,
  material: 28,
  netCostBonus: 28,
  total: 28,
  sipyungCell: 26,
  sipyungSummary: 28,
};
const BOARD_ACTION_BUTTON_STYLE = { fontSize: '13px' };
const resolveOwnerPerformanceMax = (ownerId) => {
  const upper = String(ownerId || '').toUpperCase();
  if (upper === 'MOIS') return PERFORMANCE_MOIS_DEFAULT_MAX;
  if (upper === 'PPS') return PERFORMANCE_MOIS_DEFAULT_MAX;
  return PERFORMANCE_DEFAULT_MAX;
};

const resolveLhQualityDefaultByRange = (rangeLabel, rangeKey) => {
  const label = String(rangeLabel || '').trim();
  const key = String(rangeKey || '').trim().toLowerCase();
  if (key === LH_100_TO_300_KEY) return LH_QUALITY_DEFAULT_OVER_100B;
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

const resolveTemplateKey = (ownerId, rangeId, fileType) => {
  const ownerKey = String(ownerId || '').toUpperCase();
  const rangeKey = String(rangeId || '').toLowerCase();
  const normalizedType = String(fileType || '').toLowerCase();
  if (ownerKey === 'MOIS' && rangeKey === 'mois-under30') return 'mois-under30';
  if (ownerKey === 'MOIS' && rangeKey === MOIS_30_TO_50_KEY) return 'mois-30to50';
  if (ownerKey === 'MOIS' && rangeKey === MOIS_50_TO_100_KEY) return 'mois-50to100';
  if (ownerKey === 'PPS' && rangeKey === PPS_UNDER_50_KEY) return 'pps-under50';
  if (ownerKey === 'LH' && rangeKey === LH_UNDER_50_KEY) return 'lh-under50';
  if (ownerKey === 'LH' && rangeKey === LH_100_TO_300_KEY) return 'lh-100to300';
  if (ownerKey === 'LH' && rangeKey === LH_50_TO_100_KEY) {
    if (normalizedType === 'sobang') return 'lh-50to100-sobang';
    return 'lh-50to100-et';
  }
  if (ownerKey === 'KRAIL' && rangeKey === KRAIL_UNDER_50_KEY) {
    if (normalizedType === 'sobang') return 'krail-under50-sobang';
    if (normalizedType === 'eung' || normalizedType === 'tongsin') return 'krail-under50';
    return null;
  }
  if (ownerKey === 'KRAIL' && rangeKey === KRAIL_50_TO_100_KEY) {
    if (normalizedType === 'sobang') return 'krail-50to100-sobang';
    if (normalizedType === 'eung' || normalizedType === 'tongsin') return 'krail-50to100-et';
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

const hasFractionalShareValue = (value) => {
  const numeric = parseNumeric(value);
  if (numeric == null) return false;
  return Math.abs(numeric - Math.round(numeric)) > 1e-6;
};

const equalGroupSummaries = (left, right) => {
  if (left === right) return true;
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  if (left.length !== right.length) return false;
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch (error) {
    return false;
  }
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
  const epsilon = 1e-9;
  return Math.floor((numeric + epsilon) * factor) / factor;
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

const buildExportDutySummary = (regions = [], dutyRate = null, teamSize = null, { compact = false } = {}) => {
  if (!compact) return buildDutySummary(regions, dutyRate, teamSize);
  const normalizedRegions = (Array.isArray(regions) ? regions : [])
    .map((entry) => (entry ? String(entry).trim() : ''))
    .filter(Boolean);
  const regionLabel = normalizedRegions.join('/');
  const rateText = dutyRate != null ? `${Number(dutyRate)}%` : '';
  if (!regionLabel && !rateText) return '';
  return `${regionLabel}${rateText}`.trim();
};

const sanitizeCompanyName = (value) => {
  if (!value) return '';
  let result = String(value).trim();
  result = result.replace(/㈜/g, '');
  result = result.replace(/\(주\)/g, '');
  result = result.replace(/\(유\)/g, '');
  result = result.replace(/\(합\)/g, '');
  result = result.replace(/주식회사/g, '');
  result = result.replace(/\s+/g, ' ').trim();
  return result;
};

const normalizeCompanyKey = (value) => sanitizeCompanyName(value).toLowerCase();

const renderAwardHistoryMark = (active) => (active ? (
  <span
    aria-label="낙찰이력 있음"
    title="공고일 기준 1년 이내 낙찰이력 있음"
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 18,
      height: 18,
      marginLeft: 6,
      borderRadius: '999px',
      background: '#dc2626',
      color: '#ffffff',
      fontSize: 12,
      fontWeight: 800,
      lineHeight: 1,
      verticalAlign: 'middle',
      flex: '0 0 auto',
    }}
  >
    !
  </span>
) : null);

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

const normalizeManagerKey = (value) => {
  if (!value) return '';
  const token = extractManagerNameToken(value) || extractManagerNameFromText(value);
  return (token || String(value)).replace(/\s+/g, '').trim();
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

const resolveBoardConstraintRules = (rawRules) => {
  const base = rawRules && typeof rawRules === 'object' ? rawRules : {};
  const merged = {
    banSameManager: Boolean(base.banSameManager),
    banManagerPairs: Array.isArray(base.banManagerPairs) ? base.banManagerPairs.slice() : [],
    banPairs: Array.isArray(base.banPairs) ? base.banPairs.slice() : [],
  };

  const dedupePairs = (pairs, keyFn) => {
    const seen = new Set();
    const list = [];
    pairs.forEach((pair) => {
      const key = keyFn(pair);
      if (!key || seen.has(key)) return;
      seen.add(key);
      list.push(pair);
    });
    return list;
  };

  merged.banManagerPairs = dedupePairs(
    merged.banManagerPairs.filter((pair) => Array.isArray(pair) && pair.length >= 2),
    (pair) => `${normalizeManagerKey(pair[0])}:${normalizeManagerKey(pair[1])}`,
  );
  merged.banPairs = dedupePairs(
    merged.banPairs.filter((pair) => Array.isArray(pair) && pair.length >= 2),
    (pair) => {
      const left = pair[0] || {};
      const right = pair[1] || {};
      const leftKey = `${normalizeBizNo(left.bizNo)}|${normalizeCompanyKey(left.name)}|${left.entityType || left.type || ''}`;
      const rightKey = `${normalizeBizNo(right.bizNo)}|${normalizeCompanyKey(right.name)}|${right.entityType || right.type || ''}`;
      return `${leftKey}::${rightKey}`;
    },
  );

  return merged;
};

const SHARE_DIRECT_KEYS = ['_share', '_pct', 'candidateShare', 'share', '지분', '기본지분'];
const SHARE_KEYWORDS = [['지분', 'share', '비율']];

const getCandidateNumericValue = (candidate, directKeys = [], keywordGroups = []) => {
  if (!candidate || typeof candidate !== 'object') return null;
  const value = extractAmountValue(candidate, directKeys, keywordGroups);
  const parsed = toNumber(value);
  return parsed;
};

const getCandidateSipyungAmount = (candidate) => resolveCandidateSipyungAmount(candidate, {
  toNumber,
  extractAmountValue,
});

const getCandidateCreditGrade = (candidate) => extractCreditGrade(candidate);

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

const BIZ_YEARS_DATE_PATTERN = /(\d{2,4})[^0-9]{0,3}(\d{1,2})[^0-9]{0,3}(\d{1,2})/;
const BIZ_YEARS_MS_PER_DAY = 24 * 60 * 60 * 1000;
const BIZ_YEARS_MS_PER_YEAR = 365.2425 * BIZ_YEARS_MS_PER_DAY;
const BIZ_YEARS_EXCEL_EPOCH = new Date(Date.UTC(1899, 11, 30));

const isValidDateValue = (value) => value instanceof Date && !Number.isNaN(value.getTime());

const parseDateLikeForBizYears = (raw) => {
  if (!raw && raw !== 0) return null;
  if (raw instanceof Date) return isValidDateValue(raw) ? raw : null;

  if (typeof raw === 'number') {
    if (raw > 1000) {
      const milliseconds = Math.round(raw * BIZ_YEARS_MS_PER_DAY);
      const date = new Date(BIZ_YEARS_EXCEL_EPOCH.getTime() + milliseconds);
      if (isValidDateValue(date)) return date;
    }
    return null;
  }

  const text = String(raw || '').trim();
  if (!text) return null;

  const match = text.match(BIZ_YEARS_DATE_PATTERN);
  if (match) {
    let year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
      if (year < 100) year += year >= 70 ? 1900 : 2000;
      const date = new Date(year, month - 1, day);
      if (isValidDateValue(date)) return date;
    }
  }

  const digitsOnly = text.replace(/[^0-9]/g, '');
  if (digitsOnly.length === 8) {
    const year = Number(digitsOnly.slice(0, 4));
    const month = Number(digitsOnly.slice(4, 6));
    const day = Number(digitsOnly.slice(6, 8));
    if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
      const date = new Date(year, month - 1, day);
      if (isValidDateValue(date)) return date;
    }
  }
  return null;
};

const parseBizYearsFromText = (value) => {
  const text = String(value || '').trim();
  if (!text) return null;
  const yearMonthMatch = text.match(/(\d+(?:\.\d+)?)\s*년\s*(\d+(?:\.\d+)?)?\s*개월?/);
  if (yearMonthMatch) {
    const yearsPart = Number(yearMonthMatch[1]);
    const monthsPart = yearMonthMatch[2] != null ? Number(yearMonthMatch[2]) : 0;
    const total = (Number.isFinite(yearsPart) ? yearsPart : 0) + (Number.isFinite(monthsPart) ? monthsPart / 12 : 0);
    if (Number.isFinite(total) && total > 0) return Number(total.toFixed(4));
  }
  const monthsOnlyMatch = text.match(/(\d+(?:\.\d+)?)\s*개월/);
  if (monthsOnlyMatch) {
    const months = Number(monthsOnlyMatch[1]);
    if (Number.isFinite(months) && months > 0) return Number((months / 12).toFixed(4));
  }
  return null;
};

const resolveCandidateBizYears = (candidate, evaluationDateRaw) => {
  const rawValue = extractAmountValue(
    candidate,
    ['bizYears', '영업기간', '설립연수', '업력'],
    [['영업기간', '업력', 'bizyears']],
  );
  if (rawValue === null || rawValue === undefined || rawValue === '') return null;

  const evaluationDate = parseDateLikeForBizYears(evaluationDateRaw) || new Date();
  evaluationDate.setHours(0, 0, 0, 0);

  const startDate = parseDateLikeForBizYears(rawValue);
  if (startDate) {
    const base = evaluationDate.getTime();
    const diff = base - startDate.getTime();
    const years = diff > 0 ? (diff / BIZ_YEARS_MS_PER_YEAR) : 0;
    return Number.isFinite(years) ? Number(years.toFixed(4)) : 0;
  }

  if (typeof rawValue === 'number' && Number.isFinite(rawValue) && rawValue > 0 && rawValue <= 200) {
    return Number(rawValue.toFixed(4));
  }

  const fromText = parseBizYearsFromText(rawValue);
  if (fromText != null) return fromText;

  const numeric = toNumber(rawValue);
  if (Number.isFinite(numeric) && numeric > 0 && numeric <= 200) {
    return Number(numeric.toFixed(4));
  }
  return null;
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

const clampScore = (value, max = MANAGEMENT_SCORE_MAX) => {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  if (number < 0) return 0;
  if (number > max) return max;
  return number;
};

const resolveConstructionExperienceScore = (performanceScore, qualityPoints) => {
  const performanceValue = toNumber(performanceScore);
  if (performanceValue == null) return null;
  const qualityValue = toNumber(qualityPoints);
  return clampScore(
    performanceValue + (qualityValue == null ? 0 : qualityValue),
    CONSTRUCTION_EXPERIENCE_SCORE_MAX,
  );
};

const getCandidateManagementScore = (candidate) => resolveCandidateManagementScore(candidate, {
  toNumber,
  clampScore,
  managementScoreMax: MANAGEMENT_SCORE_MAX,
  managementScoreVersion: MANAGEMENT_SCORE_VERSION,
  preferCurrentEvaluation: true,
});

const getCandidatePerformanceAmount = (candidate) => resolveCandidatePerformanceAmount(candidate, {
  toNumber,
  extractAmountValue,
});


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

const resolveSummaryStatusFromMap = (statusMap) => {
  if (!statusMap || typeof statusMap !== 'object') return '';
  const keyStatuses = [
    statusMap['시평'],
    statusMap['3년 실적'],
    statusMap['5년 실적'],
  ].filter((value) => value !== undefined && value !== null && value !== '');
  if (keyStatuses.length === 0) return '';
  const normalized = keyStatuses.map((value) => String(value));
  if (normalized.some((value) => value.includes('1년 이상 경과'))) return '1년 이상 경과';
  if (normalized.some((value) => value.includes('1년 경과'))) return '1년 경과';
  if (normalized.every((value) => value === '최신')) return '최신';
  return '미지정';
};

const getCandidateSummaryStatus = (candidate) => {
  if (!candidate || typeof candidate !== 'object') return '';
  const direct = extractValue(candidate, ['요약상태', 'summaryStatus', 'summaryState'])
    || extractValue(candidate.snapshot, ['요약상태', 'summaryStatus', 'summaryState']);
  if (direct) return String(direct);
  const maps = [
    candidate.dataStatus,
    candidate['데이터상태'],
    candidate.snapshot?.dataStatus,
    candidate.snapshot?.['데이터상태'],
  ].filter((value) => value && typeof value === 'object');
  for (const statusMap of maps) {
    const summary = resolveSummaryStatusFromMap(statusMap);
    if (summary) return summary;
  }
  return '';
};

const stripAgreementAmountOverrides = (candidate) => {
  if (!candidate || typeof candidate !== 'object') return candidate;
  const next = { ...candidate };
  delete next._agreementSipyungAmount;
  delete next._agreementSipyungInput;
  delete next._agreementSipyungCleared;
  delete next._agreementPerformance5y;
  delete next._agreementPerformanceInput;
  delete next._agreementPerformanceCleared;
  delete next._agreementPerformanceScore;
  delete next._agreementPerformanceMax;
  delete next._agreementPerformanceCapVersion;
  delete next._agreementManagementInput;
  delete next._agreementManagementManual;
  delete next._agreementManagementScore;
  delete next._agreementManagementScoreVersion;
  return next;
};

const CANDIDATE_POOL_FLAG = '_agreementCandidateListed';

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
const buildBoardSearchKey = (groupIndex, slotIndex) => `${groupIndex}:${slotIndex}`;

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
  netCostBonusOverride = '',
  performanceCoefficient = '',
  regionAdjustmentCoefficient = '',
  bidDeadline = '',
  regionDutyRate = '',
  participantLimit = DEFAULT_GROUP_SIZE,
  netCostAmount = '',
  aValue = '',
  memoHtml = '',
  inlineMode = false,
}) {
  const [headerCollapsed, setHeaderCollapsed] = React.useState(() => {
    try {
      return window.localStorage.getItem('agreementHeaderCollapsed') === '1';
    } catch {
      return false;
    }
  });

  React.useEffect(() => {
    try {
      window.localStorage.setItem('agreementHeaderCollapsed', headerCollapsed ? '1' : '0');
    } catch {}
  }, [headerCollapsed]);
  const rangeId = _rangeId;
  const boardWindowRef = React.useRef(null);
  const candidateWindowRef = React.useRef(null);
  const [portalContainer, setPortalContainer] = React.useState(null);
  const [candidatePortalContainer, setCandidatePortalContainer] = React.useState(null);
  const [groupAssignments, setGroupAssignments] = React.useState(() => (
    Array.isArray(initialGroupAssignments) ? initialGroupAssignments.map((row) => (Array.isArray(row) ? row.slice() : [])) : []
  ));
  const [draggingId, setDraggingId] = React.useState(null);
  const [dropTarget, setDropTarget] = React.useState(null);
  const [dragSource, setDragSource] = React.useState(null);
  const [pendingMoveSource, setPendingMoveSource] = React.useState(null);
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
  const [candidateWindowOpen, setCandidateWindowOpen] = React.useState(false);
  const [awardHistoryWindowOpen, setAwardHistoryWindowOpen] = React.useState(false);
  const [candidateDrawerQuery, setCandidateDrawerQuery] = React.useState('');
  const [candidateSearchOpen, setCandidateSearchOpen] = React.useState(false);
  const [selectedCandidateUid, setSelectedCandidateUid] = React.useState(null);
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
  const [exportModalOpen, setExportModalOpen] = React.useState(false);
  const {
    portalContainer: awardHistoryPortalContainer,
    closeWindow: closeAwardHistoryWindow,
  } = useLhAwardHistoryWindow({
    open: open && awardHistoryWindowOpen,
    setOpen: setAwardHistoryWindowOpen,
    sourceDocument: typeof document !== 'undefined' ? document : null,
  });
  const [exportTargetPath, setExportTargetPath] = React.useState('');
  const [exportTargetName, setExportTargetName] = React.useState('');
  const [exportSheetName, setExportSheetName] = React.useState('');
  const exportFileInputRef = React.useRef(null);
  const regionSearchSessionRef = React.useRef(null);
  const [technicianModalOpen, setTechnicianModalOpen] = React.useState(false);
  const technicianWindowRef = React.useRef(null);
  const [technicianPortalContainer, setTechnicianPortalContainer] = React.useState(null);
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
    approval: true,
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
  const ownerLabel = selectedGroup?.label || '';
  const rangeOptions = React.useMemo(() => selectedGroup?.items || [], [selectedGroup]);
  const selectedRangeOption = React.useMemo(() => (
    rangeOptions.find((item) => item.key === rangeId) || rangeOptions[0] || null
  ), [rangeId, rangeOptions]);
  const selectedRangeKey = selectedRangeOption?.key || '';
  const isLh100To300 = isLHOwner && selectedRangeKey === LH_100_TO_300_KEY;
  const isMois30To50 = isMoisOwner && selectedRangeKey === MOIS_30_TO_50_KEY;
  const isMois50To100 = isMoisOwner && selectedRangeKey === MOIS_50_TO_100_KEY;
  const isMoisUnderOr30To50 = isMoisOwner && (selectedRangeKey === MOIS_UNDER_30_KEY || selectedRangeKey === MOIS_30_TO_50_KEY);
  const isPpsUnder50 = ownerKeyUpper === 'PPS' && selectedRangeKey === PPS_UNDER_50_KEY;
  const isKrailUnder50 = ownerKeyUpper === 'KRAIL' && selectedRangeKey === KRAIL_UNDER_50_KEY;
  const isKrail50To100 = ownerKeyUpper === 'KRAIL' && selectedRangeKey === KRAIL_50_TO_100_KEY;
  const isLh50To100 = isLHOwner && selectedRangeKey === LH_50_TO_100_KEY;
  const isExUnder50 = isExOwner && selectedRangeKey === EX_UNDER_50_KEY;
  const isEx50To100 = isExOwner && selectedRangeKey === EX_50_TO_100_KEY;
  const showManagementBonus = !isLh100To300;
  const showNetCostBonus = !isLh100To300;
  const showBidScore = !isLh100To300;
  const showMiscScore = isLh100To300;
  const showConstructionExperience = isLHOwner && !isLh100To300;
  const placeCredibilityAfterQuality = isLh100To300;
  const effectiveGroupManagementBonus = showManagementBonus ? groupManagementBonus : [];
  const technicianEnabled = isKrailOwner;
  const technicianEditable = technicianEnabled && String(fileType || '').toLowerCase() !== 'sobang';
  const technicianAbilityMax = technicianEnabled ? KRAIL_TECHNICIAN_ABILITY_MAX : null;
  React.useEffect(() => {
    if (!isKrailOwner) return;
    setCollapsedColumns((prev) => {
      if (!prev.technicianSummary && !prev.technicianAbility) return prev;
      return {
        ...prev,
        technicianSummary: false,
        technicianAbility: false,
      };
    });
  }, [isKrailOwner]);
  const managementScale = isMois30To50 ? (10 / 15) : 1;
  const performanceAmountLabel = isMois50To100 ? '3년 실적' : '5년 실적';
  const getCandidatePerformanceAmountForCurrentRange = React.useCallback((candidate) => {
    return resolveCandidatePerformanceAmountForCurrentRange(candidate, {
      isMois50To100,
      toNumber,
      extractAmountValue,
      getCandidatePerformanceAmount: resolveCandidatePerformanceAmount,
    });
  }, [isMois50To100]);
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
      if (kind === 'material') return 0;
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
    if (!date) {
      if (typeof onUpdateBoard === 'function') onUpdateBoard({ bidDeadline: '' });
      return;
    }
    if (hour === '' || minute === '') return;
    if (String(hour).length > 2) return;
    if (String(minute).length < 2) return;
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
  }, []);

  const handleBidMinuteChange = React.useCallback((event) => {
    const nextMinute = String(event.target.value || '').replace(/\D/g, '').slice(0, 2);
    setBidMinuteInput(nextMinute);
  }, []);

  const commitBidTimeInputs = React.useCallback(() => {
    const normalizedHour = String(bidHourInput || '').replace(/\D/g, '').slice(0, 2);
    const rawMinute = String(bidMinuteInput || '').replace(/\D/g, '').slice(0, 2);
    const normalizedMinute = rawMinute.length === 1 ? `0${rawMinute}` : rawMinute;
    if (normalizedHour !== bidHourInput) setBidHourInput(normalizedHour);
    if (normalizedMinute !== bidMinuteInput) setBidMinuteInput(normalizedMinute);
    updateBidDeadlineFromParts(bidDatePart, bidTimePeriod, normalizedHour, normalizedMinute);
  }, [bidDatePart, bidHourInput, bidMinuteInput, bidTimePeriod, updateBidDeadlineFromParts]);

  const handleBaseAmountChange = React.useCallback((value) => {
    // Any direct edit (including clear) means user is overriding auto-base.
    setBaseTouched(true);
    if (typeof onUpdateBoard === 'function') onUpdateBoard({ baseAmount: value });
  }, [onUpdateBoard]);

  const handleEstimatedAmountChange = React.useCallback((value) => {
    // Re-enable auto-base calculation when estimated amount is edited again.
    setBaseTouched(false);
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

  const handleAdjustmentRateChange = React.useCallback((event) => {
    const nextValue = event.target.value;
    setAdjustmentRateTouched(Boolean(String(nextValue || '').trim()));
    if (typeof onUpdateBoard === 'function') onUpdateBoard({ adjustmentRate: nextValue });
  }, [onUpdateBoard]);

  const handleNetCostBonusOverrideChange = React.useCallback((event) => {
    if (typeof onUpdateBoard !== 'function') return;
    const nextValue = String(event.target.value || '').replace(/[^0-9.]/g, '');
    if ((nextValue.match(/\./g) || []).length > 1) return;
    onUpdateBoard({ netCostBonusOverride: nextValue });
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
    if (ownerKeyUpper === 'LH') return { enabled: true, max: isLh100To300 ? 0.3 : null };
    if (ownerKeyUpper === 'PPS') return { enabled: true, max: null };
    if (ownerKeyUpper === 'KRAIL') return { enabled: true, max: null };
    if (ownerKeyUpper === 'EX') return { enabled: true, max: null };
    return { enabled: false, max: null };
  }, [isLh100To300, ownerKeyUpper]);
  const credibilityEnabled = credibilityConfig.enabled;
  const ownerCredibilityMax = credibilityConfig.max;
  const showCredibilityBeforeStatus = credibilityEnabled && !placeCredibilityAfterQuality;
  const showCredibilityAfterQuality = credibilityEnabled && placeCredibilityAfterQuality;
  const showCredibilitySlots = credibilityEnabled && !isLh100To300;
  const credibilityLabel = isLh100To300 ? '지역경제 기여도' : '신인도';
  const ownerPerformanceFallback = React.useMemo(() => {
    if (isLh100To300) return 11;
    if (isKrailUnder50) {
      const normalizedType = String(fileType || '').toLowerCase();
      if (normalizedType === 'sobang') return 15;
      return 10;
    }
    if (isKrail50To100) return 15;
    return resolveOwnerPerformanceMax(ownerKeyUpper);
  }, [fileType, isKrail50To100, isKrailUnder50, isLh100To300, ownerKeyUpper]);
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
    notify({ type: 'info', message, portalTarget: portalContainer || null });
  }, [notify, portalContainer]);

  const lhSimplePerformanceCoefficient = isLh100To300
    ? LH_SIMPLE_PERFORMANCE_COEFFICIENT
    : null;

  const lhRegionalAdjustmentCoefficient = isLh100To300
    ? LH_SIMPLE_REGION_ADJUSTMENT_COEFFICIENT
    : null;

  const possibleShareBase = React.useMemo(() => {
    const sources = ownerKeyUpper === 'LH'
      ? [ratioBaseAmount]
      : [editableBidAmount, bidAmount];
    for (const source of sources) {
      const parsed = parseAmountValue(source);
      if (parsed !== null && parsed > 0) return parsed;
    }
    if (ownerKeyUpper === 'MOIS' && (selectedRangeKey === MOIS_30_TO_50_KEY || selectedRangeKey === MOIS_50_TO_100_KEY)) {
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
      if (rangeKey === LH_100_TO_300_KEY) {
        const multiplier = lhSimplePerformanceCoefficient || 3;
        return base > 0
          ? { perfectPerformanceAmount: base * multiplier, perfectPerformanceBasis: `기초금액 × ${multiplier}배` }
          : { perfectPerformanceAmount: 0, perfectPerformanceBasis: '' };
      }
      if (rangeKey === 'lh-50to100') {
        const normalizedType = String(fileType || '').toLowerCase();
        const multiplier = normalizedType === 'sobang' ? 3 : 2;
        return base > 0
          ? { perfectPerformanceAmount: base * multiplier, perfectPerformanceBasis: `기초금액 × ${multiplier}배` }
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

    if (ownerKeyUpper === 'KRAIL' && rangeKey === KRAIL_50_TO_100_KEY) {
      if (base <= 0) return { perfectPerformanceAmount: 0, perfectPerformanceBasis: '' };
      const normalizedType = String(fileType || '').toLowerCase();
      const multiplier = normalizedType === 'sobang' ? 3 : 2;
      return { perfectPerformanceAmount: base * multiplier, perfectPerformanceBasis: `기초금액 × ${multiplier}배` };
    }

    if (ownerKeyUpper === 'EX' && rangeKey === EX_UNDER_50_KEY) {
      return base > 0
        ? { perfectPerformanceAmount: base, perfectPerformanceBasis: '기초금액 × 1배' }
        : { perfectPerformanceAmount: 0, perfectPerformanceBasis: '' };
    }

    return { perfectPerformanceAmount: 0, perfectPerformanceBasis: '' };
  }, [ownerKeyUpper, selectedRangeOption?.key, estimatedAmount, baseAmount, fileType, lhSimplePerformanceCoefficient]);

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
    performanceCoefficient: isLh100To300 ? String(LH_SIMPLE_PERFORMANCE_COEFFICIENT) : performanceCoefficient,
    regionAdjustmentCoefficient: isLh100To300 ? String(LH_SIMPLE_REGION_ADJUSTMENT_COEFFICIENT) : regionAdjustmentCoefficient,
    perfectPerformanceAmount,
    perfectPerformanceBasis,
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
    isLh100To300,
    performanceCoefficient,
    regionAdjustmentCoefficient,
    perfectPerformanceAmount,
    perfectPerformanceBasis,
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
    // Keep the opened region-search popup stable; changes apply on reopen/re-search.
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
    if (rangeKey === LH_100_TO_300_KEY) {
      if (qualityTotal >= 94) return 4;
      if (qualityTotal >= 91) return 3.9;
      if (qualityTotal >= 88) return 3.8;
      if (qualityTotal >= 85) return 3.7;
      return 3.6;
    }
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
    rangeKey === LH_100_TO_300_KEY ? 4 : (rangeKey === LH_50_TO_100_KEY ? 5 : 3)
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
    if (rangeKey === LH_50_TO_100_KEY && expectedMax >= 10000000000) return 0;
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
        ? 50 - (2 * Math.abs((0.9 - ratio) * 100))
        : 70 - (4 * Math.abs((0.9 - ratio) * 100))
    );
    const baseline = rangeKey === LH_50_TO_100_KEY ? 45 : 65;
    const bonusMin = priceScore(rMin) - baseline;
    const bonusMax = priceScore(rMax) - baseline;
    const conservative = Math.min(bonusMin, bonusMax);
    if (!(conservative > 0)) return 0;
    const truncated = truncateScore(conservative, 2);
    return truncated != null ? clampScore(truncated, 999) : 0;
  }, [isLHOwner, selectedRangeOption?.key, baseAmount, netCostAmount, aValue]);

  const netCostBonusNotice = React.useMemo(() => {
    if (!isLHOwner) return '';
    const rangeKey = selectedRangeOption?.key;
    if (rangeKey !== LH_50_TO_100_KEY) return '';
    const base = toNumber(baseAmount);
    const netCost = toNumber(netCostAmount);
    if (!base || !netCost) return '';
    const expectedMax = roundUpThousand(base * 1.012);
    if (!expectedMax) return '';
    if (expectedMax >= 10000000000) return '예정가격 100억 초과로 순공사원가 적용 안됨';
    return '';
  }, [isLHOwner, selectedRangeOption?.key, baseAmount, netCostAmount]);

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
    if (rangeKey === LH_50_TO_100_KEY && expectedMax >= 10000000000) return false;
    if (expectedMin <= aValueNumber || expectedMax <= aValueNumber) return false;
    const bidMin = netCost * (expectedMin / base) * 0.98;
    const bidMax = netCost * (expectedMax / base) * 0.98;
    const rMin = roundTo((bidMin - aValueNumber) / (expectedMin - aValueNumber), 4);
    const rMax = roundTo((bidMax - aValueNumber) / (expectedMax - aValueNumber), 4);
    return Number.isFinite(rMin) && Number.isFinite(rMax) && (rMin > 0.9 || rMax > 0.9);
  }, [isLHOwner, selectedRangeOption?.key, baseAmount, netCostAmount, aValue]);
  const effectiveNetCostBonusScore = React.useMemo(() => {
    const manualValue = parseNumeric(netCostBonusOverride);
    if (manualValue != null && showNetCostBonus) return manualValue;
    if (!showNetCostBonus) return 0;
    return netCostBonusScore;
  }, [showNetCostBonus, parseNumeric, netCostBonusOverride, netCostBonusScore]);

  React.useEffect(() => {
    if (!minRatingOpen) return;
    setMinRatingNetCostBonus(formatScore(effectiveNetCostBonusScore, 2));
  }, [minRatingOpen, effectiveNetCostBonusScore]);

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

  const agreementConstraintRules = React.useMemo(
    () => resolveBoardConstraintRules(AGREEMENT_BAN_CONFIG),
    [],
  );
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

  const constructionExperienceColWidth = isLHOwner ? 42 : COLUMN_WIDTHS.constructionExperience;
  const subcontractColWidth = isLh50To100 ? 26 : COLUMN_WIDTHS.subcontract;
  const materialColWidth = isLh50To100 ? 26 : COLUMN_WIDTHS.material;
  const netCostBonusColWidth = isLHOwner ? 42 : COLUMN_WIDTHS.netCostBonus;

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

  const columnSpans = React.useMemo(() => {
    const nameSpan = collapsedColumns.name ? 1 : slotLabels.length;
    const shareSpan = collapsedColumns.share ? 1 : slotLabels.length;
    const credibilitySpan = showCredibilitySlots ? (collapsedColumns.credibility ? 1 : slotLabels.length) : 0;
    const statusSpan = collapsedColumns.status ? 1 : slotLabels.length;
    const performanceSpan = collapsedColumns.performance ? 1 : slotLabels.length;
    const technicianSpan = technicianEnabled ? (collapsedColumns.technician ? 1 : slotLabels.length) : 0;
    const sipyungSpan = collapsedColumns.sipyung ? 1 : slotLabels.length;
    return {
      nameSpan,
      shareSpan,
      credibilitySpan,
      statusSpan,
      performanceSpan,
      technicianSpan,
      sipyungSpan,
    };
  }, [collapsedColumns, slotLabels.length, showCredibilitySlots, technicianEnabled]);

  const tableMinWidth = React.useMemo(() => {
    const nameWidth = columnSpans.nameSpan * (collapsedColumns.name ? COLLAPSED_COLUMN_WIDTHS.name : COLUMN_WIDTHS.name);
    const shareWidth = columnSpans.shareSpan * (collapsedColumns.share ? COLLAPSED_COLUMN_WIDTHS.share : COLUMN_WIDTHS.share);
    const credibilityWidth = showCredibilitySlots
      ? columnSpans.credibilitySpan * (collapsedColumns.credibility ? COLLAPSED_COLUMN_WIDTHS.credibilityCell : COLUMN_WIDTHS.credibilityCell)
      : 0;
    const statusWidth = columnSpans.statusSpan * (collapsedColumns.status ? COLLAPSED_COLUMN_WIDTHS.status : COLUMN_WIDTHS.status);
    const perfCellsWidth = columnSpans.performanceSpan * (collapsedColumns.performance ? COLLAPSED_COLUMN_WIDTHS.performanceCell : COLUMN_WIDTHS.performanceCell);
    const technicianCellsWidth = technicianEnabled
      ? columnSpans.technicianSpan * (collapsedColumns.technician ? COLLAPSED_COLUMN_WIDTHS.technicianCell : COLUMN_WIDTHS.technicianCell)
      : 0;
    const sipyungCellsWidth = columnSpans.sipyungSpan * (collapsedColumns.sipyung ? COLLAPSED_COLUMN_WIDTHS.sipyungCell : COLUMN_WIDTHS.sipyungCell);
    const base = (collapsedColumns.order ? COLLAPSED_COLUMN_WIDTHS.order : COLUMN_WIDTHS.order)
      + (collapsedColumns.select ? COLLAPSED_COLUMN_WIDTHS.select : COLUMN_WIDTHS.select)
      + (collapsedColumns.approval ? COLLAPSED_COLUMN_WIDTHS.approval : COLUMN_WIDTHS.approval)
      + COLUMN_WIDTHS.management
      + (showManagementBonus
        ? (collapsedColumns.managementBonus ? COLLAPSED_COLUMN_WIDTHS.managementBonus : COLUMN_WIDTHS.managementBonus)
        : 0)
      + COLUMN_WIDTHS.shareTotal
      + (isLHOwner ? COLUMN_WIDTHS.qualityPoints : 0)
      + (showConstructionExperience ? constructionExperienceColWidth : 0)
      + (credibilityEnabled ? COLUMN_WIDTHS.credibility : 0)
      + COLUMN_WIDTHS.performanceSummary
      + (isLh100To300 ? COLUMN_WIDTHS.performanceCoefficient : 0)
      + (technicianEnabled
        ? (collapsedColumns.technicianSummary ? COLLAPSED_COLUMN_WIDTHS.technicianSummary : COLUMN_WIDTHS.technicianSummary)
          + (collapsedColumns.technicianAbility ? COLLAPSED_COLUMN_WIDTHS.technicianAbilitySummary : COLUMN_WIDTHS.technicianAbilitySummary)
        : 0)
      + ((isMois30To50 || isEx50To100 || isKrail50To100)
        ? (collapsedColumns.subcontract ? COLLAPSED_COLUMN_WIDTHS.subcontract : subcontractColWidth)
        : 0)
      + (isLh50To100 ? (subcontractColWidth + materialColWidth) : 0)
      + (showBidScore ? COLUMN_WIDTHS.bid : 0)
      + (showNetCostBonus ? netCostBonusColWidth : 0)
      + COLUMN_WIDTHS.total
      + COLUMN_WIDTHS.sipyungSummary;
    const total = base + nameWidth + shareWidth + credibilityWidth + statusWidth
      + perfCellsWidth + technicianCellsWidth + sipyungCellsWidth;
    return Math.max(1200, total);
  }, [
    columnSpans,
    showCredibilitySlots,
    constructionExperienceColWidth,
    subcontractColWidth,
    materialColWidth,
    netCostBonusColWidth,
    isLHOwner,
    showManagementBonus,
    showBidScore,
    showConstructionExperience,
    showNetCostBonus,
    isMois30To50,
    isEx50To100,
    isKrail50To100,
    isLh50To100,
    technicianEnabled,
    collapsedColumns,
  ]);

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
      const constructionExperienceScore = resolveConstructionExperienceScore(performanceMax, qualityPoints) || 0;
      const totalScore = roundForLhTotals(
        managementScore
          + constructionExperienceScore
          + BID_SCORE_DEFAULT
          + (netCostBonusValue || 0)
          + credibilityBonus
      ) || 0;
      if (totalScore >= (LH_FULL_SCORE - 1e-6)) {
        best = {
          possibleShare,
          effectiveShare,
          managementScore,
          qualityTotal,
          qualityPoints,
          constructionExperienceScore,
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
      return { bidRate: '88.745', adjustmentRate: '101.6', baseMultiplier: 1.1 };
    }
    if (ownerKeyUpper === 'MOIS' && selectedRangeOption?.key === MOIS_30_TO_50_KEY) {
      return { bidRate: '88.745', adjustmentRate: '101.6', baseMultiplier: 1.1 };
    }
    if (ownerKeyUpper === 'MOIS' && selectedRangeOption?.key === MOIS_50_TO_100_KEY) {
      return { bidRate: '87.495', adjustmentRate: '101.6', baseMultiplier: 1.1 };
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
    const aValueNum = parseAmountValue(aValue) || 0;
    const expectedPrice = base && base > 0 && Number.isFinite(adjustmentValue)
      ? (base * adjustmentValue)
      : 0;
    const autoValue = base && base > 0 && Number.isFinite(bidRateValue) && Number.isFinite(adjustmentValue)
      ? (
        (ownerKeyUpper === 'MOIS' && selectedRangeOption?.key === MOIS_50_TO_100_KEY)
          ? Math.round(((expectedPrice - aValueNum) * bidRateValue) + aValueNum)
          : Math.round(base * bidRateValue * adjustmentValue)
      )
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
  }, [bidAutoConfig, baseAmount, bidRate, adjustmentRate, editableBidAmount, bidTouched, onUpdateBoard, aValue, ownerKeyUpper, selectedRangeOption?.key]);

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

  const openCandidateSearch = React.useCallback(() => {
    if (!String(industryLabel || '').trim()) {
      showHeaderAlert('공종을 먼저 선택해 주세요.');
      return;
    }
    setCandidateSearchOpen(true);
  }, [industryLabel, showHeaderAlert]);

  const closeCandidateSearch = React.useCallback(() => {
    setCandidateSearchOpen(false);
  }, []);

  const updateCandidateOverride = React.useCallback((candidate, updates) => {
    if (!candidate || typeof candidate !== 'object') return;
    if (typeof onUpdateBoard !== 'function') return;
    const candidateId = candidate.id;
    const candidateBiz = normalizeBizNo(getBizNo(candidate));
    const candidateName = String(getCompanyName(candidate) || '').trim();
    const nextCandidates = (candidates || []).map((item) => {
      if (!item || typeof item !== 'object') return item;
      let matched = false;
      if (candidateId && item.id === candidateId) matched = true;
      if (!matched && candidateBiz) {
        const itemBiz = normalizeBizNo(getBizNo(item));
        if (itemBiz && itemBiz === candidateBiz) matched = true;
      }
      if (!matched && candidateName) {
        const itemName = String(getCompanyName(item) || '').trim();
        if (itemName && itemName === candidateName) matched = true;
      }
      return matched ? { ...item, ...updates } : item;
    });
    onUpdateBoard({ candidates: nextCandidates });
  }, [candidates, onUpdateBoard]);

  const markCandidatePoolListed = React.useCallback((target, listed = true) => {
    if (!target || typeof target !== 'object') return;
    updateCandidateOverride(target, { [CANDIDATE_POOL_FLAG]: listed });
  }, [updateCandidateOverride]);

  React.useEffect(() => {
    if (!open) {
      setRepresentativeSearchOpen(false);
      setCandidateSearchOpen(false);
      setSelectedCandidateUid(null);
    }
  }, [open]);

  const placeEntryInSlot = React.useCallback((uid, groupIndex, slotIndex) => {
    if (groupIndex == null || slotIndex == null) return;
    setGroupAssignments((prev) => placeEntryInAssignments(prev, uid, groupIndex, slotIndex, safeGroupSize));
    setGroupShares((prev) => resetSlotInMatrix(prev, groupIndex, slotIndex, ''));
    setGroupShareRawInputs((prev) => resetSlotInMatrix(prev, groupIndex, slotIndex, ''));
    setGroupTechnicianScores((prev) => resetSlotInMatrix(prev, groupIndex, slotIndex, ''));
  }, [safeGroupSize]);

  // handleRepresentativePicked defined later after participant map is ready

  const closeTechnicianWindow = React.useCallback(() => {
    const win = technicianWindowRef.current;
    if (win && !win.closed) {
      if (win.__agreementBoardCleanup) {
        try { win.__agreementBoardCleanup(); } catch {}
        delete win.__agreementBoardCleanup;
      }
      win.close();
    }
    technicianWindowRef.current = null;
    setTechnicianPortalContainer(null);
  }, []);

  const closeCandidateWindow = React.useCallback(() => {
    const win = candidateWindowRef.current;
    if (win && !win.closed) {
      if (win.__agreementBoardCleanup) {
        try { win.__agreementBoardCleanup(); } catch {}
        delete win.__agreementBoardCleanup;
      }
      win.close();
    }
    candidateWindowRef.current = null;
    setCandidatePortalContainer(null);
  }, []);

  const isRecentAwardHistoryCompany = React.useCallback((companyName, baseNoticeDate = noticeDate) => {
    if (!isLh100To300) return false;
    return hasRecentLhAwardHistory(companyName, baseNoticeDate);
  }, [isLh100To300, noticeDate]);

  const ensureTechnicianWindow = React.useCallback(() => {
    if (typeof window === 'undefined') return;
    if (!technicianModalOpen) return;
    if (technicianWindowRef.current && technicianWindowRef.current.closed) {
      technicianWindowRef.current = null;
      setTechnicianPortalContainer(null);
    }

    if (!technicianWindowRef.current) {
      const width = Math.min(920, Math.max(760, window.innerWidth - 280));
      const height = Math.min(760, Math.max(560, window.innerHeight - 220));
      const dualScreenLeft = window.screenLeft !== undefined ? window.screenLeft : window.screenX;
      const dualScreenTop = window.screenTop !== undefined ? window.screenTop : window.screenY;
      const left = Math.max(24, dualScreenLeft + Math.max(0, (window.innerWidth - width) / 2) + 80);
      const top = Math.max(32, dualScreenTop + Math.max(0, (window.innerHeight - height) / 2) + 24);
      const features = `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`;
      const child = window.open('', 'company-search-technician-score', features);
      if (!child) return;
      child.document.title = '기술자점수 계산';
      child.document.documentElement.style.height = '100%';
      child.document.documentElement.style.overflow = 'hidden';
      child.document.body.style.margin = '0';
      child.document.body.style.height = '100%';
      child.document.body.style.background = '#f8fafc';
      child.document.body.innerHTML = '';
      const root = child.document.createElement('div');
      root.id = 'technician-score-root';
      root.style.height = '100%';
      child.document.body.appendChild(root);
      copyDocumentStyles(document, child.document);
      technicianWindowRef.current = child;
      setTechnicianPortalContainer(root);
      const handleBeforeUnload = () => {
        technicianWindowRef.current = null;
        setTechnicianPortalContainer(null);
        setTechnicianModalOpen(false);
      };
      child.addEventListener('beforeunload', handleBeforeUnload);
      child.__agreementBoardCleanup = () => child.removeEventListener('beforeunload', handleBeforeUnload);
    } else {
      const win = technicianWindowRef.current;
      if (win.document && win.document.readyState === 'complete') {
        copyDocumentStyles(document, win.document);
      }
      if (!technicianPortalContainer && win.document) {
        const existingRoot = win.document.getElementById('technician-score-root');
        if (existingRoot) setTechnicianPortalContainer(existingRoot);
      }
      win.document.title = '기술자점수 계산';
      try { win.focus(); } catch {}
    }
  }, [technicianModalOpen, technicianPortalContainer]);

  const ensureCandidateWindow = React.useCallback(() => {
    if (typeof window === 'undefined') return;
    if (!candidateWindowOpen) return;
    if (candidateWindowRef.current && candidateWindowRef.current.closed) {
      candidateWindowRef.current = null;
      setCandidatePortalContainer(null);
    }

    if (!candidateWindowRef.current) {
      const width = Math.min(1080, Math.max(900, window.innerWidth - 180));
      const height = Math.min(920, Math.max(720, window.innerHeight - 80));
      const dualScreenLeft = window.screenLeft !== undefined ? window.screenLeft : window.screenX;
      const dualScreenTop = window.screenTop !== undefined ? window.screenTop : window.screenY;
      const left = Math.max(40, dualScreenLeft + window.innerWidth - width - 32);
      const top = Math.max(32, dualScreenTop + Math.max(0, (window.innerHeight - height) / 2));
      const features = `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`;
      const child = window.open('', 'company-search-agreement-candidates', features);
      if (!child) return;
      child.document.title = '후보 보관함';
      child.document.documentElement.style.height = '100%';
      child.document.documentElement.style.overflow = 'hidden';
      child.document.body.style.margin = '0';
      child.document.body.style.height = '100%';
      child.document.body.style.background = '#f8fafc';
      child.document.body.innerHTML = '';
      const root = child.document.createElement('div');
      root.id = 'agreement-candidate-root';
      root.style.height = '100%';
      child.document.body.appendChild(root);
      copyDocumentStyles(document, child.document);
      candidateWindowRef.current = child;
      setCandidatePortalContainer(root);
      const handleBeforeUnload = () => {
        candidateWindowRef.current = null;
        setCandidatePortalContainer(null);
        setCandidateWindowOpen(false);
      };
      child.addEventListener('beforeunload', handleBeforeUnload);
      child.__agreementBoardCleanup = () => child.removeEventListener('beforeunload', handleBeforeUnload);
    } else {
      const win = candidateWindowRef.current;
      if (win.document && win.document.readyState === 'complete') {
        copyDocumentStyles(document, win.document);
      }
      if (!candidatePortalContainer && win.document) {
        const existingRoot = win.document.getElementById('agreement-candidate-root');
        if (existingRoot) setCandidatePortalContainer(existingRoot);
      }
      win.document.title = '후보 보관함';
      try { win.focus(); } catch {}
    }
  }, [candidateWindowOpen, candidatePortalContainer]);

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
    closeTechnicianWindow();
    closeCandidateWindow();
    closeAwardHistoryWindow();
  }, [inlineMode, closeTechnicianWindow, closeCandidateWindow, closeAwardHistoryWindow]);

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
      child.document.documentElement.style.height = '100%';
      child.document.documentElement.style.overflow = 'hidden';
      child.document.body.style.margin = '0';
      child.document.body.style.background = '#f3f4f6';
      child.document.body.style.height = '100%';
      child.document.body.style.overflow = 'hidden';
      child.document.body.innerHTML = '';
      const root = child.document.createElement('div');
      root.id = 'agreement-board-root';
      root.style.height = '100%';
      root.style.display = 'flex';
      root.style.flexDirection = 'column';
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
    if (!open || !candidateWindowOpen) {
      closeCandidateWindow();
      return;
    }
    ensureCandidateWindow();
  }, [open, candidateWindowOpen, ensureCandidateWindow, closeCandidateWindow]);

  React.useEffect(() => {
    if (!open && candidateWindowOpen) {
      setCandidateWindowOpen(false);
    }
  }, [open, candidateWindowOpen]);

  React.useEffect(() => () => { closeCandidateWindow(); }, [closeCandidateWindow]);

  React.useEffect(() => {
    if (!open || !technicianModalOpen) {
      closeTechnicianWindow();
      return;
    }
    ensureTechnicianWindow();
  }, [open, technicianModalOpen, ensureTechnicianWindow, closeTechnicianWindow]);

  React.useEffect(() => {
    if (!open && technicianModalOpen) {
      setTechnicianModalOpen(false);
    }
  }, [open, technicianModalOpen]);

  React.useEffect(() => () => { closeTechnicianWindow(); }, [closeTechnicianWindow]);

  React.useEffect(() => {
    if (!open) {
      setPendingMoveSource(null);
      return;
    }
    if (!pendingMoveSource?.uid) return;
    let found = false;
    for (const row of groupAssignments) {
      if (!Array.isArray(row)) continue;
      if (row.includes(pendingMoveSource.uid)) {
        found = true;
        break;
      }
    }
    if (!found) setPendingMoveSource(null);
  }, [open, groupAssignments, pendingMoveSource]);

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

  const getEffectiveCredibilityValue = React.useCallback((groupIndex, slotIndex, candidate) => {
    if (!isLh100To300) return getCredibilityValue(groupIndex, slotIndex);
    if (!candidate || !isDutyRegionCompany(candidate)) return 0;
    return 1.5;
  }, [getCredibilityValue, isDutyRegionCompany, isLh100To300]);

  const isSingleBidEligible = React.useCallback((candidate) => {
    if (!candidate) return false;
    const maxScore = Number.isFinite(managementMax) ? managementMax : MANAGEMENT_SCORE_MAX;
    const managementScore = getCandidateManagementScore(candidate);
    const result = evaluateSingleBidEligibility({
      company: candidate,
      entryAmount: parseAmountValue(entryAmount) || 0,
      performanceTarget: perfectPerformanceAmount || 0,
      performanceLabel: '기초금액',
      dutyRegions,
      sipyungAmount: getCandidateSipyungAmount(candidate),
      performanceAmount: getCandidatePerformanceAmountForCurrentRange(candidate),
      region: getRegionLabel(candidate),
      regionOk: dutyRegionSet.size === 0 ? true : isDutyRegionCompany(candidate),
      managementScore,
      managementMax: maxScore,
      managementRequired: true,
    });
    return !!result.ok;
  }, [
    entryAmount,
    perfectPerformanceAmount,
    managementMax,
    dutyRegions,
    dutyRegionSet,
    isDutyRegionCompany,
    getRegionLabel,
    getCandidateManagementScore,
    getCandidateSipyungAmount,
    getCandidatePerformanceAmountForCurrentRange,
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
      const canonicalPerformance = candidate._performance5y ?? candidate._performance3y ?? extractAmountValue(
        candidate,
        ['_performance5y', 'performance5y', '_performance3y', 'performance3y', '5년 실적', '5년실적', '5년 실적 합계', '최근5년실적', '최근5년실적합계', '5년실적금액', '최근5년시공실적', '3년 실적', '3년실적', '3년 실적 합계', '최근3년실적', '최근3년실적합계', '3년실적금액', '최근3년시공실적'],
        [['5년실적', '최근5년', 'fiveyear', 'performance5', '시공실적'], ['3년실적', '최근3년', 'threeyear', 'performance3', '시공실적']]
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

  const handleGenerateInconMemo = React.useCallback(async () => {
    const text = buildInconMemoText({
      fileType,
      dutyRegions,
      groupAssignments,
      groupShares,
      groupApprovals,
      participantMap,
      lhLeaderBizNoFormat: isLHOwner,
    });
    if (!text) {
      showHeaderAlert('아이건설넷 메모로 만들 협정 내용이 없습니다.');
      return;
    }
    try {
      const result = await window.electronAPI.clipboardWriteText(text);
      if (!result?.success) throw new Error(result?.message || 'Clipboard write failed');
      showHeaderAlert('아이건설넷 메모가 클립보드에 복사되었습니다.');
    } catch (err) {
      console.error('Failed to copy incon memo: ', err);
      showHeaderAlert('클립보드 복사에 실패했습니다.');
    }
  }, [isLHOwner, dutyRegions, fileType, groupAssignments, groupApprovals, groupShares, participantMap, showHeaderAlert]);

  const resolveCandidateBySlot = React.useCallback((groupIndex, slotIndex) => {
    const uid = groupAssignments[groupIndex]?.[slotIndex];
    if (!uid) return null;
    const entry = participantMap.get(uid);
    return entry?.candidate || null;
  }, [groupAssignments, participantMap]);

  const getPossibleShareLimit = React.useCallback((candidate) => {
    if (!candidate) return null;
    const ratio = calculatePossibleShareRatio(possibleShareBase, getCandidateSipyungAmount(candidate));
    const numeric = Number(ratio);
    if (!Number.isFinite(numeric) || numeric <= 0 || numeric >= 100) return null;
    return numeric;
  }, [possibleShareBase, getCandidateSipyungAmount]);

  const formatPossibleShareInputValue = React.useCallback((value) => {
    const formatted = formatPossibleShareValue(value, { mode: isLh100To300 ? 'truncate' : 'round' });
    return formatted || '';
  }, [isLh100To300]);

  const getDefaultShareValue = React.useCallback((candidate) => {
    const possibleShareLimit = getPossibleShareLimit(candidate);
    if (possibleShareLimit == null) return '';
    return formatPossibleShareInputValue(possibleShareLimit);
  }, [getPossibleShareLimit, formatPossibleShareInputValue]);

  const {
    boardSearchOpen,
    boardSearchField,
    setBoardSearchField,
    boardSearchQuery,
    setBoardSearchQuery,
    boardSearchMatches,
    boardSearchMatchKeySet,
    boardSearchActiveKey,
    boardSearchCurrentLabel,
    boardSearchInputRef,
    openBoardSearchPopup,
    closeBoardSearchPopup,
    moveBoardSearchMatch,
    registerBoardSearchCardRef,
  } = useBoardSearch({
    groupAssignments,
    participantMap,
    getCompanyName,
    getCandidateManagerName,
    buildBoardSearchKey,
  });
  const {
    technicianEntries,
    technicianTarget,
    setTechnicianTarget,
    technicianScoreTotal,
    technicianTargetOptions,
    openTechnicianModal,
    closeTechnicianModal,
    addTechnicianEntry,
    updateTechnicianEntry,
    removeTechnicianEntry,
    handleSaveTechnicianScore,
  } = useTechnicianScoreWorkflow({
    technicianModalOpen,
    setTechnicianModalOpen,
    initialTechnicianEntriesByTarget,
    groupAssignments,
    participantMap,
    slotLabels,
    getCompanyName,
    getBizNo,
    normalizeBizNo,
    onUpdateBoard,
    technicianEditable,
    setGroupTechnicianScores,
  });

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

  const handleCandidatePicked = React.useCallback((picked) => {
    if (!picked) return;
    onAddRepresentatives?.([{ ...picked, [CANDIDATE_POOL_FLAG]: true }]);
    setCandidateWindowOpen(true);
    closeCandidateSearch();
  }, [onAddRepresentatives, closeCandidateSearch]);

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

  const candidateDrawerEntries = React.useMemo(() => {
    return buildCandidateDrawerEntries({
      representativeEntries,
      regionEntries,
      participantMap,
      assignedIds,
      candidatePoolFlag: CANDIDATE_POOL_FLAG,
      getCompanyName,
      getCandidateManagerName,
      getRegionLabel,
      getCandidateCreditGrade,
      getCandidateManagementScore,
      getCandidateSipyungAmount,
      getCandidatePerformanceAmountForCurrentRange,
      isDutyRegionCompany,
      isMois30To50,
      managementMax,
      managementScoreMax: MANAGEMENT_SCORE_MAX,
      possibleShareBase,
      possibleShareFormatMode: isLh100To300 ? 'truncate' : 'round',
      toNumber,
      clampScore,
      hasRecentAwardHistory: isRecentAwardHistoryCompany,
      noticeDate,
    });
  }, [
    assignedIds,
    representativeEntries,
    regionEntries,
    participantMap,
    candidateMetricsVersion,
    managementMax,
    isMois30To50,
    isLh100To300,
    possibleShareBase,
    isDutyRegionCompany,
    getCandidatePerformanceAmountForCurrentRange,
    isRecentAwardHistoryCompany,
    noticeDate,
  ]);

  const filteredCandidateDrawerEntries = React.useMemo(() => {
    return filterCandidateDrawerEntries(candidateDrawerEntries, candidateDrawerQuery);
  }, [candidateDrawerEntries, candidateDrawerQuery]);

  React.useEffect(() => {
    if (!selectedCandidateUid) return;
    const exists = candidateDrawerEntries.some((entry) => entry.uid === selectedCandidateUid);
    if (!exists) setSelectedCandidateUid(null);
  }, [candidateDrawerEntries, selectedCandidateUid]);

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

  const conflictNotesByGroup = React.useMemo(() => {
    const result = new Map();
    const rules = agreementConstraintRules;
    if (!rules) return result;

    const resolveEntryType = (entry) => String(entry?.entityType || entry?.type || 'company').toLowerCase();
    const resolveEntryName = (entry) => (entry?.name ? String(entry.name).trim() : '');
    const resolveEntryBiz = (entry) => normalizeBizNo(entry?.bizNo);

    const matchesEntry = (member, entry) => {
      if (!member || !entry) return false;
      const entryType = resolveEntryType(entry);
      const entryName = resolveEntryName(entry);
      const entryBiz = resolveEntryBiz(entry);
      const entryCompanyKey = entryName ? normalizeCompanyKey(entryName) : '';
      const entryManagerKey = entryName ? normalizeManagerKey(entryName) : '';
      const matchesCompany = Boolean(
        (entryBiz && member.bizNo && entryBiz === member.bizNo)
        || (entryCompanyKey && member.companyKey && entryCompanyKey === member.companyKey),
      );
      const matchesManager = Boolean(entryManagerKey && member.managerKey && entryManagerKey === member.managerKey);
      if (entryType === 'manager') return matchesManager;
      if (entryType === 'any') return matchesManager || matchesCompany;
      return matchesCompany;
    };

    const resolveEntryLabel = (entry, members) => {
      const entryName = resolveEntryName(entry);
      if (entryName) return entryName;
      const entryType = resolveEntryType(entry);
      const fallback = members && members.length > 0 ? members[0] : null;
      if (entryType === 'manager') return fallback?.managerName || '담당자';
      return fallback?.companyName || '업체';
    };

    groupAssignments.forEach((memberIds, groupIndex) => {
      const members = [];
      memberIds.forEach((uid) => {
        if (!uid) return;
        const entry = participantMap.get(uid);
        if (!entry?.candidate) return;
        const candidate = entry.candidate;
        const managerName = getCandidateManagerName(candidate);
        const managerKey = normalizeManagerKey(managerName);
        const companyName = getCompanyName(candidate);
        members.push({
          uid,
          managerName,
          managerKey,
          companyName,
          companyKey: normalizeCompanyKey(companyName),
          bizNo: normalizeBizNo(getBizNo(candidate)),
        });
      });

      if (members.length === 0) return;
      const messages = new Set();

      if (rules.banSameManager) {
        const managerMap = new Map();
        members.forEach((member) => {
          if (!member.managerKey) return;
          const list = managerMap.get(member.managerKey) || [];
          list.push(member);
          managerMap.set(member.managerKey, list);
        });
        managerMap.forEach((list, key) => {
          if (list.length < 2) return;
          const label = list[0]?.managerName || key;
          messages.add(`동일담당자중복: ${label}`);
        });
      }

      (rules.banManagerPairs || []).forEach((pair) => {
        const left = pair?.[0];
        const right = pair?.[1];
        const leftKey = normalizeManagerKey(left);
        const rightKey = normalizeManagerKey(right);
        if (!leftKey || !rightKey) return;
        const leftMembers = members.filter((member) => member.managerKey && member.managerKey === leftKey);
        const rightMembers = members.filter((member) => member.managerKey && member.managerKey === rightKey);
        if (leftMembers.length === 0 || rightMembers.length === 0) return;
        messages.add(`담당자조합금지: ${left} + ${right}`);
      });

      (rules.banPairs || []).forEach((pair) => {
        const left = pair?.[0];
        const right = pair?.[1];
        if (!left || !right) return;
        const leftMembers = members.filter((member) => matchesEntry(member, left));
        const rightMembers = members.filter((member) => matchesEntry(member, right));
        if (leftMembers.length === 0 || rightMembers.length === 0) return;
        messages.add(`협정금지조합: ${resolveEntryLabel(left, leftMembers)} + ${resolveEntryLabel(right, rightMembers)}`);
      });

      if (messages.size > 0) result.set(groupIndex, Array.from(messages));
    });

    return result;
  }, [agreementConstraintRules, groupAssignments, participantMap]);

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
    showLoading({
      title: '엑셀 내보내기',
      message: '엑셀 시트를 생성하는 중입니다...',
      portalTarget: portalContainer || null,
    });
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
        || (ownerKeyUpper === 'LH' && rangeId === LH_50_TO_100_KEY)
        || (ownerKeyUpper === 'LH' && rangeId === LH_100_TO_300_KEY)
        || (ownerKeyUpper === 'MOIS' && (rangeId === MOIS_30_TO_50_KEY || rangeId === MOIS_50_TO_100_KEY));
      const dutyRateNumber = parseNumeric(regionDutyRate);
      const dutySummaryText = buildExportDutySummary(dutyRegions, dutyRateNumber, safeParticipantLimit, {
        compact: ownerKeyUpper === 'LH' && rangeId === LH_100_TO_300_KEY,
      });
      const formattedDeadline = formatBidDeadline(bidDeadline);
      const payload = buildAgreementExportPayload({
        templateKey,
        appendTargetPath: options.appendTargetPath || '',
        sheetName: options.sheetName || '',
        ownerId,
        rangeId,
        noticeNo,
        noticeTitle,
        industryLabel,
        baseValue,
        estimatedValue,
        bidAmountValue,
        ratioBaseValue,
        entryAmountValue,
        entryModeResolved,
        amountForScoreResolved,
        formattedDeadline,
        bidDeadline,
        dutyRegions,
        dutyRateNumber,
        dutySummaryText,
        safeGroupSize,
        summary,
        memoHtml,
        netCostPenaltyNotice,
        groupAssignments,
        groupApprovals,
        groupShares,
        groupCredibility,
        groupManagementBonus: effectiveGroupManagementBonus,
        participantMap,
        summaryByGroup,
        netCostBonusScore: effectiveNetCostBonusScore,
        isLHOwner,
        technicianEnabled,
        selectedRangeKey: selectedRangeOption?.key,
        includePossibleShare,
        possibleShareBase,
        candidateDrawerEntries,
        parseNumeric,
        getSharePercent,
        getCandidateManagementScore,
        getCandidatePerformanceAmountForCurrentRange,
        getTechnicianValue,
        getCandidateSipyungAmount,
        isDutyRegionCompany,
        sanitizeCompanyName,
        getCompanyName,
        getCandidateManagerName,
        getRegionLabel,
        normalizeBizNo,
        getBizNo,
        getQualityScoreValue,
        resolveQualityPoints,
        hasRecentAwardHistory: isRecentAwardHistoryCompany,
      });

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
    parseAmountValue,
    parseNumeric,
    buildDutySummary,
    formatBidDeadline,
    groupAssignments,
    groupApprovals,
    groupShares,
    groupCredibility,
    effectiveGroupManagementBonus,
    participantMap,
    summaryByGroup,
    effectiveNetCostBonusScore,
    summary,
    safeGroupSize,
    isLHOwner,
    technicianEnabled,
    selectedRangeOption?.key,
    entryModeResolved,
    memoHtml,
    netCostPenaltyNotice,
    candidateDrawerEntries,
    getSharePercent,
    getCandidateManagementScore,
    getCandidatePerformanceAmountForCurrentRange,
    getTechnicianValue,
    getCandidateSipyungAmount,
    isDutyRegionCompany,
    sanitizeCompanyName,
    getCompanyName,
    getCandidateManagerName,
    getRegionLabel,
    normalizeBizNo,
    getBizNo,
    getQualityScoreValue,
    resolveQualityPoints,
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
    const prevAssignedIds = new Set();
    prevAssignments.forEach((group) => {
      group.forEach((id) => {
        if (id) prevAssignedIds.add(id);
      });
    });
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
        group.map((id) => {
          if (!id) return '';
          const preserved = shareMap.get(id);
          if (preserved !== undefined && preserved !== null && preserved !== '') return preserved;
          if (prevAssignedIds.has(id)) return preserved ?? '';
          const candidate = participantMap.get(id)?.candidate;
          return getDefaultShareValue(candidate);
        })
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
        group.map((id) => {
          if (!id) return '';
          const preserved = rawMap.get(id);
          if (preserved !== undefined && preserved !== null && preserved !== '') return preserved;
          if (prevAssignedIds.has(id)) return preserved ?? '';
          const candidate = participantMap.get(id)?.candidate;
          return getDefaultShareValue(candidate);
        })
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
  }, [groupAssignments, participantMap, getDefaultShareValue]);

  React.useEffect(() => {
    if (!open) {
      setGroupSummaries((prev) => (Array.isArray(prev) && prev.length === 0 ? prev : []));
      return;
    }
    const baseValue = parseAmountValue(baseAmount);
    const estimatedValue = parseAmountValue(estimatedAmount);
    const perfBase = isPpsUnder50
      ? (baseValue != null && baseValue > 0 ? baseValue : null)
      : isLh50To100
        ? (baseValue != null && baseValue > 0 ? baseValue : null)
      : (ownerKeyUpper === 'EX'
        ? (baseValue != null && baseValue > 0 ? baseValue : (estimatedValue != null && estimatedValue > 0 ? estimatedValue : null))
        : ((estimatedValue != null && estimatedValue > 0)
          ? estimatedValue
          : (baseValue != null && baseValue > 0 ? baseValue : null)));
    const rangeAmountHint = parseRangeAmountHint(ownerKeyUpper, selectedRangeOption?.label);
    const evaluationAmount = rangeAmountHint > 0 ? rangeAmountHint : 0;
    const ownerKey = String(ownerId || 'lh').toLowerCase();
    const performanceBaseReady = perfBase != null && perfBase > 0;

    const entryLimitValue = parseAmountValue(entryAmount);
    const entryModeForCalc = entryModeResolved;
    const performanceFallback = ownerPerformanceFallback;
    const derivedManagementMax = managementMax;
    const derivedPerformanceMax = derivedMaxScores.performanceMax ?? performanceFallback;

    const metrics = buildGroupSummaryMetrics({
      groupAssignments,
      participantMap,
      getSharePercent,
      getCandidateManagementScore,
      getCandidatePerformanceAmountForCurrentRange,
      technicianEditable,
      getTechnicianValue,
      credibilityEnabled,
      credibilityMode: isLh100To300 ? 'regional-share' : 'weighted-credibility',
      isDutyRegionCompany,
      getCredibilityValue: getEffectiveCredibilityValue,
      getCandidateSipyungAmount,
      entryModeResolved: entryModeForCalc,
      entryLimitValue,
      isKrailOwner,
      krailCredibilityScale,
    });

    let canceled = false;

    const evaluatePerformanceScore = async (perfAmount) => {
      return evaluateAgreementPerformanceScore(perfAmount, {
        performanceBaseReady,
        agencyId: ownerKey,
        fileType,
        evaluationAmount,
        perfBase,
        roundRatioBaseAmount: (isLh50To100 || selectedRangeKey === LH_UNDER_50_KEY) ? perfectPerformanceAmount : null,
        estimatedValue,
        perfCoefficient: null,
        roundRatioDigits: (isLh50To100 || selectedRangeKey === LH_UNDER_50_KEY) ? 2 : null,
        formulasEvaluate: typeof window !== 'undefined' ? window.electronAPI?.formulasEvaluate : null,
        updatePerformanceCap,
        getPerformanceCap,
        toNumber,
        clampScore,
      });
    };

    const run = async () => {
      const results = await computeGroupSummaries({
        metrics,
        evaluatePerformanceScore,
        performanceBaseReady,
        perfBase,
        groupManagementBonus: effectiveGroupManagementBonus,
        managementScale,
        managementMax,
        managementScoreMax: MANAGEMENT_SCORE_MAX,
        clampScore,
        roundForMoisManagement,
        roundForLhTotals,
        roundUpForPpsUnder50,
        roundForKrailUnder50,
        roundForExManagement,
        roundForPerformanceTotals,
        resolveKrailTechnicianAbilityScore,
        getPerformanceCap,
        derivedPerformanceMax,
        credibilityEnabled,
        ownerCredibilityMax,
        isMois30To50,
        isMois50To100,
        isEx50To100,
        isKrail50To100,
        isLh50To100,
        technicianEnabled,
        technicianEditable,
        technicianAbilityMax,
        netCostBonusScore: effectiveNetCostBonusScore,
        bidScoreDefault: BID_SCORE_DEFAULT,
        subcontractScoreDefault: SUBCONTRACT_SCORE,
        mois50To100SubcontractScore: MOIS_50_TO_100_SUBCONTRACT_SCORE,
        ex50To100SubcontractScore: EX_50_TO_100_SUBCONTRACT_SCORE,
        krail50To100SubcontractMaterialScore: KRAIL_50_TO_100_SUBCONTRACT_MATERIAL_SCORE,
        lh50To100SubcontractScore: LH_50_TO_100_SUBCONTRACT_SCORE,
        lh50To100MaterialScore: LH_50_TO_100_MATERIAL_SCORE,
        mois50To100MaterialScore: MOIS_50_TO_100_MATERIAL_SCORE,
        ex50To100BidScore: EX_50_TO_100_BID_SCORE,
        krail50To100BidScore: KRAIL_50_TO_100_BID_SCORE,
        lh50To100BidScore: LH_50_TO_100_BID_SCORE,
        mois50To100BidScore: MOIS_50_TO_100_BID_SCORE,
      });
      if (!canceled) {
        setGroupSummaries((prev) => (equalGroupSummaries(prev, results) ? prev : results));
      }
    };

    run();

    return () => {
      canceled = true;
    };
  }, [open, participantSignature, groupAssignments, groupShares, groupCredibility, groupTechnicianScores, participantMap, ownerId, ownerKeyUpper, selectedRangeOption?.key, selectedRangeOption?.label, estimatedAmount, baseAmount, entryAmount, entryModeResolved, getSharePercent, getEffectiveCredibilityValue, getTechnicianValue, credibilityEnabled, ownerCredibilityMax, candidateMetricsVersion, derivedMaxScores, effectiveGroupManagementBonus, effectiveNetCostBonusScore, managementScale, managementMax, isMois30To50, isMois50To100, isMoisUnderOr30To50, isKrailUnder50, isKrail50To100, isPpsUnder50, isLh50To100, isLh100To300, isDutyRegionCompany, roundForLhTotals, roundForMoisManagement, roundForKrailUnder50, roundUpForPpsUnder50, roundForExManagement, resolveKrailTechnicianAbilityScore, resolveSummaryDigits, technicianEditable, technicianEnabled, technicianAbilityMax, getCandidatePerformanceAmountForCurrentRange]);

  React.useEffect(() => {
    attemptPendingPlacement();
  }, [participantMap, attemptPendingPlacement]);

  React.useEffect(() => {
    if (!open) return;
    const evalApi = typeof window !== 'undefined' ? window.electronAPI?.formulasEvaluate : null;
    const baseValue = parseAmountValue(baseAmount);
    const estimatedValue = parseAmountValue(estimatedAmount);
    const perfBase = isPpsUnder50
      ? (baseValue != null && baseValue > 0 ? baseValue : null)
      : isLh50To100
        ? (baseValue != null && baseValue > 0 ? baseValue : null)
      : ((estimatedValue != null && estimatedValue > 0)
        ? estimatedValue
        : (baseValue != null && baseValue > 0 ? baseValue : null));
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
        perf5y: getCandidatePerformanceAmountForCurrentRange(candidate),
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
        || candidate._performance3y != null || candidate.performance3y != null
        || candidate.perf5y != null || candidate.perf3y != null || candidate.performanceTotal != null
        || candidate['5년 실적'] != null || candidate['5년실적'] != null
        || candidate['최근5년실적'] != null || candidate['5년실적금액'] != null
        || candidate['3년 실적'] != null || candidate['3년실적'] != null
        || candidate['최근3년실적'] != null || candidate['3년실적금액'] != null
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

    const buildCandidateKey = (candidate) => {
      if (!candidate || typeof candidate !== 'object') return '';
      if (candidate.id) return String(candidate.id);
      const biz = normalizeBizNo(getBizNo(candidate));
      if (biz) return `biz:${biz}`;
      const name = getCompanyName(candidate);
      return name ? `name:${name}` : '';
    };

    const resolveCandidateScores = async () => {
      const updated = await runAgreementCandidateScoreEvaluation({
        entries,
        isCanceled: () => canceled,
        getCandidateManagementScore,
        getCandidatePerformanceAmountForCurrentRange,
        performanceBaseReady,
        perfBase,
        ownerKey,
        fileType,
        selectedRangeKey: selectedRangeOption?.key || '',
        evaluationAmount,
        candidateScoreCache: candidateScoreCacheRef.current,
        buildCandidateKey,
        getCandidateNumericValue,
        resolveCandidateBizYears,
        noticeDate,
        estimatedValue,
        perfCoefficient: null,
        extractCreditGrade,
        isCreditScoreExpired,
        formulasEvaluate: evalApi,
        getCompanyName,
        clampScore,
        getPerformanceCap,
        updatePerformanceCap,
        performanceCapVersion: PERFORMANCE_CAP_VERSION,
        managementScoreVersion: MANAGEMENT_SCORE_VERSION,
        forceManagementEvaluation: true,
        forcePerformanceEvaluation: false,
      });

      if (!canceled && updated > 0) {
        setCandidateMetricsVersion((prev) => prev + 1);
      }
    };

    resolveCandidateScores();

    return () => {
      canceled = true;
    };
  }, [open, participantSignature, participantMap, ownerId, ownerKeyUpper, selectedRangeOption?.key, selectedRangeOption?.label, baseAmount, estimatedAmount, fileType, noticeDate, isPpsUnder50, isLh100To300]);

  const handleDragStart = (id, groupIndex, slotIndex) => (event) => {
    if (!id) return;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', id);
    setDraggingId(id);
    setDragSource({ groupIndex, slotIndex, id });
  };

  const handleCandidateDrawerDragStart = (id) => (event) => {
    if (!id) return;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', id);
    setDraggingId(id);
    setDragSource(null);
    setSelectedCandidateUid(id);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDropTarget(null);
    setDragSource(null);
  };

  const handleSelectedCandidatePlacement = React.useCallback(async (meta) => {
    if (!meta || !selectedCandidateUid || !participantMap.has(selectedCandidateUid)) return false;
    const sourceEntry = participantMap.get(selectedCandidateUid);
    const sourceName = getCompanyName(sourceEntry?.candidate) || '업체';
    const targetName = meta.companyName || '업체';
    const ok = await confirm({
      title: meta.empty ? '업체를 배치하시겠습니까?' : '업체를 교체하시겠습니까?',
      message: meta.empty
        ? `${sourceName} 업체를 ${meta.groupIndex + 1}번 협정 ${meta.label} 위치에 배치하시겠습니까?`
        : `${sourceName} 업체를 넣고, ${targetName} 업체를 후보로 되돌리시겠습니까?`,
      confirmText: '예',
      cancelText: '아니오',
      tone: 'info',
      portalTarget: portalContainer || null,
    });
    if (!ok) return true;

    if (!meta.empty && meta.uid) {
      const targetCandidate = participantMap.get(meta.uid)?.candidate;
      if (targetCandidate) {
        markCandidatePoolListed(targetCandidate, true);
      }
    }

    placeEntryInSlot(selectedCandidateUid, meta.groupIndex, meta.slotIndex);
    setSelectedCandidateUid(null);
    showHeaderAlert(buildCandidatePlacementNotice(meta, sourceName, targetName));
    return true;
  }, [selectedCandidateUid, participantMap, placeEntryInSlot, showHeaderAlert, confirm, portalContainer, markCandidatePoolListed]);

  const handleCardMoveClick = React.useCallback(async (meta) => {
    if (!meta) return;
    if (await handleSelectedCandidatePlacement(meta)) return;

    if (!pendingMoveSource) {
      const nextPendingSource = createPendingMoveSource(meta);
      if (!nextPendingSource) return;
      setPendingMoveSource(nextPendingSource);
      return;
    }

    const sourceUid = pendingMoveSource.uid;
    const targetUid = meta.empty ? null : (meta.uid || null);
    if (!sourceUid) {
      setPendingMoveSource(null);
      return;
    }
    if (shouldResetPendingMove(pendingMoveSource, meta)) {
      setPendingMoveSource(null);
      return;
    }
    const confirmPayload = buildBoardMoveConfirmPayload(pendingMoveSource, meta);

    const ok = await confirm({
      title: confirmPayload.title,
      message: confirmPayload.message,
      confirmText: '예',
      cancelText: '아니오',
      tone: 'info',
      portalTarget: portalContainer || null,
    });
    if (!ok) return;

    setGroupAssignments((prev) => swapOrMoveBoardEntries(prev, {
      sourceUid,
      targetUid,
      targetGroupIndex: meta.groupIndex,
      targetSlotIndex: meta.slotIndex,
      safeGroupSize,
    }));

    setPendingMoveSource(null);
  }, [handleSelectedCandidatePlacement, confirm, pendingMoveSource, portalContainer, safeGroupSize]);

  const handleBoardSlotClick = React.useCallback((meta) => {
    if (!meta) return;
    if (pendingMoveSource?.uid) {
      void handleCardMoveClick(meta);
      return;
    }
    if (selectedCandidateUid && participantMap.has(selectedCandidateUid)) {
      void handleSelectedCandidatePlacement(meta);
      return;
    }
    if (!meta.empty) {
      void handleCardMoveClick(meta);
      return;
    }
    openRepresentativeSearch({ groupIndex: meta.groupIndex, slotIndex: meta.slotIndex });
  }, [selectedCandidateUid, participantMap, pendingMoveSource, handleCardMoveClick, handleSelectedCandidatePlacement, openRepresentativeSearch]);

  const handleRemove = (groupIndex, slotIndex) => {
    const candidate = resolveCandidateBySlot(groupIndex, slotIndex);
    if (candidate) {
      markCandidatePoolListed(candidate, true);
    }
    setGroupAssignments((prev) => resetSlotInMatrix(prev, groupIndex, slotIndex, null));
    setGroupShares((prev) => resetSlotInMatrix(prev, groupIndex, slotIndex, ''));
    setGroupShareRawInputs((prev) => resetSlotInMatrix(prev, groupIndex, slotIndex, ''));
    setGroupCredibility((prev) => resetSlotInMatrix(prev, groupIndex, slotIndex, ''));
  };

  const placeCandidateOnBoard = React.useCallback((uid) => {
    if (!uid || !participantMap.has(uid)) return false;
    let placed = false;
    setGroupAssignments((prev) => {
      const result = placeEntryOnBoard(prev, uid, safeGroupSize);
      placed = result.placed;
      return result.assignments;
    });
    return placed;
  }, [participantMap, safeGroupSize]);

  const handleCandidateDrawerAssign = React.useCallback((uid) => {
    const ok = placeCandidateOnBoard(uid);
    if (!ok) {
      showHeaderAlert('후보를 협정테이블에 넣지 못했습니다.');
      return;
    }
    setSelectedCandidateUid(null);
    showHeaderAlert('후보를 협정테이블에 넣었습니다.');
  }, [placeCandidateOnBoard, showHeaderAlert]);

  const handleDropInternal = (groupIndex, slotIndex, id) => {
    if (!id || !participantMap.has(id)) return;
    const targetCandidate = groupAssignments[groupIndex]?.[slotIndex]
      ? participantMap.get(groupAssignments[groupIndex][slotIndex])?.candidate
      : null;
    if (targetCandidate && (!dragSource || dragSource.id !== id)) {
      markCandidatePoolListed(targetCandidate, true);
    }
    setGroupAssignments((prev) => applyDropToAssignments(prev, {
      groupIndex,
      slotIndex,
      id,
      dragSource,
      safeGroupSize,
    }));
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
      portalTarget: portalContainer || null,
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
    setSelectedCandidateUid(null);
    setCandidateDrawerQuery('');
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
        netCostBonusOverride: '',
        entryAmount: '',
        entryMode: 'none',
        netCostAmount: '',
        aValue: '',
        dutyRegions: [],
        regionDutyRate: '',
        participantLimit: safeGroupSize,
        candidates: [],
        pinned: [],
        excluded: [],
        alwaysInclude: [],
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

  const removeCandidatesFromBoard = React.useCallback((targets = []) => {
    if (!Array.isArray(targets) || targets.length === 0) return;
    if (typeof onUpdateBoard !== 'function') return;
    const idSet = new Set();
    const bizSet = new Set();
    const nameSet = new Set();
    targets.forEach((candidate) => {
      if (!candidate || typeof candidate !== 'object') return;
      if (candidate.id != null && candidate.id !== '') idSet.add(String(candidate.id));
      const biz = normalizeBizNo(getBizNo(candidate));
      if (biz) bizSet.add(biz);
      const name = String(getCompanyName(candidate) || '').trim();
      if (name) nameSet.add(name);
    });
    if (idSet.size === 0 && bizSet.size === 0 && nameSet.size === 0) return;
    const nextCandidates = (candidates || []).filter((item) => {
      if (!item || typeof item !== 'object') return item;
      let matched = false;
      if (!matched && item.id != null && item.id !== '' && idSet.has(String(item.id))) matched = true;
      if (!matched) {
        const biz = normalizeBizNo(getBizNo(item));
        if (biz && bizSet.has(biz)) matched = true;
      }
      if (!matched) {
        const name = String(getCompanyName(item) || '').trim();
        if (name && nameSet.has(name)) matched = true;
      }
      return !matched;
    });
    onUpdateBoard({ candidates: nextCandidates });
    if (typeof onRemoveRepresentative === 'function') {
      idSet.forEach((id) => onRemoveRepresentative(id));
    }
  }, [candidates, onRemoveRepresentative, onUpdateBoard]);

  const handleCandidateDrawerDelete = React.useCallback(async (uid) => {
    if (!uid) return;
    const candidate = participantMap.get(uid)?.candidate;
    if (!candidate) return;
    const ok = await confirm({
      title: '후보 업체를 삭제하시겠습니까?',
      message: '삭제하면 후보 목록에서 제거되며 복구할 수 없습니다.',
      confirmText: '삭제',
      cancelText: '취소',
      tone: 'warning',
      portalTarget: candidatePortalContainer || portalContainer || null,
    });
    if (!ok) return;
    removeCandidatesFromBoard([candidate]);
    setSelectedCandidateUid((prev) => (prev === uid ? null : prev));
  }, [participantMap, removeCandidatesFromBoard, confirm, candidatePortalContainer, portalContainer]);

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
      portalTarget: portalContainer || null,
    });
    if (!ok) return;
    const selected = new Set(selectedGroups);
    setGroupAssignments((prev) => prev.filter((_, idx) => !selected.has(idx)));
    // Shares/credibility/technician are slot-index arrays.
    // If we filter them here before `groupAssignments` sync runs, old/new indices can desync.
    // Leave them untouched and let the assignment-sync effect remap by participant id.
    setGroupApprovals((prev) => prev.filter((_, idx) => !selected.has(idx)));
    setGroupManagementBonus((prev) => prev.filter((_, idx) => !selected.has(idx)));
    setDropTarget(null);
    setPendingMoveSource(null);
    clearSelectedGroups();
  };

  const handleShareInput = (groupIndex, slotIndex, rawValue) => {
    const original = rawValue ?? '';
    const sanitized = original.replace(/[^0-9.]/g, '');
    if ((sanitized.match(/\./g) || []).length > 1) return;
    const candidate = resolveCandidateBySlot(groupIndex, slotIndex);
    const possibleShareLimit = getPossibleShareLimit(candidate);
    const numeric = sanitized === '' ? null : toNumber(sanitized);
    const exceedsLimit = numeric != null && possibleShareLimit != null && numeric > possibleShareLimit;
    const nextValue = exceedsLimit
      ? formatPossibleShareInputValue(possibleShareLimit)
      : sanitized;
    setGroupShares((prev) => {
      const next = prev.map((row) => row.slice());
      while (next.length <= groupIndex) next.push([]);
      while (next[groupIndex].length <= slotIndex) next[groupIndex].push('');
      next[groupIndex][slotIndex] = nextValue;
      return next;
    });
    setGroupShareRawInputs((prev) => {
      const next = prev.map((row) => row.slice());
      while (next.length <= groupIndex) next.push([]);
      while (next[groupIndex].length <= slotIndex) next[groupIndex].push('');
      next[groupIndex][slotIndex] = nextValue;
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

  const handleAmountInput = React.useCallback((groupIndex, slotIndex, rawValue, kind) => {
    const candidate = resolveCandidateBySlot(groupIndex, slotIndex);
    if (!candidate) return;
    const original = rawValue ?? '';
    const cleaned = String(original).replace(/[^0-9,.-]/g, '');
    const trimmed = cleaned.trim();
    const parsed = toNumber(trimmed);
    const formattedAmountInput = trimmed && parsed != null ? formatAmount(parsed) : cleaned;
    const managementCap = Number.isFinite(managementMax) ? managementMax : MANAGEMENT_SCORE_MAX;
    if (kind === 'performance') {
      if (trimmed) {
        candidate._agreementPerformanceInput = formattedAmountInput;
        candidate._agreementPerformanceCleared = false;
        if (parsed != null) {
          candidate._agreementPerformance5y = parsed;
        } else {
          delete candidate._agreementPerformance5y;
        }
        updateCandidateOverride(candidate, {
          _agreementPerformanceInput: formattedAmountInput,
          _agreementPerformanceCleared: false,
          _agreementPerformance5y: parsed != null ? parsed : null,
          _agreementPerformanceScore: undefined,
          _agreementPerformanceMax: undefined,
          _agreementPerformanceCapVersion: undefined,
        });
      } else {
        candidate._agreementPerformanceInput = '';
        candidate._agreementPerformanceCleared = true;
        delete candidate._agreementPerformance5y;
        updateCandidateOverride(candidate, {
          _agreementPerformanceInput: '',
          _agreementPerformanceCleared: true,
          _agreementPerformance5y: null,
          _agreementPerformanceScore: undefined,
          _agreementPerformanceMax: undefined,
          _agreementPerformanceCapVersion: undefined,
        });
      }
      delete candidate._agreementPerformanceScore;
      delete candidate._agreementPerformanceMax;
      delete candidate._agreementPerformanceCapVersion;
    } else if (kind === 'sipyung') {
      if (trimmed) {
        candidate._agreementSipyungInput = formattedAmountInput;
        candidate._agreementSipyungCleared = false;
        if (parsed != null) {
          candidate._agreementSipyungAmount = parsed;
        } else {
          delete candidate._agreementSipyungAmount;
        }
        updateCandidateOverride(candidate, {
          _agreementSipyungInput: formattedAmountInput,
          _agreementSipyungCleared: false,
          _agreementSipyungAmount: parsed != null ? parsed : null,
        });
      } else {
        candidate._agreementSipyungInput = '';
        candidate._agreementSipyungCleared = true;
        delete candidate._agreementSipyungAmount;
        updateCandidateOverride(candidate, {
          _agreementSipyungInput: '',
          _agreementSipyungCleared: true,
          _agreementSipyungAmount: null,
        });
      }
    } else if (kind === 'management') {
      if (trimmed) {
        const clamped = clampScore(parsed, managementCap);
        candidate._agreementManagementInput = cleaned;
        if (clamped != null) {
          candidate._agreementManagementManual = clamped;
          candidate._agreementManagementScore = clamped;
          candidate._agreementManagementScoreVersion = MANAGEMENT_SCORE_VERSION;
        } else {
          delete candidate._agreementManagementManual;
          delete candidate._agreementManagementScore;
          delete candidate._agreementManagementScoreVersion;
        }
        updateCandidateOverride(candidate, {
          _agreementManagementInput: cleaned,
          _agreementManagementManual: clamped != null ? clamped : null,
          _agreementManagementScore: clamped != null ? clamped : null,
          _agreementManagementScoreVersion: clamped != null ? MANAGEMENT_SCORE_VERSION : null,
        });
      } else {
        candidate._agreementManagementInput = '';
        delete candidate._agreementManagementManual;
        delete candidate._agreementManagementScore;
        delete candidate._agreementManagementScoreVersion;
        updateCandidateOverride(candidate, {
          _agreementManagementInput: '',
          _agreementManagementManual: null,
          _agreementManagementScore: null,
          _agreementManagementScoreVersion: null,
        });
      }
    }
    candidateScoreCacheRef.current.clear();
    setCandidateMetricsVersion((prev) => prev + 1);
  }, [resolveCandidateBySlot, updateCandidateOverride, managementMax]);

  const handleAmountBlur = React.useCallback((groupIndex, slotIndex, kind) => {
    const candidate = resolveCandidateBySlot(groupIndex, slotIndex);
    if (!candidate) return;
    const raw = kind === 'performance'
      ? candidate._agreementPerformanceInput
      : (kind === 'management' ? candidate._agreementManagementInput : candidate._agreementSipyungInput);
    if (raw === undefined || raw === null || raw === '') return;
    const parsed = toNumber(raw);
    if (parsed == null) return;
    const managementCap = Number.isFinite(managementMax) ? managementMax : MANAGEMENT_SCORE_MAX;
    const formatted = formatAmount(parsed);
    if (kind === 'performance') {
      candidate._agreementPerformanceInput = formatted;
      candidate._agreementPerformanceCleared = false;
      candidate._agreementPerformance5y = parsed;
      delete candidate._agreementPerformanceScore;
      delete candidate._agreementPerformanceMax;
      delete candidate._agreementPerformanceCapVersion;
      updateCandidateOverride(candidate, {
        _agreementPerformanceInput: formatted,
        _agreementPerformanceCleared: false,
        _agreementPerformance5y: parsed,
        _agreementPerformanceScore: undefined,
        _agreementPerformanceMax: undefined,
        _agreementPerformanceCapVersion: undefined,
      });
    } else if (kind === 'sipyung') {
      candidate._agreementSipyungInput = formatted;
      candidate._agreementSipyungCleared = false;
      candidate._agreementSipyungAmount = parsed;
      updateCandidateOverride(candidate, {
        _agreementSipyungInput: formatted,
        _agreementSipyungCleared: false,
        _agreementSipyungAmount: parsed,
      });
    } else if (kind === 'management') {
      const clamped = clampScore(parsed, managementCap);
      if (clamped == null) return;
      const formattedScore = formatScore(clamped, 2);
      candidate._agreementManagementInput = formattedScore;
      candidate._agreementManagementManual = clamped;
      candidate._agreementManagementScore = clamped;
      candidate._agreementManagementScoreVersion = MANAGEMENT_SCORE_VERSION;
      updateCandidateOverride(candidate, {
        _agreementManagementInput: formattedScore,
        _agreementManagementManual: clamped,
        _agreementManagementScore: clamped,
        _agreementManagementScoreVersion: MANAGEMENT_SCORE_VERSION,
      });
    }
    candidateScoreCacheRef.current.clear();
    setCandidateMetricsVersion((prev) => prev + 1);
  }, [resolveCandidateBySlot, updateCandidateOverride, managementMax]);

  const {
    isInlineEditing: isAmountCellEditing,
    finishInlineEdit: finishAmountCellEdit,
    handleInlineEditKeyDown,
    getInlineEditTriggerProps,
  } = useBoardInlineEditing({
    onCommitEdit: ({ meta, kind }) => {
      const shouldCommitWithAmountBlur = kind === 'management' || kind === 'performance' || kind === 'sipyung';
      if (shouldCommitWithAmountBlur) handleAmountBlur(meta.groupIndex, meta.slotIndex, kind);
    },
  });

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

  const tableColumnCount = React.useMemo(() => {
    const baseColumns = 12
      + (credibilityEnabled ? 1 : 0)
      + (technicianEnabled ? 2 : 0)
      + (showConstructionExperience ? 1 : 0)
      + ((isMois30To50 || isEx50To100) ? 1 : 0)
      + (isKrail50To100 ? 1 : 0)
      + (isMois50To100 ? 2 : 0)
      + (isLh50To100 ? 2 : 0)
      + (showMiscScore ? 1 : 0)
      - (showManagementBonus ? 0 : 1)
      - (showBidScore ? 0 : 1)
      - (showNetCostBonus ? 0 : 1);
    const variableColumns = columnSpans.nameSpan
      + columnSpans.shareSpan
      + columnSpans.credibilitySpan
      + columnSpans.statusSpan
      + columnSpans.performanceSpan
      + columnSpans.technicianSpan
      + columnSpans.sipyungSpan;
    return baseColumns + variableColumns;
  }, [
    credibilityEnabled,
    showConstructionExperience,
    showManagementBonus,
    showBidScore,
    showMiscScore,
    showNetCostBonus,
    isMois30To50,
    isMois50To100,
    isEx50To100,
    isKrail50To100,
    isLh50To100,
    technicianEnabled,
    columnSpans,
  ]);

  const buildSlotMeta = (group, groupIndex, slotIndex, label) => {
    return buildBoardMemberMeta({
      group,
      groupIndex,
      slotIndex,
      label,
      participantMap,
      isDutyRegionCompany,
      groupQualityScores,
      isLHOwner,
      getQualityScoreValue,
      groupShareRawInputs,
      groupShares,
      parseNumeric,
      getSharePercent,
      getCandidateSipyungAmount,
      getCandidatePerformanceAmountForCurrentRange,
      getCandidateSummaryStatus,
      formatAmount,
      possibleShareBase,
      isSingleBidEligible,
      isWomenOwnedCompany,
      getCandidateManagerName,
      getCandidateManagementScore,
      isMois30To50,
      managementMax,
      managementScoreMax: MANAGEMENT_SCORE_MAX,
      clampScore,
      toNumber,
      formatScore,
      groupCredibility,
      krailCredibilityScale,
      groupTechnicianScores,
      conflictNotesByGroup,
      getCompanyName,
      hasRecentAwardHistory: isRecentAwardHistoryCompany,
      noticeDate,
      possibleShareFormatMode: isLh100To300 ? 'truncate' : 'round',
    });
  };

  const renderNameCell = (meta) => {
    const isDropTarget = dropTarget && dropTarget.groupIndex === meta.groupIndex && dropTarget.slotIndex === meta.slotIndex;
    const searchKey = buildBoardSearchKey(meta.groupIndex, meta.slotIndex);
    const isBoardSearchMatch = boardSearchOpen && boardSearchMatchKeySet.has(searchKey);
    const isBoardSearchActive = boardSearchOpen && boardSearchActiveKey === searchKey;
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
            onClick={() => handleBoardSlotClick(meta)}
          >
            <span aria-hidden="true">＋</span>
          </button>
        ) : (
          <div
            className={`excel-member-card${draggingId === meta.uid ? ' dragging' : ''}${pendingMoveSource?.uid === meta.uid ? ' move-source' : ''}${isBoardSearchMatch ? ' search-match' : ''}${isBoardSearchActive ? ' search-active' : ''}`}
            draggable
            onDragStart={handleDragStart(meta.uid, meta.groupIndex, meta.slotIndex)}
            onDragEnd={handleDragEnd}
            onClick={() => { void handleBoardSlotClick(meta); }}
            ref={(node) => registerBoardSearchCardRef(searchKey, node)}
            tabIndex={isBoardSearchMatch ? -1 : undefined}
          >
            <div className="excel-member-tags">
              {meta.tags.map((tag) => (
                <span key={`${meta.uid}-${tag.key}`} className={`excel-tag excel-tag-${tag.key}`}>{tag.label}</span>
              ))}
            </div>
            <div className="excel-member-header">
              <div
                className="excel-member-name"
                title={meta.companyName}
                style={meta.hasRecentAwardHistory ? { color: '#b91c1c', fontWeight: 800, display: 'inline-flex', alignItems: 'center' } : undefined}
              >
                {meta.companyName}
                {renderAwardHistoryMark(meta.hasRecentAwardHistory)}
              </div>
              <button
                type="button"
                className="excel-remove-btn"
                onClick={(event) => {
                  event.stopPropagation();
                  handleRemove(meta.groupIndex, meta.slotIndex);
                }}
              >제거</button>
            </div>
            {(meta.managerName || meta.dataStatusLabel) && (
              <div className="excel-member-sub">
                {meta.managerName && <span className="excel-badge">{meta.managerName}</span>}
                {meta.dataStatusLabel && (
                  <span className={`excel-badge excel-badge-${meta.dataStatusTone || 'stale'}`}>
                    {meta.dataStatusLabel}
                  </span>
                )}
              </div>
            )}
            {meta.possibleShareText && (
              <div className="excel-member-hint">가능 {meta.possibleShareText}</div>
            )}
            {meta.overLimit && (
              <div className="excel-member-warning">참여업체수 초과</div>
            )}
            {Array.isArray(meta.remarks) && meta.remarks.length > 0 && (
              <div className="excel-member-remark">
                <span className="remark-label">비고</span>
                <div className="remark-lines">
                  {meta.remarks.map((note, index) => (
                    <div key={`${meta.uid}-remark-${index}`} className="remark-line">{note}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </td>
    );
  };

  const renderShareCell = (meta) => {
    const displayedShare = meta.shareValue || (meta.shareForCalc != null ? formatShareDecimal(meta.shareForCalc) : '');
    const hasFractionalShare = hasFractionalShareValue(displayedShare || meta.shareForCalc);

    return (
      <td
        key={`share-${meta.groupIndex}-${meta.slotIndex}`}
        className={`excel-cell excel-share-cell${hasFractionalShare ? ' share-fractional' : ''}`}
      >
        {meta.empty ? null : (
          isAmountCellEditing(meta, 'share') ? (
            <input
              type="text"
              className="excel-amount-input excel-share-input"
              value={meta.shareValue}
              onChange={(event) => handleShareInput(meta.groupIndex, meta.slotIndex, event.target.value)}
              onBlur={() => finishAmountCellEdit(meta, 'share')}
              onKeyDown={(event) => handleInlineEditKeyDown(event, meta, 'share')}
              placeholder={meta.sharePlaceholder}
              autoFocus
            />
          ) : (
            <button
              type="button"
              className="excel-inline-edit-display excel-inline-edit-display-share"
              {...getInlineEditTriggerProps(meta, 'share')}
            >
              {displayedShare ? `${displayedShare}%` : '-'}
            </button>
          )
        )}
      </td>
    );
  };

  const renderCredibilityCell = (meta, rowSpan) => (
    <td key={`cred-${meta.groupIndex}-${meta.slotIndex}`} className="excel-cell excel-credibility-cell" rowSpan={rowSpan}>
      {meta.empty ? null : (
        <>
          {isLh100To300 ? (
            <>
              <div className="readonly-value">{meta.isDutyRegion ? '지역' : '-'}</div>
              <div className="excel-hint">
                {meta.isDutyRegion
                  ? `${meta.shareValue || (meta.shareForCalc != null ? formatShareDecimal(meta.shareForCalc) : '0')}%`
                  : ''}
              </div>
            </>
          ) : (
            isAmountCellEditing(meta, 'credibility') ? (
              <input
                type="text"
                className="excel-amount-input excel-credibility-input"
                value={meta.credibilityValue || ''}
                onChange={(event) => handleCredibilityInput(meta.groupIndex, meta.slotIndex, event.target.value)}
                onBlur={() => finishAmountCellEdit(meta, 'credibility')}
                onKeyDown={(event) => handleInlineEditKeyDown(event, meta, 'credibility')}
                placeholder="0"
                autoFocus
              />
            ) : (
              <button
                type="button"
                className="excel-inline-edit-display"
                {...getInlineEditTriggerProps(meta, 'credibility')}
              >
                {meta.credibilityValue || '0'}
              </button>
            )
          )}
          {!isLh100To300 && meta.credibilityProduct && (
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
        isAmountCellEditing(meta, 'technician') ? (
          <input
            type="text"
            className="excel-amount-input"
            value={meta.technicianValue || ''}
            onChange={(event) => handleTechnicianInput(meta.groupIndex, meta.slotIndex, event.target.value)}
            onBlur={() => finishAmountCellEdit(meta, 'technician')}
            onKeyDown={(event) => handleInlineEditKeyDown(event, meta, 'technician')}
            placeholder="0"
            autoFocus
            disabled={!technicianEditable}
          />
        ) : (
          <button
            type="button"
            className="excel-inline-edit-display"
            {...getInlineEditTriggerProps(meta, 'technician', { disabled: !technicianEditable })}
          >
            {meta.technicianValue || '0'}
          </button>
        )
      )}
    </td>
  );

  const renderStatusCell = (meta, rowSpan) => (
    <td key={`status-${meta.groupIndex}-${meta.slotIndex}`} className="excel-cell excel-status-cell" rowSpan={rowSpan}>
      {meta.empty ? null : (
        <div className={`excel-status score-only ${meta.managementAlert ? 'warn' : ''}${meta.managementOk ? ' ok' : ''}`}>
          {isAmountCellEditing(meta, 'management') ? (
            <input
              type="text"
              className="excel-amount-input excel-status-input"
              value={meta.managementInput || ''}
              onChange={(event) => handleAmountInput(meta.groupIndex, meta.slotIndex, event.target.value, 'management')}
              onBlur={() => finishAmountCellEdit(meta, 'management')}
              onKeyDown={(event) => handleInlineEditKeyDown(event, meta, 'management')}
              placeholder={meta.managementDisplay}
              title="경영점수"
              autoFocus
            />
          ) : (
            <button
              type="button"
              className="excel-inline-edit-display"
              {...getInlineEditTriggerProps(meta, 'management')}
            >
              {meta.managementDisplay || '-'}
            </button>
          )}
          {meta.managementModified && (
            <span className="excel-amount-modified">수정됨</span>
          )}
        </div>
      )}
    </td>
  );

  const renderPerformanceCell = (meta, rowSpan) => (
    <td key={`perf-${meta.groupIndex}-${meta.slotIndex}`} className="excel-cell excel-perf-cell" rowSpan={rowSpan}>
      {meta.empty ? null : (
        <div className="excel-performance">
          <span className="perf-label">{performanceAmountLabel}</span>
          {isAmountCellEditing(meta, 'performance') ? (
            <input
              type="text"
              className="excel-amount-input"
              value={meta.performanceInput || ''}
              onChange={(event) => handleAmountInput(meta.groupIndex, meta.slotIndex, event.target.value, 'performance')}
              onBlur={() => finishAmountCellEdit(meta, 'performance')}
              onKeyDown={(event) => handleInlineEditKeyDown(event, meta, 'performance')}
              placeholder={meta.performanceDisplay}
              autoFocus
            />
          ) : (
            <button
              type="button"
              className="excel-inline-edit-display"
              {...getInlineEditTriggerProps(meta, 'performance')}
            >
              {meta.performanceDisplay || '-'}
            </button>
          )}
          {meta.performanceModified && (
            <span className="excel-amount-modified">수정됨</span>
          )}
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
          {isAmountCellEditing(meta, 'sipyung') ? (
            <input
              type="text"
              className="excel-amount-input"
              value={meta.sipyungInput || ''}
              onChange={(event) => handleAmountInput(meta.groupIndex, meta.slotIndex, event.target.value, 'sipyung')}
              onBlur={() => finishAmountCellEdit(meta, 'sipyung')}
              onKeyDown={(event) => handleInlineEditKeyDown(event, meta, 'sipyung')}
              placeholder={meta.sipyungDisplay}
              autoFocus
            />
          ) : (
            <button
              type="button"
              className="excel-inline-edit-display"
              {...getInlineEditTriggerProps(meta, 'sipyung')}
            >
              {meta.sipyungDisplay || '-'}
            </button>
          )}
          {meta.sipyungModified && (
            <span className="excel-amount-modified">수정됨</span>
          )}
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
    const emphasizeQuality = selectedRangeOption?.key === LH_100_TO_300_KEY;
    const highlightQualityStyle = { backgroundColor: '#fff3b0' };
    const qualityGuide = (selectedRangeOption?.key === LH_100_TO_300_KEY)
      ? '94점이상:4점/91점이상:3.5점/88점이상:3점/85점이상:2.5점/85점미만:2점'
      : (selectedRangeOption?.key === 'lh-50to100')
      ? '90점이상:5점/88점이상:3점/85점이상:2점/83점이상:1.5점/80점이상:1점'
      : '품질 88점이상:3점/85점이상:2점/83점이상:1.5점/80점이상:1점';
    const nameSpan = columnSpans.nameSpan;
    const shareSpan = columnSpans.shareSpan;
    const guideSpan = 1 + nameSpan;
    const usedColumns = 4 + nameSpan + shareSpan;
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
      <tr key={`${group.id}-quality`} className="excel-board-row quality-row">
        <td className="excel-cell quality-empty" />
        <td className="excel-cell order-cell quality-label" style={emphasizeQuality ? { fontWeight: 800 } : undefined}>품질</td>
        <td className="excel-cell quality-guide" colSpan={guideSpan}>
          {qualityGuide}
        </td>
        {collapsedColumns.share ? (
          <td className="excel-cell collapsed-stub-cell share-stub" />
        ) : (
          slotMetas.map((meta) => (
            (() => {
              const qualityScoreValue = toNumber(meta.qualityScore);
              const isAboveDefault = qualityScoreValue != null && qualityScoreValue > lhQualityDefault;
              const cellStyle = {
                ...(emphasizeQuality ? { fontWeight: 800 } : {}),
                ...(isAboveDefault ? highlightQualityStyle : {}),
              };
              return (
                <td
                  key={`quality-share-${groupIndex}-${meta.slotIndex}`}
                  className="excel-cell excel-share-cell quality-score"
                  style={cellStyle}
                >
                  {meta.empty ? '' : (
                isAmountCellEditing(meta, 'quality') ? (
                  <input
                    type="text"
                    inputMode="decimal"
                    className="excel-amount-input quality-score-input"
                    style={isAboveDefault ? highlightQualityStyle : undefined}
                    value={meta.qualityInput !== undefined && meta.qualityInput !== null
                      ? String(meta.qualityInput)
                      : (meta.qualityScore != null ? String(meta.qualityScore) : '')}
                    onChange={(event) => handleQualityScoreChange(groupIndex, meta.slotIndex, event.target.value)}
                    onBlur={() => finishAmountCellEdit(meta, 'quality')}
                    onKeyDown={(event) => handleInlineEditKeyDown(event, meta, 'quality')}
                    placeholder={meta.qualityScore != null ? String(meta.qualityScore) : ''}
                    autoFocus
                  />
                ) : (
                  <button
                    type="button"
                    className="excel-inline-edit-display"
                    style={cellStyle}
                    {...getInlineEditTriggerProps(meta, 'quality')}
                  >
                    {(() => {
                      const shown = meta.qualityInput !== undefined && meta.qualityInput !== null && meta.qualityInput !== ''
                        ? String(meta.qualityInput)
                        : (meta.qualityScore != null ? formatScore(meta.qualityScore, 2) : '');
                      return shown || '-';
                    })()}
                  </button>
                )
                  )}
                </td>
              );
            })()
          ))
        )}
        <td className="excel-cell total-cell quality-total" style={emphasizeQuality ? { fontWeight: 800 } : undefined}>{qualityTotalDisplay}</td>
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
    const constructionExperienceScore = showConstructionExperience
      ? resolveConstructionExperienceScore(summaryInfo?.performanceScore, qualityPoints)
      : null;
    const performanceScoreForTotal = summaryInfo?.performanceScore;
    const miscScore = showMiscScore ? 17 : null;
    const lhSimpleTotalScore = showMiscScore
      ? (
        (toNumber(summaryInfo?.managementScore) || 0)
          + (toNumber(summaryInfo?.performanceScore) || 0)
          + (toNumber(qualityPoints) || 0)
          + (toNumber(summaryInfo?.credibilityScore) || 0)
          + (miscScore || 0)
      )
      : null;
    const totalScore = lhSimpleTotalScore != null
      ? lhSimpleTotalScore
      : (baseTotalScore != null
        ? (isLHOwner
          ? (showConstructionExperience
            ? baseTotalScore - (performanceScoreForTotal || 0) + (constructionExperienceScore || 0)
            : baseTotalScore)
          : baseTotalScore)
        : null);
    const totalMax = lhSimpleTotalScore != null
      ? 40
      : (baseTotalMax != null
        ? (isLHOwner
          ? (showConstructionExperience
            ? baseTotalMax - (summaryInfo?.performanceMax || 0) + CONSTRUCTION_EXPERIENCE_SCORE_MAX
            : baseTotalMax)
          : baseTotalMax)
        : null);
    if (totalScore != null && (isLh100To300 ? 40 : (isLHOwner ? LH_FULL_SCORE : (ownerKeyUpper === 'PPS' ? PPS_FULL_SCORE : totalMax))) != null) {
      const threshold = isLh100To300 ? 40 : (isLHOwner ? LH_FULL_SCORE : (ownerKeyUpper === 'PPS' ? PPS_FULL_SCORE : totalMax));
      scoreState = totalScore >= (threshold - 0.01) ? 'full' : 'partial';
    }
    const managementSummary = summaryInfo?.managementScore != null
      ? formatScore(summaryInfo.managementScore, resolveSummaryDigits('management'))
      : '-';
    const performanceSummary = summaryInfo?.performanceScore != null
      ? formatScore(summaryInfo.performanceScore, resolveSummaryDigits('performance'))
      : '-';
    const performanceCoefficientValue = isLh100To300
      ? (() => {
        const amount = toNumber(summaryInfo?.performanceAmount);
        if (amount == null || !(perfectPerformanceAmount > 0)) return null;
        return amount / perfectPerformanceAmount;
      })()
      : null;
    const performanceCoefficientDisplay = isLh100To300
      ? (performanceCoefficientValue != null ? formatScore(performanceCoefficientValue, 4) : '-')
      : null;
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
    const credibilityFull = showMiscScore
      && toNumber(summaryInfo?.credibilityScore) != null
      && toNumber(summaryInfo?.credibilityScore) >= 0.3 - 0.0001;
    const credibilityWarn = showMiscScore
      && toNumber(summaryInfo?.credibilityScore) != null
      && toNumber(summaryInfo?.credibilityScore) < 0.3 - 0.0001;
    const qualityPointsDisplay = isLHOwner
      ? (qualityPoints != null ? formatScore(qualityPoints, resolveSummaryDigits('quality')) : '-')
      : null;
    const constructionExperienceDisplay = showConstructionExperience
      ? (constructionExperienceScore != null ? formatScore(constructionExperienceScore, resolveSummaryDigits('performance')) : '-')
      : null;
    const constructionExperienceWarn = showConstructionExperience
      && constructionExperienceScore != null
      && constructionExperienceScore < CONSTRUCTION_EXPERIENCE_SCORE_MAX;
    const qualityPointsState = (isLHOwner && qualityPoints != null && qualityPoints < 2) ? 'warn' : '';
    const subcontractDisplay = (isMois30To50 || isMois50To100 || isEx50To100 || isKrail50To100 || isLh50To100)
      ? (summaryInfo?.subcontractScore != null ? formatScore(summaryInfo.subcontractScore, resolveSummaryDigits('subcontract')) : '-')
      : null;
    const materialDisplay = (isLh50To100 || isMois50To100)
      ? (summaryInfo?.materialScore != null ? formatScore(summaryInfo.materialScore, resolveSummaryDigits('material')) : '-')
      : null;
    const bidScoreDisplay = summaryInfo?.bidScore != null ? formatScore(summaryInfo.bidScore, resolveSummaryDigits('bid')) : '-';
    const miscScoreDisplay = showMiscScore ? formatScore(miscScore, 0) : null;
    const netCostBonusDisplay = showNetCostBonus && summaryInfo?.netCostBonusScore != null
      ? formatScore(summaryInfo.netCostBonusScore, resolveSummaryDigits('netCost'))
      : (showNetCostBonus ? '0' : null);
    const totalScoreDisplay = totalScore != null
      ? formatScore(totalScore, resolveSummaryDigits('total'))
      : '-';
    const entryDisabled = entryModeResolved === 'none';
    const sipyungValue = entryModeResolved === 'sum'
      ? summaryInfo?.sipyungSum
      : (entryModeResolved === 'ratio' ? summaryInfo?.sipyungWeighted : null);
    const sipyungSummaryDisplay = sipyungValue != null ? formatAmount(sipyungValue) : '-';
    const approvalValue = groupApprovals[groupIndex] || '';
    const rightRowSpan = isLHOwner ? 2 : undefined;
    const bonusChecked = showManagementBonus && Boolean(groupManagementBonus[groupIndex]);

    const managementState = summaryInfo?.managementScore != null
      ? (summaryInfo.managementScore >= ((summaryInfo.managementMax ?? managementMax) - 0.01) ? 'ok' : 'warn')
      : '';
    const performanceState = summaryInfo?.performanceScore != null
      ? (summaryInfo.performanceScore >= ((summaryInfo.performanceMax ?? ownerPerformanceFallback) - 0.01) ? 'ok' : 'warn')
      : '';

    const entryFailed = summaryInfo?.entryLimit != null
      && summaryInfo.entryMode !== 'none'
      && summaryInfo.entrySatisfied === false;
    const entryFailedRemark = entryFailed ? '참가자격 미달(시평액)' : '';
    const slotMetasWithRemarks = entryFailedRemark
      ? slotMetasWithLimit.map((meta) => ({
        ...meta,
        remarks: Array.isArray(meta.remarks)
          ? (meta.remarks.includes(entryFailedRemark) ? meta.remarks : [...meta.remarks, entryFailedRemark])
          : [entryFailedRemark],
      }))
      : slotMetasWithLimit;

    const renderCollapsedStubCell = (key, rowSpan) => (
      <td
        key={`${group.id}-${key}-stub`}
        className={`excel-cell collapsed-stub-cell ${key}-stub`}
        rowSpan={rowSpan}
      />
    );

    return (
      <React.Fragment key={group.id}>
        <tr className="excel-board-row">
        <td className={`excel-cell select-cell${collapsedColumns.select ? ' collapsed-stub-cell select-stub' : ''}`}>
          {!collapsedColumns.select && (
            <input
              type="checkbox"
              checked={selectedGroups.has(groupIndex)}
              onChange={() => toggleGroupSelection(groupIndex)}
              aria-label={`${group.id}번 협정 선택`}
            />
          )}
        </td>
        <td className={`excel-cell order-cell${scoreState ? ` score-${scoreState}` : ''}${collapsedColumns.order ? ' collapsed-stub-cell order-stub' : ''}`}>
          {collapsedColumns.order ? '' : group.id}
        </td>
        <td className={`excel-cell approval-cell${collapsedColumns.approval ? ' collapsed-stub-cell approval-stub' : ''}`}>
          {!collapsedColumns.approval && (
            <select
              className={getApprovalCellClassName(approvalValue).trim()}
              value={approvalValue}
              onChange={(event) => handleApprovalChange(groupIndex, event.target.value)}
            >
              <option value="">선택</option>
              <option value="알림">알림</option>
              <option value="추가">추가</option>
              <option value="정정">정정</option>
              <option value="취소">취소</option>
            </select>
          )}
        </td>
        {collapsedColumns.name
          ? renderCollapsedStubCell('name')
          : slotMetasWithRemarks.map((meta) => renderNameCell(meta))}
        {collapsedColumns.share
          ? renderCollapsedStubCell('share')
          : slotMetasWithLimit.map(renderShareCell)}
        <td className={`excel-cell total-cell share-total-cell ${summaryInfo?.shareComplete ? 'ok' : 'warn'}`}>
          <div>{shareSumDisplay}</div>
          {dutyShareInsufficient && (
            <div className="excel-warning">의무지분 미충족</div>
          )}
        </td>
        {showCredibilityBeforeStatus && showCredibilitySlots && (collapsedColumns.credibility
          ? renderCollapsedStubCell('credibility', rightRowSpan)
          : slotMetas.map((meta) => renderCredibilityCell(meta, rightRowSpan)))}
        {showCredibilityBeforeStatus && (
          <td
            className={`excel-cell total-cell credibility-total-cell${credibilityFull ? ' technician-good' : ''}${credibilityWarn ? ' technician-warn' : ''}`}
            rowSpan={rightRowSpan}
            style={credibilityWarn ? { color: '#b91c1c', fontWeight: 800 } : undefined}
          >
            {isLh100To300 ? (
              <>
                <div>{credibilitySummary}</div>
                <div className="excel-hint">{dutyShareTotal > 0 ? formatPercent(dutyShareTotal) : '-'}</div>
              </>
            ) : credibilitySummary}
          </td>
        )}
        {collapsedColumns.status
          ? renderCollapsedStubCell('status', rightRowSpan)
          : slotMetas.map((meta) => renderStatusCell(meta, rightRowSpan))}
        <td className={`excel-cell total-cell management-summary-cell ${managementState}`} rowSpan={rightRowSpan}>
          {managementSummary}
        </td>
        {showManagementBonus && (
          <td className="excel-cell management-bonus-cell" rowSpan={rightRowSpan}>
            <input
              type="checkbox"
              checked={bonusChecked}
              onChange={() => handleManagementBonusToggle(groupIndex)}
              aria-label="경영점수 가점 적용"
            />
          </td>
        )}
        {collapsedColumns.performance
          ? renderCollapsedStubCell('performance', rightRowSpan)
          : slotMetas.map((meta) => renderPerformanceCell(meta, rightRowSpan))}
        {isLh100To300 && (
          <td className="excel-cell total-cell performance-coefficient-cell" rowSpan={rightRowSpan}>
            {performanceCoefficientDisplay}
          </td>
        )}
        <td className={`excel-cell total-cell performance-summary-cell ${performanceState}`} rowSpan={rightRowSpan}>
          {performanceSummary}
        </td>
        {technicianEnabled && (collapsedColumns.technician
          ? renderCollapsedStubCell('technician', rightRowSpan)
          : slotMetas.map((meta) => renderTechnicianCell(meta, rightRowSpan)))}
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
            style={isLh100To300 ? { fontWeight: 800 } : undefined}
          >
            {qualityPointsDisplay}
          </td>
        )}
        {showCredibilityAfterQuality && showCredibilitySlots && (collapsedColumns.credibility
          ? renderCollapsedStubCell('credibility', rightRowSpan)
          : slotMetas.map((meta) => renderCredibilityCell(meta, rightRowSpan)))}
        {showCredibilityAfterQuality && (
          <td
            className={`excel-cell total-cell credibility-total-cell${credibilityFull ? ' technician-good' : ''}${credibilityWarn ? ' technician-warn' : ''}`}
            rowSpan={rightRowSpan}
            style={credibilityFull ? { color: '#15803d', fontWeight: 800 } : (credibilityWarn ? { color: '#b91c1c', fontWeight: 800 } : undefined)}
          >
            {isLh100To300 ? (
              <>
                <div>{credibilitySummary}</div>
                <div className="excel-hint">{dutyShareTotal > 0 ? formatPercent(dutyShareTotal) : '-'}</div>
              </>
            ) : credibilitySummary}
          </td>
        )}
        {showMiscScore && (
          <td className="excel-cell total-cell misc-score-cell" rowSpan={rightRowSpan}>
            {miscScoreDisplay}
          </td>
        )}
        {showConstructionExperience && (
          <td
            className={`excel-cell total-cell construction-experience-cell${constructionExperienceWarn ? ' construction-experience-warn' : ''}`}
            rowSpan={rightRowSpan}
          >
            {constructionExperienceDisplay}
          </td>
        )}
        {(isLh50To100 || isMois50To100) && (
          <td className="excel-cell total-cell subcontract-cell" rowSpan={rightRowSpan}>{subcontractDisplay}</td>
        )}
        {(isLh50To100 || isMois50To100) && (
          <td className="excel-cell total-cell material-cell" rowSpan={rightRowSpan}>{materialDisplay}</td>
        )}
        {(isMois30To50 || isEx50To100 || isKrail50To100) && (
          <td className="excel-cell total-cell subcontract-cell" rowSpan={rightRowSpan}>{subcontractDisplay}</td>
        )}
        {showBidScore && (
          <td className="excel-cell total-cell bid-score-cell" rowSpan={rightRowSpan}>{bidScoreDisplay}</td>
        )}
        {showNetCostBonus && (
          <td className="excel-cell total-cell netcost-bonus-cell" rowSpan={rightRowSpan}>{netCostBonusDisplay}</td>
        )}
        <td
          className={`excel-cell total-cell total-score-cell total-score${scoreState ? ` score-${scoreState}` : ''}`}
          rowSpan={rightRowSpan}
        >
          {totalScoreDisplay}
        </td>
        {collapsedColumns.sipyung
          ? renderCollapsedStubCell('sipyung', rightRowSpan)
          : slotMetas.map((meta) => renderSipyungCell(meta, rightRowSpan, entryDisabled))}
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
  const headerSummaryText = [
    ownerLabel || '',
    selectedRangeOption?.label || '',
    industryLabel || '',
    headerDutySummary || '',
    estimatedAmount ? `추정 ${formatAmount(estimatedAmount)}` : '',
  ].filter(Boolean).join(' · ');

  const boardMarkup = (
    <>
      <div className={`agreement-board-root${headerCollapsed ? ' header-collapsed' : ''}`} ref={rootRef}>
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
                  {(ownerKeyUpper === 'PPS' || isMois30To50 || isMois50To100) && (
                    <span className="field-label sub">(추정가격 × 1.1배)</span>
                  )}
                  <AmountInput value={baseAmount || ''} onChange={handleBaseAmountChange} placeholder="원" />
                </div>
                {((isLH && !isLh100To300) || isMois50To100) && (
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
        {isLH && !isLh100To300 && (
          <>
            <div className="excel-field-block size-xs">
              <span className="field-label">순공사원가가점</span>
              <input
                className="input"
                value={netCostBonusOverride ?? ''}
                onChange={handleNetCostBonusOverrideChange}
                placeholder={formatScore(netCostBonusScore, 2)}
              />
              {netCostBonusNotice && (
                <div className="readonly-note">{netCostBonusNotice}</div>
              )}
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
                  {isMois50To100 && (
                    <div className="readonly-note a-value-warning-note">A값 반드시 확인하세요!</div>
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
                      onBlur={commitBidTimeInputs}
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
                      onBlur={commitBidTimeInputs}
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
              <div className="excel-toolbar-search">
                <button
                  type="button"
                  className={`excel-btn${boardSearchOpen ? ' primary' : ''}`}
                  onClick={openBoardSearchPopup}
                >
                  검색
                </button>
                <button
                  type="button"
                  className={`excel-btn excel-btn-candidate${candidateWindowOpen ? ' active' : ''}`}
                  onClick={() => setCandidateWindowOpen((prev) => !prev)}
                >
                  후보 {candidateDrawerEntries.length > 0 ? `(${candidateDrawerEntries.length})` : ''}
                </button>
                {isLh100To300 && (
                  <button
                    type="button"
                    className={`excel-btn${awardHistoryWindowOpen ? ' primary' : ''}`}
                    onClick={() => setAwardHistoryWindowOpen((prev) => !prev)}
                  >
                    낙찰이력업체
                  </button>
                )}
              </div>
            <div className="excel-toolbar-actions">
                <button
                  type="button"
                  className={`excel-btn excel-btn-header-toggle${headerCollapsed ? ' active' : ''}`}
                  onClick={() => setHeaderCollapsed((prev) => !prev)}
                >{headerCollapsed ? '헤더 펼치기' : '헤더 접기'}</button>
                {headerCollapsed && (
                  <div className="excel-header-summary" title={headerSummaryText}>
                    {headerSummaryText || '요약 정보 없음'}
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleOpenExportModal}
                  className="excel-btn"
                  disabled={exporting}
                >엑셀로 내보내기</button>
                <button type="button" className="excel-btn" onClick={handleGenerateText}>협정 문자 생성</button>
                <button
                  type="button"
                  className="excel-btn"
                  onClick={handleGenerateInconMemo}
                  style={{ background: '#eef6d8', borderColor: '#b7d48a', color: '#3f5f1e' }}
                >
                  아이건설넷 메모
                </button>
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
                    className="excel-btn excel-btn-technician"
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
              {collapsedColumns.name ? (
                <col className="col-name col-collapsed-stub" style={{ width: resolveColWidth('name') }} />
              ) : (
                slotLabels.map((_, index) => (
                  <col key={`col-name-${index}`} className="col-name" style={{ width: resolveColWidth('name') }} />
                ))
              )}
                {collapsedColumns.share ? (
                  <col className="col-share col-collapsed-stub" style={{ width: resolveColWidth('share') }} />
                ) : (
                  slotLabels.map((_, index) => (
                    <col key={`col-share-${index}`} className="col-share" style={{ width: resolveColWidth('share') }} />
                  ))
                )}
                <col className="col-share-total" style={{ width: `${COLUMN_WIDTHS.shareTotal}px` }} />
                {showCredibilityBeforeStatus && showCredibilitySlots && (
                  collapsedColumns.credibility ? (
                    <col
                      className="col-credibility-slot col-collapsed-stub"
                      style={{ width: resolveColWidth('credibilityCell', 'credibility') }}
                    />
                  ) : (
                    slotLabels.map((_, index) => (
                      <col
                        key={`col-credibility-slot-${index}`}
                        className="col-credibility-slot"
                        style={{ width: resolveColWidth('credibilityCell', 'credibility') }}
                      />
                    ))
                  )
                )}
                {showCredibilityBeforeStatus && (
                  <col className="col-credibility" style={{ width: `${COLUMN_WIDTHS.credibility}px` }} />
                )}
                  {collapsedColumns.status ? (
                    <col className="col-status col-collapsed-stub" style={{ width: resolveColWidth('status') }} />
                  ) : (
                    slotLabels.map((_, index) => (
                      <col key={`col-status-${index}`} className="col-status" style={{ width: resolveColWidth('status') }} />
                    ))
                  )}
                  <col className="col-management" style={{ width: `${COLUMN_WIDTHS.management}px` }} />
                  {showManagementBonus && <col className="col-management-bonus" style={{ width: resolveColWidth('managementBonus') }} />}
              {collapsedColumns.performance ? (
                <col
                  className="col-performance col-collapsed-stub"
                  style={{ width: resolveColWidth('performanceCell', 'performance') }}
                />
              ) : (
                slotLabels.map((_, index) => (
                  <col
                    key={`col-performance-${index}`}
                    className="col-performance"
                    style={{ width: resolveColWidth('performanceCell', 'performance') }}
                  />
                ))
              )}
              {isLh100To300 && <col className="col-performance-coefficient" style={{ width: `${COLUMN_WIDTHS.performanceCoefficient}px` }} />}
              <col className="col-performance-summary" style={{ width: `${COLUMN_WIDTHS.performanceSummary}px` }} />
              {technicianEnabled && (
                collapsedColumns.technician ? (
                  <col
                    className="col-technician col-collapsed-stub"
                    style={{ width: resolveColWidth('technicianCell', 'technician') }}
                  />
                ) : (
                  slotLabels.map((_, index) => (
                    <col
                      key={`col-technician-${index}`}
                      className="col-technician"
                      style={{ width: resolveColWidth('technicianCell', 'technician') }}
                    />
                  ))
                )
              )}
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
              {showConstructionExperience && <col className="col-construction-experience" style={{ width: `${constructionExperienceColWidth}px` }} />}
                {showCredibilityAfterQuality && showCredibilitySlots && (
                  collapsedColumns.credibility ? (
                  <col
                    className="col-credibility-slot col-collapsed-stub"
                    style={{ width: resolveColWidth('credibilityCell', 'credibility') }}
                  />
                ) : (
                  slotLabels.map((_, index) => (
                    <col
                      key={`col-credibility-slot-late-${index}`}
                      className="col-credibility-slot"
                      style={{ width: resolveColWidth('credibilityCell', 'credibility') }}
                    />
                  ))
                )
              )}
              {showCredibilityAfterQuality && (
                <col className="col-credibility" style={{ width: `${COLUMN_WIDTHS.credibility}px` }} />
              )}
              {showMiscScore && <col className="col-misc-score" style={{ width: `${COLUMN_WIDTHS.bid}px` }} />}
              {(isLh50To100 || isMois50To100) && <col className="col-subcontract" style={{ width: `${subcontractColWidth}px` }} />}
              {(isLh50To100 || isMois50To100) && <col className="col-material" style={{ width: `${materialColWidth}px` }} />}
              {(isMois30To50 || isEx50To100 || isKrail50To100) && (
                <col className="col-subcontract" style={{ width: resolveColWidth('subcontract') }} />
              )}
              {showBidScore && <col className="col-bid" style={{ width: `${COLUMN_WIDTHS.bid}px` }} />}
              {showNetCostBonus && <col className="col-netcost-bonus" style={{ width: `${netCostBonusColWidth}px` }} />}
              <col className="col-total" style={{ width: `${COLUMN_WIDTHS.total}px` }} />
              {collapsedColumns.sipyung ? (
                <col
                  className="col-sipyung col-collapsed-stub"
                  style={{ width: resolveColWidth('sipyungCell', 'sipyung') }}
                />
              ) : (
                slotLabels.map((_, index) => (
                  <col
                    key={`col-sipyung-${index}`}
                    className="col-sipyung"
                    style={{ width: resolveColWidth('sipyungCell', 'sipyung') }}
                  />
                ))
              )}
              <col className="col-sipyung-summary" style={{ width: `${COLUMN_WIDTHS.sipyungSummary}px` }} />
            </colgroup>
            <thead>
              <tr>
                <th rowSpan="2" className="col-header select-header">{renderColToggle('select', '선택')}</th>
                <th rowSpan="2" className="col-header order-header">{renderColToggle('order', '연번')}</th>
                <th rowSpan="2" className="col-header approval-header">{renderColToggle('approval', '승인')}</th>
                <th
                  colSpan={collapsedColumns.name ? 1 : slotLabels.length}
                  rowSpan={collapsedColumns.name ? 2 : undefined}
                  className="col-header name-header"
                >
                  {renderColToggle('name', '업체명')}
                </th>
                <th
                  colSpan={collapsedColumns.share ? 1 : slotLabels.length}
                  rowSpan={collapsedColumns.share ? 2 : undefined}
                  className="col-header share-header"
                >
                  {renderColToggle('share', '지분(%)')}
                </th>
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
                    {showCredibilityBeforeStatus && showCredibilitySlots && (
                      <th
                        colSpan={collapsedColumns.credibility ? 1 : slotLabels.length}
                        rowSpan={collapsedColumns.credibility ? 2 : undefined}
                        className="col-header credibility-header"
                      >
                    {renderColToggle('credibility', credibilityLabel)}
                      </th>
                    )}
                  {showCredibilityBeforeStatus && (
                    <th rowSpan="2" className="col-header credibility-total-header">
                      {Number.isFinite(ownerCredibilityMax)
                        ? `${credibilityLabel} 합(${formatScore(ownerCredibilityMax, 1)}점)`
                        : `${credibilityLabel} 합`}
                    </th>
                  )}
                <th
                  colSpan={collapsedColumns.status ? 1 : slotLabels.length}
                  rowSpan={collapsedColumns.status ? 2 : undefined}
                  className="col-header status-header"
                >
                  {renderColToggle('status', '경영상태')}
                </th>
                <th rowSpan="2" className="col-header management-header">
                  {`경영(${formatScore(managementHeaderMax, 0)}점)`}
                </th>
                {showManagementBonus && (
                  <th rowSpan="2" className="col-header management-bonus-header">{renderColToggle('managementBonus', '가점')}</th>
                )}
                <th
                  colSpan={collapsedColumns.performance ? 1 : slotLabels.length}
                  rowSpan={collapsedColumns.performance ? 2 : undefined}
                  className="col-header performance-header"
                >
                  {renderColToggle('performance', '시공실적')}
                </th>
                {isLh100To300 && (
                  <th rowSpan="2" className="col-header performance-coefficient-header">
                    실적계수
                  </th>
                )}
                <th rowSpan="2" className="col-header performance-summary-header">
                  {`실적(${formatScore(performanceHeaderMax, 0)}점)`}
                </th>
                {technicianEnabled && (
                  <th
                    colSpan={collapsedColumns.technician ? 1 : slotLabels.length}
                    rowSpan={collapsedColumns.technician ? 2 : undefined}
                    className="col-header technician-header"
                  >
                    {renderColToggle('technician', '기술자점수')}
                  </th>
                )}
                {technicianEnabled && (
                  <th rowSpan="2" className="col-header technician-summary-header">
                    {isKrailOwner ? '기술자합산' : renderColToggle('technicianSummary', '기술자합산')}
                  </th>
                )}
                {technicianEnabled && (
                  <th rowSpan="2" className="col-header technician-ability-header">
                    {isKrailOwner
                      ? (technicianAbilityMax != null
                        ? `기술능력(${formatScore(technicianAbilityMax, 0)}점)`
                        : '기술능력')
                      : renderColToggle(
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
                {showConstructionExperience && (
                  <th rowSpan="2" className="col-header construction-experience-header">
                    시공경험점수
                  </th>
                )}
                {showCredibilityAfterQuality && showCredibilitySlots && (
                  <th
                    colSpan={collapsedColumns.credibility ? 1 : slotLabels.length}
                    rowSpan={collapsedColumns.credibility ? 2 : undefined}
                    className="col-header credibility-header"
                  >
                    {renderColToggle('credibility', credibilityLabel)}
                  </th>
                )}
                {showCredibilityAfterQuality && (
                  <th rowSpan="2" className="col-header credibility-total-header">
                    {Number.isFinite(ownerCredibilityMax)
                      ? `${credibilityLabel} 합(${formatScore(ownerCredibilityMax, 1)}점)`
                      : `${credibilityLabel} 합`}
                  </th>
                )}
                {showMiscScore && (
                  <th rowSpan="2" className="col-header misc-score-header">
                    기타점수
                  </th>
                )}
                {(isLh50To100 || isMois50To100) && (
                  <th rowSpan="2" className="col-header subcontract-header">
                    하도급
                  </th>
                )}
                {(isLh50To100 || isMois50To100) && (
                  <th rowSpan="2" className="col-header material-header">
                    자재
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
                {isKrail50To100 && (
                  <th rowSpan="2" className="col-header subcontract-header">
                    {renderColToggle('subcontract', '하도급및자재', { collapsedLabel: '하도급' })}
                  </th>
                )}
                {showBidScore && <th rowSpan="2" className="col-header bid-header">입찰점수</th>}
                {showNetCostBonus && <th rowSpan="2" className="col-header netcost-header">순공사원가가점</th>}
                <th rowSpan="2" className="col-header total-header">예상점수</th>
                <th
                  colSpan={collapsedColumns.sipyung ? 1 : slotLabels.length}
                  rowSpan={collapsedColumns.sipyung ? 2 : undefined}
                  className="col-header sipyung-header"
                >
                  {renderColToggle('sipyung', '시평액')}
                </th>
                <th rowSpan="2" className="col-header sipyung-summary-header">
                  {sipyungSummaryLabel}
                </th>
              </tr>
              <tr>
                {!collapsedColumns.name && slotLabels.map((label, index) => (
                  <th key={`name-head-${index}`} className="subheader-name">{label}</th>
                ))}
                {!collapsedColumns.share && slotLabels.map((label, index) => (
                  <th key={`share-head-${index}`} className="subheader-share">{label}</th>
                ))}
                {showCredibilityBeforeStatus && showCredibilitySlots && !collapsedColumns.credibility && slotLabels.map((label, index) => (
                  <th key={`credibility-head-${index}`} className="subheader-credibility">{label}</th>
                ))}
                {!collapsedColumns.status && slotLabels.map((label, index) => (
                  <th key={`status-head-${index}`} className="subheader-status">{label}</th>
                ))}
                {!collapsedColumns.performance && slotLabels.map((label, index) => (
                  <th key={`perf-head-${index}`} className="subheader-performance">{label}</th>
                ))}
                {technicianEnabled && !collapsedColumns.technician && slotLabels.map((label, index) => (
                  <th key={`tech-head-${index}`} className="subheader-technician">{label}</th>
                ))}
                {showCredibilityAfterQuality && showCredibilitySlots && !collapsedColumns.credibility && slotLabels.map((label, index) => (
                  <th key={`credibility-head-late-${index}`} className="subheader-credibility">{label}</th>
                ))}
                {!collapsedColumns.sipyung && slotLabels.map((label, index) => (
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
      {boardSearchOpen && (
        <div className="excel-board-search-overlay" onClick={closeBoardSearchPopup}>
          <div className="excel-board-search-modal" onClick={(event) => event.stopPropagation()}>
            <div className="excel-board-search-modal-header">
              <strong>찾기</strong>
              <button type="button" className="excel-board-search-close" onClick={closeBoardSearchPopup}>닫기</button>
            </div>
            <div className="excel-board-search-box">
              <select
                className="input"
                value={boardSearchField}
                onChange={(event) => setBoardSearchField(event.target.value === 'manager' ? 'manager' : 'name')}
              >
                <option value="name">업체명</option>
                <option value="manager">담당자명</option>
              </select>
              <input
                ref={boardSearchInputRef}
                className="input"
                value={boardSearchQuery}
                onChange={(event) => setBoardSearchQuery(event.target.value)}
                placeholder="검색어 입력 (Ctrl+F)"
              />
              <span className="excel-board-search-status">
                {boardSearchCurrentLabel}
              </span>
              <button
                type="button"
                className="excel-btn"
                onClick={() => moveBoardSearchMatch(-1)}
                disabled={boardSearchMatches.length === 0}
              >이전</button>
              <button
                type="button"
                className="excel-btn"
                onClick={() => moveBoardSearchMatch(1)}
                disabled={boardSearchMatches.length === 0}
              >다음</button>
            </div>
          </div>
        </div>
      )}
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
        boxClassName="agreement-export-modal"
      >
        <div className="export-sheet-modal">
          <div className="export-sheet-hero">
            <div className="export-sheet-hero__badge">EXPORT</div>
            <div>
              <strong>협정 결과를 엑셀로 저장합니다.</strong>
              <p>파일을 선택하면 해당 파일에 시트가 추가됩니다.</p>
            </div>
          </div>
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
            <span className="export-sheet-label">{credibilityLabel}</span>
            <input
              type="text"
              value={minRatingCredibilityScore}
              onChange={(event) => setMinRatingCredibilityScore(event.target.value)}
              placeholder="예: 1.5"
            />
            <p className="export-sheet-hint">{isLh100To300 ? '지역경제 기여도는 자동 계산됩니다.' : '신인도 가점이 없으면 비워두세요.'}</p>
          </div>
          <div className="export-sheet-field">
            <span className="export-sheet-label">{isLh100To300 ? '지역업체 참여비율(%)' : '신인도 적용 지분(%)'}</span>
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
        onDelete={(path) => handleDeleteAgreement(
          path,
          (options = {}) => confirm({ ...options, portalTarget: portalContainer || null }),
        )}
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

  const technicianWindowMarkup = (
    <TechnicianScoreWindow
      technicianTarget={technicianTarget}
      technicianTargetOptions={technicianTargetOptions}
      onTargetChange={setTechnicianTarget}
      technicianScoreTotal={technicianScoreTotal}
      technicianEditable={technicianEditable}
      onAddTechnicianEntry={addTechnicianEntry}
      technicianEntries={technicianEntries}
      onUpdateTechnicianEntry={updateTechnicianEntry}
      onRemoveTechnicianEntry={removeTechnicianEntry}
      onSave={handleSaveTechnicianScore}
      onClose={closeTechnicianModal}
      formatTechnicianScore={formatTechnicianScore}
      computeTechnicianScore={computeTechnicianScore}
      gradeOptions={TECHNICIAN_GRADE_OPTIONS}
      careerOptions={TECHNICIAN_CAREER_OPTIONS}
      managementOptions={TECHNICIAN_MANAGEMENT_OPTIONS}
    />
  );
  const candidateWindowMarkup = (
    <AgreementCandidateWindow
      entries={filteredCandidateDrawerEntries}
      query={candidateDrawerQuery}
      onQueryChange={setCandidateDrawerQuery}
      onOpenSearch={openCandidateSearch}
      searchOpen={candidateSearchOpen}
      searchFileType={searchFileType}
      onCloseSearch={closeCandidateSearch}
      onPickSearch={handleCandidatePicked}
      selectedUid={selectedCandidateUid}
      onSelect={(uid) => setSelectedCandidateUid((prev) => (prev === uid ? null : uid))}
      onAssign={handleCandidateDrawerAssign}
      onDelete={handleCandidateDrawerDelete}
      onClose={() => setCandidateWindowOpen(false)}
      onDragStart={handleCandidateDrawerDragStart}
      onDragEnd={handleDragEnd}
      draggingId={draggingId}
      performanceAmountLabel={performanceAmountLabel}
      managementMax={managementMax}
      formatAmount={formatAmount}
      formatScore={formatScore}
    />
  );
  const candidatePortal = (open && candidateWindowOpen && candidatePortalContainer)
    ? createPortal(candidateWindowMarkup, candidatePortalContainer)
    : null;
  const awardHistoryPortal = (open && awardHistoryWindowOpen && awardHistoryPortalContainer)
    ? createPortal(
      <LhAwardHistoryWindow
        onClose={() => setAwardHistoryWindowOpen(false)}
        content={getLhAwardHistoryText()}
      />,
      awardHistoryPortalContainer,
    )
    : null;
  const technicianPortal = (open && technicianModalOpen && technicianPortalContainer)
    ? createPortal(technicianWindowMarkup, technicianPortalContainer)
    : null;

  if (inlineMode) {
    if (!open) return null;
    return (
      <>
        {boardMarkup}
        {candidatePortal}
        {awardHistoryPortal}
        {technicianPortal}
      </>
    );
  }

  if (!open || !portalContainer) return null;
  return (
    <>
      {createPortal(boardMarkup, portalContainer)}
      {candidatePortal}
      {awardHistoryPortal}
      {technicianPortal}
    </>
  );
}
