import React from 'react';

export default function AgreementCandidateWindow({
  entries = [],
  query = '',
  onQueryChange = () => {},
  onAssign = () => {},
  onDelete = () => {},
  onClose = () => {},
  onDragStart = () => () => {},
  onDragEnd = () => {},
  draggingId = null,
  performanceAmountLabel = '실적',
  formatAmount = (value) => String(value ?? ''),
  formatScore = (value) => String(value ?? ''),
}) {
  return (
    <div className="agreement-candidate-window">
      <div className="agreement-candidate-window__header">
        <div>
          <strong>후보 보관함</strong>
          <p>협정테이블을 가리지 않는 별도 창입니다. 드래그하거나 바로 넣기로 배치하세요.</p>
        </div>
        <button type="button" className="agreement-candidate-window__close" onClick={onClose}>닫기</button>
      </div>
      <div className="agreement-candidate-window__search">
        <input
          className="input"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="업체명, 담당자, 지역, 연락처 검색"
        />
        <div className="agreement-candidate-window__count">
          후보 {entries.length}건
        </div>
      </div>
      <div className="agreement-candidate-window__body">
        {entries.length === 0 ? (
          <div className="agreement-candidate-window__empty">표시할 후보가 없습니다.</div>
        ) : entries.map((entry) => (
          <div
            key={entry.uid}
            className={`agreement-candidate-card${entry.isDutyRegion ? ' duty-region' : ''}${draggingId === entry.uid ? ' dragging' : ''}`}
            draggable
            onDragStart={onDragStart(entry.uid)}
            onDragEnd={onDragEnd}
          >
            <div className="agreement-candidate-card__top">
              <div className="agreement-candidate-card__title-wrap">
                <strong className="agreement-candidate-card__title" title={entry.companyName}>{entry.companyName}</strong>
                <div className="agreement-candidate-card__badges">
                  {entry.isDutyRegion && <span className="agreement-candidate-card__badge region">지역사</span>}
                  {entry.creditGrade && <span className="agreement-candidate-card__badge">{entry.creditGrade}</span>}
                </div>
              </div>
              <div className="agreement-candidate-card__actions">
                <button type="button" className="excel-btn" onClick={() => onAssign(entry.uid)}>바로 넣기</button>
                {!entry.synthetic && (
                  <button type="button" className="excel-btn" onClick={() => onDelete(entry.uid)}>삭제</button>
                )}
              </div>
            </div>
            <div className="agreement-candidate-card__meta">
              <span>{entry.regionLabel || '지역 미지정'}</span>
              <span>{entry.managerName || '담당자 미지정'}</span>
              {entry.phoneNumber && <span>{entry.phoneNumber}</span>}
            </div>
            <div className="agreement-candidate-card__stats">
              <div>
                <span>경영</span>
                <strong>{entry.managementScore != null ? formatScore(entry.managementScore, 2) : '-'}</strong>
              </div>
              <div>
                <span>{performanceAmountLabel}</span>
                <strong>{entry.performanceAmount != null ? formatAmount(entry.performanceAmount) : '-'}</strong>
              </div>
              <div>
                <span>시평액</span>
                <strong>{entry.sipyungAmount != null ? formatAmount(entry.sipyungAmount) : '-'}</strong>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
