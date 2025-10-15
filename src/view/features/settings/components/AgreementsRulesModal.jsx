import React from 'react';
import Modal from '../../../../components/Modal';
import CompanySearchModal from '../../../../components/CompanySearchModal.jsx';
import { AGREEMENT_GROUPS } from '../../../../shared/navigation.js';

const OWNER_PRESETS = AGREEMENT_GROUPS.map((group) => ({
  id: group.ownerId,
  name: group.name || group.label || group.ownerId,
}));

const KIND_PRESETS = [
  { id: 'eung', label: '전기' },
  { id: 'tongsin', label: '통신' },
  { id: 'sobang', label: '소방' },
];

const SCOPE_GLOBAL = 'global';
const SCOPE_SCOPED = 'scoped';
const SCOPE_REGION = 'region';

const DEFAULT_SCOPE = SCOPE_GLOBAL;
const DEFAULT_OWNER_ID = OWNER_PRESETS[0]?.id || 'LH';
const DEFAULT_KIND_ID = KIND_PRESETS[0]?.id || 'eung';

const createBaseRuleSet = () => ({
  excludeSingleBidEligible: true,
  alwaysInclude: [],
  alwaysExclude: [],
  pinCompanies: [],
  fixedJV: [],
  teamConstraints: { minSize: 2, maxSize: 4 },
  shareConstraints: { minPerMember: 0, maxPerMember: 100, shareStep: 1 },
  banPairs: [],
  banManagerPairs: [],
  banSameManager: false,
  regionDutyOverride: null,
});

const normalizeCompanyEntry = (entry = {}) => ({
  bizNo: entry.bizNo ? String(entry.bizNo) : '',
  name: entry.name ? String(entry.name) : '',
  note: entry.note ? String(entry.note) : '',
  region: entry.region ? String(entry.region) : '',
  snapshot: entry.snapshot && typeof entry.snapshot === 'object' ? { ...entry.snapshot } : null,
});

const normalizeRangePresets = (() => {
  const map = new Map();
  AGREEMENT_GROUPS.forEach((group) => {
    const presets = (group.items || []).map((item) => ({
      id: item.key,
      label: item.label || item.rangeLabel || item.key,
    }));
    map.set(group.ownerId, presets);
  });
  return map;
})();

const getRangePresets = (ownerId) => normalizeRangePresets.get(ownerId) || [];

const normalizeRuleSet = (rules = {}) => {
  const base = { ...createBaseRuleSet(), ...rules };
  const normalizeList = (list) => (Array.isArray(list) ? list.map((item) => normalizeCompanyEntry(item)) : []);
  return {
    ...base,
    alwaysInclude: normalizeList(base.alwaysInclude),
    alwaysExclude: normalizeList(base.alwaysExclude),
    pinCompanies: normalizeList(base.pinCompanies),
  };
};

const ensureKindList = (kinds, fallbackRules = null) => {
  const source = Array.isArray(kinds) ? kinds : [];
  return KIND_PRESETS.map(({ id }) => {
    const match = source.find((item) => item?.id === id);
    const seedRules = match?.rules
      || (fallbackRules && typeof fallbackRules === 'object' ? fallbackRules : null);
    return {
      id,
      rules: normalizeRuleSet(seedRules || {}),
    };
  });
};

const normalizeGlobalRules = (globalRules) => {
  if (globalRules && Array.isArray(globalRules.kinds)) {
    return { kinds: ensureKindList(globalRules.kinds) };
  }
  const seed = globalRules && typeof globalRules === 'object' ? globalRules : null;
  return { kinds: ensureKindList(null, seed) };
};

