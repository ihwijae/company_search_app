import React from 'react';
import excelIcon from '../assets/excel.png';
import mmsIcon from '../assets/mms.png';
import emailIcon from '../assets/email.png';
import autoIcon from '../assets/auto.png';
import exchangeIcon from '../assets/교환.png';
import kakaoIcon from '../assets/kakao.png';
import notesIcon from '../assets/특이사항아이콘.png';
import { openTempCompaniesWindow } from '../utils/tempCompaniesWindow.js';

export default function Sidebar({ active, onSelect, fileStatuses }) {
  const anyLoaded = !!(fileStatuses?.eung || fileStatuses?.tongsin || fileStatuses?.sobang);
  const [isMaximized, setIsMaximized] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    const controls = window.electronAPI?.windowControls;
    if (!controls) return undefined;

    controls.getState().then((state) => {
      if (mounted) setIsMaximized(!!state?.isMaximized);
    }).catch(() => {});

    const unsubscribe = controls.onStateChange((state) => {
      if (mounted) setIsMaximized(!!state?.isMaximized);
    });

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  const handleSelect = (key) => {
    if (key === 'agreements' && typeof window !== 'undefined') {
      const opener = window.__openAgreementBoard;
      if (typeof opener === 'function') {
        opener();
        return;
      }
    }
    if (key === 'temp-companies' && typeof window !== 'undefined') {
      try {
        openTempCompaniesWindow();
        return;
      } catch {}
    }
    if (onSelect) onSelect(key);
  };

  const navItems = [
    { key: 'search', label: '검색', icon: '🔍' },
    {
      key: 'company-notes',
      label: '업체별특이사항',
      icon: <img src={notesIcon} alt="업체별특이사항" style={{ width: 18, height: 18, objectFit: 'contain' }} />,
    },
    { key: 'records', label: '실적', icon: '📊' },
    {
      key: 'mail',
      label: '메일',
      icon: <img src={emailIcon} alt="메일" style={{ width: 18, height: 18, objectFit: 'contain' }} />,
    },
    {
      key: 'excel-helper',
      label: '엑셀도우미',
      icon: <img src={excelIcon} alt="엑셀" style={{ width: 18, height: 18, objectFit: 'contain' }} />,
    },
    {
      key: 'kakao-send',
      label: '카카오전송',
      icon: <img src={kakaoIcon} alt="카카오전송" style={{ width: 18, height: 18, objectFit: 'contain' }} />,
    },
    {
      key: 'agreements-sms',
      label: '협정 문자',
      icon: <img src={mmsIcon} alt="협정 문자" style={{ width: 18, height: 18, objectFit: 'contain' }} />,
    },
    { key: 'agreements', label: '협정보드', icon: '📋' },
    {
      key: 'auto-agreement',
      label: '협정 자동화',
      icon: <img src={autoIcon} alt="협정 자동화" style={{ width: 18, height: 18, objectFit: 'contain' }} />,
    },
    {
      key: 'bid-result',
      label: '개찰결과',
      icon: <img src={exchangeIcon} alt="개찰결과" style={{ width: 18, height: 18, objectFit: 'contain' }} />,
    },
    { key: 'temp-companies', label: '임시업체', icon: '🏢' },
    { key: 'upload', label: '업로드', icon: '📂' },
    { key: 'settings', label: '설정', icon: '⚙️' },
  ];

  const controls = window.electronAPI?.windowControls;

  return (
    <header className="app-header">
      <div className="app-header__bar title-drag">
        <div className="app-header__bar-inner">
          <div className="app-header__left no-drag">
            <span className="app-header__title">협정보조</span>
            <nav className="app-menu" aria-label="전역 메뉴">
              {navItems.map(({ key, label, icon }) => (
                <button
                  type="button"
                  key={key}
                  className={`app-menu__item ${active === key ? 'active' : ''}`}
                  onClick={() => handleSelect(key)}
                >
                  <span className="app-menu__icon">{icon}</span>
                  <span className="app-menu__label">{label}</span>
                  {key === 'upload' && <span className={`dot ${anyLoaded ? 'on' : ''}`} />}
                </button>
              ))}
            </nav>
          </div>
          <div className="app-header__drag-space" aria-hidden="true" />
          <div className="app-header__window-controls no-drag">
            <button type="button" className="app-window-button" onClick={() => controls?.minimize?.()} aria-label="최소화">─</button>
            <button type="button" className="app-window-button" onClick={() => controls?.maximizeToggle?.()} aria-label={isMaximized ? '복원' : '최대화'}>
              {isMaximized ? '❐' : '□'}
            </button>
            <button type="button" className="app-window-button app-window-button--close" onClick={() => controls?.close?.()} aria-label="닫기">✕</button>
          </div>
        </div>
      </div>
    </header>
  );
}
