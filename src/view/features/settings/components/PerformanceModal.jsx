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

  React.useEffect(() => {
    if (open) {
      if (isRatioMode) {
        const toPercent = (value) => {
          const num = Number(value);
          return Number.isFinite(num) ? Math.round(num * 1000) / 10 : 0; // 0.1 단위 유지
        };
        setItems((rows || []).map((r) => ({
          min: toPercent(r.min ?? r.minRatio ?? 0),
          score: Number(r.score) || 0,
        })));
        setError('');
        seededRef.current = false;
      }
    }
  }, [open, rows, isRatioMode]);

  React.useEffect(() => {
    if (!open) return;
    if (!isRatioMode) return;
    if (items && items.length > 0) return;
    if (seededRef.current) return;
    seededRef.current = true;
    onRestore && onRestore();
  }, [open, items, onRestore, isRatioMode]);

  const setField = (idx, key, value) => {
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [key]: value } : item)));
  };

  const addRow = () => {
    setItems((prev) => [...prev, { min: 0, score: 0 }]);
  };

  const removeRow = (idx) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const move = (idx, dir) => {
    setItems((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const validate = () => {
    for (let i = 0; i < items.length; i += 1) {
      const row = items[i];
      const min = Number(row.min);
      const score = Number(row.score);
      if (!Number.isFinite(min)) return `${i + 1}행: 최소 비율이 숫자가 아닙니다.`;
      if (min < 0 || min > 100) return `${i + 1}행: 최소 비율은 0~100 사이여야 합니다.`;
      if (!Number.isFinite(score)) return `${i + 1}행: 점수가 숫자가 아닙니다.`;
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
    const normalized = (items || [])
      .slice()
      .sort((a, b) => Number(b.min) - Number(a.min))
      .map((row) => ({ min: Number(row.min) / 100, score: Number(row.score) }));
    return onSave && onSave(normalized);
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
              {(items || []).map((row, idx) => (
                <tr key={idx}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
                        <input
                          className="filter-input"
                          type="number"
                          step="0.1"
                          value={row.min}
                          onChange={(e) => setField(idx, 'min', e.target.value)}
                          placeholder="예: 80"
                        />
                        <span style={{ fontSize: 12, color: '#475569' }}>
                          {idx === 0 && '해당 비율 이상'}
                          {idx > 0 && `해당 비율 이상 · 이전 구간 미만`}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <input
                      className="filter-input"
                      type="number"
                      step="0.1"
                      value={row.score}
                      onChange={(e) => setField(idx, 'score', e.target.value)}
                    />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button onClick={() => move(idx, -1)} disabled={idx === 0} style={{ marginRight: 6, background: '#e5e7eb', color: '#374151', border: '1px solid #d1d5db', minWidth: 36 }}>▲</button>
                    <button onClick={() => move(idx, 1)} disabled={idx === items.length - 1} style={{ background: '#e5e7eb', color: '#374151', border: '1px solid #d1d5db', minWidth: 36 }}>▼</button>
                  </td>
                  <td>
                    <button onClick={() => removeRow(idx)} style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca' }}>삭제</button>
                  </td>
                </tr>
              ))}
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