const ensureOwnerStructure = (owner = {}) => {
  const ownerId = owner.id || DEFAULT_OWNER_ID;
  const rangePresets = getRangePresets(ownerId);
  const hasRanges = Array.isArray(owner.ranges) && owner.ranges.length > 0;
  const legacyKinds = !hasRanges && Array.isArray(owner.kinds) ? owner.kinds : null;

  if (!rangePresets.length) {
    const fallbackRange = {
      id: 'default',
      label: '기본',
      kinds: ensureKindList(legacyKinds),
    };
    return { ...owner, id: ownerId, name: owner.name || ownerId, ranges: [fallbackRange] };
  }

  const normalizedRanges = rangePresets.map((preset, index) => {
    const existing = (owner.ranges || []).find((range) => range?.id === preset.id);
    let baseKinds = existing?.kinds;
    if ((!baseKinds || baseKinds.length === 0) && legacyKinds && index === 0) {
      baseKinds = legacyKinds;
    }
    return {
      id: preset.id,
      label: preset.label,
      kinds: ensureKindList(baseKinds),
    };
  });

  return {
    ...owner,
    id: ownerId,
    name: owner.name || OWNER_PRESETS.find((preset) => preset.id === ownerId)?.name || ownerId,
    ranges: normalizedRanges,
  };
};

const ensureRegionStructure = (region = {}) => {
  const rawId = region.id || region.region || region.label || '';
  const regionId = typeof rawId === 'string' ? rawId.trim() : String(rawId || '').trim();
  const label = region.label || regionId;
  return {
    id: regionId,
    label,
    kinds: ensureKindList(region.kinds),
  };
};

const ensureRegionsList = (regions = []) => {
  const map = new Map();
  (Array.isArray(regions) ? regions : []).forEach((item) => {
    const normalized = ensureRegionStructure(item || {});
    if (!normalized.id) return;
    if (!map.has(normalized.id)) {
      map.set(normalized.id, normalized);
    }
  });
  return Array.from(map.values());
};

const normalizeDoc = (original) => {
  const base = original && typeof original === 'object' ? original : {};
  const owners = Array.isArray(base.owners) ? base.owners : [];
  const normalizedOwners = owners.map((owner) => ensureOwnerStructure(owner));

  OWNER_PRESETS.forEach((preset) => {
    if (!normalizedOwners.some((owner) => (owner?.id || '').toUpperCase() === preset.id)) {
      normalizedOwners.push(ensureOwnerStructure({ id: preset.id, name: preset.name }));
    }
  });

  const globalRules = normalizeGlobalRules(base.globalRules);
  const regions = ensureRegionsList(base.regions);

  return {
    ...base,
    globalRules,
    owners: normalizedOwners,
    regions,
  };
};

const equalCompanyLists = (a, b) => {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const ai = normalizeCompanyEntry(a[i]);
    const bi = normalizeCompanyEntry(b[i]);
    if (ai.bizNo !== bi.bizNo || ai.name !== bi.name || ai.note !== bi.note || ai.region !== bi.region) return false;
    const snapshotA = ai.snapshot ? JSON.stringify(ai.snapshot) : null;
    const snapshotB = bi.snapshot ? JSON.stringify(bi.snapshot) : null;
    if (snapshotA !== snapshotB) return false;
  }
  return true;
};

const mergeCompanyLists = (lists) => {
  const map = new Map();
  lists
    .filter((list) => Array.isArray(list))
    .flat()
    .forEach((item) => {
      const entry = normalizeCompanyEntry(item);
      const key = entry.bizNo || entry.name;
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, entry);
      } else {
        const existing = map.get(key);
        if (!existing.snapshot && entry.snapshot) map.set(key, entry);
      }
    });
  return Array.from(map.values());
};

