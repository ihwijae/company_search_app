import React from 'react';

export default function Sidebar({ active, onSelect, fileStatuses, collapsed = true }) {
  const items = [
    { key: 'search', label: '검색', icon: '🔎' },
    { key: 'upload', label: '업로드', icon: '📤' },
    { key: 'settings', label: '설정', icon: '⚙️' },
  ];

  const anyLoaded = !!(fileStatuses?.eung || fileStatuses?.tongsin || fileStatuses?.sobang);

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="title-drag" />
      <div className="brand">{collapsed ? '' : 'Company Search'}</div>
      <nav className="nav">
        {items.map((it) => (
          <div
            key={it.key}
            className={`nav-item ${active === it.key ? 'active' : ''}`}
            onClick={() => onSelect && onSelect(it.key)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect && onSelect(it.key); }}
          >
            <span style={{ width: 28, fontSize: 22 }}>{it.icon}</span>
            {!collapsed && <span>{it.label}</span>}
            {it.key === 'upload' && (
              <span className={`dot ${anyLoaded ? 'on' : ''}`} />
            )}
          </div>
        ))}
      </nav>
      {!collapsed && <div className="sidebar-footer">v1.0.0</div>}
    </aside>
  );
}
