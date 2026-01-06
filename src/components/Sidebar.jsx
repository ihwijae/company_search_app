import React from 'react';
import excelIcon from '../assets/excel.png';
import mmsIcon from '../assets/mms.png';
import emailIcon from '../assets/email.png';
import autoIcon from '../assets/auto.png';

export default function Sidebar({ active, onSelect, fileStatuses, collapsed = true }) {
  const anyLoaded = !!(fileStatuses?.eung || fileStatuses?.tongsin || fileStatuses?.sobang);
  const isCollapsed = collapsed;
  const handleSelect = (key) => {
    if (onSelect) onSelect(key);
  };

  const navItems = [
    { key: 'search', label: '검색', icon: '🔍' },
    { key: 'records', label: '실적', icon: '📊' },
    {
      key: 'mail',
      label: '메일',
      icon: (
        <img
          src={emailIcon}
          alt="메일"
          style={{ width: 22, height: 22, objectFit: 'contain' }}
        />
      ),
    },
    {
      key: 'excel-helper',
      label: '엑셀도우미',
      icon: (
        <img
          src={excelIcon}
          alt="엑셀"
          style={{ width: 22, height: 22, objectFit: 'contain' }}
        />
      ),
    },
    {
      key: 'agreements-sms',
      label: '협정 문자',
      icon: (
        <img
          src={mmsIcon}
          alt="협정 문자"
          style={{ width: 22, height: 22, objectFit: 'contain' }}
        />
      ),
    },
    {
      key: 'agreements',
      label: '협정보드',
      icon: '📋',
    },
    {
      key: 'auto-agreement',
      label: '협정 자동화',
      icon: (
        <img
          src={autoIcon}
          alt="협정 자동화"
          style={{ width: 22, height: 22, objectFit: 'contain' }}
        />
      ),
    },
    { key: 'region-search', label: '지역사 찾기', icon: '📍' },
    { key: 'upload', label: '업로드', icon: '📂' },
    { key: 'settings', label: '설정', icon: '⚙️' },
  ];

  const item = (key, label, icon) => (
    <div
      key={key}
      className={`nav-item ${active === key ? 'active' : ''}`}
      onClick={() => handleSelect(key)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && onSelect) onSelect(key); }}
    >
      <span style={{ width: 28, fontSize: 22 }}>{icon}</span>
      {!isCollapsed && <span>{label}</span>}
      {key === 'upload' && (
        <span className={`dot ${anyLoaded ? 'on' : ''}`} />
      )}
    </div>
  );

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="title-drag" />
      <div className="brand">{isCollapsed ? '' : 'Company Search'}</div>
      <nav className="nav">
        {navItems.map(({ key, label, icon }) => item(key, label, icon))}
      </nav>
      {!isCollapsed && <div className="sidebar-footer">v1.0.0</div>}
    </aside>
  );
}
