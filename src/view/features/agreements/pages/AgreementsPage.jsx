import React, { useEffect, useMemo, useRef, useState } from 'react';
import '../../../../styles.css';
import '../../../../fonts.css';
import Sidebar from '../../../../components/Sidebar';
import CompanySearchModal from '../../../../components/CompanySearchModal.jsx';
import { validateAgreement, generateMany } from '../../../../shared/agreements/generator.js';

const OWNERS = [
  '조달청',
  '한국토지주택공사',
  '한국도로공사',
  '국가철도공단',
  '한국가스공사',
  '인천국제공항공사',
  '한국전력공사',
];

const FILE_TYPE_OPTIONS = [
  { key: 'eung', label: '전기' },
  { key: 'tongsin', label: '통신' },
  { key: 'sobang', label: '소방' },
];

// --- Shared utilities/components ---
const cleanShare = (s) => {
  let v = String(s ?? '');
  v = v.replace(/[^0-9.]/g, '');
  const first = v.indexOf('.');
  if (first !== -1) {
    v = v.slice(0, first + 1) + v.slice(first + 1).replace(/[.]/g, '');
  }
  return v;
};

const ShareInput = ({ value, onChange, className = '', style = {}, placeholder = '' }) => {
  const [inner, setInner] = React.useState(String(value ?? ''));
  useEffect(() => { setInner(String(value ?? '')); }, [value]);
  const handle = (e) => {
    const s = cleanShare(e.target.value);
    setInner(s);
    if (onChange) onChange(s);
  };
  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      spellCheck={false}
      className={`no-drag ${className}`}
      style={style}
      placeholder={placeholder}
      value={inner}
      onChange={handle}
      onInput={handle}
    />
  );
};

const deriveNoticeFields = (noticeInfoContent) => {
  const raw = String(noticeInfoContent || '').trim();
  if (!raw) {
    return { noticeNo: '', title: '' };
  }
  const tokenMatch = raw.match(/^(\S+)\s+([\s\S]+)$/);
  if (tokenMatch && /\d/.test(tokenMatch[1])) {
    return { noticeNo: tokenMatch[1], title: tokenMatch[2].trim() };
  }
  return { noticeNo: '', title: raw };
};

const composeNoticeInfo = (noticeNo, title) => {
  return [String(noticeNo || '').trim(), String(title || '').trim()].filter(Boolean).join(' ').trim();
};

// CompanySearchModal moved to shared component

