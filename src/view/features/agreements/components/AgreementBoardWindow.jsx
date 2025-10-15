import React from 'react';
import { createPortal } from 'react-dom';

const DEFAULT_GROUP_SIZE = 3;
const MIN_GROUPS = 4;

const normalizeRuleEntry = (entry = {}) => ({
  bizNo: entry.bizNo ? String(entry.bizNo) : '',
  name: entry.name ? String(entry.name) : '',
  note: entry.note ? String(entry.note) : '',
  region: entry.region ? String(entry.region) : '',
  snapshot: entry.snapshot && typeof entry.snapshot === 'object' ? { ...entry.snapshot } : null,
});

const getCompanyName = (company) => (
  company?.name
  || company?.companyName
  || company?.bizName
  || company?.['업체명']
  || company?.['검색된 회사']
  || '이름 미확인'
);

const getRegionLabel = (company) => (
  company?.region
  || company?.['대표지역']
  || company?.['지역']
  || company?.snapshot?.['대표지역']
  || company?.snapshot?.['지역']
  || '지역 미지정'
);

const normalizeRegion = (value) => {
  if (!value) return '';
  return String(value).replace(/\s+/g, '').trim();
};

const toNumber = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const cleaned = String(value).replace(/[^0-9.\-]/g, '').trim();
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatScore = (score) => {
  const value = toNumber(score);
  if (value === null) return '-';
  if (Math.abs(value) >= 1000) {
    try { return value.toLocaleString('ko-KR'); } catch (err) { return String(value); }
  }
  return value.toFixed(2).replace(/\.00$/, '');
};

const formatAmount = (value) => {
  const number = toNumber(value);
  if (number === null) return '-';
  try { return number.toLocaleString('ko-KR'); } catch (err) { return String(number); }
};

const extractValue = (candidate, keys = []) => {
  if (!candidate) return null;
  for (const key of keys) {
    if (candidate[key] !== undefined && candidate[key] !== null && candidate[key] !== '') {
      return candidate[key];
    }
    if (candidate.snapshot && candidate.snapshot[key] !== undefined && candidate.snapshot[key] !== null && candidate.snapshot[key] !== '') {
      return candidate.snapshot[key];
    }
  }
  return null;
};

const extractByKeywords = (candidate, keywordGroups = []) => {
  if (!candidate || typeof candidate !== 'object') return null;
  for (const keywords of keywordGroups) {
    for (const key of Object.keys(candidate)) {
      if (typeof key !== 'string') continue;
      const normalized = key.replace(/\s+/g, '').toLowerCase();
      if (!normalized) continue;
      if (keywords.some((keyword) => normalized.includes(keyword))) {
        const value = candidate[key];
        if (value !== undefined && value !== null && value !== '') return value;
      }
    }
  }
  return null;
};

const extractAmountValue = (candidate, directKeys = [], keywordGroups = []) => {
  const direct = extractValue(candidate, directKeys);
  if (direct !== null && direct !== undefined && direct !== '') return direct;
  const sources = [candidate, candidate?.snapshot].filter(Boolean);
  for (const source of sources) {
    const value = extractByKeywords(source, keywordGroups);
    if (value !== null && value !== undefined && value !== '') return value;
  }
  return null;
};

const getBizNo = (company = {}) => {
  const raw = company.bizNo
    || company.biz_no
    || company.bizno
    || company.bizNumber
    || company.biznumber
    || company.businessNumber
    || company['사업자번호']
    || company['사업자 번호']
    || company['사업자등록번호']
    || company['사업자등록 번호']
    || company['법인등록번호']
    || company['법인등록 번호']
    || company['법인번호'];
  if (raw === null || raw === undefined) return '';
  return typeof raw === 'number' ? String(raw) : String(raw || '').trim();
};

const normalizeBizNo = (value) => (value ? String(value).replace(/[^0-9]/g, '') : '');

const isRegionExplicitlySelected = (candidate) => {
  if (!candidate || typeof candidate !== 'object') return false;
  const flagKeys = ['regionSelected', 'isRegionSelected', '_regionSelected', 'selectedRegion'];
  for (const key of flagKeys) {
    if (candidate[key] === true || candidate[key] === 'Y') return true;
  }
  const textKeys = ['지역선택', '지역지정'];
  for (const key of textKeys) {
    const value = candidate[key];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed === '선택' || trimmed === 'Y' || trimmed === '사용') return true;
    }
  }
  return false;
};

