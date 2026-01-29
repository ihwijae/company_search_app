import React from 'react';
import '../../../../styles.css';
import '../../../../fonts.css';
import Sidebar from '../../../../components/Sidebar';
import CompanySearchModal from '../../../../components/CompanySearchModal.jsx';

const INDUSTRY_OPTIONS = [
  { value: 'eung', label: '전기' },
  { value: 'tongsin', label: '통신' },
  { value: 'sobang', label: '소방' },
];

const SOLO_OPTIONS = [
  { value: 'none', label: '없음' },
  { value: 'exclude', label: '단독제외' },
  { value: 'allow', label: '단독이여도가능' },
];

const DEFAULT_FILTERS = { industry: 'eung', region: '전체', name: '', bizNo: '' };

const MOCK_ROWS = [
  {
    id: 'note-1',
    name: '한빛이앤씨',
    industry: '전기',
    region: '서울',
    bizNo: '110-12-34567',
    soloStatus: 'exclude',
    memo: '최근 협정에서 단독 제외 요청. 담당자 유선 확인 필요.',
  },
  {
    id: 'note-2',
    name: '청우통신',
    industry: '통신',
    region: '경기',
    bizNo: '215-88-90210',
    soloStatus: 'allow',
    memo: '단독이어도 가능. 서류 누락 이슈 없음.',
  },
  {
    id: 'note-3',
    name: '새빛소방',
    industry: '소방',
    region: '부산',
    bizNo: '621-55-11223',
    soloStatus: 'none',
    memo: '특이사항 없음',
  },
];

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

export default function CompanyNotesPage() {
  const [activeMenu, setActiveMenu] = React.useState('company-notes');
  const [draftFilters, setDraftFilters] = React.useState(DEFAULT_FILTERS);
  const [filters, setFilters] = React.useState(DEFAULT_FILTERS);
  const [regionOptions, setRegionOptions] = React.useState(['전체']);
  const [rows, setRows] = React.useState(MOCK_ROWS);
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editorMode, setEditorMode] = React.useState('create');
  const [editorForm, setEditorForm] = React.useState({
    name: '',
    industry: 'eung',
    region: '',
    bizNo: '',
    soloStatus: 'none',
    memo: '',
  });
  const [companyPickerOpen, setCompanyPickerOpen] = React.useState(false);

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

  const filteredRows = React.useMemo(() => {
    const nameKey = normalizeText(filters.name);
    const bizKey = normalizeDigits(filters.bizNo);
    return rows.filter((row) => {
    if (row.industry !== INDUSTRY_OPTIONS.find((i) => i.value === filters.industry)?.label) {
      return false;
    }
      if (filters.region && filters.region !== '전체' && row.region !== filters.region) {
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
      industry: normalizeIndustryValue(draftFilters.industry),
      region: '',
      bizNo: '',
      soloStatus: 'none',
      memo: '',
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
      id: row.id,
    });
    setEditorOpen(true);
  };

  const handleSave = () => {
    if (!editorForm.name) {
      setEditorOpen(true);
      return;
    }
    const industryLabel = INDUSTRY_OPTIONS.find((option) => option.value === editorForm.industry)?.label || '전체';
    if (editorMode === 'create') {
      const next = {
        id: `note-${Date.now()}`,
        name: editorForm.name,
        industry: industryLabel,
        region: editorForm.region,
        bizNo: editorForm.bizNo,
        soloStatus: editorForm.soloStatus,
        memo: editorForm.memo,
      };
      setRows((prev) => [next, ...prev]);
    } else {
      setRows((prev) => prev.map((row) => (
        row.id === editorForm.id
          ? {
            ...row,
            name: editorForm.name,
            industry: industryLabel,
            region: editorForm.region,
            bizNo: editorForm.bizNo,
            soloStatus: editorForm.soloStatus,
            memo: editorForm.memo,
          }
          : row
      )));
    }
    setEditorOpen(false);
  };

  const handleCompanyPick = (payload) => {
    const name = payload?.name || payload?.snapshot?.['업체명'] || payload?.snapshot?.['회사명'] || '';
    const bizNo = payload?.bizNo || payload?.snapshot?.['사업자번호'] || '';
    const region = payload?.snapshot?.['대표지역'] || payload?.snapshot?.['지역'] || '';
    setEditorForm((prev) => ({
      ...prev,
      name,
      bizNo,
      region,
      industry: normalizeIndustryValue(payload?.fileType || prev.industry),
    }));
    setCompanyPickerOpen(false);
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
                <button type="button" className="btn-muted">가져오기</button>
                <button type="button" className="btn-muted">내보내기</button>
              </div>
            </div>

            <div className="company-notes-filters">
              <div className="filter-grid">
                <div className="filter-item">
                  <label>공종</label>
                  <select value={draftFilters.industry} onChange={handleFilterChange('industry')} className="filter-input">
                    {INDUSTRY_OPTIONS.map((option) => (
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
                  <input type="text" value={draftFilters.name} onChange={handleFilterChange('name')} className="filter-input" placeholder="업체명을 입력하세요" />
                </div>
                <div className="filter-item">
                  <label>사업자번호</label>
                  <input type="text" value={draftFilters.bizNo} onChange={handleFilterChange('bizNo')} className="filter-input" placeholder="사업자번호 입력" />
                </div>
                <div className="filter-item">
                  <label>&nbsp;</label>
                  <button type="button" className="search-button" onClick={applyFilters}>검색</button>
                </div>
                <div className="filter-item">
                  <label>&nbsp;</label>
                  <button type="button" className="reset-button" onClick={resetFilters}>필터 초기화</button>
                </div>
              </div>
            </div>

            <div className="company-notes-table">
              <div className="table-wrap">
                <table className="details-table">
                  <thead>
                    <tr>
                      <th style={{ width: '6%' }}>No</th>
                      <th style={{ width: '18%' }}>업체명</th>
                      <th style={{ width: '10%' }}>공종</th>
                      <th style={{ width: '10%' }}>지역</th>
                      <th style={{ width: '16%' }}>사업자번호</th>
                      <th style={{ width: '12%' }}>단독</th>
                      <th>특이사항</th>
                      <th style={{ width: '8%' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row, idx) => (
                      <tr key={row.id}>
                        <td>{idx + 1}</td>
                        <td className="notes-name-cell">{row.name}</td>
                        <td>
                          <span className={`notes-industry notes-industry-${String(row.industry || '').trim()}`}>
                            {row.industry}
                          </span>
                        </td>
                        <td className="notes-region-cell">{row.region}</td>
                        <td>{row.bizNo}</td>
                        <td>
                          <span className={getSoloClassName(row.soloStatus)}>{getSoloLabel(row.soloStatus)}</span>
                        </td>
                        <td>
                          <div className="notes-memo">{row.memo}</div>
                        </td>
                        <td>
                          <div className="details-actions">
                            <button type="button" className="btn-sm btn-soft" onClick={() => openEdit(row)}>수정</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredRows.length === 0 && (
                      <tr>
                        <td colSpan={8} className="notes-empty">등록된 특이사항이 없습니다.</td>
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
        <div className="notes-modal-backdrop" onClick={() => setEditorOpen(false)}>
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
    </div>
  );
}
