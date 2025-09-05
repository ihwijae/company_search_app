import React, { useEffect, useMemo, useRef, useState } from 'react';
import Modal from '../../../../components/Modal';
import AmountInput from '../../../../components/AmountInput.jsx';

export default function CandidatesModal({ open, onClose, fileType, entryAmount, baseAmount, dutyRegions = [], ratioBaseAmount = '', defaultExcludeSingle = true, onApply }) {
  const [params, setParams] = useState({ entryAmount: '', baseAmount: '', dutyRegions: [], ratioBase: '', minPct: '', maxPct: '', excludeSingleBidEligible: true, filterByRegion: true });
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState([]);
  const [pinned, setPinned] = useState(new Set());
  const [excluded, setExcluded] = useState(new Set());
  const [error, setError] = useState('');
  const [sortDir, setSortDir] = useState('desc'); // 'desc' | 'asc'
  const [sortSeq, setSortSeq] = useState(0);      // force re-sort even if same dir clicked
  const applySort = (dir) => { setSortDir(dir); setSortSeq((n)=>n+1); };
  const [autoPin, setAutoPin] = useState(false);
  const [autoCount, setAutoCount] = useState(3);

  const initKey = JSON.stringify({ entryAmount, baseAmount, dutyRegions, ratioBaseAmount, defaultExcludeSingle, fileType });
  const didInitFetch = useRef(false);
  useEffect(() => {
    if (!open) return;
    setParams({ entryAmount: entryAmount || '', baseAmount: baseAmount || '', dutyRegions: dutyRegions || [], ratioBase: ratioBaseAmount || '', minPct: '', maxPct: '', excludeSingleBidEligible: defaultExcludeSingle, filterByRegion: true });
    setList([]); setPinned(new Set()); setExcluded(new Set()); setError('');
    didInitFetch.current = false; // allow auto fetch again for new inputs
  }, [open, initKey]);

  // Auto fetch on open with incoming values (once per open/inputs)
  useEffect(() => {
    if (!open) return;
    if (didInitFetch.current) return;
    // Require at least one of base/entry present or some dutyRegions to prevent empty accidental fetch
    const hasAmounts = String(entryAmount || '').trim() || String(baseAmount || '').trim();
    const hasRegions = Array.isArray(dutyRegions) && dutyRegions.length > 0;
    if (hasAmounts || hasRegions) {
      didInitFetch.current = true;
      runFetch();
    }
  }, [open, initKey]);

  const runFetch = async () => {
    setLoading(true); setError(''); setList([]);
    try {
      const r = await window.electronAPI.fetchCandidates({ ownerId: 'LH', fileType, entryAmount: params.entryAmount, baseAmount: params.baseAmount, dutyRegions: params.dutyRegions, excludeSingleBidEligible: params.excludeSingleBidEligible, filterByRegion: !!params.filterByRegion });
      if (!r?.success) throw new Error(r?.message || '후보 요청 실패');
      setList(r.data || []);
    } catch (e) { setError(String(e.message || e)); }
    finally { setLoading(false); }
  };

  const toggle = (set, id) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  };

  const onTogglePin = (id) => setPinned(prev => toggle(prev, id));
  const onToggleExclude = (id) => setExcluded(prev => toggle(prev, id));

  const parseAmount = (s) => Number(String(s || '').replace(/[^0-9]/g, '')) || 0;
  const ratioBase = useMemo(() => parseAmount(params.ratioBase), [params.ratioBase]);

  const computed = useMemo(() => {
    return (list || []).map((c) => {
      let pctRaw = null; let pct = null;
      if (ratioBase > 0) {
        const r = Number(c.rating || 0);
        if (Number.isFinite(r) && r > 0) {
          pctRaw = (r / ratioBase) * 100;        // 정렬은 원시 비율값으로만
          pct = Math.floor(pctRaw * 100) / 100;  // 표시값은 둘째자리 내림
        }
      }
      return { ...c, _pct: pct, _pctRaw: pctRaw };
    });
  }, [list, ratioBase]);

  const filtered = useMemo(() => {
    const toFloat = (s) => {
      const t = String(s ?? '').trim();
      if (!t) return null;
      const n = Number(t);
      return Number.isFinite(n) ? n : null;
    };
    const min = toFloat(params.minPct);
    const max = toFloat(params.maxPct);
    return computed.filter((c) => {
      if (excluded.has(c.id)) return false;
      if (min !== null && (c._pct === null || c._pct < min)) return false;
      if (max !== null && (c._pct === null || c._pct > max)) return false;
      return true;
    });
  }, [computed, params.minPct, params.maxPct, excluded]);

  const sorted = useMemo(() => {
    const arr = filtered.slice();
    arr.sort((a, b) => {
      const av = a._pctRaw; const bv = b._pctRaw;
      // null(계산 불가)은 항상 맨 아래
      const aNull = av == null; const bNull = bv == null;
      if (aNull && bNull) return String(a.name||'').localeCompare(String(b.name||''), 'ko-KR');
      if (aNull) return 1;
      if (bNull) return -1;
      const diff = sortDir === 'asc' ? (av - bv) : (bv - av);
      if (diff !== 0) return diff;
      // 동률이면 이름으로 안정 정렬
      return String(a.name||'').localeCompare(String(b.name||''), 'ko-KR');
    });
    return arr;
  }, [filtered, sortDir, sortSeq]);

  const autoPinned = useMemo(() => {
    if (!autoPin) return new Set();
    const ids = [];
    for (const c of sorted) {
      if (ids.length >= Math.max(0, Number(autoCount) || 0)) break;
      ids.push(c.id);
    }
    return new Set(ids);
  }, [autoPin, autoCount, sorted]);

  const pinnedView = useMemo(() => {
    const s = new Set(pinned);
    autoPinned.forEach((id) => s.add(id));
    return s;
  }, [pinned, autoPinned]);

  const summary = useMemo(() => ({ total: list.length, pinned: pinnedView.size, excluded: excluded.size }), [list, pinnedView, excluded]);

  return (
    <Modal open={open} onClose={onClose} onCancel={onClose} title="후보 산출" size="lg" maxWidth={1280} closeOnSave={false}
           onSave={() => { if (onApply) onApply({ candidates: list, pinned: Array.from(pinned), excluded: Array.from(excluded) }); }}>
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 12 }}>
        <div className="panel" style={{ padding: 10 }}>
          <div className="filter-item">
            <label>입찰참가자격금액</label>
            <AmountInput value={params.entryAmount} onChange={(v)=>setParams(p=>({ ...p, entryAmount: v }))} placeholder="숫자" />
          </div>
          <div className="filter-item">
            <label>기초금액</label>
            <AmountInput value={params.baseAmount} onChange={(v)=>setParams(p=>({ ...p, baseAmount: v }))} placeholder="숫자" />
          </div>
          <div className="filter-item">
            <label>시공비율 기준금액</label>
            <AmountInput value={params.ratioBase} onChange={(v)=>setParams(p=>({ ...p, ratioBase: v }))} placeholder="숫자" />
          </div>
          <div className="filter-item">
            <label>가능지분 필터(%)</label>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 8 }}>
              <input className="filter-input" placeholder="최소" value={params.minPct} onChange={(e)=>setParams(p=>({ ...p, minPct: e.target.value.replace(/[^0-9.]/g,'') }))} />
              <input className="filter-input" placeholder="최대" value={params.maxPct} onChange={(e)=>setParams(p=>({ ...p, maxPct: e.target.value.replace(/[^0-9.]/g,'') }))} />
            </div>
          </div>
          <div className="filter-item">
            <label>의무지역({(params.dutyRegions||[]).length})</label>
            <div className="chips" style={{ marginTop: 6 }}>
              {(params.dutyRegions || []).map((r) => (<span key={r} className="chip">{r}</span>))}
              {(params.dutyRegions || []).length === 0 && <span style={{ color:'#6b7280' }}>지정 안 함</span>}
            </div>
          </div>
          <label style={{ display:'inline-flex', alignItems:'center', gap:8, marginTop: 8 }}>
            <input type="checkbox" checked={!!params.excludeSingleBidEligible} onChange={(e)=>setParams(p=>({ ...p, excludeSingleBidEligible: !!e.target.checked }))} />
            단독입찰 가능 업체 제외
          </label>
          <label style={{ display:'inline-flex', alignItems:'center', gap:8, marginTop: 6 }}>
            <input type="checkbox" checked={!!params.filterByRegion} onChange={(e)=>setParams(p=>({ ...p, filterByRegion: !!e.target.checked }))} />
            의무지역 충족 업체만 포함
          </label>
          <div style={{ marginTop: 12 }}>
            <button className="btn-soft" onClick={runFetch} disabled={loading}>후보 검색</button>
            {loading && <span style={{ marginLeft: 8, color: '#6b7280' }}>검색 중…</span>}
            {error && <div className="error-message" style={{ marginTop: 8 }}>{error}</div>}
          </div>
        </div>
        <div className="panel" style={{ padding: 10 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 6 }}>
            <div style={{ color: '#6b7280' }}>총 {summary.total}개 · 핀 {summary.pinned} · 제외 {summary.excluded}</div>
            <div style={{ display:'flex', gap: 6, alignItems:'center' }}>
              <button className={`btn-sm ${sortDir==='desc'?'primary':'btn-soft'}`} onClick={()=>applySort('desc')}>지분 높은순</button>
              <button className={`btn-sm ${sortDir==='asc'?'primary':'btn-soft'}`} onClick={()=>applySort('asc')}>지분 낮은순</button>
              <label style={{ display:'inline-flex', alignItems:'center', gap:6, marginLeft: 6 }}>
                <input type="checkbox" checked={autoPin} onChange={(e)=>setAutoPin(!!e.target.checked)} /> 자동 핀 상위
              </label>
              <input type="number" min={1} max={10} value={autoCount} onChange={(e)=>setAutoCount(e.target.value)} style={{ width: 60, height: 32, borderRadius: 8, border: '1px solid #d0d5dd', padding: '0 8px' }} />
              <button className="btn-muted btn-sm" onClick={()=>{ setPinned(new Set()); setExcluded(new Set()); }}>선택 초기화</button>
            </div>
          </div>
          <div style={{ maxHeight: 480, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, paddingBottom: 4 }}>
            <table className="details-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: '28%' }}>업체명</th>
                  <th style={{ width: '12%' }}>대표자</th>
                  <th style={{ width: '10%' }}>지역</th>
                  <th style={{ width: '13%' }}>시평</th>
                  <th style={{ width: '13%' }}>5년실적</th>
                  <th style={{ width: '12%' }}>가능지분(%)</th>
                  <th style={{ width: '12%', textAlign: 'center' }}>상태</th>
                </tr>
              </thead>
              <tbody>
                {(sorted || []).map((c, idx) => {
                  const pct = c._pct;
                  const isAuto = autoPinned.has(c.id);
                  return (
                  <tr key={`${c.id}-${idx}`}>
                    <td>{c.name}</td>
                    <td>{c.manager}</td>
                    <td>{c.region}</td>
                    <td>{c.rating ? c.rating.toLocaleString() : ''}</td>
                    <td>{c.perf5y ? c.perf5y.toLocaleString() : ''}</td>
                    <td>{pct !== null ? pct.toFixed(2) : '-'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <div className="details-actions">
                        {c.wasAlwaysIncluded && <span className="pill">항상포함</span>}
                        {c.singleBidEligible && <span className="pill">단독가능</span>}
                        {c.moneyOk && <span className="pill">시평OK</span>}
                        {c.perfOk && <span className="pill">실적OK</span>}
                        {c.regionOk && <span className="pill">지역OK</span>}
                        {isAuto && <span className="pill">자동핀</span>}
                      </div>
                      <div className="details-actions" style={{ marginTop: 6 }}>
                        <button className={pinnedView.has(c.id) ? 'btn-sm primary' : 'btn-sm btn-soft'} onClick={()=>onTogglePin(c.id)} disabled={isAuto}>{pinnedView.has(c.id) ? (isAuto ? '핀(자동)' : '핀 해제') : '핀'}</button>
                        <button className={excluded.has(c.id) ? 'btn-sm btn-danger' : 'btn-sm btn-muted'} onClick={()=>onToggleExclude(c.id)}>{excluded.has(c.id) ? '제외 해제' : '제외'}</button>
                      </div>
                    </td>
                  </tr>
                );})}
                {(sorted || []).length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign:'center', color:'#6b7280', padding: 16 }}>{loading ? '로딩 중…' : '결과 없음'}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Modal>
  );
}
