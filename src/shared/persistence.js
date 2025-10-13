const STORAGE_PREFIX = 'company_search_app:';

const getStorage = () => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch (err) {
    console.warn('[persistence] localStorage unavailable:', err);
    return null;
  }
};

export const loadPersisted = (key, fallback) => {
  const storage = getStorage();
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(`${STORAGE_PREFIX}${key}`);
    if (raw === null || raw === undefined) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    console.warn('[persistence] load failed:', err);
    return fallback;
  }
};

export const savePersisted = (key, value) => {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
  } catch (err) {
    console.warn('[persistence] save failed:', err);
  }
};

export const removePersisted = (key) => {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(`${STORAGE_PREFIX}${key}`);
  } catch (err) {
    console.warn('[persistence] remove failed:', err);
  }
};

export const clearPersisted = (prefix = '') => {
  const storage = getStorage();
  if (!storage) return;
  const resolved = `${STORAGE_PREFIX}${prefix}`;
  try {
    for (let i = storage.length - 1; i >= 0; i -= 1) {
      const key = storage.key(i);
      if (key && key.startsWith(resolved)) {
        storage.removeItem(key);
      }
    }
  } catch (err) {
    console.warn('[persistence] clear failed:', err);
  }
};
