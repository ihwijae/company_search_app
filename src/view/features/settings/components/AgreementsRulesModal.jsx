import React from 'react';
import Modal from '../../../../components/Modal';
import CompanySearchModal from '../../../../components/CompanySearchModal.jsx';

export default function AgreementsRulesModal({ open, onClose }) {
  const [doc, setDoc] = React.useState(null);
  const [ownerId, setOwnerId] = React.useState('LH');
  const [kindId, setKindId] = React.useState('eung');
  const [status, setStatus] = React.useState('');
  const [qInclude, setQInclude] = React.useState('');
  const [qExclude, setQExclude] = React.useState('');
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchTarget, setSearchTarget] = React.useState(null); // 'include' | 'exclude'
  const [searchInit, setSearchInit] = React.useState('');

  React.useEffect(() => { (async () => {
    if (!open) return;
    try {
      const r = await window.electronAPI.agreementsRulesLoad();
      if (r?.success) {
        setDoc(r.data);
        const firstOwner = (r.data.owners || [])[0];
        if (firstOwner) {
          setOwnerId(firstOwner.id || 'LH');
          const firstKind = (firstOwner.kinds || [])[0];
          if (firstKind) setKindId(firstKind.id || 'eung');
        }
      } else {
        setStatus(r?.message || '규칙을 불러오지 못했습니다');
      }
    } catch (e) { setStatus('규칙을 불러오지 못했습니다'); }
  })(); }, [open]);

  const updateRules = (updater) => {
    setDoc(prev => {
      const next = JSON.parse(JSON.stringify(prev||{}));
      const o = (next.owners || []).find(x => x.id === ownerId);
      if (!o) return next;
      const k = (o.kinds || []).find(x => x.id === kindId);
      if (!k) return next;
      k.rules = updater({ ...(k.rules||{}) }) || k.rules;
      return next;
    });
  };

  const onToggle = (key) => (e) => updateRules(r => ({ ...r, [key]: !!e.target.checked }));
  const onListChange = (key, idx, field, value) => updateRules(r => {
    const arr = Array.isArray(r[key]) ? r[key].slice() : [];
    while (arr.length <= idx) arr.push({ bizNo:'', name:'', note:'' });
    arr[idx] = { ...(arr[idx] || {}), [field]: value };
    return { ...r, [key]: arr };
  });
  const onListAdd = (key) => updateRules(r => ({ ...r, [key]: [ ...(r[key]||[]), { bizNo:'', name:'', note:'' } ] }));
  const onListRemove = (key, idx) => updateRules(r => ({ ...r, [key]: (r[key]||[]).filter((_,i)=>i!==idx) }));

  const onMgrPairChange = (idx, aOrB, value) => updateRules(r => {
    const arr = Array.isArray(r.banManagerPairs) ? r.banManagerPairs.map(p => Array.isArray(p)?p.slice():['','']) : [];
    while (arr.length <= idx) arr.push(['','']);
    arr[idx][aOrB === 'a' ? 0 : 1] = value;
    return { ...r, banManagerPairs: arr };
  });
  const onMgrPairAdd = () => updateRules(r => ({ ...r, banManagerPairs: [ ...(r.banManagerPairs||[]), ['',''] ] }));
  const onMgrPairRemove = (idx) => updateRules(r => ({ ...r, banManagerPairs: (r.banManagerPairs||[]).filter((_,i)=>i!==idx) }));

  const handleSave = async () => {
    setStatus('저장 중...');
    const resp = await window.electronAPI.agreementsRulesSave(doc);
    setStatus(resp?.success ? '저장됨' : (resp?.message || '저장 실패'));
    if (resp?.success) setTimeout(()=>setStatus(''), 1200);
  };

  const runSearch = (which) => {
    const q = which === 'include' ? qInclude : qExclude;
    if (!q || !q.trim()) return;
    setSearchTarget(which);
    setSearchInit(q.trim());
    setSearchOpen(true);
  };

  const addPickedCompany = (which, picked) => {
    const key = which === 'include' ? 'alwaysInclude' : 'alwaysExclude';
    updateRules(r => {
      const arr = Array.isArray(r[key]) ? r[key].slice() : [];
      const item = { bizNo: String(picked?.bizNo || ''), name: String(picked?.name || ''), note: '' };
      arr.push(item);
      return { ...r, [key]: arr };
    });
  };

  return (
    <>
    <Modal open={open} onClose={onClose} onCancel={onClose} onSave={handleSave} title="협정 규칙 편집" size="lg" maxWidth={1100}>
      {!doc ? (
        <div style={{ color: '#6b7280' }}>{status || '규칙 불러오는 중...'}</div>
      ) : (
        <>
          {status && <div className="error-message" style={{ background: '#eef2ff', color: '#111827' }}>{status}</div>}
          <div className="grid-2">
            <div className="filter-item">
              <label>발주처</label>
              <select className="filter-input" value={ownerId} onChange={(e)=>setOwnerId(e.target.value)}>
                {(doc.owners || []).map(o => (<option key={o.id} value={o.id}>{o.name || o.id}</option>))}
              </select>
            </div>
            <div className="filter-item">
              <label>공종</label>
              <select className="filter-input" value={kindId} onChange={(e)=>setKindId(e.target.value)}>
                {((doc.owners || []).find(o=>o.id===ownerId)?.kinds || []).map(k => (
                  <option key={k.id} value={k.id}>{({ eung: '전기', tongsin: '통신', sobang: '소방' })[k.id] || k.id}</option>
                ))}
              </select>
            </div>
          </div>

          {(() => {
            const owner = (doc.owners || []).find(o => o.id === ownerId);
            const kind = owner && (owner.kinds || []).find(k => k.id === kindId);
            if (!kind) return <div style={{ color:'#6b7280' }}>해당 규칙이 없습니다.</div>;
            const rules = kind.rules || {};
            return (
              <>
                <div className="section">
                  <h4 className="section-title" style={{ marginTop: 0 }}>시스템 규칙</h4>
                  <div className="section-divider" />
                  <label style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
                    <input type="checkbox" checked={!!rules.excludeSingleBidEligible} onChange={onToggle('excludeSingleBidEligible')} />
                    단독입찰 가능 업체는 후보에서 제외
                  </label>
                  <div className="section-help">후보 수집 단계에서 시평/실적/지역 조건을 모두 충족하는 업체를 자동으로 제외합니다.</div>
                </div>

                <div className="section">
                  <h4 className="section-title" style={{ marginTop: 0 }}>항상 포함 / 제외</h4>
                  <div className="section-divider" />
                  <div className="grid-2 rules-split">
                    <div className="rules-box">
                      <label>항상 포함(alwaysInclude) <span className="pill">{(rules.alwaysInclude||[]).length}</span></label>
                      <div className="rules-toolbar" style={{ marginTop: 6 }}>
                        <input className="filter-input" placeholder="업체명 검색" value={qInclude} onChange={(e)=>setQInclude(e.target.value)} onKeyDown={(e)=>{ if(e.key==='Enter') runSearch('include'); }} />
                        <button className="btn-sm btn-soft" onClick={()=>runSearch('include')}>검색</button>
                        <button className="btn-sm btn-muted" onClick={()=>{ setQInclude(''); }}>지우기</button>
                      </div>
                      {(rules.alwaysInclude || []).map((it, i) => (
                        <div key={`ai-${i}`} style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr auto', gap:6, marginTop:6 }}>
                          <input className="filter-input" placeholder="사업자번호" value={it.bizNo||''} onChange={(e)=>onListChange('alwaysInclude', i, 'bizNo', e.target.value)} />
                          <input className="filter-input" placeholder="업체명" value={it.name||''} onChange={(e)=>onListChange('alwaysInclude', i, 'name', e.target.value)} />
                          <input className="filter-input" placeholder="비고" value={it.note||''} onChange={(e)=>onListChange('alwaysInclude', i, 'note', e.target.value)} />
                          <button className="btn-sm btn-danger" onClick={()=>onListRemove('alwaysInclude', i)}>삭제</button>
                        </div>
                      ))}
                      <div style={{ marginTop:6 }}><button className="btn-sm" onClick={()=>onListAdd('alwaysInclude')}>행 추가</button></div>
                    </div>
                    <div className="rules-box">
                      <label>항상 제외(alwaysExclude) <span className="pill">{(rules.alwaysExclude||[]).length}</span></label>
                      <div className="rules-toolbar" style={{ marginTop: 6 }}>
                        <input className="filter-input" placeholder="업체명 검색" value={qExclude} onChange={(e)=>setQExclude(e.target.value)} onKeyDown={(e)=>{ if(e.key==='Enter') runSearch('exclude'); }} />
                        <button className="btn-sm btn-soft" onClick={()=>runSearch('exclude')}>검색</button>
                        <button className="btn-sm btn-muted" onClick={()=>{ setQExclude(''); }}>지우기</button>
                      </div>
                      {(rules.alwaysExclude || []).map((it, i) => (
                        <div key={`ae-${i}`} style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr auto', gap:6, marginTop:6 }}>
                          <input className="filter-input" placeholder="사업자번호" value={it.bizNo||''} onChange={(e)=>onListChange('alwaysExclude', i, 'bizNo', e.target.value)} />
                          <input className="filter-input" placeholder="업체명" value={it.name||''} onChange={(e)=>onListChange('alwaysExclude', i, 'name', e.target.value)} />
                          <input className="filter-input" placeholder="비고" value={it.note||''} onChange={(e)=>onListChange('alwaysExclude', i, 'note', e.target.value)} />
                          <button className="btn-sm btn-danger" onClick={()=>onListRemove('alwaysExclude', i)}>삭제</button>
                        </div>
                      ))}
                      <div style={{ marginTop:6 }}><button className="btn-sm" onClick={()=>onListAdd('alwaysExclude')}>행 추가</button></div>
                    </div>
                  </div>
                </div>

                <div className="section">
                  <h4 className="section-title" style={{ marginTop: 0 }}>담당자 규칙</h4>
                  <div className="section-divider" />
                  <label style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
                    <input type="checkbox" checked={!!rules.banSameManager} onChange={onToggle('banSameManager')} />
                    동일 담당자 중복 포함 금지
                  </label>
                  <div style={{ marginTop: 8 }}>
                    <label>금지 담당자 조합(banManagerPairs) <span className="pill">{(rules.banManagerPairs||[]).length}</span></label>
                    {(rules.banManagerPairs || []).map((p, i) => (
                      <div key={`mp-${i}`} style={{ display:'grid', gridTemplateColumns:'1fr 1fr auto', gap:6, marginTop:6 }}>
                        <input className="filter-input" placeholder="담당자 A" value={(Array.isArray(p)?p[0]:'' )||''} onChange={(e)=>onMgrPairChange(i,'a', e.target.value)} />
                        <input className="filter-input" placeholder="담당자 B" value={(Array.isArray(p)?p[1]:'' )||''} onChange={(e)=>onMgrPairChange(i,'b', e.target.value)} />
                        <button className="btn-sm btn-danger" onClick={()=>onMgrPairRemove(i)}>삭제</button>
                      </div>
                    ))}
                    <div style={{ marginTop:6 }}><button className="btn-sm" onClick={onMgrPairAdd}>행 추가</button></div>
                  </div>
                </div>
              </>
            );
          })()}
        </>
      )}
    </Modal>
    <CompanySearchModal
      open={searchOpen}
      fileType={kindId}
      initialQuery={searchInit}
      onClose={()=>setSearchOpen(false)}
      onPick={(picked)=>{ if (searchTarget) { addPickedCompany(searchTarget, picked); } setSearchOpen(false); }}
    />
    </>
  );
}
