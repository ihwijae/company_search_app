import React from 'react';
import { loadPersisted, savePersisted } from '../../../../shared/persistence.js';
import AgreementBoardWindow from '../components/AgreementBoardWindow.jsx';

const DEFAULT_GROUP_SIZE = 5;
const DEFAULT_OWNER_ID = 'LH';
const DEFAULT_FILE_TYPE = 'eung';
const AGREEMENT_BOARD_DRAFT_KEY = 'agreementBoard:draft';

const AgreementBoardContext = React.createContext(null);

const initialState = {
  open: false,
  inlineMode: false,
  candidates: [],
  pinned: [],
  excluded: [],
  groupAssignments: [],
  groupShares: [],
  groupShareRawInputs: [],
  groupCredibility: [],
  groupTechnicianScores: [],
  groupApprovals: [],
  groupManagementBonus: [],
  groupQualityScores: [],
  technicianEntriesByTarget: {},
  dutyRegions: [],
  groupSize: DEFAULT_GROUP_SIZE,
  title: '협정보드',
  ownerId: DEFAULT_OWNER_ID,
  fileType: DEFAULT_FILE_TYPE,
  rangeId: null,
  alwaysInclude: [],
  bidDeadline: '',
  regionDutyRate: '',
  participantLimit: DEFAULT_GROUP_SIZE,
  noticeNo: '',
  noticeTitle: '',
  industryLabel: '',
  baseAmount: '',
  estimatedAmount: '',
  bidAmount: '',
  ratioBaseAmount: '',
  bidRate: '',
  adjustmentRate: '',
  entryAmount: '',
  entryMode: 'none',
  netCostAmount: '',
  aValue: '',
  memoHtml: '',
};

const normalizeRuleEntry = (item = {}) => ({
  bizNo: typeof item.bizNo === 'number' ? String(item.bizNo) : String(item.bizNo || '').trim(),
  name: String(item.name || '').trim(),
  note: String(item.note || '').trim(),
  region: String(item.region || '').trim(),
  snapshot: item.snapshot && typeof item.snapshot === 'object' ? { ...item.snapshot } : null,
});

const normalizeBizNo = (value) => (value ? String(value).replace(/[^0-9]/g, '') : '');

const normalizeFileTypeToken = (value) => {
  if (value === undefined || value === null) return '';
  const token = String(value).trim();
  if (!token) return '';
  const lowered = token.toLowerCase();
  if (lowered === 'eung' || token === '전기' || token === '전기공사') return 'eung';
  if (lowered === 'tongsin' || token === '통신' || token === '통신공사') return 'tongsin';
  if (lowered === 'sobang' || token === '소방' || token === '소방시설') return 'sobang';
  if (lowered === 'all' || token === '전체') return 'all';
  return lowered;
};

const extractAmountValue = (candidate, directKeys = [], keywordGroups = []) => {
  const direct = directKeys.find((key) => {
    const value = candidate[key];
    if (value !== undefined && value !== null && value !== '') {
      candidate[key] = value;
      return true;
    }
    if (candidate.snapshot && candidate.snapshot[key] !== undefined && candidate.snapshot[key] !== null && candidate.snapshot[key] !== '') {
      candidate[key] = candidate.snapshot[key];
      return true;
    }
    return false;
  });
  if (direct) return candidate[direct];
  const sources = [candidate, candidate?.snapshot].filter(Boolean);
  for (const source of sources) {
    for (const keywords of keywordGroups) {
      for (const key of Object.keys(source)) {
        if (typeof key !== 'string') continue;
        const normalized = key.replace(/\s+/g, '').toLowerCase();
        if (!normalized) continue;
        if (keywords.some((keyword) => normalized.includes(keyword))) {
          const value = source[key];
          if (value !== undefined && value !== null && value !== '') return value;
        }
      }
    }
  }
  return null;
};

