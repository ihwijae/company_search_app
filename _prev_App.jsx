// src/App.jsx (지??목록 갱신 �?로그 기능??추�???최종 버전)

import React, { useState, useEffect, useRef } from 'react';
import './styles.css';
import './fonts.css';
import Sidebar from './components/Sidebar';
import Drawer from './components/Drawer';

// --- Helper Functions & Components (변�??�음) ---
const formatNumber = (value) => { if (!value && value !== 0) return ''; const num = String(value).replace(/,/g, ''); return isNaN(num) ? String(value) : Number(num).toLocaleString(); };
const unformatNumber = (value) => String(value).replace(/,/g, '');
const formatPercentage = (value) => { if (!value && value !== 0) return ''; const num = Number(String(value).replace(/,/g, '')); if (isNaN(num)) return String(value); return num.toFixed(2) + '%'; };
const getStatusClass = (statusText) => { if (statusText === '최신') return 'status-latest'; if (statusText === '1??경과') return 'status-warning'; if (statusText === '1???�상 경과') return 'status-old'; return 'status-unknown'; };

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
        <button ref={buttonRef} onClick={onClose}>?�인</button>
      </div>
    </div>
  );
}

function FileUploader({ type, label, isUploaded, onUploadSuccess }) {
  const [message, setMessage] = useState('');
  const handleSelectFile = async () => {
    setMessage('?�일 ?�택창을 ?�는 �?..');
    const result = await window.electronAPI.selectFile(type);
    if (result.success) {
      setMessage(`경로 ?�정 ?�료: ${result.path}`);
      onUploadSuccess(); // [?�심] ?�공 ??부모에�??�림
    } else {
      if (result.message !== '?�일 ?�택??취소?�었?�니??') {
        setMessage(result.message);
      } else {
        setMessage('');
      }
    }
  };
  return (
    <div className="file-uploader">
      <label>{label} ?��? ?�일</label>
      {isUploaded ? 
        <p className="upload-message success">???�일 경로가 ?�정?�었?�니??</p> : 
        <p className="upload-message warning">?�️ ?�일 경로�??�정?�주?�요.</p>
      }
      <div className="uploader-controls">
        <button onClick={handleSelectFile}>경로 ?�정</button>
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
        <h2 className="sub-title">관리자 ?�일 ?�로??/h2>
        <span className="toggle-arrow">{isOpen ? '?? : '??}</span>
      </div>
      <div className="uploaders-grid">
        <FileUploader type="eung" label="?�기" isUploaded={fileStatuses.eung} onUploadSuccess={onUploadSuccess} />
        <FileUploader type="tongsin" label="?�신" isUploaded={fileStatuses.tongsin} onUploadSuccess={onUploadSuccess} />
        <FileUploader type="sobang" label="?�방" isUploaded={fileStatuses.sobang} onUploadSuccess={onUploadSuccess} />
      </div>
    </div>
  );
}

const DISPLAY_ORDER = [ "검?�된 ?�사", "?�?�자", "?�업?�번??, "지??, "?�평", "3???�적", "5???�적", "부채비??, "?�동비율", "?�업기간", "?�용?��?", "?�성기업", "고용?�수", "?�자리창�?, "?�질?��?", "비고" ];

