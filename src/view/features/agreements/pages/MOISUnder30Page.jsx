import React from 'react';
import AgreementFlowPage from './AgreementFlowPage.jsx';

export default function MOISUnder30Page() {
  return (
    <AgreementFlowPage
      menuKey="mois-under30"
      ownerId="MOIS"
      ownerLabel="행안부"
      rangeLabel="30억 미만"
    />
  );
}
