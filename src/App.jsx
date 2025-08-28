// src/App.jsx (지역 목록 갱신 및 로그 기능이 추가된 최종 버전)

import React, { useState, useEffect, useRef } from 'react';

// --- Helper Functions & Components (변경 없음) ---
const formatNumber = (value) => { if (!value && value !== 0) return ''; const num = String(value).replace(/,/g, ''); return isNaN(num) ? String(value) : Number(num).toLocaleString(); };
const unformatNumber = (value) => String(value).replace(/,/g, '');
const formatPercentage = (value) => { if (!value && value !== 0) return ''; const num = Number(String(value).replace(/,/g, '')); if (isNaN(num)) return String(value); return num.toFixed(2) + '%'; };
const getStatusClass = (statusText) => { if (statusText === '최신') return 'status-latest'; if (statusText === '1년 경과') return 'status-warning'; if (statusText === '1년 이상 경과') return 'status-old'; return 'status-unknown'; };

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

function App() {
  const [fileStatuses, setFileStatuses] = useState({ eung: false, tongsin: false, sobang: false });
  const [uploadCount, setUploadCount] = useState(0); // [추가] 파일 선택 성공을 감지할 카운터
  const [filters, setFilters] = useState({ name: '', region: '전체', manager: '', min_sipyung: '', max_sipyung: '', min_3y: '', max_3y: '', min_5y: '', max_5y: '' });
  const [fileType, setFileType] = useState('eung');
  const [searchedFileType, setSearchedFileType] = useState('eung');
  const [regions, setRegions] = useState(['전체']);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
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
  
  // [추가] 파일 선택이 성공하면 이 함수가 호출됩니다.
  const handleUploadSuccess = () => {
    console.log('[프론트엔드 LOG] 파일 선택 성공! 갱신 트리거를 당깁니다.');
    refreshFileStatuses();
    setUploadCount(prev => prev + 1); // 카운터를 증가시켜 useEffect를 다시 실행시킵니다.
  };

  useEffect(() => {
    const fetchRegions = async () => {
      console.log(`[프론트엔드 LOG] 지역 목록(${fileType}) 가져오기 요청을 보냅니다. (트리거: uploadCount=${uploadCount})`);
      const statuses = await window.electronAPI.checkFiles();
      if (statuses[fileType]) {
        const response = await window.electronAPI.getRegions(fileType);
        console.log('[프론트엔드 LOG] 백엔드로부터 받은 응답:', response);
        if (response.success) {
          setRegions(response.data);
        } else {
          setRegions(['전체']);
        }
      } else {
        setRegions(['전체']);
      }
    };
    fetchRegions();
  }, [fileType, uploadCount]); // [수정] uploadCount가 바뀔 때마다 이 함수가 다시 실행됩니다.

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
      setError(`검색 오류: ${err.message}`);
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
  const handleCopySingle = (key, value) => { navigator.clipboard.writeText(String(value)); setDialog({ isOpen: true, message: `'${key}' 항목이 복사되었습니다.` }); };
  const handleCopyAll = () => {
    if (!selectedCompany) return;
    const textToCopy = DISPLAY_ORDER.map(key => { const value = selectedCompany[key] ?? ''; const formattedKeys = ['시평', '3년 실적', '5년 실적']; return formattedKeys.includes(key) ? formatNumber(value) : String(value); }).join('\n');
    navigator.clipboard.writeText(textToCopy);
    setDialog({ isOpen: true, message: '전체 정보가 클립보드에 복사되었습니다!' });
  };

  return (
    <div className="app-container">
      <h1 className="main-title">업체 검색 및 적격 심사</h1>
      <AdminUpload fileStatuses={fileStatuses} onUploadSuccess={handleUploadSuccess} />
      <div className="main-content-layout">
        <div className="left-panel">
          <div className="search-filter-section" ref={topSectionRef}>
            <div className="file-type-selector">
              <h3>검색 대상</h3>
              <div className="radio-group">
                <label><input type="radio" value="eung" checked={fileType === 'eung'} onChange={(e) => setFileType(e.target.value)} /> 전기</label>
                <label><input type="radio" value="tongsin" checked={fileType === 'tongsin'} onChange={(e) => setFileType(e.target.value)} /> 통신</label>
                <label><input type="radio" value="sobang" checked={fileType === 'sobang'} onChange={(e) => setFileType(e.target.value)} /> 소방</label>
              </div>
            </div>
            <div className="filter-grid">
                <div className="filter-item"><label>업체명</label><input type="text" name="name" value={filters.name} onChange={handleFilterChange} onKeyDown={handleKeyDown} className="filter-input" /></div>
                <div className="filter-item"><label>지역</label><select name="region" value={filters.region} onChange={handleFilterChange} className="filter-input">{regions.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
                <div className="filter-item"><label>담당자</label><input type="text" name="manager" value={filters.manager} onChange={handleFilterChange} className="filter-input" /></div>
                <div className="filter-item range"><label>시평액 범위</label><div className="range-inputs"><input type="text" name="min_sipyung" value={filters.min_sipyung} onChange={handleFilterChange} placeholder="최소" className="filter-input" /><span>~</span><input type="text" name="max_sipyung" value={filters.max_sipyung} onChange={handleFilterChange} placeholder="최대" className="filter-input" /></div></div>
                <div className="filter-item range"><label>3년 실적 범위</label><div className="range-inputs"><input type="text" name="min_3y" value={filters.min_3y} onChange={handleFilterChange} placeholder="최소" className="filter-input" /><span>~</span><input type="text" name="max_3y" value={filters.max_3y} onChange={handleFilterChange} placeholder="최대" className="filter-input" /></div></div>
                <div className="filter-item range"><label>5년 실적 범위</label><div className="range-inputs"><input type="text" name="min_5y" value={filters.min_5y} onChange={handleFilterChange} placeholder="최소" className="filter-input" /><span>~</span><input type="text" name="max_5y" value={filters.max_5y} onChange={handleFilterChange} placeholder="최대" className="filter-input" /></div></div>
                <div className="filter-item"><label>&nbsp;</label><button onClick={handleSearch} className="search-button" disabled={isLoading}>{isLoading ? '검색 중...' : '검색'}</button></div>
            </div>
          </div>
          {searchPerformed && (
            <div className="search-results-list" ref={searchResultsRef}>
              <h2 className="sub-title">검색 결과 ({searchResults.length}개)</h2>
              {isLoading && <p>로딩 중...</p>}
              {error && <p className="error-message">{error}</p>}
              {!isLoading && !error && searchResults.length === 0 && <p>검색 결과가 없습니다.</p>}
              <ul>
                {searchResults.map((company, index) => {
                  const isActive = selectedCompany && selectedCompany.사업자번호 === company.사업자번호;
                  const summaryStatus = company['요약상태'] || '미지정';
                  const fileTypeLabel = searchedFileType === 'eung' ? '전기' : searchedFileType === 'tongsin' ? '통신' : '소방';
                  return (
                    <li key={index} onClick={() => handleCompanySelect(company)} className={`company-list-item ${isActive ? 'active' : ''}`}>
                      <div className="company-info-wrapper">
                        <span className={`file-type-badge-small file-type-${searchedFileType}`}>{fileTypeLabel}</span>
                        <span className="company-name">{company['검색된 회사']}</span>
                      </div>
                      <span className={`summary-status-badge ${getStatusClass(summaryStatus)}`}>{summaryStatus}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
        <div className="right-panel">
          {searchPerformed && (
            <div className="company-details fade-in" key={animationKey}>
              <div className="details-header">
                <h2 className="sub-title">업체 상세 정보</h2>
                {selectedCompany && (
                  <>
                    <div className={`file-type-badge file-type-${searchedFileType}`}>
                      {searchedFileType === 'eung' && '전기'}
                      {searchedFileType === 'tongsin' && '통신'}
                      {searchedFileType === 'sobang' && '소방'}
                    </div>
                    <button onClick={handleCopyAll} className="copy-all-button">전체 복사</button>
                  </>
                )}
              </div>
              {selectedCompany ? (
                <div className="table-container">
                  <table className="details-table">
                    <tbody>
                      {DISPLAY_ORDER.map((key) => {
                        const value = selectedCompany[key] ?? 'N/A';
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
              ) : (<p>왼쪽 목록에서 업체를 선택하세요.</p>)}
            </div>
          )}
        </div>
      </div>
      <CopyDialog 
        isOpen={dialog.isOpen} 
        message={dialog.message} 
        onClose={() => setDialog({ isOpen: false, message: '' })} 
      />
    </div>
  );
}

export default App;