function App() {
  const [fileStatuses, setFileStatuses] = useState({ eung: false, tongsin: false, sobang: false })
  const [activeMenu, setActiveMenu] = useState('search');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadCount, setUploadCount] = useState(0); // [추�?] ?�일 ?�택 ?�공??감�???카운??  const [filters, setFilters] = useState({ name: '', region: '?�체', manager: '', min_sipyung: '', max_sipyung: '', min_3y: '', max_3y: '', min_5y: '', max_5y: '' });
  const [fileType, setFileType] = useState('eung');
  const [searchedFileType, setSearchedFileType] = useState('eung');
  const [regions, setRegions] = useState(['?�체']);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [sortKey, setSortKey] = useState(null); // 'sipyung' | '3y' | '5y'
  const [sortDir, setSortDir] = useState('desc'); // 'asc' | 'desc'
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState({ isOpen: false, message: '' });
  const topSectionRef = useRef(null);
  const searchResultsRef = useRef(null);
  const [animationKey, setAnimationKey] = useState(0);

  const refreshFileStatuses = async () => {
    const statuses = await window.electronAPI.checkFiles();
    setFileStatuses(statuses);
  };
  
  // ?�이???�동 갱신 ?�벤??구독
  useEffect(() => {
    if (!window.electronAPI?.onDataUpdated) return;
    const unsubscribe = window.electronAPI.onDataUpdated(async (payload) => {
      try {
        await refreshFileStatuses();
        // 지??목록 갱신
        const r = await window.electronAPI.getRegions(searchedFileType);
        if (r.success && Array.isArray(r.data)) {
          setRegions(r.data);
        }
        // 최근 검?�이 ?�었?�면 같�? 조건?�로 ?��????�도
        if (searchPerformed) {
          await handleSearch();
        }
      } catch (e) {
        console.error('[Renderer] ?�이??갱신 처리 �??�류:', e);
      }
    });
    return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
  }, [searchPerformed, searchedFileType]);
  
  // [추�?] ?�일 ?�택???�공?�면 ???�수가 ?�출?�니??
  const handleUploadSuccess = () => {
    console.log('[App.jsx LOG] ?�일 ?�택 ?�공! 갱신 ?�리거�? ?�동?�킵?�다.');
    refreshFileStatuses();
    setUploadCount(prev => prev + 1); // 카운?��? 증�??�켜 useEffect�??�시 ?�행?�킵?�다.
  };


  useEffect(() => {
    const fetchRegions = async () => {
      console.log(`[App.jsx LOG] 지??목록(${fileType}) 가?�오�??�청??보냅?�다. (?�리�? uploadCount=${uploadCount})`);
      const statuses = await window.electronAPI.checkFiles();
      if (statuses[fileType]) {
        const response = await window.electronAPI.getRegions(fileType);
        console.log('[App.jsx LOG] 백엔?�로부??받�? 지??목록 ?�답:', response);
        if (response.success && response.data.length > 1) { // '?�체' ?�에 ?�른 ??��???�는지 ?�인
          setRegions(response.data);
        } else {
          setRegions(['?�체']);
        }
      } else {
        console.log(`[App.jsx LOG] ${fileType} ?�일???�어 지??목록??가?�오지 ?�습?�다.`);
        setRegions(['?�체']);
      }
    };
    fetchRegions();
  }, [fileType, uploadCount]); // [?�정] uploadCount가 바�??�마?????�수가 ?�시 ?�행?�니??

  useEffect(() => {
    refreshFileStatuses();
  }, []);
  
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    const numberFields = ['min_sipyung', 'max_sipyung', 'min_3y', 'max_3y', 'min_5y', 'max_5y'];
    if (numberFields.includes(name)) { setFilters(prev => ({ ...prev, [name]: formatNumber(value) })); } else { setFilters(prev => ({ ...prev, [name]: value })); }
  };

  const handleSearch = async () => {
    setSearchPerformed(true);
    setIsLoading(true);
    setSelectedCompany(null);
    setSearchResults([]);
    setError('');
    try {
      const criteria = { ...filters };
      for (const key in criteria) {
        if (['min_sipyung', 'max_sipyung', 'min_3y', 'max_3y', 'min_5y', 'max_5y'].includes(key)) {
          criteria[key] = unformatNumber(criteria[key]);
        }
      }
      const response = await window.electronAPI.searchCompanies(criteria, fileType);
      if (response.success) {
        setSearchResults(response.data);
      } else {
        throw new Error(response.message);
      }
      setSearchedFileType(fileType);
      setTimeout(() => { searchResultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
    } catch (err) {
      setError(`검???�류: ${err.message}`);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompanySelect = (company) => {
    topSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
    setSelectedCompany(company);
    setAnimationKey(prevKey => prevKey + 1);
  };

  const handleKeyDown = (e) => { if (e.key === 'Enter') handleSearch(); };
  const handleCopySingle = (key, value) => { navigator.clipboard.writeText(String(value)); setDialog({ isOpen: true, message: `'${key}' ??��??복사?�었?�니??` }); };
  const handleCopyAll = () => {
    if (!selectedCompany) return;
    const textToCopy = DISPLAY_ORDER.map(key => { const value = selectedCompany[key] ?? ''; const formattedKeys = ['?�평', '3???�적', '5???�적']; return formattedKeys.includes(key) ? formatNumber(value) : String(value); }).join('\n');
    navigator.clipboard.writeText(textToCopy);
    setDialog({ isOpen: true, message: '?�체 ?�보가 ?�립보드??복사?�었?�니??' });
  };

  // ?�렬 ?�틸 �??�태 기반 계산
  const parseAmountLocal = (value) => {
    if (value === null || value === undefined) return 0;
    const num = String(value).replace(/,/g, '').trim();
    const n = parseInt(num, 10);
    return isNaN(n) ? 0 : n;
  };

  const sortedResults = React.useMemo(() => {
    if (!sortKey) return searchResults;
    const keyMap = { sipyung: '?�평', '3y': '3???�적', '5y': '5???�적' };
    const field = keyMap[sortKey];
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...searchResults].sort((a, b) => {
      const av = parseAmountLocal(a[field]);
      const bv = parseAmountLocal(b[field]);
      if (av === bv) return 0;
      return av > bv ? dir : -dir;
    });
  }, [searchResults, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  return (
    <div className="app-shell">
      <Sidebar
        active={activeMenu}
        onSelect={(k) => { setActiveMenu(k); if (k === 'upload') setUploadOpen(true); }}
        fileStatuses={fileStatuses}
        collapsed={true}
      />
      <div className="main">
        <div className="title-drag" />
        <div className="topbar" />
        <div className="stage">
          <div className="content">
          <div className="panel">
            <div className="search-filter-section" ref={topSectionRef}>
              <div className="file-type-selector">
                <h3>검???�??/h3>
                <div className="radio-group">
                  <label><input type="radio" value="eung" checked={fileType === 'eung'} onChange={(e) => setFileType(e.target.value)} /> ?�기</label>
                  <label><input type="radio" value="tongsin" checked={fileType === 'tongsin'} onChange={(e) => setFileType(e.target.value)} /> ?�신</label>
                  <label><input type="radio" value="sobang" checked={fileType === 'sobang'} onChange={(e) => setFileType(e.target.value)} /> ?�방</label>
                </div>
              </div>
              <div className="filter-grid">
                <div className="filter-item"><label>?�체�?/label><input type="text" name="name" value={filters.name} onChange={handleFilterChange} onKeyDown={handleKeyDown} className="filter-input" /></div>
                <div className="filter-item"><label>지??/label><select name="region" value={filters.region} onChange={handleFilterChange} className="filter-input">{regions.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
                <div className="filter-item"><label>?�당??/label><input type="text" name="manager" value={filters.manager} onChange={handleFilterChange} className="filter-input" /></div>
                <div className="filter-item range"><label>?�평??범위</label><div className="range-inputs"><input type="text" name="min_sipyung" value={filters.min_sipyung} onChange={handleFilterChange} placeholder="최소" className="filter-input" /><span>~</span><input type="text" name="max_sipyung" value={filters.max_sipyung} onChange={handleFilterChange} placeholder="최�?" className="filter-input" /></div></div>
                <div className="filter-item range"><label>3???�적 범위</label><div className="range-inputs"><input type="text" name="min_3y" value={filters.min_3y} onChange={handleFilterChange} placeholder="최소" className="filter-input" /><span>~</span><input type="text" name="max_3y" value={filters.max_3y} onChange={handleFilterChange} placeholder="최�?" className="filter-input" /></div></div>
                <div className="filter-item range"><label>5???�적 범위</label><div className="range-inputs"><input type="text" name="min_5y" value={filters.min_5y} onChange={handleFilterChange} placeholder="최소" className="filter-input" /><span>~</span><input type="text" name="max_5y" value={filters.max_5y} onChange={handleFilterChange} placeholder="최�?" className="filter-input" /></div></div>
                <div className="filter-item"><label>&nbsp;</label><button onClick={handleSearch} className="search-button" disabled={isLoading}>{isLoading ? '검??�?..' : '검??}</button></div>
              </div>
            </div>
          </div>
          <div className="panel">
            <div className="search-results-list" ref={searchResultsRef}>
              <h2 className="sub-title">검??결과 ({searchResults.length}�?</h2>
              <div className="results-toolbar">
                <button className={`sort-btn ${sortKey==='sipyung' ? 'active':''}`} onClick={()=>toggleSort('sipyung')}>
                  ?�평??{sortKey==='sipyung' ? (sortDir==='asc'?'??:'??) : ''}
                </button>
                <button className={`sort-btn ${sortKey==='3y' ? 'active':''}`} onClick={()=>toggleSort('3y')}>
                  3???�적 {sortKey==='3y' ? (sortDir==='asc'?'??:'??) : ''}
                </button>
                <button className={`sort-btn ${sortKey==='5y' ? 'active':''}`} onClick={()=>toggleSort('5y')}>
                  5???�적 {sortKey==='5y' ? (sortDir==='asc'?'??:'??) : ''}
                </button>
              </div>
              {isLoading && <p>로딩 �?..</p>}
              {error && <p className="error-message">{error}</p>}
              {!isLoading && !error && searchResults.length === 0 && (
                <p>{searchPerformed ? '검??결과가 ?�습?�다.' : '?�쪽?�서 조건???�력?�고 검?�하?�요.'}</p>
              )}
              {sortedResults.length > 0 && (
                <ul>
                  {sortedResults.map((company, index) => {
                    const isActive = selectedCompany && selectedCompany.?�업?�번??=== company.?�업?�번??
                    const summaryStatus = company['?�약?�태'] || '미�???;
                    const fileTypeLabel = searchedFileType === 'eung' ? '?�기' : searchedFileType === 'tongsin' ? '?�신' : '?�방';
                    return (
                      <li key={index} onClick={() => handleCompanySelect(company)} className={`company-list-item ${isActive ? 'active' : ''}`}>
                        <div className="company-info-wrapper">
                          <span className={`file-type-badge-small file-type-${searchedFileType}`}>{fileTypeLabel}</span>
                          <span className="company-name">{company['검?�된 ?�사']}</span>
                          {company['?�당?�명'] && <span className="badge-person">{company['?�당?�명']}</span>}
                        </div>
                        <span className={`summary-status-badge ${getStatusClass(summaryStatus)}`}>{summaryStatus}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
          <div className="panel">
            {searchPerformed && (
              <div className="company-details fade-in" key={animationKey}>
                <div className="details-header">
                  <h2 className="sub-title">?�체 ?�세 ?�보</h2>
                  {selectedCompany && (
                    <>
                      <div className={`file-type-badge file-type-${searchedFileType}`}>
                        {searchedFileType === 'eung' && '?�기'}
                        {searchedFileType === 'tongsin' && '?�신'}
                        {searchedFileType === 'sobang' && '?�방'}
                      </div>
                      <button onClick={handleCopyAll} className="copy-all-button">?�체 복사</button>
                    </>
                  )}
                </div>
                {selectedCompany ? (
                  <div className="table-container">
                    <table className="details-table">
                      <tbody>
                        {DISPLAY_ORDER.map((key) => {
                          const value = selectedCompany[key] ?? 'N/A';
                          const status = selectedCompany.?�이?�상??.[key] ? selectedCompany.?�이?�상??key] : '미�???;
                          let displayValue;
                          const percentageKeys = ['부채비??, '?�동비율'];
                          const formattedKeys = ['?�평', '3???�적', '5???�적'];
                          if (percentageKeys.includes(key)) {
                            displayValue = formatPercentage(value);
                          } else if (formattedKeys.includes(key)) {
                            displayValue = formatNumber(value);
                          } else {
                            displayValue = String(value);
                          }
                          return (
                            <tr key={key}>
                              <th>{key}</th>
                              <td>
                                <div className="value-cell">
                                  <div className="value-with-status">
                                    <span className={`status-dot ${getStatusClass(status)}`} title={status}></span>
                                    <span>{displayValue}</span>
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
                ) : (<p>?�쪽 목록?�서 ?�체�??�택?�세??</p>)}
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

