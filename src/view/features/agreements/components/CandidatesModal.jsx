import React, { useEffect, useMemo, useRef, useState } from 'react';
import Modal from '../../../../components/Modal';
import AmountInput from '../../../../components/AmountInput.jsx';

export default function CandidatesModal({ open, onClose, ownerId = 'LH', menuKey = '', fileType, entryAmount, baseAmount, estimatedAmount = '', perfectPerformanceAmount = 0, dutyRegions = [], ratioBaseAmount = '', defaultExcludeSingle = true, onApply }) {
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
  const [onlyLatest, setOnlyLatest] = useState(false);

  const isMoisUnder30 = ownerId === 'MOIS' && menuKey === 'mois-under30';
  const perfAmountValue = Number(perfectPerformanceAmount) > 0 ? String(perfectPerformanceAmount) : '';

  const initKey = JSON.stringify({ ownerId, menuKey, entryAmount, baseAmount, estimatedAmount, perfAmountValue, dutyRegions, ratioBaseAmount, defaultExcludeSingle, fileType });
  const didInitFetch = useRef(false);
  useEffect(() => {
    if (!open) return;
    const initialBase = isMoisUnder30 ? (perfAmountValue || estimatedAmount || entryAmount || '') : (baseAmount || '');
    const initialRatio = isMoisUnder30 ? '' : (ratioBaseAmount || '');
    setParams({ entryAmount: entryAmount || '', baseAmount: initialBase, dutyRegions: dutyRegions || [], ratioBase: initialRatio, minPct: '', maxPct: '', excludeSingleBidEligible: defaultExcludeSingle, filterByRegion: true });
    setList([]); setPinned(new Set()); setExcluded(new Set()); setError('');
    setOnlyLatest(false);
    didInitFetch.current = false; // allow auto fetch again for new inputs
  }, [open, initKey, isMoisUnder30, estimatedAmount, perfAmountValue]);

  // Auto fetch on open with incoming values (once per open/inputs)
  useEffect(() => {
    if (!open) return;
    if (didInitFetch.current) return;
    // Require at least one of base/entry present or some dutyRegions to prevent empty accidental fetch
    const baseCandidate = isMoisUnder30 ? (perfAmountValue || estimatedAmount || baseAmount) : baseAmount;
    const hasAmounts = String(entryAmount || '').trim() || String(baseCandidate || '').trim();
    const hasRegions = Array.isArray(dutyRegions) && dutyRegions.length > 0;
    if (hasAmounts || hasRegions) {
      didInitFetch.current = true;
      runFetch();
    }
  }, [open, initKey, isMoisUnder30, estimatedAmount, perfAmountValue]);

  const formatScore = (value) => {
    if (value === null || value === undefined) return '-';
    const n = Number(value);
    if (!Number.isFinite(n)) return '-';
    const fixed = n.toFixed(2);
    return fixed.replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
  };

  const formatRatio = (value) => {
    if (value === null || value === undefined) return '-';
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return '-';
    return `${n.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}%`;
  };

  const formatPercent = (value) => {
    if (value === null || value === undefined) return '-';
    const n = Number(value);
    if (!Number.isFinite(n)) return '-';
    const percent = n * 100;
    return `${percent.toFixed(1).replace(/\.0$/, '')}%`;
  };

  const isMaxScore = (score, maxScore) => {
    const scoreNum = Number(score);
    const maxNum = Number(maxScore);
    if (!Number.isFinite(scoreNum) || !Number.isFinite(maxNum) || maxNum <= 0) return false;
    return Math.abs(scoreNum - maxNum) < 1e-6;
  };

  const chooseDefaultMax = (type) => {
    const owner = String(ownerId || '').toUpperCase();
    if (type === 'debt') {
      if (owner === 'MOIS') return 8;
      return 7;
    }
    if (type === 'current') {
      if (owner === 'MOIS') return 7;
      return 7;
    }
    if (type === 'credit') {
      return 15;
    }
    return null;
  };

  const parseNumeric = (value) => {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const cleaned = String(value).replace(/[^0-9.+-]/g, '').trim();
    if (!cleaned) return 0;
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : 0;
  };

  const runFetch = async () => {
    setLoading(true); setError(''); setList([]);
    try {
      const perfectAmountParam = isMoisUnder30 ? params.baseAmount : perfAmountValue;
      const r = await window.electronAPI.fetchCandidates({ ownerId, menuKey, fileType, entryAmount: params.entryAmount, baseAmount: params.baseAmount, estimatedAmount, perfectPerformanceAmount: perfectAmountParam, dutyRegions: params.dutyRegions, excludeSingleBidEligible: params.excludeSingleBidEligible, filterByRegion: !!params.filterByRegion });
      if (!r?.success) throw new Error(r?.message || '후보 요청 실패');

      const enriched = (r.data || []).map((item) => {
        const debtRatioRaw = parseNumeric(item.debtRatio ?? item['부채비율']);
        const currentRatioRaw = parseNumeric(item.currentRatio ?? item['유동비율']);
        const debtAgainstAvg = Number(item.debtAgainstAverage ?? item['부채평균대비']);
        const currentAgainstAvg = Number(item.currentAgainstAverage ?? item['유동평균대비']);
        const creditScoreRaw = item.creditScore ?? null;
        const creditGradeRaw = item.creditGrade ?? item['신용평가'] ?? '';
        const creditNoteRaw = item.creditNote ?? item['신용메모'] ?? '';
        return {
          ...item,
          debtRatio: debtRatioRaw,
          currentRatio: currentRatioRaw,
          debtScore: item.debtScore ?? null,
          currentScore: item.currentScore ?? null,
          debtAgainstAverage: Number.isFinite(debtAgainstAvg) && debtAgainstAvg > 0 ? debtAgainstAvg : null,
          currentAgainstAverage: Number.isFinite(currentAgainstAvg) && currentAgainstAvg > 0 ? currentAgainstAvg : null,
          creditScore: creditScoreRaw != null ? Number(creditScoreRaw) : null,
          creditGrade: creditGradeRaw ? String(creditGradeRaw).toUpperCase() : '',
          creditNote: creditNoteRaw ? String(creditNoteRaw).toLowerCase() : '',
          debtMaxScore: item.debtMaxScore ?? null,
          currentMaxScore: item.currentMaxScore ?? null,
          creditMaxScore: item.creditMaxScore ?? null,
        };
      });

      setList(enriched);
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
    return computed.map((c) => {
      const summaryStatus = c.summaryStatus || c['요약상태'] || '';
      let statusClass = 'status-unknown';
      if (summaryStatus === '최신') statusClass = 'status-latest';
      else if (summaryStatus === '1년 경과') statusClass = 'status-warning';
      else if (summaryStatus === '1년 이상 경과') statusClass = 'status-old';
      return { ...c, summaryStatus, _statusClass: statusClass };
    }).filter((c) => {
      if (excluded.has(c.id)) return false;
      if (onlyLatest && !c.isLatest) return false;
      if (min !== null && (c._pct === null || c._pct < min)) return false;
      if (max !== null && (c._pct === null || c._pct > max)) return false;
      return true;
    });
  }, [computed, params.minPct, params.maxPct, excluded, onlyLatest]);

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

  const summary = useMemo(() => ({ total: sorted.length, pinned: pinnedView.size, excluded: excluded.size }), [sorted, pinnedView, excluded]);

  return (
    <Modal open={open} onClose={onClose} onCancel={onClose} title="후보 산출" size="xl" maxWidth={1500} closeOnSave={false}
           onSave={() => { if (onApply) onApply({ candidates: list, pinned: Array.from(pinned), excluded: Array.from(excluded) }); }}>
      <div style={{ display: 'grid', gridTemplateColumns: '320px minmax(0, 1fr)', gap: 16, padding: 8 }}>
        <div className="panel" style={{ padding: 16, fontSize: 14 }}>
          <div className="filter-item">
            <label>입찰참가자격금액</label>
            <AmountInput value={params.entryAmount} onChange={(v)=>setParams(p=>({ ...p, entryAmount: v }))} placeholder="숫자" />
          </div>
          <div className="filter-item">
            <label>{isMoisUnder30 ? '실적만점금액' : '기초금액'}</label>
            <AmountInput value={params.baseAmount} onChange={(v)=>setParams(p=>({ ...p, baseAmount: v }))} placeholder="숫자" />
          </div>
          {!isMoisUnder30 && (
            <div className="filter-item">
              <label>시공비율 기준금액</label>
              <AmountInput value={params.ratioBase} onChange={(v)=>setParams(p=>({ ...p, ratioBase: v }))} placeholder="숫자" />
            </div>
          )}
          {!isMoisUnder30 && (
            <div className="filter-item">
              <label>가능지분 필터(%)</label>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 8 }}>
                <input className="filter-input" placeholder="최소" value={params.minPct} onChange={(e)=>setParams(p=>({ ...p, minPct: e.target.value.replace(/[^0-9.]/g,'') }))} />
                <input className="filter-input" placeholder="최대" value={params.maxPct} onChange={(e)=>setParams(p=>({ ...p, maxPct: e.target.value.replace(/[^0-9.]/g,'') }))} />
              </div>
            </div>
          )}
          <div className="filter-item">
            <label>의무지역({(params.dutyRegions||[]).length})</label>
            <div className="chips" style={{ marginTop: 6 }}>
              {(params.dutyRegions || []).map((r) => (<span key={r} className="chip">{r}</span>))}
              {(params.dutyRegions || []).length === 0 && <span style={{ color:'#6b7280' }}>지정 안 함</span>}
            </div>
          </div>
          <label style={{ display:'inline-flex', alignItems:'center', gap:8, marginTop: 8, fontSize: 14 }}>
            <input type="checkbox" checked={!!params.excludeSingleBidEligible} onChange={(e)=>setParams(p=>({ ...p, excludeSingleBidEligible: !!e.target.checked }))} />
            단독입찰 가능 업체 제외
          </label>
          <label style={{ display:'inline-flex', alignItems:'center', gap:8, marginTop: 6, fontSize: 14 }}>
            <input type="checkbox" checked={!!params.filterByRegion} onChange={(e)=>setParams(p=>({ ...p, filterByRegion: !!e.target.checked }))} />
            의무지역 충족 업체만 포함
          </label>
          <label style={{ display:'inline-flex', alignItems:'center', gap:8, marginTop: 6, fontSize: 14 }}>
            <input type="checkbox" checked={onlyLatest} onChange={(e)=>setOnlyLatest(!!e.target.checked)} />
            최신자료 업체만
          </label>
          <div style={{ marginTop: 12 }}>
            <button className="btn-soft" onClick={runFetch} disabled={loading}>후보 검색</button>
            {loading && <span style={{ marginLeft: 8, color: '#6b7280' }}>검색 중…</span>}
            {error && <div className="error-message" style={{ marginTop: 8 }}>{error}</div>}
          </div>
        </div>
        <div className="panel" style={{ padding: 16, fontSize: 14, minWidth: 0 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 6 }}>
            <div style={{ color: '#6b7280' }}>총 {summary.total}개 · 고정 {summary.pinned} · 제외 {summary.excluded}</div>
            <div style={{ display:'flex', gap: 6, alignItems:'center' }}>
              <button className={`btn-sm ${sortDir==='desc'?'primary':'btn-soft'}`} onClick={()=>applySort('desc')}>지분 높은순</button>
              <button className={`btn-sm ${sortDir==='asc'?'primary':'btn-soft'}`} onClick={()=>applySort('asc')}>지분 낮은순</button>
              <label style={{ display:'inline-flex', alignItems:'center', gap:6, marginLeft: 6 }}>
                <input type="checkbox" checked={autoPin} onChange={(e)=>setAutoPin(!!e.target.checked)} /> 자동 고정 상위
              </label>
              <input type="number" min={1} max={10} value={autoCount} onChange={(e)=>setAutoCount(e.target.value)} style={{ width: 60, height: 32, borderRadius: 8, border: '1px solid #d0d5dd', padding: '0 8px' }} />
              <button className="btn-muted btn-sm" onClick={()=>{ setPinned(new Set()); setExcluded(new Set()); }}>선택 초기화</button>
            </div>
          </div>
          <div style={{ maxHeight: 560, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, paddingBottom: 4 }}>
            <table className="details-table" style={{ width: '100%', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ width: '22%' }}>업체명</th>
                  <th style={{ width: '10%' }}>대표자</th>
                  <th style={{ width: '8%' }}>지역</th>
                  <th style={{ width: '12%' }}>시평</th>
                  <th style={{ width: '12%' }}>5년실적</th>
                  <th style={{ width: '10%' }}>가능지분(%)</th>
                  <th style={{ width: '26%', textAlign: 'left' }}>상태</th>
                </tr>
              </thead>
              <tbody>
                {(sorted || []).map((c, idx) => {
                  const pct = c._pct;
                  const isAuto = autoPinned.has(c.id);
                  const debtMax = Number.isFinite(Number(c.debtMaxScore)) && Number(c.debtMaxScore) > 0
                    ? Number(c.debtMaxScore)
                    : chooseDefaultMax('debt');
                  const currentMax = Number.isFinite(Number(c.currentMaxScore)) && Number(c.currentMaxScore) > 0
                    ? Number(c.currentMaxScore)
                    : chooseDefaultMax('current');
                  const creditMax = Number.isFinite(Number(c.creditMaxScore)) && Number(c.creditMaxScore) > 0
                    ? Number(c.creditMaxScore)
                    : chooseDefaultMax('credit');
                  const debtScore = c.debtScore != null ? Number(c.debtScore) : null;
                  const currentScore = c.currentScore != null ? Number(c.currentScore) : null;
                  const creditScore = c.creditScore != null ? Number(c.creditScore) : null;
                  const combinedScore = (Number.isFinite(debtScore) ? debtScore : 0) + (Number.isFinite(currentScore) ? currentScore : 0);
                  const combinedMax = (Number.isFinite(debtMax) ? debtMax : 0) + (Number.isFinite(currentMax) ? currentMax : 0);
                  const managementMax = Math.max(combinedMax, Number.isFinite(creditMax) ? creditMax : 0);
                  let managementScore = Number.isFinite(creditScore)
                    ? Math.max(combinedScore, creditScore)
                    : combinedScore;
                  const combinedIsMax = combinedMax > 0 && Math.abs(combinedScore - combinedMax) < 1e-6;
                  const creditIsMax = Number.isFinite(creditScore)
                    && Number.isFinite(creditMax)
                    && creditMax > 0
                    && Math.abs(creditScore - creditMax) < 1e-6;
                  if (managementMax > 0 && (combinedIsMax || creditIsMax)) {
                    managementScore = managementMax;
                  }
                  const managementIsMax = managementMax > 0 && Math.abs(managementScore - managementMax) < 1e-6;
                  const hasManagementScores = Number.isFinite(debtScore) || Number.isFinite(currentScore) || Number.isFinite(creditScore);
                  const creditNoteLower = String(c.creditNote || '').toLowerCase();
                  const creditExpired = creditNoteLower === 'expired';
                  const creditOverAge = creditNoteLower === 'over-age';
                  const creditLabel = creditExpired ? '[신용 기간만료]' : (c.creditGrade || 'N/A');
                  const hasCreditScore = Number.isFinite(creditScore);
                  const managementScoreValue = hasManagementScores && Number.isFinite(managementScore) ? Number(managementScore) : null;
                  const managementScoreIs15 = managementScoreValue != null && Math.abs(managementScoreValue - 15) < 1e-3;
                  const singleBidAllowed = !!c.singleBidEligible && managementScoreIs15;
                  const singleBidBadgeStyle = singleBidAllowed
                    ? { background: '#dcfce7', color: '#166534', borderColor: '#bbf7d0' }
                    : { background: '#fee2e2', color: '#b91c1c', borderColor: '#fecaca' };
                  return (
                  <tr key={`${c.id}-${idx}`}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{c.name}</span>
                        {c.summaryStatus && (
                          <span className={`status-pill ${c._statusClass || 'status-unknown'}`}>
                            {c.summaryStatus}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>{c.manager}</td>
                    <td>{c.region}</td>
                    <td>{c.rating ? c.rating.toLocaleString() : ''}</td>
                    <td>{c.perf5y ? c.perf5y.toLocaleString() : ''}</td>
                    <td>{pct !== null ? pct.toFixed(2) : '-'}</td>
                    <td style={{ textAlign: 'left', fontSize: 13 }}>
                      <div className="details-actions" style={{ justifyContent: 'flex-start', gap: 4, rowGap: 4 }}>
                        {c.wasAlwaysIncluded && <span className="pill">항상포함</span>}
                        <span className="pill" style={singleBidBadgeStyle}>{singleBidAllowed ? '단독가능' : '단독불가능'}</span>
                        {c.moneyOk && <span className="pill">시평OK</span>}
                        {c.perfOk && <span className="pill">실적OK</span>}
                        {c.regionOk && <span className="pill">지역OK</span>}
                        {isAuto && <span className="pill">자동고정</span>}
                      </div>
                      {(c.debtScore != null || c.currentScore != null || c.creditScore != null) && (
                        <div className="score-details" style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {c.debtScore != null && (
                            <span style={{ color: isMaxScore(c.debtScore, debtMax) ? '#166534' : '#b91c1c', fontWeight: isMaxScore(c.debtScore, debtMax) ? 600 : 500 }}>
                              부채 {formatRatio(c.debtRatio)}
                              {c.debtAgainstAverage != null && ` (평균 대비 ${formatPercent(c.debtAgainstAverage)})`}
                              {` → ${formatScore(c.debtScore)}점`}
                              {debtMax ? ` / ${formatScore(debtMax)}점` : ''}
                            </span>
                          )}
                          {c.currentScore != null && (
                            <span style={{ color: isMaxScore(c.currentScore, currentMax) ? '#166534' : '#b91c1c', fontWeight: isMaxScore(c.currentScore, currentMax) ? 600 : 500 }}>
                              유동 {formatRatio(c.currentRatio)}
                              {c.currentAgainstAverage != null && ` (평균 대비 ${formatPercent(c.currentAgainstAverage)})`}
                              {` → ${formatScore(c.currentScore)}점`}
                              {currentMax ? ` / ${formatScore(currentMax)}점` : ''}
                            </span>
                          )}
                          {hasCreditScore && (
                            <span style={{ color: isMaxScore(c.creditScore, creditMax) ? '#166534' : '#b91c1c', fontWeight: isMaxScore(c.creditScore, creditMax) ? 600 : 500 }}>
                              신용 {creditLabel} → {formatScore(c.creditScore)}점
                              {creditMax ? ` / ${formatScore(creditMax)}점` : ''}
                            </span>
                          )}
                          {!hasCreditScore && creditExpired && (
                            <span style={{ color: '#b91c1c', fontWeight: 600 }}>
                              신용 {creditLabel}
                              {creditMax ? ` / ${formatScore(creditMax)}점` : ''}
                            </span>
                          )}
                          {!hasCreditScore && creditOverAge && (
                            <span style={{ color: '#b91c1c', fontWeight: 600 }}>
                              신용 평가: 인정 기간 초과
                            </span>
                          )}
                          {hasManagementScores && (
                            <span style={{ marginTop: 2, fontWeight: 600, color: managementMax > 0 ? (managementIsMax ? '#166534' : '#b91c1c') : '#1f2937' }}>
                              관리 총점 {formatScore(managementScore)}점
                              {managementMax ? ` / ${formatScore(managementMax)}점` : ''}
                            </span>
                          )}
                        </div>
                      )}
                      <div className="details-actions" style={{ marginTop: 6 }}>
                        <button className={pinnedView.has(c.id) ? 'btn-sm primary' : 'btn-sm btn-soft'} onClick={()=>onTogglePin(c.id)} disabled={isAuto}>{pinnedView.has(c.id) ? (isAuto ? '고정(자동)' : '고정 해제') : '고정'}</button>
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
