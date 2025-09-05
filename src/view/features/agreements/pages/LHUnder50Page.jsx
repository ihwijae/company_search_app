import React from 'react';
import '../../../../styles.css';
import '../../../../fonts.css';
import Sidebar from '../../../../components/Sidebar';
import AmountInput from '../../../../components/AmountInput.jsx';
import CandidatesModal from '../components/CandidatesModal.jsx';

function Field({ label, children, style = {} }) {
  return (
    <div className="filter-item" style={style}>
      <label>{label}</label>
      {children}
    </div>
  );
}

export default function LHUnder50Page() {
  const [active, setActive] = React.useState('lh');
  const [fileStatuses, setFileStatuses] = React.useState({ eung: false, tongsin: false, sobang: false });

  // Step 1: 기본 입력 상태 (간단 스켈레톤)
  const [form, setForm] = React.useState({
    industry: '전기', // 전기/통신/소방
    noticeNo: '',
    title: '',
    baseAmount: '',
    estimatedPrice: '',
    noticeDate: '',
    perfRatioBase: '',
    entryQualificationAmount: '',
    regionDutyRate: '',
    regionDutyMode: 'anyOne', // 'anyOne' | 'shareSum'
    teamSizeMax: '3',
  });

  // 지역 목록 및 선택 상태
  const [regionList, setRegionList] = React.useState([]);
  const [dutyRegions, setDutyRegions] = React.useState([]); // 복수 선택
  const [candidatesOpen, setCandidatesOpen] = React.useState(false);
  const [candidates, setCandidates] = React.useState([]);
  const [pinned, setPinned] = React.useState([]);
  const [excluded, setExcluded] = React.useState([]);

  const onChange = (k) => (e) => setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const hash = typeof window !== 'undefined' ? (window.location.hash || '') : '';
  const rangeLabel = hash.includes('50to100') ? '50억~100억' : '50억 미만';

  React.useEffect(() => {
    const sync = () => {
      const h = window.location.hash || '';
      if (h.includes('50to100')) setActive('lh-50to100');
      else if (h.includes('under50')) setActive('lh-under50');
      else setActive('lh');
    };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  // 업종 → 파일타입 맵
  const toFileType = (ind) => (ind === '전기' ? 'eung' : ind === '통신' ? 'tongsin' : 'sobang');

  // 업종 변경 시 지역 목록 로딩
  React.useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const ft = toFileType(form.industry);
        const r = await window.electronAPI.getRegions(ft);
        if (!r?.success || !Array.isArray(r.data)) return;
        const list = (r.data || []).filter((x) => x && x !== '전체');
        list.sort((a, b) => a.localeCompare(b, 'ko-KR'));
        if (!canceled) {
          setRegionList(list);
          // 선택 유지: 목록에 없는 항목은 제거
          setDutyRegions((prev) => prev.filter((x) => list.includes(x)));
        }
      } catch {}
    })();
    return () => { canceled = true; };
  }, [form.industry]);

  const toggleRegion = (name) => {
    setDutyRegions((prev) => (prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]));
  };

  // --- 단독입찰 체크(간이) ---
  const [checkQuery, setCheckQuery] = React.useState('');
  const [checkLoading, setCheckLoading] = React.useState(false);
  const [checkResults, setCheckResults] = React.useState([]);
  const [checkedCompany, setCheckedCompany] = React.useState(null);
  const [checkEval, setCheckEval] = React.useState(null); // { ok, reasons: [] }

  const parseAmount = (v) => {
    if (v === null || v === undefined) return 0;
    const s = String(v).replace(/[ ,]/g, '');
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  };

  const evalSingleBid = (company) => {
    if (!company) return;
    const entry = parseAmount(form.entryQualificationAmount || form.estimatedPrice); // 참가자격금액 없으면 추정가격 사용
    const base = parseAmount(form.baseAmount);
    const perf5y = parseAmount(company['5년 실적']);
    const sipyung = parseAmount(company['시평']);
    const region = String(company['대표지역'] || company['지역'] || '').trim();

    const moneyOk = sipyung >= entry && entry > 0; // 시평액 ≥ 참가자격금액
    const perfOk = perf5y >= base && base > 0;      // 5년실적 ≥ 기초금액(실적만점)
    const regionOk = dutyRegions.length === 0 ? true : dutyRegions.includes(region);

    const reasons = [];
    if (!moneyOk) reasons.push(`시평액 미달: ${sipyung.toLocaleString()} < 참가자격금액 ${entry.toLocaleString()}`);
    if (!perfOk) reasons.push(`5년 실적 미달(만점 기준): ${perf5y.toLocaleString()} < 기초금액 ${base.toLocaleString()}`);
    if (!regionOk) reasons.push(`의무지역 불충족: 선택(${dutyRegions.join(', ')}) / 업체지역(${region||'없음'})`);
    setCheckEval({ ok: moneyOk && perfOk && regionOk, reasons });
  };

  const runSearch = async () => {
    setCheckLoading(true); setCheckResults([]); setCheckedCompany(null); setCheckEval(null);
    try {
      const ft = toFileType(form.industry);
      const r = await window.electronAPI.searchCompanies({ name: String(checkQuery || '').trim() }, ft);
      if (r?.success) setCheckResults(r.data || []);
    } catch {}
    finally { setCheckLoading(false); }
  };

  return (
    <div className="app-shell">
      <Sidebar
        active={active}
        onSelect={(k) => {
          setActive(k);
          if (k === 'agreements') window.location.hash = '#/agreements';
          if (k === 'lh-under50') window.location.hash = '#/lh/under50';
          if (k === 'lh-50to100') window.location.hash = '#/lh/50to100';
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
            {/* Step 1: 설정 (섹션 레이아웃) */}
            <div className="panel" style={{ gridColumn: '1 / -1' }}>
              <h1 className="main-title" style={{ marginTop: 0 }}>{`LH • ${rangeLabel} — 설정`}</h1>

              {/* 공고 정보 */}
              <div className="section">
                <h3 className="section-title">공고 정보</h3>
                <div className="section-divider" />
                <div className="grid-2">
                  <Field label="공종">
                    <select className="filter-input" value={form.industry} onChange={onChange('industry')}>
                      <option value="전기">전기</option>
                      <option value="통신">통신</option>
                      <option value="소방">소방</option>
                    </select>
                  </Field>
                  <Field label="공고번호">
                    <input className="filter-input" value={form.noticeNo} onChange={onChange('noticeNo')} placeholder="예: R25BK01030907-000" />
                  </Field>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <Field label="공고명">
                      <input className="filter-input" value={form.title} onChange={onChange('title')} placeholder="예: ○○사업 전기공사" />
                    </Field>
                  </div>
                </div>
              </div>

              {/* 금액 / 일정 */}
              <div className="section">
                <h3 className="section-title">금액 / 일정</h3>
                <div className="section-divider" />
                <div className="grid-2">
                  <Field label="기초금액"><AmountInput value={form.baseAmount} onChange={(v)=>setForm(prev=>({ ...prev, baseAmount: v }))} placeholder="숫자" /></Field>
                  <Field label="추정가격"><AmountInput value={form.estimatedPrice} onChange={(v)=>setForm(prev=>({ ...prev, estimatedPrice: v }))} placeholder="숫자" /></Field>
                  <Field label="공고일"><input type="date" className="filter-input" value={form.noticeDate} onChange={onChange('noticeDate')} /></Field>
                  <Field label="시공비율시 추정금액 기준"><AmountInput value={form.perfRatioBase} onChange={(v)=>setForm(prev=>({ ...prev, perfRatioBase: v }))} placeholder="숫자" /></Field>
                  <Field label="입찰참가자격금액"><AmountInput value={form.entryQualificationAmount} onChange={(v)=>setForm(prev=>({ ...prev, entryQualificationAmount: v }))} placeholder="숫자(=추정가격)" /></Field>
                </div>
              </div>

              {/* 지역 의무 */}
              <div className="section">
                <h3 className="section-title">지역 의무</h3>
                <div className="section-divider" />
                <div className="grid-2">
                  <Field label="충족 방식 / 비율">
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <select className="filter-input" style={{ maxWidth: 220 }} value={form.regionDutyMode} onChange={onChange('regionDutyMode')}>
                        <option value="anyOne">한 명 이상 해당 지역이면 충족</option>
                        <option value="shareSum">해당 지역 지분 합계 ≥ 비율</option>
                      </select>
                      <input className="filter-input" style={{ maxWidth: 140, opacity: form.regionDutyMode !== 'shareSum' ? 0.7 : 1 }} value={form.regionDutyRate} onChange={onChange('regionDutyRate')} placeholder={form.regionDutyMode !== 'shareSum' ? '공식: shareSum에서 사용' : '예: 49'} />
                    </div>
                  </Field>
                  <div />
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label>선택된 지역</label>
                    <div className="chips" style={{ marginTop: 6 }}>
                      {(dutyRegions || []).map((r) => (<span key={r} className="chip">{r}</span>))}
                      {dutyRegions.length === 0 && <span style={{ color: '#6b7280' }}>선택된 지역 없음</span>}
                    </div>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label>지역 선택</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 6, maxHeight: 180, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, padding: 8, marginTop: 6 }}>
                      {(regionList || []).map((r) => (
                        <label key={r} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input type="checkbox" checked={dutyRegions.includes(r)} onChange={() => toggleRegion(r)} />
                          <span>{r}</span>
                        </label>
                      ))}
                    </div>
                    <div style={{ marginTop: 6, color: '#6b7280' }}>여러 지역 중 하나만 충족(OR)하거나, 지분 합계 기준으로도 설정할 수 있습니다.</div>
                  </div>
                </div>
              </div>

              {/* 팀 구성 */}
              <div className="section">
                <h3 className="section-title">팀 구성</h3>
                <div className="section-divider" />
                <div className="grid-2">
                  <Field label="팀원 수(최대)">
                    <select className="filter-input" value={form.teamSizeMax} onChange={onChange('teamSizeMax')}>
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                      <option value="4">4</option>
                      <option value="5">5</option>
                    </select>
                  </Field>
                </div>
              </div>
            </div>

            {/* Step 2: 후보 풀 */}
            <div className="panel" style={{ gridColumn: '1 / -1' }}>
              <h3 style={{ marginTop: 0 }}>후보 풀</h3>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ color: '#6b7280' }}>핀 {pinned.length} · 제외 {excluded.length} · 후보 {candidates.length}</div>
                <div>
                  <button className="btn-soft" onClick={()=>setCandidatesOpen(true)}>후보 산출</button>
                </div>
              </div>
              {candidates.length === 0 && (
                <div style={{ color: '#6b7280', marginTop: 6 }}>아직 후보가 없습니다. “후보 산출”을 눌러 조건에 맞는 후보를 불러오세요.</div>
              )}
            </div>

            {/* Step 3: 제안 */}
            <div className="panel" style={{ gridColumn: '1 / -1' }}>
              <h3 style={{ marginTop: 0 }}>자동 구성 제안</h3>
              <div style={{ color: '#6b7280' }}>
                제약을 반영해 상위 N개 조합이 카드/표로 표시됩니다. 점수/지분/제약 충족 뱃지와 세부 보기(파트 점수) 제공 예정.
              </div>
              <div style={{ marginTop: 8 }}>
                <button disabled>제안 실행(준비중)</button>
              </div>
            </div>

            {/* Step 4: 확정/내보내기 */}
            <div className="panel" style={{ gridColumn: '1 / -1' }}>
              <h3 style={{ marginTop: 0 }}>확정 / 내보내기</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button disabled>엑셀 내보내기(준비중)</button>
                <button disabled>보고서 내보내기(준비중)</button>
                <button disabled>시나리오 저장(준비중)</button>
              </div>
            </div>

          </div>
        </div>
    </div>
      <CandidatesModal
        open={candidatesOpen}
        onClose={()=>setCandidatesOpen(false)}
        fileType={toFileType(form.industry)}
        entryAmount={form.entryQualificationAmount || form.estimatedPrice}
        baseAmount={form.baseAmount}
        ratioBaseAmount={form.perfRatioBase}
        dutyRegions={dutyRegions}
        defaultExcludeSingle
        onApply={({ candidates: list, pinned: p, excluded: x })=>{ setCandidates(list); setPinned(p); setExcluded(x); setCandidatesOpen(false); }}
      />
    </div>
  );
}
