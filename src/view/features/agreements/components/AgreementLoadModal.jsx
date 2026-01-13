import React from 'react';

export default function AgreementLoadModal({
  open,
  onClose,
  filters,
  setFilters,
  rootPath,
  onPickRoot,
  dutyRegionOptions,
  rangeOptions,
  agreementGroups,
  industryOptions,
  items,
  busy,
  error,
  onLoad,
  onDelete,
  onResetFilters,
  formatAmount,
}) {
  if (!open) return null;

  const pageSize = 5;
  const [currentPage, setCurrentPage] = React.useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const pagedItems = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [currentPage, items]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  React.useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const resolveIndustryBadgeClass = (label) => {
    const value = String(label || '');
    if (value.includes('전기')) return 'agreement-badge agreement-badge--eung';
    if (value.includes('통신')) return 'agreement-badge agreement-badge--tongsin';
    if (value.includes('소방')) return 'agreement-badge agreement-badge--sobang';
    return 'agreement-badge';
  };

  return (
    <div className="agreement-load-overlay" onClick={onClose}>
      <div className="agreement-load-modal" onClick={(event) => event.stopPropagation()}>
        <div className="agreement-load-header">
          <div>
            <h3>협정 불러오기</h3>
            <p>필터를 선택해서 원하는 협정을 찾으세요.</p>
          </div>
          <button type="button" className="agreement-load-close" onClick={onClose}>×</button>
        </div>
        <div className="agreement-load-root">
          <div className="agreement-load-root__info">
            <span>저장 폴더</span>
            <strong>{rootPath || '경로를 선택해 주세요.'}</strong>
          </div>
          <button type="button" className="excel-btn" onClick={onPickRoot}>폴더 변경</button>
        </div>
        <div className="agreement-load-filters">
          <label>
            <span>발주처</span>
            <select
              value={filters.ownerId}
              onChange={(event) => setFilters((prev) => ({ ...prev, ownerId: event.target.value }))}
            >
              <option value="">전체</option>
              {agreementGroups.map((group) => (
                <option key={group.ownerId} value={group.ownerId}>{group.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span>금액 구간</span>
            <select
              value={filters.rangeId}
              onChange={(event) => setFilters((prev) => ({ ...prev, rangeId: event.target.value }))}
            >
              <option value="">전체</option>
              {rangeOptions.map((item) => (
                <option key={item.key} value={item.key}>{item.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span>공종</span>
            <select
              value={filters.industryLabel}
              onChange={(event) => setFilters((prev) => ({ ...prev, industryLabel: event.target.value }))}
            >
              <option value="">전체</option>
              {industryOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
          <label>
            <span>의무지역</span>
            <select
              value={filters.dutyRegion}
              onChange={(event) => setFilters((prev) => ({ ...prev, dutyRegion: event.target.value }))}
            >
              <option value="">전체</option>
              {dutyRegionOptions.map((region) => (
                <option key={region} value={region}>{region}</option>
              ))}
            </select>
          </label>
          <label>
            <span>추정금액 최소</span>
            <input
              value={filters.amountMin}
              onChange={(event) => setFilters((prev) => ({ ...prev, amountMin: event.target.value }))}
              placeholder="예: 5000000000"
            />
          </label>
          <label>
            <span>추정금액 최대</span>
            <input
              value={filters.amountMax}
              onChange={(event) => setFilters((prev) => ({ ...prev, amountMax: event.target.value }))}
              placeholder="예: 10000000000"
            />
          </label>
          <button type="button" className="excel-btn" onClick={onResetFilters}>필터 초기화</button>
        </div>
        <div className="agreement-load-list">
          {busy && <div className="agreement-load-empty">불러오는 중...</div>}
          {!busy && error && <div className="agreement-load-error">{error}</div>}
          {!busy && !error && items.length === 0 && (
            <div className="agreement-load-empty">조건에 맞는 협정이 없습니다.</div>
          )}
          {!busy && !error && pagedItems.map((item) => {
            const meta = item.meta || {};
            const noticeTitle = [meta.noticeNo, meta.noticeTitle].filter(Boolean).join('-');
            const dutyRegions = Array.isArray(meta.dutyRegions) ? meta.dutyRegions.filter(Boolean) : [];
            const amountLabel = meta.estimatedAmount != null
              ? formatAmount(meta.estimatedAmount)
              : (meta.estimatedAmountLabel || '-');
            return (
              <div key={item.path} className="agreement-load-item">
                <div className="agreement-load-main">
                  <div className="agreement-load-title">
                    <strong>{noticeTitle || meta.noticeTitle || meta.noticeNo || '협정'}</strong>
                    {(meta.ownerLabel || meta.ownerId) && (
                      <span className="agreement-badge">{meta.ownerLabel || meta.ownerId}</span>
                    )}
                    {(meta.rangeLabel || meta.rangeId) && (
                      <span className="agreement-badge">{meta.rangeLabel || meta.rangeId}</span>
                    )}
                    {meta.industryLabel && (
                      <span className={resolveIndustryBadgeClass(meta.industryLabel)}>
                        {meta.industryLabel}
                      </span>
                    )}
                    {dutyRegions.map((region) => (
                      <span key={region} className="agreement-badge">{region}</span>
                    ))}
                  </div>
                  <div className="agreement-load-meta">
                    <span>추정금액 {amountLabel || '-'}</span>
                    <span>개찰일 {meta.noticeDate || '-'}</span>
                  </div>
                </div>
                <div className="agreement-load-actions">
                  <button type="button" className="excel-btn primary" onClick={() => onLoad(item.path)}>불러오기</button>
                  <button type="button" className="excel-btn" onClick={() => onDelete(item.path)}>삭제</button>
                </div>
              </div>
            );
          })}
        </div>
        {!busy && !error && items.length > 0 && (
          <div className="agreement-load-pagination">
            <div className="agreement-load-pagination__info">
              총 {items.length}건 · {currentPage} / {totalPages} 페이지
            </div>
            <div className="agreement-load-pagination__actions">
              <button
                type="button"
                className="excel-btn"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage <= 1}
              >
                처음
              </button>
              <button
                type="button"
                className="excel-btn"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage <= 1}
              >
                이전
              </button>
              <button
                type="button"
                className="excel-btn"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage >= totalPages}
              >
                다음
              </button>
              <button
                type="button"
                className="excel-btn"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage >= totalPages}
              >
                끝
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
