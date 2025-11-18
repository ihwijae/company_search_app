import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import AmountInput from '../../../../components/AmountInput.jsx';
import { copyDocumentStyles } from '../../../../utils/windowBridge.js';
import {
  isWomenOwnedCompany,
  getQualityBadgeText,
  getCandidateTextField,
  extractManagerNames,
} from '../../../../utils/companyIndicators.js';

const REGION_WINDOW_STORAGE_KEY = '__regionSearchWindow';

const getStoredRegionWindow = () => {
  if (typeof window === 'undefined') return null;
  const existing = window[REGION_WINDOW_STORAGE_KEY];
  if (existing && !existing.closed) return existing;
  return null;
};

const storeRegionWindow = (target) => {
  if (typeof window === 'undefined') return;
  if (target && !target.closed) {
    window[REGION_WINDOW_STORAGE_KEY] = target;
  } else {
    delete window[REGION_WINDOW_STORAGE_KEY];
  }
};

const getStoredPortalContainer = () => {
  const win = getStoredRegionWindow();
  if (!win || win.closed || !win.document) return null;
  return win.document.getElementById('candidates-window-root');
};

const DATE_PATTERN = /(\d{2,4})[.\-/년\s]*(\d{1,2})[.\-/월\s]*(\d{1,2})/;

const SIPYUNG_RESOLVERS = [
  (candidate) => candidate?.singleBidFacts?.sipyung,
  (candidate) => candidate?.rating,
  (candidate) => candidate?.sipyung,
  (candidate) => candidate?.['시평'],
  (candidate) => candidate?.['시평액'],
  (candidate) => candidate?.['시평금액'],
  (candidate) => candidate?.['시평액(원)'],
  (candidate) => candidate?.['시평금액(원)'],
  (candidate) => candidate?.['시평금액원'],
];

const PERF5Y_RESOLVERS = [
  (candidate) => candidate?.singleBidFacts?.perf5y,
  (candidate) => candidate?.perf5y,
  (candidate) => candidate?.performance5y,
  (candidate) => candidate?.['5년 실적'],
  (candidate) => candidate?.['5년실적'],
  (candidate) => candidate?.['5년 실적 합계'],
  (candidate) => candidate?.['최근5년실적'],
  (candidate) => candidate?.['최근5년실적합계'],
  (candidate) => candidate?.['5년실적금액'],
  (candidate) => candidate?.['최근5년시공실적'],
];

const resolveCandidateValue = (candidate, resolvers) => {
  if (!candidate || !Array.isArray(resolvers)) return null;
  for (const resolver of resolvers) {
    try {
      const value = resolver(candidate);
      if (value === undefined || value === null) continue;
      if (typeof value === 'string' && value.trim() === '') continue;
      return value;
    } catch (_) {
      // ignore resolver errors and try next candidate field
    }
  }
  return null;
};

const parseAmountValue = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const cleaned = String(value).replace(/[^0-9.\-]/g, '').trim();
  if (!cleaned) return null;
  const numeric = Number(cleaned);
  return Number.isFinite(numeric) ? numeric : null;
};