const copyStyles = (sourceDoc, targetDoc) => {
  if (!sourceDoc || !targetDoc) return;
  const existing = targetDoc.querySelectorAll('[data-agreement-board-style="1"]');
  existing.forEach((node) => node.parentNode.removeChild(node));

  Array.from(sourceDoc.styleSheets).forEach((styleSheet) => {
    try {
      if (styleSheet.href) {
        const link = targetDoc.createElement('link');
        link.rel = 'stylesheet';
        link.href = styleSheet.href;
        link.setAttribute('data-agreement-board-style', '1');
        targetDoc.head.appendChild(link);
      } else if (styleSheet.ownerNode && styleSheet.ownerNode.textContent) {
        const style = targetDoc.createElement('style');
        style.type = 'text/css';
        style.setAttribute('data-agreement-board-style', '1');
        style.textContent = styleSheet.ownerNode.textContent;
        targetDoc.head.appendChild(style);
      }
    } catch {
      /* ignore CORS-protected stylesheets */
    }
  });
};

const buildEntryUid = (prefix, candidate, index, seen) => {
  const rawId = candidate?.id
    || candidate?.bizNo
    || candidate?.사업자번호
    || candidate?.companyCode
    || candidate?.companyId
    || candidate?.['검색된 회사']
    || candidate?.['업체명']
    || `${prefix}-${index}`;
  const base = `${prefix}-${String(rawId).trim() || index}`;
  const count = seen.get(base) || 0;
  const uid = count === 0 ? base : `${base}-${count + 1}`;
  seen.set(base, count + 1);
  return uid;
};

