import React from 'react';
import '../../../../styles.css';
import '../../../../fonts.css';
import Sidebar from '../../../../components/Sidebar';
import AgreementBoardWindow from '../components/AgreementBoardWindow.jsx';
import { useAgreementBoard } from '../context/AgreementBoardContext.jsx';
import { BASE_ROUTES } from '../../../../shared/navigation.js';

export default function AgreementBoardPage() {
  const {
    boardState,
    updateBoard,
    appendCandidatesFromSearch,
    removeCandidate,
    closeBoard,
  } = useAgreementBoard();

  React.useEffect(() => {
    if (!boardState.open || !boardState.inlineMode) {
      updateBoard({ open: true, inlineMode: true });
    }
  }, [boardState.inlineMode, boardState.open, updateBoard]);

  React.useEffect(() => () => {
    updateBoard({ open: false, inlineMode: false });
  }, [updateBoard]);

  React.useEffect(() => {
    if (!boardState.open) return undefined;
    const previousOverflowY = document.body.style.overflowY;
    const previousOverflowX = document.body.style.overflowX;
    document.body.style.overflowY = 'hidden';
    document.body.style.overflowX = 'hidden';
    return () => {
      document.body.style.overflowY = previousOverflowY;
      document.body.style.overflowX = previousOverflowX;
    };
  }, [boardState.open]);

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
    if (key === 'upload') { window.location.hash = BASE_ROUTES.agreementBoard; return; }
    if (key === 'settings') { window.location.hash = BASE_ROUTES.settings; return; }
  }, []);

  if (!boardState.open) {
    return (
      <div className="app-shell">
        <Sidebar active="agreements" onSelect={handleMenuSelect} collapsed={true} />
        <div className="main">
          <div className="title-drag" />
          <div className="topbar" />
          <div className="stage">
            <div className="content">
              <p>협정보드를 불러오는 중입니다...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar active="agreements" onSelect={handleMenuSelect} collapsed={true} />
      <div className="main">
        <div className="title-drag" />
        <div className="topbar" />
        <div className="stage agreement-board-stage">
          <AgreementBoardWindow
            inlineMode
            open={boardState.open}
            onClose={closeBoard}
            candidates={boardState.candidates || []}
            pinned={boardState.pinned || []}
            excluded={boardState.excluded || []}
            groupAssignments={boardState.groupAssignments || []}
            groupShares={boardState.groupShares || []}
            groupShareRawInputs={boardState.groupShareRawInputs || []}
            groupCredibility={boardState.groupCredibility || []}
            groupTechnicianScores={boardState.groupTechnicianScores || []}
            groupApprovals={boardState.groupApprovals || []}
            groupManagementBonus={boardState.groupManagementBonus || []}
            groupQualityScores={boardState.groupQualityScores || []}
            dutyRegions={boardState.dutyRegions || []}
            groupSize={boardState.groupSize}
            title={boardState.title || '협정보드'}
            alwaysInclude={boardState.alwaysInclude || []}
            fileType={boardState.fileType}
            ownerId={boardState.ownerId}
            rangeId={boardState.rangeId}
            onAddRepresentatives={appendCandidatesFromSearch}
            onRemoveRepresentative={removeCandidate}
            onUpdateBoard={updateBoard}
            noticeNo={boardState.noticeNo}
            noticeTitle={boardState.noticeTitle}
            noticeDate={boardState.noticeDate}
            industryLabel={boardState.industryLabel}
            entryAmount={boardState.entryAmount}
            entryMode={boardState.entryMode}
            baseAmount={boardState.baseAmount}
            estimatedAmount={boardState.estimatedAmount}
            bidAmount={boardState.bidAmount}
            ratioBaseAmount={boardState.ratioBaseAmount}
            bidRate={boardState.bidRate}
            adjustmentRate={boardState.adjustmentRate}
            bidDeadline={boardState.bidDeadline}
            regionDutyRate={boardState.regionDutyRate}
            participantLimit={boardState.participantLimit}
            netCostAmount={boardState.netCostAmount}
            aValue={boardState.aValue}
            memoHtml={boardState.memoHtml}
          />
        </div>
      </div>
    </div>
  );
}
