import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import '../../../../styles.css';
import '../../../../fonts.css';
import Sidebar from '../../../../components/Sidebar';
import AmountInput from '../../../../components/AmountInput.jsx';
import {
  getRegionSearchState,
  openRegionSearch,
  subscribeRegionSearch,
  updateRegionSearchProps,
} from '../components/regionSearchStore.js';
import { useAgreementBoard } from '../context/AgreementBoardContext.jsx';
import { BASE_ROUTES, AGREEMENT_GROUPS, AGREEMENT_MENU_ITEMS, findMenuByKey } from '../../../../shared/navigation.js';
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
    ratioBaseAmount: '',
    noticeDate: formattedToday,
    bidDeadline: '',
    entryQualificationAmount: '',
    entryQualificationMode: 'ratio',
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

export default function AgreementFlowPage({
  menuKey: menuKeyProp,
  ownerId: ownerIdProp,
  ownerLabel: ownerLabelProp,
  rangeLabel: rangeLabelProp,
  enableMenuSelector = false,
  viewMode = 'board',
}) {
  const fileStatuses = React.useMemo(() => ({ eung: false, tongsin: false, sobang: false }), []);
  const defaultMenu = React.useMemo(() => findMenuByKey(menuKeyProp) || AGREEMENT_MENU_ITEMS[0], [menuKeyProp]);
  const selectorStorageKey = viewMode === 'region'
    ? 'agreementFlow:lastRegionMenu'
    : 'agreementFlow:lastBoardMenu';
  const [selectedMenuKey, setSelectedMenuKey] = React.useState(() => {
    if (!enableMenuSelector) return menuKeyProp || (defaultMenu?.key || '');
    const persisted = loadPersisted(selectorStorageKey, null);
    return persisted || menuKeyProp || (defaultMenu?.key || '');
  });

  React.useEffect(() => {
    if (enableMenuSelector) {
      savePersisted(selectorStorageKey, selectedMenuKey);
    }
  }, [enableMenuSelector, selectedMenuKey, selectorStorageKey]);

  React.useEffect(() => {
    if (!enableMenuSelector && menuKeyProp && menuKeyProp !== selectedMenuKey) {
      setSelectedMenuKey(menuKeyProp);
    }
  }, [enableMenuSelector, menuKeyProp, selectedMenuKey]);

  const activeMenuKey = enableMenuSelector ? selectedMenuKey : (menuKeyProp || selectedMenuKey);
  const currentMenu = findMenuByKey(activeMenuKey) || defaultMenu || AGREEMENT_MENU_ITEMS[0];
  const resolvedOwnerId = (ownerIdProp || currentMenu?.ownerId || 'LH').toUpperCase();
  const resolvedOwnerLabel = ownerLabelProp || currentMenu?.groupLabel || resolvedOwnerId;
  const resolvedRangeLabel = rangeLabelProp || currentMenu?.rangeLabel || currentMenu?.label || '';
  const selectedGroupForSelector = React.useMemo(() => {
    const keyForLookup = enableMenuSelector ? selectedMenuKey : activeMenuKey;
    return AGREEMENT_GROUPS.find((group) => group.items.some((item) => item.key === keyForLookup))
      || AGREEMENT_GROUPS[0];
  }, [enableMenuSelector, selectedMenuKey, activeMenuKey]);

  const handleOwnerSelectionChange = React.useCallback((event) => {
    const nextGroup = AGREEMENT_GROUPS.find((group) => group.id === event.target.value);
    if (!nextGroup) return;
    const nextKey = nextGroup.items[0]?.key;
    if (nextKey) setSelectedMenuKey(nextKey);
  }, []);

  const handleRangeSelectionChange = React.useCallback((event) => {
    const nextKey = event.target.value;
    if (!nextKey) return;
    setSelectedMenuKey(nextKey);
  }, []);

  const storageKey = React.useMemo(() => {
    const owner = resolvedOwnerId || 'unknown';
    const menu = activeMenuKey || 'default';
    return `agreementFlow:${owner}:${menu}`;
  }, [resolvedOwnerId, activeMenuKey]);

  const [form, setForm] = React.useState(() => createDefaultForm());

  const normalizedOwner = String(resolvedOwnerId || 'LH').toUpperCase();
  const isPPS = normalizedOwner === 'PPS';
  const isLH = normalizedOwner === 'LH';
  const isMOIS = normalizedOwner === 'MOIS';
  const isMoisShareRange = isMOIS && activeMenuKey === 'mois-30to50';
  const entryMode = form.entryQualificationMode === 'sum'
    ? 'sum'
    : (form.entryQualificationMode === 'none' ? 'none' : 'ratio');
  const showTenderFields = (isPPS || isMoisShareRange);
  const [baseTouched, setBaseTouched] = React.useState(false);
  const [bidTouched, setBidTouched] = React.useState(false);
  const baseAutoRef = React.useRef('');
  const bidAutoRef = React.useRef('');

  React.useEffect(() => {
    const base = createDefaultForm();
    const saved = loadPersisted(`${storageKey}:form`, null);
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      setForm({ ...base, ...saved });
    } else {
      setForm(base);
    }
  }, [storageKey]);

  const [regionList, setRegionList] = React.useState([]);
  const [dutyRegions, setDutyRegions] = React.useState([]);

  React.useEffect(() => {
    const saved = loadPersisted(`${storageKey}:dutyRegions`, []);
    setDutyRegions(Array.isArray(saved) ? saved.filter((name) => typeof name === 'string') : []);
  }, [storageKey]);
  const regionSearchSessionRef = React.useRef(null);

  const toFileType = (industry) => {
    if (industry === '전기') return 'eung';
    if (industry === '통신') return 'tongsin';
    return 'sobang';
  };

  const currentFileType = React.useMemo(() => toFileType(form.industry), [form.industry]);

  const { boardState, openBoard, updateBoard } = useAgreementBoard();

  React.useEffect(() => {
    setBaseTouched(false);
    setBidTouched(false);
    baseAutoRef.current = '';
    bidAutoRef.current = '';
  }, [resolvedOwnerId]);

  React.useEffect(() => {
    if (!form || typeof form !== 'object' || Array.isArray(form)) return;
    savePersisted(`${storageKey}:form`, form);
  }, [storageKey, form]);

  React.useEffect(() => {
    if (!Array.isArray(dutyRegions)) return;
    savePersisted(`${storageKey}:dutyRegions`, dutyRegions);
  }, [storageKey, dutyRegions]);

  React.useEffect(() => {
    if (!(isPPS || isMoisShareRange)) return;
    setForm((prev) => {
      const next = { ...prev };
      let changed = false;
      const defaultAdjustment = isPPS ? '101.6' : '88.745';
      const defaultBid = isPPS ? '86.745' : '101.8';
      const legacyAdjustmentValues = isPPS ? ['101.4'] : [];
      const legacyBidValues = isPPS ? ['88.745'] : [];

      const currentAdjustment = String(prev.adjustmentRate || '').trim();
      if (!currentAdjustment || legacyAdjustmentValues.includes(currentAdjustment)) {
        next.adjustmentRate = defaultAdjustment;
        changed = true;
      }

      const currentBid = String(prev.bidRate || '').trim();
      if (!currentBid || legacyBidValues.includes(currentBid)) {
        next.bidRate = defaultBid;
        changed = true;
      }

      return changed ? next : prev;
    });
  }, [isPPS, isMoisShareRange, entryMode]);

  React.useEffect(() => {
    const groupSizeValue = Number(form.teamSizeMax) > 0 ? Number(form.teamSizeMax) : 3;
    const boardDutyRegions = Array.isArray(boardState?.dutyRegions) ? boardState.dutyRegions : [];
    const sameRegions = boardDutyRegions.length === dutyRegions.length
      && boardDutyRegions.every((region, index) => region === dutyRegions[index]);
    if (sameRegions && boardState?.groupSize === groupSizeValue) return;
    updateBoard({ dutyRegions, groupSize: groupSizeValue });
  }, [boardState, dutyRegions, form.teamSizeMax, updateBoard]);

  React.useEffect(() => {
    const normalizedOwnerValue = String(resolvedOwnerId || 'LH').toUpperCase();
    if (boardState?.ownerId === normalizedOwnerValue && boardState?.fileType === currentFileType) return;
    updateBoard({ ownerId: normalizedOwnerValue, fileType: currentFileType });
  }, [boardState?.ownerId, boardState?.fileType, resolvedOwnerId, currentFileType, updateBoard]);

  React.useEffect(() => {
    if (boardState?.rangeId === activeMenuKey) return;
    updateBoard({ rangeId: activeMenuKey });
  }, [boardState?.rangeId, activeMenuKey, updateBoard]);

  const onChange = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const handleEntryModeSelect = (mode) => {
    const normalized = mode === 'sum' ? 'sum' : (mode === 'none' ? 'none' : 'ratio');
    setForm((prev) => {
      const currentResolved = prev.entryQualificationMode === 'sum'
        ? 'sum'
        : (prev.entryQualificationMode === 'none' ? 'none' : 'ratio');
      if (currentResolved === normalized) return prev;
      return { ...prev, entryQualificationMode: normalized };
    });
  };

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
    const key = activeMenuKey || '';
    const estimated = parseAmount(form.estimatedPrice);
    const base = parseAmount(form.baseAmount);

    if (resolvedOwnerId === 'PPS') {
      return base > 0
        ? { perfectPerformanceAmount: base, perfectPerformanceBasis: '기초금액 × 1배' }
        : { perfectPerformanceAmount: 0, perfectPerformanceBasis: '' };
    }

    if (resolvedOwnerId === 'MOIS') {
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

    if (resolvedOwnerId === 'LH') {
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
  }, [activeMenuKey, resolvedOwnerId, form.estimatedPrice, form.baseAmount]);

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
    if (!showTenderFields) return;
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
  }, [showTenderFields, form.baseAmount, form.bidRate, form.adjustmentRate, form.bidAmount, bidTouched]);

  React.useEffect(() => {
    if (boardState?.open) return;

    const same = boardState?.noticeNo === (form.noticeNo || '')
      && boardState?.noticeTitle === (form.title || '')
      && boardState?.industryLabel === (form.industry || '')
      && boardState?.baseAmount === (form.baseAmount || '')
      && boardState?.estimatedAmount === (form.estimatedPrice || '')
      && boardState?.noticeDate === (form.noticeDate || '')
      && boardState?.bidDeadline === (form.bidDeadline || '')
      && boardState?.regionDutyRate === (form.regionDutyRate || '')
      && boardState?.bidAmount === (form.bidAmount || '')
      && boardState?.ratioBaseAmount === (form.ratioBaseAmount || '')
      && boardState?.bidRate === (form.bidRate || '')
      && boardState?.adjustmentRate === (form.adjustmentRate || '')
      && boardState?.entryAmount === (form.entryQualificationAmount || '')
      && (boardState?.entryMode || 'ratio') === entryMode;
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
      ratioBaseAmount: form.ratioBaseAmount || '',
      bidRate: form.bidRate || '',
      adjustmentRate: form.adjustmentRate || '',
      entryAmount: form.entryQualificationAmount || '',
      entryMode,
    });
  }, [
    boardState?.open,
    boardState?.noticeNo,
    boardState?.noticeTitle,
    boardState?.industryLabel,
    boardState?.baseAmount,
    boardState?.estimatedAmount,
    boardState?.noticeDate,
    boardState?.bidDeadline,
    boardState?.regionDutyRate,
    boardState?.bidAmount,
    boardState?.ratioBaseAmount,
    boardState?.bidRate,
    boardState?.adjustmentRate,
    boardState?.entryAmount,
    boardState?.entryMode,
    form.noticeNo,
    form.title,
    form.industry,
    form.baseAmount,
    form.estimatedPrice,
    form.noticeDate,
    form.bidDeadline,
    form.regionDutyRate,
    form.bidAmount,
    form.ratioBaseAmount,
    form.bidRate,
    form.adjustmentRate,
    form.entryQualificationAmount,
    entryMode,
    updateBoard,
  ]);

  React.useEffect(() => {
    if (!boardState?.open) return;
    const bidFromBoard = boardState.bidAmount || '';
    const ratioFromBoard = boardState.ratioBaseAmount || '';
    const entryFromBoard = boardState.entryAmount || '';
    const modeFromBoard = boardState.entryMode === 'sum'
      ? 'sum'
      : (boardState.entryMode === 'none' ? 'none' : 'ratio');
    const bidRateFromBoard = boardState.bidRate || '';
    const adjustmentFromBoard = boardState.adjustmentRate || '';

    const updates = {};
    if (bidFromBoard !== (form.bidAmount || '')) {
      setBidTouched(true);
      updates.bidAmount = bidFromBoard;
    }
    if (ratioFromBoard !== (form.ratioBaseAmount || '')) {
      updates.ratioBaseAmount = ratioFromBoard;
    }
    if (entryFromBoard !== (form.entryQualificationAmount || '')) {
      updates.entryQualificationAmount = entryFromBoard;
    }
    if (modeFromBoard !== entryMode) {
      updates.entryQualificationMode = modeFromBoard;
    }
    if (bidRateFromBoard !== (form.bidRate || '')) {
      updates.bidRate = bidRateFromBoard;
    }
    if (adjustmentFromBoard !== (form.adjustmentRate || '')) {
      updates.adjustmentRate = adjustmentFromBoard;
    }
    if (Object.keys(updates).length > 0) {
      setForm((prev) => ({ ...prev, ...updates }));
    }
  }, [boardState?.open, boardState?.bidAmount, boardState?.ratioBaseAmount, boardState?.entryAmount, boardState?.entryMode, boardState?.bidRate, boardState?.adjustmentRate, form.bidAmount, form.ratioBaseAmount, form.entryQualificationAmount, form.bidRate, form.adjustmentRate, entryMode]);

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
    if (key === 'agreements') { window.location.hash = BASE_ROUTES.agreementBoard; return; }
    if (key === 'region-search') { window.location.hash = BASE_ROUTES.regionSearch; return; }
    if (key === 'agreements-sms') { window.location.hash = BASE_ROUTES.agreements; return; }
    if (key === 'settings') { window.location.hash = BASE_ROUTES.settings; return; }
    if (key === 'upload') { window.location.hash = BASE_ROUTES.agreementBoard; return; }
    if (key === 'excel-helper') { window.location.hash = '#/excel-helper'; return; }
    const menu = findMenuByKey(key);
    if (menu) window.location.hash = menu.hash;
  };

  const buildRegionSearchPayload = useCallback(() => ({
    ownerId: resolvedOwnerId,
    menuKey: activeMenuKey,
    rangeId: activeMenuKey,
    fileType: currentFileType,
    noticeNo: form.noticeNo,
    noticeTitle: form.title,
    noticeDate: form.noticeDate,
    industryLabel: form.industry,
    entryAmount: form.entryQualificationAmount || '',
    entryMode,
    baseAmount: form.baseAmount,
    estimatedAmount: form.estimatedPrice,
    bidAmount: form.bidAmount,
    bidRate: form.bidRate,
    adjustmentRate: form.adjustmentRate,
    perfectPerformanceAmount,
    dutyRegions,
    ratioBaseAmount: isPPS ? (form.bidAmount || '') : (form.ratioBaseAmount || form.bidAmount || ''),
    defaultExcludeSingle: true,
    readOnly: true,
  }), [resolvedOwnerId, activeMenuKey, currentFileType, form.noticeNo, form.title, form.noticeDate, form.industry, form.entryQualificationAmount, entryMode, form.baseAmount, form.estimatedPrice, form.bidAmount, form.bidRate, form.adjustmentRate, perfectPerformanceAmount, dutyRegions, isPPS, form.ratioBaseAmount]);

  const handleOpenRegionSearch = useCallback(() => {
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

  const handleOpenBoard = useCallback(() => {
    openBoard({
      candidates: [],
      pinned: [],
      excluded: [],
      dutyRegions,
      groupSize: Number(form.teamSizeMax) > 0 ? Number(form.teamSizeMax) : 3,
      ownerId: (resolvedOwnerId || 'LH').toUpperCase(),
      fileType: currentFileType,
      rangeId: activeMenuKey,
      noticeNo: form.noticeNo || '',
      noticeTitle: form.title || '',
      industryLabel: form.industry || '',
      baseAmount: form.baseAmount || '',
      estimatedAmount: form.estimatedPrice || '',
      bidAmount: form.bidAmount || '',
      ratioBaseAmount: isPPS ? (form.bidAmount || '') : (form.ratioBaseAmount || form.bidAmount || ''),
      bidRate: form.bidRate || '',
      adjustmentRate: form.adjustmentRate || '',
      bidDeadline: form.bidDeadline || '',
      regionDutyRate: form.regionDutyRate || '',
      entryAmount: form.entryQualificationAmount || '',
      entryMode,
      inlineMode: true,
    });
    window.location.hash = '#/agreement-board';
  }, [openBoard, dutyRegions, form.teamSizeMax, resolvedOwnerId, currentFileType, activeMenuKey, form.noticeNo, form.title, form.industry, form.baseAmount, form.estimatedPrice, form.bidAmount, isPPS, form.ratioBaseAmount, form.bidRate, form.adjustmentRate, form.bidDeadline, form.regionDutyRate, form.entryQualificationAmount, entryMode]);

  return (
    <div className="app-shell">
      <Sidebar
        active={viewMode === 'region' ? 'region-search' : 'agreements'}
        onSelect={handleSidebarSelect}
        fileStatuses={fileStatuses}
        collapsed={true}
      />
      <div className="main">
        <div className="title-drag" />
        <div className="topbar" />
        <div className="stage">
          <div className="content">
            {enableMenuSelector && (
              <div className="panel" style={{ gridColumn: '1 / -1' }}>
                <h2 className="section-title" style={{ marginTop: 0 }}>발주처 / 금액 구간 선택</h2>
                <div className="section-divider" />
                <div className="grid-2">
                  <Field label="발주처">
                    <select
                      className="filter-input"
                      value={selectedGroupForSelector?.id || ''}
                      onChange={handleOwnerSelectionChange}
                    >
                      {AGREEMENT_GROUPS.map((group) => (
                        <option key={group.id} value={group.id}>{group.label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="금액 구간">
                    <select
                      className="filter-input"
                      value={selectedMenuKey}
                      onChange={handleRangeSelectionChange}
                    >
                      {(selectedGroupForSelector?.items || []).map((item) => (
                        <option key={item.key} value={item.key}>{item.label}</option>
                      ))}
                    </select>
                  </Field>
                </div>
              </div>
            )}
            <div className="panel" style={{ gridColumn: '1 / -1' }}>
              <h1 className="main-title" style={{ marginTop: 0 }}>{`${resolvedOwnerLabel} ${resolvedRangeLabel} - 설정`}</h1>

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
                  <Field label="참가자격금액">
                    {entryMode === 'none' ? (
                      <span className="entry-amount-placeholder">참가자격 없음</span>
                    ) : (
                      <AmountInput
                        value={form.entryQualificationAmount}
                        onChange={(value) => setForm((prev) => ({ ...prev, entryQualificationAmount: value }))}
                        placeholder="원(=추정가격)"
                      />
                    )}
                  </Field>
                  <Field label="참가자격 산출 방식">
                    <div className="entry-mode-toggle">
                      <button
                        type="button"
                        className={`btn-sm ${entryMode === 'ratio' ? 'btn-primary' : 'btn-soft'}`}
                        onClick={() => handleEntryModeSelect('ratio')}
                      >비율제</button>
                      <button
                        type="button"
                        className={`btn-sm ${entryMode === 'sum' ? 'btn-primary' : 'btn-soft'}`}
                        onClick={() => handleEntryModeSelect('sum')}
                      >단순합산제</button>
                      <button
                        type="button"
                        className={`btn-sm ${entryMode === 'none' ? 'btn-primary' : 'btn-soft'}`}
                        onClick={() => handleEntryModeSelect('none')}
                      >없음</button>
                    </div>
                    <small style={{ display: 'block', marginTop: 6, color: '#64748b' }}>
                      비율제는 지분을 곱해 합산하고, 단순합산제는 지분과 무관하게 시평액을 더합니다. 참가자격이 없다면 없음 옵션을 선택하세요.
                    </small>
                  </Field>
                  {isLH && (
                    <Field label="시공비율기준금액" style={{ gridColumn: '1 / -1' }}>
                      <AmountInput
                        value={form.ratioBaseAmount}
                        onChange={(value) => setForm((prev) => ({ ...prev, ratioBaseAmount: value }))}
                        placeholder="원"
                      />
                    </Field>
                  )}
                  {showTenderFields && (
                    <Field label="투찰율(%)">
                      <input
                        className="filter-input"
                        type="number"
                        step="0.001"
                        value={form.adjustmentRate}
                        onChange={(e) => setForm((prev) => ({ ...prev, adjustmentRate: e.target.value }))}
                        placeholder={isPPS ? '예: 86.745' : '예: 101.4'}
                      />
                    </Field>
                  )}
                  {showTenderFields && (
                    <Field label="사정율(%)">
                      <input
                        className="filter-input"
                        type="number"
                        step="0.1"
                        value={form.bidRate}
                        onChange={(e) => setForm((prev) => ({ ...prev, bidRate: e.target.value }))}
                        placeholder={isPPS ? '예: 101.6' : '예: 86.745'}
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
                  {showTenderFields && (
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

            {viewMode !== 'board' && (
              <div className="panel" style={{ gridColumn: '1 / -1' }}>
                <h3 style={{ marginTop: 0 }}>지역사 찾기 안내</h3>
                <div className="candidate-summary__empty">
                  지역사 찾기는 업체 검색과 정보 확인용 도구입니다. 필요한 업체를 확인한 뒤 협정보드 슬롯의 “업체 검색” 버튼으로 직접 배치하세요.
                </div>
                <div style={{ marginTop: 12 }}>
                  <button className="btn-soft" onClick={handleOpenRegionSearch}>지역사 찾기</button>
                </div>
              </div>
            )}

            {viewMode !== 'region' && (
              <div className="action-footer" style={{ gridColumn: '1 / -1' }}>
                <div className="action-footer__info">
                  지역사 찾기에서 확인한 업체를 협정보드에서 다시 검색해 직접 구성하세요.
                </div>
                <div className="action-footer__buttons">
                  <button className="primary" onClick={handleOpenBoard}>협정보드 열기</button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
