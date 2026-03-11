import React from 'react';

export default function LhAwardHistoryWindow({
  onClose = () => {},
  content = '',
}) {
  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: '#f8fafc',
      color: '#0f172a',
      fontFamily: '"Noto Sans KR", "Malgun Gothic", sans-serif',
    }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 16,
        padding: '18px 20px 14px',
        borderBottom: '1px solid #dbe4ee',
        background: '#ffffff',
      }}
      >
        <div>
          <strong style={{ fontSize: 16 }}>낙찰이력업체</strong>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#475569' }}>
            공고일 기준 1년 이내 계약 이력이 있으면 협정보드에서 업체명을 빨간색으로 강조합니다.
          </p>
        </div>
        <button type="button" className="excel-btn" onClick={onClose}>닫기</button>
      </div>
      <div style={{ flex: 1, minHeight: 0, padding: 20 }}>
        <pre style={{
          margin: 0,
          height: '100%',
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
          fontFamily: '"D2Coding", "Consolas", monospace',
          fontSize: 13,
          lineHeight: 1.7,
          background: '#ffffff',
          border: '1px solid #dbe4ee',
          borderRadius: 12,
          padding: 18,
        }}
        >
          {content}
        </pre>
      </div>
    </div>
  );
}