export default function AgreementsRulesModal({ open, onClose }) {
  const [doc, setDoc] = React.useState(null);
  const [scope, setScope] = React.useState(DEFAULT_SCOPE);
  const [ownerId, setOwnerId] = React.useState(DEFAULT_OWNER_ID);
  const [rangeId, setRangeId] = React.useState(null);
  const [kindId, setKindId] = React.useState(DEFAULT_KIND_ID);
  const [globalKindId, setGlobalKindId] = React.useState(DEFAULT_KIND_ID);
  const [regionId, setRegionId] = React.useState('');
  const [regionKindId, setRegionKindId] = React.useState(DEFAULT_KIND_ID);
  const [regionOptions, setRegionOptions] = React.useState([]);
  const [status, setStatus] = React.useState('');
  const [qInclude, setQInclude] = React.useState('');
  const [qExclude, setQExclude] = React.useState('');
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchTarget, setSearchTarget] = React.useState(null);
  const [searchInit, setSearchInit] = React.useState('');

  React.useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const response = await window.electronAPI.agreementsRulesLoad();
        if (!response?.success) {
          setStatus(response?.message || '규칙을 불러오지 못했습니다.');
          return;
        }
        const normalized = normalizeDoc(response.data);
        setDoc(normalized);
        setStatus('');
        setScope(DEFAULT_SCOPE);
        setOwnerId(normalized.owners?.[0]?.id || DEFAULT_OWNER_ID);
        setRangeId(getRangePresets(normalized.owners?.[0]?.id || DEFAULT_OWNER_ID)[0]?.id || null);
        setKindId(DEFAULT_KIND_ID);
        setGlobalKindId(DEFAULT_KIND_ID);
        setRegionId(normalized.regions?.[0]?.id || '');
        setRegionKindId(DEFAULT_KIND_ID);
      } catch (err) {
        setStatus('규칙을 불러오지 못했습니다.');
      }
    })();
  }, [open]);

  React.useEffect(() => {
    if (!open || !window.electronAPI?.getRegions) return undefined;
    let canceled = false;
    (async () => {
      try {
        const response = await window.electronAPI.getRegions('all');
        if (canceled) return;
        if (response?.success && Array.isArray(response.data)) {
          const list = response.data
            .map((item) => (typeof item === 'string' ? item.trim() : ''))
            .filter((item) => item && item !== '전체');
          setRegionOptions(Array.from(new Set(list))); // dedupe while preserving order
        }
      } catch {
        /* ignore */
      }
    })();
    return () => { canceled = true; };
  }, [open]);

  React.useEffect(() => {
    if (scope !== SCOPE_SCOPED) return;
    if (!doc) return;
    const owners = doc.owners || [];
    const owner = owners.find((item) => (item?.id || '').toUpperCase() === (ownerId || '').toUpperCase()) || owners[0];
    if (!owner) return;
    if (owner.id !== ownerId) setOwnerId(owner.id);
    const ranges = owner.ranges || [];
    if (!ranges.length) {
      if (rangeId !== null) setRangeId(null);
    } else if (!ranges.some((range) => range.id === rangeId)) {
      setRangeId(ranges[0].id);
    }
    const kinds = (ranges.find((range) => range.id === (rangeId || ranges[0]?.id)) || {}).kinds || [];
    if (!kinds.some((kind) => kind.id === kindId) && kinds[0]?.id) {
      setKindId(kinds[0].id);
    }
  }, [scope, doc, ownerId, rangeId, kindId]);

  React.useEffect(() => {
    if (scope !== SCOPE_GLOBAL) return;
    if (!doc) return;
    const kinds = doc.globalRules?.kinds || [];
    if (!kinds.some((kind) => kind.id === globalKindId) && kinds[0]?.id) {
      setGlobalKindId(kinds[0].id);
    }
  }, [scope, doc, globalKindId]);

  React.useEffect(() => {
    if (scope !== SCOPE_REGION) return;
    if (!doc) return;
    const regions = doc.regions || [];
    if (!regions.length) {
      if (regionId) setRegionId('');
      return;
    }
    const region = regions.find((item) => item?.id === regionId) || regions[0];
    if (region && region.id !== regionId) setRegionId(region.id);
    const kinds = region?.kinds || [];
    if (!kinds.some((kind) => kind.id === regionKindId) && kinds[0]?.id) {
      setRegionKindId(kinds[0].id);
    }
  }, [scope, doc, regionId, regionKindId]);

  const activeRules = React.useMemo(() => {
    if (!doc) return createBaseRuleSet();
    if (scope === SCOPE_GLOBAL) {
      const kinds = doc.globalRules?.kinds || [];
      const kind = kinds.find((item) => item?.id === globalKindId) || kinds[0];
      return kind?.rules || createBaseRuleSet();
    }
    if (scope === SCOPE_REGION) {
      const regions = doc.regions || [];
      const region = regions.find((item) => item?.id === regionId) || regions[0];
      const kinds = region?.kinds || [];
      const kind = kinds.find((item) => item?.id === regionKindId) || kinds[0];
      return kind?.rules || createBaseRuleSet();
    }
    const owners = doc.owners || [];
    const owner = owners.find((item) => (item?.id || '').toUpperCase() === (ownerId || '').toUpperCase());
    const ranges = owner?.ranges || [];
    const range = ranges.find((item) => item?.id === rangeId) || ranges[0];
    const kinds = range?.kinds || [];
    const kind = kinds.find((item) => item?.id === kindId) || kinds[0];
    return kind?.rules || createBaseRuleSet();
  }, [doc, scope, ownerId, rangeId, kindId, globalKindId, regionId, regionKindId]);

  const ensureRegionExists = React.useCallback((targetRegionId) => {
    const trimmed = typeof targetRegionId === 'string' ? targetRegionId.trim() : String(targetRegionId || '').trim();
    if (!trimmed) return;
    setDoc((prev) => {
      const normalized = normalizeDoc(prev);
      const regions = Array.isArray(normalized.regions) ? normalized.regions : [];
      if (regions.some((region) => region?.id === trimmed)) return normalized;
      return {
        ...normalized,
        regions: [...regions, ensureRegionStructure({ id: trimmed, label: trimmed })],
      };
    });
  }, []);

  const updateRulesForKind = React.useCallback((targetKindId, updater) => {
    const ensureRegion = (draft, targetRegionId) => {
      if (!targetRegionId) return draft;
      const trimmed = typeof targetRegionId === 'string' ? targetRegionId.trim() : String(targetRegionId || '').trim();
      if (!trimmed) return draft;
      const regions = Array.isArray(draft.regions) ? draft.regions.slice() : [];
      if (!regions.some((region) => region?.id === trimmed)) {
        regions.push(ensureRegionStructure({ id: trimmed, label: trimmed }));
        draft.regions = regions;
      }
      return draft;
    };

    setDoc((prev) => {
      const next = normalizeDoc(prev);
      if (scope === SCOPE_GLOBAL) {
        const globalKinds = Array.isArray(next.globalRules?.kinds) ? next.globalRules.kinds.slice() : ensureKindList();
        const resolvedKind = targetKindId || globalKindId;
        const kindIndex = globalKinds.findIndex((item) => item?.id === resolvedKind);
        if (kindIndex >= 0) {
          const updated = normalizeRuleSet(updater({ ...globalKinds[kindIndex].rules }) || globalKinds[kindIndex].rules);
          globalKinds[kindIndex] = { ...globalKinds[kindIndex], rules: updated };
        }
        next.globalRules = { kinds: ensureKindList(globalKinds) };
        return next;
      }
      if (scope === SCOPE_REGION) {
        const resolvedKind = targetKindId || regionKindId;
        const resolvedRegion = regionId;
        if (!resolvedRegion) return next;
        ensureRegion(next, resolvedRegion);
        const regions = Array.isArray(next.regions) ? next.regions.slice() : [];
        const regionIndex = regions.findIndex((item) => item?.id === resolvedRegion);
        if (regionIndex === -1) return next;
        const regionEntry = ensureRegionStructure(regions[regionIndex]);
        const kinds = ensureKindList(regionEntry.kinds);
        const kindIndex = kinds.findIndex((item) => item?.id === resolvedKind);
        if (kindIndex === -1) return next;
        const updated = normalizeRuleSet(updater({ ...kinds[kindIndex].rules }) || kinds[kindIndex].rules);
        kinds[kindIndex] = { ...kinds[kindIndex], rules: updated };
        regions[regionIndex] = { ...regionEntry, kinds };
        next.regions = regions;
        return next;
      }
      const owners = next.owners || [];
      const ownerIndex = owners.findIndex((item) => (item?.id || '').toUpperCase() === (ownerId || '').toUpperCase());
      if (ownerIndex === -1) return next;
      const owner = owners[ownerIndex];
      const ranges = owner.ranges || [];
      const rangeIndex = ranges.findIndex((item) => item?.id === rangeId);
      if (rangeIndex === -1) return next;
      const range = ranges[rangeIndex];
      const kinds = range.kinds || [];
      const resolvedKind = targetKindId || kindId;
      const kindIndex = kinds.findIndex((item) => item?.id === resolvedKind);
      if (kindIndex === -1) return next;
      const updated = normalizeRuleSet(updater({ ...kinds[kindIndex].rules }) || kinds[kindIndex].rules);
      kinds[kindIndex] = { ...kinds[kindIndex], rules: updated };
      range.kinds = kinds;
      owner.ranges = ranges;
      owners[ownerIndex] = owner;
      next.owners = owners;
      return next;
    });
  }, [scope, ownerId, rangeId, kindId, globalKindId, regionId, regionKindId]);

  const updateRules = React.useCallback((updater) => {
    let targetKind = kindId;
    if (scope === SCOPE_GLOBAL) targetKind = globalKindId;
    else if (scope === SCOPE_REGION) targetKind = regionKindId;
    updateRulesForKind(targetKind, updater);
  }, [scope, globalKindId, kindId, regionKindId, updateRulesForKind]);

  const onToggle = (key) => (event) => {
    const checked = !!event.target.checked;
    updateRules((rules) => ({ ...rules, [key]: checked }));
  };

  const onListChange = (key, index, field, value) => {
    updateRules((rules) => {
      const list = Array.isArray(rules[key]) ? rules[key].slice() : [];
      while (list.length <= index) list.push({ bizNo: '', name: '', note: '' });
      const entry = { ...list[index], [field]: value };
      if (field === 'bizNo' || field === 'name') entry.snapshot = null;
      list[index] = entry;
      return { ...rules, [key]: list };
    });
  };

  const onListAdd = (key) => updateRules((rules) => ({ ...rules, [key]: [...(rules[key] || []), { bizNo: '', name: '', note: '', snapshot: null }] }));
  const onListRemove = (key, index) => updateRules((rules) => ({ ...rules, [key]: (rules[key] || []).filter((_, i) => i !== index) }));

  const onMgrPairChange = (index, which, value) => {
    updateRules((rules) => {
      const base = Array.isArray(rules.banManagerPairs) ? rules.banManagerPairs.map((pair) => Array.isArray(pair) ? pair.slice() : ['', '']) : [];
      while (base.length <= index) base.push(['', '']);
      base[index][which === 'a' ? 0 : 1] = value;
      return { ...rules, banManagerPairs: base };
    });
  };

  const onMgrPairAdd = () => updateRules((rules) => ({ ...rules, banManagerPairs: [...(rules.banManagerPairs || []), ['', '']] }));
  const onMgrPairRemove = (index) => updateRules((rules) => ({ ...rules, banManagerPairs: (rules.banManagerPairs || []).filter((_, i) => i !== index) }));

  const runSearch = (target) => {
    const query = target === 'include' ? qInclude : qExclude;
    if (!query || !query.trim()) return;
    setSearchTarget(target);
    setSearchInit(query.trim());
    setSearchOpen(true);
  };

  const addPickedCompany = (target, picked) => {
    const key = target === 'include' ? 'alwaysInclude' : 'alwaysExclude';
    updateRules((rules) => {
      const list = Array.isArray(rules[key]) ? rules[key].slice() : [];
      const entry = normalizeCompanyEntry({
        bizNo: picked?.bizNo || picked?.사업자번호 || '',
        name: picked?.name || picked?.업체명 || picked?.['검색된 회사'] || '',
        note: '',
        region: picked?.snapshot?.['대표지역'] || picked?.snapshot?.['지역'] || '',
        snapshot: picked?.snapshot || null,
      });
      const duplicate = list.some((item) => {
        const a = normalizeCompanyEntry(item);
        return a.bizNo === entry.bizNo && a.name === entry.name;
      });
      if (duplicate) {
        list.forEach((item, idx) => {
          const a = normalizeCompanyEntry(item);
          if (a.bizNo === entry.bizNo && a.name === entry.name) {
            list[idx] = entry;
          }
        });
      } else {
        list.push(entry);
      }
      return { ...rules, [key]: list };
    });
  };

  const handleSave = async () => {
    if (!doc) return;
    setStatus('저장 중...');
    const response = await window.electronAPI.agreementsRulesSave(doc);
    if (!response?.success) {
      setStatus(response?.message || '저장에 실패했습니다.');
      return;
    }
    setStatus('저장되었습니다');
    setTimeout(() => setStatus(''), 1200);
  };

  const activeOwnerRanges = React.useMemo(() => {
    if (!doc) return [];
    const owner = (doc.owners || []).find((item) => (item?.id || '').toUpperCase() === (ownerId || '').toUpperCase());
    return owner?.ranges || [];
  }, [doc, ownerId]);

  const activeRangeKinds = React.useMemo(() => {
    if (!doc || scope === SCOPE_GLOBAL) return [];
    const owner = (doc.owners || []).find((item) => (item?.id || '').toUpperCase() === (ownerId || '').toUpperCase());
    const range = owner?.ranges?.find((item) => item?.id === rangeId);
    return range?.kinds || [];
  }, [doc, ownerId, rangeId, scope]);

  const regionOptionEntries = React.useMemo(() => {
    const map = new Map();
    (doc?.regions || []).forEach((region) => {
      if (!region) return;
      const key = String(region.id || region.label || '').trim();
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, { id: key, label: region.label || key });
      }
    });
    regionOptions.forEach((name) => {
      const key = String(name || '').trim();
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, { id: key, label: key });
      }
    });
    return Array.from(map.values());
  }, [doc, regionOptions]);

  const activeRegionKinds = React.useMemo(() => {
    if (!doc) return KIND_PRESETS;
    const region = (doc.regions || []).find((item) => item?.id === regionId);
    return region?.kinds || KIND_PRESETS;
  }, [doc, regionId]);

  const renderAlwaysList = (label, key, queryState, setQuery) => (
    <div className="rules-box">
      <label>
        {label}
        <span className="pill">{Array.isArray(activeRules[key]) ? activeRules[key].length : 0}</span>
      </label>
      <div className="rules-toolbar" style={{ marginTop: 6 }}>
        <input
          className="filter-input"
          placeholder="업체명 검색"
          value={queryState}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') runSearch(key === 'alwaysInclude' ? 'include' : 'exclude'); }}
        />
        <button className="btn-sm btn-soft" onClick={() => runSearch(key === 'alwaysInclude' ? 'include' : 'exclude')}>검색</button>
        <button className="btn-sm btn-muted" onClick={() => setQuery('')}>지우기</button>
      </div>
      <div className="rules-list">
        {(activeRules[key] || []).map((item, index) => (
          <div key={`${key}-${index}`} className="rule-entry">
            <input
              className="filter-input"
              placeholder="사업자번호"
              value={item.bizNo || ''}
              onChange={(e) => onListChange(key, index, 'bizNo', e.target.value.replace(/[^0-9-]/g, ''))}
            />
            <input
              className="filter-input"
              placeholder="업체명"
              value={item.name || ''}
              onChange={(e) => onListChange(key, index, 'name', e.target.value)}
            />
            <input
              className="filter-input"
              placeholder="메모"
              value={item.note || ''}
              onChange={(e) => onListChange(key, index, 'note', e.target.value)}
            />
            <button className="btn-sm btn-muted" onClick={() => onListRemove(key, index)}>삭제</button>
          </div>
        ))}
      </div>
      <button className="btn-sm btn-soft" style={{ marginTop: 6 }} onClick={() => onListAdd(key)}>추가</button>
    </div>
  );

  const renderScopeSelectors = () => (
    <div className="scope-selectors">
      <div className="filter-item">
        <label>발주처</label>
        <select className="filter-input" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
          {(doc?.owners || []).map((owner) => (
            <option key={owner.id} value={owner.id}>{owner.name || owner.id}</option>
          ))}
        </select>
      </div>
      <div className="filter-item">
        <label>금액 구간</label>
        <select className="filter-input" value={rangeId || ''} onChange={(e) => setRangeId(e.target.value)}>
          {(activeOwnerRanges || []).map((range) => (
            <option key={range.id} value={range.id}>{range.label || range.id}</option>
          ))}
        </select>
      </div>
      <div className="filter-item">
        <label>공종</label>
        <select className="filter-input" value={kindId} onChange={(e) => setKindId(e.target.value)}>
          {(activeRangeKinds || KIND_PRESETS).map((kind) => {
            const id = kind.id || kind;
            const label = KIND_PRESETS.find((preset) => preset.id === id)?.label || id;
            return <option key={id} value={id}>{label}</option>;
          })}
        </select>
      </div>
    </div>
  );

  const renderGlobalKindSelector = () => (
    <div className="scope-selectors">
      <div className="filter-item" style={{ maxWidth: 220 }}>
        <label>공종</label>
        <select className="filter-input" value={globalKindId} onChange={(e) => setGlobalKindId(e.target.value)}>
          {(doc?.globalRules?.kinds || KIND_PRESETS).map((kind) => {
            const id = kind.id || kind;
            const label = KIND_PRESETS.find((preset) => preset.id === id)?.label || id;
            return <option key={id} value={id}>{label}</option>;
          })}
        </select>
      </div>
    </div>
  );

  const renderRegionSelectors = () => {
    const hasRegions = regionOptionEntries.length > 0;
    return (
      <div className="scope-selectors">
        <div className="filter-item" style={{ minWidth: 220 }}>
          <label>지역</label>
          {hasRegions ? (
            <select
              className="filter-input"
              value={regionId || ''}
              onChange={(e) => {
                const value = e.target.value;
                setRegionId(value);
                ensureRegionExists(value);
              }}
            >
              <option value="" disabled>지역을 선택하세요</option>
              {regionOptionEntries.map((region) => (
                <option key={region.id} value={region.id}>{region.label || region.id}</option>
              ))}
            </select>
          ) : (
            <div style={{ padding: '8px 0', color: '#6b7280' }}>등록된 지역 규칙이 없습니다.</div>
          )}
        </div>
        <div className="filter-item" style={{ minWidth: 180 }}>
          <label>공종</label>
          <select
            className="filter-input"
            value={regionKindId}
            onChange={(e) => setRegionKindId(e.target.value)}
          >
            {(hasRegions ? activeRegionKinds : KIND_PRESETS).map((kind) => {
              const id = kind.id || kind;
              const label = KIND_PRESETS.find((preset) => preset.id === id)?.label || id;
              return <option key={id} value={id}>{label}</option>;
            })}
          </select>
        </div>
      </div>
    );
  };

  const resolvedKindId = scope === SCOPE_GLOBAL
    ? globalKindId
    : (scope === SCOPE_REGION ? regionKindId : kindId);

  return (
    <>
      <Modal open={open} onClose={onClose} onCancel={onClose} onSave={handleSave} title="협정 규칙 편집" size="lg" maxWidth={1120}>
        {!doc ? (
          <div style={{ color: '#6b7280' }}>{status || '규칙을 불러오는 중입니다...'}</div>
        ) : (
          <div className="rules-modal">
            {status && <div className="error-message" style={{ background: '#eef2ff', color: '#111827' }}>{status}</div>}
            <div className="scope-tabs">
              <button
                className={scope === SCOPE_GLOBAL ? 'btn-sm btn-primary' : 'btn-sm btn-soft'}
                onClick={() => setScope(SCOPE_GLOBAL)}
              >
                전체 규칙
              </button>
              <button
                className={scope === SCOPE_SCOPED ? 'btn-sm btn-primary' : 'btn-sm btn-soft'}
                onClick={() => setScope(SCOPE_SCOPED)}
              >
                발주처 규칙
              </button>
              <button
                className={scope === SCOPE_REGION ? 'btn-sm btn-primary' : 'btn-sm btn-soft'}
                onClick={() => setScope(SCOPE_REGION)}
              >
                지역 규칙
              </button>
            </div>

            {scope === SCOPE_SCOPED && renderScopeSelectors()}
            {scope === SCOPE_GLOBAL && renderGlobalKindSelector()}
            {scope === SCOPE_REGION && renderRegionSelectors()}

            <div className="section">
              <h4 className="section-title">후보 필터</h4>
              <div className="section-divider" />
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={!!activeRules.excludeSingleBidEligible} onChange={onToggle('excludeSingleBidEligible')} />
                단독입찰 가능 업체 제외
              </label>
              <div className="section-help">후보 수집 단계에서 단독입찰 가능 업체를 자동 제외합니다.</div>
            </div>

            <div className="section">
              <h4 className="section-title">항상 포함 / 제외</h4>
              <div className="section-divider" />
              <div className="grid-2 rules-split">
                {renderAlwaysList('항상 포함(alwaysInclude)', 'alwaysInclude', qInclude, setQInclude)}
                {renderAlwaysList('항상 제외(alwaysExclude)', 'alwaysExclude', qExclude, setQExclude)}
              </div>
            </div>

            <div className="section">
              <h4 className="section-title">담당자/업체 조합 제한</h4>
              <div className="section-divider" />
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={!!activeRules.banSameManager} onChange={onToggle('banSameManager')} />
                동일 담당자 중복 배치 금지
              </label>
              <div className="section-help">동일 담당자가 속한 업체끼리는 같은 협정에 배치하지 않습니다.</div>

              <div className="rules-box" style={{ marginTop: 12 }}>
                <label>담당자 조합 금지</label>
                <div className="rules-list">
                  {(activeRules.banManagerPairs || []).map((pair, index) => (
                    <div key={`mgr-${index}`} className="rule-entry">
                      <input
                        className="filter-input"
                        placeholder="담당자 A"
                        value={pair?.[0] || ''}
                        onChange={(e) => onMgrPairChange(index, 'a', e.target.value)}
                      />
                      <input
                        className="filter-input"
                        placeholder="담당자 B"
                        value={pair?.[1] || ''}
                        onChange={(e) => onMgrPairChange(index, 'b', e.target.value)}
                      />
                      <button className="btn-sm btn-muted" onClick={() => onMgrPairRemove(index)}>삭제</button>
                    </div>
                  ))}
                </div>
                <button className="btn-sm btn-soft" style={{ marginTop: 6 }} onClick={onMgrPairAdd}>추가</button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {searchOpen && (
        <CompanySearchModal
          open={searchOpen}
          onClose={() => { setSearchOpen(false); setSearchTarget(null); }}
          initialQuery={searchInit}
          fileType={resolvedKindId || undefined}
          onPick={(picked) => {
            if (searchTarget) addPickedCompany(searchTarget, picked);
            setSearchOpen(false);
            setSearchTarget(null);
          }}
        />
      )}
    </>
  );
}
