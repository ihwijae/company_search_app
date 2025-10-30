import React from 'react';
import '../../../../styles.css';
import '../../../../fonts.css';
import Sidebar from '../../../../components/Sidebar';
import AmountInput from '../../../../components/AmountInput.jsx';
import { useAgreementBoard } from '../context/AgreementBoardContext.jsx';
import { BASE_ROUTES, findMenuByKey } from '../../../../shared/navigation.js';
import { loadPersisted, savePersisted } from '../../../../shared/persistence.js';

const createDefaultForm = () => {
  const today = new Date();
  const formattedToday = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');

  return {
    industry: '전기',
    noticeNo: '',
    title: '',
    baseAmount: '',
    estimatedPrice: '',
    adjustmentRate: '',
    bidRate: '',
    bidAmount: '',
    noticeDate: formattedToday,
    bidDeadline: '',
    entryQualificationAmount: '',
    regionDutyRate: '',
    teamSizeMax: '3',
  };
};

function Field({ label, children, style = {} }) {
  return (
    <div className="filter-item" style={style}>
      <label>{label}</label>
      {children}
    </div>
  );
}

export default function AgreementFlowPage({ menuKey, ownerId, ownerLabel, rangeLabel }) {
  const fileStatuses = React.useMemo(() => ({ eung: false, tongsin: false, sobang: false }), []);
  const storageKey = React.useMemo(() => {
    const owner = ownerId || 'unknown';
    const menu = menuKey || 'default';
    return `agreementFlow:${owner}:${menu}`;
  }, [ownerId, menuKey]);

  const [form, setForm] = React.useState(() => {
    const base = createDefaultForm();
    const saved = loadPersisted(`${storageKey}:form`, null);
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      return { ...base, ...saved };
    }
    return base;
  });

  const isPPS = ownerId === 'PPS';
  const [baseTouched, setBaseTouched] = React.useState(false);
  const [bidTouched, setBidTouched] = React.useState(false);
  const baseAutoRef = React.useRef('');
  const bidAutoRef = React.useRef('');

  const [regionList, setRegionList] = React.useState([]);
  const [dutyRegions, setDutyRegions] = React.useState(() => {
    const saved = loadPersisted(`${storageKey}:dutyRegions`, []);
    return Array.isArray(saved) ? saved.filter((name) => typeof name === 'string') : [];
  });
  const [candidates, setCandidates] = React.useState([]);
  const [pinned, setPinned] = React.useState([]);
  const [excluded, setExcluded] = React.useState([]);
  const prevIndustryRef = React.useRef(form.industry);
  const prevDutyRegionsRef = React.useRef(dutyRegions);
  const mountedRef = React.useRef(true);

  const toFileType = (industry) => {
    if (industry === '전기') return 'eung';
    if (industry === '통신') return 'tongsin';
    return 'sobang';
  };

  const currentFileType = React.useMemo(() => toFileType(form.industry), [form.industry]);

  const { boardState, openBoard, updateBoard, openCandidatesModal } = useAgreementBoard();

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  React.useEffect(() => {
    setBaseTouched(false);
    setBidTouched(false);
    baseAutoRef.current = '';
    bidAutoRef.current = '';
  }, [ownerId]);

  React.useEffect(() => {
    if (!form || typeof form !== 'object' || Array.isArray(form)) return;
    savePersisted(`${storageKey}:form`, form);
  }, [storageKey, form]);

  React.useEffect(() => {
    if (!Array.isArray(dutyRegions)) return;
    savePersisted(`${storageKey}:dutyRegions`, dutyRegions);
  }, [storageKey, dutyRegions]);

  React.useEffect(() => {
    if (!isPPS) return;
    setForm((prev) => {
      const next = { ...prev };
      let changed = false;
      if (!String(prev.adjustmentRate || '').trim()) {
        next.adjustmentRate = '86.745';
        changed = true;
      }
      if (!String(prev.bidRate || '').trim()) {
        next.bidRate = '101.4';
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [isPPS]);

  React.useEffect(() => {
    const groupSizeValue = Number(form.teamSizeMax) > 0 ? Number(form.teamSizeMax) : 3;
    const boardDutyRegions = Array.isArray(boardState?.dutyRegions) ? boardState.dutyRegions : [];
    const sameRegions = boardDutyRegions.length === dutyRegions.length
      && boardDutyRegions.every((region, index) => region === dutyRegions[index]);
    if (sameRegions && boardState?.groupSize === groupSizeValue) return;
    updateBoard({ dutyRegions, groupSize: groupSizeValue });
  }, [boardState, dutyRegions, form.teamSizeMax, updateBoard]);

  const normalizeList = React.useCallback((value) => (
    Array.isArray(value) ? value : []
  ), []);

  const listEqualsByKey = React.useCallback((a, b) => {
    if (a === b) return true;
    const left = normalizeList(a);
    const right = normalizeList(b);
    if (left.length !== right.length) return false;
    const toKey = (item) => {
      if (!item || typeof item !== 'object') return '';
      return (
        item.id
        || item.bizNo
        || item.bizno
        || item.biz_no
        || item['사업자번호']
        || item['검색된 회사']
        || item.name
        || ''
      );
    };
    for (let i = 0; i < left.length; i += 1) {
      if (toKey(left[i]) !== toKey(right[i])) return false;
    }
    return true;
  }, [normalizeList]);

  const shallowEqualArray = React.useCallback((left = [], right = []) => {
    if (left === right) return true;
    if (left.length !== right.length) return false;
    for (let i = 0; i < left.length; i += 1) {
      if (left[i] !== right[i]) return false;
    }
    return true;
  }, []);

  React.useEffect(() => {
    if (!boardState) return;
    const boardCandidates = normalizeList(boardState.candidates);
    const boardPinned = normalizeList(boardState.pinned);
    const boardExcluded = normalizeList(boardState.excluded);

    if (!listEqualsByKey(boardCandidates, candidates)) {
      setCandidates(boardCandidates.slice());
    }

    if (!shallowEqualArray(boardPinned, pinned)) {
      setPinned(boardPinned.slice());
    }
    if (!shallowEqualArray(boardExcluded, excluded)) {
      setExcluded(boardExcluded.slice());
    }
  }, [boardState, candidates, excluded, listEqualsByKey, normalizeList, pinned, shallowEqualArray]);

  React.useEffect(() => {
    const normalizedOwner = String(ownerId || 'LH').toUpperCase();
    if (boardState?.ownerId === normalizedOwner && boardState?.fileType === currentFileType) return;
    updateBoard({ ownerId: normalizedOwner, fileType: currentFileType });
  }, [boardState?.ownerId, boardState?.fileType, ownerId, currentFileType, updateBoard]);

  React.useEffect(() => {
    if (boardState?.rangeId === menuKey) return;
    updateBoard({ rangeId: menuKey });
  }, [boardState?.rangeId, menuKey, updateBoard]);

  const onChange = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  React.useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const fileType = toFileType(form.industry);
        const response = await window.electronAPI.getRegions(fileType);
        if (!response?.success || !Array.isArray(response.data)) return;
        const list = (response.data || []).filter((name) => name && name !== '전체').sort((a, b) => a.localeCompare(b, 'ko-KR'));
        if (!canceled) {
          setRegionList(list);
          setDutyRegions((prev) => prev.filter((name) => list.includes(name)));
        }
      } catch {
        /* ignore */
      }
    })();
    return () => { canceled = true; };
  }, [form.industry]);

  const toggleRegion = (name) => {
    setDutyRegions((prev) => (prev.includes(name) ? prev.filter((value) => value !== name) : [...prev, name]));
  };

  const [checkQuery, setCheckQuery] = React.useState('');
  const [checkLoading, setCheckLoading] = React.useState(false);
  const [checkResults, setCheckResults] = React.useState([]);
  const [checkedCompany, setCheckedCompany] = React.useState(null);
  const [checkEval, setCheckEval] = React.useState(null);

  const parseAmount = (value) => {
    if (value === null || value === undefined) return 0;
    const number = Number(String(value).replace(/[ ,]/g, ''));
    return Number.isFinite(number) ? number : 0;
  };

  const formatAmountString = (value) => {
    if (!Number.isFinite(value) || value <= 0) return '';
    try {
      return Math.round(value).toLocaleString();
    } catch {
      return String(Math.round(value));
    }
  };

  const parsePercent = (value) => {
    if (value === null || value === undefined) return NaN;
    const numeric = Number(String(value).replace(/[^0-9.]/g, ''));
    return Number.isFinite(numeric) ? numeric / 100 : NaN;
  };

  const { perfectPerformanceAmount, perfectPerformanceBasis } = React.useMemo(() => {
    const key = menuKey || '';
    const estimated = parseAmount(form.estimatedPrice);
    const base = parseAmount(form.baseAmount);

    if (ownerId === 'PPS') {
      return base > 0
        ? { perfectPerformanceAmount: base, perfectPerformanceBasis: '기초금액 × 1배' }
        : { perfectPerformanceAmount: 0, perfectPerformanceBasis: '' };
    }

    if (ownerId === 'MOIS') {
      if (key === 'mois-under30' || key === 'mois-30to50') {
        return estimated > 0
          ? { perfectPerformanceAmount: Math.round(estimated * 0.8), perfectPerformanceBasis: '추정가격 × 80%' }
          : { perfectPerformanceAmount: 0, perfectPerformanceBasis: '' };
      }
      if (key === 'mois-50to100') {
        return estimated > 0
          ? { perfectPerformanceAmount: Math.round(estimated * 1.7), perfectPerformanceBasis: '추정가격 × 1.7배' }
          : { perfectPerformanceAmount: 0, perfectPerformanceBasis: '' };
      }
    }

    if (ownerId === 'LH') {
      if (key === 'lh-under50') {
        return base > 0
          ? { perfectPerformanceAmount: base, perfectPerformanceBasis: '기초금액 × 1배' }
          : { perfectPerformanceAmount: 0, perfectPerformanceBasis: '' };
      }
      if (key === 'lh-50to100') {
        return base > 0
          ? { perfectPerformanceAmount: base * 2, perfectPerformanceBasis: '기초금액 × 2배' }
          : { perfectPerformanceAmount: 0, perfectPerformanceBasis: '' };
      }
    }

    return { perfectPerformanceAmount: 0, perfectPerformanceBasis: '' };
  }, [menuKey, ownerId, form.estimatedPrice, form.baseAmount]);

  const formattedPerfectPerformanceAmount = perfectPerformanceAmount > 0
    ? perfectPerformanceAmount.toLocaleString()
    : '';
  const perfectPerformanceDisplay = formattedPerfectPerformanceAmount
    ? `${formattedPerfectPerformanceAmount}${perfectPerformanceBasis ? ` (${perfectPerformanceBasis})` : ''}`
    : '';

  React.useEffect(() => {
    if (!isPPS) return;
    const estimated = parseAmount(form.estimatedPrice);
    const autoValue = estimated > 0 ? Math.round(estimated * 1.1) : 0;
    const autoFormatted = formatAmountString(autoValue);
    const current = form.baseAmount || '';
    const lastAuto = baseAutoRef.current;
    baseAutoRef.current = autoFormatted;
    if (baseTouched && current !== lastAuto) return;
    if (current === (autoFormatted || '')) return;
    if (!autoFormatted && current === '') return;
    setForm((prev) => ({ ...prev, baseAmount: autoFormatted }));
  }, [isPPS, form.estimatedPrice, form.baseAmount, baseTouched]);

  React.useEffect(() => {
    if (!isPPS) return;
    const base = parseAmount(form.baseAmount);
    const bidRateValue = parsePercent(form.bidRate);
    const adjustmentValue = parsePercent(form.adjustmentRate);
    const autoValue = base > 0 && Number.isFinite(bidRateValue) && Number.isFinite(adjustmentValue)
      ? Math.round(base * bidRateValue * adjustmentValue)
      : 0;
    const autoFormatted = formatAmountString(autoValue);
    const current = form.bidAmount || '';
    const lastAuto = bidAutoRef.current;
    bidAutoRef.current = autoFormatted;
    if (bidTouched && current !== lastAuto) return;
    if (current === (autoFormatted || '')) return;
    if (!autoFormatted && current === '') return;
    setForm((prev) => ({ ...prev, bidAmount: autoFormatted }));
  }, [isPPS, form.baseAmount, form.bidRate, form.adjustmentRate, form.bidAmount, bidTouched]);

  React.useEffect(() => {
    const prevIndustry = prevIndustryRef.current;
    const prevRegions = prevDutyRegionsRef.current || [];
    const currentRegions = dutyRegions || [];
    const industryChanged = prevIndustry !== form.industry;
    const regionsChanged = (() => {
      if (prevRegions.length !== currentRegions.length) return true;
      for (let i = 0; i < currentRegions.length; i += 1) {
        if (prevRegions[i] !== currentRegions[i]) return true;
      }
      return false;
    })();

    if ((industryChanged || regionsChanged) && (candidates.length > 0 || pinned.length > 0 || excluded.length > 0)) {
      setCandidates([]);
      setPinned([]);
      setExcluded([]);
      updateBoard({ candidates: [], pinned: [], excluded: [] });
    }

    prevIndustryRef.current = form.industry;
    prevDutyRegionsRef.current = currentRegions.slice();
  }, [form.industry, dutyRegions, candidates.length, pinned.length, excluded.length, updateBoard]);

  React.useEffect(() => {
    const same = boardState?.noticeNo === (form.noticeNo || '')
      && boardState?.noticeTitle === (form.title || '')
      && boardState?.industryLabel === (form.industry || '')
      && boardState?.baseAmount === (form.baseAmount || '')
      && boardState?.estimatedAmount === (form.estimatedPrice || '')
      && boardState?.bidDeadline === (form.bidDeadline || '')
      && boardState?.regionDutyRate === (form.regionDutyRate || '')
      && boardState?.bidAmount === (form.bidAmount || '')
      && boardState?.bidRate === (form.bidRate || '')
      && boardState?.adjustmentRate === (form.adjustmentRate || '');
    if (same) return;
    updateBoard({
                      noticeNo: form.noticeNo || '',
                      noticeTitle: form.title || '',
                      noticeDate: form.noticeDate || '',
      industryLabel: form.industry || '',
      baseAmount: form.baseAmount || '',
      estimatedAmount: form.estimatedPrice || '',
      bidDeadline: form.bidDeadline || '',
      regionDutyRate: form.regionDutyRate || '',
      bidAmount: form.bidAmount || '',
      bidRate: form.bidRate || '',
      adjustmentRate: form.adjustmentRate || '',
    });
  }, [
    boardState?.noticeNo,
    boardState?.noticeTitle,
    boardState?.industryLabel,
    boardState?.baseAmount,
    boardState?.estimatedAmount,
    boardState?.bidDeadline,
    boardState?.regionDutyRate,
    boardState?.bidAmount,
    boardState?.bidRate,
    boardState?.adjustmentRate,
    form.noticeNo,
    form.title,
    form.industry,
    form.baseAmount,
    form.estimatedPrice,
    form.bidDeadline,
    form.regionDutyRate,
    form.bidAmount,
    form.bidRate,
    form.adjustmentRate,
    updateBoard,
  ]);

  const evalSingleBid = (company) => {
    if (!company) return;
    const entry = parseAmount(form.entryQualificationAmount || form.estimatedPrice);
    const base = parseAmount(form.baseAmount);
    const perf5y = parseAmount(company['5년 실적']);
    const sipyung = parseAmount(company['시평']);
    const region = String(company['대표지역'] || company['지역'] || '').trim();
    if (isPPS) {
      const hasEntry = entry > 0;
      const moneyOk = hasEntry ? sipyung >= entry : true;
      const perfOk = base > 0 && perf5y >= base;
      const managementRaw = Number(String(
        company['경영점수']
        || company['경영상태점수']
        || company['관리점수']
        || company['경영상태 점수']
        || ''
      ).replace(/[^0-9.]/g, ''));
      const managementOk = Number.isFinite(managementRaw) ? managementRaw >= 15 - 1e-3 : false;

      const reasons = [];
      const toLocale = (value) => (Number.isFinite(value) ? value.toLocaleString() : String(value || '0'));
      if (hasEntry && !moneyOk) reasons.push(`시평 미달: ${toLocale(sipyung)} < 참가자격 ${toLocale(entry)}`);
      if (!perfOk) reasons.push(`5년 실적 미달: ${toLocale(perf5y)} < 기초금액 ${toLocale(base)}`);
      if (!managementOk) reasons.push('경영점수 만점이 아닙니다.');

      setCheckEval({ ok: Boolean((!hasEntry || moneyOk) && perfOk && managementOk), reasons });
      return;
    }

    const moneyOk = sipyung >= entry && entry > 0;
    const perfOk = perf5y >= base && base > 0;
    const regionOk = dutyRegions.length === 0 || dutyRegions.includes(region);

    const reasons = [];
    if (!moneyOk) reasons.push(`시평액 미달: ${sipyung.toLocaleString()} < 참가자격금액 ${entry.toLocaleString()}`);
    if (!perfOk) reasons.push(`5년 실적 미달(만점 기준): ${perf5y.toLocaleString()} < 기초금액 ${base.toLocaleString()}`);
    if (!regionOk) reasons.push(`의무지역 불충족: 선택(${dutyRegions.join(', ')}) / 업체지역(${region || '없음'})`);

    setCheckEval({ ok: moneyOk && perfOk && regionOk, reasons });
  };

  const runSearch = async () => {
    setCheckLoading(true);
    setCheckResults([]);
    setCheckedCompany(null);
    setCheckEval(null);
    try {
      const fileType = toFileType(form.industry);
      const response = await window.electronAPI.searchCompanies({ name: checkQuery.trim() }, fileType);
      if (response?.success) setCheckResults(response.data || []);
    } catch {
      /* ignore */
    } finally {
      setCheckLoading(false);
    }
  };

  const handleSidebarSelect = (key) => {
    if (!key) return;
    if (key === 'search') { window.location.hash = BASE_ROUTES.search; return; }
    if (key === 'agreements') { window.location.hash = BASE_ROUTES.agreements; return; }
    if (key === 'settings') { window.location.hash = BASE_ROUTES.settings; return; }
    if (key === 'upload') { window.location.hash = BASE_ROUTES.agreements; return; }
    const menu = findMenuByKey(key);
    if (menu) window.location.hash = menu.hash;
  };

  return (
    <div className="app-shell">
      <Sidebar
        active={menuKey}
        onSelect={handleSidebarSelect}
        fileStatuses={fileStatuses}
        collapsed={true}
      />
      <div className="main">
        <div className="title-drag" />
        <div className="topbar" />
        <div className="stage">
          <div className="content">
            <div className="panel" style={{ gridColumn: '1 / -1' }}>
              <h1 className="main-title" style={{ marginTop: 0 }}>{`${ownerLabel} ${rangeLabel} - 설정`}</h1>

              <div className="section">
                <h3 className="section-title">공고 정보</h3>
                <div className="section-divider" />
                <div className="grid-2">
                  <Field label="분류">
                    <select className="filter-input" value={form.industry} onChange={onChange('industry')}>
                      <option value="전기">전기</option>
                      <option value="통신">통신</option>
                      <option value="소방">소방</option>
                    </select>
                  </Field>
                  <Field label="공고번호">
                    <input className="filter-input" value={form.noticeNo} onChange={onChange('noticeNo')} placeholder="예: R25BK01030907-000" />
                  </Field>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <Field label="공고명">
                      <input className="filter-input" value={form.title} onChange={onChange('title')} placeholder="예: 신규 공사 공고" />
                    </Field>
                  </div>
                </div>
              </div>

              <div className="section">
                <h3 className="section-title">금액 / 일정</h3>
                <div className="section-divider" />
                <div className="grid-2">
                  <Field label="기초금액"><AmountInput value={form.baseAmount} onChange={(value) => { setBaseTouched(true); setForm((prev) => ({ ...prev, baseAmount: value })); }} placeholder="원" /></Field>
                  <Field label="추정가격"><AmountInput value={form.estimatedPrice} onChange={(value) => setForm((prev) => ({ ...prev, estimatedPrice: value }))} placeholder="원" /></Field>
                  <Field label="공고일"><input type="date" className="filter-input" value={form.noticeDate} onChange={onChange('noticeDate')} /></Field>
                  <Field label="투찰마감일">
                    <input
                      type="datetime-local"
                      className="filter-input"
                      value={form.bidDeadline}
                      onChange={onChange('bidDeadline')}
                      step="60"
                    />
                  </Field>
                  <Field label="참가자격금액"><AmountInput value={form.entryQualificationAmount} onChange={(value) => setForm((prev) => ({ ...prev, entryQualificationAmount: value }))} placeholder="원(=추정가격)" /></Field>
                  {isPPS && (
                    <Field label="사정율(%)">
                      <input
                        className="filter-input"
                        type="number"
                        step="0.001"
                        value={form.adjustmentRate}
                        onChange={(e) => setForm((prev) => ({ ...prev, adjustmentRate: e.target.value }))}
                        placeholder="예: 86.745"
                      />
                    </Field>
                  )}
                  {isPPS && (
                    <Field label="투찰율(%)">
                      <input
                        className="filter-input"
                        type="number"
                        step="0.1"
                        value={form.bidRate}
                        onChange={(e) => setForm((prev) => ({ ...prev, bidRate: e.target.value }))}
                        placeholder="예: 101.4"
                      />
                    </Field>
                  )}
                  <Field label="실적만점금액">
                    <input
                      className="filter-input"
                      value={perfectPerformanceDisplay}
                      readOnly
                      placeholder="금액 입력 시 자동 계산"
                    />
                  </Field>
                  {isPPS && (
                    <Field label="투찰금액" style={{ gridColumn: '1 / -1' }}>
                      <AmountInput
                        value={form.bidAmount}
                        onChange={(value) => { setBidTouched(true); setForm((prev) => ({ ...prev, bidAmount: value })); }}
                        placeholder="원"
                      />
                    </Field>
                  )}
                </div>
              </div>

              <div className="section">
                <h3 className="section-title">지역 조건</h3>
                <div className="section-divider" />
                <div className="grid-2">
                  <Field label="지역 의무 비율(%)">
                    <input
                      className="filter-input"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={form.regionDutyRate}
                      onChange={onChange('regionDutyRate')}
                      placeholder="예: 49"
                    />
                  </Field>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label>선택된 지역</label>
                    <div className="chips" style={{ marginTop: 6 }}>
                      {(dutyRegions || []).map((region) => (<span key={region} className="chip">{region}</span>))}
                      {dutyRegions.length === 0 && <span style={{ color: '#6b7280' }}>선택된 지역 없음</span>}
                    </div>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label>지역 선택</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 6, maxHeight: 180, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, padding: 8, marginTop: 6 }}>
                      {(regionList || []).map((region) => (
                        <label key={region} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input type="checkbox" checked={dutyRegions.includes(region)} onChange={() => toggleRegion(region)} />
                          <span>{region}</span>
                        </label>
                      ))}
                    </div>
                    <div style={{ marginTop: 6, color: '#6b7280' }}>필요한 의무 지역을 선택하고, 위에서 해당 지분 비율 기준을 입력하세요.</div>
                  </div>
                </div>
              </div>

              <div className="section">
                <h3 className="section-title">팀 구성</h3>
                <div className="section-divider" />
                <div className="grid-2">
                  <Field label="팀원 수(최대)">
                    <select className="filter-input" value={form.teamSizeMax} onChange={onChange('teamSizeMax')}>
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                      <option value="4">4</option>
                      <option value="5">5</option>
                    </select>
                  </Field>
                </div>
              </div>
            </div>

            <div className="panel" style={{ gridColumn: '1 / -1' }}>
              <h3 style={{ marginTop: 0 }}>후보 풀</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ color: '#6b7280' }}>고정 {pinned.length} · 제외 {excluded.length} · 후보 {candidates.length}</div>
                <div>
                  <button
                    className="btn-soft"
                    onClick={() => {
                      openCandidatesModal({
                        ownerId,
                        menuKey,
                        rangeId: menuKey,
                        fileType: currentFileType,
                        noticeNo: form.noticeNo,
                        noticeTitle: form.title,
                        noticeDate: form.noticeDate,
                        industryLabel: form.industry,
                        entryAmount: form.entryQualificationAmount || '',
                        baseAmount: form.baseAmount,
                        estimatedAmount: form.estimatedPrice,
                        ratioBaseAmount: form.bidAmount,
                        bidAmount: form.bidAmount,
                        bidRate: form.bidRate,
                        adjustmentRate: form.adjustmentRate,
                        bidDeadline: form.bidDeadline,
                        regionDutyRate: form.regionDutyRate,
                        perfectPerformanceAmount,
                        dutyRegions,
                        groupSize: Number(form.teamSizeMax) > 0 ? Number(form.teamSizeMax) : 3,
                        defaultExcludeSingle: true,
                        initialCandidates: candidates,
                        initialPinned: pinned,
                        initialExcluded: excluded,
                        onApply: ({ candidates: list, pinned: pinnedList, excluded: excludedList }) => {
                          if (mountedRef.current) {
                            setCandidates(list);
                            setPinned(pinnedList);
                            setExcluded(excludedList);
                          }
                        },
                      });
                    }}
                    style={{ marginRight: 6 }}
                  >
                    지역사 찾기
                  </button>
                  <button
                    className="primary"
                    onClick={() => {
                      if (!candidates || candidates.length === 0) {
                        window.alert('먼저 지역사 찾기를 실행해 최종 후보를 확정해주세요.');
                        return;
                      }
                      openBoard({
                        candidates,
                        pinned,
                        excluded,
                        dutyRegions,
                        groupSize: Number(form.teamSizeMax) > 0 ? Number(form.teamSizeMax) : 3,
                        ownerId: (ownerId || 'LH').toUpperCase(),
                        fileType: currentFileType,
                        rangeId: menuKey,
                        noticeNo: form.noticeNo || '',
                        noticeTitle: form.title || '',
                        industryLabel: form.industry || '',
                        baseAmount: form.baseAmount || '',
                        estimatedAmount: form.estimatedPrice || '',
                        bidDeadline: form.bidDeadline || '',
                        regionDutyRate: form.regionDutyRate || '',
                      });
                    }}
                  >
                    협정보드 열기
                  </button>
                </div>
              </div>
              {candidates.length === 0 && (
                <div style={{ color: '#6b7280', marginTop: 6 }}>아직 후보가 없습니다. “지역사 찾기”를 눌러 조건에 맞는 후보를 불러오세요.</div>
              )}
            </div>

            <div className="panel" style={{ gridColumn: '1 / -1' }}>
              <h3 style={{ marginTop: 0 }}>자동 구성 제안</h3>
              <div style={{ color: '#6b7280' }}>
                제약을 반영해 상위 N개 조합이 카드/표로 표시됩니다. 점수·지분·제약 충족 뱃지와 세부 보기 기능은 추후 추가 예정입니다.
              </div>
              <div style={{ marginTop: 8 }}>
                <button disabled>제안 실행(준비중)</button>
              </div>
            </div>

            <div className="panel" style={{ gridColumn: '1 / -1' }}>
              <h3 style={{ marginTop: 0 }}>확정 / 내보내기</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button disabled>엑셀 내보내기(준비중)</button>
                <button disabled>보고서 내보내기(준비중)</button>
                <button disabled>시나리오 저장(준비중)</button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
