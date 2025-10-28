// src/App.jsx (지역 목록 갱신 및 로그 기능이 추가된 최종 버전)

import React, { useState, useEffect, useRef } from 'react';
import '../../../../styles.css';
import '../../../../fonts.css';
import Sidebar from '../../../../components/Sidebar';
import Drawer from '../../../../components/Drawer';
import { INDUSTRY_AVERAGES, DEBT_RATIO_WARN_FACTOR, CURRENT_RATIO_WARN_FACTOR } from '../../../../ratios.js';
import { loadPersisted, savePersisted } from '../../../../shared/persistence.js';

// --- Helper Functions & Components (변경 없음) ---
const formatNumber = (value) => { if (!value && value !== 0) return ''; const num = String(value).replace(/,/g, ''); return isNaN(num) ? String(value) : Number(num).toLocaleString(); };
const unformatNumber = (value) => String(value).replace(/,/g, '');
const formatPercentage = (value) => { if (!value && value !== 0) return ''; const num = Number(String(value).replace(/,/g, '')); if (isNaN(num)) return String(value); return num.toFixed(2) + '%'; };
const getStatusClass = (statusText) => { if (statusText === '최신') return 'status-latest'; if (statusText === '1년 경과') return 'status-warning'; if (statusText === '1년 이상 경과') return 'status-old'; return 'status-unknown'; };

const normalizeFlagText = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const isWomenOwnedCompany = (company) => {
  const text = normalizeFlagText(company?.['여성기업']);
  if (!text) return false;
  const normalized = text.replace(/\s+/g, '').toLowerCase();
  if (!normalized) return false;
  if (normalized === '없음' || normalized === '-' || normalized === '무') return false;
  return true;
};

const hasQualityEvaluationData = (company) => {
  const text = normalizeFlagText(company?.['품질평가']);
  if (!text) return false;
  const normalized = text.replace(/\s+/g, '').toLowerCase();
  if (!normalized) return false;
  if (normalized.includes('없음')) return false;
  if (normalized === '-' || normalized === '무') return false;
  return /\d/.test(normalized);
};

const SEARCH_STORAGE_KEY = 'search:page';
const PAGE_SIZE = 12;

const normalizeFileType = (value) => {
  const token = String(value ?? '').trim();
  if (!token) return 'eung';
  const direct = ({
    eung: 'eung',
    전기: 'eung',
    tongsin: 'tongsin',
    통신: 'tongsin',
    sobang: 'sobang',
    소방: 'sobang',
    all: 'all',
    전체: 'all',
  })[token];
  if (direct) return direct;
  const lowered = token.toLowerCase();
  return ({ eung: 'eung', tongsin: 'tongsin', sobang: 'sobang', all: 'all' })[lowered] || 'eung';
};

const createDefaultFilters = () => ({
  name: '',
  includeRegions: [],
  excludeRegions: [],
  manager: '',
  min_sipyung: '',
  max_sipyung: '',
  min_3y: '',
  max_3y: '',
  min_5y: '',
  max_5y: '',
});

const composeCompanyKey = (company, fallbackIndex = null) => {
  if (!company) return '';
  const type = company._file_type ? String(company._file_type).trim() : '';
  const bizRaw = company['사업자번호'];
  if (bizRaw !== undefined && bizRaw !== null) {
    const biz = String(bizRaw).trim();
    if (biz) {
      return type ? `biz:${biz}|type:${type}` : `biz:${biz}`;
    }
  }
  const nameRaw = company['검색된 회사'] || company['회사명'] || company['대표자'];
  if (nameRaw !== undefined && nameRaw !== null) {
    const name = String(nameRaw).trim();
    if (name) {
      return type ? `name:${name}|type:${type}` : `name:${name}`;
    }
  }
  if (typeof fallbackIndex === 'number') {
    const indexToken = `idx:${fallbackIndex}`;
    return type ? `${indexToken}|type:${type}` : indexToken;
  }
  return '';
};

const findMatchIndexByKey = (dataset, key, globalOffset = 0) => {
  if (!Array.isArray(dataset) || !key) return -1;

  const normalizedKey = String(key);
  let matchIndex = dataset.findIndex((company, idx) => (
    composeCompanyKey(company, globalOffset + idx) === normalizedKey
  ));

  if (matchIndex >= 0) return matchIndex;

  if (normalizedKey.startsWith('biz:')) {
    const bizToken = normalizedKey.slice(4).split('|')[0];
    matchIndex = dataset.findIndex((company) => {
      const biz = company?.['사업자번호'];
      return biz !== undefined && biz !== null && String(biz).trim() === bizToken;
    });
    if (matchIndex >= 0) return matchIndex;
  }

  if (normalizedKey.startsWith('name:')) {
    const nameToken = normalizedKey.slice(5).split('|')[0];
    matchIndex = dataset.findIndex((company) => {
      const name = company?.['검색된 회사'] || company?.['회사명'] || company?.['대표자'];
      return name !== undefined && name !== null && String(name).trim() === nameToken;
    });
    if (matchIndex >= 0) return matchIndex;
  }

  if (normalizedKey.startsWith('idx:')) {
    const idxToken = Number.parseInt(normalizedKey.slice(4).split('|')[0], 10);
    if (Number.isInteger(idxToken)) {
      const localIndex = idxToken - globalOffset;
      if (localIndex >= 0 && localIndex < dataset.length) {
        return localIndex;
      }
    }
  }

  return -1;
};

// Parse percent-like strings into numbers, e.g., "123.4%" -> 123.4
const parsePercentNumber = (v) => { if (v === null || v === undefined) return NaN; const s = String(v).replace(/[%%%\\s,]/g, ''); const n = Number(s); return Number.isFinite(n) ? n : NaN; };

// Parse a flexible date string: YYYY[.\-/년]MM[.\-/월]DD? -> Date
const parseFlexibleDate = (v) => {
  if (!v && v !== 0) return null;
  if (v instanceof Date && !isNaN(v)) return v;
  const s = String(v).trim();
  const m = s.match(/(\d{4})[\.\-\/년\s]*(\d{1,2})[\.\-\/월\s]*(\d{1,2})?/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = m[3] ? Number(m[3]) : 1;
    const dt = new Date(y, mo - 1, d);
    return isNaN(dt) ? null : dt;
  }
  return null;
};

const yearsSince = (date) => {
  if (!(date instanceof Date)) return NaN;
  const now = new Date();
  let years = now.getFullYear() - date.getFullYear();
  const m = now.getMonth() - date.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < date.getDate())) years--;
  return years;
};

