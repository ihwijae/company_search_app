import React from 'react';
import AgreementFlowPage from './AgreementFlowPage.jsx';

export default function PPSUnder50Page() {
  return (
    <AgreementFlowPage
      menuKey="pps-under50"
      ownerId="PPS"
      ownerLabel="조달청"
      rangeLabel="50억 미만"
    />
  );
}
