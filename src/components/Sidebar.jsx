import React from 'react';
import { AGREEMENT_GROUPS, findMenuByHash, findMenuByKey } from '../shared/navigation.js';

export default function Sidebar({ active, onSelect, fileStatuses, collapsed = true }) {
  const anyLoaded = !!(fileStatuses?.eung || fileStatuses?.tongsin || fileStatuses?.sobang);
  const [openGroupId, setOpenGroupId] = React.useState(null);
  const [forceExpand, setForceExpand] = React.useState(false);

  const setAppShellWide = React.useCallback((on) => {
    try {
      const shell = document.querySelector('.app-shell');
      if (!shell) return;
      if (on) shell.classList.add('sidebar-wide');
      else shell.classList.remove('sidebar-wide');
    } catch {}
  }, []);

  const closeGroup = React.useCallback(() => {
    setOpenGroupId(null);
    setForceExpand(false);
    setAppShellWide(false);
  }, [setAppShellWide]);

  React.useEffect(() => {
    const sync = () => {
      const hash = window.location.hash || '';
      const menu = findMenuByHash(hash);
      if (menu) {
        setOpenGroupId(menu.groupId);
        setForceExpand(true);
        setAppShellWide(true);
      } else {
        closeGroup();
      }
    };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, [closeGroup, setAppShellWide]);

  React.useEffect(() => {
    if (!openGroupId) return;
    const onDocClick = (e) => {
      const aside = document.querySelector('aside.sidebar');
      if (!aside) return;
      if (!aside.contains(e.target)) {
        closeGroup();
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [openGroupId, closeGroup]);

  const handleGroupToggle = (groupId) => {
    setOpenGroupId((prev) => {
      const next = prev === groupId ? null : groupId;
      setForceExpand(!!next);
      setAppShellWide(!!next);
      return next;
    });
  };

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
      {!isCollapsed && <span>{label}</span>}
      {key === 'upload' && (
        <span className={`dot ${anyLoaded ? 'on' : ''}`} />
      )}
    </div>
  );

  const isCollapsed = collapsed && !forceExpand;
  const activeMenu = findMenuByKey(active || '') || findMenuByHash(window.location?.hash || '');

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="title-drag" />
      <div className="brand">{isCollapsed ? '' : 'Company Search'}</div>
      <nav className="nav">
        {item('search', '검색', '🔍')}
        {item('records', '실적', '📊')}
        {item('mail', '메일', '✉️')}
        {item('agreements', '협정', '🤝')}

        {AGREEMENT_GROUPS.map((group) => {
          const isOpen = openGroupId === group.id;
          const hasActiveChild = activeMenu && activeMenu.groupId === group.id;
          const isActive = hasActiveChild || active === group.id;
          return (
            <React.Fragment key={group.id}>
              <div
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => {
                  handleGroupToggle(group.id);
                  onSelect && onSelect(group.id);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleGroupToggle(group.id);
                    onSelect && onSelect(group.id);
                  }
                }}
              >
                <span
                  style={{
                    minWidth: 28,
                    display: 'flex',
                    justifyContent: 'center',
                    fontSize: 16,
                    fontWeight: 800,
                    letterSpacing: 0.5,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {group.label}
                </span>
                {!isCollapsed && <span>{group.label}</span>}
              </div>
              {isOpen && (
                <div className="subnav">
                  {group.items.map((itemInfo) => (
                    <div
                      key={itemInfo.key}
                      className={`nav-sub-item ${active === itemInfo.key ? 'active' : ''}`}
                      onClick={() => {
                        window.location.hash = itemInfo.hash;
                        onSelect && onSelect(itemInfo.key);
                        closeGroup();
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          window.location.hash = itemInfo.hash;
                          onSelect && onSelect(itemInfo.key);
                          closeGroup();
                        }
                      }}
                    >
                      <span className="sub-bullet">*</span>
                      {!isCollapsed && <span className="sub-label" title={itemInfo.label}>{itemInfo.label}</span>}
                    </div>
                  ))}
                </div>
              )}
            </React.Fragment>
          );
        })}

        {item('upload', '업로드', '📂')}
        {item('settings', '설정', '⚙️')}
      </nav>
      {!isCollapsed && <div className="sidebar-footer">v1.0.0</div>}
    </aside>
  );
}