function CopyDialog({ isOpen, message, onClose }) {
  const buttonRef = useRef(null);
  useEffect(() => { if (isOpen) { buttonRef.current?.focus(); } }, [isOpen]);
  useEffect(() => {
    const handleKeyDown = (event) => { if (isOpen && event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', handleKeyDown);
    return () => { window.removeEventListener('keydown', handleKeyDown); };
  }, [isOpen, onClose]);
  if (!isOpen) return null;
  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-box" onClick={(e) => e.stopPropagation()}>
        <p>{message}</p>
        <button ref={buttonRef} onClick={onClose}>확인</button>
      </div>
    </div>
  );
}

function FileUploader({ type, label, isUploaded, onUploadSuccess }) {
  const [message, setMessage] = useState('');
  const handleSelectFile = async () => {
    setMessage('파일 선택창을 여는 중...');
    const result = await window.electronAPI.selectFile(type);
    if (result.success) {
      setMessage(`경로 설정 완료: ${result.path}`);
      onUploadSuccess(); // [핵심] 성공 시 부모에게 알림
    } else {
      if (result.message !== '파일 선택이 취소되었습니다.') {
        setMessage(result.message);
      } else {
        setMessage('');
      }
    }
  };
  return (
    <div className="file-uploader">
      <label>{label} 엑셀 파일</label>
      {isUploaded ? 
        <p className="upload-message success">✅ 파일 경로가 설정되었습니다.</p> : 
        <p className="upload-message warning">⚠️ 파일 경로를 설정해주세요.</p>
      }
      <div className="uploader-controls">
        <button onClick={handleSelectFile}>경로 설정</button>
      </div>
      {message && <p className="upload-message info">{message}</p>}
    </div>
  );
}

function AdminUpload({ fileStatuses, onUploadSuccess }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className={`admin-upload-section ${isOpen ? 'is-open' : ''}`}>
      <div className="admin-header" onClick={() => setIsOpen(!isOpen)}>
        <h2 className="sub-title">관리자 파일 업로드</h2>
        <span className="toggle-arrow">{isOpen ? '▲' : '▼'}</span>
      </div>
      <div className="uploaders-grid">
        <FileUploader type="eung" label="전기" isUploaded={fileStatuses.eung} onUploadSuccess={onUploadSuccess} />
        <FileUploader type="tongsin" label="통신" isUploaded={fileStatuses.tongsin} onUploadSuccess={onUploadSuccess} />
        <FileUploader type="sobang" label="소방" isUploaded={fileStatuses.sobang} onUploadSuccess={onUploadSuccess} />
      </div>
    </div>
  );
}

const DISPLAY_ORDER = [ "검색된 회사", "대표자", "사업자번호", "지역", "시평", "3년 실적", "5년 실적", "부채비율", "유동비율", "영업기간", "신용평가", "여성기업", "고용자수", "일자리창출", "품질평가", "비고" ];

