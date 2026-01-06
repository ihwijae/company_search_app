import React from 'react';
import '../../../../styles.css';
import '../../../../fonts.css';
import Sidebar from '../../../../components/Sidebar';
import { BASE_ROUTES } from '../../../../shared/navigation.js';
import AUTO_COMPANY_PRESETS from '../../../../shared/autoCompanyPresets.js';
import { evaluateSingleBidByConfig } from '../../../../shared/agreements/singleBidEvaluator.js';

const ROUTE_HASHES = {
  search: BASE_ROUTES.search,
  agreements: '#/agreement-board',
  'agreements-sms': BASE_ROUTES.agreements,
  'region-search': BASE_ROUTES.regionSearch,
  records: '#/records',
  mail: '#/mail',
  'excel-helper': '#/excel-helper',
  settings: BASE_ROUTES.settings,
  upload: '#/upload',
};

const owners = ['LH', '행안부', '조달청'];
const industries = ['전기', '통신', '소방'];
const RANGE_OPTIONS = {
  LH: ['50억 미만', '50억~100억'],
  행안부: ['30억 미만', '30억~50억', '50억~100억', '100억 이상'],
  조달청: ['50억 미만', '50억~100억', '100억 이상'],
};
const ALL_REGIONS = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];
const MENU_MAPPING = {
  LH: {
    ownerId: 'LH',
    fileType: 'eung',
    ranges: {
      '50억 미만': 'lh-under50',
      '50억~100억': 'lh-50to100',
    },
  },
  행안부: {
    ownerId: 'MOIS',
    fileType: 'eung',
    ranges: {
      '30억 미만': 'mois-under30',
      '30억~50억': 'mois-30to50',
      '50억~100억': 'mois-50to100',
      '100억 이상': 'mois-50to100',
    },
  },
  조달청: {
    ownerId: 'PPS',
    fileType: 'eung',
    ranges: {
      '50억 미만': 'pps-under50',
      '50억~100억': 'pps-50to100',
      '100억 이상': 'pps-50to100',
    },
  },
};

