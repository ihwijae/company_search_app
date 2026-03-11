import React from 'react';

export default function useBoardInlineEditing({ onCommitEdit }) {
  const [editingCell, setEditingCell] = React.useState(null);

  const isInlineEditing = React.useCallback((meta, kind) => (
    Boolean(
      meta
      && editingCell
      && editingCell.groupIndex === meta.groupIndex
      && editingCell.slotIndex === meta.slotIndex
      && editingCell.kind === kind
    )
  ), [editingCell]);

  const startInlineEdit = React.useCallback((meta, kind) => {
    if (!meta || meta.empty) return;
    setEditingCell({ groupIndex: meta.groupIndex, slotIndex: meta.slotIndex, kind });
  }, []);

  const finishInlineEdit = React.useCallback((meta, kind, { commit = true } = {}) => {
    if (!meta || meta.empty) return;
    if (commit && typeof onCommitEdit === 'function') onCommitEdit({ meta, kind });
    setEditingCell((prev) => {
      if (!prev) return prev;
      if (prev.groupIndex !== meta.groupIndex || prev.slotIndex !== meta.slotIndex || prev.kind !== kind) return prev;
      return null;
    });
  }, [onCommitEdit]);

  const handleInlineEditKeyDown = React.useCallback((event, meta, kind, options = {}) => {
    const {
      enterCommits = true,
      escapeCommits = true,
    } = options;
    if (event.key === 'Enter') {
      event.preventDefault();
      finishInlineEdit(meta, kind, { commit: enterCommits });
    } else if (event.key === 'Escape') {
      event.preventDefault();
      finishInlineEdit(meta, kind, { commit: escapeCommits });
    }
  }, [finishInlineEdit]);

  const getInlineEditTriggerProps = React.useCallback((meta, kind, options = {}) => {
    const {
      disabled = false,
      title = '클릭하여 수정',
    } = options;
    return {
      onClick: () => {
        if (disabled) return;
        startInlineEdit(meta, kind);
      },
      onFocus: () => {
        if (disabled) return;
        startInlineEdit(meta, kind);
      },
      title: disabled ? undefined : title,
    };
  }, [startInlineEdit]);

  return {
    isInlineEditing,
    startInlineEdit,
    finishInlineEdit,
    handleInlineEditKeyDown,
    getInlineEditTriggerProps,
  };
}
