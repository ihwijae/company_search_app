import React from 'react';

export default function AgreementLoadModal({
  open,
  onClose,
  filters,
  setFilters,
  rootPath,
  onPickRoot,
  rangeOptions,
  agreementGroups,
  industryOptions,
  items,
  busy,
  error,
  onLoad,
  onResetFilters,
  formatAmount,
}) {
  if (!open) return null;

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
            <input
              value={filters.dutyRegion}
              onChange={(event) => setFilters((prev) => ({ ...prev, dutyRegion: event.target.value }))}
              placeholder="예: 서울"
            />
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
          {!busy && !error && items.map((item) => {
            const meta = item.meta || {};
            const amountLabel = meta.estimatedAmount != null
              ? formatAmount(meta.estimatedAmount)
              : (meta.estimatedAmountLabel || '-');
            return (
              <div key={item.path} className="agreement-load-item">
                <div className="agreement-load-main">
                  <div className="agreement-load-title">
                    <strong>{meta.ownerLabel || meta.ownerId || '발주처'}</strong>
                    <span>{meta.rangeLabel || meta.rangeId || '구간'}</span>
                    {meta.industryLabel && <span>{meta.industryLabel}</span>}
                  </div>
                  <div className="agreement-load-meta">
                    <span>추정금액 {amountLabel || '-'}</span>
                    <span>개찰일 {meta.noticeDate || '-'}</span>
                  </div>
                </div>
                <button type="button" className="excel-btn primary" onClick={() => onLoad(item.path)}>불러오기</button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
