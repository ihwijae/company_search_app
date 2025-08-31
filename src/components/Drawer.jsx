import React from 'react';

export default function Drawer({ open, onClose, children }) {
  const [paths, setPaths] = React.useState({ eung: '', tongsin: '', sobang: '' });

  React.useEffect(() => {
    if (!open) return;
    let unsubscribe = null;
    const load = async () => {
      try {
        const res = await window.electronAPI?.getFilePaths?.();
        if (res) setPaths(res.data || res);
      } catch {}
    };
    load();
    try {
      if (window.electronAPI?.onDataUpdated) {
        unsubscribe = window.electronAPI.onDataUpdated(() => load());
      }
    } catch {}
    return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
  }, [open]);

  return (
    <>
      <div className={`drawer ${open ? 'open' : ''}`} role="dialog" aria-modal="true">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <strong>관리자 파일 업로드</strong>
          <button onClick={onClose}>닫기</button>
        </div>
        <div className="upload-message info" style={{ marginBottom: 8 }}>
          <div><strong>전기</strong>: {paths.eung || '-'}</div>
          <div><strong>통신</strong>: {paths.tongsin || '-'}</div>
          <div><strong>소방</strong>: {paths.sobang || '-'}</div>
        </div>
        {children}
      </div>
      <div className="drawer-overlay" onClick={onClose} />
    </>
  );
}

