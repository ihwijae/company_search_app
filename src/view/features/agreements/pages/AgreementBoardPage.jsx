import React from 'react';
import '../../../../styles.css';
import '../../../../fonts.css';
import Sidebar from '../../../../components/Sidebar';
import { useAgreementBoard } from '../context/AgreementBoardContext.jsx';
import { BASE_ROUTES } from '../../../../shared/navigation.js';

export default function AgreementBoardPage() {
  const {
    boardState,
    updateBoard,
  } = useAgreementBoard();

  React.useEffect(() => {
    if (!boardState.open || boardState.inlineMode) {
      updateBoard({ open: true, inlineMode: false });
    }
  }, [boardState.inlineMode, boardState.open, updateBoard]);

  React.useEffect(() => () => {
    updateBoard({ open: false, inlineMode: false });
  }, [updateBoard]);

  React.useEffect(() => {
    if (boardState.open && boardState.inlineMode) {
      updateBoard({ inlineMode: false });
    }
  }, [boardState.inlineMode, boardState.open, updateBoard]);

  const handleMenuSelect = React.useCallback((key) => {
    if (!key) return;
    if (key === 'search') { window.location.hash = BASE_ROUTES.search; return; }
    if (key === 'agreements') { window.location.hash = '#/agreement-board'; return; }
    if (key === 'agreements-sms') { window.location.hash = BASE_ROUTES.agreements; return; }
    if (key === 'region-search') { window.location.hash = BASE_ROUTES.regionSearch; return; }
    if (key === 'auto-agreement') { window.location.hash = BASE_ROUTES.autoAgreement; return; }
    if (key === 'records') { window.location.hash = '#/records'; return; }
    if (key === 'mail') { window.location.hash = '#/mail'; return; }
    if (key === 'excel-helper') { window.location.hash = '#/excel-helper'; return; }
    if (key === 'bid-result') { window.location.hash = '#/bid-result'; return; }
    if (key === 'kakao-send') { window.location.hash = '#/kakao-send'; return; }
    if (key === 'company-notes') { window.location.hash = '#/company-notes'; return; }
    if (key === 'upload') { window.location.hash = BASE_ROUTES.agreementBoard; return; }
    if (key === 'settings') { window.location.hash = BASE_ROUTES.settings; return; }
  }, []);

  return (
    <div className="app-shell">
      <Sidebar active="agreements" onSelect={handleMenuSelect} collapsed={true} />
      <div className="main">
        <div className="title-drag" />
        <div className="topbar" />
        <div className="stage">
          <div className="content">
            <p>협정보드는 새 창에서 열립니다.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
