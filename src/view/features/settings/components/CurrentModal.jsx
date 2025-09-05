import React from 'react';
import Modal from '../../../../components/Modal';

/**
 * CurrentModal: 유동비율 임계값 편집 UI
 * props:
 * - open, onClose
 * - rows: [{ op: 'gte'|'lt', value: number, score: number }]
 * - onSave: (rows) => void | Promise<void>
 */
export default function CurrentModal({ open, onClose, onSave, onRestore, onReload, rows = [] }) {
  const focusRef = React.useRef(null);
  const [items, setItems] = React.useState(rows || []);
  const [error, setError] = React.useState('');
  const seededRef = React.useRef(false);

  React.useEffect(() => {
    if (open) {
      const toPercent = (v) => {
        const n = Number(v);
        return Number.isFinite(n) ? n * 100 : 0;
      };
      setItems((rows || []).map(r => ({ ...r, value: toPercent(r.value) })));
      setError('');
      seededRef.current = false;
    }
  }, [open, rows]);

  // Auto seed defaults when section is empty
  React.useEffect(() => {
    if (!open) return;
    if (items && items.length > 0) return;
    if (seededRef.current) return;
    seededRef.current = true;
    onRestore && onRestore();
  }, [open, items, onRestore]);

  const setField = (idx, key, value) => {
    setItems(prev => prev.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));
  };

  const addRow = () => {
    // 값은 % 단위로 편집(예: 120은 120%)
    setItems(prev => [...prev, { op: 'gte', value: 100, score: 0 }]);
  };

  const removeRow = (idx) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const move = (idx, dir) => {
    setItems(prev => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      const t = next[idx];
      next[idx] = next[j];
      next[j] = t;
      return next;
    });
  };

  const validate = () => {
    for (let i = 0; i < items.length; i++) {
      const r = items[i];
      if (!(r.op === 'lt' || r.op === 'gte')) return `행 ${i + 1}: 조건은 lt/gte만 허용됩니다.`;
      const v = Number(r.value);
      const s = Number(r.score);
      if (!Number.isFinite(v)) return `행 ${i + 1}: 값이 숫자가 아닙니다.`;
      if (!Number.isFinite(s)) return `행 ${i + 1}: 점수가 숫자가 아닙니다.`;
    }
    return '';
  };

  const handleSave = () => {
    const msg = validate();
    if (msg) { setError(msg); return; }
    const normalized = items.map(r => ({ op: r.op, value: Number(r.value) / 100, score: Number(r.score) }));
    return onSave && onSave(normalized);
  };

  return (
    <Modal
      open={open}
      title="유동비율 기준 수정"
      onClose={onClose}
      onCancel={onClose}
      onSave={handleSave}
      initialFocusRef={focusRef}
      size="lg"
    >
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
          <div>
            <button onClick={onReload} style={{ background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', marginRight: 8 }}>다시 불러오기</button>
            <button onClick={onRestore} style={{ background: '#fff7ed', color: '#9a3412', border: '1px solid #fed7aa' }}>이 섹션 기본값으로 복원</button>
          </div>
        </div>
        <p ref={focusRef} tabIndex={-1} style={{ marginTop: 0 }}>
          유동비율 임계값 테이블을 편집합니다. 행 순서가 위에서 아래로 평가됩니다.
        </p>
        {error && (
          <div className="error-message" style={{ marginBottom: 12 }}>{error}</div>
        )}
        <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
          <table className="details-table" style={{ width: '100%', tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th style={{ width: 120 }}>조건</th>
                <th style={{ width: 160 }}>값(%)</th>
                <th style={{ width: 160 }}>점수</th>
                <th style={{ width: 160, textAlign: 'center' }}>순서</th>
                <th style={{ width: 120 }}></th>
              </tr>
            </thead>
            <tbody>
              {(items || []).map((r, i) => (
                <tr key={i}>
                  <td>
                    <select className="filter-input" value={r.op} onChange={(e)=>setField(i, 'op', e.target.value)}>
                      <option value="gte">이상(gte)</option>
                      <option value="lt">미만(lt)</option>
                    </select>
                  </td>
                  <td>
                    <input className="filter-input" type="number" step="1" value={r.value}
                      onChange={(e)=>setField(i, 'value', e.target.value)} placeholder="예: 120 → 120%" />
                  </td>
                  <td>
                    <input className="filter-input" type="number" step="0.1" value={r.score}
                      onChange={(e)=>setField(i, 'score', e.target.value)} />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button onClick={()=>move(i, -1)} disabled={i===0} style={{ marginRight: 6, background: '#e5e7eb', color: '#374151', border: '1px solid #d1d5db', minWidth: 36 }}>▲</button>
                    <button onClick={()=>move(i, 1)} disabled={i===items.length-1} style={{ background: '#e5e7eb', color: '#374151', border: '1px solid #d1d5db', minWidth: 36 }}>▼</button>
                  </td>
                  <td>
                    <button onClick={()=>removeRow(i)} style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca' }}>삭제</button>
                  </td>
                </tr>
              ))}
              {(!items || items.length===0) && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: '#6b7280' }}>행이 없습니다. 아래 버튼으로 추가하세요.</td>
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
