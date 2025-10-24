import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import AmountInput from '../../../../components/AmountInput.jsx';
import { copyDocumentStyles } from '../../../../utils/windowBridge.js';

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

const MANAGER_KEYS = [
  '담당자명', '담당자', '담당자1', '담당자 1', '담당자2', '담당자 2', '담당자3', '담당자 3',
  '담당자명1', '담당자명2', '담당자명3', '주담당자', '부담당자', '협력담당자', '업체담당자',
  '현장담당자', '사무담당자', '담당', 'manager', 'managerName', 'manager_name',
  'contactPerson', 'contact_person', 'contact',
];
const MANAGER_KEY_SET = new Set(MANAGER_KEYS.map((key) => key.replace(/\s+/g, '').toLowerCase()));

const extractManagerNames = (candidate) => {
  if (!candidate || typeof candidate !== 'object') return [];
  const seen = new Set();
  const names = [];

  const addNameCandidate = (raw) => {
    if (raw == null) return;
    let token = String(raw).trim();
    if (!token) return;
    token = token.replace(/^[\[\(（【]([^\]\)）】]+)[\]\)】]?$/, '$1').trim();
    token = token.replace(/(과장|팀장|차장|대리|사원|부장|대표|실장|소장|님)$/g, '').trim();
    token = token.replace(/[0-9\-]+$/g, '').trim();
    if (!/^[가-힣]{2,4}$/.test(token)) return;
    const key = token.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    names.push(token);
  };

  const collectFromSource = (source) => {
    if (!source || typeof source !== 'object') return;
    Object.entries(source).forEach(([key, value]) => {
      if (value == null || value === '') return;
      const normalizedKey = key.replace(/\s+/g, '').toLowerCase();
      if (MANAGER_KEY_SET.has(normalizedKey)) {
        String(value).split(/[\n,/·•∙ㆍ;|\\]/).forEach((part) => addNameCandidate(part));
        return;
      }
      if (/담당/.test(normalizedKey) || normalizedKey.includes('manager')) {
        String(value).split(/[\n,/·•∙ㆍ;|\\]/).forEach((part) => addNameCandidate(part));
        return;
      }
      if (normalizedKey === '비고') {
        const text = String(value).replace(/\s+/g, ' ').trim();
        if (!text) return;
        const firstToken = text.split(/[ ,\/\|·•∙ㆍ;:\-]+/).filter(Boolean)[0] || '';
        addNameCandidate(firstToken);
        const patterns = [
          /담당자?\s*[:：-]?\s*([가-힣]{2,4})/g,
          /([가-힣]{2,4})\s*(과장|팀장|차장|대리|사원|부장|대표|실장|소장)/g,
          /\b(?!확인서|등록증|증명서|평가|서류)([가-힣]{2,4})\b\s*(?:,|\/|\(|\d|$)/g,
        ];
        patterns.forEach((re) => {
          let match;
          while ((match = re.exec(text)) !== null) {
            addNameCandidate(match[1]);
          }
        });
      }
    });
  };

  collectFromSource(candidate);
  collectFromSource(candidate?.snapshot);

  return names;
};

