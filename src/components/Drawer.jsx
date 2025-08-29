import React from 'react';

export default function Drawer({ open, onClose, children }) {
  return (
    <>
      <div className={`drawer ${open ? 'open' : ''}`} role="dialog" aria-modal="true">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <strong>관리자 파일 업로드</strong>
          <button onClick={onClose}>닫기</button>
        </div>
        {children}
      </div>
      <div className="drawer-overlay" onClick={onClose} />
    </>
  );
}

