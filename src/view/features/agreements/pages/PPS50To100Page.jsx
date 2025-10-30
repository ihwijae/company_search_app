import React from 'react';
import AgreementFlowPage from './AgreementFlowPage.jsx';

export default function PPS50To100Page() {
  return (
    <AgreementFlowPage
      menuKey="pps-50to100"
      ownerId="PPS"
      ownerLabel="조달청"
      rangeLabel="50억~100억"
    />
  );
}
