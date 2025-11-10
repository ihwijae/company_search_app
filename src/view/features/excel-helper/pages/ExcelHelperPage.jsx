import React from 'react';
import '../../../../styles.css';
import '../../../../fonts.css';
import Sidebar from '../../../../components/Sidebar.jsx';
import { BASE_ROUTES, findMenuByKey } from '../../../../shared/navigation.js';
import { generateOne, validateAgreement } from '../../../../shared/agreements/generator.js';

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
  { value: 'all', label: '전체' },
  { value: 'eung', label: '전기' },
  { value: 'tongsin', label: '통신' },
  { value: 'sobang', label: '소방' },
];

const NAME_FIELDS = ['검색된 회사', '업체명', '회사명', 'name'];
const BIZ_FIELDS = ['사업자번호', 'bizNo', '사업자 번호'];
const SHARE_DEFAULT = '0';
const MANAGEMENT_FIELDS = ['경영상태점수', '경영점수', '관리점수', '경영상태 점수'];
const PERFORMANCE_FIELDS = ['5년 실적', '5년실적', '최근5년실적합계', '최근5년실적'];
const SIPYUNG_FIELDS = ['시평', '시평액', '시평금액', '시평액(원)', '시평금액(원)'];
const ABILITY_FIELDS = ['시공능력평가액', '시공능력평가', '시공능력 평가'];
const QUALITY_FIELDS = ['품질점수', '품질평가', '품질평가점수'];
const REGION_FIELDS = ['대표지역', '지역'];
const REPRESENTATIVE_FIELDS = ['대표자', '대표자명'];

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

