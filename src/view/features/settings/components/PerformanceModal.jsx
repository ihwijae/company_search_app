import React from 'react';
import Modal from '../../../../components/Modal';

/**
 * PerformanceModal: 실적점수 비율 기준 편집 UI
 * props:
 * - open, onClose
 * - rows: [{ min: number, score: number }] // min: ratio(0~1)
 * - onSave(rows)
 * - onRestore(), onReload()
 */
export default function PerformanceModal({ open, onClose, onSave, onRestore, onReload, rows = [], mode = 'ratio-bands' }) {
  const [items, setItems] = React.useState([]);
  const [error, setError] = React.useState('');
  const seededRef = React.useRef(false);
  const initialFocusRef = React.useRef(null);
  const noticeRef = React.useRef(null);

  const isRatioMode = mode === 'ratio-bands';

  const clampRatio = React.useCallback((value) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return 0;
    if (num < 0) return 0;
    if (num > 1) return 1;
    return num;
  }, []);

  const toPercent = React.useCallback((value) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return 0;
    return Math.round(num * 1000) / 10;
  }, []);

  const formatPercentLabel = React.useCallback((value) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return '';
    if (Math.abs(num - Math.round(num)) < 0.01) return `${Math.round(num)}%`;
    return `${num.toFixed(1)}%`;
  }, []);

  const normalizeFromRows = React.useCallback((sourceRows) => {
    const base = (sourceRows || [])
      .map((row) => ({
        rawMin: clampRatio(typeof row.minRatio === 'number' ? row.minRatio : Number(row.min)),
        score: Number(row.score) || 0,
      }))
      .filter((entry) => Number.isFinite(entry.rawMin) && Number.isFinite(entry.score))
      .sort((a, b) => b.rawMin - a.rawMin);

    if (!base.length) return [];

    const prepared = base.map((entry) => ({
      rawMin: clampRatio(entry.rawMin),
      score: String(entry.score ?? ''),
      floorUpper: null,
      manualPercent: String(toPercent(entry.rawMin)),
    }));

    const lastIndex = prepared.length - 1;
    const prevRaw = lastIndex > 0 ? prepared[lastIndex - 1].rawMin : null;
    const fallbackPercent = prevRaw != null ? toPercent(prevRaw) : 0;
    prepared[lastIndex] = {
      rawMin: 0,
      score: prepared[lastIndex].score,
      floorUpper: fallbackPercent,
      manualPercent: String(fallbackPercent),
    };
    for (let i = 0; i < lastIndex; i += 1) {
      prepared[i].floorUpper = null;
      prepared[i].manualPercent = prepared[i].manualPercent ?? String(toPercent(prepared[i].rawMin));
    }
    return prepared;
  }, [clampRatio, toPercent]);

  const normalizeItems = React.useCallback((list) => {
    if (!Array.isArray(list) || list.length === 0) return [];
    const next = list.map((item) => ({
      rawMin: item.rawMin != null ? clampRatio(item.rawMin) : null,
      score: item.score,
      floorUpper: Number.isFinite(Number(item.floorUpper)) ? Number(item.floorUpper) : null,
      manualPercent: item.manualPercent != null ? String(item.manualPercent) : null,
    }));
    const lastIndex = next.length - 1;
    const prevRaw = lastIndex > 0 ? next[lastIndex - 1].rawMin : null;
    const fallbackPercent = Math.max(0, Math.min(100, prevRaw != null ? toPercent(prevRaw) : 0));
    for (let i = 0; i < lastIndex; i += 1) {
      next[i].floorUpper = null;
      if (next[i].manualPercent == null) {
        next[i].manualPercent = next[i].rawMin != null ? String(toPercent(next[i].rawMin)) : '';
      }
    }
    const fallbackManual = next[lastIndex].manualPercent;
    next[lastIndex] = {
      rawMin: 0,
      score: next[lastIndex].score,
      floorUpper: fallbackPercent,
      manualPercent: fallbackManual === '' ? '' : (fallbackManual != null ? String(fallbackManual) : String(fallbackPercent)),
    };
    return next;
  }, [clampRatio, toPercent]);

  React.useEffect(() => {
    if (!open) return;
    if (!isRatioMode) return;
    const normalized = normalizeFromRows(rows);
    setItems(normalized);
    setError('');
    seededRef.current = false;
  }, [open, rows, isRatioMode, normalizeFromRows]);

  React.useEffect(() => {
    if (!open) return;
    if (!isRatioMode) return;
    if (items && items.length > 0) return;
    if (seededRef.current) return;
    seededRef.current = true;
    onRestore && onRestore();
  }, [open, items, onRestore, isRatioMode]);

  const setField = (idx, key, value) => {
    setItems((prev) => {
      if (!prev || prev.length === 0) return prev;
      const next = prev.slice();
      if (key === 'score') {
        next[idx] = { ...next[idx], score: value };
        return normalizeItems(next);
      }
      if (key === 'min') {
        const isFallback = idx === prev.length - 1;
        if (isFallback) {
          if (value === '') {
            next[idx] = { ...next[idx], floorUpper: null, manualPercent: '' };
            if (next.length >= 2) {
              next[idx - 1] = { ...next[idx - 1], rawMin: null, manualPercent: '' };
            }
            return next;
          }
          const numeric = Number(value);
          if (!Number.isFinite(numeric)) {
            next[idx] = { ...next[idx], manualPercent: value };
            return next;
          }
          const percent = Math.max(0, Math.min(100, numeric));
          next[idx] = { ...next[idx], floorUpper: percent, manualPercent: String(percent) };
          if (next.length >= 2) {
            const ratio = clampRatio(percent / 100);
            next[idx - 1] = { ...next[idx - 1], rawMin: ratio, manualPercent: String(percent) };
          }
          return normalizeItems(next);
        }
        if (value === '') {
          next[idx] = { ...next[idx], rawMin: null, manualPercent: '' };
          return next;
        }
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
          next[idx] = { ...next[idx], manualPercent: value };
          return next;
        }
        const ratio = clampRatio(numeric / 100);
        next[idx] = { ...next[idx], rawMin: ratio, manualPercent: String(Math.max(0, Math.min(100, numeric))) };
        return normalizeItems(next);
      }
      return prev;
    });
  };

  const addRow = () => {
    setItems((prev) => {
      if (!prev || prev.length === 0) {
        return [{ rawMin: 0, score: '0', floorUpper: 0, manualPercent: '0' }];
      }
      const fallback = prev[prev.length - 1];
      const head = prev.slice(0, -1);
      const lastHead = head[head.length - 1];
      const suggested = lastHead ? Math.max(0, lastHead.rawMin - 0.05) : 0.1;
      const newRatio = clampRatio(suggested);
      const next = [...head, { rawMin: newRatio, score: '0', floorUpper: null, manualPercent: String(toPercent(newRatio)) }, fallback];
      return normalizeItems(next);
    });
  };

  const removeRow = (idx) => {
    setItems((prev) => {
      if (!prev || prev.length <= 1) return prev;
      const next = prev.filter((_, i) => i !== idx);
      return normalizeItems(next);
    });
  };

  const move = (idx, dir) => {
    setItems((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return normalizeItems(next);
    });
  };

  const validate = () => {
    for (let i = 0; i < items.length; i += 1) {
      const row = items[i];
      if (row.score === '' || !Number.isFinite(Number(row.score))) {
        return `${i + 1}행: 점수가 숫자가 아닙니다.`;
      }
      const isFallback = i === items.length - 1;
      if (isFallback) {
        const floorValue = row.manualPercent != null ? row.manualPercent : row.floorUpper;
        const floor = Number(floorValue);
        if (floorValue === '' || !Number.isFinite(floor)) return `${i + 1}행: 기준 비율이 숫자가 아닙니다.`;
        if (floor < 0 || floor > 100) return `${i + 1}행: 기준 비율은 0~100 사이여야 합니다.`;
      } else {
        const percentValue = row.manualPercent != null ? row.manualPercent : (row.rawMin != null ? toPercent(row.rawMin) : null);
        const rawMin = percentValue == null || percentValue === '' ? NaN : Number(percentValue) / 100;
        if (!Number.isFinite(rawMin)) return `${i + 1}행: 최소 비율이 숫자가 아닙니다.`;
        if (rawMin < 0 || rawMin > 1) return `${i + 1}행: 최소 비율은 0~100 사이여야 합니다.`;
      }
    }
    return '';
  };

  const handleSave = () => {
    if (!isRatioMode) {
      onClose?.();
      return undefined;
    }
    const msg = validate();
    if (msg) { setError(msg); return; }
    const normalized = normalizeItems(items);
    setItems(normalized);
    const prepared = normalized
      .slice()
      .sort((a, b) => {
        const aRatio = a.rawMin != null ? a.rawMin : clampRatio(Number(a.manualPercent) / 100);
        const bRatio = b.rawMin != null ? b.rawMin : clampRatio(Number(b.manualPercent) / 100);
        return bRatio - aRatio;
      })
      .map((row, idx, arr) => {
        if (idx === arr.length - 1) {
          return {
            min: 0,
            score: Number(row.score),
          };
        }
        const percentValue = row.manualPercent != null ? Number(row.manualPercent) : toPercent(row.rawMin);
        const ratio = clampRatio(percentValue / 100);
        return {
          min: ratio,
          score: Number(row.score),
        };
      });
    return onSave && onSave(prepared);
  };

  React.useEffect(() => {
    if (!open || isRatioMode) return;
    if (noticeRef.current) {
      try { noticeRef.current.focus(); } catch (err) { /* ignore */ }
    }
  }, [open, isRatioMode]);

  if (!isRatioMode) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        onCancel={onClose}
        onSave={onClose}
        title="실적점수 기준"
        size="md"
      >
        <p
          ref={noticeRef}
          tabIndex={-1}
          style={{ marginTop: 0, outline: 'none' }}
        >
          이 발주처는 등급제 실적점수 대신 별도의 계산식을 사용합니다. 현재 버전에서는 UI로 수정할 수 없으며, 향후 전용 설정 화면이 추가될 예정입니다.
        </p>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      onCancel={onClose}
      onSave={handleSave}
      title="실적점수 기준 수정"
      size="lg"
      initialFocusRef={initialFocusRef}
    >
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
          <div>
            <button onClick={onReload} style={{ background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', marginRight: 8 }}>다시 불러오기</button>
            <button onClick={onRestore} style={{ background: '#fff7ed', color: '#9a3412', border: '1px solid #fed7aa' }}>이 섹션 기본값으로 복원</button>
          </div>
        </div>
        <p ref={initialFocusRef} tabIndex={-1} style={{ marginTop: 0 }}>
          협정 구성사의 5년 실적 합계를 추정가격으로 나눈 비율을 기준으로 점수를 산정합니다. 행 순서대로 평가하며, 가장 먼저 조건을 만족하는 점수가 적용됩니다.
        </p>
        {error && <div className="error-message" style={{ marginBottom: 12 }}>{error}</div>}
        <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
          <table className="details-table" style={{ width: '100%', tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th style={{ width: 200 }}>최소 비율(%)</th>
                <th style={{ width: 160 }}>점수</th>
                <th style={{ width: 160, textAlign: 'center' }}>순서</th>
                <th style={{ width: 120 }}></th>
              </tr>
            </thead>
            <tbody>
              {(items || []).map((row, idx) => {
                const isFallback = idx === items.length - 1;
                const prevRow = idx > 0 ? items[idx - 1] : null;
                const prevPercent = prevRow ? (prevRow.manualPercent != null ? prevRow.manualPercent : (prevRow.rawMin != null ? String(toPercent(prevRow.rawMin)) : '')) : null;
                const manualPercent = row.manualPercent;
                let displayPercent;
                if (manualPercent != null) {
                  displayPercent = manualPercent === '' ? '' : Number(manualPercent);
                } else if (isFallback) {
                  if (Number.isFinite(Number(row.floorUpper))) {
                    displayPercent = Number(row.floorUpper);
                  } else if (prevPercent != null && prevPercent !== '') {
                    displayPercent = Number(prevPercent);
                  } else {
                    displayPercent = '';
                  }
                } else if (row.rawMin != null) {
                  displayPercent = Number(toPercent(row.rawMin));
                } else {
                  displayPercent = '';
                }
                const inputValue = displayPercent === '' ? '' : displayPercent;
                const scoreValue = row.score;
                return (
                  <tr key={idx}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
                          <input
                            className="filter-input"
                            type="number"
                            step="0.1"
                            value={inputValue}
                            onChange={(e) => setField(idx, 'min', e.target.value)}
                            placeholder="예: 80"
                          />
                          <span style={{ fontSize: 12, color: '#475569' }}>
                            {(() => {
                              const prevNumeric = prevPercent != null && prevPercent !== '' ? Number(prevPercent) : null;
                              const currentNumeric = inputValue === '' ? null : Number(inputValue);
                              if (idx === 0) {
                                return currentNumeric != null
                                  ? `${formatPercentLabel(currentNumeric)} 이상`
                                  : '해당 비율 이상';
                              }
                              if (isFallback) {
                                return prevNumeric != null
                                  ? `${formatPercentLabel(prevNumeric)} 미만`
                                  : '이전 구간 미만';
                              }
                              if (currentNumeric != null && prevNumeric != null) {
                                return `${formatPercentLabel(currentNumeric)} 이상 · ${formatPercentLabel(prevNumeric)} 미만`;
                              }
                              if (currentNumeric != null) {
                                return `${formatPercentLabel(currentNumeric)} 이상`;
                              }
                              return '해당 비율 이상';
                            })()}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <input
                        className="filter-input"
                        type="number"
                        step="0.1"
                        value={scoreValue}
                        onChange={(e) => setField(idx, 'score', e.target.value)}
                      />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button onClick={() => move(idx, -1)} disabled={idx === 0 || idx === items.length - 1} style={{ marginRight: 6, background: '#e5e7eb', color: '#374151', border: '1px solid #d1d5db', minWidth: 36 }}>▲</button>
                      <button onClick={() => move(idx, 1)} disabled={idx === items.length - 1} style={{ background: '#e5e7eb', color: '#374151', border: '1px solid #d1d5db', minWidth: 36 }}>▼</button>
                    </td>
                    <td>
                      <button onClick={() => removeRow(idx)} style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca' }}>삭제</button>
                    </td>
                  </tr>
                );
              })}
              {(!items || items.length === 0) && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: '#6b7280' }}>행이 없습니다. 아래 버튼으로 추가하세요.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 10 }}>
          <button onClick={addRow} style={{ background: '#ecfdf5', color: '#166534', border: '1px solid #a7f3d0' }}>행 추가</button>
        </div>
      </div>
    </Modal>
  );
}
