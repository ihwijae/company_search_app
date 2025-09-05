import React from 'react';

export default function Sidebar({ active, onSelect, fileStatuses, collapsed = true }) {
  const anyLoaded = !!(fileStatuses?.eung || fileStatuses?.tongsin || fileStatuses?.sobang);
  const [lhOpen, setLhOpen] = React.useState(false);
  const [forceExpand, setForceExpand] = React.useState(false);

  // Helper to toggle app-shell wide mode
  const setAppShellWide = (on) => {
    try {
      const shell = document.querySelector('.app-shell');
      if (!shell) return;
      if (on) shell.classList.add('sidebar-wide');
      else shell.classList.remove('sidebar-wide');
    } catch {}
  };

  // Close LH and collapse sidebar-wide
  const closeLh = React.useCallback(() => {
    setLhOpen(false);
    setForceExpand(false);
    setAppShellWide(false);
  }, []);

  // 해시 경로에 LH가 포함되면 자동으로 펼침
  React.useEffect(() => {
    const sync = () => {
      const h = window.location.hash || '';
      const shouldOpen = h.includes('/lh/');
      setLhOpen(shouldOpen);
      setForceExpand(shouldOpen);
      setAppShellWide(shouldOpen);
    };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  // Click outside to collapse when LH open
  React.useEffect(() => {
    if (!lhOpen) return;
    const onDocClick = (e) => {
      const aside = document.querySelector('aside.sidebar');
      if (!aside) return;
      if (!aside.contains(e.target)) {
        closeLh();
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [lhOpen, closeLh]);

  const item = (key, label, icon) => (
    <div
      key={key}
      className={`nav-item ${active === key ? 'active' : ''}`}
      onClick={() => onSelect && onSelect(key)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect && onSelect(key); }}
    >
      <span style={{ width: 28, fontSize: 22 }}>{icon}</span>
      {!collapsed && <span>{label}</span>}
      {key === 'upload' && (
        <span className={`dot ${anyLoaded ? 'on' : ''}`} />
      )}
    </div>
  );

  const isCollapsed = collapsed && !forceExpand;

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="title-drag" />
      <div className="brand">{isCollapsed ? '' : 'Company Search'}</div>
      <nav className="nav">
        {item('search', '검색', '🔎')}
        {item('agreements', '협정', '📝')}

        {/* LH 그룹 (드롭다운) */}
        <div
          className={`nav-item ${active === 'lh' ? 'active' : ''}`}
          onClick={() => {
            setLhOpen((v) => {
              const next = !v;
              setForceExpand(next);
              setAppShellWide(next);
              return next;
            });
            onSelect && onSelect('lh');
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              setLhOpen((v) => {
                const next = !v;
                setForceExpand(next);
                setAppShellWide(next);
                return next;
              });
              onSelect && onSelect('lh');
            }
          }}
        >
          {/* 아이콘 대신 텍스트 'LH' 표기 */}
          <span style={{ width: 28, fontSize: 16, fontWeight: 800, letterSpacing: 0.5 }}>LH</span>
          {!isCollapsed && <span>LH</span>}
        </div>
        {lhOpen && (
          <div className="subnav">
            <div
              className={`nav-sub-item ${active === 'lh-under50' ? 'active' : ''}`}
              onClick={() => { onSelect && onSelect('lh-under50'); closeLh(); }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { onSelect && onSelect('lh-under50'); closeLh(); } }}
            >
              <span className="sub-bullet">•</span>
              {!isCollapsed && <span className="sub-label" title="50억 미만">50억 미만</span>}
            </div>
            <div
              className={`nav-sub-item ${active === 'lh-50to100' ? 'active' : ''}`}
              onClick={() => { onSelect && onSelect('lh-50to100'); closeLh(); }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { onSelect && onSelect('lh-50to100'); closeLh(); } }}
            >
              <span className="sub-bullet">•</span>
              {!isCollapsed && <span className="sub-label" title="50억~100억">50억~100억</span>}
            </div>
          </div>
        )}

        {item('upload', '업로드', '📤')}
        {item('settings', '설정', '⚙️')}
      </nav>
      {!isCollapsed && <div className="sidebar-footer">v1.0.0</div>}
    </aside>
  );
}
