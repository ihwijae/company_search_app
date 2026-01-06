// src/App.jsx: hash-route shell
import React from 'react';
import SearchPage from './view/features/search/pages/SearchPage.jsx';
import AgreementsPage from './view/features/agreements/pages/AgreementsPage.jsx';
import AgreementBoardPage from './view/features/agreements/pages/AgreementBoardPage.jsx';
import RegionSearchPage from './view/features/agreements/pages/RegionSearchPage.jsx';
import SettingsPage from './view/features/settings/pages/SettingsPage.jsx';
import RecordsPage from './view/features/records/pages/RecordsPage.jsx';
import MailAutomationPage from './view/features/mail/pages/MailAutomationPage.jsx';
import AutoAgreementPage from './view/features/auto/pages/AutoAgreementPage.jsx';
import LHUnder50Page from './view/features/agreements/pages/LHUnder50Page.jsx';
import LH50To100Page from './view/features/agreements/pages/LH50To100Page.jsx';
import PPSUnder50Page from './view/features/agreements/pages/PPSUnder50Page.jsx';
import PPS50To100Page from './view/features/agreements/pages/PPS50To100Page.jsx';
import MOISUnder30Page from './view/features/agreements/pages/MOISUnder30Page.jsx';
import MOIS30To50Page from './view/features/agreements/pages/MOIS30To50Page.jsx';
import MOIS50To100Page from './view/features/agreements/pages/MOIS50To100Page.jsx';
import { AgreementBoardProvider } from './view/features/agreements/context/AgreementBoardContext.jsx';
import ExcelHelperPage from './view/features/excel-helper/pages/ExcelHelperPage.jsx';
import RegionSearchWindowHost from './view/features/agreements/components/RegionSearchWindowHost.jsx';

export default function App() {
  const [route, setRoute] = React.useState(window.location.hash || '#/search');
  React.useEffect(() => {
    const onHashChange = () => setRoute(window.location.hash || '#/search');
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const path = (route.replace('#', '') || '/search');

  React.useEffect(() => {
    if (path !== '/excel-helper') {
      document.title = '협정보조';
    }
  }, [path]);

  let Screen = SearchPage;
  switch (path) {
    case '/lh/under50':
      Screen = LHUnder50Page;
      break;
    case '/lh/50to100':
      Screen = LH50To100Page;
      break;
    case '/pps/under50':
      Screen = PPSUnder50Page;
      break;
    case '/pps/50to100':
      Screen = PPS50To100Page;
      break;
    case '/mois/under30':
      Screen = MOISUnder30Page;
      break;
    case '/mois/30to50':
      Screen = MOIS30To50Page;
      break;
    case '/mois/50to100':
      Screen = MOIS50To100Page;
      break;
    case '/agreement-board':
      Screen = AgreementBoardPage;
      break;
    case '/region-search':
      Screen = RegionSearchPage;
      break;
    case '/agreements':
      Screen = AgreementsPage;
      break;
    case '/settings':
      Screen = SettingsPage;
      break;
    case '/records':
      Screen = RecordsPage;
      break;
    case '/mail':
      Screen = MailAutomationPage;
      break;
    case '/excel-helper':
      Screen = ExcelHelperPage;
      break;
    case '/auto-agreement':
      Screen = AutoAgreementPage;
      break;
    case '/search':
    default:
      Screen = SearchPage;
      break;
  }

  return (
    <AgreementBoardProvider>
      <Screen />
      <RegionSearchWindowHost />
    </AgreementBoardProvider>
  );
}