const parsePercentValue = (value) => {
  if (value === null || value === undefined || value === '') return NaN;
  const numeric = Number(String(value).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(numeric) ? numeric / 100 : NaN;
};

const formatAmountString = (value) => {
  if (!Number.isFinite(value) || value <= 0) return '';
  try {
    return Math.round(value).toLocaleString('ko-KR');
  } catch {
    return String(Math.round(value));
  }
};

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

const extractExpiryDate = (text) => {
  if (!text) return null;
  const source = String(text);
  let match = source.match(/~\s*([0-9]{2,4}[^0-9]*[0-9]{1,2}[^0-9]*[0-9]{1,2})/);
  if (match) {
    const parsed = parseDateToken(match[1]);
    if (parsed) return parsed;
  }
  match = source.match(/([0-9]{2,4}[^0-9]*[0-9]{1,2}[^0-9]*[0-9]{1,2})\s*(까지|만료|만기)/);
  if (match) {
    const parsed = parseDateToken(match[1]);
    if (parsed) return parsed;
  }
  const tokens = source.match(/[0-9]{2,4}[^0-9]*[0-9]{1,2}[^0-9]*[0-9]{1,2}/g);
  if (tokens && tokens.length) {
    for (let i = tokens.length - 1; i >= 0; i -= 1) {
      const parsed = parseDateToken(tokens[i]);
      if (parsed) return parsed;
    }
  }
  return null;
};

const getStatusClass = (statusText) => {
  if (statusText === '최신') return 'status-latest';
  if (statusText === '1년 경과') return 'status-warning';
  if (statusText === '1년 이상 경과') return 'status-old';
  return 'status-unknown';
};

const industryToLabel = (type) => {
  const normalized = String(type || '').toLowerCase();
  if (normalized === 'eung' || normalized === '전기') return '전기';
  if (normalized === 'tongsin' || normalized === '통신') return '통신';
  if (normalized === 'sobang' || normalized === '소방') return '소방';
  return normalized ? normalized.toUpperCase() : '';
};

export default function CandidatesModal({
  open,
  onClose,
  ownerId = 'LH',
  menuKey = '',
  rangeId = null,
  fileType,
  entryAmount,
  entryMode = 'ratio',
  baseAmount,
  estimatedAmount = '',
  bidAmount = '',
  bidRate = '',
  adjustmentRate = '',
  perfectPerformanceAmount = 0,
  dutyRegions = [],
  ratioBaseAmount = '',
  defaultExcludeSingle = true,
  noticeNo = '',
  noticeTitle = '',
  noticeDate = '',
  industryLabel = '',
  initialCandidates = EMPTY_ARRAY,
  initialPinned = EMPTY_ARRAY,
  initialExcluded = EMPTY_ARRAY,
  onApply,
  readOnly = false,
}) {
  const popupRef = useRef(getStoredRegionWindow());
  const [portalContainer, setPortalContainer] = useState(() => getStoredPortalContainer());
  const [applying, setApplying] = useState(false);
  const [params, setParams] = useState({
    entryAmount: '',
    baseAmount: '',
    dutyRegions: [],
    ratioBase: '',
    bidAmount: '',
    bidRate: '',
    adjustmentRate: '',
    minPct: '',
    maxPct: '',
    excludeSingleBidEligible: true,
    filterByRegion: true,
  });
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState([]);
  const [pinned, setPinned] = useState(new Set());
  const [excluded, setExcluded] = useState(new Set());
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [managerQuery, setManagerQuery] = useState('');
  const [sortKey, setSortKey] = useState('share'); // 'share' | 'perf5y' | 'sipyung'
  const [sortDir, setSortDir] = useState('desc'); // 'desc' | 'asc'
  const [sortSeq, setSortSeq] = useState(0);      // force re-sort even if same dir clicked
  const applySort = (key, dir) => {
    setSortKey(key);
    setSortDir(dir);
    setSortSeq((n)=>n+1);
  };
  const isActiveSort = useCallback((key, dir) => (sortKey === key && sortDir === dir), [sortKey, sortDir]);
  const [autoPin, setAutoPin] = useState(false);
  const [autoCount, setAutoCount] = useState(3);
  const [onlyLatest, setOnlyLatest] = useState(false);
  const [bidTouched, setBidTouched] = useState(false);
  const bidAutoRef = useRef('');
  const readOnlyMode = Boolean(readOnly);
  const today = useMemo(() => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    return base;
  }, []);
  const isMountedRef = useRef(true);

  useEffect(() => () => { isMountedRef.current = false; }, []);

  const closeWindow = useCallback(() => {
    const win = popupRef.current;
    if (win && !win.closed) {
      if (win.__candidatesCleanup) {
        try { win.__candidatesCleanup(); } catch {}
        delete win.__candidatesCleanup;
      }
      win.close();
    }
    popupRef.current = null;
    setPortalContainer(null);
    storeRegionWindow(null);
  }, []);

  const attachBeforeUnload = useCallback((target) => {
    if (!target) return;
    if (target.__candidatesCleanup) {
      try { target.__candidatesCleanup(); } catch {}
      delete target.__candidatesCleanup;
    }
    const handler = () => {
      if (popupRef.current === target) {
        popupRef.current = null;
      }
      storeRegionWindow(null);
      if (isMountedRef.current) {
        setPortalContainer(null);
        onClose?.();
      }
    };
    target.addEventListener('beforeunload', handler);
    target.__candidatesCleanup = () => target.removeEventListener('beforeunload', handler);
  }, [onClose]);

  const ensureWindow = useCallback(() => {
    if (typeof window === 'undefined') return;

    if (!popupRef.current) {
      const stored = getStoredRegionWindow();
      if (stored) popupRef.current = stored;
    }

    if (popupRef.current && popupRef.current.closed) {
      popupRef.current = null;
      storeRegionWindow(null);
      setPortalContainer(null);
    }

    if (!popupRef.current) {
      const preferredWidth = Math.min(1720, Math.max(1280, window.innerWidth - 60));
      const preferredHeight = Math.min(1080, Math.max(820, window.innerHeight - 72));
      const dualScreenLeft = window.screenLeft !== undefined ? window.screenLeft : window.screenX;
      const dualScreenTop = window.screenTop !== undefined ? window.screenTop : window.screenY;
      const left = Math.max(24, dualScreenLeft + Math.max(0, (window.innerWidth - preferredWidth) / 2));
      const top = Math.max(24, dualScreenTop + Math.max(0, (window.innerHeight - preferredHeight) / 3));
      const features = `width=${preferredWidth},height=${preferredHeight},left=${left},top=${top},resizable=yes,scrollbars=yes`;
      const child = window.open('', 'company-search-candidates', features);
      if (!child) return;
      popupRef.current = child;
      child.document.title = '지역사 찾기';
      child.document.body.style.margin = '0';
      child.document.body.style.background = '#f3f4f6';
      child.document.body.innerHTML = '';
      const root = child.document.createElement('div');
      root.id = 'candidates-window-root';
      child.document.body.appendChild(root);
      copyDocumentStyles(document, child.document);
      setPortalContainer(root);
      storeRegionWindow(child);
      attachBeforeUnload(child);
    } else {
      const win = popupRef.current;
      storeRegionWindow(win);
      if (win.document && win.document.readyState === 'complete') {
        copyDocumentStyles(document, win.document);
      }
      if (win.document) {
        let root = win.document.getElementById('candidates-window-root');
        if (!root) {
          root = win.document.createElement('div');
          root.id = 'candidates-window-root';
          win.document.body.appendChild(root);
        }
        if (!portalContainer || portalContainer !== root) {
          setPortalContainer(root);
        }
      }
      attachBeforeUnload(win);
      try { win.focus(); } catch {}
    }
  }, [attachBeforeUnload, portalContainer]);

  const normalizedOwnerId = String(ownerId || '').toUpperCase();
  const isPpsOwner = normalizedOwnerId === 'PPS';
  const isLhOwner = normalizedOwnerId === 'LH';
  const isMoisOwner = normalizedOwnerId === 'MOIS';
  const isMoisShareRange = isMoisOwner && menuKey === 'mois-30to50';
  const hasEntryLimit = entryMode !== 'none';
  const showTenderFields = (isPpsOwner || isMoisShareRange);
  const showBizYearsMetrics = isPpsOwner || isLhOwner;
  const isMoisUnder30 = normalizedOwnerId === 'MOIS' && menuKey === 'mois-under30';
  const perfAmountValue = Number(perfectPerformanceAmount) > 0 ? String(perfectPerformanceAmount) : '';

  useEffect(() => {
    if (open) {
      ensureWindow();
    } else {
      closeWindow();
    }
  }, [open, ensureWindow, closeWindow]);

  useEffect(() => {
    if (!open) return;
    const win = popupRef.current;
    if (!win || win.closed || !win.document) return;
    try { win.document.title = '지역사 찾기'; } catch {}
  }, [open]);

const industryToLabel = (type) => {
  const upper = String(type || '').toLowerCase();
  if (upper === 'eung' || upper === '전기') return '전기';
  if (upper === 'tongsin' || upper === '통신') return '통신';
  if (upper === 'sobang' || upper === '소방') return '소방';
  return upper ? upper.toUpperCase() : '';
};

  const initialParamsSnapshot = useMemo(() => {
    const initialBase = isMoisUnder30
      ? (perfAmountValue || estimatedAmount || entryAmount || '')
      : (baseAmount || '');
    const defaultRatioSource = isPpsOwner ? (bidAmount || ratioBaseAmount || '') : (ratioBaseAmount || bidAmount || '');
    const initialRatio = isMoisUnder30 ? '' : defaultRatioSource;
    const initialBidAmount = isMoisUnder30 ? '' : (bidAmount || defaultRatioSource);
    const normalizedBidRate = bidRate || '';
    const normalizedAdjustmentRate = adjustmentRate || '';
    return {
      entryAmount: hasEntryLimit ? (entryAmount || '') : '',
      baseAmount: initialBase,
      dutyRegions: dutyRegions || [],
      ratioBase: initialRatio,
      bidAmount: initialBidAmount,
      bidRate: normalizedBidRate,
      adjustmentRate: normalizedAdjustmentRate,
      minPct: '',
      maxPct: '',
      excludeSingleBidEligible: defaultExcludeSingle,
      filterByRegion: true,
    };
  }, [isMoisUnder30, perfAmountValue, estimatedAmount, entryAmount, baseAmount, dutyRegions, ratioBaseAmount, bidAmount, bidRate, adjustmentRate, defaultExcludeSingle, hasEntryLimit, isPpsOwner]);

  const initKey = JSON.stringify({ ownerId, menuKey, entryAmount, baseAmount, estimatedAmount, perfAmountValue, dutyRegions, ratioBaseAmount, bidAmount, bidRate, adjustmentRate, defaultExcludeSingle, fileType });
  const didInitFetch = useRef(false);
  const ratioLabel = showTenderFields ? '투찰금액(지분 기준)' : '시공비율 기준금액';
  const displayEntryAmountRaw = formatAmount(params.entryAmount || entryAmount);
  const displayEntryAmount = hasEntryLimit
    ? (displayEntryAmountRaw !== '-' ? displayEntryAmountRaw : '')
    : '없음';
  const displayBaseAmountRaw = formatAmount(params.baseAmount || baseAmount);
  const displayBaseAmount = displayBaseAmountRaw !== '-' ? displayBaseAmountRaw : '';
  const displayAdjustmentRate = formatPercentInput(params.adjustmentRate || adjustmentRate);
  const displayBidRate = formatPercentInput(params.bidRate || bidRate);
  const bidAmountSource = params.bidAmount || params.ratioBase || bidAmount;
  const displayBidAmountRaw = bidAmountSource ? formatAmount(bidAmountSource) : '';
  const displayBidAmount = displayBidAmountRaw !== '-' ? displayBidAmountRaw : '';
  useEffect(() => {
    if (!open) return;
    const initial = initialParamsSnapshot;
    setParams(initial);
    setBidTouched(false);
    bidAutoRef.current = initial.bidAmount || '';
    setSearchQuery('');
    setManagerQuery('');
    if (readOnlyMode) {
      setList([]);
      setPinned(new Set());
      setExcluded(new Set());
      didInitFetch.current = false;
    } else {
      const clonedCandidates = Array.isArray(initialCandidates)
        ? initialCandidates.map((item) => (item && typeof item === 'object' ? { ...item } : item))
        : [];
      setList(clonedCandidates);
      setPinned(new Set(Array.isArray(initialPinned) ? initialPinned : []));
      setExcluded(new Set(Array.isArray(initialExcluded) ? initialExcluded : []));
      didInitFetch.current = clonedCandidates.length > 0;
    }
    setError('');
    setApplying(false);
    setOnlyLatest(false);
  }, [open, initKey, initialParamsSnapshot, initialCandidates, initialPinned, initialExcluded, readOnlyMode]);

  // Auto fetch on open with incoming values (once per open/inputs)
  useEffect(() => {
    if (!open) return;
    if (didInitFetch.current) return;
    const initial = initialParamsSnapshot;
    const entryAmountToken = hasEntryLimit ? String(initial.entryAmount || '').trim() : '';
    const hasAmounts = entryAmountToken || String(initial.baseAmount || '').trim() || String(estimatedAmount || '').trim();
    const hasRegions = Array.isArray(initial.dutyRegions) && initial.dutyRegions.length > 0;
    if (hasAmounts || hasRegions) {
      didInitFetch.current = true;
      runFetch(initial);
    }
  }, [open, initKey, initialParamsSnapshot, estimatedAmount, hasEntryLimit]);

  const formatScore = (value) => {
    if (value === null || value === undefined) return '-';
    const n = Number(value);
    if (!Number.isFinite(n)) return '-';
    const fixed = n.toFixed(2);
    return fixed.replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
  };

  const formatYears = (value) => {
    if (value === null || value === undefined) return '-';
    const n = Number(value);
    if (!Number.isFinite(n)) return '-';
    const precision = Math.abs(n - Math.round(n)) < 0.01 ? 0 : 1;
    return n.toFixed(precision).replace(/\.0$/, '');
  };

  const formatDate = (value) => {
    if (!value) return '';
    let date = null;
    if (value instanceof Date) {
      date = value;
    } else if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return '';
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        const [y, m, d] = trimmed.split('-').map(Number);
        if (y && m && d) date = new Date(y, m - 1, d);
      } else if (/^\d{4}\.\d{2}\.\d{2}$/.test(trimmed)) {
        const [y, m, d] = trimmed.split('.').map(Number);
        if (y && m && d) date = new Date(y, m - 1, d);
      } else {
        const guess = new Date(trimmed);
        if (!Number.isNaN(guess.getTime())) date = guess;
      }
    } else {
      const fallback = new Date(value);
      if (!Number.isNaN(fallback.getTime())) date = fallback;
    }
    if (!date || Number.isNaN(date.getTime())) return '';
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}.${mm}.${dd}`;
  };

  const formatRatio = (value) => {
    if (value === null || value === undefined) return '-';
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return '-';
    return `${n.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}%`;
  };

  const formatPercent = (value) => {
    if (value === null || value === undefined) return '-';
    const n = Number(value);
    if (!Number.isFinite(n)) return '-';
    const percent = n * 100;
    return `${percent.toFixed(1).replace(/\.0$/, '')}%`;
  };

  function formatPercentInput(value) {
    if (value === null || value === undefined) return '';
    const numeric = Number(String(value).replace(/[^0-9.\-]/g, ''));
    if (!Number.isFinite(numeric)) return '';
    const str = numeric.toFixed(3).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
    return `${str}%`;
  }

  const resolveSingleBidReasons = useCallback((candidate) => {
    if (!candidate) return [];
    const provided = Array.isArray(candidate.singleBidReasons)
      ? candidate.singleBidReasons.filter(Boolean)
      : [];
    if (provided.length > 0) return provided;
    const reasons = [];
    if (candidate.moneyOk === false) reasons.push('입찰참가자격 금액부족');
    if (candidate.perfOk === false) reasons.push('실적부족');
    if (candidate.regionOk === false) reasons.push('의무지역 불일치');
    if (candidate.managementIsPerfect === false
      && candidate.moneyOk !== false
      && candidate.perfOk !== false) {
      reasons.push('경영점수 만점 미달');
    }
    return reasons;
  }, []);

  const handleCopyCandidate = useCallback(async (candidate, pctValue) => {
    if (typeof window === 'undefined' || !candidate) return;
    const name = (() => {
      const raw = String(candidate.name ?? '').trim();
      let cleaned = raw.replace(/㈜|\(주\)/g, '');
      cleaned = cleaned.replace(/^\s*주식회사\s*/i, '');
      cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
      return cleaned;
    })();
    const manager = String(candidate.manager ?? '').trim();
    const share = (Number.isFinite(pctValue) && pctValue < 100)
      ? pctValue.toFixed(2)
      : '';
    const lines = [name];
    if (share) lines.push(share);
    if (manager) lines.push(manager);
    const block = lines.join('\n');
    try {
      if (window.electronAPI?.copyCsvColumn) {
        const result = await window.electronAPI.copyCsvColumn([block]);
        if (!result?.success) {
          throw new Error(result?.message || 'copy failed');
        }
      } else if (typeof navigator !== 'undefined' && navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(block);
      } else {
        throw new Error('clipboard unavailable');
      }
      window.alert('업체 정보가 클립보드에 복사되었습니다.');
    } catch (err) {
      console.error('[CandidatesModal] copy failed', err);
      window.alert('복사에 실패했습니다. 다시 시도해 주세요.');
    }
  }, []);

  function formatAmount(value) {
    if (value === null || value === undefined) return '-';
    const cleaned = String(value).replace(/[^0-9.\-]/g, '').trim();
    if (!cleaned) return '-';
    const num = Number(cleaned);
    if (!Number.isFinite(num)) return '-';
    try { return num.toLocaleString('ko-KR'); } catch { return String(num); }
  }

  const copyPlainText = useCallback(async (text) => {
    if (typeof window === 'undefined') return false;
    const payload = String(text ?? '');
    try {
      if (window.electronAPI?.clipboardWriteText) {
        const result = await window.electronAPI.clipboardWriteText(payload);
        if (!result?.success) throw new Error(result?.message || 'copy failed');
      } else if (typeof navigator !== 'undefined' && navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload);
      } else {
        throw new Error('clipboard unavailable');
      }
      return true;
    } catch (err) {
      console.error('[CandidatesModal] clipboard copy failed', err);
      return false;
    }
  }, []);

  const handleCopyAmountField = useCallback(async (candidate, resolvers, label) => {
    if (!candidate) return;
    const resolved = resolveCandidateValue(candidate, resolvers);
    const numeric = parseAmountValue(resolved);
    if (numeric === null) {
      window.alert(`${label} 정보를 찾을 수 없습니다.`);
      return;
    }
    const formatted = formatAmount(numeric);
    if (!formatted || formatted === '-') {
      window.alert(`${label} 정보를 찾을 수 없습니다.`);
      return;
    }
    const ok = await copyPlainText(formatted);
    if (ok) {
      window.alert(`${label}이(가) 복사되었습니다.`);
    } else {
      window.alert('복사에 실패했습니다. 다시 시도해 주세요.');
    }
  }, [copyPlainText]);

  const handleCopySipyungField = useCallback((candidate) => {
    handleCopyAmountField(candidate, SIPYUNG_RESOLVERS, '시평액');
  }, [handleCopyAmountField]);

  const handleCopyPerf5yField = useCallback((candidate) => {
    handleCopyAmountField(candidate, PERF5Y_RESOLVERS, '5년 실적');
  }, [handleCopyAmountField]);

  const details = useMemo(() => ({
    noticeNo,
    title: noticeTitle,
    industryLabel: industryLabel || industryToLabel(fileType),
    baseAmount: formatAmount(baseAmount),
    estimatedPrice: formatAmount(estimatedAmount),
    bidAmount: formatAmount(bidAmount),
    bidRate: formatPercentInput(bidRate),
    adjustmentRate: formatPercentInput(adjustmentRate),
    noticeDate: noticeDate ? formatDate(noticeDate) : '',
  }), [noticeNo, noticeTitle, industryLabel, fileType, baseAmount, estimatedAmount, bidAmount, bidRate, adjustmentRate, noticeDate]);

  const headerAdjustmentRate = displayAdjustmentRate || details.adjustmentRate;
  const headerBidRate = displayBidRate || details.bidRate;
  const headerBidAmount = displayBidAmount || details.bidAmount;

  const isMaxScore = (score, maxScore) => {
    const scoreNum = Number(score);
    const maxNum = Number(maxScore);
    if (!Number.isFinite(scoreNum) || !Number.isFinite(maxNum) || maxNum <= 0) return false;
    return Math.abs(scoreNum - maxNum) < 1e-6;
  };

  const chooseDefaultMax = (type) => {
    const owner = String(ownerId || '').toUpperCase();
    if (type === 'debt') {
      if (owner === 'MOIS') return 8;
      return 7;
    }
    if (type === 'current') {
      if (owner === 'MOIS') return 7;
      return 7;
    }
    if (type === 'credit') {
      return 15;
    }
    return null;
  };

  const parseNumeric = (value) => {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const cleaned = String(value).replace(/[^0-9.+-]/g, '').trim();
    if (!cleaned) return 0;
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : 0;
  };

  const runFetch = async (overrideParams = null) => {
    const requestParams = overrideParams ? { ...overrideParams } : { ...params };
    const hasRegionFilters = Array.isArray(requestParams.dutyRegions) && requestParams.dutyRegions.length > 0;
    const filterByRegion = !!requestParams.filterByRegion && hasRegionFilters;
    const dutyRegionsPayload = filterByRegion ? requestParams.dutyRegions : [];
    setLoading(true); setError(''); setList([]);
    try {
      const perfectAmountParam = isMoisUnder30 ? requestParams.baseAmount : perfAmountValue;
      const r = await window.electronAPI.fetchCandidates({
        ownerId,
        menuKey,
        rangeId,
        fileType,
        entryAmount: requestParams.entryAmount,
        baseAmount: requestParams.baseAmount,
        estimatedAmount,
        perfectPerformanceAmount: perfectAmountParam,
        dutyRegions: dutyRegionsPayload,
        excludeSingleBidEligible: requestParams.excludeSingleBidEligible,
        filterByRegion,
        evaluationDate: noticeDate,
      });
      if (!r?.success) throw new Error(r?.message || '후보 요청 실패');

      const enriched = (r.data || []).map((item) => {
        const snapshot = { ...item };
        const debtRatioRaw = parseNumeric(item.debtRatio ?? item['부채비율']);
        const currentRatioRaw = parseNumeric(item.currentRatio ?? item['유동비율']);
        const debtAgainstAvg = Number(item.debtAgainstAverage ?? item['부채평균대비']);
        const currentAgainstAvg = Number(item.currentAgainstAverage ?? item['유동평균대비']);
        const creditScoreRaw = item.creditScore ?? null;
        const creditGradeSource = item['신용평가'] ?? '';
        const creditGradeRaw = item.creditGrade ?? creditGradeSource;
        const creditNoteOriginal = item.creditNoteText ?? item['신용메모'] ?? '';
        const creditNoteStatus = item.creditNote ?? '';
        const bizYearsValue = (() => {
          const candidates = [
            item.bizYears,
            item['영업기간'],
            snapshot.bizYears,
            snapshot['영업기간'],
          ];
          for (const candidateValue of candidates) {
            if (candidateValue === null || candidateValue === undefined || candidateValue === '') continue;
            const parsed = parseNumeric(candidateValue);
            if (Number.isFinite(parsed)) return parsed;
          }
          return null;
        })();
        const bizYearsScoreValue = (() => {
          const raw = item.bizYearsScore;
          if (raw === null || raw === undefined || raw === '') return null;
          const num = Number(raw);
          return Number.isFinite(num) ? num : null;
        })();
        const bizYearsMaxScoreValue = (() => {
          const raw = item.bizYearsMaxScore;
          if (raw === null || raw === undefined || raw === '') return null;
          const num = Number(raw);
          return Number.isFinite(num) ? num : null;
        })();
        const bizYearsStartDate = (() => {
          const raw = item.bizYearsStartDate || snapshot.bizYearsStartDate;
          if (!raw) return null;
          const date = new Date(raw);
          return Number.isNaN(date.getTime()) ? null : date;
        })();
        const singleBidReasons = Array.isArray(item.singleBidReasons)
          ? item.singleBidReasons.filter(Boolean)
          : [];
        const singleBidFacts = (() => {
          const rawFacts = item.singleBidFacts;
          if (!rawFacts || typeof rawFacts !== 'object') return null;
          const regionRaw = rawFacts.region != null ? String(rawFacts.region).trim() : '';
          const safeNumber = (v) => {
            if (v === null || v === undefined || v === '') return null;
            const num = parseNumeric(v);
            return Number.isFinite(num) ? num : null;
          };
          return {
            sipyung: safeNumber(rawFacts.sipyung),
            perf5y: safeNumber(rawFacts.perf5y),
            entry: safeNumber(rawFacts.entry),
            base: safeNumber(rawFacts.base),
            region: regionRaw,
          };
        })();
        return {
          ...item,
          snapshot,
          debtRatio: debtRatioRaw,
          currentRatio: currentRatioRaw,
          debtScore: item.debtScore ?? null,
          currentScore: item.currentScore ?? null,
          debtAgainstAverage: Number.isFinite(debtAgainstAvg) && debtAgainstAvg > 0 ? debtAgainstAvg : null,
          currentAgainstAverage: Number.isFinite(currentAgainstAvg) && currentAgainstAvg > 0 ? currentAgainstAvg : null,
          creditScore: creditScoreRaw != null ? Number(creditScoreRaw) : null,
          creditGrade: creditGradeRaw ? String(creditGradeRaw).toUpperCase() : '',
          creditGradeText: creditGradeSource ? String(creditGradeSource) : '',
          creditNote: creditNoteStatus ? String(creditNoteStatus).toLowerCase() : '',
          creditNoteText: creditNoteOriginal ? String(creditNoteOriginal) : '',
          debtMaxScore: item.debtMaxScore ?? null,
          currentMaxScore: item.currentMaxScore ?? null,
          creditMaxScore: item.creditMaxScore ?? null,
          bizYears: bizYearsValue,
          bizYearsScore: bizYearsScoreValue,
          bizYearsMaxScore: bizYearsMaxScoreValue,
          bizYearsStartDate,
          singleBidReasons,
          singleBidFacts,
          _sipyung: (() => {
            const candidates = [
              item.sipyung,
              item.rating,
              item['시평'],
              item['시평액'],
              item['시평액(원)'],
              item['기초금액'],
              item['기초금액(원)'],
              snapshot.rating,
              snapshot['시평'],
              snapshot['시평액'],
              snapshot['시평액(원)'],
              snapshot['기초금액'],
              snapshot['기초금액(원)'],
            ];
            for (const candidateValue of candidates) {
              const parsed = parseNumeric(candidateValue);
              if (Number.isFinite(parsed)) return parsed;
            }
            return null;
          })(),
          _performance5y: (() => {
            const candidates = [
              item.performance5y,
              item.perf5y,
              item['5년 실적'],
              item['5년실적'],
              item['5년 실적 합계'],
              item['최근5년실적'],
              item['최근5년실적합계'],
              item['5년실적금액'],
              item['최근5년시공실적'],
              snapshot.perf5y,
              snapshot['5년 실적'],
              snapshot['5년실적'],
              snapshot['5년 실적 합계'],
              snapshot['최근5년실적'],
              snapshot['최근5년실적합계'],
              snapshot['5년실적금액'],
              snapshot['최근5년시공실적'],
            ];
            for (const candidateValue of candidates) {
              const parsed = parseNumeric(candidateValue);
              if (Number.isFinite(parsed)) return parsed;
            }
            return null;
          })(),
          _score: (() => {
            const candidates = [
              item.score,
              item.totalScore,
              item['총점'],
              item['평균점수'],
              item['적격점수'],
              item['종합점수'],
              item['평가점수'],
              snapshot['총점'],
              snapshot['평균점수'],
              snapshot['적격점수'],
              snapshot['종합점수'],
              snapshot['평가점수'],
            ];
            for (const candidateValue of candidates) {
              const parsed = parseNumeric(candidateValue);
              if (Number.isFinite(parsed)) return parsed;
            }
            return null;
          })(),
          _share: (() => {
            const candidates = [
              item.share,
              item['_pct'],
              item.candidateShare,
              item['지분'],
              item['기본지분'],
              snapshot['share'],
              snapshot['_pct'],
              snapshot['지분'],
            ];
            for (const candidateValue of candidates) {
              const parsed = parseNumeric(candidateValue);
              if (Number.isFinite(parsed)) return parsed;
            }
            return null;
          })(),
        };
      });

      setList(enriched);
    } catch (e) { setError(String(e.message || e)); }
    finally { setLoading(false); }
  };

  const toggle = (set, id) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  };

  const onTogglePin = (id) => {
    if (readOnlyMode) return;
    setPinned((prev) => toggle(prev, id));
  };
  const onToggleExclude = (id) => {
    if (readOnlyMode) return;
    setExcluded((prev) => toggle(prev, id));
  };

  const parseAmount = (s) => Number(String(s || '').replace(/[^0-9]/g, '')) || 0;
  const ratioBase = useMemo(() => parseAmount(params.ratioBase), [params.ratioBase]);

  const computed = useMemo(() => {
    return (list || []).map((c) => {
      let pctRaw = null; let pct = null;
      if (ratioBase > 0) {
        const r = Number(c.rating || 0);
        if (Number.isFinite(r) && r > 0) {
          pctRaw = (r / ratioBase) * 100;        // 정렬은 원시 비율값으로만
          pct = Math.floor(pctRaw * 100) / 100;  // 표시값은 둘째자리 내림
        }
      }
      return { ...c, _pct: pct, _pctRaw: pctRaw };
    });
  }, [list, ratioBase]);

  useEffect(() => {
    if (!open || !showTenderFields) return;
    const baseSource = params.baseAmount || baseAmount;
    const bidRateSource = params.bidRate || bidRate;
    const adjustmentSource = params.adjustmentRate || adjustmentRate;
    const baseNumeric = parseAmountValue(baseSource);
    const bidRateNumeric = parsePercentValue(bidRateSource);
    const adjustmentNumeric = parsePercentValue(adjustmentSource);
    const autoValue = (baseNumeric != null && baseNumeric > 0
      && Number.isFinite(bidRateNumeric)
      && Number.isFinite(adjustmentNumeric))
      ? Math.round(baseNumeric * bidRateNumeric * adjustmentNumeric)
      : 0;
    const autoFormatted = formatAmountString(autoValue);
    const current = params.bidAmount || '';
    const lastAuto = bidAutoRef.current;
    bidAutoRef.current = autoFormatted;
    if (bidTouched && current !== lastAuto) return;
    if (current === (autoFormatted || '')) return;
    if (!autoFormatted && current === '') return;
    setParams((prev) => ({
      ...prev,
      bidAmount: autoFormatted,
      ratioBase: autoFormatted,
    }));
  }, [open, showTenderFields, params.baseAmount, params.bidRate, params.adjustmentRate, params.bidAmount, bidTouched, baseAmount, bidRate, adjustmentRate]);

  const filtered = useMemo(() => {
    const toFloat = (s) => {
      const t = String(s ?? '').trim();
      if (!t) return null;
      const n = Number(t);
      return Number.isFinite(n) ? n : null;
    };
    const min = toFloat(params.minPct);
    const max = toFloat(params.maxPct);
    const normalizedQuery = String(searchQuery || '').trim().toLowerCase();
    const normalizedManagerQuery = String(managerQuery || '').trim().toLowerCase();
    const hasQuery = normalizedQuery.length > 0;
    const hasManagerQuery = normalizedManagerQuery.length > 0;
    return computed.map((c) => {
      const summaryStatus = (c.summaryStatus || c['요약상태'] || '').trim();
      return { ...c, summaryStatus };
    }).filter((c) => {
      if (excluded.has(c.id)) return false;
      if (params.excludeSingleBidEligible && c.singleBidEligible && !c.wasAlwaysIncluded) return false;
      if (onlyLatest && !c.isLatest) return false;
      if (params.filterByRegion && Array.isArray(params.dutyRegions) && params.dutyRegions.length > 0 && c.regionOk === false && !c.wasAlwaysIncluded) return false;
      if (min !== null && (c._pct === null || c._pct < min)) return false;
      if (max !== null && (c._pct === null || c._pct > max)) return false;
      if (hasQuery) {
        const textFields = [
          getCandidateTextField(c, ['name', '검색된 회사', '업체명']),
          getCandidateTextField(c, ['대표자', '대표자명']),
          getCandidateTextField(c, ['manager', '담당자', '담당자명']),
          getCandidateTextField(c, ['region', '대표지역', '지역']),
          getCandidateTextField(c, ['bizNo', '사업자번호']),
        ];
        const managerMatch = extractManagerNames(c).some((name) => name && name.toLowerCase().includes(normalizedQuery));
        const textMatch = textFields.some((value) => value && String(value).toLowerCase().includes(normalizedQuery));
        if (!textMatch && !managerMatch) return false;
      }
      if (hasManagerQuery) {
        const directManagerFields = [
          getCandidateTextField(c, ['manager', '담당자', '담당자명', '담당자1', '담당'])
        ];
        const listManagers = extractManagerNames(c);
        const matchesDirect = directManagerFields.some((value) => value && String(value).toLowerCase().includes(normalizedManagerQuery));
        const matchesList = listManagers.some((value) => value && String(value).toLowerCase().includes(normalizedManagerQuery));
        if (!matchesDirect && !matchesList) return false;
      }
      return true;
    });
  }, [computed, params.minPct, params.maxPct, params.excludeSingleBidEligible, params.filterByRegion, params.dutyRegions, excluded, onlyLatest, searchQuery, managerQuery]);

  const sorted = useMemo(() => {
    const arr = filtered.slice();
    const accessor = (item) => {
      switch (sortKey) {
        case 'perf5y':
          return Number.isFinite(Number(item._performance5y)) ? Number(item._performance5y) : null;
        case 'sipyung':
          return Number.isFinite(Number(item._sipyung)) ? Number(item._sipyung) : null;
        case 'share':
        default:
          return item._pctRaw != null && Number.isFinite(Number(item._pctRaw)) ? Number(item._pctRaw) : null;
      }
    };
    arr.sort((a, b) => {
      const av = accessor(a);
      const bv = accessor(b);
      const aNull = av == null;
      const bNull = bv == null;
      if (aNull && bNull) {
        return String(a.name || '').localeCompare(String(b.name || ''), 'ko-KR');
      }
      if (aNull) return 1;
      if (bNull) return -1;
      const diff = sortDir === 'asc' ? (av - bv) : (bv - av);
      if (diff !== 0) return diff;
      return String(a.name || '').localeCompare(String(b.name || ''), 'ko-KR');
    });
    return arr;
  }, [filtered, sortDir, sortSeq, sortKey]);

  const autoPinned = useMemo(() => {
    if (readOnlyMode || !autoPin) return new Set();
    const ids = [];
    for (const c of sorted) {
      if (ids.length >= Math.max(0, Number(autoCount) || 0)) break;
      ids.push(c.id);
    }
    return new Set(ids);
  }, [readOnlyMode, autoPin, autoCount, sorted]);

  const pinnedView = useMemo(() => {
    const s = new Set(pinned);
    autoPinned.forEach((id) => s.add(id));
    return s;
  }, [pinned, autoPinned]);

  const summary = useMemo(() => ({ total: sorted.length, pinned: pinnedView.size, excluded: excluded.size }), [sorted, pinnedView, excluded]);

  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  const handleApply = useCallback(async () => {
    if (readOnlyMode || !onApply) {
      onClose?.();
      return;
    }
    try {
      setApplying(true);
      const result = onApply({
        candidates: list,
        pinned: Array.from(pinned),
        excluded: Array.from(excluded),
        params: {
          entryAmount: params.entryAmount,
          baseAmount: params.baseAmount,
          ratioBase: params.ratioBase,
          bidAmount: params.bidAmount,
          bidRate: params.bidRate,
          adjustmentRate: params.adjustmentRate,
        },
      });
      if (result && typeof result.then === 'function') {
        await result;
      }
    } catch (e) {
      console.warn('Candidates apply failed:', e);
    } finally {
      setApplying(false);
    }
  }, [readOnlyMode, onApply, list, pinned, excluded, params, onClose]);

  if (!open || !portalContainer) return null;

  return createPortal(
    <div className="candidates-window">
      <header className="candidates-window__header">
        <div className="candidates-window__header-details">
          <div className="header-title-line">
            <h2>지역사 찾기</h2>
            <div className="candidates-window__header-meta">
              <span><strong>공고명</strong> {details.title || '-'}</span>
              <span><strong>공고번호</strong> {details.noticeNo || '-'}</span>
              <span><strong>공종</strong> {details.industryLabel || '-'}</span>
              {details.noticeDate && (
                <span><strong>공고일</strong> {details.noticeDate}</span>
              )}
              <span><strong>기초금액</strong> {(displayBaseAmount || details.baseAmount || '-')}</span>
              <span><strong>추정금액</strong> {details.estimatedPrice || '-'}</span>
              <span><strong>참가자격</strong> {displayEntryAmount || '-'}</span>
              {headerAdjustmentRate && <span><strong>투찰율</strong> {headerAdjustmentRate}</span>}
              {headerBidRate && <span><strong>사정율</strong> {headerBidRate}</span>}
              {headerBidAmount && (
                <span><strong>투찰금액</strong> {headerBidAmount}</span>
              )}
            </div>
          </div>
          <p>
            {readOnlyMode
              ? `총 ${summary.total}개`
              : `총 ${summary.total}개 · 선택 ${summary.pinned} · 제외 ${summary.excluded}`}
          </p>
          {loading && <span className="candidates-window__loading">검색 중…</span>}
        </div>
        <div className="candidates-window__header-actions">
          {!readOnlyMode && (
            <button className="primary" onClick={handleApply} disabled={applying}>{applying ? '적용 중…' : '선택 적용'}</button>
          )}
          <button className="btn-muted" onClick={handleClose}>닫기</button>
        </div>
      </header>
      <div className="candidates-window__content" style={{ display: 'grid', gridTemplateColumns: '260px minmax(0, 1fr)', gap: 16, padding: '14px 18px 18px' }}>
        <div className="panel candidates-window__filters" style={{ padding: 12, fontSize: 14 }}>
          <div className="filter-item">
            <label>입찰참가자격금액</label>
            <AmountInput
              value={params.entryAmount}
              onChange={(v)=>{
                if (!hasEntryLimit) return;
                setParams((p)=>({ ...p, entryAmount: v }));
              }}
              placeholder="숫자"
              style={{ opacity: hasEntryLimit ? 1 : 0.5 }}
            />
          </div>
          <div className="filter-item">
            <label>{isMoisUnder30 ? '실적만점금액' : '기초금액'}</label>
            <AmountInput value={params.baseAmount} onChange={(v)=>setParams(p=>({ ...p, baseAmount: v }))} placeholder="숫자" />
          </div>
          {!isMoisUnder30 && hasEntryLimit && (
            <div className="filter-item">
              <label>{ratioLabel}</label>
              <AmountInput
                value={params.ratioBase}
                onChange={(v)=>{
                  setBidTouched(true);
                  setParams((p)=>({ ...p, ratioBase: v, bidAmount: v }));
                }}
                placeholder="숫자"
              />
            </div>
          )}
          {showTenderFields && (
            <div className="filter-item">
              <label>투찰율(%)</label>
              <input
                className="filter-input"
                inputMode="decimal"
                value={params.adjustmentRate}
                onChange={(e)=>{
                  const value = e.target.value.replace(/[^0-9.\-]/g, '');
                  setParams((p)=>({ ...p, adjustmentRate: value }));
                }}
                placeholder="예: 88.745"
              />
            </div>
          )}
          {showTenderFields && (
            <div className="filter-item">
              <label>사정율(%)</label>
              <input
                className="filter-input"
                inputMode="decimal"
                value={params.bidRate}
                onChange={(e)=>{
                  const value = e.target.value.replace(/[^0-9.\-]/g, '');
                  setParams((p)=>({ ...p, bidRate: value }));
                }}
                placeholder="예: 101.8"
              />
            </div>
          )}
          {!isMoisUnder30 && (
            <div className="filter-item">
              <label>가능지분 필터(%)</label>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 8 }}>
                <input className="filter-input" placeholder="최소" value={params.minPct} onChange={(e)=>setParams(p=>({ ...p, minPct: e.target.value.replace(/[^0-9.]/g,'') }))} />
                <input className="filter-input" placeholder="최대" value={params.maxPct} onChange={(e)=>setParams(p=>({ ...p, maxPct: e.target.value.replace(/[^0-9.]/g,'') }))} />
              </div>
            </div>
          )}
          <div className="filter-item">
            <label>업체 검색</label>
            <div style={{ display:'flex', gap: 6 }}>
              <input
                className="filter-input"
                placeholder="업체명/대표자 검색"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ flex: 1 }}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="btn-sm btn-muted"
                  onClick={() => setSearchQuery('')}
                >
                  초기화
                </button>
              )}
            </div>
          </div>
          <div className="filter-item" style={{ marginTop: -4 }}>
            <label>담당자 검색</label>
            <div style={{ display:'flex', gap: 6 }}>
              <input
                className="filter-input"
                placeholder="담당자 이름 검색"
                value={managerQuery}
                onChange={(e) => setManagerQuery(e.target.value)}
                style={{ flex: 1 }}
              />
              {managerQuery && (
                <button
                  type="button"
                  className="btn-sm btn-muted"
                  onClick={() => setManagerQuery('')}
                >
                  초기화
                </button>
              )}
            </div>
          </div>
          <div className="filter-item">
            <label>의무지역({(params.dutyRegions||[]).length})</label>
            <div className="chips" style={{ marginTop: 6 }}>
              {(params.dutyRegions || []).map((r) => (<span key={r} className="chip">{r}</span>))}
              {(params.dutyRegions || []).length === 0 && <span style={{ color:'#6b7280' }}>지정 안 함</span>}
            </div>
          </div>
          <label style={{ display:'inline-flex', alignItems:'center', gap:8, marginTop: 8, fontSize: 14 }}>
            <input type="checkbox" checked={!!params.excludeSingleBidEligible} onChange={(e)=>setParams(p=>({ ...p, excludeSingleBidEligible: !!e.target.checked }))} />
            단독입찰 가능 업체 제외
          </label>
          <label style={{ display:'inline-flex', alignItems:'center', gap:8, marginTop: 6, fontSize: 14 }}>
            <input type="checkbox" checked={!!params.filterByRegion} onChange={(e)=>setParams(p=>({ ...p, filterByRegion: !!e.target.checked }))} />
            의무지역 충족 업체만 포함
          </label>
          <label style={{ display:'inline-flex', alignItems:'center', gap:8, marginTop: 6, fontSize: 14 }}>
            <input type="checkbox" checked={onlyLatest} onChange={(e)=>setOnlyLatest(!!e.target.checked)} />
            최신자료 업체만
          </label>
          <div style={{ marginTop: 12 }}>
            <button className="btn-soft" onClick={() => runFetch()} disabled={loading}>후보 검색</button>
            {loading && <span style={{ marginLeft: 8, color: '#6b7280' }}>검색 중…</span>}
            {error && <div className="error-message" style={{ marginTop: 8 }}>{error}</div>}
          </div>
        </div>
        <div className="panel candidates-window__results" style={{ padding: 16, fontSize: 14, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ color: '#6b7280' }}>
              {readOnlyMode
                ? `총 ${summary.total}개`
                : `총 ${summary.total}개 · 선택 ${summary.pinned} · 제외 ${summary.excluded}`}
            </div>
            <div style={{ display:'flex', gap: 6, alignItems:'center', flexWrap: 'wrap' }}>
              <button className={`btn-sm ${isActiveSort('share','desc') ? 'primary' : 'btn-soft'}`} onClick={()=>applySort('share','desc')}>지분 높은순</button>
              <button className={`btn-sm ${isActiveSort('share','asc') ? 'primary' : 'btn-soft'}`} onClick={()=>applySort('share','asc')}>지분 낮은순</button>
              <button className={`btn-sm ${isActiveSort('perf5y','desc') ? 'primary' : 'btn-soft'}`} onClick={()=>applySort('perf5y','desc')}>5년실적 높은순</button>
              <button className={`btn-sm ${isActiveSort('perf5y','asc') ? 'primary' : 'btn-soft'}`} onClick={()=>applySort('perf5y','asc')}>5년실적 낮은순</button>
              <button className={`btn-sm ${isActiveSort('sipyung','desc') ? 'primary' : 'btn-soft'}`} onClick={()=>applySort('sipyung','desc')}>시평액 높은순</button>
              <button className={`btn-sm ${isActiveSort('sipyung','asc') ? 'primary' : 'btn-soft'}`} onClick={()=>applySort('sipyung','asc')}>시평액 낮은순</button>
              {!readOnlyMode && (
                <>
                  <label style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                    <input type="checkbox" checked={autoPin} onChange={(e)=>setAutoPin(!!e.target.checked)} /> 자동 선택 상위
                  </label>
                  <input type="number" min={1} max={10} value={autoCount} onChange={(e)=>setAutoCount(e.target.value)} style={{ width: 68, height: 32, borderRadius: 8, border: '1px solid #d0d5dd', padding: '0 8px' }} />
                  <button className="btn-muted btn-sm" onClick={()=>{ setPinned(new Set()); setExcluded(new Set()); }}>선택 초기화</button>
                </>
              )}
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, paddingBottom: 4 }}>
            <table className="details-table" style={{ width: '100%', minWidth: 920, tableLayout: 'auto' }}>
              <thead>
                <tr>
                  <th style={{ width: '22%' }}>업체명</th>
                  <th style={{ width: '12%' }}>대표자</th>
                  <th style={{ width: '9%' }}>지역</th>
                  <th style={{ width: '13%' }}>시평</th>
                  <th style={{ width: '13%' }}>5년실적</th>
                  <th style={{ width: '11%' }}>가능지분(%)</th>
                  <th style={{ width: '20%', textAlign: 'left' }}>상태</th>
                </tr>
              </thead>
              <tbody>
                {(sorted || []).map((c, idx) => {
                  const pct = c._pct;
                  const isAuto = autoPinned.has(c.id);
                  const debtMax = Number.isFinite(Number(c.debtMaxScore)) && Number(c.debtMaxScore) > 0
                    ? Number(c.debtMaxScore)
                    : chooseDefaultMax('debt');
                  const currentMax = Number.isFinite(Number(c.currentMaxScore)) && Number(c.currentMaxScore) > 0
                    ? Number(c.currentMaxScore)
                    : chooseDefaultMax('current');
                  const creditMax = Number.isFinite(Number(c.creditMaxScore)) && Number(c.creditMaxScore) > 0
                    ? Number(c.creditMaxScore)
                    : chooseDefaultMax('credit');
                  const debtScore = c.debtScore != null ? Number(c.debtScore) : null;
                  const currentScore = c.currentScore != null ? Number(c.currentScore) : null;
                  const creditScore = c.creditScore != null ? Number(c.creditScore) : null;
                  const combinedScore = (Number.isFinite(debtScore) ? debtScore : 0) + (Number.isFinite(currentScore) ? currentScore : 0);
                  const combinedMax = (Number.isFinite(debtMax) ? debtMax : 0) + (Number.isFinite(currentMax) ? currentMax : 0);
                  const managementMax = Math.max(combinedMax, Number.isFinite(creditMax) ? creditMax : 0);
                  const creditNoteLower = String(c.creditNote || '').trim().toLowerCase();
                  const creditNoteTextRaw = c.creditNoteText || '';
                  const creditNoteTextLower = creditNoteTextRaw.trim().toLowerCase();
                  const creditGradePure = (c.creditGrade || '').trim();
                  const creditGradeTextRaw = c.creditGradeText || creditGradePure;
                  const creditGradeTextLower = creditGradeTextRaw.trim().toLowerCase();
                  const creditScoreValue = Number.isFinite(creditScore) ? Number(creditScore) : null;
                  const creditExpiredFlag = /expired|만료|기한경과|유효\s*기간\s*만료/.test(creditNoteLower)
                    || /만료|기한경과|유효\s*기간\s*만료/.test(creditGradeTextLower)
                    || /만료|기한경과|유효\s*기간\s*만료/.test(creditNoteTextLower);
                  const creditOverAge = /over-age|기간\s*초과|인정\s*기간\s*초과|인정기간\s*초과/.test(creditNoteLower)
                    || /기간\s*초과|인정\s*기간\s*초과|인정기간\s*초과/.test(creditGradeTextLower)
                    || /기간\s*초과|인정\s*기간\s*초과|인정기간\s*초과/.test(creditNoteTextLower);
                  const expiryFromGrade = extractExpiryDate(creditGradeTextRaw);
                  const expiryFromNote = extractExpiryDate(creditNoteTextRaw);
                  const expiryDate = expiryFromGrade || expiryFromNote;
                  const isExpiredByDate = expiryDate ? expiryDate < today : false;
                  const creditUsable = creditScoreValue != null && !(creditExpiredFlag || creditOverAge || isExpiredByDate);
                  const effectiveCreditScore = creditUsable ? creditScoreValue : null;
                  let managementScore = Number.isFinite(effectiveCreditScore)
                    ? Math.max(combinedScore, effectiveCreditScore)
                    : combinedScore;
                  const combinedIsMax = combinedMax > 0 && Math.abs(combinedScore - combinedMax) < 1e-6;
                  const creditIsMax = creditUsable
                    && Number.isFinite(creditScoreValue)
                    && Number.isFinite(creditMax)
                    && creditMax > 0
                    && Math.abs(creditScoreValue - creditMax) < 1e-6;
                  const combinedMatchesManagement = managementMax > 0
                    && Math.abs(managementMax - combinedMax) < 1e-6;
                  const creditMatchesManagement = managementMax > 0
                    && Number.isFinite(creditMax)
                    && Math.abs(managementMax - creditMax) < 1e-6;
                  const shouldSnapToMax = (combinedMatchesManagement && combinedIsMax)
                    || (creditMatchesManagement && creditIsMax);
                  if (shouldSnapToMax) {
                    managementScore = managementMax;
                  }
                  const managementIsMax = managementMax > 0 && Math.abs(managementScore - managementMax) < 1e-6;
                  const hasManagementScores = Number.isFinite(debtScore) || Number.isFinite(currentScore) || Number.isFinite(creditScoreValue);
                  const hasCreditScoreValue = creditScoreValue != null && creditScoreValue > 0;
                  const creditDisplayLabel = creditGradeTextRaw.trim() || creditGradePure;
                  const normalizedGrade = creditGradePure.replace(/\s+/g, '').toUpperCase();
                  const gradeIndicatesNone = !normalizedGrade
                    || normalizedGrade === 'N/A'
                    || normalizedGrade === 'NA'
                    || normalizedGrade.startsWith('N/');
                  const noteSuggestsMissing = /자료없음|미제출|평가없음|미발급/.test(creditNoteTextLower)
                    || /자료없음|미제출|평가없음|미발급/.test(creditGradeTextLower);
                  const creditExpired = creditExpiredFlag || isExpiredByDate;
                  const creditDataMissing = !creditExpired && !creditOverAge && (gradeIndicatesNone || noteSuggestsMissing) && !hasCreditScoreValue;
                  const managementScoreValue = hasManagementScores && Number.isFinite(managementScore) ? Number(managementScore) : null;
                  const managementScoreIs15 = managementScoreValue != null && Math.abs(managementScoreValue - 15) < 1e-3;
                  const singleBidAllowed = !!c.singleBidEligible;
                  const singleBidBadgeStyle = singleBidAllowed
                    ? { background: '#dcfce7', color: '#166534', borderColor: '#bbf7d0' }
                    : { background: '#fee2e2', color: '#b91c1c', borderColor: '#fecaca' };
                  const singleBidReasons = resolveSingleBidReasons(c);
                  const hasScoreBreakdown = (c.debtScore != null
                    || c.currentScore != null
                    || c.creditScore != null
                    || (showBizYearsMetrics && (c.bizYearsScore != null || (c.bizYearsMaxScore && c.bizYearsMaxScore > 0))));
                  const managerNames = extractManagerNames(c);
                  const femaleOwned = isWomenOwnedCompany(c);
                  const qualityBadgeText = getQualityBadgeText(c);
                  const showBadges = c.wasAlwaysIncluded || c.summaryStatus || femaleOwned || qualityBadgeText;
                  return (
                  <tr key={`${c.id}-${idx}`}>
                    <td>
                      <div className="company-cell">
                        <div className="company-name-line">
                          <span className="company-name-text">{c.name}</span>
                        </div>
                        {managerNames.length > 0 && (
                          <div className="company-manager-badges">
                            {managerNames.map((name) => (
                              <span key={`${c.id}-${name}`} className="badge-person">{name}</span>
                            ))}
                          </div>
                        )}
                        {showBadges && (
                          <div className="company-badges">
                            {c.wasAlwaysIncluded && (
                              <span className="fixed-badge">선택</span>
                            )}
                            {femaleOwned && (
                              <span className="badge-female">女</span>
                            )}
                            {qualityBadgeText && (
                              <span className="badge-quality">품질평가 {qualityBadgeText}</span>
                            )}
                            {c.summaryStatus && (
                              <span className={`summary-status-badge ${getStatusClass(c.summaryStatus)}`}>
                                {c.summaryStatus}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>{c.manager}</td>
                    <td>{c.region}</td>
                    <td>{c.rating ? c.rating.toLocaleString() : ''}</td>
                    <td>{c.perf5y ? c.perf5y.toLocaleString() : ''}</td>
                    <td>{pct !== null ? pct.toFixed(2) : '-'}</td>
                    <td style={{ textAlign: 'left', fontSize: 13 }}>
                      <div className="details-actions" style={{ justifyContent: 'flex-start', gap: 4, rowGap: 4 }}>
                        <span className="pill" style={singleBidBadgeStyle}>{singleBidAllowed ? '단독가능' : '단독불가능'}</span>
                        {c.moneyOk && <span className="pill">시평OK</span>}
                        {c.perfOk && <span className="pill">실적OK</span>}
                        {c.regionOk && <span className="pill">지역OK</span>}
                        {isAuto && <span className="pill">자동선택</span>}
                      </div>
                      {hasScoreBreakdown && (
                        <div className="score-details" style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {c.debtScore != null && (<span style={{ color: isMaxScore(c.debtScore, debtMax) ? '#166534' : '#b91c1c', fontWeight: isMaxScore(c.debtScore, debtMax) ? 600 : 500 }}>
                              부채 {formatRatio(c.debtRatio)}
                              {c.debtAgainstAverage != null && ` (평균 대비 ${formatPercent(c.debtAgainstAverage)})`}
                              {` → ${formatScore(c.debtScore)}점`}
                              {debtMax ? ` / ${formatScore(debtMax)}점` : ''}
                            </span>)}
                          {c.currentScore != null && (
                            <span style={{ color: isMaxScore(c.currentScore, currentMax) ? '#166534' : '#b91c1c', fontWeight: isMaxScore(c.currentScore, currentMax) ? 600 : 500 }}>
                              유동 {formatRatio(c.currentRatio)}
                              {c.currentAgainstAverage != null && ` (평균 대비 ${formatPercent(c.currentAgainstAverage)})`}
                              {` → ${formatScore(c.currentScore)}점`}
                              {currentMax ? ` / ${formatScore(currentMax)}점` : ''}
                            </span>
                          )}
                          {showBizYearsMetrics && (c.bizYearsScore != null || (c.bizYearsMaxScore && c.bizYearsMaxScore > 0)) && (
                            <span style={{ color: isMaxScore(c.bizYearsScore, c.bizYearsMaxScore) ? '#166534' : '#b91c1c', fontWeight: isMaxScore(c.bizYearsScore, c.bizYearsMaxScore) ? 600 : 500 }}>
                              영업기간
                              {c.bizYears != null && c.bizYears !== '' ? ` ${formatYears(c.bizYears)}년` : ''}
                              {c.bizYearsStartDate ? ` (면허취득일 ${formatDate(c.bizYearsStartDate)})` : ''}
                              {` → ${formatScore(c.bizYearsScore)}점`}
                              {c.bizYearsMaxScore ? ` / ${formatScore(c.bizYearsMaxScore)}점` : ''}
                            </span>
                          )}
                          {(() => {
                            if (creditExpired) {
                              return (
                                <span style={{ color: '#b91c1c', fontWeight: 600 }}>
                                  [신용평가 유효기간 만료]
                                </span>
                              );
                            }
                            if (creditDataMissing) {
                              return (
                                <span style={{ color: '#b91c1c', fontWeight: 600 }}>
                                  [신용평가 자료 없음]
                                </span>
                              );
                            }
                            if (creditOverAge) {
                              return (
                                <span style={{ color: '#b91c1c', fontWeight: 600 }}>
                                  [신용평가 인정기간 초과]
                                </span>
                              );
                            }
                            if (!hasCreditScoreValue) {
                              return (
                                <span style={{ color: '#b91c1c', fontWeight: 600 }}>
                                  [신용평가 자료 없음]
                                </span>
                              );
                            }
                            if (hasCreditScoreValue) {
                              return (
                                <span style={{ color: isMaxScore(creditScoreValue, creditMax) ? '#166534' : '#b91c1c', fontWeight: isMaxScore(creditScoreValue, creditMax) ? 600 : 500 }}>
                                  신용 {creditDisplayLabel || 'N/A'} → {formatScore(creditScoreValue)}점
                                  {creditMax ? ` / ${formatScore(creditMax)}점` : ''}
                                </span>
                              );
                            }
                            if (creditDisplayLabel && !gradeIndicatesNone) {
                              return (
                                <span style={{ color: '#1f2937', fontWeight: 600 }}>
                                  신용 {creditDisplayLabel}
                                  {creditMax ? ` / ${formatScore(creditMax)}점` : ''}
                                </span>
                              );
                            }
                            return null;
                          })()}
                          {hasManagementScores && (
                            <span style={{ marginTop: 2, fontWeight: 600, color: managementMax > 0 ? (managementIsMax ? '#166534' : '#b91c1c') : '#1f2937' }}>
                              관리 총점 {formatScore(managementScore)}점
                              {managementMax ? ` / ${formatScore(managementMax)}점` : ''}
                            </span>
                          )}
                        </div>
                      )}
                      {!singleBidAllowed && singleBidReasons.length > 0 && (
                        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2, color: '#b91c1c', fontWeight: 500 }}>
                          {singleBidReasons.map((reason, reasonIdx) => (
                            <span key={`${c.id}-reason-${reasonIdx}`}>{reason}</span>
                          ))}
                        </div>
                      )}
                      <div className="details-actions" style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        <button className="btn-sm btn-soft" onClick={()=>handleCopySipyungField(c)}>시평액 복사</button>
                        <button className="btn-sm btn-soft" onClick={()=>handleCopyPerf5yField(c)}>5년 실적 복사</button>
                        <button className="btn-sm btn-soft" onClick={()=>handleCopyCandidate(c, pct)}>복사</button>
                        {!readOnlyMode && (
                          <>
                            <button className={pinnedView.has(c.id) ? 'btn-sm primary' : 'btn-sm btn-soft'} onClick={()=>onTogglePin(c.id)} disabled={isAuto}>{pinnedView.has(c.id) ? (isAuto ? '선택(자동)' : '선택 해제') : '선택'}</button>
                            <button className={excluded.has(c.id) ? 'btn-sm btn-danger' : 'btn-sm btn-muted'} onClick={()=>onToggleExclude(c.id)}>{excluded.has(c.id) ? '제외 해제' : '제외'}</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );})}
                {(sorted || []).length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign:'center', color:'#6b7280', padding: 16 }}>{loading ? '로딩 중…' : '결과 없음'}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>,
    portalContainer,
  );
}
const EMPTY_ARRAY = Object.freeze([]);