export default function CandidatesModal({
  open,
  onClose,
  ownerId = 'LH',
  menuKey = '',
  fileType,
  entryAmount,
  baseAmount,
  estimatedAmount = '',
  perfectPerformanceAmount = 0,
  dutyRegions = [],
  ratioBaseAmount = '',
  defaultExcludeSingle = true,
  noticeNo = '',
  noticeTitle = '',
  industryLabel = '',
  initialCandidates = [],
  initialPinned = [],
  initialExcluded = [],
  onApply,
}) {
  const popupRef = useRef(null);
  const [portalContainer, setPortalContainer] = useState(null);
  const [applying, setApplying] = useState(false);
  const [params, setParams] = useState({ entryAmount: '', baseAmount: '', dutyRegions: [], ratioBase: '', minPct: '', maxPct: '', excludeSingleBidEligible: true, filterByRegion: true });
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState([]);
  const [pinned, setPinned] = useState(new Set());
  const [excluded, setExcluded] = useState(new Set());
  const [error, setError] = useState('');
  const [sortDir, setSortDir] = useState('desc'); // 'desc' | 'asc'
  const [sortSeq, setSortSeq] = useState(0);      // force re-sort even if same dir clicked
  const applySort = (dir) => { setSortDir(dir); setSortSeq((n)=>n+1); };
  const [autoPin, setAutoPin] = useState(false);
  const [autoCount, setAutoCount] = useState(3);
  const [onlyLatest, setOnlyLatest] = useState(false);
  const today = useMemo(() => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    return base;
  }, []);

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
  }, []);

  const ensureWindow = useCallback(() => {
    if (typeof window === 'undefined') return;

    if (popupRef.current && popupRef.current.closed) {
      popupRef.current = null;
      setPortalContainer(null);
    }

    if (!popupRef.current) {
      const preferredWidth = Math.min(1620, Math.max(1100, window.innerWidth - 80));
      const preferredHeight = Math.min(960, Math.max(720, window.innerHeight - 96));
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
      const handleBeforeUnload = () => {
        popupRef.current = null;
        setPortalContainer(null);
        onClose?.();
      };
      child.addEventListener('beforeunload', handleBeforeUnload);
      child.__candidatesCleanup = () => child.removeEventListener('beforeunload', handleBeforeUnload);
    } else {
      const win = popupRef.current;
      if (win.document && win.document.readyState === 'complete') {
        copyDocumentStyles(document, win.document);
      }
      if (!portalContainer && win.document) {
        const existingRoot = win.document.getElementById('candidates-window-root');
        if (existingRoot) setPortalContainer(existingRoot);
      }
      try { win.focus(); } catch {}
    }
  }, [onClose, portalContainer]);

  const isMoisUnder30 = ownerId === 'MOIS' && menuKey === 'mois-under30';
  const perfAmountValue = Number(perfectPerformanceAmount) > 0 ? String(perfectPerformanceAmount) : '';

  useEffect(() => {
    if (open) {
      ensureWindow();
    } else {
      closeWindow();
    }
  }, [open, ensureWindow, closeWindow]);

  useEffect(() => () => { closeWindow(); }, [closeWindow]);

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

  const buildInitialParams = useCallback(() => {
    const initialBase = isMoisUnder30
      ? (perfAmountValue || estimatedAmount || entryAmount || '')
      : (baseAmount || '');
    const initialRatio = isMoisUnder30 ? '' : (ratioBaseAmount || '');
    return {
      entryAmount: entryAmount || '',
      baseAmount: initialBase,
      dutyRegions: dutyRegions || [],
      ratioBase: initialRatio,
      minPct: '',
      maxPct: '',
      excludeSingleBidEligible: defaultExcludeSingle,
      filterByRegion: true,
    };
  }, [isMoisUnder30, perfAmountValue, estimatedAmount, entryAmount, baseAmount, dutyRegions, ratioBaseAmount, defaultExcludeSingle]);

  const initKey = JSON.stringify({ ownerId, menuKey, entryAmount, baseAmount, estimatedAmount, perfAmountValue, dutyRegions, ratioBaseAmount, defaultExcludeSingle, fileType });
  const didInitFetch = useRef(false);
  useEffect(() => {
    if (!open) return;
    const initial = buildInitialParams();
    setParams(initial);
    const clonedCandidates = Array.isArray(initialCandidates)
      ? initialCandidates.map((item) => (item && typeof item === 'object' ? { ...item } : item))
      : [];
    setList(clonedCandidates);
    setPinned(new Set(Array.isArray(initialPinned) ? initialPinned : []));
    setExcluded(new Set(Array.isArray(initialExcluded) ? initialExcluded : []));
    setError('');
    setApplying(false);
    setOnlyLatest(false);
    didInitFetch.current = clonedCandidates.length > 0;
  }, [open, initKey, buildInitialParams, initialCandidates, initialPinned, initialExcluded]);

  // Auto fetch on open with incoming values (once per open/inputs)
  useEffect(() => {
    if (!open) return;
    if (didInitFetch.current) return;
    const initial = buildInitialParams();
    const hasAmounts = String(initial.entryAmount || '').trim() || String(initial.baseAmount || '').trim() || String(estimatedAmount || '').trim();
    const hasRegions = Array.isArray(initial.dutyRegions) && initial.dutyRegions.length > 0;
    if (hasAmounts || hasRegions) {
      didInitFetch.current = true;
      runFetch(initial);
    }
  }, [open, initKey, buildInitialParams, estimatedAmount]);

  const formatScore = (value) => {
    if (value === null || value === undefined) return '-';
    const n = Number(value);
    if (!Number.isFinite(n)) return '-';
    const fixed = n.toFixed(2);
    return fixed.replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
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

  const formatAmount = (value) => {
    if (value === null || value === undefined) return '-';
    const cleaned = String(value).replace(/[^0-9.\-]/g, '').trim();
    if (!cleaned) return '-';
    const num = Number(cleaned);
    if (!Number.isFinite(num)) return '-';
    try { return num.toLocaleString('ko-KR'); } catch { return String(num); }
  };

  const details = useMemo(() => ({
    noticeNo,
    title: noticeTitle,
    industryLabel: industryLabel || industryToLabel(fileType),
    baseAmount: formatAmount(baseAmount),
    estimatedPrice: formatAmount(estimatedAmount),
  }), [noticeNo, noticeTitle, industryLabel, fileType, baseAmount, estimatedAmount]);

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
    setLoading(true); setError(''); setList([]);
    try {
      const perfectAmountParam = isMoisUnder30 ? requestParams.baseAmount : perfAmountValue;
      const r = await window.electronAPI.fetchCandidates({
        ownerId,
        menuKey,
        fileType,
        entryAmount: requestParams.entryAmount,
        baseAmount: requestParams.baseAmount,
        estimatedAmount,
        perfectPerformanceAmount: perfectAmountParam,
        dutyRegions: requestParams.dutyRegions,
        excludeSingleBidEligible: requestParams.excludeSingleBidEligible,
        filterByRegion: !!requestParams.filterByRegion,
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

  const onTogglePin = (id) => setPinned(prev => toggle(prev, id));
  const onToggleExclude = (id) => setExcluded(prev => toggle(prev, id));

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

  const filtered = useMemo(() => {
    const toFloat = (s) => {
      const t = String(s ?? '').trim();
      if (!t) return null;
      const n = Number(t);
      return Number.isFinite(n) ? n : null;
    };
    const min = toFloat(params.minPct);
    const max = toFloat(params.maxPct);
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
      return true;
    });
  }, [computed, params.minPct, params.maxPct, params.excludeSingleBidEligible, params.filterByRegion, params.dutyRegions, excluded, onlyLatest]);

  const sorted = useMemo(() => {
    const arr = filtered.slice();
    arr.sort((a, b) => {
      const av = a._pctRaw; const bv = b._pctRaw;
      // null(계산 불가)은 항상 맨 아래
      const aNull = av == null; const bNull = bv == null;
      if (aNull && bNull) return String(a.name||'').localeCompare(String(b.name||''), 'ko-KR');
      if (aNull) return 1;
      if (bNull) return -1;
      const diff = sortDir === 'asc' ? (av - bv) : (bv - av);
      if (diff !== 0) return diff;
      // 동률이면 이름으로 안정 정렬
      return String(a.name||'').localeCompare(String(b.name||''), 'ko-KR');
    });
    return arr;
  }, [filtered, sortDir, sortSeq]);

  const autoPinned = useMemo(() => {
    if (!autoPin) return new Set();
    const ids = [];
    for (const c of sorted) {
      if (ids.length >= Math.max(0, Number(autoCount) || 0)) break;
      ids.push(c.id);
    }
    return new Set(ids);
  }, [autoPin, autoCount, sorted]);

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
    if (!onApply) {
      onClose?.();
      return;
    }
    try {
      setApplying(true);
      const result = onApply({
        candidates: list,
        pinned: Array.from(pinned),
        excluded: Array.from(excluded),
      });
      if (result && typeof result.then === 'function') {
        await result;
      }
    } catch (e) {
      console.warn('Candidates apply failed:', e);
    } finally {
      setApplying(false);
    }
  }, [onApply, list, pinned, excluded, onClose]);

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
              <span><strong>기초금액</strong> {details.baseAmount || '-'}</span>
              <span><strong>추정금액</strong> {details.estimatedPrice || '-'}</span>
            </div>
          </div>
          <p>총 {summary.total}개 · 선택 {summary.pinned} · 제외 {summary.excluded}</p>
          {loading && <span className="candidates-window__loading">검색 중…</span>}
        </div>
        <div className="candidates-window__header-actions">
          <button className="primary" onClick={handleApply} disabled={applying}>{applying ? '적용 중…' : '선택 적용'}</button>
          <button className="btn-muted" onClick={handleClose}>닫기</button>
        </div>
      </header>
      <div className="candidates-window__content" style={{ display: 'grid', gridTemplateColumns: '260px minmax(0, 1fr)', gap: 16, padding: '14px 18px 18px' }}>
        <div className="panel candidates-window__filters" style={{ padding: 12, fontSize: 14 }}>
          <div className="filter-item">
            <label>입찰참가자격금액</label>
            <AmountInput value={params.entryAmount} onChange={(v)=>setParams(p=>({ ...p, entryAmount: v }))} placeholder="숫자" />
          </div>
          <div className="filter-item">
            <label>{isMoisUnder30 ? '실적만점금액' : '기초금액'}</label>
            <AmountInput value={params.baseAmount} onChange={(v)=>setParams(p=>({ ...p, baseAmount: v }))} placeholder="숫자" />
          </div>
          {!isMoisUnder30 && (
            <div className="filter-item">
              <label>시공비율 기준금액</label>
              <AmountInput value={params.ratioBase} onChange={(v)=>setParams(p=>({ ...p, ratioBase: v }))} placeholder="숫자" />
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
            <div style={{ color: '#6b7280' }}>총 {summary.total}개 · 선택 {summary.pinned} · 제외 {summary.excluded}</div>
            <div style={{ display:'flex', gap: 6, alignItems:'center', flexWrap: 'wrap' }}>
              <button className={`btn-sm ${sortDir==='desc'?'primary':'btn-soft'}`} onClick={()=>applySort('desc')}>지분 높은순</button>
              <button className={`btn-sm ${sortDir==='asc'?'primary':'btn-soft'}`} onClick={()=>applySort('asc')}>지분 낮은순</button>
              <label style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                <input type="checkbox" checked={autoPin} onChange={(e)=>setAutoPin(!!e.target.checked)} /> 자동 선택 상위
              </label>
              <input type="number" min={1} max={10} value={autoCount} onChange={(e)=>setAutoCount(e.target.value)} style={{ width: 68, height: 32, borderRadius: 8, border: '1px solid #d0d5dd', padding: '0 8px' }} />
              <button className="btn-muted btn-sm" onClick={()=>{ setPinned(new Set()); setExcluded(new Set()); }}>선택 초기화</button>
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
                  let managementScore = Number.isFinite(creditScore)
                    ? Math.max(combinedScore, creditScore)
                    : combinedScore;
                  const combinedIsMax = combinedMax > 0 && Math.abs(combinedScore - combinedMax) < 1e-6;
                  const creditIsMax = Number.isFinite(creditScore)
                    && Number.isFinite(creditMax)
                    && creditMax > 0
                    && Math.abs(creditScore - creditMax) < 1e-6;
                  if (managementMax > 0 && (combinedIsMax || creditIsMax)) {
                    managementScore = managementMax;
                  }
                  const managementIsMax = managementMax > 0 && Math.abs(managementScore - managementMax) < 1e-6;
                  const hasManagementScores = Number.isFinite(debtScore) || Number.isFinite(currentScore) || Number.isFinite(creditScore);
                  const creditNoteLower = String(c.creditNote || '').trim().toLowerCase();
                  const creditNoteTextRaw = c.creditNoteText || '';
                  const creditNoteTextLower = creditNoteTextRaw.trim().toLowerCase();
                  const creditGradePure = (c.creditGrade || '').trim();
                  const creditGradeTextRaw = c.creditGradeText || creditGradePure;
                  const creditGradeTextLower = creditGradeTextRaw.trim().toLowerCase();
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
                  const creditScoreValue = Number.isFinite(creditScore) ? Number(creditScore) : null;
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
                  const singleBidAllowed = !!c.singleBidEligible && managementScoreIs15;
                  const singleBidBadgeStyle = singleBidAllowed
                    ? { background: '#dcfce7', color: '#166534', borderColor: '#bbf7d0' }
                    : { background: '#fee2e2', color: '#b91c1c', borderColor: '#fecaca' };
                  const managerNames = extractManagerNames(c);
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
                        {(c.wasAlwaysIncluded || c.summaryStatus) && (
                          <div className="company-badges">
                            {c.wasAlwaysIncluded && (
                              <span className="fixed-badge">선택</span>
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
                      {(c.debtScore != null || c.currentScore != null || c.creditScore != null) && (
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
                      <div className="details-actions" style={{ marginTop: 6 }}>
                        <button className={pinnedView.has(c.id) ? 'btn-sm primary' : 'btn-sm btn-soft'} onClick={()=>onTogglePin(c.id)} disabled={isAuto}>{pinnedView.has(c.id) ? (isAuto ? '선택(자동)' : '선택 해제') : '선택'}</button>
                        <button className={excluded.has(c.id) ? 'btn-sm btn-danger' : 'btn-sm btn-muted'} onClick={()=>onToggleExclude(c.id)}>{excluded.has(c.id) ? '제외 해제' : '제외'}</button>
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
