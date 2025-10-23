import React from 'react';
import { createPortal } from 'react-dom';
import CompanySearchModal from '../../../../components/CompanySearchModal.jsx';
import { copyDocumentStyles } from '../../../../utils/windowBridge.js';

const DEFAULT_GROUP_SIZE = 3;
const MIN_GROUPS = 4;
const BID_SCORE = 65;
const MANAGEMENT_SCORE_MAX = 15;
const PERFORMANCE_DEFAULT_MAX = 13;
const PERFORMANCE_CAP_VERSION = 2;

const resolvePerformanceCap = (value) => {
  if (value === null || value === undefined) return PERFORMANCE_DEFAULT_MAX;
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return PERFORMANCE_DEFAULT_MAX;
};

const resolveTemplateKey = (ownerId, rangeId) => {
  const ownerKey = String(ownerId || '').toUpperCase();
  const rangeKey = String(rangeId || '').toLowerCase();
  if (ownerKey === 'MOIS' && rangeKey === 'mois-under30') return 'mois-under30';
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

const getCandidateNumericValue = (candidate, directKeys = [], keywordGroups = []) => {
  if (!candidate || typeof candidate !== 'object') return null;
  const value = extractAmountValue(candidate, directKeys, keywordGroups);
  const parsed = toNumber(value);
  return parsed;
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
  const cleaned = String(value).replace(/[^0-9.\-]/g, '').trim();
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatScore = (score) => {
  const value = toNumber(score);
  if (value === null) return '-';
  if (Math.abs(value) >= 1000) {
    try { return value.toLocaleString('ko-KR'); } catch (err) { return String(value); }
  }
  return value.toFixed(2).replace(/\.00$/, '');
};

const formatAmount = (value) => {
  const number = toNumber(value);
  if (number === null) return '-';
  try { return number.toLocaleString('ko-KR'); } catch (err) { return String(number); }
};

const formatPercent = (value) => {
  if (value === null || value === undefined) return '-%';
  const number = Number(value);
  if (!Number.isFinite(number)) return '-%';
  const integerDiff = Math.abs(number - Math.round(number));
  if (integerDiff < 0.01) return `${Math.round(number)}%`;
  return `${number.toFixed(2)}%`;
};

const parseAmountValue = (value) => {
  const parsed = toNumber(value);
  return parsed === null ? null : parsed;
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
  if (candidate._agreementManagementScore != null) {
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

  const candidates = [composite, credit].filter((value) => value != null && Number.isFinite(value));
  if (candidates.length === 0) return null;
  const best = Math.max(...candidates);
  const clamped = clampScore(best);
  candidate._agreementManagementScore = clamped;
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
  dutyRegions = [],
  groupSize = DEFAULT_GROUP_SIZE,
  title = '협정보드',
  alwaysInclude = [],
  fileType,
  ownerId = 'LH',
  rangeId: _rangeId = null,
  onAddRepresentatives = () => {},
  onRemoveRepresentative = () => {},
  noticeNo = '',
  noticeTitle = '',
  industryLabel = '',
  baseAmount = '',
  estimatedAmount = '',
  bidDeadline = '',
  regionDutyRate = '',
}) {
  const rangeId = _rangeId;
  const boardWindowRef = React.useRef(null);
  const [portalContainer, setPortalContainer] = React.useState(null);
  const [groupAssignments, setGroupAssignments] = React.useState([]);
  const [draggingId, setDraggingId] = React.useState(null);
  const [dropTarget, setDropTarget] = React.useState(null);
  const [groupShares, setGroupShares] = React.useState([]);
  const [groupSummaries, setGroupSummaries] = React.useState([]);
  const candidateScoreCacheRef = React.useRef(new Map());
  const performanceCapRef = React.useRef(PERFORMANCE_DEFAULT_MAX);
  const getPerformanceCap = () => resolvePerformanceCap(performanceCapRef.current);
  const updatePerformanceCap = (value) => {
    const resolved = resolvePerformanceCap(value);
    performanceCapRef.current = resolved;
    return resolved;
  };
  const [candidateMetricsVersion, setCandidateMetricsVersion] = React.useState(0);
  const prevAssignmentsRef = React.useRef(groupAssignments);
  const [representativeSearchOpen, setRepresentativeSearchOpen] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);

  const getSharePercent = React.useCallback((groupIndex, slotIndex, candidate) => {
    const stored = groupShares[groupIndex]?.[slotIndex];
    if (stored !== undefined && stored !== null && stored !== '') {
      const parsedStored = toNumber(stored);
      if (parsedStored !== null) return parsedStored;
    }
    if (!candidate || typeof candidate !== 'object') return null;
    if (candidate._share != null) {
      const parsedShare = toNumber(candidate._share);
      if (parsedShare !== null) return parsedShare;
    }
    const extracted = extractAmountValue(candidate, SHARE_DIRECT_KEYS, SHARE_KEYWORDS);
    const parsed = toNumber(extracted);
    return parsed !== null ? parsed : null;
  }, [groupShares]);

  const openRepresentativeSearch = React.useCallback(() => {
    setRepresentativeSearchOpen(true);
  }, []);

  const closeRepresentativeSearch = React.useCallback(() => {
    setRepresentativeSearchOpen(false);
  }, []);

  React.useEffect(() => {
    if (!open) {
      setRepresentativeSearchOpen(false);
    }
  }, [open]);

  const handleRepresentativePicked = React.useCallback((picked) => {
    if (!picked) return;
    onAddRepresentatives?.([picked]);
    closeRepresentativeSearch();
  }, [onAddRepresentatives, closeRepresentativeSearch]);

  const closeWindow = React.useCallback(() => {
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
  }, []);

  const ensureWindow = React.useCallback(() => {
    if (typeof window === 'undefined') return;
    if (boardWindowRef.current && boardWindowRef.current.closed) {
      boardWindowRef.current = null;
      setPortalContainer(null);
    }

    if (!boardWindowRef.current) {
      const width = Math.min(1180, Math.max(720, window.innerWidth - 160));
      const height = Math.min(880, Math.max(640, window.innerHeight - 120));
      const dualScreenLeft = window.screenLeft !== undefined ? window.screenLeft : window.screenX;
      const dualScreenTop = window.screenTop !== undefined ? window.screenTop : window.screenY;
      const left = Math.max(24, dualScreenLeft + window.innerWidth - width - 48);
      const top = Math.max(48, dualScreenTop + 48);
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
  }, [onClose, portalContainer, title]);

  React.useEffect(() => {
    if (open) {
      ensureWindow();
    } else {
      closeWindow();
    }
  }, [open, ensureWindow, closeWindow]);

  React.useEffect(() => () => { closeWindow(); }, [closeWindow]);

  React.useEffect(() => {
    if (!open) return;
    const win = boardWindowRef.current;
    if (!win || win.closed || !win.document) return;
    win.document.title = title || '협정보드';
  }, [title, open]);

  const dutyRegionSet = React.useMemo(() => {
    const entries = Array.isArray(dutyRegions) ? dutyRegions : [];
    return new Set(entries.map((entry) => normalizeRegion(entry)).filter(Boolean));
  }, [dutyRegions]);

  const boardDetails = React.useMemo(() => ({
    noticeNo,
    noticeTitle,
    industryLabel,
    baseAmount: baseAmount ? formatAmount(baseAmount) : '',
    estimatedAmount: estimatedAmount ? formatAmount(estimatedAmount) : '',
  }), [noticeNo, noticeTitle, industryLabel, baseAmount, estimatedAmount]);

  const pinnedSet = React.useMemo(() => new Set(pinned || []), [pinned]);
  const excludedSet = React.useMemo(() => new Set(excluded || []), [excluded]);
  const safeGroupSize = React.useMemo(() => {
    const parsed = Number(groupSize);
    if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_GROUP_SIZE;
    return Math.max(1, Math.floor(parsed));
  }, [groupSize]);

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

  const representativeCandidates = React.useMemo(
    () => representativeCandidatesRaw.filter((candidate) => {
      if (!candidate) return false;
      if (candidate._forceRepresentative) return true;
      return !isDutyRegionCompany(candidate);
    }),
    [representativeCandidatesRaw, isDutyRegionCompany],
  );

  const regionCandidates = React.useMemo(
    () => representativeCandidatesRaw.filter((candidate) => {
      if (!candidate) return false;
      if (candidate._forceRepresentative) return false;
      return isDutyRegionCompany(candidate);
    }),
    [representativeCandidatesRaw, isDutyRegionCompany],
  );

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

  const representativeEntries = React.useMemo(() => {
    const seen = new Map();
    const matchedRuleBiz = new Set();
    const entries = representativeCandidates.map((candidate, index) => {
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
    let syntheticIndex = representativeCandidates.length;
    alwaysIncludeItems.forEach((item) => {
      const bizNo = normalizeBizNo(item.bizNo);
      const nameKey = String(item.name || '').trim().toLowerCase();
      const alreadyRepresented = (bizNo && matchedRuleBiz.has(bizNo))
        || entries.some((entry) => {
          const entryBiz = normalizeBizNo(getBizNo(entry.candidate));
          const entryName = String(getCompanyName(entry.candidate) || '').trim().toLowerCase();
          if (bizNo && entryBiz === bizNo) return true;
          if (nameKey && entryName === nameKey) return true;
          return false;
        });
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
      const entry = {
        uid: buildEntryUid('rep-rule', candidate, syntheticIndex, seen),
        candidate,
        type: 'representative',
        pinned: true,
        synthetic: true,
      };
      syntheticIndex += 1;
      entries.push(entry);
    });
    return entries;
  }, [representativeCandidates, pinnedSet, alwaysIncludeItems, alwaysIncludeMap]);

  const selectedRegionCandidates = React.useMemo(() => {
    const pinnedMatches = regionCandidates.filter((candidate) => pinnedSet.has(candidate?.id));
    if (pinnedMatches.length > 0) return pinnedMatches;
    return regionCandidates.filter((candidate) => isRegionExplicitlySelected(candidate));
  }, [regionCandidates, pinnedSet]);

  const regionEntries = React.useMemo(() => {
    const seen = new Map();
    return selectedRegionCandidates.map((candidate, index) => ({
      uid: buildEntryUid('region', candidate, index, seen),
      candidate,
      type: 'region',
    }));
  }, [selectedRegionCandidates]);

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
    if (!open) return;
    const validIds = new Set([
      ...representativeEntries.map((entry) => entry.uid),
      ...regionEntries.map((entry) => entry.uid),
    ]);
    setGroupAssignments((prev) => {
      if (!prev || prev.length === 0) {
        return buildInitialAssignments();
      }
      const groupCount = Math.max(MIN_GROUPS, Math.ceil(representativeEntries.length / safeGroupSize));
      const trimmed = prev.slice(0, groupCount).map((group) => group.slice(0, safeGroupSize));
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

  const pinnedRepresentatives = React.useMemo(
    () => representativeEntries.filter((entry) => !assignedIds.has(entry.uid) && entry.pinned),
    [representativeEntries, assignedIds],
  );

  const freeRepresentatives = React.useMemo(
    () => representativeEntries.filter((entry) => !assignedIds.has(entry.uid) && !entry.pinned),
    [representativeEntries, assignedIds],
  );

  const availableRegionEntries = React.useMemo(() => (
    regionEntries.filter((entry) => !assignedIds.has(entry.uid))
  ), [regionEntries, assignedIds]);

  const summaryByGroup = React.useMemo(() => {
    const map = new Map();
    groupSummaries.forEach((entry) => {
      map.set(entry.groupIndex, entry);
    });
    return map;
  }, [groupSummaries]);

  const summary = React.useMemo(() => ({
    representativeTotal: representativeEntries.length,
    pinnedRepresentatives: pinnedRepresentatives.length,
    selectedRegions: regionEntries.length,
    groups: groupAssignments.length,
  }), [representativeEntries.length, pinnedRepresentatives.length, regionEntries.length, groupAssignments.length]);

  const handleExportExcel = React.useCallback(async () => {
    if (exporting) return;
    const api = typeof window !== 'undefined' ? window.electronAPI : null;
    if (!api?.agreementsExportExcel) {
      window.alert('엑셀 내보내기 채널이 준비되지 않았습니다. 데스크탑 앱에서만 실행 가능합니다.');
      return;
    }
    const templateKey = resolveTemplateKey(ownerId, rangeId);
    if (!templateKey) {
      window.alert('현재 선택한 발주처/구간은 엑셀 템플릿이 아직 준비되지 않았습니다.');
      return;
    }

    setExporting(true);
    try {
      const estimatedValue = parseAmountValue(estimatedAmount);
      const baseValue = parseAmountValue(baseAmount);
      const amountForScore = (estimatedValue != null && estimatedValue > 0)
        ? estimatedValue
        : (baseValue != null && baseValue > 0 ? baseValue : null);
      const dutyRateNumber = parseNumeric(regionDutyRate);
      const dutySummaryText = buildDutySummary(dutyRegions, dutyRateNumber, safeGroupSize);
      const formattedDeadline = formatBidDeadline(bidDeadline);

      const groupPayloads = groupAssignments.map((memberIds, groupIndex) => {
        const summaryEntry = summaryByGroup.get(groupIndex) || null;
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
          const sipyungValue = candidate._sipyung ?? extractAmountValue(
            candidate,
            ['_sipyung', 'sipyung', '시평', '시평액', '시평액(원)', '시평금액', '기초금액', '기초금액(원)'],
            [['시평', '심평', 'sipyung', '기초금액', '추정가격', '시평총액']]
          );
          const sipyung = parseNumeric(sipyungValue);
          const isRegionMember = entry.type === 'region' || isDutyRegionCompany(candidate);
          const companyName = sanitizeCompanyName(getCompanyName(candidate));
          const managerName = getCandidateManagerName(candidate);
          const displayName = managerName ? `${companyName}\n${managerName}` : companyName;
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
            sipyung,
          };
        });
        return {
          index: groupIndex + 1,
          members,
          summary: summaryEntry ? {
            shareSum: summaryEntry.shareSum ?? null,
            shareComplete: Boolean(summaryEntry.shareComplete),
            shareReady: Boolean(summaryEntry.shareReady),
            managementScore: summaryEntry.managementScore ?? null,
            performanceScore: summaryEntry.performanceScore ?? null,
            performanceAmount: summaryEntry.performanceAmount ?? null,
            performanceBase: summaryEntry.performanceBase ?? null,
            totalScore: summaryEntry.totalScore ?? null,
            bidScore: summaryEntry.bidScore ?? null,
            managementMax: summaryEntry.managementMax ?? null,
            performanceMax: summaryEntry.performanceMax ?? null,
            totalMax: summaryEntry.totalMax ?? null,
          } : null,
        };
      });

      const payload = {
        templateKey,
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
          amountForScore,
          bidDeadline: formattedDeadline,
          rawBidDeadline: bidDeadline || '',
          dutyRegions: Array.isArray(dutyRegions) ? dutyRegions : [],
          dutyRegionRate: dutyRateNumber,
          dutySummary: dutySummaryText,
          teamSize: safeGroupSize,
          summary,
        },
        groups: groupPayloads,
      };

      const response = await api.agreementsExportExcel(payload);
      if (response?.success) {
        window.alert('엑셀 파일을 저장했습니다.');
      } else {
        window.alert(response?.message || '엑셀 내보내기에 실패했습니다.');
      }
    } catch (error) {
      console.error('[AgreementBoard] Excel export failed:', error);
      window.alert('엑셀 내보내기 중 오류가 발생했습니다.');
    } finally {
      setExporting(false);
    }
  }, [
    exporting,
    ownerId,
    rangeId,
    baseAmount,
    estimatedAmount,
    bidDeadline,
    regionDutyRate,
    noticeNo,
    noticeTitle,
    industryLabel,
    dutyRegions,
    groupAssignments,
    groupShares,
    getSharePercent,
    participantMap,
    summaryByGroup,
    summary,
    safeGroupSize,
  ]);

  React.useEffect(() => {
    setGroupShares((prevShares) => {
      const shareMap = new Map();
      const prevAssignments = prevAssignmentsRef.current || [];
      prevAssignments.forEach((group, gIdx) => {
        group.forEach((id, idx) => {
          if (id) {
            const value = prevShares[gIdx]?.[idx] ?? '';
            shareMap.set(id, value);
          }
        });
      });
      const nextShares = groupAssignments.map((group) => group.map((id) => (id ? (shareMap.get(id) ?? '') : '')));
      prevAssignmentsRef.current = groupAssignments;
      return nextShares;
    });
  }, [groupAssignments]);

  React.useEffect(() => {
    if (!open) {
      setGroupSummaries([]);
      return;
    }

    const baseValue = parseAmountValue(baseAmount);
    const estimatedValue = parseAmountValue(estimatedAmount);
    const perfBase = (estimatedValue != null && estimatedValue > 0)
      ? estimatedValue
      : (baseValue != null && baseValue > 0 ? baseValue : null);
    const evaluationAmount = (estimatedValue != null && estimatedValue > 0)
      ? estimatedValue
      : (baseValue != null && baseValue > 0 ? baseValue : null);
    const ownerKey = String(ownerId || 'lh').toLowerCase();
    const performanceBaseReady = perfBase != null && perfBase > 0;

    const metrics = groupAssignments.map((memberIds, groupIndex) => {
      const members = memberIds.map((uid, slotIndex) => {
        if (!uid) return null;
        const entry = participantMap.get(uid);
        if (!entry || !entry.candidate) return null;
        const candidate = entry.candidate;
        const sharePercent = getSharePercent(groupIndex, slotIndex, candidate);
        const managementScore = getCandidateManagementScore(candidate);
        const performanceAmount = getCandidatePerformanceAmount(candidate);
        return {
          sharePercent,
          managementScore,
          performanceAmount,
        };
      }).filter(Boolean);

      const shareSum = members.reduce((sum, member) => {
        const shareValue = Number(member.sharePercent);
        return Number.isFinite(shareValue) ? sum + shareValue : sum;
      }, 0);
      const missingShares = members.some((member) => member.sharePercent == null || Number.isNaN(Number(member.sharePercent)));
      const shareValid = shareSum > 0 && !missingShares;
      const shareComplete = shareValid && Math.abs(shareSum - 100) < 0.01;
      const normalizedMembers = shareValid
        ? members.map((member) => ({
          ...member,
          weight: member.sharePercent > 0 ? (member.sharePercent / shareSum) : 0,
        }))
        : members.map((member) => ({ ...member, weight: 0 }));

      const managementMissing = normalizedMembers.some((member) => member.managementScore == null);
      const performanceMissing = normalizedMembers.some((member) => member.performanceAmount == null);

      const aggregatedManagement = (!managementMissing && shareComplete)
        ? normalizedMembers.reduce((acc, member) => acc + (member.managementScore || 0) * member.weight, 0)
        : null;

      const aggregatedPerformanceAmount = (!performanceMissing && shareComplete)
        ? normalizedMembers.reduce((acc, member) => acc + (member.performanceAmount || 0) * member.weight, 0)
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
      };
    });

    let canceled = false;

    const evaluatePerformanceScore = async (perfAmount) => {
      if (!performanceBaseReady || perfAmount == null) return null;
      const payload = {
        agencyId: ownerKey,
        amount: evaluationAmount != null ? evaluationAmount : (perfBase != null ? perfBase : 0),
        inputs: {
          perf5y: perfAmount,
          baseAmount: perfBase,
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
        const shareReady = metric.memberCount > 0 && metric.shareComplete;
        const managementScore = shareReady && !metric.managementMissing
          ? clampScore(metric.managementScore)
          : null;

        let performanceScore = null;
        let performanceRatio = null;

        if (shareReady && !metric.performanceMissing && metric.performanceAmount != null && performanceBaseReady) {
          performanceScore = await evaluatePerformanceScore(metric.performanceAmount);
          if (perfBase && perfBase > 0) {
            performanceRatio = metric.performanceAmount / perfBase;
          }
        }

        const perfCapCurrent = getPerformanceCap();
        const managementMax = MANAGEMENT_SCORE_MAX;
        const performanceMax = perfCapCurrent || PERFORMANCE_DEFAULT_MAX;
        const totalScore = (managementScore != null && performanceScore != null)
          ? managementScore + performanceScore + BID_SCORE
          : null;
        const totalMax = managementScore != null && performanceScore != null
          ? managementMax + performanceMax + BID_SCORE
          : null;

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
          totalScore,
          bidScore: metric.memberCount > 0 ? BID_SCORE : null,
          managementMax,
          performanceMax,
          totalMax,
        };
      }));
      if (!canceled) setGroupSummaries(results);
    };

    run();

    return () => {
      canceled = true;
    };
  }, [open, groupAssignments, groupShares, participantMap, ownerId, estimatedAmount, baseAmount, getSharePercent, candidateMetricsVersion]);

  React.useEffect(() => {
    if (!open) return;
    const evalApi = typeof window !== 'undefined' ? window.electronAPI?.formulasEvaluate : null;
    const baseValue = parseAmountValue(baseAmount);
    const estimatedValue = parseAmountValue(estimatedAmount);
    const perfBase = (estimatedValue != null && estimatedValue > 0)
      ? estimatedValue
      : (baseValue != null && baseValue > 0 ? baseValue : null);
    const evaluationAmount = (estimatedValue != null && estimatedValue > 0)
      ? estimatedValue
      : (baseValue != null && baseValue > 0 ? baseValue : null);
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
        managementScore: candidate.managementTotalScore ?? candidate.managementScore ?? candidate._agreementManagementScore ?? null,
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
        const cacheKey = `${ownerKey}|${evaluationAmount || ''}|${perfBase || ''}|${candidateKey}`;
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
        const creditGrade = extractCreditGrade(candidate);
        const candidatePerfAmount = performanceAmount;

        let resolvedManagement = currentManagement;
        let resolvedPerformanceScore = currentPerformanceScore;

        const payload = {
          agencyId: ownerKey,
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
            creditGrade,
          },
        };

        if (!Number.isFinite(payload.inputs.debtRatio)) delete payload.inputs.debtRatio;
        if (!Number.isFinite(payload.inputs.currentRatio)) delete payload.inputs.currentRatio;
        if (!Number.isFinite(payload.inputs.bizYears)) delete payload.inputs.bizYears;
        if (!Number.isFinite(payload.inputs.qualityEval)) delete payload.inputs.qualityEval;
        if (!Number.isFinite(payload.inputs.perf5y)) delete payload.inputs.perf5y;
        if (!Number.isFinite(payload.inputs.baseAmount)) delete payload.inputs.baseAmount;
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
                  candidate._agreementManagementScore = mgmtScore;
                  resolvedManagement = mgmtScore;
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
  }, [open, participantMap, ownerId, baseAmount, estimatedAmount]);

  const handleDragStart = (id) => (event) => {
    if (!id) return;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', id);
    setDraggingId(id);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDropTarget(null);
  };

  const handleRemove = (groupIndex, slotIndex) => {
    setGroupAssignments((prev) => {
      const next = prev.map((group) => group.slice());
      if (next[groupIndex]) next[groupIndex][slotIndex] = null;
      return next;
    });
  };

  const handleDropInternal = (groupIndex, slotIndex, id) => {
    if (!id || !participantMap.has(id)) return;
    setGroupAssignments((prev) => {
      const next = prev.map((group) => group.slice());
      next.forEach((group, gIdx) => {
        for (let i = 0; i < group.length; i += 1) {
          if (group[i] === id) {
            next[gIdx][i] = null;
          }
        }
      });
      if (!next[groupIndex]) {
        next[groupIndex] = Array(safeGroupSize).fill(null);
      }
      next[groupIndex][slotIndex] = id;
      return next;
    });
    setDraggingId(null);
    setDropTarget(null);
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
  };

  const handleResetGroups = () => {
    setGroupAssignments(buildInitialAssignments());
    setDropTarget(null);
  };

  const handleShareInput = (groupIndex, slotIndex, rawValue) => {
    const sanitized = rawValue.replace(/[^0-9.]/g, '');
    if ((sanitized.match(/\./g) || []).length > 1) return;
    setGroupShares((prev) => {
      const next = prev.map((row) => row.slice());
      while (next.length <= groupIndex) next.push([]);
      while (next[groupIndex].length <= slotIndex) next[groupIndex].push('');
      next[groupIndex][slotIndex] = sanitized;
      return next;
    });
  };

  const groups = React.useMemo(() => (
    groupAssignments.map((group, index) => ({
      id: index + 1,
      memberIds: group,
      members: group.map((uid) => (uid ? participantMap.get(uid) || null : null)),
      summary: summaryByGroup.get(index) || null,
    }))
  ), [groupAssignments, participantMap, summaryByGroup, candidateMetricsVersion]);

  const renderMemberCard = (entry, slotIndex, groupIndex) => {
    const slotActive = dropTarget && dropTarget.groupIndex === groupIndex && dropTarget.slotIndex === slotIndex;
    if (!entry) {
      return (
        <div
          key={`placeholder-${groupIndex}-${slotIndex}`}
          className={`agreement-board-member placeholder${slotActive ? ' drop-active' : ''}`}
          onDragOver={handleDragOver(groupIndex, slotIndex)}
          onDragEnter={handleDragOver(groupIndex, slotIndex)}
          onDragLeave={handleDragLeave(groupIndex, slotIndex)}
          onDrop={handleDropFromEvent(groupIndex, slotIndex)}
          onDragOverCapture={handleDragOver(groupIndex, slotIndex)}
          onDragEnterCapture={handleDragOver(groupIndex, slotIndex)}
          onDropCapture={handleDropFromEvent(groupIndex, slotIndex)}
        >
          <div className="member-empty">대표사/지역사를 끌어다 놓으세요</div>
        </div>
      );
    }

    const { uid, candidate, type } = entry;
    const matchesDutyRegion = isDutyRegionCompany(candidate);
    const sharePercent = getSharePercent(groupIndex, slotIndex, candidate);
    const storedShare = groupShares[groupIndex]?.[slotIndex];
    const shareValue = storedShare !== undefined ? storedShare : (sharePercent != null ? String(sharePercent) : '');

    const managementScoreForMember = getCandidateManagementScore(candidate);

    const sipyungRaw = candidate._sipyung ?? extractAmountValue(
      candidate,
      ['sipyung', '시평', '시평액', '시평액(원)', '시평금액', '기초금액', '기초금액(원)'],
      [['시평', '심평', 'sipyung', '기초금액', '추정가격', '시평총액']]
    );
    const fiveYearRaw = candidate._performance5y ?? extractAmountValue(
      candidate,
      ['performance5y', '5년 실적', '5년실적', '5년 실적 합계', '최근5년실적', '최근5년실적합계', '5년실적금액', '최근5년시공실적'],
      [['5년실적', '최근5년', 'fiveyear', 'performance5', '시공실적']]
    );
    const ratingRaw = candidate._score ?? extractAmountValue(
      candidate,
      ['score', 'totalScore', '총점', '평균점수', '적격점수', '종합점수', '평가점수'],
      [['총점', '평균점수', 'score', '점수', '적격점수', '종합점수', '평가점수']]
    );

    const sipyung = sipyungRaw ?? candidate.sipyung;
    const fiveYear = fiveYearRaw ?? candidate.performance5y;
    const rating = managementScoreForMember != null
      ? managementScoreForMember
      : ((ratingRaw != null && ratingRaw !== '') ? ratingRaw : (candidate.score ?? candidate.totalScore ?? null));

    const classes = ['agreement-board-member', 'assigned'];
    if (matchesDutyRegion || type === 'region') classes.push('region');
    if (draggingId === uid) classes.push('dragging');

    const tags = [];
    if (slotIndex === 0) {
      tags.push({ key: 'leader', label: '대표사', className: 'leader' });
    } else {
      tags.push({ key: 'member', label: '구성사', className: 'member' });
    }
    if (matchesDutyRegion || type === 'region') {
      if (!tags.some((tag) => tag.key === 'region')) {
        tags.push({ key: 'region', label: '지역사', className: 'region' });
      }
    }

    return (
      <div
        key={uid}
        className={classes.join(' ')}
        draggable
        onDragStart={handleDragStart(uid)}
        onDragEnd={handleDragEnd}
        onDragEnter={handleDragOver(groupIndex, slotIndex)}
        onDragOver={handleDragOver(groupIndex, slotIndex)}
        onDragLeave={handleDragLeave(groupIndex, slotIndex)}
        onDrop={handleDropFromEvent(groupIndex, slotIndex)}
        onDragEnterCapture={handleDragOver(groupIndex, slotIndex)}
        onDragOverCapture={handleDragOver(groupIndex, slotIndex)}
        onDropCapture={handleDropFromEvent(groupIndex, slotIndex)}
      >
        <div className="member-tags">
          {tags.map((tag) => (
            <span key={`${uid}-${tag.key}`} className={`member-tag ${tag.className}`}>{tag.label}</span>
          ))}
        </div>
        <div className="member-name" title={getCompanyName(candidate)}>{getCompanyName(candidate)}</div>
        <div className="member-meta">
          <span>{getRegionLabel(candidate)}</span>
        </div>
        <div className="member-share">
          <label>지분(%)</label>
          <input
            type="text"
            value={shareValue}
            onChange={(e) => handleShareInput(groupIndex, slotIndex, e.target.value)}
            placeholder="지분을 입력하세요"
            onDragOver={handleDragOver(groupIndex, slotIndex)}
            onDragEnter={handleDragOver(groupIndex, slotIndex)}
            onDragLeave={handleDragLeave(groupIndex, slotIndex)}
            onDrop={handleDropFromEvent(groupIndex, slotIndex)}
          />
          {shareValue === '' && <span className="share-hint">지분을 입력하세요</span>}
        </div>
        <div className="member-stats">
          <div className="member-stat-row">
            <span className="stat-label">시평</span>
            <span className="stat-value">{formatAmount(sipyung)}</span>
          </div>
          <div className="member-stat-row">
            <span className="stat-label">5년 실적</span>
            <span className="stat-value">{formatAmount(fiveYear)}</span>
          </div>
          <div className="member-stat-row">
            <span className="stat-label">경영점수</span>
            <span className="stat-value">{formatScore(rating)}</span>
          </div>
        </div>
        <div className="member-actions">
          <button type="button" className="btn-sm btn-muted" onClick={() => handleRemove(groupIndex, slotIndex)}>제거</button>
        </div>
      </div>
    );
  };

  const renderEntryList = (list, emptyMessage, extraClass = '') => (
    <div className="board-sidebar-list">
      {list.length === 0 && <div className="board-sidebar-empty">{emptyMessage}</div>}
      {list.map((entry) => {
        const classes = ['board-sidebar-item'];
        if (extraClass) classes.push(extraClass);
        if (draggingId === entry.uid) classes.push('dragging');
        if (isDutyRegionCompany(entry.candidate) || entry.type === 'region') classes.push('region');
        const perfValueRaw = entry.candidate?._performance5y ?? extractAmountValue(
          entry.candidate,
          ['_performance5y', 'performance5y', '5년 실적', '5년실적', '5년 실적 합계', '최근5년실적', '최근5년실적합계', '5년실적금액', '최근5년시공실적'],
          [['5년실적', '최근5년', 'fiveyear', 'performance5', '시공실적']]
        );
        const perfDisplayRaw = perfValueRaw != null && perfValueRaw !== ''
          ? formatAmount(perfValueRaw)
          : null;
        const perfDisplay = perfDisplayRaw && perfDisplayRaw !== '-' ? perfDisplayRaw : null;
        const managementSidebarScore = getCandidateManagementScore(entry.candidate);
        const baseScoreSource = managementSidebarScore != null
          ? managementSidebarScore
          : entry.candidate?.rating
            ?? entry.candidate?.score
            ?? entry.candidate?.managementTotalScore
            ?? entry.candidate?.totalScore
            ?? entry.candidate?._score;
        const scoreDisplaySource = (baseScoreSource !== null && baseScoreSource !== undefined && baseScoreSource !== '')
          ? baseScoreSource
          : managementSidebarScore;
        return (
          <div
            key={entry.uid}
            className={classes.join(' ')}
            draggable
            onDragStart={handleDragStart(entry.uid)}
            onDragEnd={handleDragEnd}
          >
            <div className="name" title={getCompanyName(entry.candidate)}>{getCompanyName(entry.candidate)}</div>
            <div className="meta">
              <span>{getRegionLabel(entry.candidate)}</span>
              <span className="score">{formatScore(scoreDisplaySource)}</span>
            </div>
            {perfDisplay && (
              <div className="meta secondary">
                <span>5년 실적</span>
                <span className="amount">{perfDisplay}</span>
              </div>
            )}
            {entry.type === 'representative' && entry.candidate?.id && (
              <div className="actions">
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onRemoveRepresentative(entry.candidate.id);
                  }}
                >
                  삭제
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const renderSearchButton = React.useCallback(() => {
    if (!onAddRepresentatives) return null;
    const disabled = !fileType;
    return (
      <button
        type="button"
        className="btn-sm btn-soft"
        onClick={openRepresentativeSearch}
        disabled={disabled}
      >대표사 찾기</button>
    );
  }, [onAddRepresentatives, openRepresentativeSearch, fileType]);

  if (!open || !portalContainer) return null;

  return createPortal(
    <>
      <div className="agreement-board-root">
        <header className="agreement-board-header">
          <div className="header-text">
            <div className="header-title-line">
              <h2>{title}</h2>
              <div className="agreement-board-header-meta">
                <span><strong>공고명</strong> {boardDetails.noticeTitle || '-'}</span>
                <span><strong>공고번호</strong> {boardDetails.noticeNo || '-'}</span>
                <span><strong>공종</strong> {boardDetails.industryLabel || '-'}</span>
                <span><strong>기초금액</strong> {boardDetails.baseAmount || '-'}</span>
                <span><strong>추정금액</strong> {boardDetails.estimatedAmount || '-'}</span>
              </div>
            </div>
            <p>대표사 {summary.representativeTotal}명 · 확정 지역사 {summary.selectedRegions}명 · 협정 {summary.groups}개</p>
          </div>
          <div className="header-actions">
            <button type="button" className="btn-soft" onClick={onClose}>닫기</button>
          </div>
        </header>
        <div className="agreement-board-layout">
          <aside className="agreement-board-sidebar">
            <section className="sidebar-section">
              <div className="board-sidebar-title">설정한 고정 업체</div>
              <div className="board-sidebar-count">{pinnedRepresentatives.length}개 고정</div>
              {renderEntryList(pinnedRepresentatives, '설정한 고정 업체가 없습니다.', 'pinned')}
            </section>
            <section className="sidebar-section">
              <div className="board-sidebar-title">대표사 후보</div>
              <div className="board-sidebar-head">
                <div className="board-sidebar-count">총 {freeRepresentatives.length}명</div>
                {renderSearchButton()}
              </div>
              {renderEntryList(freeRepresentatives, '대표사 후보가 없습니다.')}
            </section>
            <section className="sidebar-section">
              <div className="board-sidebar-title">확정된 지역사</div>
              <div className="board-sidebar-count">{availableRegionEntries.length}개 준비</div>
              {renderEntryList(availableRegionEntries, '후보산출에서 지역사를 선택하면 여기에 표시됩니다.', 'region')}
            </section>
          </aside>
          <main className="agreement-board-main">
            <div className="board-header">
              <div>
                <div className="board-title">협정 조합 미리보기</div>
                <div className="board-subtitle">팀당 최대 {safeGroupSize}인 기준으로 대표사/지역사를 배치하세요.</div>
              </div>
              <div className="board-actions">
                <button
                  type="button"
                  className="btn-soft"
                  onClick={handleExportExcel}
                  disabled={exporting}
                >
                  {exporting ? '엑셀 내보내는 중...' : '엑셀로 내보내기'}
                </button>
                <button type="button" className="btn-soft" onClick={handleAddGroup}>빈 행 추가</button>
                <button type="button" className="btn-soft" onClick={handleResetGroups}>초기화</button>
              </div>
            </div>
            <div className="board-groups">
              {groups.map((group, groupIndex) => {
                const summaryInfo = group.summary;
                let scorePill = { text: '총점 미계산', className: 'tag-muted' };
                const detailPills = [];
                let shareText = '';

                if (!summaryInfo || summaryInfo.memberCount === 0) {
                  scorePill = { text: '업체를 배치하세요', className: 'tag-muted' };
                } else if (!summaryInfo.shareReady) {
                  scorePill = { text: '지분을 입력하세요', className: 'tag-muted' };
                  if (summaryInfo.shareSum != null) {
                    shareText = `지분합계 ${formatPercent(summaryInfo.shareSum)}${summaryInfo.shareComplete ? '' : ' (100% 아님)'}`;
                  }
                } else if (summaryInfo.managementScore == null) {
                  scorePill = { text: '경영점수 데이터 확인', className: 'tag-muted' };
                  if (summaryInfo.shareSum != null) {
                    shareText = `지분합계 ${formatPercent(summaryInfo.shareSum)}${summaryInfo.shareComplete ? '' : ' (100% 아님)'}`;
                  }
                } else if (summaryInfo.performanceScore == null) {
                  scorePill = { text: summaryInfo.performanceBaseReady ? '실적 데이터 확인' : '실적 기준 금액 확인 필요', className: 'tag-muted' };
                  if (summaryInfo.shareSum != null) {
                    shareText = `지분합계 ${formatPercent(summaryInfo.shareSum)}${summaryInfo.shareComplete ? '' : ' (100% 아님)'}`;
                  }
                } else {
                  const managementMax = summaryInfo.managementMax ?? MANAGEMENT_SCORE_MAX;
                  const performanceMax = summaryInfo.performanceMax ?? PERFORMANCE_DEFAULT_MAX;
                  const totalMax = summaryInfo.totalMax ?? (managementMax + performanceMax + BID_SCORE);
                  const totalScore = summaryInfo.totalScore ?? 0;
                  const isPerfect = totalMax != null && totalScore >= (totalMax - 0.01);
                  const totalLabel = totalMax != null
                    ? `총점 ${formatScore(totalScore)} / ${formatScore(totalMax)}`
                    : `총점 ${formatScore(totalScore)}`;
                  scorePill = {
                    text: totalLabel,
                    className: `score-pill ${isPerfect ? 'score-pill-ok' : 'score-pill-alert'}`,
                  };

                  const pillConfigs = [
                    {
                      label: '경영',
                      score: summaryInfo.managementScore,
                      max: managementMax,
                    },
                    {
                      label: '실적',
                      score: summaryInfo.performanceScore,
                      max: performanceMax,
                    },
                    {
                      label: '입찰',
                      score: summaryInfo.bidScore,
                      max: BID_SCORE,
                    },
                  ];

                  pillConfigs.forEach(({ label, score, max }) => {
                    const isDefined = score != null && max != null;
                    const isPerfect = isDefined && score >= (max - 0.01);
                    const className = `detail-pill ${isPerfect ? 'detail-pill-ok' : 'detail-pill-alert'}`;
                    const text = isDefined
                      ? `${label} ${formatScore(score)} / ${formatScore(max)}`
                      : `${label} 자료 확인`;
                    detailPills.push({ text, className });
                  });
                  if (summaryInfo.shareSum != null) {
                    shareText = `지분합계 ${formatPercent(summaryInfo.shareSum)}${summaryInfo.shareComplete ? '' : ' (100% 아님)'}`;
                  }
                }

                return (
                  <section key={group.id} className="board-group-card">
                    <header className="group-header">
                      <div>
                        <div className="group-title">협정 {group.id}</div>
                        <div className="group-subtitle">대표사와 지역사를 드래그해서 배치하세요.</div>
                      </div>
                      <div className="group-meta">
                        {scorePill && <span className={scorePill.className}>{scorePill.text}</span>}
                        {detailPills.map((pill, pillIdx) => (
                          <span key={pillIdx} className={pill.className}>{pill.text}</span>
                        ))}
                        {shareText && <span className="tag-muted">{shareText}</span>}
                        <button type="button" className="btn-sm btn-muted" disabled>세부 설정</button>
                      </div>
                    </header>
                    <div className="group-body">
                      {group.memberIds.map((uid, slotIndex) => renderMemberCard(uid ? participantMap.get(uid) : null, slotIndex, groupIndex))}
                    </div>
                  </section>
                );
              })}
            </div>
          </main>
        </div>
      </div>
      {representativeSearchOpen && (
        <CompanySearchModal
          open={representativeSearchOpen}
          onClose={closeRepresentativeSearch}
          onPick={handleRepresentativePicked}
          fileType={fileType || 'all'}
        />
      )}
    </>,
    portalContainer,
  );
}
