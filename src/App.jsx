// src/App.jsx: hash-route shell
import React from 'react';
import SearchPage from './view/features/search/pages/SearchPage.jsx';

export default function App() {
  const [route, setRoute] = React.useState(window.location.hash || '#/search');
  React.useEffect(() => {
    const onHashChange = () => setRoute(window.location.hash || '#/search');
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const path = (route.replace('#', '') || '/search');
  switch (path) {
    case '/search':
    default:
      return <SearchPage />;
  }
}