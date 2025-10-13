const STORAGE_PREFIX = 'company_search_app:';
const MISSING_FLAG_KEY = '__companySearchStateMissing';

let cachedLocalStorage = undefined;

const resolveLocalStorage = () => {
  if (typeof window === 'undefined') return null;
  if (cachedLocalStorage !== undefined) return cachedLocalStorage;
  try {
    const storage = window.localStorage;
    const probeKey = `${STORAGE_PREFIX}__probe__`;
    storage.setItem(probeKey, '1');
    storage.removeItem(probeKey);
    cachedLocalStorage = storage;
    return cachedLocalStorage;
  } catch (err) {
    console.warn('[persistence] localStorage unavailable:', err);
    cachedLocalStorage = null;
    return null;
  }
};

const electronAPI = () => {
  if (typeof window === 'undefined') return null;
  const api = window.electronAPI;
  if (!api) return null;
  if (typeof api.stateLoadSync !== 'function') return null;
  return api;
};

const withPrefix = (key) => `${STORAGE_PREFIX}${key}`;

const loadFromElectron = (fullKey) => {
  const api = electronAPI();
  if (!api) return undefined;
  try {
    const result = api.stateLoadSync(fullKey);
    if (result && typeof result === 'object' && result[MISSING_FLAG_KEY]) {
      return undefined;
    }
    // Undefined cannot be serialized across IPC; treat explicit null as stored value
    if (result === undefined) return undefined;
    return result;
  } catch (err) {
    console.warn('[persistence] electron fallback load failed:', err);
    return undefined;
  }
};

const saveToElectron = (fullKey, value) => {
  const api = electronAPI();
  if (!api) return;
  try {
    const maybePromise = api.stateSave(fullKey, value);
    if (maybePromise && typeof maybePromise.catch === 'function') {
      maybePromise.catch((err) => console.warn('[persistence] electron fallback save failed:', err));
    }
  } catch (err) {
    console.warn('[persistence] electron fallback save dispatch failed:', err);
  }
};

const removeFromElectron = (fullKey) => {
  const api = electronAPI();
  if (!api) return;
  try {
    const maybePromise = api.stateRemove(fullKey);
    if (maybePromise && typeof maybePromise.catch === 'function') {
      maybePromise.catch((err) => console.warn('[persistence] electron fallback remove failed:', err));
    }
  } catch (err) {
    console.warn('[persistence] electron fallback remove dispatch failed:', err);
  }
};

const clearElectron = (prefix) => {
  const api = electronAPI();
  if (!api) return;
  try {
    const maybePromise = api.stateClear(prefix);
    if (maybePromise && typeof maybePromise.catch === 'function') {
      maybePromise.catch((err) => console.warn('[persistence] electron fallback clear failed:', err));
    }
  } catch (err) {
    console.warn('[persistence] electron fallback clear dispatch failed:', err);
  }
};

export const loadPersisted = (key, fallback) => {
  const fullKey = withPrefix(key);
  const storage = resolveLocalStorage();
  if (storage) {
    try {
      const raw = storage.getItem(fullKey);
      if (raw !== null && raw !== undefined) {
        return JSON.parse(raw);
      }
    } catch (err) {
      console.warn('[persistence] load failed (localStorage):', err);
    }
  }

  const fallbackValue = loadFromElectron(fullKey);
  if (fallbackValue !== undefined) {
    if (storage) {
      try { storage.setItem(fullKey, JSON.stringify(fallbackValue)); } catch {}
    }
    return fallbackValue;
  }

  return fallback;
};

export const savePersisted = (key, value) => {
  const fullKey = withPrefix(key);
  const storage = resolveLocalStorage();
  if (storage) {
    try {
      storage.setItem(fullKey, JSON.stringify(value));
    } catch (err) {
      console.warn('[persistence] save failed (localStorage):', err);
    }
  }
  saveToElectron(fullKey, value);
};

export const removePersisted = (key) => {
  const fullKey = withPrefix(key);
  const storage = resolveLocalStorage();
  if (storage) {
    try {
      storage.removeItem(fullKey);
    } catch (err) {
      console.warn('[persistence] remove failed (localStorage):', err);
    }
  }
  removeFromElectron(fullKey);
};

export const clearPersisted = (prefix = '') => {
  const storage = resolveLocalStorage();
  const resolvedPrefix = withPrefix(prefix);
  if (storage) {
    try {
      for (let i = storage.length - 1; i >= 0; i -= 1) {
        const key = storage.key(i);
        if (key && key.startsWith(resolvedPrefix)) {
          storage.removeItem(key);
        }
      }
    } catch (err) {
      console.warn('[persistence] clear failed (localStorage):', err);
    }
  }
  clearElectron(resolvedPrefix);
};
