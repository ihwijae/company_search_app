import React from 'react';

export default function TechnicianScoreWindow({
  technicianTarget,
  technicianTargetOptions = [],
  onTargetChange,
  technicianScoreTotal = 0,
  technicianEditable = true,
  onAddTechnicianEntry,
  technicianEntries = [],
  onUpdateTechnicianEntry,
  onRemoveTechnicianEntry,
  onSave,
  onClose,
  formatTechnicianScore,
  computeTechnicianScore,
  gradeOptions = [],
  careerOptions = [],
  managementOptions = [],
}) {
  return (
    <div style={{ height: '100%', background: '#f8fafc', color: '#0f172a', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
      >
        <strong>기술자점수 계산</strong>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="excel-btn" onClick={onSave} disabled={!technicianEditable}>저장</button>
          <button type="button" className="excel-btn" onClick={onClose}>닫기</button>
        </div>
      </div>
      <div style={{ padding: 16, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, color: '#475569' }}>적용 대상</span>
            <select
              className="filter-input"
              value={`${technicianTarget.groupIndex}:${technicianTarget.slotIndex}`}
              onChange={(event) => {
                const [groupIndex, slotIndex] = event.target.value.split(':').map((v) => Number(v));
                onTargetChange({ groupIndex, slotIndex });
              }}
            >
              {technicianTargetOptions.map((option) => (
                <option key={option.key} value={option.key}>{option.label}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, color: '#475569' }}>총점</span>
            <strong style={{ fontSize: 18, color: '#0f172a' }}>{formatTechnicianScore(technicianScoreTotal)}점</strong>
          </div>
          <button
            type="button"
            className="excel-btn"
            onClick={onAddTechnicianEntry}
            disabled={!technicianEditable}
          >
            기술자 추가
          </button>
        </div>
        {!technicianEditable && (
          <div style={{ fontSize: 12, color: '#b91c1c' }}>
            소방 공종은 기술자점수가 평가제외입니다.
          </div>
        )}
        {technicianEntries.length === 0 && (
          <div style={{ padding: 12, border: '1px dashed #cbd5f5', borderRadius: 10, color: '#64748b' }}>
            추가된 기술자가 없습니다. "기술자 추가" 버튼을 눌러 입력을 시작하세요.
          </div>
        )}
        {technicianEntries.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '120px 160px 160px 80px 1fr auto',
              gap: 10,
              alignItems: 'center',
              fontSize: 12,
              color: '#64748b',
              fontWeight: 600,
            }}
          >
            <div>등급계수</div>
            <div>경력계수</div>
            <div>관리능력계수</div>
            <div>인원</div>
            <div>점수</div>
            <div />
          </div>
        )}
        {technicianEntries.map((entry) => (
          <div
            key={entry.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '120px 160px 160px 80px 1fr auto',
              gap: 10,
              alignItems: 'center',
            }}
          >
            <select
              className="filter-input"
              value={entry.grade}
              onChange={(event) => onUpdateTechnicianEntry(entry.id, 'grade', event.target.value)}
            >
              <option value="">등급을 선택하세요</option>
              {gradeOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <select
              className="filter-input"
              value={entry.careerCoeff}
              onChange={(event) => onUpdateTechnicianEntry(entry.id, 'careerCoeff', event.target.value)}
            >
              {careerOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <select
              className="filter-input"
              value={entry.managementCoeff}
              onChange={(event) => onUpdateTechnicianEntry(entry.id, 'managementCoeff', event.target.value)}
            >
              {managementOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <input
              className="filter-input"
              value={entry.count}
              onChange={(event) => onUpdateTechnicianEntry(entry.id, 'count', event.target.value.replace(/[^0-9]/g, ''))}
              placeholder="인원"
            />
            <div style={{ fontSize: 13, color: '#0f172a' }}>
              점수 {formatTechnicianScore(computeTechnicianScore(entry))}
            </div>
            <button type="button" className="excel-btn" onClick={() => onRemoveTechnicianEntry(entry.id)}>삭제</button>
          </div>
        ))}
      </div>
    </div>
  );
}