function EditAgreementModal({ open, value, onChange, onClose, onSave, onSearchLeader, onSearchMember, error }) {
  if (!open || !value) return null;
  const it = value;
  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-box" style={{ maxWidth: 900, width: '92%' }} onClick={(e)=>e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>협정 편집</h3>
        {error && (
          <div style={{ margin: '8px 0', padding: '8px 12px', borderRadius: 8, background: '#fee2e2', color: '#991b1b' }}>
            {error}
          </div>
        )}
        {/* 상단 영역: 발주처/공고 정보 */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <label>발주처</label>
            <select className="filter-input" value={it.owner} onChange={(e)=>onChange({ ...it, owner: e.target.value })}>
              {OWNERS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div style={{ flex: 2 }}>
            <label>공고번호/공고명</label>
            <input
              type="text"
              className="filter-input"
              value={composeNoticeInfo(it.noticeNo, it.title)}
              onChange={(e) => {
                const next = deriveNoticeFields(e.target.value);
                onChange({ ...it, noticeNo: next.noticeNo, title: next.title });
              }}
              placeholder="예: R25BK01030907-000 ○○사업 전기공사"
            />
          </div>
        </div>
        {/* 공종 */}
        <div style={{ marginBottom: 12 }}>
          <label>공종</label>
          <select className="filter-input" value={it.type} onChange={(e)=>onChange({ ...it, type: e.target.value })}>
            <option value="">선택</option>
            {FILE_TYPE_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </div>
        {/* 대표사 입력 */}
        <div style={{ marginBottom: 6 }}>
          <label>대표사</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="text" className="filter-input" value={it.leader?.name || ''}
                   onChange={(e)=>onChange({ ...it, leader: { ...(it.leader||{}), name: e.target.value } })}
                   onKeyDown={(e)=>{ if(e.key==='Enter') onSearchLeader(it.leader?.name || ''); }} />
            <button className="no-drag" onClick={()=>onSearchLeader(it.leader?.name || '')}>조회</button>
            <ShareInput className="filter-input" style={{ width: 140 }} placeholder="지분(%)"
                        value={it.leader?.share || ''}
                        onChange={(s)=>onChange({ ...it, leader: { ...(it.leader||{}), share: s } })} />
          </div>
        </div>
        {/* 구성?? �?구성?�는 2???�름�? ?�업?�번?�줄) */}
        {(it.members || []).map((m, idx) => (
          <div key={idx} style={{ marginTop: 10, borderTop: '1px solid #eef2f6', paddingTop: 10 }}>
            <div style={{ marginBottom: 6 }}>
              <label>구성원#{idx+1}</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="text" className="filter-input" value={m.name || ''}
                       onChange={(e)=>onChange({ ...it, members: it.members.map((x,i)=>(i===idx?{...x,name:e.target.value}:x)) })}
                       onKeyDown={(e)=>{ if(e.key==='Enter') onSearchMember(idx, m.name || ''); }} />
                <button className="no-drag" onClick={()=>onSearchMember(idx, m.name || '')}>조회</button>
                <ShareInput className="filter-input" style={{ width: 140 }} placeholder="지분(%)"
                            value={m.share || ''}
                            onChange={(s)=>onChange({ ...it, members: it.members.map((x,i)=>(i===idx?{...x,share:s}:x)) })} />
              </div>
            </div>
            <div>
              <label>사업자번호</label>
              <input type="text" className="filter-input" value={m.bizNo || ''}
                     onChange={(e)=>onChange({ ...it, members: it.members.map((x,i)=>(i===idx?{...x,bizNo:e.target.value}:x)) })} />
            </div>
          </div>
        ))}

        <div style={{ marginTop: 16, textAlign: 'right', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose}>취소</button>
          <button className="primary" onClick={onSave}>저장</button>
        </div>
      </div>
    </div>
  );
}

function AgreementsPage() {
  const initialHash = window.location.hash || '';
  const initialOwner = (() => {
    if (initialHash.includes('/lh/')) return '한국토지주택공사';
    if (initialHash.includes('/pps/')) return '조달청';
    return OWNERS[0];
  })();

  const [active, setActive] = useState('agreements-sms');
  const [fileStatuses, setFileStatuses] = useState({ eung: false, tongsin: false, sobang: false });
  const [owner, setOwner] = useState(initialOwner);
  const [noticeInfo, setNoticeInfo] = useState('');
  const [typeKey, setTypeKey] = useState('');

  const [leader, setLeader] = useState({ name: '', share: '51', bizNo: '' });
  const [members, setMembers] = useState([
    { name: '', share: '49', bizNo: '' },
    { name: '', share: '', bizNo: '' },
    { name: '', share: '', bizNo: '' },
  ]); // default 3 slots
  const leaderNameRef = useRef(null);
  const [list, setList] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTarget, setModalTarget] = useState(null); // 'leader' or index of members
  const [modalInit, setModalInit] = useState('');

  // Edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editIdx, setEditIdx] = useState(null); // number | null
  const [editData, setEditData] = useState(null); // working copy of item
  const [editSearchOpen, setEditSearchOpen] = useState(false);
  const [editSearchTarget, setEditSearchTarget] = useState(null); // 'leader' or index
  const [editSearchInit, setEditSearchInit] = useState('');
  const [editError, setEditError] = useState('');

  // Inline share edit state
  const [inlineIdx, setInlineIdx] = useState(null); // number | null
  const [inlineShares, setInlineShares] = useState({ leader: '', members: [] });
  const inlineTotal = useMemo(() => {
    const toNum = (s) => {
      const n = parseFloat(String(s || '0'));
      return Number.isFinite(n) ? n : 0;
    };
    const l = toNum(inlineShares.leader);
    const m = (inlineShares.members || []).reduce((acc, v) => acc + toNum(v), 0);
    return Number((l + m).toFixed(10));
  }, [inlineShares]);

  // share input sanitizer: keep digits and a single dot
  // use shared cleanShare + ShareInput

  useEffect(() => { (async () => {
    try { const s = await window.electronAPI.checkFiles(); setFileStatuses(s); } catch {}
    try { const r = await window.electronAPI.loadAgreements(); if (r?.success && Array.isArray(r.data)) setList(r.data); } catch {}
  })(); }, []);

  // 해시 변경 시: LH 경로 처리
  useEffect(() => {
    const onHashChange = () => {
      const h = window.location.hash || '';
      if (h.includes('/lh/')) {
        setActive('lh');
        setOwner('한국토지주택공사');
      } else if (h.includes('/pps/')) {
        setActive('pps');
        setOwner('조달청');
      } else if (h.includes('/mois/')) {
        setActive('mois');
      } else {
        setActive('agreements-sms');
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const sumShare = useMemo(() => {
    const l = Number(leader.share || 0);
    const m = members.reduce((acc, it) => acc + Number(it.share || 0), 0);
    return Number((l + m).toFixed(10));
  }, [leader, members]);

  const openModalFor = (target, initial = '') => { setModalTarget(target); setModalInit(initial); setModalOpen(true); };
  const handlePick = (picked) => {
    if (modalTarget === 'leader') { setLeader(prev => ({ ...prev, name: picked.name, bizNo: picked.bizNo })); }
    else if (typeof modalTarget === 'number') {
      setMembers(prev => prev.map((it, i) => (i === modalTarget ? { ...it, name: picked.name, bizNo: picked.bizNo } : it)));
    }
    setModalOpen(false);
  };

  const addMember = () => { if (members.length < 4) setMembers(prev => [...prev, { name: '', share: '', bizNo: '' }]); };
  const removeMember = (idx) => { setMembers(prev => prev.filter((_, i) => i !== idx)); };

  const hasDup = useMemo(() => {
    const names = [leader.name, ...members.map(m => m.name)].filter(Boolean);
    const set = new Set();
    for (const n of names) { if (set.has(n)) return true; set.add(n); }
    return false;
  }, [leader, members]);

  const toInternalType = (k) => k; // already eung/tongsin/sobang

  const saveCurrentAsItem = () => {
    if (!typeKey) {
      window.alert('공종을 선택해 주세요.');
      return;
    }
    const noticeFields = deriveNoticeFields(noticeInfo);
    const item = {
      owner,
      noticeNo: noticeFields.noticeNo,
      title: noticeFields.title,
      type: toInternalType(typeKey),
      leader: { ...leader, share: String(leader.share).trim() },
      members: members.map(m => ({ ...m, share: String(m.share).trim() })),
      createdAt: Date.now(),
    };
    const v = validateAgreement(item);
    if (!v.ok) { console.warn('Create validate failed:', v.errors); return; }
    const next = [...list, item];
    setList(next);
    window.electronAPI.saveAgreements(next).catch(()=>{});
    // reset leader/members only
    setLeader({ name: '', share: '51', bizNo: '' });
    setMembers([
      { name: '', share: '49', bizNo: '' },
      { name: '', share: '', bizNo: '' },
      { name: '', share: '', bizNo: '' },
    ]);
    requestAnimationFrame(() => {
      const input = leaderNameRef.current;
      if (!input) return;
      if (document.activeElement !== input) return;
      if (input.value) {
        try {
          input.setSelectionRange(0, input.value.length);
        } catch {}
      }
    });
  };

  const handleAddClick = (event) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    saveCurrentAsItem();
  };

  const removeItem = (idx) => {
    const next = list.filter((_, i) => i !== idx);
    setList(next);
    window.electronAPI.saveAgreements(next).catch(()=>{});
  };

  // Open Edit Modal
  const openEdit = (idx) => {
    const it = list[idx];
    if (!it) return;
    setEditIdx(idx);
    // deep copy
    setEditData({
      owner: it.owner,
      noticeNo: it.noticeNo,
      title: it.title,
      type: it.type,
      leader: { ...(it.leader || {}) },
      members: (it.members || []).map(m => ({ ...m })),
    });
    setEditOpen(true);
    setEditError('');
  };

  const openEditSearch = (target, initial = '') => {
    setEditSearchTarget(target);
    setEditSearchInit(initial);
    setEditSearchOpen(true);
  };

  const handleEditPick = (picked) => {
    if (!editData) return;
    if (editSearchTarget === 'leader') {
      setEditData(prev => ({ ...prev, leader: { ...(prev.leader || {}), name: picked.name, bizNo: picked.bizNo } }));
    } else if (typeof editSearchTarget === 'number') {
      setEditData(prev => ({
        ...prev,
        members: (prev.members || []).map((m, i) => (i === editSearchTarget ? { ...m, name: picked.name, bizNo: picked.bizNo } : m))
      }));
    }
    setEditSearchOpen(false);
  };

  const saveEdit = () => {
    if (editIdx === null || editIdx === undefined || editData == null) { setEditOpen(false); return; }
    const normalized = {
      owner: editData.owner,
      noticeNo: String(editData.noticeNo || '').trim(),
      title: String(editData.title || '').trim(),
      type: editData.type,
      leader: { ...(editData.leader || {}), share: String(editData.leader?.share || '').trim() },
      members: (editData.members || []).map(m => ({ ...m, share: String(m.share || '').trim() })),
    };
    const v = validateAgreement(normalized);
    if (!v.ok) { setEditError(v.errors.join(' / ')); return; }
    const next = list.map((x, i) => (i === editIdx ? normalized : x));
    setList(next);
    window.electronAPI.saveAgreements(next).catch(()=>{});
    setEditOpen(false);
    setEditIdx(null);
    setEditData(null);
    setEditError('');
  };

  // Inline share editing helpers
  const startInlineEdit = (idx) => {
    const it = list[idx];
    if (!it) return;
    setInlineIdx(idx);
    setInlineShares({
      leader: String(it.leader?.share || ''),
      members: (it.members || []).map(m => String(m.share || '')),
    });
  };

  const cancelInlineEdit = () => {
    setInlineIdx(null);
    setInlineShares({ leader: '', members: [] });
  };

  const saveInlineEdit = () => {
    const idx = inlineIdx;
    if (idx === null || idx === undefined) return;
    const it = list[idx];
    const updated = {
      ...it,
      leader: { ...(it.leader || {}), share: String(inlineShares.leader || '').trim() },
      members: (it.members || []).map((m, i) => ({ ...m, share: String(inlineShares.members[i] || '').trim() })),
    };
    const v = validateAgreement(updated);
    if (!v.ok) { console.warn('Inline validate failed:', v.errors); return; }
    const next = list.map((x, i) => (i === idx ? updated : x));
    setList(next);
    window.electronAPI.saveAgreements(next).catch(()=>{});
    cancelInlineEdit();
  };

  const copyText = async () => {
    const text = generateMany(list);
    await navigator.clipboard.writeText(text);
    alert('문자 내용이 클립보드에 복사되었습니다.');
  };

  return (
    <div className="app-shell">
      <Sidebar
        active={active}
        onSelect={(k) => {
          setActive(k);
          if (k === 'agreements') window.location.hash = '#/agreement-board';
          if (k === 'region-search') window.location.hash = '#/region-search';
          if (k === 'agreements-sms') window.location.hash = '#/agreements';
          if (k === 'auto-agreement') { window.location.hash = '#/auto-agreement'; return; }
          if (k === 'records') window.location.hash = '#/records';
          if (k === 'mail') window.location.hash = '#/mail';
          if (k === 'excel-helper') { window.location.hash = '#/excel-helper'; return; }
          if (k === 'search') window.location.hash = '#/search';
          if (k === 'settings') window.location.hash = '#/settings';
        }}
        fileStatuses={fileStatuses}
        collapsed={true}
      />
      <div className="main">
        <div className="title-drag" />
        <div className="topbar" />
        <div className="stage">
          <div className="content">
            <div className="panel" style={{ gridColumn: '1 / -1' }}>
              <h1 className="main-title" style={{ marginTop: 0 }}>협정 문자 생성</h1>
              <div className="search-filter-section">
                <div className="filter-grid">
              <div className="filter-item">
                <label>발주처</label>
                <select className="filter-input" value={owner} onChange={(e)=>setOwner(e.target.value)}>
                  {OWNERS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="filter-item" style={{ gridColumn: 'span 2' }}>
                <label>공고번호/공고명</label>
                <input
                  type="text"
                  className="filter-input"
                  value={noticeInfo}
                  onChange={(e)=>setNoticeInfo(e.target.value)}
                  placeholder="예: R25BK01030907-000 ○○사업 전기공사"
                />
              </div>
            </div>
          </div>
        </div>

            <div className="panel" style={{ gridColumn: '1 / -1' }}>
              <h3 style={{ marginTop: 0 }}>협정 구성</h3>
              <div className="filter-grid">
                <div className="filter-item">
                  <label>공종</label>
                  <select className="filter-input" value={typeKey} onChange={(e)=>setTypeKey(e.target.value)}>
                    <option value="">선택</option>
                    {FILE_TYPE_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                  </select>
                </div>
                <div className="filter-item">
                  <label>대표사</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      ref={leaderNameRef}
                      type="text"
                      className="filter-input"
                      value={leader.name}
                      onChange={(e)=>setLeader(p=>({...p, name:e.target.value}))}
                      onKeyDown={(e)=>{ if(e.key==='Enter'){ openModalFor('leader', leader.name); } }}
                      placeholder="업체명"
                    />
                    <button className="no-drag" onClick={()=>openModalFor('leader', leader.name)}>조회</button>
                  </div>
                </div>
                <div className="filter-item">
                  <label>대표사 지분(%)</label>
                  <ShareInput className="filter-input" value={leader.share} onChange={(s)=>setLeader(p=>({...p, share: s}))} placeholder="예: 60" />
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0 }}>구성원(최대 4)</h4>
                  <button className="no-drag" onClick={addMember} disabled={members.length >= 4}>구성원 추가</button>
                </div>
                {members.map((m, idx) => (
                  <div key={idx} className="filter-grid" style={{ marginTop: 8 }}>
                    <div className="filter-item">
                      <label>구성원#{idx+1}</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input type="text" className="filter-input" value={m.name} onChange={(e)=>setMembers(prev=>prev.map((x,i)=>(i===idx?{...x,name:e.target.value}:x)))} onKeyDown={(e)=>{ if(e.key==='Enter'){ openModalFor(idx, m.name); } }} placeholder="업체명" />
                        <button className="no-drag" onClick={()=>openModalFor(idx, m.name)}>조회</button>
                      </div>
                    </div>
                    <div className="filter-item">
                      <label>지분(%)</label>
                      <ShareInput className="filter-input" value={m.share}
                                  onChange={(s)=>setMembers(prev=>prev.map((x,i)=>(i===idx?{...x,share: s}:x)))} placeholder="예: 40" />
                    </div>
                    <div className="filter-item">
                      <label>사업자번호</label>
                      <input type="text" className="filter-input" value={m.bizNo} onChange={(e)=>setMembers(prev=>prev.map((x,i)=>(i===idx?{...x,bizNo:e.target.value}:x)))} placeholder="선택 시 자동 입력" />
                    </div>
                    <div className="filter-item" style={{ alignSelf: 'end' }}>
                      <button className="no-drag" onClick={()=>removeMember(idx)}>삭제</button>
                    </div>
                  </div>
                ))}

                <div style={{ marginTop: 12, color: sumShare===100? '#065f46':'#b91c1c', fontWeight: 700 }}>
                  지분 합계: {sumShare}% {sumShare===100? '(정상)':'(100%가 되어야 합니다)'} {hasDup ? ' / (중복 존재)' : ''}
                </div>

                <div style={{ marginTop: 12, textAlign: 'right' }}>
                  <button
                    type="button"
                    className="primary"
                    onClick={handleAddClick}
                    onMouseDown={(event) => event.preventDefault()}
                    onPointerDown={(event) => event.preventDefault()}
                  >
                    리스트에 추가
                  </button>
                </div>
              </div>
            </div>

            <div className="panel" style={{ gridColumn: '1 / -1' }}>
              <h3 style={{ marginTop: 0 }}>협정 리스트({list.length}개)</h3>
              {list.length === 0 ? (
                <div style={{ color: '#6b7280' }}>추가된 협정이 없습니다.</div>
              ) : (
                <ul className="results-list">
                  {list.map((it, idx) => (
                    <li key={idx} className="company-list-item" style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span className="file-type-badge-small file-type-전기" style={{ display: it.type==='eung'?'inline-block':'none' }}>전기</span>
                        <span className="file-type-badge-small file-type-통신" style={{ display: it.type==='tongsin'?'inline-block':'none' }}>통신</span>
                        <span className="file-type-badge-small file-type-소방" style={{ display: it.type==='sobang'?'inline-block':'none' }}>소방</span>
                        <strong>[{it.owner}]</strong>
                        <span>{it.noticeNo} {it.title}</span>
                        {inlineIdx === idx ? (
                          <span style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 8 }}>
                            <span style={{ color: '#6b7280' }}>[{it.leader?.name}]</span>
                            <ShareInput style={{ width: 72 }} value={inlineShares.leader}
                                        onChange={(s)=>setInlineShares(prev=>({ ...prev, leader: s }))} />%
                            {(it.members || []).map((m, mi) => (
                              <span key={mi} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                                <span style={{ color: '#6b7280' }}>[{m?.name}]</span>
                                <ShareInput style={{ width: 72 }} value={inlineShares.members[mi] || ''}
                                            onChange={(s)=>setInlineShares(prev=>{ const arr = [...prev.members]; arr[mi] = s; return { ...prev, members: arr }; })} />%
                              </span>
                            ))}
                          </span>
                        ) : (
                          <span style={{ color: '#6b7280' }}>
                            {(() => {
                              const parts = [];
                              const leaderName = (it.leader?.name || '').trim();
                              const leaderShare = (it.leader?.share || '').toString().trim();
                              if (leaderName && leaderShare) parts.push(`[${leaderName}] ${leaderShare}%`);
                              (it.members || []).forEach(m => {
                                const n = (m?.name || '').trim();
                                const s = (m?.share || '').toString().trim();
                                if (n && s) parts.push(`[${n}] ${s}%`);
                              });
                              return parts.length ? ` → ${parts.join(' ')}` : '';
                            })()}
                          </span>
                        )}
                      </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {inlineIdx === idx ? (
                        <>
                          {inlineTotal !== 100 && (
                            <div style={{ color: '#b91c1c', fontWeight: 700, marginRight: 8 }}>
                              합계 {inlineTotal}% (100%가 되어야 합니다)
                            </div>
                          )}
                          <button className="no-drag" onClick={saveInlineEdit} disabled={inlineTotal !== 100}>저장</button>
                          <button className="no-drag" onClick={cancelInlineEdit}>취소</button>
                        </>
                      ) : (
                        <>
                          <button className="no-drag" onClick={()=>openEdit(idx)}>편집</button>
                          <button className="no-drag" onClick={()=>startInlineEdit(idx)}>지분 수정</button>
                          <button className="no-drag" onClick={()=>removeItem(idx)}>삭제</button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
              <div style={{ marginTop: 12, textAlign: 'left' }}>
                <button className="no-drag" disabled={list.length===0} onClick={() => { if (list.length===0) return; if (window.confirm('리스트를 전체 삭제하시겠습니까?')) { const next = []; setList(next); window.electronAPI.saveAgreements(next).catch(()=>{}); } }}>전체 삭제</button>
              </div>
              <div style={{ marginTop: 12, textAlign: 'right' }}>
                <button className="primary" disabled={list.length===0} onClick={copyText}>문자 생성(복사)</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <CompanySearchModal open={modalOpen} fileType={typeKey} initialQuery={modalInit} onClose={()=>setModalOpen(false)} onPick={handlePick} />
      <EditAgreementModal
        open={editOpen}
        value={editData}
        onChange={setEditData}
        onClose={()=>{ setEditOpen(false); setEditIdx(null); setEditData(null); }}
        onSave={saveEdit}
        onSearchLeader={(init)=>{ const t = editData?.type || typeKey; if(!t){ window.alert('공고타입을 먼저 선택해 주세요.'); return; } openEditSearch('leader', init); }}
        onSearchMember={(idx, init)=>{ const t = editData?.type || typeKey; if(!t){ window.alert('공고타입을 먼저 선택해 주세요.'); return; } openEditSearch(idx, init); }}
        error={editError}
      />
      <CompanySearchModal open={editSearchOpen} fileType={editData?.type || typeKey} initialQuery={editSearchInit}
                          onClose={()=>setEditSearchOpen(false)} onPick={handleEditPick} />
    </div>
  );
}

export default AgreementsPage;
