// src/App.jsx: hash-route shell
import React from 'react';
import SearchPage from './view/features/search/pages/SearchPage.jsx';
import AgreementsPage from './view/features/agreements/pages/AgreementsPage.jsx';
import SettingsPage from './view/features/settings/pages/SettingsPage.jsx';
import LHUnder50Page from './view/features/agreements/pages/LHUnder50Page.jsx';
import LH50To100Page from './view/features/agreements/pages/LH50To100Page.jsx';
import MOISUnder30Page from './view/features/agreements/pages/MOISUnder30Page.jsx';
import MOIS30To50Page from './view/features/agreements/pages/MOIS30To50Page.jsx';
import MOIS50To100Page from './view/features/agreements/pages/MOIS50To100Page.jsx';

export default function App() {
  const [route, setRoute] = React.useState(window.location.hash || '#/search');
  React.useEffect(() => {
    const onHashChange = () => setRoute(window.location.hash || '#/search');
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const path = (route.replace('#', '') || '/search');
  switch (path) {
    case '/lh/under50':
      return <LHUnder50Page />;
    case '/lh/50to100':
      return <LH50To100Page />;
    case '/mois/under30':
      return <MOISUnder30Page />;
    case '/mois/30to50':
      return <MOIS30To50Page />;
    case '/mois/50to100':
      return <MOIS50To100Page />;
    case '/agreements':
      return <AgreementsPage />;
    case '/settings':
      return <SettingsPage />;
    case '/search':
    default:
      return <SearchPage />;
  }
}
