import React from 'react';
import Modal from '../../../../components/Modal';

const OP_OPTIONS = [
  { value: 'gteYears', label: '이상 (년)' },
  { value: 'ltYears', label: '미만 (년)' },
];

export default function BizYearsModal({ open, onClose, onSave, onRestore, onReload, rows = [], fallbackRows = [] }) {
  const focusRef = React.useRef(null);
  const [items, setItems] = React.useState(rows || []);
  const [error, setError] = React.useState('');
  const seededRef = React.useRef(false);

  React.useEffect(() => {
    if (!open) return;
    const source = (rows && rows.length > 0)
      ? rows
      : (fallbackRows && fallbackRows.length > 0 ? fallbackRows : []);
    setItems((source || []).map((row) => ({ ...row })));
    setError('');
    seededRef.current = source && source.length > 0;
  }, [open, rows, fallbackRows]);

  React.useEffect(() => {
    if (!open) return;
    if ((items || []).length > 0) return;
    if (seededRef.current) return;
    if (fallbackRows && fallbackRows.length > 0) return;
    seededRef.current = true;
    onRestore && onRestore();
  }, [open, items, fallbackRows, onRestore]);

  const setField = (idx, key, value) => {
    setItems((prev) => prev.map((row, i) => (i === idx ? { ...row, [key]: value } : row)));
  };

  const addRow = () => {
    setItems((prev) => [...prev, { op: 'gteYears', value: 3, score: 1.0 }]);
  };

  const removeRow = (idx) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const moveRow = (idx, dir) => {
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
      if (!['gteYears', 'ltYears'].includes(row.op)) return `제 ${i + 1}행: 조건은 '이상' 또는 '미만'만 선택할 수 있습니다.`;
      const year = Number(row.value);
      const score = Number(row.score);
      if (!Number.isFinite(year)) return `제 ${i + 1}행: 영업기간은 숫자로 입력해주세요.`;
      if (!Number.isFinite(score)) return `제 ${i + 1}행: 점수는 숫자로 입력해주세요.`;
    }
    return '';
  };

  const handleSave = () => {
    const msg = validate();
    if (msg) {
      setError(msg);
      return;
    }
    const normalized = items.map((row) => ({
      op: row.op,
      value: Number(row.value),
      score: Number(row.score),
    }));
    return onSave && onSave(normalized);
  };

  return (
    <Modal
      open={open}
      title="영업기간 기준 수정"
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
            <button onClick={onRestore} style={{ background: '#fff7ed', color: '#9a3412', border: '1px solid #fed7aa' }}>기본값으로 복원</button>
          </div>
        </div>
        <p ref={focusRef} tabIndex={-1} style={{ marginTop: 0 }}>
          영업기간 기준 점수를 입력하세요. 행안부 30억 이상 구간에서 적용됩니다.
        </p>
        {error && <div className="error-message" style={{ marginBottom: 12 }}>{error}</div>}
        <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
          <table className="details-table" style={{ width: '100%', tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th style={{ width: 140 }}>조건</th>
                <th style={{ width: 160 }}>영업기간(년)</th>
                <th style={{ width: 160 }}>점수</th>
                <th style={{ width: 160, textAlign: 'center' }}>정렬</th>
                <th style={{ width: 120 }}></th>
              </tr>
            </thead>
            <tbody>
              {(items || []).map((row, idx) => (
                <tr key={idx}>
                  <td>
                    <select className="filter-input" value={row.op} onChange={(e) => setField(idx, 'op', e.target.value)}>
                      {OP_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      className="filter-input"
                      type="number"
                      min="0"
                      step="0.1"
                      value={row.value}
                      onChange={(e) => setField(idx, 'value', e.target.value)}
                    />
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
                    <button className="btn-sm btn-muted" onClick={() => moveRow(idx, -1)} style={{ marginRight: 4 }}>위로</button>
                    <button className="btn-sm btn-muted" onClick={() => moveRow(idx, 1)}>아래로</button>
                  </td>
                  <td>
                    <button className="btn-sm btn-danger" onClick={() => removeRow(idx)}>삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button className="btn-soft" onClick={addRow}>행 추가</button>
        </div>
      </div>
    </Modal>
  );
}
