const listeners = new Set();

let regionSearchState = {
  open: false,
  props: null,
};

const notify = () => {
  listeners.forEach((listener) => {
    try {
      listener(regionSearchState);
    } catch (err) {
      console.warn('[RegionSearchStore] listener error:', err);
    }
  });
};

export const getRegionSearchState = () => regionSearchState;

export const subscribeRegionSearch = (listener) => {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const openRegionSearch = (props = {}) => {
  regionSearchState = {
    open: true,
    props: { ...(props || {}) },
  };
  notify();
};

export const updateRegionSearchProps = (nextProps = {}, sessionId = null) => {
  if (!regionSearchState.open) return;
  if (sessionId && regionSearchState?.props?.sessionId && regionSearchState.props.sessionId !== sessionId) {
    return;
  }
  regionSearchState = {
    open: true,
    props: {
      ...(regionSearchState.props || {}),
      ...(nextProps || {}),
    },
  };
  notify();
};

export const closeRegionSearch = () => {
  if (!regionSearchState.open) return;
  regionSearchState = {
    ...regionSearchState,
    open: false,
  };
  notify();
};
