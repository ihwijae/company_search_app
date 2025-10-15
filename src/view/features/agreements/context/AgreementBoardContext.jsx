import React from 'react';
import AgreementBoardWindow from '../components/AgreementBoardWindow.jsx';

const DEFAULT_GROUP_SIZE = 3;
const DEFAULT_OWNER_ID = 'LH';
const DEFAULT_FILE_TYPE = 'eung';

const AgreementBoardContext = React.createContext(null);

const initialState = {
  open: false,
  candidates: [],
  pinned: [],
  excluded: [],
  dutyRegions: [],
  groupSize: DEFAULT_GROUP_SIZE,
  title: '협정보드',
  ownerId: DEFAULT_OWNER_ID,
  fileType: DEFAULT_FILE_TYPE,
  rangeId: null,
  alwaysInclude: [],
};

const normalizeRuleEntry = (item = {}) => ({
  bizNo: typeof item.bizNo === 'number' ? String(item.bizNo) : String(item.bizNo || '').trim(),
  name: String(item.name || '').trim(),
  note: String(item.note || '').trim(),
  region: String(item.region || '').trim(),
  snapshot: item.snapshot && typeof item.snapshot === 'object' ? { ...item.snapshot } : null,
});

const equalRuleLists = (a, b) => {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const ai = normalizeRuleEntry(a[i]);
    const bi = normalizeRuleEntry(b[i]);
    if (ai.bizNo !== bi.bizNo || ai.name !== bi.name || ai.note !== bi.note || ai.region !== bi.region) {
      return false;
    }
    const snapshotA = ai.snapshot ? JSON.stringify(ai.snapshot) : null;
    const snapshotB = bi.snapshot ? JSON.stringify(bi.snapshot) : null;
    if (snapshotA !== snapshotB) return false;
  }
  return true;
};