const pickFirstValue = (company, keys) => {
  if (!company || !Array.isArray(keys)) return '';
  for (const key of keys) {
    if (!key) continue;
    if (!Object.prototype.hasOwnProperty.call(company, key)) continue;
    const value = company[key];
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' && !value.trim()) continue;
    return value;
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
  const text = String(value).trim();
  return text;
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

const sumShares = (items) => {
  return items.reduce((acc, item) => {
    const numeric = Number(String(item.share || '').replace(/[^0-9.+-]/g, ''));
    if (!Number.isFinite(numeric)) return acc;
    return acc + numeric;
  }, 0);
};

const buildAgreementPayload = (ownerToken, noticeNo, noticeTitle, leaderEntry, memberEntries) => {
  if (!leaderEntry) return null;
  return {
    owner: ownerToken,
    noticeNo,
    title: noticeTitle,
    leader: {
      name: leaderEntry.name,
      share: leaderEntry.share,
      bizNo: leaderEntry.bizNo,
    },
    members: memberEntries.map((item) => ({
      name: item.name,
      share: item.share,
      bizNo: item.bizNo,
    })),
  };
};

export default function ExcelHelperPage() {
  const [ownerId, setOwnerId] = React.useState('mois');
  const [rangeId, setRangeId] = React.useState(OWNER_OPTIONS[0].ranges[0].id);
  const [fileType, setFileType] = React.useState('all');
  const [selection, setSelection] = React.useState(null);
  const [selectionMessage, setSelectionMessage] = React.useState('');
  const [companyQuery, setCompanyQuery] = React.useState('');
  const [searchResults, setSearchResults] = React.useState([]);
  const [searchLoading, setSearchLoading] = React.useState(false);
  const [searchError, setSearchError] = React.useState('');
  const [selectedCompany, setSelectedCompany] = React.useState(null);
  const [shareInput, setShareInput] = React.useState(SHARE_DEFAULT);
  const [excelStatus, setExcelStatus] = React.useState('');
  const [appliedCompanies, setAppliedCompanies] = React.useState([]);
  const [leaderId, setLeaderId] = React.useState(null);
  const [noticeTitle, setNoticeTitle] = React.useState('');
  const [noticeNo, setNoticeNo] = React.useState('');
  const [messageStatus, setMessageStatus] = React.useState('');
  const [fileStatuses, setFileStatuses] = React.useState(null);

  React.useEffect(() => {
    let mounted = true;
    const loadStatuses = async () => {
      try {
        const status = await window.electronAPI?.checkFiles();
        if (mounted) setFileStatuses(status);
      } catch {
        /* ignore */
      }
    };
    loadStatuses();
    const interval = setInterval(loadStatuses, 120000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const activeOwner = OWNER_OPTIONS.find((o) => o.id === ownerId) || OWNER_OPTIONS[0];
  const availableRanges = activeOwner.ranges;

  React.useEffect(() => {
    if (!availableRanges.some((r) => r.id === rangeId)) {
      setRangeId(availableRanges[0]?.id || '');
    }
  }, [availableRanges, rangeId]);

  const selectedMetrics = React.useMemo(() => computeMetrics(selectedCompany), [selectedCompany]);

  React.useEffect(() => {
    setShareInput(SHARE_DEFAULT);
  }, [selectedCompany]);

  const handleSidebarSelect = React.useCallback((key) => {
    if (!key) return;
    if (key === 'search') { window.location.hash = BASE_ROUTES.search; return; }
    if (key === 'agreements') { window.location.hash = BASE_ROUTES.agreements; return; }
    if (key === 'settings') { window.location.hash = BASE_ROUTES.settings; return; }
    if (key === 'records') { window.location.hash = '#/records'; return; }
    if (key === 'mail') { window.location.hash = '#/mail'; return; }
    if (key === 'upload') { window.location.hash = '#/agreements'; return; }
    if (key === 'excel-helper') { window.location.hash = '#/excel-helper'; return; }
    const menu = findMenuByKey(key);
    if (menu) window.location.hash = menu.hash;
  }, []);

  const handleFetchSelection = async () => {
    setSelectionMessage('엑셀 선택 정보를 불러오는 중...');
    try {
      if (!window.electronAPI?.excelHelper) {
        throw new Error('Excel 연동 기능을 사용할 수 없습니다. (Windows 환경 필요)');
      }
      const response = await window.electronAPI.excelHelper.getSelection();
      if (!response?.success) throw new Error(response?.message || '선택 정보를 가져오지 못했습니다.');
      setSelection(response.data);
      setSelectionMessage(`기준 셀: ${response.data?.Worksheet || ''}!${response.data?.Address || ''}`);
    } catch (err) {
      setSelectionMessage(err.message || '엑셀 선택 정보 확인에 실패했습니다.');
    }
  };

  const handleSearch = async () => {
    if (!companyQuery.trim()) {
      setSearchError('업체명을 입력하세요.');
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
      setExcelStatus('엑셀에서 기준 셀을 먼저 지정해주세요.');
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
    const offsets = getOffsetsForOwner(ownerId);
    const updates = offsets
      .map((field) => {
        const source = field.key === 'share' ? shareValue : selectedMetrics[field.key];
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
        baseRow: selection.row,
        baseColumn: selection.column,
        updates,
      };
      const response = await window.electronAPI?.excelHelper?.applyOffsets(payload);
      if (!response?.success) throw new Error(response?.message || '엑셀 쓰기에 실패했습니다.');
      setExcelStatus('엑셀에 값이 반영되었습니다.');
      const newEntry = {
        id: crypto.randomUUID ? crypto.randomUUID() : `applied-${Date.now()}-${Math.random()}`,
        name: selectedMetrics.name,
        share: shareValue,
        bizNo: selectedMetrics.bizNo,
      };
      setAppliedCompanies((prev) => {
        const next = [...prev, newEntry];
        if (!leaderId && next.length > 0) setLeaderId(next[0].id);
        return next;
      });
    } catch (err) {
      setExcelStatus(err.message || '엑셀 쓰기에 실패했습니다.');
    }
  };

  const handleRemoveApplied = (id) => {
    setAppliedCompanies((prev) => {
      const next = prev.filter((item) => item.id !== id);
      if (leaderId === id) {
        setLeaderId(next[0]?.id || null);
      }
      return next;
    });
  };

  const handleShareChange = (id, value) => {
    setAppliedCompanies((prev) => prev.map((item) => (item.id === id ? { ...item, share: value } : item)));
  };

  const leaderEntry = React.useMemo(() => {
    if (!leaderId) return appliedCompanies[0] || null;
    return appliedCompanies.find((item) => item.id === leaderId) || appliedCompanies[0] || null;
  }, [leaderId, appliedCompanies]);

  const memberEntries = React.useMemo(() => {
    const leaderKey = leaderEntry?.id;
    return appliedCompanies.filter((item) => item.id !== leaderKey);
  }, [appliedCompanies, leaderEntry]);

  const agreementPayload = React.useMemo(() => (
    buildAgreementPayload(activeOwner.ownerToken, noticeNo, noticeTitle, leaderEntry, memberEntries)
  ), [activeOwner.ownerToken, noticeNo, noticeTitle, leaderEntry, memberEntries]);

  const validation = React.useMemo(() => (
    agreementPayload ? validateAgreement(agreementPayload) : null
  ), [agreementPayload]);

  const messagePreview = React.useMemo(() => {
    if (!agreementPayload) return '';
    try {
      return generateOne(agreementPayload);
    } catch {
      return '';
    }
  }, [agreementPayload]);

  const handleCopyMessage = async () => {
    if (!messagePreview) {
      setMessageStatus('생성된 문자가 없습니다.');
      return;
    }
    if (validation && !validation.ok) {
      setMessageStatus(validation.errors[0] || '필수 정보를 먼저 채워주세요.');
      return;
    }
    try {
      if (window.electronAPI?.clipboardWriteText) {
        const result = await window.electronAPI.clipboardWriteText(messagePreview);
        if (!result?.success) throw new Error(result?.message || '클립보드 복사 실패');
      } else if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(messagePreview);
      } else {
        throw new Error('클립보드를 사용할 수 없습니다.');
      }
      setMessageStatus('문자가 클립보드에 복사되었습니다.');
    } catch (err) {
      setMessageStatus(err.message || '클립보드 복사에 실패했습니다.');
    }
  };

  const shareSum = React.useMemo(() => sumShares(appliedCompanies), [appliedCompanies]);

  return (
    <div className="app-shell">
      <Sidebar
        active="excel-helper"
        onSelect={handleSidebarSelect}
        fileStatuses={fileStatuses}
        collapsed
      />
      <div className="main">
        <div className="title-drag" />
        <div className="topbar" />
        <div className="stage">
          <div className="content">
            <div className="panel" style={{ gridColumn: '1 / -1' }}>
              <h1 className="main-title" style={{ marginTop: 0 }}>엑셀 협정 도우미</h1>
              <p className="section-help">발주처·금액대를 선택하고, 엑셀 기준 셀과 업체 정보를 연동해 협정 수치를 자동으로 채웁니다.</p>
              <div className="helper-grid">
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
                  <label className="field-label">검색 파일</label>
                  <select className="input" value={fileType} onChange={(e) => setFileType(e.target.value)}>
                    {FILE_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="panel" style={{ gridColumn: '1 / -1' }}>
              <h2 style={{ marginTop: 0 }}>1. 엑셀 기준 셀 지정</h2>
              <p style={{ color: '#6b7280', marginBottom: 12 }}>엑셀에서 업체명이 입력될 셀을 선택한 뒤 아래 버튼을 눌러 현재 선택을 불러오세요.</p>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <button type="button" className="primary" onClick={handleFetchSelection}>선택 셀 동기화</button>
                {selection && (
                  <div className="pill">{selection?.Worksheet || ''}!{selection?.Address || ''}</div>
                )}
                {selectionMessage && <span style={{ color: '#374151' }}>{selectionMessage}</span>}
              </div>
            </div>

            <div className="panel" style={{ gridColumn: '1 / -1' }}>
              <h2 style={{ marginTop: 0 }}>2. 업체 검색</h2>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
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
              {searchError && <div className="error-message" style={{ marginBottom: 16 }}>{searchError}</div>}
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
                      return (
                        <tr key={idx} className={isActive ? 'row-active' : ''}>
                          <td>{metrics?.name || ''}</td>
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
            </div>

            <div className="panel" style={{ gridColumn: '1 / -1' }}>
              <h2 style={{ marginTop: 0 }}>3. 선택된 업체 상세</h2>
              {selectedMetrics ? (
                <div className="company-details-card">
                  <div>
                    <div className="detail-label">업체명</div>
                    <div className="detail-value">{selectedMetrics.name || '-'}</div>
                  </div>
                  <div>
                    <div className="detail-label">사업자번호</div>
                    <div className="detail-value">{selectedMetrics.bizNo || '-'}</div>
                  </div>
                  <div>
                    <div className="detail-label">경영상태점수</div>
                    <div className="detail-value">{selectedMetrics.managementDisplay || '-'}</div>
                  </div>
                  <div>
                    <div className="detail-label">실적액</div>
                    <div className="detail-value">{selectedMetrics.performanceDisplay || '-'}</div>
                  </div>
                  <div>
                    <div className="detail-label">시평액</div>
                    <div className="detail-value">{selectedMetrics.sipyungDisplay || '-'}</div>
                  </div>
                  {ownerId === 'lh' && (
                    <>
                      <div>
                        <div className="detail-label">품질점수</div>
                        <div className="detail-value">{selectedMetrics.qualityDisplay || '-'}</div>
                      </div>
                      <div>
                        <div className="detail-label">시공능력평가액</div>
                        <div className="detail-value">{selectedMetrics.abilityDisplay || '-'}</div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div style={{ color: '#9ca3af' }}>업체를 선택하면 상세 정보가 표시됩니다.</div>
              )}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 16 }}>
                <label className="field-label" style={{ marginBottom: 0 }}>지분 (%)</label>
                <input
                  className="input"
                  value={shareInput}
                  onChange={(e) => setShareInput(e.target.value)}
                  style={{ maxWidth: 120 }}
                  placeholder="예: 40"
                />
                <button type="button" className="primary" onClick={handleApplyToExcel}>엑셀에 채우기</button>
                {excelStatus && <span style={{ color: '#2563eb' }}>{excelStatus}</span>}
              </div>
            </div>

            <div className="panel" style={{ gridColumn: '1 / -1' }}>
              <h2 style={{ marginTop: 0 }}>4. 협정 문자 준비</h2>
              <div className="helper-grid">
                <div>
                  <label className="field-label">공고명</label>
                  <input className="input" value={noticeTitle} onChange={(e) => setNoticeTitle(e.target.value)} placeholder="예: OOO 공사" />
                </div>
                <div>
                  <label className="field-label">공고번호</label>
                  <input className="input" value={noticeNo} onChange={(e) => setNoticeNo(e.target.value)} placeholder="예: 2024-0000" />
                </div>
                <div>
                  <label className="field-label">발주처</label>
                  <input className="input" value={activeOwner.label} disabled readOnly />
                </div>
              </div>

              <div className="table-scroll" style={{ marginTop: 16 }}>
                <table className="details-table">
                  <thead>
                    <tr>
                      <th style={{ width: '28%' }}>업체명</th>
                      <th style={{ width: '16%' }}>지분(%)</th>
                      <th style={{ width: '20%' }}>사업자번호</th>
                      <th style={{ width: '16%' }}>역할</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {appliedCompanies.map((item) => (
                      <tr key={item.id}>
                        <td>{item.name}</td>
                        <td>
                          <input
                            className="input"
                            value={item.share}
                            onChange={(e) => handleShareChange(item.id, e.target.value)}
                            style={{ width: '90%' }}
                          />
                        </td>
                        <td>{item.bizNo || '-'}</td>
                        <td>
                          <button
                            type="button"
                            className={leaderEntry?.id === item.id ? 'btn-chip active small' : 'btn-chip small'}
                            onClick={() => setLeaderId(item.id)}
                          >
                            {leaderEntry?.id === item.id ? '대표사' : '대표사 지정'}
                          </button>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button type="button" className="btn-sm" onClick={() => handleRemoveApplied(item.id)}>삭제</button>
                        </td>
                      </tr>
                    ))}
                    {appliedCompanies.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: 16, color: '#9ca3af' }}>
                          아직 추가된 업체가 없습니다. 엑셀에 채우기를 실행하면 자동으로 목록에 추가됩니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 8, color: shareSum === 100 ? '#059669' : '#b45309' }}>
                지분 합계: {shareSum.toLocaleString()}%
              </div>
            </div>

            <div className="panel" style={{ gridColumn: '1 / -1' }}>
              <h2 style={{ marginTop: 0 }}>5. 협정 문자 생성</h2>
              {validation && !validation.ok && (
                <div className="error-message" style={{ marginBottom: 12 }}>
                  {validation.errors.join(', ')}
                </div>
              )}
              <textarea
                className="input"
                style={{ minHeight: 160, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}
                value={messagePreview}
                readOnly
              />
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 12 }}>
                <button type="button" className="primary" onClick={handleCopyMessage} disabled={!messagePreview}>문자 내용 복사</button>
                {messageStatus && <span style={{ color: '#2563eb' }}>{messageStatus}</span>}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
