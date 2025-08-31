// src/App.jsx (ì§€??ëª©ë¡ ê°±ì‹  ë°?ë¡œê·¸ ê¸°ëŠ¥??ì¶”ê???ìµœì¢… ë²„ì „)

import React, { useState, useEffect, useRef } from 'react';
import './styles.css';
import './fonts.css';
import Sidebar from './components/Sidebar';
import Drawer from './components/Drawer';

// --- Helper Functions & Components (ë³€ê²??†ìŒ) ---
const formatNumber = (value) => { if (!value && value !== 0) return ''; const num = String(value).replace(/,/g, ''); return isNaN(num) ? String(value) : Number(num).toLocaleString(); };
const unformatNumber = (value) => String(value).replace(/,/g, '');
const formatPercentage = (value) => { if (!value && value !== 0) return ''; const num = Number(String(value).replace(/,/g, '')); if (isNaN(num)) return String(value); return num.toFixed(2) + '%'; };
const getStatusClass = (statusText) => { if (statusText === 'ìµœì‹ ') return 'status-latest'; if (statusText === '1??ê²½ê³¼') return 'status-warning'; if (statusText === '1???´ìƒ ê²½ê³¼') return 'status-old'; return 'status-unknown'; };

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
        <button ref={buttonRef} onClick={onClose}>?•ì¸</button>
      </div>
    </div>
  );
}

function FileUploader({ type, label, isUploaded, onUploadSuccess }) {
  const [message, setMessage] = useState('');
  const handleSelectFile = async () => {
    setMessage('?Œì¼ ? íƒì°½ì„ ?¬ëŠ” ì¤?..');
    const result = await window.electronAPI.selectFile(type);
    if (result.success) {
      setMessage(`ê²½ë¡œ ?¤ì • ?„ë£Œ: ${result.path}`);
      onUploadSuccess(); // [?µì‹¬] ?±ê³µ ??ë¶€ëª¨ì—ê²??Œë¦¼
    } else {
      if (result.message !== '?Œì¼ ? íƒ??ì·¨ì†Œ?˜ì—ˆ?µë‹ˆ??') {
        setMessage(result.message);
      } else {
        setMessage('');
      }
    }
  };
  return (
    <div className="file-uploader">
      <label>{label} ?‘ì? ?Œì¼</label>
      {isUploaded ? 
        <p className="upload-message success">???Œì¼ ê²½ë¡œê°€ ?¤ì •?˜ì—ˆ?µë‹ˆ??</p> : 
        <p className="upload-message warning">? ï¸ ?Œì¼ ê²½ë¡œë¥??¤ì •?´ì£¼?¸ìš”.</p>
      }
      <div className="uploader-controls">
        <button onClick={handleSelectFile}>ê²½ë¡œ ?¤ì •</button>
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
        <h2 className="sub-title">ê´€ë¦¬ì ?Œì¼ ?…ë¡œ??/h2>
        <span className="toggle-arrow">{isOpen ? '?? : '??}</span>
      </div>
      <div className="uploaders-grid">
        <FileUploader type="eung" label="?„ê¸°" isUploaded={fileStatuses.eung} onUploadSuccess={onUploadSuccess} />
        <FileUploader type="tongsin" label="?µì‹ " isUploaded={fileStatuses.tongsin} onUploadSuccess={onUploadSuccess} />
        <FileUploader type="sobang" label="?Œë°©" isUploaded={fileStatuses.sobang} onUploadSuccess={onUploadSuccess} />
      </div>
    </div>
  );
}

const DISPLAY_ORDER = [ "ê²€?‰ëœ ?Œì‚¬", "?€?œì", "?¬ì—…?ë²ˆ??, "ì§€??, "?œí‰", "3???¤ì ", "5???¤ì ", "ë¶€ì±„ë¹„??, "? ë™ë¹„ìœ¨", "?ì—…ê¸°ê°„", "? ìš©?‰ê?", "?¬ì„±ê¸°ì—…", "ê³ ìš©?ìˆ˜", "?¼ìë¦¬ì°½ì¶?, "?ˆì§ˆ?‰ê?", "ë¹„ê³ " ];