const buildCandidateFromSearchEntry = (entry) => {
  if (!entry) return null;
  const snapshot = entry.snapshot && typeof entry.snapshot === 'object' ? { ...entry.snapshot } : {};
  const entryType = normalizeFileTypeToken(entry.fileType || entry._file_type || snapshot._file_type);
  if (entryType && entryType !== 'all') {
    snapshot._file_type = entryType;
  }
  const rawBizNo = entry.bizNo
    || snapshot.bizNo
    || snapshot.BizNo
    || snapshot['사업자번호']
    || snapshot['사업자 번호']
    || snapshot['사업자등록번호']
    || snapshot['사업자 등록번호']
    || snapshot['법인등록번호']
    || snapshot['법인 등록번호']
    || snapshot['법인번호']
    || snapshot['법인 번호']
    || '';
  const bizNoNormalized = normalizeBizNo(rawBizNo);
  const resolvedName = (entry.name
    || snapshot['검색된 회사']
    || snapshot['업체명']
    || snapshot['회사명']
    || snapshot.companyName
    || snapshot.name
    || '')
    .toString()
    .trim();
  const baseId = bizNoNormalized || resolvedName || `search-${Date.now()}`;
  const typePrefix = entryType ? `${entryType}:` : '';
  const candidate = {
    id: `search:${typePrefix}${baseId}`,
    bizNo: bizNoNormalized,
    name: resolvedName || baseId || '대표사',
    snapshot,
    region: snapshot['대표지역'] || snapshot['지역'] || '',
    source: 'search',
    _forceRepresentative: true,
  };

  const sipyungValue = extractAmountValue(
    candidate,
    ['_sipyung', 'sipyung', '시평', '시평액', '시평액(원)', '시평금액', '기초금액', '기초금액(원)'],
    [['시평', '심평', 'sipyung', '기초금액', '추정가격', '시평총액']]
  );
  if (sipyungValue !== null && sipyungValue !== undefined && sipyungValue !== '') candidate._sipyung = sipyungValue;

  const perfValue = extractAmountValue(
    candidate,
    ['_performance5y', 'performance5y', '5년 실적', '5년실적', '5년 실적 합계', '최근5년실적', '최근5년실적합계', '5년실적금액', '최근5년시공실적'],
    [['5년실적', '최근5년', 'fiveyear', 'performance5', '시공실적']]
  );
  if (perfValue !== null && perfValue !== undefined && perfValue !== '') candidate._performance5y = perfValue;

  const scoreValue = extractAmountValue(
    candidate,
    ['_score', 'score', 'totalScore', '총점', '평균점수', '적격점수', '종합점수', '평가점수'],
    [['총점', '평균점수', 'score', '점수', '적격점수', '종합점수', '평가점수']]
  );
  if (scoreValue !== null && scoreValue !== undefined && scoreValue !== '') candidate._score = scoreValue;

  return candidate;
};

const stripCandidateComputedFields = (candidate) => {
  if (!candidate || typeof candidate !== 'object') return candidate;
  const clone = { ...candidate };
  delete clone._agreementManagementScore;
  delete clone._agreementManagementScoreVersion;
  delete clone._agreementPerformance5y;
  delete clone._agreementPerformanceScore;
  delete clone._agreementPerformanceMax;
  delete clone._agreementPerformanceCapVersion;
  return clone;
};

const sanitizeCandidatesList = (list) => (
  Array.isArray(list)
    ? list.map((item) => (item && typeof item === 'object' ? stripCandidateComputedFields(item) : item))
    : list
);

const buildPersistedBoardState = (state) => ({
  ...initialState,
  ...state,
  open: false,
  inlineMode: false,
  candidates: sanitizeCandidatesList(state?.candidates || []),
  pinned: Array.isArray(state?.pinned) ? state.pinned : [],
  excluded: Array.isArray(state?.excluded) ? state.excluded : [],
  groupAssignments: Array.isArray(state?.groupAssignments) ? state.groupAssignments : [],
  groupShares: Array.isArray(state?.groupShares) ? state.groupShares : [],
  groupShareRawInputs: Array.isArray(state?.groupShareRawInputs) ? state.groupShareRawInputs : [],
  groupCredibility: Array.isArray(state?.groupCredibility) ? state.groupCredibility : [],
  groupTechnicianScores: Array.isArray(state?.groupTechnicianScores) ? state.groupTechnicianScores : [],
  groupApprovals: Array.isArray(state?.groupApprovals) ? state.groupApprovals : [],
  groupManagementBonus: Array.isArray(state?.groupManagementBonus) ? state.groupManagementBonus : [],
  groupQualityScores: Array.isArray(state?.groupQualityScores) ? state.groupQualityScores : [],
  technicianEntriesByTarget: state?.technicianEntriesByTarget && typeof state.technicianEntriesByTarget === 'object'
    ? state.technicianEntriesByTarget
    : {},
  dutyRegions: Array.isArray(state?.dutyRegions) ? state.dutyRegions : [],
  alwaysInclude: Array.isArray(state?.alwaysInclude) ? state.alwaysInclude : [],
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
  const draftRef = React.useRef(null);
  if (draftRef.current === null) {
    draftRef.current = loadPersisted(AGREEMENT_BOARD_DRAFT_KEY, null);
  }
  const initialBoardState = React.useMemo(() => {
    if (!draftRef.current || typeof draftRef.current !== 'object') return initialState;
    return buildPersistedBoardState(draftRef.current);
  }, []);
  const [boardState, setBoardState] = React.useState(initialBoardState);
  const persistTimerRef = React.useRef(null);
  const persistReadyRef = React.useRef(false);

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
      candidates: sanitizeCandidatesList(payload.candidates || []),
      ownerId: owner,
      fileType,
      rangeId: range,
      alwaysInclude: [],
      open: true,
      inlineMode: Boolean(payload.inlineMode),
    }));
  }, [boardState.ownerId, boardState.fileType, boardState.rangeId]);

