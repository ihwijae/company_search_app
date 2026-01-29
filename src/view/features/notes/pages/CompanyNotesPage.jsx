import React from 'react';
import '../../../../styles.css';
import '../../../../fonts.css';
import Sidebar from '../../../../components/Sidebar';
import CompanySearchModal from '../../../../components/CompanySearchModal.jsx';
import { extractManagerNames } from '../../../../utils/companyIndicators.js';
import { loadPersisted, savePersisted } from '../../../../shared/persistence.js';
import { useFeedback } from '../../../../components/FeedbackProvider.jsx';

const INDUSTRY_OPTIONS = [
  { value: 'eung', label: '전기' },
  { value: 'tongsin', label: '통신' },
  { value: 'sobang', label: '소방' },
];
const FILTER_INDUSTRY_OPTIONS = [
  { value: 'all', label: '전체' },
  ...INDUSTRY_OPTIONS,
];

const SOLO_OPTIONS = [
  { value: 'none', label: '없음' },
  { value: 'exclude', label: '단독제외' },
  { value: 'allow', label: '단독이여도가능' },
];
const INQUIRY_OPTIONS = [
  { value: 'none', label: '없음' },
  { value: 'ask', label: '물어보고 사용' },
  { value: 'free', label: '안물어보고 사용가능' },
];

const DEFAULT_FILTERS = { industry: 'all', region: '전체', name: '', bizNo: '', ownerOnly: false, commonOnly: false };
const STORAGE_KEY = 'company-notes:data';

const normalizeText = (value) => String(value || '').trim().toLowerCase();
const normalizeDigits = (value) => String(value || '').replace(/[^0-9]/g, '');
const normalizeIndustryValue = (value) => {
  const token = String(value || '').trim();
  if (!token) return 'eung';
  const direct = INDUSTRY_OPTIONS.find((option) => option.value === token);
  if (direct) return direct.value;
  const byLabel = INDUSTRY_OPTIONS.find((option) => option.label === token);
  return byLabel ? byLabel.value : 'eung';
};

const getSoloLabel = (value) => (
  SOLO_OPTIONS.find((option) => option.value === value)?.label || '없음'
);

const getSoloClassName = (value) => {
  if (value === 'exclude') return 'notes-badge notes-badge-exclude';
  if (value === 'allow') return 'notes-badge notes-badge-allow';
  return 'notes-badge notes-badge-none';
};

const getInquiryLabel = (value) => (
  INQUIRY_OPTIONS.find((option) => option.value === value)?.label || '없음'
);

const getInquiryClassName = (value) => {
  if (value === 'ask') return 'notes-badge notes-badge-ask';
  if (value === 'free') return 'notes-badge notes-badge-free';
  return 'notes-badge notes-badge-none';
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}.${mm}.${dd} ${hh}:${min}`;
};

const normalizeIndustryLabel = (value) => (
  INDUSTRY_OPTIONS.find((option) => option.value === normalizeIndustryValue(value))?.label || '전기'
);

const normalizeNoteItem = (item) => {
  if (!item || typeof item !== 'object') return null;
  const name = String(item.name || '').trim();
  if (!name) return null;
  const now = Date.now();
  return {
    id: item.id || `note-${now}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    industry: normalizeIndustryLabel(item.industry || item.industryLabel || item.fileType || 'eung'),
    region: String(item.region || '').trim(),
    bizNo: String(item.bizNo || '').trim(),
    soloStatus: SOLO_OPTIONS.some((opt) => opt.value === item.soloStatus) ? item.soloStatus : 'none',
    memo: String(item.memo || '').trim(),
    inquiryStatus: INQUIRY_OPTIONS.some((opt) => opt.value === item.inquiryStatus) ? item.inquiryStatus : 'none',
    ownerManaged: Boolean(item.ownerManaged),
    isCommon: Boolean(item.isCommon),
    managerNames: Array.isArray(item.managerNames) ? item.managerNames.filter(Boolean) : [],
    createdAt: item.createdAt || now,
    updatedAt: item.updatedAt || now,
  };
};