function RegionSelector({
  label,
  options,
  selected,
  onToggle,
  onSelectAll,
  onClear,
  placeholder = '지역을 선택하세요'
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef(null);
  const displayText = selected.length > 0 ? selected.join(', ') : placeholder;
  const isEmpty = selected.length === 0;

  const toggleDropdown = React.useCallback(() => {
    if (options.length === 0) return;
    setIsOpen(prev => !prev);
  }, [options.length]);

  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (!containerRef.current || containerRef.current.contains(event.target)) return;
      setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => { document.removeEventListener('mousedown', handleClickOutside); };
  }, []);

  React.useEffect(() => {
    if (options.length === 0) setIsOpen(false);
  }, [options.length]);

  return (
    <div className={`filter-item region-selector ${isOpen ? 'is-open' : ''}`} ref={containerRef}>
      <label>{label}</label>
      <button
        type="button"
        className={`filter-input region-display ${isEmpty ? 'is-empty' : ''}`}
        onClick={toggleDropdown}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggleDropdown();
          }
          if (event.key === 'Escape') {
            setIsOpen(false);
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="region-display-text">{displayText}</span>
        <span className="region-display-icon">{isOpen ? '▲' : '▼'}</span>
      </button>
      {isOpen && (
        <div className="region-dropdown">
          {options.length > 0 ? (
            <>
              {(onClear || onSelectAll) && (
                <div className="region-dropdown-actions">
                  {onSelectAll && (
                    <button type="button" onClick={() => onSelectAll()} className="region-action-btn">전체 선택</button>
                  )}
                  {onClear && (
                    <button type="button" onClick={() => onClear()} className="region-action-btn">선택 해제</button>
                  )}
                </div>
              )}
              <div className="region-dropdown-list" role="listbox">
                {options.map((opt) => (
                  <label key={opt} className="region-checkbox">
                    <input
                      type="checkbox"
                      checked={selected.includes(opt)}
                      onChange={() => onToggle(opt)}
                    />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            </>
          ) : (
            <div className="region-checkbox-empty">등록된 지역이 없습니다</div>
          )}
        </div>
      )}
    </div>
  );
}

function App() {
  const persistedRef = useRef(null);
  if (persistedRef.current === null) {
    persistedRef.current = loadPersisted(SEARCH_STORAGE_KEY, null);
  }
  const persisted = persistedRef.current || {};
  const restoreSearchRef = useRef(Boolean(persisted.searchPerformed));

  const [fileStatuses, setFileStatuses] = useState({ eung: false, tongsin: false, sobang: false });
  const [activeMenu, setActiveMenu] = useState('search');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadCount, setUploadCount] = useState(0);
  const [filters, setFilters] = useState(() => {
    const base = createDefaultFilters();
    const saved = persisted.filters;
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      return { ...base, ...saved };
    }
    return base;
  });
  const [fileType, setFileType] = useState(() => normalizeFileType(persisted.fileType || 'eung'));
  const [searchedFileType, setSearchedFileType] = useState(() => normalizeFileType(persisted.searchedFileType || persisted.fileType || 'eung'));
  const [regions, setRegions] = useState(() => (
    Array.isArray(persisted.regions) && persisted.regions.length > 0 ? persisted.regions : ['전체']
  ));
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [page, setPage] = useState(() => (
    Number.isInteger(persisted.page) && persisted.page > 0 ? persisted.page : 1
  ));
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [sortKey, setSortKey] = useState(() => persisted.sortKey || null); // 'sipyung' | '3y' | '5y'
  const [onlyLatest, setOnlyLatest] = useState(() => !!persisted.onlyLatest);
  const [onlyLHQuality, setOnlyLHQuality] = useState(() => !!persisted.onlyLHQuality);
  const [onlyWomenOwned, setOnlyWomenOwned] = useState(() => !!persisted.onlyWomenOwned);
  const [sortDir, setSortDir] = useState(() => (persisted.sortDir === 'asc' ? 'asc' : 'desc'));
  const [selectedIndex, setSelectedIndex] = useState(() => (
    typeof persisted.selectedIndex === 'number' ? persisted.selectedIndex : null
  ));
  const initialKey = () => {
    if (typeof persisted.selectedCompanyKey === 'string') return persisted.selectedCompanyKey;
    if (typeof persisted.selectedBizNo === 'string') return persisted.selectedBizNo;
    return '';
  };
  const [selectedCompanyKey, setSelectedCompanyKey] = useState(initialKey);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState({ isOpen: false, message: '' });
  const topSectionRef = useRef(null);
  const resultsScrollRef = useRef(null);
  const [animationKey, setAnimationKey] = useState(0);
  const latestQueryRef = useRef({ criteria: null, fileType });
  const lastRequestIdRef = useRef(0);
  const selectedCompanyKeyRef = useRef(selectedCompanyKey);
  const lastAutoSearchRef = useRef({ fileType, sortKey, sortDir, onlyLatest, onlyLHQuality, onlyWomenOwned });

  useEffect(() => {
    selectedCompanyKeyRef.current = selectedCompanyKey;
  }, [selectedCompanyKey]);

  const handleCompanySelect = React.useCallback((company, globalIndex = null, options = {}) => {
    if (options.scrollIntoView) {
      topSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setSelectedCompany(company);
    const key = composeCompanyKey(company, typeof globalIndex === 'number' ? globalIndex : null);
    setSelectedCompanyKey(key);
    const resultFileType = options.resultFileType || searchedFileType;
    if (resultFileType === 'all' || fileType === 'all') {
      setSelectedIndex(typeof globalIndex === 'number' ? globalIndex : null);
    } else {
      setSelectedIndex(null);
    }
    setAnimationKey(prevKey => prevKey + 1);
  }, [fileType, searchedFileType]);

  const buildSearchCriteria = React.useCallback(() => {
    const criteria = {
      ...filters,
      includeRegions: Array.isArray(filters.includeRegions) ? [...filters.includeRegions] : [],
      excludeRegions: Array.isArray(filters.excludeRegions) ? [...filters.excludeRegions] : [],
    };
    const rangeKeys = ['min_sipyung', 'max_sipyung', 'min_3y', 'max_3y', 'min_5y', 'max_5y'];
    rangeKeys.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(criteria, key)) {
        criteria[key] = unformatNumber(criteria[key]);
      }
    });
    criteria.includeRegions = criteria.includeRegions.filter((r) => r && r !== '전체');
    criteria.excludeRegions = criteria.excludeRegions.filter((r) => r && r !== '전체');
    return criteria;
  }, [filters]);

  const executeSearch = React.useCallback(async ({
    criteria,
    targetFileType,
    targetPage = 1,
    preserveSelection = false,
    skipScrollIntoView = false,
    overrides = {},
  } = {}) => {
    const effectiveCriteria = criteria || buildSearchCriteria();
    const effectiveFileType = normalizeFileType(targetFileType || fileType);
    const effectiveOnlyLatest = overrides.onlyLatest !== undefined ? overrides.onlyLatest : onlyLatest;
    const effectiveOnlyLHQuality = overrides.onlyLHQuality !== undefined ? overrides.onlyLHQuality : onlyLHQuality;
    const effectiveOnlyWomenOwned = overrides.onlyWomenOwned !== undefined ? overrides.onlyWomenOwned : onlyWomenOwned;

    let payloadCriteria;
    let criteriaJson;
    try {
      criteriaJson = JSON.stringify(effectiveCriteria);
      payloadCriteria = JSON.parse(criteriaJson);
    } catch (jsonErr) {
      console.warn('[Search] criteria serialization failed, falling back to shallow copy', jsonErr);
      payloadCriteria = { ...effectiveCriteria };
      criteriaJson = JSON.stringify(payloadCriteria);
    }

    const payloadOptions = {
      onlyLatest: !!effectiveOnlyLatest,
      onlyLHQuality: !!effectiveOnlyLHQuality,
      onlyWomenOwned: !!effectiveOnlyWomenOwned,
      sortKey: sortKey || null,
      sortDir,
      pagination: { page: targetPage, pageSize: PAGE_SIZE },
    };

    let optionsJson;
    try {
      optionsJson = JSON.stringify(payloadOptions);
    } catch (jsonErr) {
      console.warn('[Search] options serialization failed, falling back to shallow copy', jsonErr);
      optionsJson = JSON.stringify({ ...payloadOptions });
    }

    latestQueryRef.current = {
      criteria: payloadCriteria,
      criteriaJson,
      optionsJson,
      fileType: effectiveFileType,
    };

    const requestId = lastRequestIdRef.current + 1;
    lastRequestIdRef.current = requestId;

    setSearchPerformed(true);
    setIsLoading(true);
    setError('');
    if (!preserveSelection) {
      setSelectedCompany(null);
      setSelectedIndex(null);
      setSelectedCompanyKey('');
      setSearchResults([]);
      setTotalCount(0);
      setTotalPages(1);
    }

    try {
      const response = await window.electronAPI.searchCompanies(criteriaJson, effectiveFileType, optionsJson);

      if (lastRequestIdRef.current !== requestId) return;

      if (!response?.success) {
        throw new Error(response?.message || '검색 실패');
      }

      const itemsRaw = Array.isArray(response.data) ? response.data : [];
      const meta = response.meta || {};
      const requestedPageSize = PAGE_SIZE;
      const nextTotalCount = typeof meta.totalCount === 'number' ? meta.totalCount : itemsRaw.length;
      const pageSizeForDisplay = requestedPageSize > 0 ? requestedPageSize : 10;
      const items = pageSizeForDisplay > 0 ? itemsRaw.slice(0, pageSizeForDisplay) : itemsRaw;
      const derivedTotalPages = pageSizeForDisplay > 0
        ? Math.max(1, Math.ceil((nextTotalCount || 0) / pageSizeForDisplay))
        : 1;
      const nextTotalPages = derivedTotalPages;
      const nextPage = typeof meta.page === 'number' && meta.page > 0
        ? meta.page
        : Math.min(Math.max(targetPage, 1), nextTotalPages || 1);
      const globalOffset = (nextPage - 1) * pageSizeForDisplay;

      setSearchResults(items);
      setTotalCount(nextTotalCount);
      setTotalPages(nextTotalPages);
      setPage(nextPage);
      setSearchedFileType(effectiveFileType);

      const currentSelectedKey = selectedCompanyKeyRef.current;

      if (items.length === 0) {
        setSelectedCompany(null);
        setSelectedIndex(null);
        setSelectedCompanyKey('');
      } else if (!preserveSelection || !currentSelectedKey) {
        handleCompanySelect(items[0], globalOffset, {
          scrollIntoView: false,
          resultFileType: effectiveFileType,
        });
      } else {
        const matchIndex = findMatchIndexByKey(items, currentSelectedKey, globalOffset);
        if (matchIndex >= 0) {
          handleCompanySelect(items[matchIndex], globalOffset + matchIndex, {
            scrollIntoView: false,
            resultFileType: effectiveFileType,
          });
        }
      }

      setTimeout(() => {
        if (resultsScrollRef.current) {
          resultsScrollRef.current.scrollTop = 0;
        }
      }, 50);
    } catch (err) {
      if (lastRequestIdRef.current === requestId) {
        setError(`검색 오류: ${err.message}`);
        console.error(err);
        setSearchResults([]);
        setTotalCount(0);
        setTotalPages(1);
      }
    } finally {
      if (lastRequestIdRef.current === requestId) {
        setIsLoading(false);
        if (restoreSearchRef.current) {
          restoreSearchRef.current = false;
        }
      }
    }
  }, [buildSearchCriteria, fileType, handleCompanySelect, onlyLatest, onlyLHQuality, onlyWomenOwned, sortDir, sortKey]);

  const handleSearch = React.useCallback(async (targetPage = 1, rawOptions = {}) => {
    let safeTargetPage = targetPage;
    let safeOptions = rawOptions;

    if (safeTargetPage && typeof safeTargetPage === 'object') {
      safeTargetPage.preventDefault?.();
      safeTargetPage.stopPropagation?.();
      safeTargetPage = 1;
      safeOptions = {};
    }

    if (safeOptions && typeof safeOptions === 'object' && typeof safeOptions.preventDefault === 'function') {
      safeOptions.preventDefault();
      safeOptions.stopPropagation?.();
      safeOptions = {};
    }

    const { preserveSelection = false } = safeOptions || {};

    let nextOnlyLatest = onlyLatest;
    let nextOnlyLHQuality = onlyLHQuality;
    let nextOnlyWomenOwned = onlyWomenOwned;

    if (!preserveSelection) {
      nextOnlyLatest = false;
      nextOnlyLHQuality = false;
      nextOnlyWomenOwned = false;
      setOnlyLatest(false);
      setOnlyLHQuality(false);
      setOnlyWomenOwned(false);
    }

    await executeSearch({
      criteria: buildSearchCriteria(),
      targetFileType: fileType,
      targetPage: typeof safeTargetPage === 'number' && Number.isFinite(safeTargetPage)
        ? safeTargetPage
        : 1,
      preserveSelection,
      skipScrollIntoView: preserveSelection,
      overrides: {
        onlyLatest: nextOnlyLatest,
        onlyLHQuality: nextOnlyLHQuality,
        onlyWomenOwned: nextOnlyWomenOwned,
      },
    });
    lastAutoSearchRef.current = {
      fileType,
      sortKey,
      sortDir,
      onlyLatest: nextOnlyLatest,
      onlyLHQuality: nextOnlyLHQuality,
      onlyWomenOwned: nextOnlyWomenOwned,
    };
  }, [buildSearchCriteria, executeSearch, fileType, onlyLatest, onlyLHQuality, onlyWomenOwned, sortDir, sortKey]);

  const currentPage = React.useMemo(() => {
    const safeTotal = totalPages && totalPages > 0 ? totalPages : 1;
    return Math.min(Math.max(page, 1), safeTotal);
  }, [page, totalPages]);

  const goToPage = React.useCallback((targetPage) => {
    const next = Number.isFinite(targetPage) ? Math.trunc(targetPage) : 1;
    const safeTotal = totalPages && totalPages > 0 ? totalPages : 1;
    const clampedTarget = Math.min(Math.max(next, 1), safeTotal);
    if (clampedTarget === currentPage) return;
    const latest = latestQueryRef.current;
    if (!latest || !latest.criteria) {
      setPage(clampedTarget);
      return;
    }
    executeSearch({
      criteria: latest.criteria,
      targetFileType: latest.fileType || fileType,
      targetPage: clampedTarget,
      preserveSelection: true,
      skipScrollIntoView: true,
    });
  }, [currentPage, executeSearch, fileType, totalPages]);

  const goToPreviousPage = React.useCallback(() => {
    goToPage(currentPage - 1);
  }, [goToPage, currentPage]);

  const goToNextPage = React.useCallback(() => {
    goToPage(currentPage + 1);
  }, [goToPage, currentPage]);

  const goToFirstPage = React.useCallback(() => {
    goToPage(1);
  }, [goToPage]);

  const goToLastPage = React.useCallback(() => {
    goToPage(totalPages);
  }, [goToPage, totalPages]);

  const refreshFileStatuses = async () => {
    const statuses = await window.electronAPI.checkFiles();
    setFileStatuses(statuses);
  };
  
  // 데이터 자동 갱신 이벤트 구독
  useEffect(() => {
    if (!window.electronAPI?.onDataUpdated) return;
    const unsubscribe = window.electronAPI.onDataUpdated(async (payload) => {
      try {
        await refreshFileStatuses();
        // 지역 목록 갱신
        const r = await window.electronAPI.getRegions(searchedFileType);
        if (r.success && Array.isArray(r.data)) {
          setRegions(r.data);
        }
        // 최근 검색이 있었다면 같은 조건으로 재검색 시도
        if (searchPerformed) {
          const latest = latestQueryRef.current;
          await executeSearch({
            criteria: latest?.criteria || buildSearchCriteria(),
            targetFileType: latest?.fileType || fileType,
            targetPage: currentPage,
            preserveSelection: true,
            skipScrollIntoView: true,
          });
        }
      } catch (e) {
        console.error('[Renderer] 데이터 갱신 처리 중 오류:', e);
      }
    });
    return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
  }, [buildSearchCriteria, currentPage, executeSearch, fileType, searchPerformed, searchedFileType]);

  // Always update admin upload statuses on any data refresh from main
  useEffect(() => {
    if (!window.electronAPI?.onDataUpdated) return;
    const unsub = window.electronAPI.onDataUpdated(async () => {
      try { await refreshFileStatuses(); } catch (e) {
        console.error('[Renderer] refresh statuses failed:', e);
      }
    });
    return () => { if (typeof unsub === 'function') unsub(); };
  }, []);

  // Always update admin upload statuses on any data refresh from main
  useEffect(() => {
    if (!window.electronAPI?.onDataUpdated) return;
    const unsub = window.electronAPI.onDataUpdated(async () => {
      try { await refreshFileStatuses(); } catch (e) {
        console.error('[Renderer] refresh statuses failed:', e);
      }
    });
    return () => { if (typeof unsub === 'function') unsub(); };
  }, []);
  
  // [추가] 파일 선택이 성공하면 이 함수가 호출됩니다.
  const handleUploadSuccess = () => {
    console.log('[App.jsx LOG] 파일 선택 성공! 갱신 트리거를 작동시킵니다.');
    refreshFileStatuses();
    setUploadCount(prev => prev + 1); // 카운터를 증가시켜 useEffect를 다시 실행시킵니다.
  };


  useEffect(() => {
    const fetchRegions = async () => {
      console.log(`[App.jsx LOG] 지역 목록(${fileType}) 가져오기 요청을 보냅니다. (트리거: uploadCount=${uploadCount})`);
      const statuses = await window.electronAPI.checkFiles();
      if (statuses[fileType]) {
        const response = await window.electronAPI.getRegions(fileType);
        console.log('[App.jsx LOG] 백엔드로부터 받은 지역 목록 응답:', response);
        if (response.success && response.data.length > 1) { // '전체' 외에 다른 항목이 있는지 확인
          setRegions(response.data);
        } else {
          setRegions(['전체']);
        }
      } else {
        console.log(`[App.jsx LOG] ${fileType} 파일이 없어 지역 목록을 가져오지 않습니다.`);
        setRegions(['전체']);
      }
    };
    fetchRegions();
  }, [fileType, uploadCount]); // [수정] uploadCount가 바뀔 때마다 이 함수가 다시 실행됩니다.

  useEffect(() => {
    refreshFileStatuses();
  }, []);



  const regionOptions = React.useMemo(() => (
    Array.isArray(regions)
      ? regions.filter((r) => r && r !== '전체')
      : []
  ), [regions]);

  useEffect(() => {
    setFilters((prev) => {
      const validSet = new Set(regionOptions);
      const include = prev.includeRegions.filter((r) => validSet.has(r));
      const exclude = prev.excludeRegions.filter((r) => validSet.has(r));
      const includeUnchanged = include.length === prev.includeRegions.length && include.every((v, i) => v === prev.includeRegions[i]);
      const excludeUnchanged = exclude.length === prev.excludeRegions.length && exclude.every((v, i) => v === prev.excludeRegions[i]);
      if (includeUnchanged && excludeUnchanged) return prev;
      return { ...prev, includeRegions: include, excludeRegions: exclude };
    });
  }, [regionOptions]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    const numberFields = ['min_sipyung', 'max_sipyung', 'min_3y', 'max_3y', 'min_5y', 'max_5y'];
    if (numberFields.includes(name)) { setFilters(prev => ({ ...prev, [name]: formatNumber(value) })); } else { setFilters(prev => ({ ...prev, [name]: value })); }
  };

  const toggleRegionSelection = React.useCallback((current, region, optionsList) => {
    const exists = current.includes(region);
    const next = exists ? current.filter((r) => r !== region) : [...current, region];
    const ordered = optionsList.filter((opt) => next.includes(opt));
    return ordered;
  }, []);

  const handleIncludeRegionToggle = React.useCallback((region) => {
    setFilters((prev) => {
      if (!regionOptions.includes(region)) return prev;
      const next = toggleRegionSelection(prev.includeRegions, region, regionOptions);
      if (next.length === prev.includeRegions.length && next.every((v, i) => v === prev.includeRegions[i])) {
        return prev;
      }
      return { ...prev, includeRegions: next };
    });
  }, [regionOptions, toggleRegionSelection]);

  const handleIncludeRegionSelectAll = React.useCallback(() => {
    if (regionOptions.length === 0) return;
    setFilters((prev) => {
      if (prev.includeRegions.length === regionOptions.length && prev.includeRegions.every((v, i) => v === regionOptions[i])) {
        return prev;
      }
      return { ...prev, includeRegions: [...regionOptions] };
    });
  }, [regionOptions]);

  const handleIncludeRegionClear = React.useCallback(() => {
    setFilters((prev) => {
      if (prev.includeRegions.length === 0) return prev;
      return { ...prev, includeRegions: [] };
    });
  }, []);

  const handleExcludeRegionToggle = React.useCallback((region) => {
    setFilters((prev) => {
      if (!regionOptions.includes(region)) return prev;
      const next = toggleRegionSelection(prev.excludeRegions, region, regionOptions);
      if (next.length === prev.excludeRegions.length && next.every((v, i) => v === prev.excludeRegions[i])) {
        return prev;
      }
      return { ...prev, excludeRegions: next };
    });
  }, [regionOptions, toggleRegionSelection]);

  const handleExcludeRegionSelectAll = React.useCallback(() => {
    if (regionOptions.length === 0) return;
    setFilters((prev) => {
      if (prev.excludeRegions.length === regionOptions.length && prev.excludeRegions.every((v, i) => v === regionOptions[i])) {
        return prev;
      }
      return { ...prev, excludeRegions: [...regionOptions] };
    });
  }, [regionOptions]);

  const handleExcludeRegionClear = React.useCallback(() => {
    setFilters((prev) => {
      if (prev.excludeRegions.length === 0) return prev;
      return { ...prev, excludeRegions: [] };
    });
  }, []);

  // Reset only requested filters: 업체명, 지역 포함/제외, 시평액/3년/5년 범위, 담당자
  const handleResetFilters = () => {
    setFilters(prev => ({
      ...prev,
      name: '',
      includeRegions: [],
      excludeRegions: [],
      manager: '',
      min_sipyung: '',
      max_sipyung: '',
      min_3y: '',
      max_3y: '',
      min_5y: '',
      max_5y: ''
    }));
  };

  useEffect(() => {
    if (!restoreSearchRef.current) return;
    handleSearch(page, { preserveSelection: true });
  }, [handleSearch, page]);

  const handleKeyDown = (e) => { if (e.key === 'Enter') handleSearch(); };
  const handleCopySingle = (key, value) => { navigator.clipboard.writeText(String(value)); setDialog({ isOpen: true, message: `'${key}' 항목이 복사되었습니다.` }); };
  const escapeHtml = (s) => String(s)
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'",'&#39;');

  const handleCopyAll = async () => {
    if (!selectedCompany) return;
    const formattedKeys = ['시평', '3년 실적', '5년 실적'];
    const percentKeys = ['부채비율', '유동비율'];

    const values = DISPLAY_ORDER.map((key) => {
      const raw = selectedCompany[key] ?? '';
      if (percentKeys.some(k => key.includes(k))) {
        return formatPercentage(raw);
      }
      if (formattedKeys.includes(key)) return formatNumber(raw);
      let s = String(raw ?? '');
      if (key === '신용평가') {
        // 괄호로 유효기간이 이어지는 경우, 셀 내부 줄바꿈(LF) 삽입
        if (!/\r?\n/.test(s)) {
          s = s.replace(/\s*\(([^)]*)\)$/, '\n($1)');
        }
        s = s.replace(/\r\n|\r/g, '\n'); // 내부 개행은 LF로 표준화
      } else if (key === '비고') {
        s = s.replace(/\r\n|\r/g, '\n'); // 내부 개행 유지(LF)
      } else {
        s = s.replace(/\r\n|\r|\n/g, ' '); // 그 외 개행은 공백 처리
      }
      return s;
    });

    // Build rows for 1-column CSV: in-cell breaks only for 신용평가/비고 (LF = CHAR(10))
    const rows = values.map((v, idx) => {
      const key = DISPLAY_ORDER[idx];
      // Excel in-cell newline is LF (CHAR(10)). CR can render as a musical note in some codepages.
      if (key === '신용평가' || key === '비고') return String(v).replace(/\r\n|\r|\n/g, '\n');
      return String(v).replace(/\r\n|\r|\n/g, ' ');
    });

    try {
      const r = await window.electronAPI.copyCsvColumn(rows);
      if (!r?.success) throw new Error(r?.message || 'copy failed');
      setDialog({ isOpen: true, message: '전체 정보가 클립보드에 복사되었습니다!' });
    } catch (e) {
      setDialog({ isOpen: true, message: '복사 중 오류가 발생했습니다.' });
    }
  };

  useEffect(() => {
    const safeTotal = totalPages && totalPages > 0 ? totalPages : 1;
    const clamped = Math.min(Math.max(page, 1), safeTotal);
    if (clamped !== page) {
      setPage(clamped);
    }
  }, [page, totalPages]);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  useEffect(() => {
    const nextState = { fileType, sortKey, sortDir, onlyLatest, onlyLHQuality, onlyWomenOwned };
    const prevState = lastAutoSearchRef.current || {};
    const modifiersChanged = prevState.fileType !== nextState.fileType
      || prevState.sortKey !== nextState.sortKey
      || prevState.sortDir !== nextState.sortDir
      || prevState.onlyLatest !== nextState.onlyLatest
      || prevState.onlyLHQuality !== nextState.onlyLHQuality
      || prevState.onlyWomenOwned !== nextState.onlyWomenOwned;
    lastAutoSearchRef.current = nextState;

    if (!modifiersChanged) return;
    if (prevState.fileType !== nextState.fileType) return;
    if (!searchPerformed) return;
    if (restoreSearchRef.current) return;

    const latest = latestQueryRef.current;
    if (!latest || !latest.criteria) return;

    executeSearch({
      criteria: latest.criteria,
      targetFileType: latest.fileType || fileType,
      targetPage: 1,
      preserveSelection: true,
      skipScrollIntoView: true,
    });
  }, [executeSearch, fileType, onlyLatest, onlyLHQuality, onlyWomenOwned, searchPerformed, sortDir, sortKey]);

  useEffect(() => {
    const sanitizedFilters = {
      ...filters,
      includeRegions: Array.isArray(filters.includeRegions) ? [...filters.includeRegions] : [],
      excludeRegions: Array.isArray(filters.excludeRegions) ? [...filters.excludeRegions] : [],
    };
    const sanitizedRegions = Array.isArray(regions)
      ? regions.filter((name) => typeof name === 'string')
      : [];
    const snapshot = {
      filters: sanitizedFilters,
      fileType,
      searchedFileType,
      searchPerformed,
      sortKey,
      sortDir,
      onlyLatest,
      selectedIndex,
      selectedCompanyKey,
      page: currentPage,
      // legacy key retained for backwards compatibility in case old snapshots exist
      selectedBizNo: selectedCompanyKey,
      regions: sanitizedRegions.length > 0 ? sanitizedRegions : ['전체'],
    };
    savePersisted(SEARCH_STORAGE_KEY, snapshot);
  }, [filters, fileType, searchedFileType, searchPerformed, sortKey, sortDir, onlyLatest, onlyLHQuality, onlyWomenOwned, selectedIndex, selectedCompanyKey, regions, currentPage]);

  return (
    <div className="app-shell">
      <Sidebar
        active={activeMenu}
        onSelect={(k) => {
          setActiveMenu(k);
          if (k === 'upload') setUploadOpen(true);
          if (k === 'agreements') window.location.hash = '#/agreements';
          if (k === 'lh-under50') window.location.hash = '#/lh/under50';
          if (k === 'lh-50to100') window.location.hash = '#/lh/50to100';
          if (k === 'records') window.location.hash = '#/records';
          if (k === 'search') window.location.hash = '#/search';
          if (k === 'settings') window.location.hash = '#/settings';
        }}
        fileStatuses={fileStatuses}
        collapsed={true}
      />
      <div className="main">
        <div className="title-drag" />
        <div className="topbar" />
        <div className="stage">
          <div className="content">
          <div className="panel panel-filters">
            <div className="search-filter-section" ref={topSectionRef}>
              <div className="file-type-selector">
                <div className="radio-group">
                  <label><input type="radio" value="eung" checked={fileType === 'eung'} onChange={(e) => setFileType(normalizeFileType(e.target.value))} /> 전기</label>
                  <label><input type="radio" value="tongsin" checked={fileType === 'tongsin'} onChange={(e) => setFileType(normalizeFileType(e.target.value))} /> 통신</label>
                  <label><input type="radio" value="sobang" checked={fileType === 'sobang'} onChange={(e) => setFileType(normalizeFileType(e.target.value))} /> 소방</label>
                  <label><input type="radio" value="all" checked={fileType === 'all'} onChange={(e) => setFileType(normalizeFileType(e.target.value))} /> 전체</label>
                </div>
              </div>
              <div className="filter-grid" onKeyDown={handleKeyDown}>
                <div className="filter-item"><label>&nbsp;</label><button onClick={handleResetFilters} className="reset-button" disabled={isLoading}>{"\uD544\uD130 \uCD08\uAE30\uD654"}</button></div>
                <div className="filter-item"><label>업체명</label><input type="text" name="name" value={filters.name} onChange={handleFilterChange} onKeyDown={handleKeyDown} className="filter-input" /></div>
                <RegionSelector
                  label="지역 포함"
                  options={regionOptions}
                  selected={filters.includeRegions}
                  onToggle={handleIncludeRegionToggle}
                  onSelectAll={handleIncludeRegionSelectAll}
                  onClear={handleIncludeRegionClear}
                  placeholder="지역을 선택하세요"
                />
                <RegionSelector
                  label="지역 제외"
                  options={regionOptions}
                  selected={filters.excludeRegions}
                  onToggle={handleExcludeRegionToggle}
                  onSelectAll={handleExcludeRegionSelectAll}
                  onClear={handleExcludeRegionClear}
                  placeholder="제외할 지역을 선택하세요"
                />
                <div className="filter-item"><label>담당자</label><input type="text" name="manager" value={filters.manager} onChange={handleFilterChange} className="filter-input" /></div>
                <div className="filter-item range"><label>시평액 범위</label><div className="range-inputs"><input type="text" name="min_sipyung" value={filters.min_sipyung} onChange={handleFilterChange} placeholder="최소" className="filter-input" /><span>~</span><input type="text" name="max_sipyung" value={filters.max_sipyung} onChange={handleFilterChange} placeholder="최대" className="filter-input" /></div></div>
                <div className="filter-item range"><label>3년 실적 범위</label><div className="range-inputs"><input type="text" name="min_3y" value={filters.min_3y} onChange={handleFilterChange} placeholder="최소" className="filter-input" /><span>~</span><input type="text" name="max_3y" value={filters.max_3y} onChange={handleFilterChange} placeholder="최대" className="filter-input" /></div></div>
                <div className="filter-item range"><label>5년 실적 범위</label><div className="range-inputs"><input type="text" name="min_5y" value={filters.min_5y} onChange={handleFilterChange} placeholder="최소" className="filter-input" /><span>~</span><input type="text" name="max_5y" value={filters.max_5y} onChange={handleFilterChange} placeholder="최대" className="filter-input" /></div></div>
                <div className="filter-item"><label>&nbsp;</label><button onClick={() => handleSearch()} className="search-button" disabled={isLoading}>{isLoading ? '검색 중...' : '검색'}</button></div>
              </div>
            </div>
          </div>
          <div className="panel panel-results">
            <div className="search-results-list">
              <div className="results-header">
                <div className="results-toolbar">
                  <button className={`sort-btn ${sortKey==='sipyung' ? 'active':''}`} onClick={()=>toggleSort('sipyung')}>
                    시평액 {sortKey==='sipyung' ? (sortDir==='asc'?'▲':'▼') : ''}
                  </button>
                  <button className={`sort-btn ${sortKey==='3y' ? 'active':''}`} onClick={()=>toggleSort('3y')}>
                    3년 실적 {sortKey==='3y' ? (sortDir==='asc'?'▲':'▼') : ''}
                  </button>
                  <button className={`sort-btn ${sortKey==='5y' ? 'active':''}`} onClick={()=>toggleSort('5y')}>
                    5년 실적 {sortKey==='5y' ? (sortDir==='asc'?'▲':'▼') : ''}
                  </button>
                  <button className={`sort-btn ${onlyLatest ? 'active' : ''}`} onClick={()=>setOnlyLatest((v) => !v)} title="최신 자료만 보기">
                    최신만 {onlyLatest ? '✔' : ''}
                  </button>
                  <button
                    className={`sort-btn ${onlyLHQuality ? 'active' : ''}`}
                    onClick={() => setOnlyLHQuality((v) => !v)}
                    title="LH 품질평가 데이터가 있는 업체만 보기"
                  >
                    LH품질 {onlyLHQuality ? '✅' : ''}
                  </button>
                  <button
                    className={`sort-btn ${onlyWomenOwned ? 'active' : ''}`}
                    onClick={() => setOnlyWomenOwned((v) => !v)}
                    title="여성기업만 보기"
                  >
                    여성기업 {onlyWomenOwned ? '✅' : ''}
                  </button>
                </div>
              </div>
              {totalCount > 0 && (
                <div className="pagination-controls fixed">
                  <div className="pagination-info" aria-live="polite">
                    <span className="pagination-summary">{currentPage} / {totalPages}</span>
                    <span className="pagination-count">총 {totalCount}건</span>
                  </div>
                  <div className="pagination-buttons" role="navigation" aria-label="검색 결과 페이지 이동">
                    <button
                      type="button"
                      className="pagination-btn"
                      onClick={goToFirstPage}
                      disabled={currentPage <= 1 || isLoading}
                    >
                      맨 앞
                    </button>
                    <button
                      type="button"
                      className="pagination-btn"
                      onClick={goToPreviousPage}
                      disabled={currentPage <= 1 || isLoading}
                    >
                      이전
                    </button>
                    <button
                      type="button"
                      className="pagination-btn"
                      onClick={goToNextPage}
                      disabled={currentPage >= totalPages || isLoading}
                    >
                      다음
                    </button>
                    <button
                      type="button"
                      className="pagination-btn"
                      onClick={goToLastPage}
                      disabled={currentPage >= totalPages || isLoading}
                    >
                      맨 뒤
                    </button>
                  </div>
                </div>
              )}
              <div className="results-scroll" ref={resultsScrollRef}>
                {isLoading && <p>로딩 중...</p>}
                {error && <p className="error-message">{error}</p>}
                {!isLoading && !error && totalCount === 0 && (
                  <p>{searchPerformed ? '검색 결과가 없습니다.' : '왼쪽에서 조건을 입력하고 검색하세요.'}</p>
                )}
                {searchResults.length > 0 && (
                  <ul>
                    {searchResults.map((company, index) => {
                      const globalIndex = (currentPage - 1) * PAGE_SIZE + index;
                      const isActive = selectedCompany && selectedCompany.사업자번호 === company.사업자번호;
                      const summaryStatus = company['요약상태'] || '미지정';
                      const fileTypeLabel = searchedFileType === 'eung' ? '전기' : searchedFileType === 'tongsin' ? '통신' : '소방';
                      const listKey = composeCompanyKey(company, globalIndex) || `idx-${globalIndex}`;
                      const womenOwned = isWomenOwnedCompany(company);
                      const hasQualityEvaluation = hasQualityEvaluationData(company);
                      return (
                        <li key={listKey} onClick={() => handleCompanySelect(company, globalIndex)} className={`company-list-item ${searchedFileType === 'all' ? (selectedIndex === globalIndex ? 'active' : '') : (isActive ? 'active' : '')}`}>
                          <div className="company-info-wrapper">
                            <span className={`file-type-badge-small file-type-${searchedFileType === 'all' ? (company._file_type || '') : searchedFileType}`}>
                              {searchedFileType === 'all'
                                ? (company._file_type === 'eung' ? '전기' : company._file_type === 'tongsin' ? '통신' : company._file_type === 'sobang' ? '소방' : '')
                                : fileTypeLabel}
                            </span>
                            <span className="company-name">{company['검색된 회사']}</span>
                            {womenOwned && (
                              <span className="badge-female badge-inline" title="여성기업">
                                女
                              </span>
                            )}
                            {hasQualityEvaluation && (
                              <span className="badge-quality badge-inline" title="LH 품질평가">
                                LH
                              </span>
                            )}
                            {company['담당자명'] && <span className="badge-person">{company['담당자명']}</span>}
                          </div>
                          <span className={`summary-status-badge ${getStatusClass(summaryStatus)}`}>{summaryStatus}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
          <div className="panel">
            {searchPerformed && (
              <div className="company-details fade-in" key={animationKey}>
                {selectedCompany && (
                  <div className="details-header">
                    <div className={`file-type-badge file-type-${searchedFileType === 'all' ? (selectedCompany?._file_type || '') : searchedFileType}`}>
                      {searchedFileType === 'all' && (
                        <>
                          {selectedCompany?._file_type === 'eung' && '전기'}
                          {selectedCompany?._file_type === 'tongsin' && '통신'}
                          {selectedCompany?._file_type === 'sobang' && '소방'}
                        </>
                      )}
                      {searchedFileType === 'eung' && '전기'}
                      {searchedFileType === 'tongsin' && '통신'}
                      {searchedFileType === 'sobang' && '소방'}
                    </div>
                    <button onClick={handleCopyAll} className="copy-all-button">전체 복사</button>
                  </div>
                )}
                {selectedCompany ? (
                  <div className="table-container">
                    <table className="details-table">
                      <tbody>
                        {DISPLAY_ORDER.map((key) => {
                          let value = selectedCompany[key] ?? 'N/A';
                          // Normalize: prefer 표준 키 '영업기간' 값 사용
                          if (key.includes('사업기간') || key.includes('영업기간')) {
                            value = (selectedCompany['영업기간'] ?? value);
                          }
                          const status = selectedCompany.데이터상태?.[key] ? selectedCompany.데이터상태[key] : '미지정';
                          let displayValue;
                          const percentageKeys = ['부채비율', '유동비율'];
                          const formattedKeys = ['시평', '3년 실적', '5년 실적'];
                          if (percentageKeys.includes(key)) {
                            displayValue = formatPercentage(value);
                          } else if (formattedKeys.includes(key)) {
                            displayValue = formatNumber(value);
                          } else {
                            displayValue = String(value);
                          }
                          let extraClass = '';
                          let ratioBadgeText = null;
                          let ratioBadgeClass = '';
                          let durationBadgeText = null;
                          let durationBadgeClass = '';
                          const wrappableKeys = ['신용평가', '품질평가', '비고'];
                          const isWrappable = wrappableKeys.includes(key);

                          try {
                            const avg = INDUSTRY_AVERAGES[searchedFileType === 'all' ? (selectedCompany?._file_type || '') : searchedFileType];
                            const debtFactor = DEBT_RATIO_WARN_FACTOR;      // 0.5
                            const currentFactor = CURRENT_RATIO_WARN_FACTOR; // 1.5
                            if (avg) {
                              if (key.includes('부채') && key.includes('비율')) {
                                const num = parsePercentNumber(value);
                                if (!isNaN(num)) {
                                  const ratio = (num / avg.debtRatio) * 100;
                                  ratioBadgeText = `${Math.round(ratio)}%`;
                                  if (num >= avg.debtRatio * debtFactor) extraClass = 'ratio-bad';
                                  ratioBadgeClass = extraClass ? 'ratio-badge bad' : 'ratio-badge';
                                }
                              } else if (key.includes('유동') && key.includes('비율')) {
                                const num = parsePercentNumber(value);
                                if (!isNaN(num)) {
                                  const ratio = (num / avg.currentRatio) * 100;
                                  ratioBadgeText = `${Math.round(ratio)}%`;
                                  if (!isNaN(num) && num <= avg.currentRatio * currentFactor) extraClass = 'ratio-bad';
                                  ratioBadgeClass = extraClass ? 'ratio-badge bad' : 'ratio-badge';
                                }
                              }
                              // Business duration badges/emphasis
                              if (key.includes('사업기간') || key.includes('영업기간')) {
                                const dt = parseFlexibleDate(value);
                                const y = dt ? yearsSince(dt) : NaN;
                                if (!isNaN(y)) {
                                  if (y < 3) {
                                    extraClass = 'duration-bad';
                                    durationBadgeText = null; // 강조만
                                  } else if (y >= 5) {
                                    durationBadgeText = '5년 이상';
                                    durationBadgeClass = 'duration-badge good';
                                  } else if (y >= 3) {
                                    durationBadgeText = '3년 이상';
                                    durationBadgeClass = 'duration-badge good';
                                  }
                                }
                              }
                            }
                          } catch (_) { }
                          return (
                            <tr key={key} className={isWrappable ? 'wrappable-row' : ''}>
                              <th>{key}</th>
                              <td>
                                <div className="value-cell">
                                  <div className="value-with-status">
                                    <span className={`status-dot ${getStatusClass(status)}`} title={status}></span>
                                    <span className={extraClass}>{displayValue}</span>
                                    {ratioBadgeText && (
                                      <span className={ratioBadgeClass} title="업종 평균 대비 비율">
                                        {ratioBadgeText}
                                      </span>
                                    )}
                                    {durationBadgeText && (
                                      <span className={durationBadgeClass} title="영업기간 기준 뱃지">
                                        {durationBadgeText}
                                      </span>
                                    )}
                                  </div>
                                  <button onClick={() => handleCopySingle(key, displayValue)} className="copy-single-button" title={`${key} 복사`}>복사</button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (<p>왼쪽 목록에서 업체를 선택하세요.</p>)}
              </div>
            )}
          </div>
        </div>
        </div>
        <CopyDialog
          isOpen={dialog.isOpen}
          message={dialog.message}
          onClose={() => setDialog({ isOpen: false, message: '' })}
        />
      </div>
      <Drawer open={uploadOpen} onClose={() => setUploadOpen(false)}>
        <AdminUpload fileStatuses={fileStatuses} onUploadSuccess={handleUploadSuccess} />
      </Drawer>
    </div>
  );
}

export default App;
