import React from 'react';
import Modal from '../../../../components/Modal';

/**
 * CreditModal: 신용평가 등급 테이블 편집 UI
 * props:
 * - open, onClose
 * - rows: [{ grade: string, base: number, score: number }]
 * - onSave: (rows) => void | Promise<void>
 */
export default function CreditModal({ open, onClose, onSave, onRestore, onReload, rows = [] }) {
  const focusRef = React.useRef(null);
  const [items, setItems] = React.useState(rows || []);
  const [error, setError] = React.useState('');
  const seededRef = React.useRef(false);

  React.useEffect(() => {
    if (open) {
      setItems(rows || []);
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
    setItems(prev => [...prev, { grade: '', base: 35, score: 15 }]);
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
      if (!String(r.grade || '').trim()) return `행 ${i + 1}: 등급을 입력하세요.`;
      const b = Number(r.base);
      const s = Number(r.score);
      if (!Number.isFinite(b)) return `행 ${i + 1}: 기준점수(base)가 숫자가 아닙니다.`;
      if (!Number.isFinite(s)) return `행 ${i + 1}: 환산점수(score)가 숫자가 아닙니다.`;
    }
    return '';
  };

  const handleSave = () => {
    const msg = validate();
    if (msg) { setError(msg); return; }
    const normalized = items.map(r => ({ grade: String(r.grade || '').trim(), base: Number(r.base), score: Number(r.score) }));
    return onSave && onSave(normalized);
  };

  return (
    <Modal
      open={open}
      title="신용평가 기준 수정"
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
          신용등급별 기준점수/환산점수를 편집합니다. 등급 문자열은 대소문자 구분 없이 비교됩니다.
        </p>
        {error && (
          <div className="error-message" style={{ marginBottom: 12 }}>{error}</div>
        )}
        <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
          <table className="details-table" style={{ width: '100%', tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th style={{ width: 180 }}>등급</th>
                <th style={{ width: 160 }}>기준점수(base)</th>
                <th style={{ width: 160 }}>환산점수(score)</th>
                <th style={{ width: 160, textAlign: 'center' }}>순서</th>
                <th style={{ width: 120 }}></th>
              </tr>
            </thead>
            <tbody>
              {(items || []).map((r, i) => (
                <tr key={i}>
                  <td>
                    <input className="filter-input" type="text" value={r.grade}
                      onChange={(e)=>setField(i, 'grade', e.target.value)} />
                  </td>
                  <td>
                    <input className="filter-input" type="number" step="0.1" value={r.base}
                      onChange={(e)=>setField(i, 'base', e.target.value)} />
                  </td>
                  <td>
                    <input className="filter-input" type="number" step="0.001" value={r.score}
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