const updateBoard = React.useCallback((payload = {}) => {
    setBoardState((prev) => {
      const { _skipFileTypeReset, ...nextPayload } = payload || {};
      const nextFileType = nextPayload.fileType || prev.fileType;
      const fileTypeChanged = nextPayload.fileType && nextPayload.fileType !== prev.fileType;
      const next = {
        ...prev,
        ...nextPayload,
        candidates: Array.isArray(nextPayload.candidates)
          ? sanitizeCandidatesList(nextPayload.candidates)
          : (nextPayload.candidates !== undefined ? nextPayload.candidates : prev.candidates),
      };
      if (fileTypeChanged && !_skipFileTypeReset) {
        return {
          ...next,
          candidates: [],
          pinned: [],
          excluded: [],
          groupAssignments: [],
          groupShares: [],
          groupShareRawInputs: [],
          groupCredibility: [],
          groupTechnicianScores: [],
          groupApprovals: [],
          groupManagementBonus: [],
          groupQualityScores: [],
          technicianEntriesByTarget: {},
          alwaysInclude: [],
          fileType: nextFileType,
        };
      }
      return next;
    });
  }, []);

const appendCandidates = React.useCallback((entries = []) => {
  if (!Array.isArray(entries) || entries.length === 0) return;
  setBoardState((prev) => {
    const existing = Array.isArray(prev.candidates) ? prev.candidates : [];
    const existingIds = new Set(existing.map((item) => item && item.id).filter(Boolean));
    const existingIndex = new Map(existing.map((item, index) => [item && item.id, index]).filter(([id]) => id));
    const normalized = entries
      .map((item) => (item && typeof item === 'object' ? stripCandidateComputedFields({ ...item }) : null))
      .filter((item) => item && (item.id || item.bizNo || item.name));
    if (normalized.length === 0) return prev;
    let next = [...existing];
    let changed = false;
    normalized.forEach((item) => {
      if (!item.id) {
        const base = normalizeRuleEntry(item);
        const key = normalizeBizNo(base.bizNo) || base.name || `ad-hoc-${next.length}`;
        item.id = `added:${key}`;
      }
      if (existingIds.has(item.id)) {
        const replaceIndex = existingIndex.get(item.id);
        if (replaceIndex !== undefined) {
          const prevItem = next[replaceIndex];
          const merged = {
            ...prevItem,
            ...item,
            id: prevItem?.id || item.id,
            snapshot: item.snapshot || prevItem?.snapshot,
            _agreementManagementScore: undefined,
            _agreementManagementScoreVersion: undefined,
            _agreementPerformance5y: undefined,
            _agreementPerformanceScore: undefined,
            _agreementPerformanceMax: undefined,
            _agreementPerformanceCapVersion: undefined,
          };
          next[replaceIndex] = merged;
          changed = true;
        }
        return;
      }
      existingIds.add(item.id);
      existingIndex.set(item.id, next.length);
      next.push(item);
      changed = true;
    });
    if (!changed) return prev;
    return { ...prev, candidates: next };
  });
}, []);

  const appendCandidatesFromSearch = React.useCallback((entries = []) => {
    if (!Array.isArray(entries) || entries.length === 0) return;
    const expectedType = normalizeFileTypeToken(boardState.fileType || DEFAULT_FILE_TYPE);
    const normalized = entries
      .filter((entry) => {
        const entryType = normalizeFileTypeToken(entry?.fileType || entry?._file_type || entry?.snapshot?._file_type);
        if (!entryType || entryType === 'all') return true;
        return entryType === expectedType;
      })
      .map((entry) => buildCandidateFromSearchEntry(entry))
      .filter(Boolean);
    if (normalized.length === 0) return;
    appendCandidates(normalized);
  }, [appendCandidates, boardState.fileType]);

  const removeCandidate = React.useCallback((candidateId) => {
    if (!candidateId) return;
    setBoardState((prev) => {
      const existing = Array.isArray(prev.candidates) ? prev.candidates : [];
      const nextCandidates = existing.filter((item) => item && item.id !== candidateId);
      if (nextCandidates.length === existing.length) return prev;
      const nextPinned = Array.isArray(prev.pinned)
        ? prev.pinned.filter((id) => id !== candidateId)
        : prev.pinned;
      const nextExcluded = Array.isArray(prev.excluded)
        ? prev.excluded.filter((id) => id !== candidateId)
        : prev.excluded;
      return {
        ...prev,
        candidates: nextCandidates,
        pinned: nextPinned,
        excluded: nextExcluded,
      };
    });
  }, []);

  const closeBoard = React.useCallback(() => {
    setBoardState((prev) => ({ ...prev, open: false, inlineMode: false }));
  }, []);

  React.useEffect(() => {
    if (!persistReadyRef.current) {
      persistReadyRef.current = true;
      return;
    }
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
    }
    const payload = buildPersistedBoardState(boardState);
    persistTimerRef.current = setTimeout(() => {
      savePersisted(AGREEMENT_BOARD_DRAFT_KEY, payload);
    }, 400);
    return () => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
      }
    };
  }, [boardState]);

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
    appendCandidates,
    appendCandidatesFromSearch,
    removeCandidate,
    closeBoard,
  }), [
    boardState,
    openBoard,
    updateBoard,
    appendCandidates,
    appendCandidatesFromSearch,
    removeCandidate,
    closeBoard,
  ]);

  return (
    <AgreementBoardContext.Provider value={value}>
      {children}
      {!boardState.inlineMode && (
        <AgreementBoardWindow
          open={boardState.open}
          onClose={closeBoard}
          candidates={boardState.candidates || []}
          pinned={boardState.pinned || []}
          excluded={boardState.excluded || []}
          groupAssignments={boardState.groupAssignments || []}
          groupShares={boardState.groupShares || []}
          groupShareRawInputs={boardState.groupShareRawInputs || []}
          groupCredibility={boardState.groupCredibility || []}
          groupTechnicianScores={boardState.groupTechnicianScores || []}
          groupApprovals={boardState.groupApprovals || []}
          groupManagementBonus={boardState.groupManagementBonus || []}
          groupQualityScores={boardState.groupQualityScores || []}
          technicianEntriesByTarget={boardState.technicianEntriesByTarget || {}}
          dutyRegions={boardState.dutyRegions || []}
          groupSize={boardState.groupSize || DEFAULT_GROUP_SIZE}
          title={boardState.title || '협정보드'}
          alwaysInclude={boardState.alwaysInclude || []}
          fileType={boardState.fileType || DEFAULT_FILE_TYPE}
          ownerId={boardState.ownerId || DEFAULT_OWNER_ID}
          rangeId={boardState.rangeId || null}
          onAddRepresentatives={appendCandidatesFromSearch}
          onRemoveRepresentative={removeCandidate}
          onUpdateBoard={updateBoard}
          noticeNo={boardState.noticeNo || ''}
          noticeTitle={boardState.noticeTitle || ''}
          noticeDate={boardState.noticeDate || ''}
          industryLabel={boardState.industryLabel || ''}
          entryAmount={boardState.entryAmount || ''}
          entryMode={boardState.entryMode || 'ratio'}
          baseAmount={boardState.baseAmount || ''}
          estimatedAmount={boardState.estimatedAmount || ''}
          bidAmount={boardState.bidAmount || ''}
          ratioBaseAmount={boardState.ratioBaseAmount || ''}
          bidRate={boardState.bidRate || ''}
          adjustmentRate={boardState.adjustmentRate || ''}
          bidDeadline={boardState.bidDeadline || ''}
          regionDutyRate={boardState.regionDutyRate || ''}
          participantLimit={boardState.participantLimit || DEFAULT_GROUP_SIZE}
          netCostAmount={boardState.netCostAmount || ''}
          aValue={boardState.aValue || ''}
          memoHtml={boardState.memoHtml || ''}
        />
      )}
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
