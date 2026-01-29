import React, { useEffect, useState } from 'react';
import {
  isWomenOwnedCompany,
  getQualityBadgeText,
  extractManagerNames,
  getCandidateTextField,
} from '../utils/companyIndicators.js';

const FILE_TYPE_LABELS = {
  eung: '전기',
  tongsin: '통신',
  sobang: '소방',
};

const normalizeFileType = (value) => {
  const token = String(value ?? '').trim();
  if (!token) return '';
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
  return ({ eung: 'eung', tongsin: 'tongsin', sobang: 'sobang', all: 'all' })[lowered] || '';
};

export default function CompanySearchModal({
  open,
  fileType,
  onClose,
  onPick,
  initialQuery = '',
  allowAll = true,
}) {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setQ(initialQuery || '');
    } else {
      setQ(''); setResults([]); setError('');
    }
  }, [open, initialQuery]);

  const handleSearch = async (overrideQuery) => {
    setLoading(true); setError(''); setResults([]);
    try {
      const query = overrideQuery !== undefined ? String(overrideQuery) : q;
      const criteria = { name: String(query || '').trim() };
      const normalizedType = normalizeFileType(fileType);
      const effectiveType = normalizedType || (allowAll ? 'all' : '');
      if (!effectiveType) {
        throw new Error('공종을 먼저 선택하세요.');
      }
      const r = await window.electronAPI.searchCompanies(criteria, effectiveType);
      if (!r?.success) throw new Error(r?.message || '검색 실패');
      setResults(r.data || []);
    } catch (e) { setError(String(e.message || e)); }
    finally { setLoading(false); }
  };

  // Open 시 initialQuery가 있으면 자동 검색 실행
  useEffect(() => {
    if (open && (initialQuery || '').trim()) {
      handleSearch(initialQuery);
    }
  }, [open, initialQuery]);

  if (!open) return null;
  return (
    <div className="company-search-backdrop" onClick={onClose}>
      <div className="company-search-modal" onClick={(e) => e.stopPropagation()}>
        <div className="company-search-header">
          <div>
            <h3>업체 조회</h3>
            <p>업체명으로 검색 후 원하는 업체를 선택하세요.</p>
          </div>
          {fileType && (
            <span className={`company-search-badge company-search-badge-${normalizeFileType(fileType)}`}>
              {FILE_TYPE_LABELS[normalizeFileType(fileType)] || '전체'}
            </span>
          )}
        </div>
        <div className="company-search-bar">
          <div className="company-search-input">
            <input
              placeholder="업체명 또는 일부"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
            />
            <button
              className="btn-soft"
              onClick={() => handleSearch()}
              disabled={loading || !q.trim()}
            >
              검색
            </button>
          </div>
          {error && <div className="error-message">{error}</div>}
        </div>
        <div className="company-search-table">
          <table className="details-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '40%' }}>업체명</th>
                <th style={{ width: '18%' }}>대표자</th>
                <th style={{ width: '16%' }}>지역</th>
                <th style={{ width: '18%' }}>사업자번호</th>
                <th style={{ width: '8%', textAlign: 'center' }}></th>
              </tr>
            </thead>
            <tbody>
              {(results || []).map((c, idx) => {
                const companyName = getCandidateTextField(c, ['검색된 회사', '업체명', 'name'])
                  || c['검색된 회사']
                  || c.name
                  || '';
                const representative = getCandidateTextField(c, ['대표자', '대표자명']) || c['대표자'] || '';
                const region = getCandidateTextField(c, ['대표지역', '지역']) || c['대표지역'] || c['지역'] || '';
                const bizNo = getCandidateTextField(c, ['사업자번호', 'bizNo']) || c['사업자번호'] || '';
                const managerNames = extractManagerNames(c);
                const femaleOwned = isWomenOwnedCompany(c);
                const qualityBadge = getQualityBadgeText(c);
                let typeKey = String(c._file_type || '').toLowerCase();
                if (!FILE_TYPE_LABELS[typeKey]) {
                  const fallbackKey = String(fileType || '').toLowerCase();
                  if (FILE_TYPE_LABELS[fallbackKey]) typeKey = fallbackKey;
                }
                const typeLabel = FILE_TYPE_LABELS[typeKey] || '';
                return (
                  <tr key={idx}>
                    <td>
                      <div className="company-cell">
                        <div className="company-name-line">
                          <span className="company-name-text">{companyName}</span>
                          {typeLabel && (
                            <span className={`file-type-badge-small file-type-${typeKey}`}>
                              {typeLabel}
                            </span>
                          )}
                          {femaleOwned && <span className="badge-female badge-inline">女</span>}
                          {qualityBadge && <span className="badge-quality badge-inline">품질평가 {qualityBadge}</span>}
                        </div>
                        {managerNames.length > 0 && (
                          <div className="company-manager-badges">
                            {managerNames.map((name) => (
                              <span key={`${idx}-${name}`} className="badge-person">{name}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>{representative}</td>
                    <td>{region}</td>
                    <td>{bizNo}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="btn-sm btn-soft"
                        style={{ minWidth: 64, whiteSpace: 'nowrap', height: 32 }}
                        onClick={() => {
                          if (!onPick) return;
                          const effectiveType = fileType || (allowAll ? 'all' : '');
                          const snapshot = { ...c };
                          const payload = {
                            bizNo,
                            name: companyName,
                            snapshot,
                            fileType: effectiveType,
                          };
                          onPick(payload);
                        }}
                      >선택</button>
                    </td>
                  </tr>
                );
              })}
              {(!results || results.length === 0) && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: 16, color: '#6b7280' }}>
                    {loading ? '검색 중...' : '검색 결과가 없습니다'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="company-search-footer">
          <button className="btn-muted" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}
