import React from 'react';

export default function useBoardSearch({
  groupAssignments,
  participantMap,
  getCompanyName,
  getCandidateManagerName,
  buildBoardSearchKey,
}) {
  const [boardSearchOpen, setBoardSearchOpen] = React.useState(false);
  const [boardSearchField, setBoardSearchField] = React.useState('name');
  const [boardSearchQuery, setBoardSearchQuery] = React.useState('');
  const [boardSearchActiveIndex, setBoardSearchActiveIndex] = React.useState(-1);
  const boardSearchInputRef = React.useRef(null);
  const boardSearchCardRefs = React.useRef(new Map());
  const boardSearchSignatureRef = React.useRef('');
  const boardSearchNavigationRef = React.useRef(false);

  const normalizedBoardSearchQuery = React.useMemo(
    () => String(boardSearchQuery || '').trim().toLowerCase(),
    [boardSearchQuery],
  );

  const boardSearchMatches = React.useMemo(() => {
    if (!normalizedBoardSearchQuery) return [];
    const byManager = boardSearchField === 'manager';
    const matches = [];
    groupAssignments.forEach((row, groupIndex) => {
      if (!Array.isArray(row)) return;
      row.forEach((uid, slotIndex) => {
        if (!uid) return;
        const entry = participantMap.get(uid);
        const candidate = entry?.candidate;
        if (!candidate) return;
        const companyName = String(getCompanyName(candidate) || '');
        const managerName = String(getCandidateManagerName(candidate) || '');
        const target = byManager ? managerName : companyName;
        if (!target || !target.toLowerCase().includes(normalizedBoardSearchQuery)) return;
        matches.push({
          key: buildBoardSearchKey(groupIndex, slotIndex),
          companyName,
          managerName,
        });
      });
    });
    return matches;
  }, [
    buildBoardSearchKey,
    boardSearchField,
    getCandidateManagerName,
    getCompanyName,
    groupAssignments,
    normalizedBoardSearchQuery,
    participantMap,
  ]);

  const boardSearchMatchKeySet = React.useMemo(
    () => new Set(boardSearchMatches.map((match) => match.key)),
    [boardSearchMatches],
  );

  React.useEffect(() => {
    const signature = `${boardSearchField}:${normalizedBoardSearchQuery}`;
    const signatureChanged = boardSearchSignatureRef.current !== signature;
    boardSearchSignatureRef.current = signature;

    if (!normalizedBoardSearchQuery || boardSearchMatches.length === 0) {
      setBoardSearchActiveIndex(-1);
      return;
    }
    if (signatureChanged) {
      setBoardSearchActiveIndex(0);
      return;
    }
    setBoardSearchActiveIndex((prev) => {
      if (prev < 0) return 0;
      if (prev >= boardSearchMatches.length) return boardSearchMatches.length - 1;
      return prev;
    });
  }, [boardSearchField, normalizedBoardSearchQuery, boardSearchMatches.length]);

  const moveBoardSearchMatch = React.useCallback((step) => {
    if (!boardSearchMatches.length) return;
    boardSearchNavigationRef.current = true;
    setBoardSearchActiveIndex((prev) => {
      const size = boardSearchMatches.length;
      const base = prev >= 0 ? prev : 0;
      return (base + step + size) % size;
    });
  }, [boardSearchMatches.length]);

  const boardSearchActiveMatch = (
    boardSearchActiveIndex >= 0 && boardSearchActiveIndex < boardSearchMatches.length
      ? boardSearchMatches[boardSearchActiveIndex]
      : null
  );
  const boardSearchActiveKey = boardSearchActiveMatch?.key || '';
  const boardSearchCurrentLabel = (
    boardSearchMatches.length > 0 && boardSearchActiveIndex >= 0
      ? `${boardSearchActiveIndex + 1}/${boardSearchMatches.length} · 총 ${boardSearchMatches.length}건`
      : `총 ${boardSearchMatches.length}건`
  );

  const openBoardSearchPopup = React.useCallback(() => {
    setBoardSearchOpen(true);
  }, []);

  const closeBoardSearchPopup = React.useCallback(() => {
    setBoardSearchOpen(false);
  }, []);

  React.useEffect(() => {
    if (!boardSearchOpen) return;
    const timer = window.setTimeout(() => {
      boardSearchInputRef.current?.focus();
      boardSearchInputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [boardSearchOpen]);

  React.useEffect(() => {
    if (!boardSearchOpen || !boardSearchActiveKey) return;
    const node = boardSearchCardRefs.current.get(boardSearchActiveKey);
    if (!node) return;
    node.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
    if (boardSearchNavigationRef.current && typeof node.focus === 'function') {
      try { node.focus({ preventScroll: true }); } catch { node.focus(); }
    }
    boardSearchNavigationRef.current = false;
  }, [boardSearchOpen, boardSearchActiveKey]);

  React.useEffect(() => {
    const onKeyDown = (event) => {
      const key = String(event.key || '').toLowerCase();
      const ctrlOrMeta = event.ctrlKey || event.metaKey;

      if (!boardSearchOpen) return;

      if (key === 'escape') {
        event.preventDefault();
        closeBoardSearchPopup();
        return;
      }

      if (ctrlOrMeta && key === 'g') {
        event.preventDefault();
        moveBoardSearchMatch(event.shiftKey ? -1 : 1);
        return;
      }

      if (key === 'enter' && document.activeElement === boardSearchInputRef.current) {
        event.preventDefault();
        moveBoardSearchMatch(event.shiftKey ? -1 : 1);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [boardSearchOpen, closeBoardSearchPopup, moveBoardSearchMatch]);

  const registerBoardSearchCardRef = React.useCallback((searchKey, node) => {
    if (node) boardSearchCardRefs.current.set(searchKey, node);
    else boardSearchCardRefs.current.delete(searchKey);
  }, []);

  return {
    boardSearchOpen,
    boardSearchField,
    setBoardSearchField,
    boardSearchQuery,
    setBoardSearchQuery,
    boardSearchMatches,
    boardSearchMatchKeySet,
    boardSearchActiveKey,
    boardSearchCurrentLabel,
    boardSearchInputRef,
    openBoardSearchPopup,
    closeBoardSearchPopup,
    moveBoardSearchMatch,
    registerBoardSearchCardRef,
  };
}
