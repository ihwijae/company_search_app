import React from 'react';
import CandidatesModal from './CandidatesModal.jsx';
import {
  closeRegionSearch,
  getRegionSearchState,
  subscribeRegionSearch,
} from './regionSearchStore.js';

export default function RegionSearchWindowHost() {
  const [state, setState] = React.useState(() => getRegionSearchState());

  React.useEffect(() => subscribeRegionSearch(setState), []);

  if (!state.props) {
    return null;
  }

  const handleClose = () => {
    closeRegionSearch();
  };

  return (
    <CandidatesModal
      {...state.props}
      open={state.open}
      onClose={handleClose}
    />
  );
}
