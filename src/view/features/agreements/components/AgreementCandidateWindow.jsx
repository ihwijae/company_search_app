import React from 'react';
import CompanySearchModal from '../../../../components/CompanySearchModal.jsx';

export default function AgreementCandidateWindow({
  entries = [],
  query = '',
  onQueryChange = () => {},
  onOpenSearch = () => {},
  searchOpen = false,
  searchFileType = '',
  onCloseSearch = () => {},
  onPickSearch = () => {},
  selectedUid = null,
  onSelect = () => {},
  onDelete = () => {},
  onClose = () => {},
  onDragStart = () => () => {},
  onDragEnd = () => {},
  draggingId = null,
  performanceAmountLabel = '실적',
  managementMax = 15,
  formatAmount = (value) => String(value ?? ''),
  formatScore = (value) => String(value ?? ''),
}) {
  const renderAwardHistoryMark = (active) => (active ? (
    <span
      aria-label="낙찰이력 있음"
      title="공고일 기준 1년 이내 낙찰이력 있음"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 18,
        height: 18,
        marginLeft: 6,
        borderRadius: '999px',
        background: '#dc2626',
        color: '#ffffff',
        fontSize: 12,
        fontWeight: 800,
        lineHeight: 1,
        verticalAlign: 'middle',
      }}
    >
      !
    </span>
  ) : null);

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
        <div className="agreement-candidate-window__search-actions">
          <button type="button" className="excel-btn" onClick={onOpenSearch}>업체 검색</button>
        </div>
        <input
          className="input"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="업체명, 담당자, 지역 검색"
        />
        <div className="agreement-candidate-window__count">
          후보 {entries.length}건
        </div>
      </div>
      <div className="agreement-candidate-window__body">
        {entries.length === 0 ? (
          <div className="agreement-candidate-window__empty">표시할 후보가 없습니다.</div>
        ) : (
          <div className="agreement-candidate-table-wrap">
            <table className="agreement-candidate-table">
              <thead>
                <tr>
                  <th>업체명</th>
                  <th>경영</th>
                  <th>{performanceAmountLabel}</th>
                  <th>시평액</th>
                  <th>상태</th>
                  <th>작업</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr
                    key={entry.uid}
                    className={`${entry.isDutyRegion ? ' duty-region' : ''}${draggingId === entry.uid ? ' dragging' : ''}${selectedUid === entry.uid ? ' selected' : ''}`}
                    draggable
                    onClick={() => onSelect(entry.uid)}
                    onDragStart={onDragStart(entry.uid)}
                    onDragEnd={onDragEnd}
                  >
                    {(() => {
                      const managementWarn = Boolean(entry.managementAlert);
                      return (
                        <>
                    <td className="agreement-candidate-table__company">
                      <strong
                        title={entry.companyName}
                        style={entry.hasRecentAwardHistory ? { color: '#b91c1c', fontWeight: 800 } : undefined}
                      >
                        {entry.companyName}
                        {renderAwardHistoryMark(entry.hasRecentAwardHistory)}
                      </strong>
                      <div className="agreement-candidate-table__meta-badges">
                        {entry.hasRecentAwardHistory && (
                          <span className="agreement-candidate-table__meta-badge" style={{ color: '#b91c1c', borderColor: '#fecaca', background: '#fef2f2' }}>
                            낙찰이력
                          </span>
                        )}
                        {entry.isTempCompany && (
                          <span className="agreement-candidate-table__meta-badge" style={{ color: '#9a3412', borderColor: '#fdba74', background: '#fff7ed' }}>
                            임시
                          </span>
                        )}
                        {entry.regionLabel && (
                          <span className="agreement-candidate-table__meta-badge">{entry.regionLabel}</span>
                        )}
                        {entry.managerName && (
                          <span className="agreement-candidate-table__meta-badge">{entry.managerName}</span>
                        )}
                        {entry.possibleShareText && (
                          <span className="agreement-candidate-table__meta-badge share">가능 {entry.possibleShareText}</span>
                        )}
                      </div>
                    </td>
                    <td className="agreement-candidate-table__management">
                      {managementWarn ? (
                        <strong style={{ color: '#b91c1c', fontWeight: 700 }}>
                          {entry.managementScore != null ? formatScore(entry.managementScore, 2) : '-'}
                        </strong>
                      ) : (
                        <span>{entry.managementScore != null ? formatScore(entry.managementScore, 2) : '-'}</span>
                      )}
                    </td>
                    <td>{entry.performanceAmount != null ? formatAmount(entry.performanceAmount) : '-'}</td>
                    <td>{entry.sipyungAmount != null ? formatAmount(entry.sipyungAmount) : '-'}</td>
                    <td>
                      {entry.isDutyRegion && <span className="agreement-candidate-table__pill region">지역사</span>}
                    </td>
                    <td>
                      <div className="agreement-candidate-table__actions">
                        <button
                          type="button"
                          className={`excel-btn${selectedUid === entry.uid ? ' primary' : ''}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            onSelect(entry.uid);
                          }}
                        >
                          {selectedUid === entry.uid ? '선택중' : '선택'}
                        </button>
                        {!entry.synthetic && (
                          <button
                            type="button"
                            className="excel-btn"
                            onClick={(event) => {
                              event.stopPropagation();
                              onDelete(entry.uid);
                            }}
                          >
                            삭제
                          </button>
                        )}
                      </div>
                    </td>
                        </>
                      );
                    })()}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {searchOpen && (
        <CompanySearchModal
          open={searchOpen}
          onClose={onCloseSearch}
          onPick={onPickSearch}
          fileType={searchFileType}
          allowAll={false}
        />
      )}
    </div>
  );
}