export default function AgreementBoardWindow({
  open,
  onClose,
  candidates = [],
  pinned = [],
  excluded = [],
  dutyRegions = [],
  groupSize = DEFAULT_GROUP_SIZE,
  title = '협정보드',
  alwaysInclude = [],
}) {
  const boardWindowRef = React.useRef(null);
  const [portalContainer, setPortalContainer] = React.useState(null);
  const [groupAssignments, setGroupAssignments] = React.useState([]);
  const [draggingId, setDraggingId] = React.useState(null);
  const [dropTarget, setDropTarget] = React.useState(null);
  const [groupShares, setGroupShares] = React.useState([]);
  const prevAssignmentsRef = React.useRef(groupAssignments);

  const closeWindow = React.useCallback(() => {
    const win = boardWindowRef.current;
    if (win && !win.closed) {
      if (win.__agreementBoardCleanup) {
        try { win.__agreementBoardCleanup(); } catch {}
        delete win.__agreementBoardCleanup;
      }
      win.close();
    }
    boardWindowRef.current = null;
    setPortalContainer(null);
  }, []);

  const ensureWindow = React.useCallback(() => {
    if (typeof window === 'undefined') return;
    if (boardWindowRef.current && boardWindowRef.current.closed) {
      boardWindowRef.current = null;
      setPortalContainer(null);
    }

    if (!boardWindowRef.current) {
      const width = Math.min(1180, Math.max(720, window.innerWidth - 160));
      const height = Math.min(880, Math.max(640, window.innerHeight - 120));
      const dualScreenLeft = window.screenLeft !== undefined ? window.screenLeft : window.screenX;
      const dualScreenTop = window.screenTop !== undefined ? window.screenTop : window.screenY;
      const left = Math.max(24, dualScreenLeft + window.innerWidth - width - 48);
      const top = Math.max(48, dualScreenTop + 48);
      const features = `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`;
      const child = window.open('', 'company-search-agreement-board', features);
      if (!child) return;
      child.document.title = title;
      child.document.body.style.margin = '0';
      child.document.body.style.background = '#f3f4f6';
      child.document.body.innerHTML = '';
      const root = child.document.createElement('div');
      root.id = 'agreement-board-root';
      child.document.body.appendChild(root);
      copyStyles(document, child.document);
      boardWindowRef.current = child;
      setPortalContainer(root);
      const handleBeforeUnload = () => {
        boardWindowRef.current = null;
        setPortalContainer(null);
        onClose?.();
      };
      child.addEventListener('beforeunload', handleBeforeUnload);
      child.__agreementBoardCleanup = () => child.removeEventListener('beforeunload', handleBeforeUnload);
    } else {
      const win = boardWindowRef.current;
      if (win.document && win.document.readyState === 'complete') {
        copyStyles(document, win.document);
      }
      if (!portalContainer && win.document) {
        const existingRoot = win.document.getElementById('agreement-board-root');
        if (existingRoot) setPortalContainer(existingRoot);
      }
      try { win.focus(); } catch {}
    }
  }, [onClose, portalContainer, title]);

  React.useEffect(() => {
    if (open) {
      ensureWindow();
    } else {
      closeWindow();
    }
  }, [open, ensureWindow, closeWindow]);

  React.useEffect(() => () => { closeWindow(); }, [closeWindow]);

  React.useEffect(() => {
    if (!open) return;
    const win = boardWindowRef.current;
    if (!win || win.closed || !win.document) return;
    win.document.title = title || '협정보드';
  }, [title, open]);

  const dutyRegionSet = React.useMemo(() => {
    const entries = Array.isArray(dutyRegions) ? dutyRegions : [];
    return new Set(entries.map((entry) => normalizeRegion(entry)).filter(Boolean));
  }, [dutyRegions]);

  const pinnedSet = React.useMemo(() => new Set(pinned || []), [pinned]);
  const excludedSet = React.useMemo(() => new Set(excluded || []), [excluded]);
  const safeGroupSize = React.useMemo(() => {
    const parsed = Number(groupSize);
    if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_GROUP_SIZE;
    return Math.max(1, Math.floor(parsed));
  }, [groupSize]);

  const representativeCandidatesRaw = React.useMemo(
    () => (candidates || []).filter((candidate) => candidate && !excludedSet.has(candidate.id)),
    [candidates, excludedSet],
  );

  const isDutyRegionCompany = React.useCallback((company) => {
    if (!company) return false;
    if (dutyRegionSet.size === 0) return false;
    const region = normalizeRegion(getRegionLabel(company));
    if (!region) return false;
    if (dutyRegionSet.has(region)) return true;
    for (const entry of dutyRegionSet.values()) {
      if (region.startsWith(entry) || entry.startsWith(region)) return true;
    }
    return false;
  }, [dutyRegionSet]);

  const representativeCandidates = React.useMemo(
    () => representativeCandidatesRaw.filter((candidate) => !isDutyRegionCompany(candidate)),
    [representativeCandidatesRaw, isDutyRegionCompany],
  );

  const regionCandidates = React.useMemo(
    () => representativeCandidatesRaw.filter((candidate) => isDutyRegionCompany(candidate)),
    [representativeCandidatesRaw, isDutyRegionCompany],
  );

  const alwaysIncludeItems = React.useMemo(() => (
    Array.isArray(alwaysInclude)
      ? alwaysInclude.filter((item) => item && (item.bizNo || item.name)).map((item) => normalizeRuleEntry(item))
      : []
  ), [alwaysInclude]);

  const alwaysIncludeMap = React.useMemo(() => {
    const map = new Map();
    alwaysIncludeItems.forEach((entry) => {
      const bizKey = normalizeBizNo(entry.bizNo);
      const nameKey = String(entry.name || '').trim().toLowerCase();
      if (bizKey && !map.has(`biz:${bizKey}`)) map.set(`biz:${bizKey}`, entry);
      if (nameKey && !map.has(`name:${nameKey}`)) map.set(`name:${nameKey}`, entry);
    });
    return map;
  }, [alwaysIncludeItems]);

  const representativeEntries = React.useMemo(() => {
    const seen = new Map();
    const matchedRuleBiz = new Set();
    const entries = representativeCandidates.map((candidate, index) => {
      const bizNo = normalizeBizNo(getBizNo(candidate));
      const nameKey = String(getCompanyName(candidate) || '').trim().toLowerCase();
      const pinnedEntry = (bizNo && alwaysIncludeMap.get(`biz:${bizNo}`))
        || (nameKey && alwaysIncludeMap.get(`name:${nameKey}`))
        || null;
      const pinnedByRule = !!pinnedEntry;
      if (pinnedByRule && bizNo) matchedRuleBiz.add(bizNo);
      return {
        uid: buildEntryUid('rep', candidate, index, seen),
        candidate,
        type: 'representative',
        pinned: pinnedSet.has(candidate?.id) || pinnedByRule,
        ruleSnapshot: pinnedEntry?.snapshot || null,
      };
    });
    let syntheticIndex = representativeCandidates.length;
    alwaysIncludeItems.forEach((item) => {
      const bizNo = normalizeBizNo(item.bizNo);
      const nameKey = String(item.name || '').trim().toLowerCase();
      const alreadyRepresented = (bizNo && matchedRuleBiz.has(bizNo))
        || entries.some((entry) => {
          const entryBiz = normalizeBizNo(getBizNo(entry.candidate));
          const entryName = String(getCompanyName(entry.candidate) || '').trim().toLowerCase();
          if (bizNo && entryBiz === bizNo) return true;
          if (nameKey && entryName === nameKey) return true;
          return false;
        });
      if (alreadyRepresented) return;
      const snapshot = item.snapshot && typeof item.snapshot === 'object' ? { ...item.snapshot } : null;
      let candidate;
      if (snapshot) {
        candidate = { ...snapshot };
        if (!candidate['검색된 회사'] && item.name) candidate['검색된 회사'] = item.name;
        if (!candidate['사업자번호'] && bizNo) candidate['사업자번호'] = bizNo;
      } else {
        candidate = {
          bizNo: item.bizNo || '',
          사업자번호: item.bizNo || '',
          name: item.name || item.bizNo || '대표사',
          업체명: item.name || item.bizNo || '대표사',
          '검색된 회사': item.name || item.bizNo || '대표사',
          대표지역: item.region || '',
          region: item.region || '',
          note: item.note || '',
        };
      }
      candidate.id = candidate.id || (bizNo ? `rules:${bizNo}` : undefined);
      candidate._synthetic = true;
      const canonicalSipyung = candidate._sipyung ?? extractAmountValue(
        candidate,
        ['_sipyung', 'sipyung', '시평', '시평액', '시평액(원)', '시평금액', '기초금액', '기초금액(원)'],
        [['시평', '심평', 'sipyung', '기초금액', '추정가격', '시평총액']]
      );
      if (canonicalSipyung !== null && canonicalSipyung !== undefined) candidate._sipyung = canonicalSipyung;
      const canonicalPerformance = candidate._performance5y ?? extractAmountValue(
        candidate,
        ['_performance5y', 'performance5y', '5년 실적', '5년실적', '5년 실적 합계', '최근5년실적', '최근5년실적합계', '5년실적금액', '최근5년시공실적'],
        [['5년실적', '최근5년', 'fiveyear', 'performance5', '시공실적']]
      );
      if (canonicalPerformance !== null && canonicalPerformance !== undefined) candidate._performance5y = canonicalPerformance;
      const canonicalScore = candidate._score ?? extractAmountValue(
        candidate,
        ['_score', 'score', 'totalScore', '총점', '평균점수', '적격점수', '종합점수', '평가점수'],
        [['총점', '평균점수', 'score', '점수', '적격점수', '종합점수', '평가점수']]
      );
      if (canonicalScore !== null && canonicalScore !== undefined) candidate._score = canonicalScore;
      const canonicalShare = candidate._share ?? extractAmountValue(
        candidate,
        ['_share', '_pct', 'candidateShare', 'share', '지분', '기본지분'],
        [['지분', 'share', '비율']]
      );
      if (canonicalShare !== null && canonicalShare !== undefined) candidate._share = canonicalShare;
      const entry = {
        uid: buildEntryUid('rep-rule', candidate, syntheticIndex, seen),
        candidate,
        type: 'representative',
        pinned: true,
        synthetic: true,
      };
      syntheticIndex += 1;
      entries.push(entry);
    });
    return entries;
  }, [representativeCandidates, pinnedSet, alwaysIncludeItems, alwaysIncludeMap]);

  const selectedRegionCandidates = React.useMemo(() => {
    const pinnedMatches = regionCandidates.filter((candidate) => pinnedSet.has(candidate?.id));
    if (pinnedMatches.length > 0) return pinnedMatches;
    return regionCandidates.filter((candidate) => isRegionExplicitlySelected(candidate));
  }, [regionCandidates, pinnedSet]);

  const regionEntries = React.useMemo(() => {
    const seen = new Map();
    return selectedRegionCandidates.map((candidate, index) => ({
      uid: buildEntryUid('region', candidate, index, seen),
      candidate,
      type: 'region',
    }));
  }, [selectedRegionCandidates]);

  const participantMap = React.useMemo(() => {
    const map = new Map();
    representativeEntries.forEach((entry) => {
      let mergedCandidate = entry.candidate;
      if (entry.ruleSnapshot) {
        mergedCandidate = { ...entry.ruleSnapshot, ...mergedCandidate };
      }
      if (mergedCandidate?.snapshot && typeof mergedCandidate.snapshot === 'object') {
        mergedCandidate = { ...mergedCandidate.snapshot, ...mergedCandidate };
      }
      map.set(entry.uid, { ...entry, candidate: mergedCandidate });
    });
    regionEntries.forEach((entry) => {
      let mergedCandidate = entry.candidate;
      if (mergedCandidate?.snapshot && typeof mergedCandidate.snapshot === 'object') {
        mergedCandidate = { ...mergedCandidate.snapshot, ...mergedCandidate };
      }
      map.set(entry.uid, { ...entry, candidate: mergedCandidate });
    });
    return map;
  }, [representativeEntries, regionEntries]);

  const buildInitialAssignments = React.useCallback(() => {
    const assignableIds = representativeEntries.filter((entry) => !entry.pinned).map((entry) => entry.uid);
    const groupCount = Math.max(MIN_GROUPS, Math.ceil(representativeEntries.length / safeGroupSize));
    const result = [];
    let cursor = 0;
    for (let g = 0; g < groupCount; g += 1) {
      const group = [];
      for (let s = 0; s < safeGroupSize; s += 1) {
        group.push(cursor < assignableIds.length ? assignableIds[cursor] : null);
        cursor += 1;
      }
      result.push(group);
    }
    return result;
  }, [representativeEntries, safeGroupSize]);

  React.useEffect(() => {
    if (!open) return;
    const validIds = new Set([
      ...representativeEntries.map((entry) => entry.uid),
      ...regionEntries.map((entry) => entry.uid),
    ]);
    setGroupAssignments((prev) => {
      if (!prev || prev.length === 0) {
        return buildInitialAssignments();
      }
      const groupCount = Math.max(MIN_GROUPS, Math.ceil(representativeEntries.length / safeGroupSize));
      const trimmed = prev.slice(0, groupCount).map((group) => group.slice(0, safeGroupSize));
      while (trimmed.length < groupCount) {
        trimmed.push(Array(safeGroupSize).fill(null));
      }
      const cleaned = trimmed.map((group) => group.map((id) => (id && validIds.has(id) ? id : null)));
      const used = new Set();
      cleaned.forEach((group) => group.forEach((id) => { if (id) used.add(id); }));
      const remainingReps = representativeEntries
        .filter((entry) => !entry.pinned)
        .map((entry) => entry.uid)
        .filter((id) => !used.has(id));
      for (let g = 0; g < cleaned.length; g += 1) {
        for (let s = 0; s < cleaned[g].length; s += 1) {
          if (cleaned[g][s] === null && remainingReps.length > 0) {
            cleaned[g][s] = remainingReps.shift();
          }
        }
      }
      return cleaned;
    });
  }, [open, representativeEntries, regionEntries, safeGroupSize, buildInitialAssignments]);

  const assignedIds = React.useMemo(() => {
    const set = new Set();
    groupAssignments.forEach((group) => group.forEach((id) => { if (id) set.add(id); }));
    return set;
  }, [groupAssignments]);

  const pinnedRepresentatives = React.useMemo(
    () => representativeEntries.filter((entry) => !assignedIds.has(entry.uid) && entry.pinned),
    [representativeEntries, assignedIds],
  );

  const freeRepresentatives = React.useMemo(
    () => representativeEntries.filter((entry) => !assignedIds.has(entry.uid) && !entry.pinned),
    [representativeEntries, assignedIds],
  );

  const availableRegionEntries = React.useMemo(() => (
    regionEntries.filter((entry) => !assignedIds.has(entry.uid))
  ), [regionEntries, assignedIds]);

  const summary = React.useMemo(() => ({
    representativeTotal: representativeEntries.length,
    pinnedRepresentatives: pinnedRepresentatives.length,
    selectedRegions: regionEntries.length,
    groups: groupAssignments.length,
  }), [representativeEntries.length, pinnedRepresentatives.length, regionEntries.length, groupAssignments.length]);

  React.useEffect(() => {
    setGroupShares((prevShares) => {
      const shareMap = new Map();
      const prevAssignments = prevAssignmentsRef.current || [];
      prevAssignments.forEach((group, gIdx) => {
        group.forEach((id, idx) => {
          if (id) {
            const value = prevShares[gIdx]?.[idx] ?? '';
            shareMap.set(id, value);
          }
        });
      });
      const nextShares = groupAssignments.map((group) => group.map((id) => (id ? (shareMap.get(id) ?? '') : '')));
      prevAssignmentsRef.current = groupAssignments;
      return nextShares;
    });
  }, [groupAssignments]);

  const handleDragStart = (id) => (event) => {
    if (!id) return;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', id);
    setDraggingId(id);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDropTarget(null);
  };

  const handleRemove = (groupIndex, slotIndex) => {
    setGroupAssignments((prev) => {
      const next = prev.map((group) => group.slice());
      if (next[groupIndex]) next[groupIndex][slotIndex] = null;
      return next;
    });
  };

  const handleDropInternal = (groupIndex, slotIndex, id) => {
    if (!id || !participantMap.has(id)) return;
    setGroupAssignments((prev) => {
      const next = prev.map((group) => group.slice());
      next.forEach((group, gIdx) => {
        for (let i = 0; i < group.length; i += 1) {
          if (group[i] === id) {
            next[gIdx][i] = null;
          }
        }
      });
      if (!next[groupIndex]) {
        next[groupIndex] = Array(safeGroupSize).fill(null);
      }
      next[groupIndex][slotIndex] = id;
      return next;
    });
    setDraggingId(null);
    setDropTarget(null);
  };

  const handleDropFromEvent = (groupIndex, slotIndex) => (event) => {
    event.preventDefault();
    const id = event.dataTransfer.getData('text/plain');
    handleDropInternal(groupIndex, slotIndex, id);
  };

  const handleDragOver = (groupIndex, slotIndex) => (event) => {
    event.preventDefault();
    if (!dropTarget || dropTarget.groupIndex !== groupIndex || dropTarget.slotIndex !== slotIndex) {
      setDropTarget({ groupIndex, slotIndex });
    }
  };

  const handleDragLeave = (groupIndex, slotIndex) => () => {
    if (dropTarget && dropTarget.groupIndex === groupIndex && dropTarget.slotIndex === slotIndex) {
      setDropTarget(null);
    }
  };

  const handleAddGroup = () => {
    setGroupAssignments((prev) => [...prev, Array(safeGroupSize).fill(null)]);
  };

  const handleResetGroups = () => {
    setGroupAssignments(buildInitialAssignments());
    setDropTarget(null);
  };

  const handleShareInput = (groupIndex, slotIndex, rawValue) => {
    const sanitized = rawValue.replace(/[^0-9.]/g, '');
    if ((sanitized.match(/\./g) || []).length > 1) return;
    setGroupShares((prev) => {
      const next = prev.map((row) => row.slice());
      while (next.length <= groupIndex) next.push([]);
      while (next[groupIndex].length <= slotIndex) next[groupIndex].push('');
      next[groupIndex][slotIndex] = sanitized;
      return next;
    });
  };

  const groups = React.useMemo(() => (
    groupAssignments.map((group, index) => ({
      id: index + 1,
      memberIds: group,
      members: group.map((uid) => (uid ? participantMap.get(uid) || null : null)),
    }))
  ), [groupAssignments, participantMap]);

  const renderMemberCard = (entry, slotIndex, groupIndex) => {
    const slotActive = dropTarget && dropTarget.groupIndex === groupIndex && dropTarget.slotIndex === slotIndex;
    if (!entry) {
      return (
        <div
          key={`placeholder-${groupIndex}-${slotIndex}`}
          className={`agreement-board-member placeholder${slotActive ? ' drop-active' : ''}`}
          onDragOver={handleDragOver(groupIndex, slotIndex)}
          onDragEnter={handleDragOver(groupIndex, slotIndex)}
          onDragLeave={handleDragLeave(groupIndex, slotIndex)}
          onDrop={handleDropFromEvent(groupIndex, slotIndex)}
        >
          <div className="member-empty">대표사/지역사를 끌어다 놓으세요</div>
        </div>
      );
    }

    const { uid, candidate, type } = entry;
    const matchesDutyRegion = isDutyRegionCompany(candidate);
    const shareSource = candidate._share ?? extractAmountValue(
      candidate,
      ['_pct', 'candidateShare', 'share', '지분', '기본지분'],
      [['지분', 'share', '비율']]
    );
    const share = toNumber(shareSource);
    const shareValue = groupShares[groupIndex]?.[slotIndex] ?? '';
    const displayShare = shareValue !== '' ? shareValue : (share !== null ? share.toFixed(1) : '');

    const sipyungRaw = candidate._sipyung ?? extractAmountValue(
      candidate,
      ['sipyung', '시평', '시평액', '시평액(원)', '시평금액', '기초금액', '기초금액(원)'],
      [['시평', '심평', 'sipyung', '기초금액', '추정가격', '시평총액']]
    );
    const fiveYearRaw = candidate._performance5y ?? extractAmountValue(
      candidate,
      ['performance5y', '5년 실적', '5년실적', '5년 실적 합계', '최근5년실적', '최근5년실적합계', '5년실적금액', '최근5년시공실적'],
      [['5년실적', '최근5년', 'fiveyear', 'performance5', '시공실적']]
    );
    const ratingRaw = candidate._score ?? extractAmountValue(
      candidate,
      ['score', 'totalScore', '총점', '평균점수', '적격점수', '종합점수', '평가점수'],
      [['총점', '평균점수', 'score', '점수', '적격점수', '종합점수', '평가점수']]
    );

    const sipyung = sipyungRaw ?? candidate.sipyung;
    const fiveYear = fiveYearRaw ?? candidate.performance5y;
    const rating = ratingRaw ?? candidate.score;

    const classes = ['agreement-board-member', 'assigned'];
    if (matchesDutyRegion || type === 'region') classes.push('region');
    if (draggingId === uid) classes.push('dragging');

    const tags = [];
    if (slotIndex === 0) {
      tags.push({ key: 'leader', label: '대표사', className: 'leader' });
    } else {
      tags.push({ key: 'member', label: '구성사', className: 'member' });
    }
    if (matchesDutyRegion || type === 'region') {
      if (!tags.some((tag) => tag.key === 'region')) {
        tags.push({ key: 'region', label: '지역사', className: 'region' });
      }
    }

    return (
      <div
        key={uid}
        className={classes.join(' ')}
        draggable
        onDragStart={handleDragStart(uid)}
        onDragEnd={handleDragEnd}
        onDragEnter={handleDragOver(groupIndex, slotIndex)}
        onDragOver={handleDragOver(groupIndex, slotIndex)}
        onDragLeave={handleDragLeave(groupIndex, slotIndex)}
        onDrop={handleDropFromEvent(groupIndex, slotIndex)}
      >
        <div className="member-tags">
          {tags.map((tag) => (
            <span key={`${uid}-${tag.key}`} className={`member-tag ${tag.className}`}>{tag.label}</span>
          ))}
        </div>
        <div className="member-name" title={getCompanyName(candidate)}>{getCompanyName(candidate)}</div>
        <div className="member-meta">
          <span>{getRegionLabel(candidate)}</span>
        </div>
        <div className="member-share">
          <label>지분(%)</label>
          <input
            type="text"
            value={shareValue}
            onChange={(e) => handleShareInput(groupIndex, slotIndex, e.target.value)}
            placeholder={share !== null ? share.toFixed(1) : ''}
          />
          {displayShare && shareValue === '' && <span className="share-hint">기본 {displayShare}%</span>}
        </div>
        <div className="member-stats">
          <div className="member-stat-row">
            <span className="stat-label">시평</span>
            <span className="stat-value">{formatAmount(sipyung)}</span>
          </div>
          <div className="member-stat-row">
            <span className="stat-label">5년 실적</span>
            <span className="stat-value">{formatAmount(fiveYear)}</span>
          </div>
          <div className="member-stat-row">
            <span className="stat-label">점수</span>
            <span className="stat-value">{formatScore(rating)}</span>
          </div>
        </div>
        <div className="member-actions">
          <button type="button" className="btn-sm btn-muted" onClick={() => handleRemove(groupIndex, slotIndex)}>제거</button>
        </div>
      </div>
    );
  };

  const renderEntryList = (list, emptyMessage, extraClass = '') => (
    <div className="board-sidebar-list">
      {list.length === 0 && <div className="board-sidebar-empty">{emptyMessage}</div>}
      {list.map((entry) => {
        const classes = ['board-sidebar-item'];
        if (extraClass) classes.push(extraClass);
        if (draggingId === entry.uid) classes.push('dragging');
        if (isDutyRegionCompany(entry.candidate) || entry.type === 'region') classes.push('region');
        return (
          <div
            key={entry.uid}
            className={classes.join(' ')}
            draggable
            onDragStart={handleDragStart(entry.uid)}
            onDragEnd={handleDragEnd}
          >
            <div className="name" title={getCompanyName(entry.candidate)}>{getCompanyName(entry.candidate)}</div>
            <div className="meta">
              <span>{getRegionLabel(entry.candidate)}</span>
              <span className="score">{formatScore(entry.candidate.rating ?? entry.candidate.score)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );

  if (!open || !portalContainer) return null;

  return createPortal(
    <div className="agreement-board-root">
      <header className="agreement-board-header">
        <div className="header-text">
          <h2>{title}</h2>
          <p>대표사 {summary.representativeTotal}명 · 확정 지역사 {summary.selectedRegions}명 · 협정 {summary.groups}개</p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn-soft" onClick={onClose}>닫기</button>
        </div>
      </header>
      <div className="agreement-board-layout">
        <aside className="agreement-board-sidebar">
          <section className="sidebar-section">
            <div className="board-sidebar-title">우선 배치 대표사</div>
            <div className="board-sidebar-count">{pinnedRepresentatives.length}개 고정</div>
            {renderEntryList(pinnedRepresentatives, '고정된 대표사가 없습니다.', 'pinned')}
          </section>
          <section className="sidebar-section">
            <div className="board-sidebar-title">대표사 후보</div>
            <div className="board-sidebar-count">총 {freeRepresentatives.length}명</div>
            {renderEntryList(freeRepresentatives, '대표사 후보가 없습니다.')}
          </section>
          <section className="sidebar-section">
            <div className="board-sidebar-title">확정된 지역사</div>
            <div className="board-sidebar-count">{availableRegionEntries.length}개 준비</div>
            {renderEntryList(availableRegionEntries, '후보산출에서 지역사를 선택하면 여기에 표시됩니다.', 'region')}
          </section>
        </aside>
        <main className="agreement-board-main">
          <div className="board-header">
            <div>
              <div className="board-title">협정 조합 미리보기</div>
              <div className="board-subtitle">팀당 최대 {safeGroupSize}인 기준으로 대표사/지역사를 배치하세요.</div>
            </div>
            <div className="board-actions">
              <button type="button" className="btn-soft" onClick={handleAddGroup}>빈 행 추가</button>
              <button type="button" className="btn-soft" onClick={handleResetGroups}>초기화</button>
            </div>
          </div>
          <div className="board-groups">
            {groups.map((group, groupIndex) => (
              <section key={group.id} className="board-group-card">
                <header className="group-header">
                  <div>
                    <div className="group-title">협정 {group.id}</div>
                    <div className="group-subtitle">대표사와 지역사를 드래그해서 배치하세요.</div>
                  </div>
                  <div className="group-meta">
                    <span className="tag-muted">총점 미계산</span>
                    <button type="button" className="btn-sm btn-muted" disabled>세부 설정</button>
                  </div>
                </header>
                <div className="group-body">
                  {group.memberIds.map((uid, slotIndex) => renderMemberCard(uid ? participantMap.get(uid) : null, slotIndex, groupIndex))}
                </div>
              </section>
            ))}
          </div>
        </main>
      </div>
    </div>,
    portalContainer,
  );
}