function App() {
  const [fileStatuses, setFileStatuses] = useState({ eung: false, tongsin: false, sobang: false })
  const [activeMenu, setActiveMenu] = useState('search');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadCount, setUploadCount] = useState(0); // [ì¶”ê?] ?Œì¼ ? íƒ ?±ê³µ??ê°ì???ì¹´ìš´??  const [filters, setFilters] = useState({ name: '', region: '?„ì²´', manager: '', min_sipyung: '', max_sipyung: '', min_3y: '', max_3y: '', min_5y: '', max_5y: '' });
  const [fileType, setFileType] = useState('eung');
  const [searchedFileType, setSearchedFileType] = useState('eung');
  const [regions, setRegions] = useState(['?„ì²´']);
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
  
  // ?°ì´???ë™ ê°±ì‹  ?´ë²¤??êµ¬ë…
  useEffect(() => {
    if (!window.electronAPI?.onDataUpdated) return;
    const unsubscribe = window.electronAPI.onDataUpdated(async (payload) => {
      try {
        await refreshFileStatuses();
        // ì§€??ëª©ë¡ ê°±ì‹ 
        const r = await window.electronAPI.getRegions(searchedFileType);
        if (r.success && Array.isArray(r.data)) {
          setRegions(r.data);
        }
        // ìµœê·¼ ê²€?‰ì´ ?ˆì—ˆ?¤ë©´ ê°™ì? ì¡°ê±´?¼ë¡œ ?¬ê????œë„
        if (searchPerformed) {
          await handleSearch();
        }
      } catch (e) {
        console.error('[Renderer] ?°ì´??ê°±ì‹  ì²˜ë¦¬ ì¤??¤ë¥˜:', e);
      }
    });
    return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
  }, [searchPerformed, searchedFileType]);
  
  // [ì¶”ê?] ?Œì¼ ? íƒ???±ê³µ?˜ë©´ ???¨ìˆ˜ê°€ ?¸ì¶œ?©ë‹ˆ??
  const handleUploadSuccess = () => {
    console.log('[App.jsx LOG] ?Œì¼ ? íƒ ?±ê³µ! ê°±ì‹  ?¸ë¦¬ê±°ë? ?‘ë™?œí‚µ?ˆë‹¤.');
    refreshFileStatuses();
    setUploadCount(prev => prev + 1); // ì¹´ìš´?°ë? ì¦ê??œì¼œ useEffectë¥??¤ì‹œ ?¤í–‰?œí‚µ?ˆë‹¤.
  };


  useEffect(() => {
    const fetchRegions = async () => {
      console.log(`[App.jsx LOG] ì§€??ëª©ë¡(${fileType}) ê°€?¸ì˜¤ê¸??”ì²­??ë³´ëƒ…?ˆë‹¤. (?¸ë¦¬ê±? uploadCount=${uploadCount})`);
      const statuses = await window.electronAPI.checkFiles();
      if (statuses[fileType]) {
        const response = await window.electronAPI.getRegions(fileType);
        console.log('[App.jsx LOG] ë°±ì—”?œë¡œë¶€??ë°›ì? ì§€??ëª©ë¡ ?‘ë‹µ:', response);
        if (response.success && response.data.length > 1) { // '?„ì²´' ?¸ì— ?¤ë¥¸ ??ª©???ˆëŠ”ì§€ ?•ì¸
          setRegions(response.data);
        } else {
          setRegions(['?„ì²´']);
        }
      } else {
        console.log(`[App.jsx LOG] ${fileType} ?Œì¼???†ì–´ ì§€??ëª©ë¡??ê°€?¸ì˜¤ì§€ ?ŠìŠµ?ˆë‹¤.`);
        setRegions(['?„ì²´']);
      }
    };
    fetchRegions();
  }, [fileType, uploadCount]); // [?˜ì •] uploadCountê°€ ë°”ë€??Œë§ˆ?????¨ìˆ˜ê°€ ?¤ì‹œ ?¤í–‰?©ë‹ˆ??

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
      setError(`ê²€???¤ë¥˜: ${err.message}`);
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
  const handleCopySingle = (key, value) => { navigator.clipboard.writeText(String(value)); setDialog({ isOpen: true, message: `'${key}' ??ª©??ë³µì‚¬?˜ì—ˆ?µë‹ˆ??` }); };
  const handleCopyAll = () => {
    if (!selectedCompany) return;
    const textToCopy = DISPLAY_ORDER.map(key => { const value = selectedCompany[key] ?? ''; const formattedKeys = ['?œí‰', '3???¤ì ', '5???¤ì ']; return formattedKeys.includes(key) ? formatNumber(value) : String(value); }).join('\n');
    navigator.clipboard.writeText(textToCopy);
    setDialog({ isOpen: true, message: '?„ì²´ ?•ë³´ê°€ ?´ë¦½ë³´ë“œ??ë³µì‚¬?˜ì—ˆ?µë‹ˆ??' });
  };

  // ?•ë ¬ ? í‹¸ ë°??íƒœ ê¸°ë°˜ ê³„ì‚°
  const parseAmountLocal = (value) => {
    if (value === null || value === undefined) return 0;
    const num = String(value).replace(/,/g, '').trim();
    const n = parseInt(num, 10);
    return isNaN(n) ? 0 : n;
  };

  const sortedResults = React.useMemo(() => {
    if (!sortKey) return searchResults;
    const keyMap = { sipyung: '?œí‰', '3y': '3???¤ì ', '5y': '5???¤ì ' };
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
                <h3>ê²€???€??/h3>
                <div className="radio-group">
                  <label><input type="radio" value="eung" checked={fileType === 'eung'} onChange={(e) => setFileType(e.target.value)} /> ?„ê¸°</label>
                  <label><input type="radio" value="tongsin" checked={fileType === 'tongsin'} onChange={(e) => setFileType(e.target.value)} /> ?µì‹ </label>
                  <label><input type="radio" value="sobang" checked={fileType === 'sobang'} onChange={(e) => setFileType(e.target.value)} /> ?Œë°©</label>
                </div>
              </div>
              <div className="filter-grid">
                <div className="filter-item"><label>?…ì²´ëª?/label><input type="text" name="name" value={filters.name} onChange={handleFilterChange} onKeyDown={handleKeyDown} className="filter-input" /></div>
                <div className="filter-item"><label>ì§€??/label><select name="region" value={filters.region} onChange={handleFilterChange} className="filter-input">{regions.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
                <div className="filter-item"><label>?´ë‹¹??/label><input type="text" name="manager" value={filters.manager} onChange={handleFilterChange} className="filter-input" /></div>
                <div className="filter-item range"><label>?œí‰??ë²”ìœ„</label><div className="range-inputs"><input type="text" name="min_sipyung" value={filters.min_sipyung} onChange={handleFilterChange} placeholder="ìµœì†Œ" className="filter-input" /><span>~</span><input type="text" name="max_sipyung" value={filters.max_sipyung} onChange={handleFilterChange} placeholder="ìµœë?" className="filter-input" /></div></div>
                <div className="filter-item range"><label>3???¤ì  ë²”ìœ„</label><div className="range-inputs"><input type="text" name="min_3y" value={filters.min_3y} onChange={handleFilterChange} placeholder="ìµœì†Œ" className="filter-input" /><span>~</span><input type="text" name="max_3y" value={filters.max_3y} onChange={handleFilterChange} placeholder="ìµœë?" className="filter-input" /></div></div>
                <div className="filter-item range"><label>5???¤ì  ë²”ìœ„</label><div className="range-inputs"><input type="text" name="min_5y" value={filters.min_5y} onChange={handleFilterChange} placeholder="ìµœì†Œ" className="filter-input" /><span>~</span><input type="text" name="max_5y" value={filters.max_5y} onChange={handleFilterChange} placeholder="ìµœë?" className="filter-input" /></div></div>
                <div className="filter-item"><label>&nbsp;</label><button onClick={handleSearch} className="search-button" disabled={isLoading}>{isLoading ? 'ê²€??ì¤?..' : 'ê²€??}</button></div>
              </div>
            </div>
          </div>
          <div className="panel">
            <div className="search-results-list" ref={searchResultsRef}>
              <h2 className="sub-title">ê²€??ê²°ê³¼ ({searchResults.length}ê°?</h2>
              <div className="results-toolbar">
                <button className={`sort-btn ${sortKey==='sipyung' ? 'active':''}`} onClick={()=>toggleSort('sipyung')}>
                  ?œí‰??{sortKey==='sipyung' ? (sortDir==='asc'?'??:'??) : ''}
                </button>
                <button className={`sort-btn ${sortKey==='3y' ? 'active':''}`} onClick={()=>toggleSort('3y')}>
                  3???¤ì  {sortKey==='3y' ? (sortDir==='asc'?'??:'??) : ''}
                </button>
                <button className={`sort-btn ${sortKey==='5y' ? 'active':''}`} onClick={()=>toggleSort('5y')}>
                  5???¤ì  {sortKey==='5y' ? (sortDir==='asc'?'??:'??) : ''}
                </button>
              </div>
              {isLoading && <p>ë¡œë”© ì¤?..</p>}
              {error && <p className="error-message">{error}</p>}
              {!isLoading && !error && searchResults.length === 0 && (
                <p>{searchPerformed ? 'ê²€??ê²°ê³¼ê°€ ?†ìŠµ?ˆë‹¤.' : '?¼ìª½?ì„œ ì¡°ê±´???…ë ¥?˜ê³  ê²€?‰í•˜?¸ìš”.'}</p>
              )}
              {sortedResults.length > 0 && (
                <ul>
                  {sortedResults.map((company, index) => {
                    const isActive = selectedCompany && selectedCompany.?¬ì—…?ë²ˆ??=== company.?¬ì—…?ë²ˆ??
                    const summaryStatus = company['?”ì•½?íƒœ'] || 'ë¯¸ì???;
                    const fileTypeLabel = searchedFileType === 'eung' ? '?„ê¸°' : searchedFileType === 'tongsin' ? '?µì‹ ' : '?Œë°©';
                    return (
                      <li key={index} onClick={() => handleCompanySelect(company)} className={`company-list-item ${isActive ? 'active' : ''}`}>
                        <div className="company-info-wrapper">
                          <span className={`file-type-badge-small file-type-${searchedFileType}`}>{fileTypeLabel}</span>
                          <span className="company-name">{company['ê²€?‰ëœ ?Œì‚¬']}</span>
                          {company['?´ë‹¹?ëª…'] && <span className="badge-person">{company['?´ë‹¹?ëª…']}</span>}
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
                  <h2 className="sub-title">?…ì²´ ?ì„¸ ?•ë³´</h2>
                  {selectedCompany && (
                    <>
                      <div className={`file-type-badge file-type-${searchedFileType}`}>
                        {searchedFileType === 'eung' && '?„ê¸°'}
                        {searchedFileType === 'tongsin' && '?µì‹ '}
                        {searchedFileType === 'sobang' && '?Œë°©'}
                      </div>
                      <button onClick={handleCopyAll} className="copy-all-button">?„ì²´ ë³µì‚¬</button>
                    </>
                  )}
                </div>
                {selectedCompany ? (
                  <div className="table-container">
                    <table className="details-table">
                      <tbody>
                        {DISPLAY_ORDER.map((key) => {
                          const value = selectedCompany[key] ?? 'N/A';
                          const status = selectedCompany.?°ì´?°ìƒ??.[key] ? selectedCompany.?°ì´?°ìƒ??key] : 'ë¯¸ì???;
                          let displayValue;
                          const percentageKeys = ['ë¶€ì±„ë¹„??, '? ë™ë¹„ìœ¨'];
                          const formattedKeys = ['?œí‰', '3???¤ì ', '5???¤ì '];
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
                                  <button onClick={() => handleCopySingle(key, displayValue)} className="copy-single-button" title={`${key} ë³µì‚¬`}>ë³µì‚¬</button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (<p>?¼ìª½ ëª©ë¡?ì„œ ?…ì²´ë¥?? íƒ?˜ì„¸??</p>)}
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

