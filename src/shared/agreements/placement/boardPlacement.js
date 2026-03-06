function cloneMatrix(matrix = []) {
  return matrix.map((row) => (Array.isArray(row) ? row.slice() : []));
}

function ensureRowLength(matrix, groupIndex, safeGroupSize, fillValue = null) {
  while (matrix.length <= groupIndex) {
    matrix.push(Array(safeGroupSize).fill(fillValue));
  }
  while (matrix[groupIndex].length < safeGroupSize) {
    matrix[groupIndex].push(fillValue);
  }
}

export function createPendingMoveSource(meta) {
  if (!meta || meta.empty || !meta.uid) return null;
  return {
    uid: meta.uid,
    groupIndex: meta.groupIndex,
    slotIndex: meta.slotIndex,
    companyName: meta.companyName || '업체',
  };
}

export function shouldResetPendingMove(pendingMoveSource, meta) {
  if (!pendingMoveSource?.uid) return true;
  const targetUid = meta?.empty ? null : (meta?.uid || null);
  return (
    pendingMoveSource.uid === targetUid
    || (
      pendingMoveSource.groupIndex === meta?.groupIndex
      && pendingMoveSource.slotIndex === meta?.slotIndex
    )
  );
}

export function buildBoardMoveConfirmPayload(pendingMoveSource, meta) {
  const sourceName = pendingMoveSource?.companyName || '업체';
  const targetName = meta?.companyName || '업체';
  const targetLabel = `${(meta?.groupIndex ?? 0) + 1}번 협정 ${meta?.label || ''}`.trim();
  const swapping = Boolean(!meta?.empty && meta?.uid);

  return {
    swapping,
    title: swapping ? '업체 위치를 변경하시겠습니까?' : '업체를 이동하시겠습니까?',
    message: swapping
      ? `${sourceName} 업체와 ${targetName} 업체의 위치를 변경하시겠습니까?`
      : `${sourceName} 업체를 ${targetLabel} 위치로 이동하시겠습니까?`,
  };
}

export function buildCandidatePlacementNotice(meta, sourceName, targetName) {
  return meta?.empty
    ? `${(meta?.groupIndex ?? 0) + 1}번 협정 ${meta?.label || ''} 위치로 배치했습니다.`
    : `${targetName || '업체'} 업체를 ${sourceName || '업체'} 업체로 교체했습니다.`;
}

export function placeEntryInAssignments(prevAssignments, uid, groupIndex, slotIndex, safeGroupSize) {
  const next = cloneMatrix(prevAssignments);
  next.forEach((group) => {
    for (let i = 0; i < group.length; i += 1) {
      if (group[i] === uid) group[i] = null;
    }
  });
  ensureRowLength(next, groupIndex, safeGroupSize, null);
  next[groupIndex][slotIndex] = uid;
  return next;
}

export function resetSlotInMatrix(prevMatrix, groupIndex, slotIndex, fillValue = '') {
  const next = cloneMatrix(prevMatrix);
  ensureRowLength(next, groupIndex, slotIndex + 1, fillValue);
  next[groupIndex][slotIndex] = fillValue;
  return next;
}

export function placeEntryOnBoard(prevAssignments, uid, safeGroupSize) {
  const next = prevAssignments.map((group) => (
    Array.isArray(group) ? group.slice() : Array(safeGroupSize).fill(null)
  ));
  let targetGroupIndex = -1;
  let targetSlotIndex = -1;

  next.forEach((group, groupIndex) => {
    group.forEach((value, slotIndex) => {
      if (value === uid) {
        group[slotIndex] = null;
      }
      if (targetGroupIndex >= 0) return;
      if (!value) {
        targetGroupIndex = groupIndex;
        targetSlotIndex = slotIndex;
      }
    });
  });

  if (targetGroupIndex < 0 || targetSlotIndex < 0) {
    next.push(Array(safeGroupSize).fill(null));
    targetGroupIndex = next.length - 1;
    targetSlotIndex = 0;
  }

  next[targetGroupIndex][targetSlotIndex] = uid;
  return { assignments: next, placed: true };
}

export function swapOrMoveBoardEntries(prevAssignments, {
  sourceUid,
  targetUid = null,
  targetGroupIndex,
  targetSlotIndex,
  safeGroupSize,
}) {
  const next = cloneMatrix(prevAssignments);
  let sourceGroupIndex = -1;
  let sourceSlotIndex = -1;
  let resolvedTargetGroupIndex = targetGroupIndex;
  let resolvedTargetSlotIndex = targetSlotIndex;

  next.forEach((group, gIdx) => {
    group.forEach((uid, sIdx) => {
      if (uid === sourceUid) {
        sourceGroupIndex = gIdx;
        sourceSlotIndex = sIdx;
      }
      if (targetUid && uid === targetUid) {
        resolvedTargetGroupIndex = gIdx;
        resolvedTargetSlotIndex = sIdx;
      }
    });
  });

  if (sourceGroupIndex < 0 || sourceSlotIndex < 0) return next;
  if (resolvedTargetGroupIndex == null || resolvedTargetGroupIndex < 0 || resolvedTargetSlotIndex == null || resolvedTargetSlotIndex < 0) {
    return next;
  }

  ensureRowLength(next, resolvedTargetGroupIndex, safeGroupSize, null);
  next[sourceGroupIndex][sourceSlotIndex] = targetUid || null;
  next[resolvedTargetGroupIndex][resolvedTargetSlotIndex] = sourceUid;
  return next;
}

export function applyDropToAssignments(prevAssignments, {
  groupIndex,
  slotIndex,
  id,
  dragSource,
  safeGroupSize,
}) {
  const next = cloneMatrix(prevAssignments);
  ensureRowLength(next, groupIndex, safeGroupSize, null);
  const targetId = next[groupIndex][slotIndex] || null;
  const isSource = dragSource && dragSource.id === id;

  if (isSource && dragSource.groupIndex === groupIndex && dragSource.slotIndex === slotIndex) {
    return next;
  }

  if (isSource) {
    if (next[dragSource.groupIndex]) {
      next[dragSource.groupIndex][dragSource.slotIndex] = targetId;
    }
    next[groupIndex][slotIndex] = id;
    return next;
  }

  next.forEach((group, gIdx) => {
    for (let i = 0; i < group.length; i += 1) {
      if (group[i] === id) {
        next[gIdx][i] = null;
      }
    }
  });
  next[groupIndex][slotIndex] = id;
  return next;
}