export function AgreementBoardProvider({ children }) {
  const [boardState, setBoardState] = React.useState(initialState);

  const fetchAlwaysInclude = React.useCallback(async (
    ownerId = DEFAULT_OWNER_ID,
    rangeId = null,
    fileType = DEFAULT_FILE_TYPE,
    regionNames = [],
  ) => {
    if (!window.electronAPI?.agreementsRulesLoad) return [];
    try {
      const response = await window.electronAPI.agreementsRulesLoad();
      if (!response?.success || !response.data) return [];
      const doc = response.data;
      const normalizedType = String(fileType || DEFAULT_FILE_TYPE).toLowerCase();
      const normalizeRegionKey = (value) => String(value || '').replace(/\s+/g, '').trim().toLowerCase();
      const regionTargets = (Array.isArray(regionNames) ? regionNames : [])
        .map((entry) => normalizeRegionKey(entry))
        .filter(Boolean);

      const pickKindRules = (kinds = []) => {
        const match = kinds.find((k) => (k?.id || '').toLowerCase() === normalizedType)
          || kinds.find((k) => (k?.id || '').toLowerCase() === DEFAULT_FILE_TYPE)
          || kinds[0];
        return match?.rules?.alwaysInclude || [];
      };

      const globalKinds = Array.isArray(doc.globalRules?.kinds) ? doc.globalRules.kinds : [];
      const globalList = pickKindRules(globalKinds);

      const owners = Array.isArray(doc.owners) ? doc.owners : [];
      const owner = owners.find((o) => (o?.id || '').toUpperCase() === String(ownerId || DEFAULT_OWNER_ID).toUpperCase())
        || owners.find((o) => (o?.id || '').toUpperCase() === DEFAULT_OWNER_ID);

      let rangeList = [];
      if (owner && Array.isArray(owner.ranges)) {
        let range = null;
        if (rangeId) {
          range = owner.ranges.find((r) => r?.id === rangeId) || null;
        }
        if (!range) {
          range = owner.ranges.find((r) => r?.id) || null;
        }
        if (range && Array.isArray(range.kinds)) {
          rangeList = pickKindRules(range.kinds);
        }
      }

      let regionLists = [];
      if (regionTargets.length > 0 && Array.isArray(doc.regions)) {
        regionLists = doc.regions
          .filter((region) => {
            const key = normalizeRegionKey(region?.id || region?.label || region?.region);
            return key && regionTargets.includes(key);
          })
          .map((region) => pickKindRules(region?.kinds || []));
      }

      const merged = [globalList, rangeList, ...regionLists]
        .filter((list) => Array.isArray(list))
        .flat()
        .map((item) => normalizeRuleEntry(item))
        .filter((item) => item.bizNo || item.name);

      const unique = new Map();
      merged.forEach((item) => {
        const key = item.bizNo || item.name;
        if (!key) return;
        if (!unique.has(key)) {
          unique.set(key, item);
        } else {
          const existing = unique.get(key);
          if (!existing.snapshot && item.snapshot) unique.set(key, item);
        }
      });

      return Array.from(unique.values()).sort((a, b) => {
        const aKey = `${a.bizNo || ''}-${a.name || ''}`.trim();
        const bKey = `${b.bizNo || ''}-${b.name || ''}`.trim();
        return aKey.localeCompare(bKey, 'ko-KR');
      });
    } catch (err) {
      console.warn('[AgreementBoard] rules load failed:', err?.message || err);
      return [];
    }
  }, []);

  const openBoard = React.useCallback((payload = {}) => {
    const owner = String(payload.ownerId || boardState.ownerId || DEFAULT_OWNER_ID).toUpperCase();
    const fileType = payload.fileType || boardState.fileType || DEFAULT_FILE_TYPE;
    const range = payload.rangeId || boardState.rangeId || null;
    setBoardState((prev) => ({
      ...prev,
      ...payload,
      ownerId: owner,
      fileType,
      rangeId: range,
      alwaysInclude: [],
      open: true,
    }));
  }, [boardState.ownerId, boardState.fileType, boardState.rangeId]);

  const updateBoard = React.useCallback((payload = {}) => {
    setBoardState((prev) => ({
      ...prev,
      ...payload,
    }));
  }, []);

  const closeBoard = React.useCallback(() => {
    setBoardState((prev) => ({ ...prev, open: false }));
  }, []);

  React.useEffect(() => {
    if (!boardState.open) return;
    const owner = String(boardState.ownerId || DEFAULT_OWNER_ID).toUpperCase();
    const fileType = boardState.fileType || DEFAULT_FILE_TYPE;
    const rangeId = boardState.rangeId || null;
    const dutyRegions = Array.isArray(boardState.dutyRegions) ? boardState.dutyRegions : [];
    let canceled = false;
    (async () => {
      const list = await fetchAlwaysInclude(owner, rangeId, fileType, dutyRegions);
      if (canceled) return;
      setBoardState((prev) => {
        if (!prev.open) return prev;
        if ((prev.ownerId || DEFAULT_OWNER_ID) !== owner || (prev.fileType || DEFAULT_FILE_TYPE) !== fileType || (prev.rangeId || null) !== rangeId) {
          return prev;
        }
        if (equalRuleLists(prev.alwaysInclude, list)) return prev;
        return { ...prev, alwaysInclude: list };
      });
    })();
    return () => { canceled = true; };
  }, [boardState.open, boardState.ownerId, boardState.rangeId, boardState.fileType, boardState.dutyRegions, fetchAlwaysInclude]);

  const value = React.useMemo(() => ({
    boardState,
    openBoard,
    updateBoard,
    closeBoard,
  }), [boardState, openBoard, updateBoard, closeBoard]);

  return (
    <AgreementBoardContext.Provider value={value}>
      {children}
      <AgreementBoardWindow
        open={boardState.open}
        onClose={closeBoard}
        candidates={boardState.candidates || []}
        pinned={boardState.pinned || []}
        excluded={boardState.excluded || []}
        dutyRegions={boardState.dutyRegions || []}
        groupSize={boardState.groupSize || DEFAULT_GROUP_SIZE}
        title={boardState.title || '협정보드'}
        alwaysInclude={boardState.alwaysInclude || []}
      />
    </AgreementBoardContext.Provider>
  );
}

export function useAgreementBoard() {
  const context = React.useContext(AgreementBoardContext);
  if (!context) {
    throw new Error('useAgreementBoard must be used within AgreementBoardProvider');
  }
  return context;
}