const stripCommonLines = (memo) => String(memo || '')
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('공통:'))
  .join('\n')
  .trim();

export default function CompanyNotesPage() {
  const [activeMenu, setActiveMenu] = React.useState('company-notes');
  const { confirm, notify, showLoading, hideLoading } = useFeedback();
  const [draftFilters, setDraftFilters] = React.useState(DEFAULT_FILTERS);
  const [filters, setFilters] = React.useState(DEFAULT_FILTERS);
  const [regionOptions, setRegionOptions] = React.useState(['전체']);
  const [rows, setRows] = React.useState([]);
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editorMode, setEditorMode] = React.useState('create');
  const [editorForm, setEditorForm] = React.useState({
    name: '',
    industry: 'eung',
    region: '',
    bizNo: '',
    soloStatus: 'none',
    memo: '',
    inquiryStatus: 'none',
    ownerManaged: false,
    isCommon: false,
    managerNames: [],
  });
  const [companyPickerOpen, setCompanyPickerOpen] = React.useState(false);
  const [lastEditorDefaults, setLastEditorDefaults] = React.useState({
    industry: 'eung',
    region: '',
  });
  const [ownerCommonModalOpen, setOwnerCommonModalOpen] = React.useState(false);
  const [ownerCommonMemo, setOwnerCommonMemo] = React.useState('');
  const [ownerCommonDraft, setOwnerCommonDraft] = React.useState('');
  const [commonOpenIds, setCommonOpenIds] = React.useState(() => new Set());
  const saveTimerRef = React.useRef(null);

  React.useEffect(() => {
    let mounted = true;
    const fetchRegions = async () => {
      if (!window?.electronAPI?.getRegions) return;
      try {
        const result = await window.electronAPI.getRegions(draftFilters.industry);
        const regions = Array.isArray(result?.data) ? result.data : [];
        if (!mounted) return;
        const unique = Array.from(
          new Set(
            regions
              .map((name) => String(name || '').trim())
              .filter((name) => name && name !== '전체')
          )
        );
        setRegionOptions(['전체', ...unique]);
      } catch {
        if (mounted) setRegionOptions(['전체']);
      }
    };
    fetchRegions();
    return () => { mounted = false; };
  }, [draftFilters.industry]);

  React.useEffect(() => {
    const stored = loadPersisted(STORAGE_KEY, null);
    if (Array.isArray(stored)) {
      const normalized = stored.map(normalizeNoteItem).filter(Boolean);
      setRows(normalized);
      return;
    }
    if (stored && typeof stored === 'object') {
      if (Array.isArray(stored.items)) {
        const normalized = stored.items.map(normalizeNoteItem).filter(Boolean);
        setRows(normalized);
      }
      if (typeof stored.ownerCommonMemo === 'string') {
        setOwnerCommonMemo(stored.ownerCommonMemo);
      }
    }
  }, []);

  React.useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      savePersisted(STORAGE_KEY, { version: 1, updatedAt: Date.now(), items: rows, ownerCommonMemo });
    }, 300);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [rows, ownerCommonMemo]);

  const filteredRows = React.useMemo(() => {
    const nameKey = normalizeText(filters.name);
    const bizKey = normalizeDigits(filters.bizNo);
    const hasKeyword = !!(nameKey || bizKey);
    const filtered = rows.filter((row) => {
      if (filters.industry !== 'all' && row.industry !== INDUSTRY_OPTIONS.find((i) => i.value === filters.industry)?.label) {
        return false;
      }
      if (!hasKeyword && filters.commonOnly && !row.isCommon) {
        return false;
      }
      if (filters.region && filters.region !== '전체' && !row.isCommon && row.region !== filters.region) {
        return false;
      }
      if (filters.ownerOnly && !row.ownerManaged) {
        return false;
      }
      if (nameKey && !normalizeText(row.name).includes(nameKey)) {
        return false;
      }
      if (bizKey && !normalizeDigits(row.bizNo).includes(bizKey)) {
        return false;
      }
      return true;
    });
    const sorted = [...filtered].sort((a, b) => {
      const aOwner = a.ownerManaged ? 1 : 0;
      const bOwner = b.ownerManaged ? 1 : 0;
      if (aOwner !== bOwner) return bOwner - aOwner;
      const aTime = a.updatedAt || a.createdAt || 0;
      const bTime = b.updatedAt || b.createdAt || 0;
      return bTime - aTime;
    });
    return sorted;
  }, [filters, rows]);

  const editorRegionOptions = React.useMemo(() => {
    const base = (regionOptions || []).filter((region) => region && region !== '전체');
    const current = String(editorForm.region || '').trim();
    if (current && !base.includes(current)) {
      return [current, ...base];
    }
    return base;
  }, [regionOptions, editorForm.region]);

  const handleFilterChange = (field) => (event) => {
    setDraftFilters((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const applyFilters = () => {
    setFilters((prev) => ({ ...prev, ...draftFilters }));
  };

  const resetFilters = () => {
    setDraftFilters(DEFAULT_FILTERS);
    setFilters(DEFAULT_FILTERS);
  };

  const openCreate = () => {
    setEditorMode('create');
    setEditorForm({
      name: '',
      industry: normalizeIndustryValue(lastEditorDefaults.industry || draftFilters.industry),
      region: lastEditorDefaults.region || '',
      bizNo: '',
      soloStatus: 'none',
      memo: '',
      inquiryStatus: 'none',
      ownerManaged: false,
      isCommon: false,
      managerNames: [],
    });
    setEditorOpen(true);
  };

  const openEdit = (row) => {
    setEditorMode('edit');
    setEditorForm({
      name: row.name || '',
      industry: normalizeIndustryValue(row.industry),
      region: row.region || '',
      bizNo: row.bizNo || '',
      soloStatus: row.soloStatus || 'none',
      memo: row.memo || '',
      inquiryStatus: row.inquiryStatus || 'none',
      ownerManaged: Boolean(row.ownerManaged),
      isCommon: Boolean(row.isCommon),
      managerNames: Array.isArray(row.managerNames) ? row.managerNames : [],
      id: row.id,
    });
    setEditorOpen(true);
  };

  const handleSave = () => {
    if (!editorForm.name) {
      setEditorOpen(true);
      return;
    }
    const industryLabel = INDUSTRY_OPTIONS.find((option) => option.value === editorForm.industry)?.label || '전기';
    const now = Date.now();
    setLastEditorDefaults({
      industry: editorForm.industry,
      region: editorForm.region,
    });

    if (editorMode === 'create') {
      const next = {
        id: `note-${now}-${Math.random().toString(36).slice(2, 7)}`,
        name: editorForm.name,
        industry: industryLabel,
        region: editorForm.isCommon ? '' : editorForm.region,
        bizNo: editorForm.bizNo,
        soloStatus: editorForm.soloStatus,
        memo: editorForm.memo,
        inquiryStatus: editorForm.inquiryStatus,
        ownerManaged: Boolean(editorForm.ownerManaged),
        isCommon: Boolean(editorForm.isCommon),
        managerNames: Array.isArray(editorForm.managerNames) ? editorForm.managerNames : [],
        createdAt: now,
        updatedAt: now,
      };
      setRows((prev) => [next, ...prev]);
      notify({ type: 'success', message: '특이사항을 등록했습니다.' });
    } else {
      setRows((prev) => prev.map((row) => (
        row.id === editorForm.id
          ? {
            ...row,
            name: editorForm.name,
            industry: industryLabel,
            region: editorForm.isCommon ? '' : editorForm.region,
            bizNo: editorForm.bizNo,
            soloStatus: editorForm.soloStatus,
            memo: editorForm.memo,
            inquiryStatus: editorForm.inquiryStatus,
            ownerManaged: Boolean(editorForm.ownerManaged),
            isCommon: Boolean(editorForm.isCommon),
            managerNames: Array.isArray(editorForm.managerNames) ? editorForm.managerNames : [],
            updatedAt: now,
          }
          : row
      )));
      notify({ type: 'success', message: '특이사항을 수정했습니다.' });
    }
    setEditorOpen(false);
  };

  const handleDelete = async (rowId) => {
    if (!rowId) return;
    const ok = await confirm({
      title: '특이사항 삭제',
      message: '해당 특이사항을 삭제할까요?',
      confirmText: '삭제',
      cancelText: '취소',
      tone: 'warning',
    });
    if (!ok) return;
    setRows((prev) => prev.filter((row) => row.id !== rowId));
  };

  const openOwnerCommonModal = () => {
    setOwnerCommonDraft(ownerCommonMemo || '');
    setOwnerCommonModalOpen(true);
  };

  const applyOwnerCommonMemo = () => {
    const nextText = String(ownerCommonDraft || '').trim();
    const prevText = String(ownerCommonMemo || '').trim();
    setRows((prev) => prev.map((row) => (
      row.ownerManaged ? { ...row, memo: stripCommonLines(row.memo) } : row
    )));
    setOwnerCommonMemo(nextText);
    setOwnerCommonModalOpen(false);
    setCommonOpenIds(new Set());
    if (!nextText && prevText) {
      notify({ type: 'success', message: '대표님업체 공통 문구를 삭제했습니다.' });
      return;
    }
    notify({ type: 'success', message: '대표님업체 공통 문구를 적용했습니다.' });
  };

  const handleCompanyPick = (payload) => {
    const name = payload?.name || payload?.snapshot?.['업체명'] || payload?.snapshot?.['회사명'] || '';
    const bizNo = payload?.bizNo || payload?.snapshot?.['사업자번호'] || '';
    const region = payload?.snapshot?.['대표지역'] || payload?.snapshot?.['지역'] || '';
    const managerNames = extractManagerNames(payload?.snapshot || {});
    setEditorForm((prev) => ({
      ...prev,
      name,
      bizNo,
      region,
      industry: normalizeIndustryValue(payload?.fileType || prev.industry),
      managerNames,
    }));
    setCompanyPickerOpen(false);
  };

  const refreshManagerBadges = async () => {
    if (!window?.electronAPI?.searchCompanies) {
      notify({ type: 'error', message: '업체 조회 기능을 사용할 수 없습니다.' });
      return;
    }
    const targets = rows;
    if (targets.length === 0) {
      notify({ type: 'info', message: '갱신할 항목이 없습니다.' });
      return;
    }
    showLoading({ title: '담당자 배지 갱신 중', message: '업체 DB를 확인하고 있습니다.' });
    let updatedCount = 0;
    try {
      const updatedRows = [...rows];
      for (let i = 0; i < targets.length; i += 1) {
        const row = targets[i];
        const name = String(row.name || '').trim();
        if (!name) continue;
        const typeKey = normalizeIndustryValue(row.industry);
        try {
          const result = await window.electronAPI.searchCompanies({ name }, typeKey);
          if (!result?.success || !Array.isArray(result.data)) continue;
          let picked = result.data[0];
          const bizKey = normalizeDigits(row.bizNo);
          if (bizKey) {
            const matched = result.data.find((item) => normalizeDigits(item?.['사업자번호']) === bizKey);
            if (matched) picked = matched;
          }
          const managers = extractManagerNames(picked || {});
          const index = updatedRows.findIndex((item) => item.id === row.id);
          if (index >= 0) {
            const prevManagers = Array.isArray(updatedRows[index].managerNames) ? updatedRows[index].managerNames : [];
            const nextManagers = managers.length > 0 ? managers : prevManagers;
            const changed = JSON.stringify(prevManagers) !== JSON.stringify(nextManagers);
            if (changed) {
              updatedRows[index] = { ...updatedRows[index], managerNames: nextManagers };
              updatedCount += 1;
            }
          }
        } catch {}
      }
      if (updatedCount > 0) {
        setRows(updatedRows);
        notify({ type: 'success', message: `담당자 배지 ${updatedCount}건을 갱신했습니다.` });
      } else {
        notify({ type: 'info', message: '갱신할 자료가 없습니다.' });
      }
    } finally {
      hideLoading();
    }
  };

  const handleExport = async () => {
    if (!window?.electronAPI?.companyNotesExport) {
      notify({ type: 'error', message: '내보내기 기능을 사용할 수 없습니다.' });
      return;
    }
    try {
      const payload = { version: 1, exportedAt: Date.now(), items: rows, ownerCommonMemo };
      const result = await window.electronAPI.companyNotesExport(payload);
      if (!result?.success) throw new Error(result?.message || '내보내기 실패');
      notify({ type: 'success', message: '업체 특이사항을 내보냈습니다.' });
    } catch (err) {
      notify({ type: 'error', message: err?.message || '내보내기에 실패했습니다.' });
    }
  };

  const handleImport = async () => {
    if (!window?.electronAPI?.companyNotesImport) {
      notify({ type: 'error', message: '가져오기 기능을 사용할 수 없습니다.' });
      return;
    }
    const ok = await confirm({
      title: '가져오기 확인',
      message: '가져오기를 실행하면 현재 특이사항이 덮어써집니다. 계속할까요?',
      confirmText: '확인',
      cancelText: '취소',
      tone: 'warning',
    });
    if (!ok) return;
    try {
      const result = await window.electronAPI.companyNotesImport();
      if (!result?.success) throw new Error(result?.message || '가져오기 실패');
      const items = Array.isArray(result?.data?.items) ? result.data.items : result?.data;
      if (!Array.isArray(items)) throw new Error('가져온 데이터 형식이 올바르지 않습니다.');
      const normalized = items.map(normalizeNoteItem).filter(Boolean);
      setRows(normalized);
      if (typeof result?.data?.ownerCommonMemo === 'string') {
        setOwnerCommonMemo(result.data.ownerCommonMemo);
      }
      notify({ type: 'success', message: '업체 특이사항을 가져왔습니다.' });
    } catch (err) {
      notify({ type: 'error', message: err?.message || '가져오기에 실패했습니다.' });
    }
  };

  const openCompanyPicker = () => {
    setEditorForm((prev) => ({
      ...prev,
      industry: normalizeIndustryValue(prev.industry || draftFilters.industry || filters.industry),
    }));
    setCompanyPickerOpen(true);
  };

  const handleMenuSelect = (key) => {
    setActiveMenu(key);
    if (key === 'upload') return;
    if (key === 'agreements') window.location.hash = '#/agreement-board';
    if (key === 'region-search') window.location.hash = '#/region-search';
    if (key === 'agreements-sms') window.location.hash = '#/agreements';
    if (key === 'auto-agreement') { window.location.hash = '#/auto-agreement'; return; }
    if (key === 'records') window.location.hash = '#/records';
    if (key === 'mail') window.location.hash = '#/mail';
    if (key === 'excel-helper') { window.location.hash = '#/excel-helper'; return; }
    if (key === 'bid-result') { window.location.hash = '#/bid-result'; return; }
    if (key === 'kakao-send') { window.location.hash = '#/kakao-send'; return; }
    if (key === 'company-notes') { window.location.hash = '#/company-notes'; return; }
    if (key === 'search') window.location.hash = '#/search';
    if (key === 'settings') window.location.hash = '#/settings';
  };

  return (
    <div className="app-shell">
      <Sidebar active={activeMenu} onSelect={handleMenuSelect} collapsed={true} />
      <div className="main">
        <div className="title-drag" />
        <div className="topbar" />
        <div className="stage company-notes-stage">
          <div className="company-notes-shell">
            <div className="company-notes-header">
              <div>
                <h2>업체별 특이사항</h2>
                <p>업체 특이사항을 빠르게 등록하고 조회하세요.</p>
              </div>
              <div className="company-notes-actions">
                <button type="button" className="btn-soft" onClick={openCreate}>특이사항 등록</button>
                <button type="button" className="btn-muted" onClick={refreshManagerBadges}>담당자 배지 갱신</button>
                <button type="button" className="btn-muted" onClick={handleImport}>가져오기</button>
                <button type="button" className="btn-muted" onClick={handleExport}>내보내기</button>
              </div>
            </div>

            <div className="company-notes-filters">
              <div className="filter-grid">
                <div className="filter-item">
                  <label>공종</label>
                  <select value={draftFilters.industry} onChange={handleFilterChange('industry')} className="filter-input">
                    {FILTER_INDUSTRY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div className="filter-item">
                  <label>지역</label>
                  <select value={draftFilters.region} onChange={handleFilterChange('region')} className="filter-input">
                    {regionOptions.map((region) => (
                      <option key={region} value={region}>{region}</option>
                    ))}
                  </select>
                </div>
                <div className="filter-item">
                  <label>업체명</label>
                  <input
                    type="text"
                    value={draftFilters.name}
                    onChange={handleFilterChange('name')}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyFilters(); } }}
                    className="filter-input"
                    placeholder="업체명을 입력하세요"
                  />
                </div>
                <div className="filter-item">
                  <label>사업자번호</label>
                  <input
                    type="text"
                    value={draftFilters.bizNo}
                    onChange={handleFilterChange('bizNo')}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyFilters(); } }}
                    className="filter-input"
                    placeholder="사업자번호 입력"
                  />
                </div>
                <div className="filter-item">
                  <label>대표님업체</label>
                  <label className={`notes-owner-filter ${draftFilters.ownerOnly ? 'active' : ''}`}>
                    <input
                      type="checkbox"
                      checked={draftFilters.ownerOnly}
                      onChange={(e) => {
                        const next = e.target.checked;
                        setDraftFilters((prev) => ({ ...prev, ownerOnly: next }));
                        setFilters((prev) => ({ ...prev, ownerOnly: next }));
                      }}
                    />
                    대표님업체만 보기
                  </label>
                </div>
                <div className="filter-item">
                  <label>기타</label>
                  <label className={`notes-owner-filter ${draftFilters.commonOnly ? 'active' : ''}`}>
                    <input
                      type="checkbox"
                      checked={draftFilters.commonOnly}
                      onChange={(e) => {
                        const next = e.target.checked;
                        setDraftFilters((prev) => ({ ...prev, commonOnly: next }));
                        setFilters((prev) => ({ ...prev, commonOnly: next }));
                      }}
                    />
                    기타만 보기
                  </label>
                </div>
                <div className="filter-item">
                  <label>&nbsp;</label>
                  <button type="button" className="search-button" onClick={applyFilters}>검색</button>
                </div>
                <div className="filter-item">
                  <label>&nbsp;</label>
                  <button type="button" className="reset-button" onClick={resetFilters}>필터 초기화</button>
                </div>
                <div className="filter-item">
                  <label>&nbsp;</label>
                <button type="button" className="btn-soft" onClick={openOwnerCommonModal}>대표님업체 공통사항</button>
                </div>
              </div>
            </div>

            <div className="company-notes-table">
              <div className="table-wrap">
                <table className="details-table">
                  <thead>
                    <tr>
                      <th style={{ width: '20%' }}>업체명</th>
                      <th style={{ width: '8%' }}>공종</th>
                      <th style={{ width: '8%' }}>지역</th>
                      <th style={{ width: '18%' }}>사업자번호</th>
                      <th style={{ width: '12%' }}>단독</th>
                      <th>특이사항</th>
                      <th style={{ width: '10%' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => (
                      <tr key={row.id} className={row.ownerManaged ? 'notes-row-owner' : ''}>
                        <td className="notes-name-td">
                          <div className="notes-name-cell">
                            <span>{row.name}</span>
                            {row.ownerManaged && <span className="notes-owner-badge">대표님업체</span>}
                          </div>
                          {Array.isArray(row.managerNames) && row.managerNames.length > 0 && (
                            <div className="notes-manager-badges">
                              {row.managerNames.map((manager) => (
                                <span key={`${row.id}-${manager}`} className="badge-person">{manager}</span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className={`notes-industry notes-industry-${String(row.industry || '').trim()}`}>
                            {row.industry}
                          </span>
                        </td>
                        <td className="notes-region-cell">
                          {row.isCommon ? <span className="notes-region-common">기타</span> : row.region}
                        </td>
                        <td>{row.bizNo}</td>
                        <td>
                          <span className={getSoloClassName(row.soloStatus)}>{getSoloLabel(row.soloStatus)}</span>
                        </td>
                        <td>
                          <div className="notes-memo">
                            {row.inquiryStatus !== 'none' && (
                              <span className={getInquiryClassName(row.inquiryStatus)}>
                                {getInquiryLabel(row.inquiryStatus)}
                              </span>
                            )}
                            {row.ownerManaged && ownerCommonMemo && (
                              <button
                                type="button"
                                className="notes-common-badge"
                                onClick={() => {
                                  setCommonOpenIds((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(row.id)) next.delete(row.id);
                                    else next.add(row.id);
                                    return next;
                                  });
                                }}
                              >
                                공통
                              </button>
                            )}
                            <span>{stripCommonLines(row.memo)}</span>
                            {row.ownerManaged && ownerCommonMemo && commonOpenIds.has(row.id) && (
                              <div className="notes-common-text">{ownerCommonMemo}</div>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="details-actions">
                            <button type="button" className="btn-sm btn-soft" onClick={() => openEdit(row)}>수정</button>
                            <button type="button" className="btn-sm btn-danger" onClick={() => handleDelete(row.id)}>삭제</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredRows.length === 0 && (
                     <tr>
                        <td colSpan={7} className="notes-empty">등록된 특이사항이 없습니다.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {editorOpen && (
        <div className="notes-modal-backdrop">
          <div className="notes-modal" onClick={(e) => e.stopPropagation()}>
            <div className="notes-editor-header">
              <div className="notes-editor-title">
                <span className="notes-editor-badge">특이사항</span>
                <div>
                  <h3>{editorMode === 'create' ? '특이사항 등록' : '특이사항 수정'}</h3>
                  <p>업체별 단독 상태와 메모를 관리합니다.</p>
                </div>
              </div>
              <button type="button" className="btn-muted btn-sm" onClick={() => setEditorOpen(false)}>닫기</button>
            </div>
            <div className="notes-editor-body">
              <div className="notes-editor-card">
                <div className="notes-editor-card-title">업체 기본정보</div>
                <div className="grid-2">
                  <div className="filter-item">
                    <label>공종</label>
                    <select
                      value={editorForm.industry}
                      onChange={(e) => setEditorForm((prev) => ({ ...prev, industry: e.target.value }))}
                      className="filter-input"
                    >
                      {INDUSTRY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                <div className="filter-item">
                  <label>지역</label>
                  <select
                    value={editorForm.region}
                    onChange={(e) => setEditorForm((prev) => ({ ...prev, region: e.target.value }))}
                    className="filter-input"
                    disabled={editorForm.isCommon}
                  >
                    <option value="">지역 선택</option>
                    {editorRegionOptions.map((region) => (
                      <option key={region} value={region}>{region}</option>
                    ))}
                  </select>
                </div>
                  <div className="filter-item">
                    <label>업체명</label>
                    <div className="notes-input-inline">
                      <input
                        type="text"
                        value={editorForm.name}
                        onChange={(e) => setEditorForm((prev) => ({ ...prev, name: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            openCompanyPicker();
                          }
                        }}
                        className="filter-input"
                        placeholder="업체명 입력"
                      />
                      <button type="button" className="btn-soft btn-sm" onClick={openCompanyPicker}>업체 조회</button>
                    </div>
                  </div>
                  <div className="filter-item">
                    <label>사업자번호</label>
                    <input
                      type="text"
                      value={editorForm.bizNo}
                      onChange={(e) => setEditorForm((prev) => ({ ...prev, bizNo: e.target.value }))}
                      className="filter-input"
                      placeholder="사업자번호 입력"
                    />
                  </div>
                </div>
                <div className="notes-common-toggle">
                  <label className="notes-common-label">기타 등록</label>
                  <label className="notes-common-check">
                    <input
                      type="checkbox"
                      checked={editorForm.isCommon}
                      onChange={(e) => setEditorForm((prev) => ({ ...prev, isCommon: e.target.checked }))}
                    />
                    <span>기타로 등록</span>
                  </label>
                </div>
              </div>

              <div className="notes-editor-card">
                <div className="notes-editor-card-title">단독 상태</div>
                <div className="notes-solo-options">
                  {SOLO_OPTIONS.map((option) => (
                    <label key={option.value} className={`notes-radio ${editorForm.soloStatus === option.value ? 'active' : ''}`}>
                      <input
                        type="radio"
                        name="soloStatus"
                        value={option.value}
                        checked={editorForm.soloStatus === option.value}
                        onChange={(e) => setEditorForm((prev) => ({ ...prev, soloStatus: e.target.value }))}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
                <div className="notes-owner-toggle">
                  <label className={`notes-owner-chip ${editorForm.ownerManaged ? 'active' : ''}`}>
                    <input
                      type="checkbox"
                      checked={editorForm.ownerManaged}
                      onChange={(e) => setEditorForm((prev) => ({ ...prev, ownerManaged: e.target.checked }))}
                    />
                    대표님업체
                  </label>
                  <span className="notes-owner-help">대표님이 관리하는 업체는 강조 표시됩니다.</span>
                </div>
              </div>

              <div className="notes-editor-card">
                <div className="notes-editor-card-title">여부묻기</div>
                <div className="notes-solo-options">
                  {INQUIRY_OPTIONS.filter((option) => option.value !== 'none').map((option) => (
                    <label key={option.value} className={`notes-radio ${editorForm.inquiryStatus === option.value ? 'active' : ''}`}>
                      <input
                        type="radio"
                        name="inquiryStatus"
                        value={option.value}
                        checked={editorForm.inquiryStatus === option.value}
                        onChange={(e) => setEditorForm((prev) => ({ ...prev, inquiryStatus: e.target.value }))}
                      />
                      {option.label}
                    </label>
                  ))}
                  <label className={`notes-radio ${editorForm.inquiryStatus === 'none' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="inquiryStatus"
                      value="none"
                      checked={editorForm.inquiryStatus === 'none'}
                      onChange={(e) => setEditorForm((prev) => ({ ...prev, inquiryStatus: e.target.value }))}
                    />
                    없음
                  </label>
                </div>
              </div>

              <div className="notes-editor-card">
                <div className="notes-editor-card-title">특이사항</div>
                <textarea
                  className="notes-textarea"
                  rows={4}
                  value={editorForm.memo}
                  onChange={(e) => setEditorForm((prev) => ({ ...prev, memo: e.target.value }))}
                  placeholder="업체 특이사항을 입력하세요"
                />
              </div>
            </div>
            <div className="notes-editor-actions">
              <button type="button" className="btn-muted" onClick={() => setEditorOpen(false)}>취소</button>
              <button type="button" className="primary" onClick={handleSave}>저장</button>
            </div>
          </div>
        </div>
      )}

      <CompanySearchModal
        open={companyPickerOpen}
        fileType={normalizeIndustryValue(editorForm.industry)}
        initialQuery={editorForm.name}
        onClose={() => setCompanyPickerOpen(false)}
        onPick={handleCompanyPick}
        allowAll={false}
      />

      {ownerCommonModalOpen && (
        <div className="owner-common-backdrop">
          <div className="owner-common-modal">
            <div className="owner-common-header">
              <div>
                <h3>대표님업체 공통 사항</h3>
                <p>대표님업체 전체에 공통 문구를 추가하거나 삭제합니다.</p>
              </div>
              <button type="button" className="btn-muted btn-sm" onClick={() => setOwnerCommonModalOpen(false)}>닫기</button>
            </div>
            <div className="owner-common-body">
              <label>공통 문구</label>
              <textarea
                className="owner-common-textarea"
                rows={4}
                value={ownerCommonDraft}
                onChange={(e) => setOwnerCommonDraft(e.target.value)}
                placeholder="공통으로 추가할 문구를 입력하세요. 비우면 공통 문구가 삭제됩니다."
              />
              <div className="owner-common-hint">공통 문구는 각 대표님업체 메모에 &quot;공통: ...&quot; 형태로 추가됩니다.</div>
            </div>
            <div className="owner-common-actions">
              <button type="button" className="btn-muted" onClick={() => setOwnerCommonModalOpen(false)}>취소</button>
              <button type="button" className="primary" onClick={applyOwnerCommonMemo}>적용</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