export default function AutoAgreementPage() {
  const handleMenuSelect = React.useCallback((key) => {
    if (!key || key === 'auto-agreement') return;
    const target = ROUTE_HASHES[key] || null;
    if (target) {
      window.location.hash = target;
    }
  }, []);

  const [form, setForm] = React.useState({
    owner: owners[0],
    range: RANGE_OPTIONS[owners[0]][0],
    noticeTitle: '',
    noticeNo: '',
    industry: industries[0],
    dutyRate: '49',
    dutyRegions: ['경기'],
    maxMembers: '2',
  });

  const [amounts, setAmounts] = React.useState({
    base: '',
    estimated: '',
    bid: '',
    ratioBase: '',
    schedule: '',
    bidRate: '',
    adjustmentRate: '',
  });
  const [entry, setEntry] = React.useState({ amount: '', mode: 'ratio' });

  const [sheetName, setSheetName] = React.useState('[포천2공공하수처리시설]');
  const [regionPickerOpen, setRegionPickerOpen] = React.useState(false);
  const [regionFilter, setRegionFilter] = React.useState('');

  const [companyConfig, setCompanyConfig] = React.useState(AUTO_COMPANY_PRESETS);
  const [teams, setTeams] = React.useState([]);
  const [autoSummary, setAutoSummary] = React.useState(null);
  const configFileInputRef = React.useRef(null);
  const [templatePanelOpen, setTemplatePanelOpen] = React.useState(false);
  const [candidateState, setCandidateState] = React.useState({ loading: false, error: '', items: [] });

  const updateForm = (key) => (event) => {
    const value = event?.target ? event.target.value : event;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const availableRanges = React.useMemo(() => RANGE_OPTIONS[form.owner] || RANGE_OPTIONS.LH, [form.owner]);

  const resolveMenuInfo = React.useCallback(() => {
    const ownerKey = form.owner;
    if (!ownerKey) return null;
    const config = MENU_MAPPING[ownerKey];
    if (!config) return null;
    const menuKey = config.ranges?.[form.range];
    if (!menuKey) return null;
    return { ownerId: config.ownerId, menuKey, fileType: config.fileType || 'eung' };
  }, [form.owner, form.range]);

  const handleOwnerChange = (event) => {
    const nextOwner = event.target.value;
    const options = RANGE_OPTIONS[nextOwner] || RANGE_OPTIONS.LH;
    setForm((prev) => ({
      ...prev,
      owner: nextOwner,
      range: options.includes(prev.range) ? prev.range : options[0],
    }));
  };

  const updateAmount = (key) => (event) => {
    const value = event?.target ? event.target.value : event;
    setAmounts((prev) => ({ ...prev, [key]: value }));
  };

  const toggleDutyRegion = (region) => {
    setForm((prev) => {
      const exists = prev.dutyRegions.includes(region);
      const dutyRegions = exists
        ? prev.dutyRegions.filter((item) => item !== region)
        : [...prev.dutyRegions, region];
      return { ...prev, dutyRegions };
    });
  };

  const handleConfigImportRequest = React.useCallback(() => {
    configFileInputRef.current?.click();
  }, []);

  const handleConfigFileChange = React.useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || !parsed.regions) {
        throw new Error('regions 필드가 없습니다.');
      }
      setCompanyConfig(parsed);
      window.alert('Config를 불러왔습니다.');
    } catch (error) {
      window.alert(`Config 가져오기 실패: ${error.message}`);
    } finally {
      event.target.value = '';
    }
  }, []);

  const handleConfigExport = React.useCallback(() => {
    const data = JSON.stringify(companyConfig, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auto-company-config-${companyConfig.version || 'custom'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [companyConfig]);

  const handleConfigAction = (type) => {
    alert(`${type} 기능은 추후 연결됩니다.`);
  };

  const handleCreateSheet = () => {
    alert('시트 생성 & 값 입력은 추후 연동됩니다.');
  };

  const combinedNoticeValue = React.useMemo(() => {
    return [form.noticeNo, form.noticeTitle].filter(Boolean).join(' ').trim();
  }, [form.noticeNo, form.noticeTitle]);

  const handleCombinedNoticeChange = (event) => {
    const raw = event.target.value || '';
    const trimmed = raw.trim();
    if (!trimmed) {
      setForm((prev) => ({ ...prev, noticeNo: '', noticeTitle: '' }));
      return;
    }
    const firstSpace = trimmed.indexOf(' ');
    if (firstSpace <= 0) {
      setForm((prev) => ({ ...prev, noticeNo: trimmed, noticeTitle: '' }));
    } else {
      const noPart = trimmed.slice(0, firstSpace).trim();
      const titlePart = trimmed.slice(firstSpace + 1).trim();
      setForm((prev) => ({ ...prev, noticeNo: noPart, noticeTitle: titlePart }));
    }
  };

  const filteredRegions = React.useMemo(() => {
    const keyword = regionFilter.trim().toLowerCase();
    if (!keyword) return ALL_REGIONS;
    return ALL_REGIONS.filter((region) => region.toLowerCase().includes(keyword));
  }, [regionFilter]);

  const toggleRegionPanel = () => {
    setRegionPickerOpen((prev) => !prev);
  };

  const ratioBaseDisabled = form.owner !== 'LH';
  const bidDisabled = form.owner === 'LH' || (form.owner === '행안부' && form.range === '30억 미만');
  const bidRateDisabled = form.owner === '행안부' && form.range === '30억 미만';

  const parseAmountValue = React.useCallback((value) => {
    if (!value) return 0;
    const digits = String(value).replace(/[^0-9]/g, '');
    return digits ? Number(digits) : 0;
  }, []);

  const formatAmountShort = React.useCallback((value) => {
    if (!value) return '0';
    if (value >= 100000000) return `${Math.round(value / 100000000)}억`;
    if (value >= 10000) return `${Math.round(value / 10000)}만`;
    return value.toLocaleString();
  }, []);

  const resolveCandidateMetrics = React.useCallback((candidate) => {
    if (!candidate) return { sipyung: 0, perf5y: 0, management: null };
    const pickAmount = (primaryKeys = [], fallbackKeys = []) => {
      for (const key of primaryKeys) {
        if (candidate[key] == null) continue;
        const amount = parseAmountValue(candidate[key]);
        if (amount > 0) return amount;
      }
      if (candidate.singleBidFacts) {
        for (const key of fallbackKeys) {
          if (candidate.singleBidFacts[key] == null) continue;
          const amount = parseAmountValue(candidate.singleBidFacts[key]);
          if (amount > 0) return amount;
        }
      }
      return 0;
    };
    const sipyung = pickAmount(
      ['_sipyung', 'sipyung', 'rating', '시평', '시평액', '시평액(원)', '기초금액'],
      ['sipyung']
    );
    const perf5y = pickAmount(
      ['_performance5y', 'performance5y', 'perf5y', '5년 실적', '5년실적', '최근5년실적', '최근5년실적합계'],
      ['perf5y']
    );
    const parseScoreValue = (value) => {
      if (value === null || value === undefined || value === '') return null;
      const num = Number(String(value).replace(/[^0-9.+-]/g, ''));
      return Number.isFinite(num) ? num : null;
    };
    const resolveScore = () => {
      const candidates = [
        candidate.managementScore,
        candidate.managementTotalScore,
        candidate._agreementManagementScore,
        candidate._score,
        candidate.score,
        candidate.managementResult,
      ];
      for (const value of candidates) {
        const parsed = parseScoreValue(value);
        if (parsed != null) return parsed;
      }
      return null;
    };
    return { sipyung, perf5y, management: resolveScore() };
  }, [parseAmountValue]);

  const perfectPerformance = React.useMemo(() => {
    const estimated = parseAmountValue(amounts.estimated);
    const base = parseAmountValue(amounts.base);
    if (form.owner === '행안부') {
      if (form.range === '30억 미만' || form.range === '30억~50억') {
        const amount = estimated > 0 ? Math.round(estimated * 0.8) : 0;
        return { amount, basis: '추정가격 × 80%' };
      }
      if (form.range === '50억~100억' || form.range === '100억 이상') {
        const amount = estimated > 0 ? Math.round(estimated * 1.7) : 0;
        return { amount, basis: '추정가격 × 1.7배' };
      }
    }
    if (form.owner === '조달청') {
      return base > 0 ? { amount: base, basis: '기초금액 × 1배' } : { amount: 0, basis: '' };
    }
    if (form.owner === 'LH') {
      return base > 0 ? { amount: base, basis: '기초금액 × 1배' } : { amount: 0, basis: '' };
    }
    return { amount: 0, basis: '' };
  }, [amounts.base, amounts.estimated, form.owner, form.range, parseAmountValue]);

  const perfectPerformanceDisplay = React.useMemo(() => {
    if (!perfectPerformance.amount || perfectPerformance.amount <= 0) return '';
    const base = perfectPerformance.amount.toLocaleString();
    return perfectPerformance.basis ? `${base} (${perfectPerformance.basis})` : base;
  }, [perfectPerformance]);

  const describeEntry = React.useCallback((entry, candidateResolver) => {
    if (!entry) return null;
    const candidate = candidateResolver ? candidateResolver(entry) : null;
    const name = (candidate?.name && String(candidate.name).trim()) || entry.name;
    return {
      name,
      candidate,
      entry,
    };
  }, []);

  const buildShareSummary = React.useCallback((leaderEntry, memberEntries, maxMembers) => {
    const baseLeaderShare = leaderEntry?.entry?.defaultShare ?? leaderEntry?.defaultShare ?? (maxMembers > 1 ? 51 : 100);
    const leaderShare = Math.min(100, Math.max(0, baseLeaderShare));
    const remaining = Math.max(0, 100 - leaderShare);
    if (!memberEntries.length) return `${leaderShare}%`;
    const perMember = memberEntries.map(() => Math.floor(remaining / memberEntries.length));
    return [leaderShare, ...perMember].join(' / ');
  }, []);

  const isEntryAllowed = React.useCallback((entry, context) => {
    if (!entry) return false;
    if (entry.allowedOwners && !entry.allowedOwners.includes(context.owner)) return false;
    if (entry.disallowedOwners && entry.disallowedOwners.includes(context.owner)) return false;
    if (entry.minEstimatedAmount && context.estimatedAmount < entry.minEstimatedAmount) return false;
    if (entry.maxEstimatedAmount && context.estimatedAmount > entry.maxEstimatedAmount) return false;
    if (entry.requireDutyShare && !context.usesDutyShare) return false;
    if (entry.minShareAmount && context.shareBudget < entry.minShareAmount) return false;
    if (entry.allowSolo === false && context.singleBidEligible) return false;
    if (context.candidate?.singleBidEligible && entry.allowSingleBid !== true) return false;
    return true;
  }, []);

  const buildGroupsFromEntries = React.useCallback((entries, maxMembers, candidateResolver) => {
    const leaders = entries.filter((item) => item.requiredRole === 'leader');
    const flex = entries.filter((item) => item.requiredRole !== 'leader');
    const queue = [...leaders, ...flex];
    const restPool = [...flex];
    const result = [];

    const removeFromPool = (target) => {
      const index = restPool.indexOf(target);
      if (index >= 0) {
        restPool.splice(index, 1);
      }
    };

    while (queue.length) {
      const leaderEntry = queue.shift();
      if (!leaderEntry) break;
      removeFromPool(leaderEntry);
      const members = [];
      while (members.length < Math.max(0, maxMembers - 1) && restPool.length) {
        const candidate = restPool.shift();
        if (candidate) {
          members.push(candidate);
        }
      }
      const leaderDisplay = describeEntry(leaderEntry, candidateResolver);
      const memberDisplays = members.map((member) => describeEntry(member, candidateResolver));
      result.push({
        id: result.length + 1,
        leader: leaderDisplay,
        members: memberDisplays,
        shares: buildShareSummary(leaderDisplay, memberDisplays, maxMembers),
      });
      if (!leaderEntry.requiredRole && !queue.length && restPool.length) {
        queue.push(...restPool.splice(0));
      }
    }
    return result;
  }, [buildShareSummary, describeEntry]);

  const singleBidPreview = React.useMemo(() => {
    const baseAmountValue = parseAmountValue(amounts.base);
    const estimatedAmount = parseAmountValue(amounts.estimated) || baseAmountValue;
    const entryAmountValue = entry.mode === 'none' ? 0 : parseAmountValue(entry.amount);
    if (!form.owner) {
      return {
        estimatedAmount,
        baseAmountValue,
        entryAmountValue,
        result: null,
      };
    }
    const evaluation = evaluateSingleBidByConfig({
      owner: form.owner,
      rangeLabel: form.range,
      estimatedAmount,
      baseAmount: baseAmountValue,
      entryAmount: entryAmountValue,
      dutyRegions: form.dutyRegions,
      company: { region: form.dutyRegions[0] || '' },
    });
    return {
      estimatedAmount,
      baseAmountValue,
      entryAmountValue,
      result: evaluation,
    };
  }, [amounts.base, amounts.estimated, entry.amount, entry.mode, form.dutyRegions, form.owner, form.range, parseAmountValue]);

  const handleFetchCandidates = React.useCallback(async () => {
    const menuInfo = resolveMenuInfo();
    if (!menuInfo) {
      window.alert('지원하지 않는 발주처/금액 구간입니다.');
      return;
    }
    if (!window?.electronAPI?.fetchCandidates) {
      window.alert('후보 조회 API를 사용할 수 없습니다.');
      return;
    }
    const entryAmountValue = entry.mode === 'none' ? 0 : parseAmountValue(entry.amount);
    const baseAmountValue = parseAmountValue(amounts.base);
    const estimatedAmount = parseAmountValue(amounts.estimated) || baseAmountValue;
    const perfectAmount = perfectPerformance.amount;
    const filterByRegion = form.dutyRegions.length > 0;
    setCandidateState((prev) => ({ ...prev, loading: true, error: '' }));
    try {
      const response = await window.electronAPI.fetchCandidates({
        ownerId: menuInfo.ownerId,
        menuKey: menuInfo.menuKey,
        rangeId: menuInfo.menuKey,
        fileType: menuInfo.fileType,
        entryAmount: entryAmountValue,
        baseAmount: baseAmountValue,
        estimatedAmount,
        perfectPerformanceAmount: perfectAmount,
        dutyRegions: filterByRegion ? form.dutyRegions : [],
        filterByRegion,
        excludeSingleBidEligible: false,
      });
      if (!response?.success) throw new Error(response?.message || '후보 조회 실패');
      const items = Array.isArray(response.data) ? response.data : [];
      setCandidateState({ loading: false, error: '', items });
    } catch (error) {
      setCandidateState({ loading: false, error: error?.message || '후보 조회 실패', items: [] });
      window.alert(`업체 조회 실패: ${error?.message || error}`);
    }
  }, [amounts.base, amounts.estimated, entry.amount, entry.mode, form.dutyRegions, parseAmountValue, perfectPerformance.amount, resolveMenuInfo]);

  const normalizeName = React.useCallback((value) => String(value || '').trim(), []);
  const normalizeKey = React.useCallback((value) => {
    return normalizeName(value)
      .replace(/주식회사/gi, '')
      .replace(/합자회사/gi, '')
      .replace(/\(주\)/gi, '')
      .replace(/\(합\)/gi, '')
      .replace(/\(유\)/gi, '')
      .replace(/\(사\)/gi, '')
      .replace(/㈜/g, '')
      .replace(/㈔/g, '')
      .replace(/[\s·.,\-\/]/g, '');
  }, [normalizeName]);

  const candidateMap = React.useMemo(() => {
    const map = new Map();
    candidateState.items.forEach((item) => {
      const key = normalizeKey(item.name || item.id);
      if (key && !map.has(key)) map.set(key, item);
    });
    return map;
  }, [candidateState.items, normalizeKey]);

  const resolveCandidate = React.useCallback((entry) => {
    if (!entry) return null;
    return candidateMap.get(normalizeKey(entry.name));
  }, [candidateMap, normalizeKey]);

  const aggregatedSingleBidFacts = React.useMemo(() => {
    if (candidateState.items.length) {
      const bySingle = candidateState.items.find((item) => item.singleBidEligible && item.singleBidFacts);
      if (bySingle?.singleBidFacts) return bySingle.singleBidFacts;
      const withFacts = candidateState.items.find((item) => item.singleBidFacts);
      if (withFacts?.singleBidFacts) return withFacts.singleBidFacts;
    }
    return singleBidPreview.result?.facts || null;
  }, [candidateState.items, singleBidPreview]);

  const previewFacts = aggregatedSingleBidFacts || {};
  const anySingleBidEligible = candidateState.items.length
    ? candidateState.items.some((item) => item.singleBidEligible)
    : Boolean(singleBidPreview.result?.ok);

  const renderCompanyInfo = React.useCallback((display) => {
    if (!display) return <div className="auto-company-block">-</div>;
    const metrics = resolveCandidateMetrics(display.candidate);
    const fmt = (value) => {
      const num = Number(value);
      return Number.isFinite(num) && num > 0 ? num.toLocaleString() : '-';
    };
    const mgmt = metrics.management != null ? `${metrics.management.toFixed(2)}점` : '-';
    return (
      <div className="auto-company-block">
        <div className="auto-company-name">{display.name || '-'}</div>
        <div className="auto-company-metrics">
          <span>시평 {fmt(metrics.sipyung)}</span>
          <span>5년실적 {fmt(metrics.perf5y)}</span>
          <span>경영 {mgmt}</span>
        </div>
      </div>
    );
  }, [formatAmountShort, resolveCandidateMetrics]);

  const handleAutoArrange = React.useCallback(() => {
    const regionCandidates = form.dutyRegions.length ? form.dutyRegions : Object.keys(companyConfig.regions || {});
    const fallbackRegion = Object.keys(companyConfig.regions || {})[0];
    const regionKey = regionCandidates.find((key) => companyConfig.regions?.[key]) || fallbackRegion;
    if (!regionKey) {
      window.alert('고정업체 구성이 존재하지 않습니다. Config를 확인해 주세요.');
      return;
    }
    const regionBlock = companyConfig.regions?.[regionKey];
    const entries = regionBlock?.[form.industry] || [];
    if (!entries.length) {
      window.alert('해당 지역/공종에 등록된 고정업체가 없습니다.');
      return;
    }
    const baseAmountValue = singleBidPreview.baseAmountValue;
    const estimatedAmount = singleBidPreview.estimatedAmount;
    const dutyRate = Number(form.dutyRate) || 0;
    const shareBudget = estimatedAmount * (dutyRate / 100);
    const singleBidEligible = anySingleBidEligible;
    const context = {
      owner: form.owner,
      estimatedAmount,
      shareBudget,
      usesDutyShare: dutyRate > 0,
      singleBidEligible,
    };
    const filtered = entries.filter((entry) => {
      const candidate = resolveCandidate(entry);
      const singleFlag = typeof candidate?.singleBidEligible === 'boolean'
        ? candidate.singleBidEligible
        : false;
      return isEntryAllowed(entry, { ...context, singleBidEligible: singleFlag, candidate });
    });
    if (!filtered.length) {
      window.alert('조건에 맞는 고정업체를 찾지 못했습니다. 금액/발주처 조건을 확인하세요.');
      return;
    }
    const maxMembers = Math.max(1, Number(form.maxMembers) || 3);
    const groups = buildGroupsFromEntries(filtered, maxMembers, resolveCandidate);
    setTeams(groups);
    setAutoSummary({ region: regionKey, industry: form.industry, total: filtered.length });
  }, [anySingleBidEligible, buildGroupsFromEntries, companyConfig.regions, form.dutyRate, form.dutyRegions, form.industry, form.maxMembers, form.owner, form.range, isEntryAllowed, resolveCandidate, singleBidPreview]);

  return (
    <>
      <input
        type="file"
        accept="application/json"
        ref={configFileInputRef}
        style={{ display: 'none' }}
        onChange={handleConfigFileChange}
      />
      <div className="app-shell">
        <Sidebar active="auto-agreement" onSelect={handleMenuSelect} collapsed={true} />
        <div className="main">
          <div className="title-drag" />
          <div className="topbar" />
          <div className="stage">
            <div className="content auto-agreement-layout">
            <div className="panel auto-panel">
              <div className="panel-heading">
                <h1 className="main-title" style={{ marginTop: 0 }}>협정 자동화</h1>
                <p className="section-help">필수 정보를 입력하면 자동 구성과 엑셀 시트 생성을 준비할 수 있습니다.</p>
              </div>
              <section className="auto-section-card">
                <div className="section-header">
                  <h2 className="section-title">기본 정보</h2>
                  <button type="button" className="btn-chip" onClick={() => setForm((prev) => ({ ...prev, dutyRegions: ['경기'], dutyRate: '49' }))}>기본값</button>
                </div>
                <div className="auto-field-grid">
                  <label className="auto-field">
                    <span>발주처</span>
                    <select value={form.owner} onChange={handleOwnerChange}>
                      {owners.map((owner) => <option key={owner} value={owner}>{owner}</option>)}
                    </select>
                  </label>
                  <label className="auto-field">
                    <span>금액 구간</span>
                    <select value={form.range} onChange={updateForm('range')}>
                      {availableRanges.map((range) => <option key={range} value={range}>{range}</option>)}
                    </select>
                  </label>
                  <label className="auto-field" style={{ gridColumn: 'span 2' }}>
                    <span>공고번호 + 공고명</span>
                    <input value={combinedNoticeValue} onChange={handleCombinedNoticeChange} placeholder="예: R25BK... 포천2 공공하수..." />
                  </label>
                  <label className="auto-field">
                    <span>공종</span>
                    <select value={form.industry} onChange={updateForm('industry')}>
                      {industries.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </label>
                  <label className="auto-field">
                    <span>최대 구성사 수</span>
                    <select value={form.maxMembers} onChange={updateForm('maxMembers')}>
                      {[2, 3, 4, 5].map((num) => <option key={num} value={num}>{num}개</option>)}
                    </select>
                  </label>
                  <label className="auto-field">
                    <span>의무지분(%)</span>
                    <input value={form.dutyRate} onChange={updateForm('dutyRate')} />
                  </label>
                  <div className="auto-field" style={{ gridColumn: 'span 2' }}>
                    <span>의무지역</span>
                    <div className="auto-region-display">
                      {form.dutyRegions.length === 0 && <span className="auto-region-placeholder">선택된 지역 없음</span>}
                      {form.dutyRegions.map((region) => (
                        <span key={region} className="auto-region-chip">{region}</span>
                      ))}
                      <div className="auto-region-actions">
                        {form.dutyRegions.length > 0 && (
                          <button type="button" className="btn-soft" onClick={() => setForm((prev) => ({ ...prev, dutyRegions: [] }))}>초기화</button>
                        )}
                        <button type="button" className="btn-soft" onClick={toggleRegionPanel}>{regionPickerOpen ? '닫기' : '지역 선택'}</button>
                      </div>
                    </div>
                    {regionPickerOpen && (
                      <div className="auto-region-panel">
                        <input
                          value={regionFilter}
                          onChange={(event) => setRegionFilter(event.target.value)}
                          placeholder="지역명 검색"
                        />
                        <div className="auto-region-panel-list">
                          {filteredRegions.map((region) => (
                            <label key={region}>
                              <input
                                type="checkbox"
                                checked={form.dutyRegions.includes(region)}
                                onChange={() => toggleDutyRegion(region)}
                              />
                              <span>{region}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <section className="auto-section-card">
                <div className="section-header">
                  <h2 className="section-title">금액 / 일정</h2>
                  <span className="section-help">발주처별 필수 금액 정보를 채워 주세요.</span>
                </div>
                <div className="auto-field-grid">
                  <label className="auto-field">
                    <span>기초금액</span>
                    <input value={amounts.base} onChange={updateAmount('base')} placeholder="원" />
                  </label>
                  <label className="auto-field">
                    <span>추정가격</span>
                    <input value={amounts.estimated} onChange={updateAmount('estimated')} placeholder="원" />
                  </label>
                  <label className="auto-field">
                    <span>투찰금액</span>
                    <input value={amounts.bid} onChange={updateAmount('bid')} placeholder="원" disabled={bidDisabled} />
                  </label>
                  <label className="auto-field">
                    <span>시공비율 기준</span>
                    <input value={amounts.ratioBase} onChange={updateAmount('ratioBase')} placeholder="원" disabled={ratioBaseDisabled} />
                  </label>
                  <label className="auto-field">
                    <span>개찰/일정</span>
                    <input type="datetime-local" value={amounts.schedule} onChange={updateAmount('schedule')} />
                  </label>
                  {!bidRateDisabled && (
                    <label className="auto-field">
                      <span>투찰율(%)</span>
                      <input
                        type="number"
                        step="0.001"
                        value={amounts.adjustmentRate}
                        onChange={updateAmount('adjustmentRate')}
                        placeholder="예: 86.745"
                      />
                    </label>
                  )}
                  {!bidRateDisabled && (
                    <label className="auto-field">
                      <span>사정율(%)</span>
                      <input
                        type="number"
                        step="0.001"
                        value={amounts.bidRate}
                        onChange={updateAmount('bidRate')}
                        placeholder="예: 101.4"
                      />
                    </label>
                  )}
                  <label className="auto-field" style={{ gridColumn: '1 / -1' }}>
                    <span>실적만점금액</span>
                    <input value={perfectPerformanceDisplay} readOnly placeholder="금액 입력 시 자동 계산" />
                  </label>
                </div>
              </section>
              <section className="auto-section-card">
                <div className="section-header">
                  <h2 className="section-title">참가자격</h2>
                  <div className="auto-toggle-group">
                    {['ratio', 'sum', 'none'].map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        className={`btn-chip small ${entry.mode === mode ? 'active' : ''}`}
                        onClick={() => setEntry((prev) => ({ ...prev, mode }))}
                      >
                        {mode === 'ratio' ? '비율제' : mode === 'sum' ? '단순합산제' : '없음'}
                      </button>
                    ))}
                  </div>
                </div>
                {entry.mode === 'none' ? (
                  <div className="auto-field">
                    <span>참가자격 금액</span>
                    <div className="auto-placeholder">참가자격 없음</div>
                  </div>
                ) : (
                  <label className="auto-field">
                    <span>참가자격 금액</span>
                    <input value={entry.amount} onChange={(event) => setEntry({ ...entry, amount: event.target.value })} placeholder="원" />
                  </label>
                )}
              </section>
              <section className="auto-section-card">
                <h2 className="section-title">시트 정보</h2>
                <label className="auto-field">
                  <span>시트 이름</span>
                  <input value={sheetName} onChange={(event) => setSheetName(event.target.value)} />
                </label>
                <div className="auto-summary">
                  <div>
                    <strong>공고 요약</strong>
                    <p>{form.noticeTitle || '공고명을 입력하세요'}</p>
                  </div>
                  <div>
                    <strong>공종/의무지분</strong>
                    <p>{form.industry} · {form.dutyRate}%</p>
                  </div>
                  <div>
                    <strong>의무지역</strong>
                    <p>{form.dutyRegions.length ? form.dutyRegions.join(', ') : '미선택'}</p>
                  </div>
                </div>
                <div className="auto-action-group">
                  <button type="button" className="btn-primary" onClick={handleCreateSheet}>시트 생성 & 값 입력</button>
                  <button type="button" className="btn-soft" onClick={() => handleConfigAction('검증')}>실행 전 검증</button>
                </div>
              </section>
            </div>

            <div className="panel auto-panel">
              <section className="auto-section-card">
                <div className="section-header" style={{ gap: '8px' }}>
                  <h2 className="section-title">협정 구성</h2>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn-soft"
                      style={{ padding: '6px 16px' }}
                      onClick={handleFetchCandidates}
                      disabled={candidateState.loading}
                    >
                      {candidateState.loading ? '업체 조회 중...' : '업체 조회'}
                    </button>
                    <button type="button" className="btn-primary" style={{ padding: '6px 16px' }} onClick={handleAutoArrange}>자동 구성</button>
                  </div>
                </div>
                {candidateState.error && (
                  <p className="section-help" style={{ color: '#dc2626' }}>{candidateState.error}</p>
                )}
                {!candidateState.error && candidateState.items.length > 0 && (
                  <p className="section-help">후보 {candidateState.items.length}개를 불러왔습니다.</p>
                )}
                <div className="auto-inline-cards" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
                  <div className="auto-inline-card">
                    <strong>시평액</strong>
                    <p>{previewFacts.sipyung > 0 ? formatAmountShort(previewFacts.sipyung) : '데이터 없음'}</p>
                  </div>
                  <div className="auto-inline-card">
                    <strong>5년 실적액</strong>
                    <p>{previewFacts.perf5y > 0 ? formatAmountShort(previewFacts.perf5y) : '데이터 없음'}</p>
                  </div>
                  <div className="auto-inline-card">
                    <strong>경영점수</strong>
                    <p>연동 예정</p>
                  </div>
                </div>
                <div className="auto-table-card">
                  <table>
                    <thead>
                      <tr>
                        <th>협정</th>
                        <th>대표사</th>
                        <th>구성사</th>
                        <th>지분(%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teams.length === 0 ? (
                        <tr className="excel-board-row empty">
                          <td colSpan={4}>자동 구성 결과가 없습니다. 조건을 확인하고 다시 실행하세요.</td>
                        </tr>
                      ) : (
                        teams.map((team) => (
                          <tr key={team.id}>
                            <td>#{team.id}</td>
                            <td>{renderCompanyInfo(team.leader)}</td>
                            <td>
                              {team.members.length
                                ? team.members.map((member, idx) => (
                                    <div key={`${team.id}-${idx}`}>{renderCompanyInfo(member)}</div>
                                  ))
                                : '-'}
                            </td>
                            <td>{team.shares || '-'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {autoSummary && (
                  <p className="section-help">{autoSummary.region} · {autoSummary.industry} 기준 {autoSummary.total}개 업체를 반영했습니다.</p>
                )}
              </section>

              <section className="auto-section-card">
                <div className="section-header">
                  <h2 className="section-title">템플릿 / 매핑</h2>
                  <button type="button" className="btn-soft" onClick={() => setTemplatePanelOpen((prev) => !prev)}>{templatePanelOpen ? '접기' : '열기'}</button>
                </div>
                {templatePanelOpen && (
                  <>
                    <p className="section-help">템플릿은 고정 폴더를 사용합니다. 설정 변경이 필요하면 개발측에 요청하세요.</p>
                    <div className="auto-inline-cards" style={{ gridTemplateColumns: '1fr' }}>
                      <div className="auto-inline-card">
                        <strong>템플릿 폴더</strong>
                        <p>C:/templates/협정</p>
                      </div>
                      <div className="auto-inline-card">
                        <strong>셀 매핑 파일</strong>
                        <p>C:/templates/mapping.json</p>
                      </div>
                    </div>
                    <div className="auto-inline-cards" style={{ gridTemplateColumns: '1fr 1fr' }}>
                      <div className="auto-inline-card">
                        <strong>Config 버전</strong>
                        <p>{companyConfig.version || 'custom'}</p>
                      </div>
                      <div className="auto-inline-card">
                        <strong>관리 지역</strong>
                        <p>{Object.keys(companyConfig.regions || {}).length}곳</p>
                      </div>
                    </div>
                    <div className="auto-config-actions" style={{ marginTop: '8px' }}>
                      <button type="button" className="btn-chip" onClick={handleConfigImportRequest}>Config 가져오기</button>
                      <button type="button" className="btn-chip" onClick={handleConfigExport}>Config 내보내기</button>
                    </div>
                  </>
                )}
              </section>
            </div>

            <div className="panel auto-panel" style={{ gridColumn: '1 / -1' }}>
              <div className="auto-file-actions">
                <div>
                  <h2 className="section-title" style={{ marginTop: 0 }}>엑셀 대상 파일</h2>
                  <p className="section-help">해당 공고의 마스터 파일을 선택하면 새 시트가 추가됩니다.</p>
                </div>
                <div className="auto-path-row">
                  <input readOnly value="C:/projects/master.xlsx" />
                  <button type="button" className="btn-soft" onClick={() => handleConfigAction('파일 선택')}>파일 선택</button>
                </div>
              </div>
              <div className="auto-inline-cards">
                <div className="auto-inline-card">
                  <strong>검증 상태</strong>
                  <p>금액 정보 부족</p>
                </div>
                <div className="auto-inline-card">
                  <strong>Config 버전</strong>
                  <p>{companyConfig.version || 'custom'}</p>
                </div>
                <div className="auto-inline-card">
                  <strong>마지막 저장</strong>
                  <p>방금 전</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
