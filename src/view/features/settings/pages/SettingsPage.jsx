import React from 'react';
import '../../../../styles.css';
import '../../../../fonts.css';
import Sidebar from '../../../../components/Sidebar';
import DebtModal from '../components/DebtModal';
import CurrentModal from '../components/CurrentModal';
import CreditModal from '../components/CreditModal';
import QualityModal from '../components/QualityModal';
import BizYearsModal from '../components/BizYearsModal.jsx';
import AgreementsRulesModal from '../components/AgreementsRulesModal.jsx';
import PerformanceModal from '../components/PerformanceModal.jsx';

const Num = (v, d=0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

const MOIS_BIZ_DEFAULT = [
  { gteYears: 3, score: 1.0 },
  { ltYears: 3, score: 0.9 },
];

const MOIS_DEBT_DEFAULT = [
  { lt: 0.5, score: 8.0 },
  { lt: 0.75, score: 7.2 },
  { lt: 1.0, score: 6.4 },
  { lt: 1.25, score: 5.6 },
  { gte: 1.25, score: 4.8 },
];

const MOIS_DEBT_LEGACY = [
  { lt: 0.5, score: 8.0 },
  { lt: 0.75, score: 7.2 },
  { lt: 1.0, score: 6.4 },
  { lt: 1.25, score: 5.6 },
  { gte: 1.25, score: 4.8 },
];

const MOIS_CURRENT_DEFAULT = [
  { gte: 1.5, score: 7.0 },
  { gte: 1.2, score: 6.3 },
  { gte: 1.0, score: 5.6 },
  { gte: 0.7, score: 4.9 },
  { lt: 0.7, score: 4.2 },
];

const PERFORMANCE_DEFAULT_THRESHOLDS = [
  { minRatio: 0.8, score: 15.0 },
  { minRatio: 0.7, score: 13.0 },
  { minRatio: 0.6, score: 11.0 },
  { minRatio: 0.5, score: 9.0 },
  { minRatio: 0.4, score: 7.0 },
  { minRatio: 0.3, score: 5.0 },
  { minRatio: 0.2, score: 3.0 },
  { minRatio: 0.0, score: 1.0 },
];

export default function SettingsPage() {
  const [active, setActive] = React.useState('settings');
  const [openModal, setOpenModal] = React.useState(null); // 'debt' | 'current' | 'credit' | 'biz' | 'quality' | 'performance'
  const [merged, setMerged] = React.useState(null);
  const [agencyId, setAgencyId] = React.useState('');
  const [tierIdx, setTierIdx] = React.useState(0);
  // Form states (form-based editor)
  const [mgMethodSelection, setMgMethodSelection] = React.useState('max');
  const [mgRoundingMethod, setMgRoundingMethod] = React.useState('truncate');
  const [mgRoundingDigits, setMgRoundingDigits] = React.useState(2);
  const [debtRows, setDebtRows] = React.useState([
    { op: 'lt', value: 0.5, score: 7.0 },
    { op: 'lt', value: 0.75, score: 6.2 },
    { op: 'lt', value: 1.0, score: 5.4 },
    { op: 'lt', value: 1.25, score: 4.6 },
    { op: 'gte', value: 1.25, score: 3.8 },
  ]);
  const [currentRows, setCurrentRows] = React.useState([
    { op: 'gte', value: 1.5, score: 7.0 },
    { op: 'gte', value: 1.2, score: 6.2 },
    { op: 'gte', value: 1.0, score: 5.4 },
    { op: 'gte', value: 0.7, score: 4.6 },
    { op: 'lt', value: 0.7, score: 3.8 },
  ]);
  const [bizRows, setBizRows] = React.useState([]);
  const [bizDefaultRows, setBizDefaultRows] = React.useState([]);
  const [performanceMode, setPerformanceMode] = React.useState('ratio-bands');
  const [perfRoundMethod, setPerfRoundMethod] = React.useState('truncate');
  const [perfRoundDigits, setPerfRoundDigits] = React.useState(2);
  const [creditRows, setCreditRows] = React.useState([]);
  const [qualityRows, setQualityRows] = React.useState([]);
  const [performanceRows, setPerformanceRows] = React.useState([]);
  const [status, setStatus] = React.useState('');
  const rulesSnapshotRef = React.useRef(null); // preserve untouched fields (gradeTable, notes, etc.)
  const selectionRef = React.useRef({ agencyId: '', tierIdx: 0 });
  const applyRulesToCurrentSelection = React.useCallback((nextRules) => {
    setMerged((prev) => {
      if (!prev) return prev;
      const agencies = prev.agencies || [];
      const { agencyId: selAgencyId, tierIdx: selTierIdx } = selectionRef.current || {};
      const agencyIndex = agencies.findIndex((agency) => agency.id === selAgencyId);
      if (agencyIndex === -1) return prev;
      const targetAgency = agencies[agencyIndex];
      const tiers = targetAgency?.tiers || [];
      const targetTier = tiers[selTierIdx] || tiers[tiers.length - 1];
      if (!targetTier) return prev;
      const matchTier = (tier) => tier?.minAmount === targetTier?.minAmount && tier?.maxAmount === targetTier?.maxAmount;
      const updatedTiers = tiers.map((tier, idx) => (idx === selTierIdx || matchTier(tier) ? { ...tier, rules: nextRules } : tier));
      const updatedAgencies = agencies.slice();
      updatedAgencies[agencyIndex] = { ...targetAgency, tiers: updatedTiers };
      return { ...prev, agencies: updatedAgencies };
    });
    rulesSnapshotRef.current = nextRules;
  }, []);

  // Preview inputs
  const [baseAmount, setBaseAmount] = React.useState('500000000');
  const [perf5y, setPerf5y] = React.useState('1000000000');
  const [debtRatio, setDebtRatio] = React.useState('100');
  const [currentRatio, setCurrentRatio] = React.useState('120');
  const [bizYears, setBizYears] = React.useState('3');
  const [creditGrade, setCreditGrade] = React.useState('A0');
  const [qualityEval, setQualityEval] = React.useState('85');
  const [preview, setPreview] = React.useState(null);

  const [rulesModalOpen, setRulesModalOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [smppForm, setSmppForm] = React.useState({ id: '', password: '' });
  const [smppMessage, setSmppMessage] = React.useState('');
  const [smppSaving, setSmppSaving] = React.useState(false);

  const load = React.useCallback(async ({ preserveSelection = false, silent = false } = {}) => {
    if (!silent) setStatus('로딩...');
    const { agencyId: prevAgencyId, tierIdx: prevTierIdx } = selectionRef.current || { agencyId: '', tierIdx: 0 };
    const previousAgencyId = preserveSelection ? prevAgencyId : null;
    const previousTierIdx = preserveSelection ? prevTierIdx : 0;

    const r = await window.electronAPI.formulasLoad();
    if (!r.success) {
      if (!silent) setStatus('불러오기 실패');
      return false;
    }

    const data = r.data || {};
    setMerged(data);

    const agenciesList = data.agencies || [];
    if (!agenciesList.length) {
      setAgencyId('');
      setTierIdx(0);
      hydrateFormFromRules({}, { ownerId: '', minAmount: 0, maxAmount: 0 });
      if (!silent) setStatus('');
      return true;
    }

    let targetAgency = null;
    if (preserveSelection && previousAgencyId) {
      targetAgency = agenciesList.find((a) => a.id === previousAgencyId) || agenciesList[0];
    } else {
      targetAgency = agenciesList[0];
    }

    const targetTiers = targetAgency?.tiers || [];
    let nextTierIdx = 0;
    if (preserveSelection && targetTiers.length) {
      nextTierIdx = Math.min(Math.max(previousTierIdx, 0), targetTiers.length - 1);
    }

    setAgencyId(targetAgency.id);
    setTierIdx(nextTierIdx);

    const targetTier = targetTiers[nextTierIdx] || {};
    hydrateFormFromRules(targetTier.rules || {}, { ownerId: targetAgency.id, minAmount: targetTier.minAmount || 0, maxAmount: targetTier.maxAmount || 0 });

    if (!silent) setStatus('');
    return true;
  }, []);

  React.useEffect(() => { load(); }, [load]);
  React.useEffect(() => {
    selectionRef.current = { agencyId, tierIdx };
  }, [agencyId, tierIdx]);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      if (!window.electronAPI?.smppGetCredentials) return;
      try {
        const resp = await window.electronAPI.smppGetCredentials();
        if (mounted && resp?.success && resp.data) {
          setSmppForm({ id: resp.data.id || '', password: '' });
        }
      } catch (err) {
        if (mounted) setSmppMessage(err?.message || 'SMPP 정보를 불러오지 못했습니다.');
      }
    })();
    return () => { mounted = false; };
  }, []);

  const handleSmppChange = (field, value) => {
    setSmppForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSmppSave = async () => {
    if (!window.electronAPI?.smppSetCredentials) return;
    setSmppSaving(true);
    setSmppMessage('');
    try {
      const payload = {
        id: smppForm.id?.trim?.() || '',
        password: smppForm.password || '',
      };
      const resp = await window.electronAPI.smppSetCredentials(payload);
      if (!resp?.success) {
        throw new Error(resp?.message || '저장에 실패했습니다.');
      }
      setSmppForm((prev) => ({ ...prev, password: '' }));
      setSmppMessage('저장되었습니다. 검색 화면에서 실시간 조회를 다시 시도하세요.');
    } catch (err) {
      setSmppMessage(err?.message || '저장 실패');
    } finally {
      setSmppSaving(false);
    }
  };

  // (no-op) rules editor is now a modal and lazy-loads its data

  const agencies = merged?.agencies || [];
  const currentAgency = agencies.find(a => a.id === agencyId) || agencies[0];
  const tiers = currentAgency?.tiers || [];
  const currentTier = tiers[tierIdx] || tiers[0];
  const currentAgencyId = (currentAgency?.id || '').toUpperCase();
  const isMois = currentAgencyId === 'MOIS';
  const isLH = currentAgencyId === 'LH';
  const performanceEditable = performanceMode === 'ratio-bands'
    && currentAgencyId === 'MOIS'
    && (currentTier?.maxAmount || 0) <= 5000000000;
  const currentTierMinAmount = currentTier?.minAmount || 0;
  const showBizControls = !isMois
    ? (bizRows && bizRows.length > 0)
    : currentTierMinAmount >= 3000000000;
  const showQualityControls = isLH;

  React.useEffect(() => {
    if (!isLH && openModal === 'quality') {
      setOpenModal(null);
    }
    if (!showBizControls && openModal === 'biz') {
      setOpenModal(null);
    }
  }, [isMois, showBizControls, openModal]);

  const applyPerformanceRules = React.useCallback((performanceRules, { fallbackMode, ownerId, tierMax } = {}) => {
    const effectiveOwner = (ownerId || currentAgencyId || '').toUpperCase();
    const effectiveTierMax = typeof tierMax === 'number' ? tierMax : (currentTier?.maxAmount || 0);
    const chosenMode = performanceRules?.mode || fallbackMode || ((effectiveOwner === 'MOIS' && effectiveTierMax <= 5000000000) ? 'ratio-bands' : 'formula');
    setPerformanceMode(chosenMode);
    const pr = performanceRules?.rounding || { method: 'truncate', digits: 2 };
    setPerfRoundMethod(pr.method || 'truncate');
    setPerfRoundDigits(Num(pr.digits, 2));
    if (chosenMode === 'ratio-bands') {
      const perfThresholds = performanceRules?.thresholds && performanceRules.thresholds.length
        ? performanceRules.thresholds
        : PERFORMANCE_DEFAULT_THRESHOLDS;
      setPerformanceRows(perfThresholds.map((t) => ({ min: Num(t.minRatio ?? t.min ?? 0), score: Num(t.score, 0) })));
    } else {
      setPerformanceRows([]);
    }
  }, [currentAgencyId, currentTier]);

  React.useEffect(() => {
    if (currentTier) {
      hydrateFormFromRules(currentTier.rules || {}, { ownerId: currentAgencyId, minAmount: currentTier.minAmount || 0, maxAmount: currentTier.maxAmount || 0 });
    } else {
      hydrateFormFromRules({}, { ownerId: currentAgencyId, minAmount: 0, maxAmount: 0 });
    }
  }, [agencyId, tierIdx, currentAgencyId, currentTier]);

  function hydrateFormFromRules(rules, meta = {}) {
    try {
      rulesSnapshotRef.current = rules || {};
      const mg = rules?.management || {};
      setMgMethodSelection(mg.methodSelection || 'max');
      const mround = mg.rounding || { method: 'truncate', digits: 2 };
      setMgRoundingMethod(mround.method || 'truncate');
      setMgRoundingDigits(Num(mround.digits, 2));
      const comp = (mg.methods || []).find(m => m.id === 'composite') || {};
      const comps = comp.components || {};
      let debt = comps.debtRatio?.thresholds || [];
      let curr = comps.currentRatio?.thresholds || [];
      let biz = comps.bizYears?.thresholds || [];
      const effectiveOwner = (meta.ownerId || currentAgencyId || '').toUpperCase();
      const tierMinAmount = meta.minAmount || 0;
      const tierMaxAmount = typeof meta.maxAmount === 'number' ? meta.maxAmount : (currentTier?.maxAmount || 0);
      if (effectiveOwner === 'MOIS' && tierMinAmount >= 3000000000) {
        const isLegacyDebt = JSON.stringify(debt) === JSON.stringify(MOIS_DEBT_LEGACY);
        if (isLegacyDebt || !debt.length) debt = MOIS_DEBT_DEFAULT;
        if (!curr.length) curr = MOIS_CURRENT_DEFAULT;
        if (!biz.length) biz = MOIS_BIZ_DEFAULT;
        const effectiveBiz = biz.length ? biz : MOIS_BIZ_DEFAULT;
        setBizDefaultRows(effectiveBiz.map((t) => ({ ...t })));
      } else {
        setBizDefaultRows((biz || []).map((t) => ({ ...t })));
        if (effectiveOwner === 'MOIS') {
          biz = [];
        }
      }
      if (debt.length) setDebtRows(debt.map(t => ({ op: (t.lt!=null?'lt':'gte'), value: Num(t.lt!=null?t.lt:t.gte), score: Num(t.score) })));
      else setDebtRows([]);
      if (curr.length) setCurrentRows(curr.map(t => ({ op: (t.lt!=null?'lt':'gte'), value: Num(t.lt!=null?t.lt:t.gte), score: Num(t.score) })));
      else setCurrentRows([]);
      if (biz.length) setBizRows(biz.map(t => ({ op: (t.ltYears!=null?'ltYears':'gteYears'), value: Num(t.ltYears!=null?t.ltYears:t.gteYears), score: Num(t.score) })));
      else setBizRows([]);
      const quality = comps.qualityEval?.thresholds || [];
      if (quality.length) setQualityRows(quality.map(t => ({ op: (t.lt!=null?'lt':'gte'), value: Num(t.lt!=null?t.lt:t.gte), score: Num(t.score) })));
      else setQualityRows([]);
      const credit = (mg.methods || []).find(m => m.id === 'credit');
      const grades = credit?.gradeTable || [];
      if (grades.length) setCreditRows(grades.map(g => ({ grade: String(g.grade||''), base: Num(g.base), score: Num(g.score) })));
      const pf = rules?.performance || {};
      applyPerformanceRules(pf, { ownerId: effectiveOwner, tierMax: tierMaxAmount });
    } catch (e) {
      console.warn('hydrate failed:', e);
    }
  }

  const exportSettings = async () => {
    setBusy(true); setStatus('설정 내보내기...');
    try { const r = await window.electronAPI.settingsExport(); setStatus(r.success ? '내보내기 완료' : (r.message || '실패')); }
    catch (e) { setStatus('실패: ' + (e.message || e)); }
    finally { setBusy(false); setTimeout(()=>setStatus(''), 1200); }
  };
  const importSettings = async () => {
    setBusy(true); setStatus('설정 가져오기...');
    try { const r = await window.electronAPI.settingsImport();
      if (r.success) {
        // Reload merged formulas to reflect overrides; rules modal는 다음 오픈 시 반영
        await load(); setStatus('가져오기 완료');
      } else { setStatus(r.message || '실패'); }
    } catch (e) { setStatus('실패: ' + (e.message || e)); }
    finally { setBusy(false); setTimeout(()=>setStatus(''), 1200); }
  };

  function buildRulesFromForm() {
    const prev = rulesSnapshotRef.current || {};
    const creditPrev = (prev.management?.methods || []).find(m => m.id === 'credit');
    const perfPrev = prev.performance || {};
    const industryAverage = prev.management?.industryAverage || { source: 'default', override: null };
    const notes = prev.notes;
    const effectiveFrom = prev.effectiveFrom || null;
    const effectiveTo = prev.effectiveTo || null;

    const compositeComponents = {
      debtRatio: { against: 'industryAverage', scale: 'lowerIsBetter', thresholds: debtRows.map(r => (r.op==='lt'?{ lt: Num(r.value), score: Num(r.score) }:{ gte: Num(r.value), score: Num(r.score) })) },
      currentRatio: { against: 'industryAverage', scale: 'higherIsBetter', thresholds: currentRows.map(r => (r.op==='lt'?{ lt: Num(r.value), score: Num(r.score) }:{ gte: Num(r.value), score: Num(r.score) })) },
      bizYears: { scale: 'higherIsBetter', thresholds: bizRows.map(r => (r.op==='ltYears'?{ ltYears: Num(r.value), score: Num(r.score) }:{ gteYears: Num(r.value), score: Num(r.score) })) },
    };
    if (isLH) {
      compositeComponents.qualityEval = { scale: 'higherIsBetter', thresholds: qualityRows.map(r => (r.op==='lt'?{ lt: Num(r.value), score: Num(r.score) }:{ gte: Num(r.value), score: Num(r.score) })) };
    }

    return {
      management: {
        methodSelection: mgMethodSelection || 'max',
        methods: [
          {
            id: 'composite', label: '요소합산', maxScore: 15,
            components: compositeComponents,
          },
          (() => {
            const prev = creditPrev || { id: 'credit', label: '신용등급환산', maxScore: 15, gradeTable: [] };
            const nextGrades = (creditRows && creditRows.length)
              ? creditRows.map(g => ({ grade: String(g.grade||''), base: Num(g.base), score: Num(g.score) }))
              : (prev.gradeTable || []);
            return { ...prev, gradeTable: nextGrades };
          })()
        ],
        rounding: { method: mgRoundingMethod || 'truncate', digits: Num(mgRoundingDigits, 2) },
        industryAverage,
      },
      performance: {
        formula: perfPrev.formula || '(perf5y / baseAmount) * 13',
        variables: perfPrev.variables || ['perf5y', 'baseAmount'],
        rounding: { method: perfRoundMethod || 'truncate', digits: Num(perfRoundDigits, 2) },
        mode: performanceMode,
        thresholds: (performanceMode === 'ratio-bands'
          ? (performanceRows && performanceRows.length
            ? performanceRows.map((r) => ({ minRatio: Num(r.min, 0), score: Num(r.score, 0) }))
            : (perfPrev.thresholds || []))
          : (perfPrev.thresholds || [])),
        ...(performanceMode !== 'ratio-bands' && Number.isFinite(Number(perfPrev.maxScore))
          ? { maxScore: Number(perfPrev.maxScore) }
          : {}),
      },
      notes,
      effectiveFrom,
      effectiveTo,
    };
  }

  // Build rules but allow overriding a specific section's rows
  function buildRulesFromFormWithOverrides({ debtRowsOverride, currentRowsOverride, bizRowsOverride, creditRowsOverride, qualityRowsOverride, performanceRowsOverride }) {
    const prev = rulesSnapshotRef.current || {};
    const creditPrev = (prev.management?.methods || []).find(m => m.id === 'credit');
    const perfPrev = prev.performance || {};
    const industryAverage = prev.management?.industryAverage || { source: 'default', override: null };
    const notes = prev.notes;
    const effectiveFrom = prev.effectiveFrom || null;
    const effectiveTo = prev.effectiveTo || null;

    const debtSrc = debtRowsOverride || debtRows;
    const currSrc = currentRowsOverride || currentRows;
    const bizSrc = bizRowsOverride || bizRows;
    const creditSrc = creditRowsOverride || creditRows;
    const qualitySrc = qualityRowsOverride || qualityRows;
    const performanceSrc = typeof performanceRowsOverride !== 'undefined' ? performanceRowsOverride : performanceRows;

    return {
      management: {
        methodSelection: mgMethodSelection || 'max',
        methods: [
          {
            id: 'composite', label: '요소합산', maxScore: 15,
            components: {
              debtRatio: { against: 'industryAverage', scale: 'lowerIsBetter', thresholds: (debtSrc || []).map(r => (r.op==='lt'?{ lt: Num(r.value), score: Num(r.score) }:{ gte: Num(r.value), score: Num(r.score) })) },
              currentRatio: { against: 'industryAverage', scale: 'higherIsBetter', thresholds: (currSrc || []).map(r => (r.op==='lt'?{ lt: Num(r.value), score: Num(r.score) }:{ gte: Num(r.value), score: Num(r.score) })) },
              bizYears: { scale: 'higherIsBetter', thresholds: (bizSrc || []).map(r => (r.op==='ltYears'?{ ltYears: Num(r.value), score: Num(r.score) }:{ gteYears: Num(r.value), score: Num(r.score) })) },
              ...(isLH ? {
                qualityEval: { scale: 'higherIsBetter', thresholds: (qualitySrc || []).map(r => (r.op==='lt'?{ lt: Num(r.value), score: Num(r.score) }:{ gte: Num(r.value), score: Num(r.score) })) },
              } : {}),
            }
          },
          (() => {
            const prevC = creditPrev || { id: 'credit', label: '신용등급환산', maxScore: 15, gradeTable: [] };
            const nextGrades = (creditSrc && creditSrc.length)
              ? creditSrc.map(g => ({ grade: String(g.grade||''), base: Num(g.base), score: Num(g.score) }))
              : (prevC.gradeTable || []);
            return { ...prevC, gradeTable: nextGrades };
          })()
        ],
        rounding: { method: mgRoundingMethod || 'truncate', digits: Num(mgRoundingDigits, 2) },
        industryAverage,
      },
      performance: {
        formula: perfPrev.formula || '(perf5y / baseAmount) * 13',
        variables: perfPrev.variables || ['perf5y', 'baseAmount'],
        rounding: { method: perfRoundMethod || 'truncate', digits: Num(perfRoundDigits, 2) },
        mode: performanceMode,
        thresholds: (performanceMode === 'ratio-bands'
          ? (performanceSrc && performanceSrc.length
            ? performanceSrc.map((r) => ({ minRatio: Num(r.min, 0), score: Num(r.score, 0) }))
            : (perfPrev.thresholds || []))
          : (perfPrev.thresholds || [])),
        ...(performanceMode !== 'ratio-bands' && Number.isFinite(Number(perfPrev.maxScore))
          ? { maxScore: Number(perfPrev.maxScore) }
          : {}),
      },
      notes,
      effectiveFrom,
      effectiveTo,
    };
  }

  // --- 섹션 단위 작업 핸들러 ---
  const reloadSectionMerged = async (section) => {
    const r = await window.electronAPI.formulasLoad();
    if (!r.success) { setStatus('불러오기 실패'); return; }
    const data = r.data || {};
    const ag = (data.agencies || []).find(a => a.id === currentAgency.id) || (data.agencies || [])[0];
    if (!ag) return;
    const t = (ag.tiers || [])[tierIdx] || (ag.tiers || [])[0];
    if (!t) return;
    const rules = t.rules || {};
    const mg = rules?.management || {};
    const comp = (mg.methods || []).find(m => m.id === 'composite') || {};
    const comps = comp.components || {};
    if (section === 'debt') {
      const debt = comps.debtRatio?.thresholds || [];
      setDebtRows(debt.map(tt => ({ op: (tt.lt!=null?'lt':'gte'), value: Num(tt.lt!=null?tt.lt:tt.gte), score: Num(tt.score) })));
    } else if (section === 'current') {
      const curr = comps.currentRatio?.thresholds || [];
      setCurrentRows(curr.map(tt => ({ op: (tt.lt!=null?'lt':'gte'), value: Num(tt.lt!=null?tt.lt:tt.gte), score: Num(tt.score) })));
    } else if (section === 'biz') {
      const biz = comps.bizYears?.thresholds || [];
      if (currentAgencyId === 'MOIS' && (currentTier?.minAmount || 0) >= 3000000000) {
        const value = biz.length ? biz : MOIS_BIZ_DEFAULT;
        setBizRows(value.map(tt => ({ op: (tt.ltYears!=null?'ltYears':'gteYears'), value: Num(tt.ltYears!=null?tt.ltYears:tt.gteYears), score: Num(tt.score) })));
        setBizDefaultRows(value.map((tt) => ({ ...tt })));
      } else {
        setBizRows(biz.map(tt => ({ op: (tt.ltYears!=null?'ltYears':'gteYears'), value: Num(tt.ltYears!=null?tt.ltYears:tt.gteYears), score: Num(tt.score) })));
        setBizDefaultRows(biz.map((tt) => ({ ...tt })));
      }
    } else if (section === 'quality') {
      const q = comps.qualityEval?.thresholds || [];
      setQualityRows(q.map(tt => ({ op: (tt.lt!=null?'lt':'gte'), value: Num(tt.lt!=null?tt.lt:tt.gte), score: Num(tt.score) })));
    } else if (section === 'credit') {
      const credit = (mg.methods || []).find(m => m.id === 'credit');
      const grades = credit?.gradeTable || [];
      setCreditRows(grades.map(g => ({ grade: String(g.grade||''), base: Num(g.base), score: Num(g.score) })));
    } else if (section === 'performance') {
      const pf = rules?.performance || {};
      applyPerformanceRules(pf, { ownerId: currentAgencyId, tierMax: currentTier?.maxAmount || 0 });
    }
    setStatus('다시 불러오기 완료');
    setTimeout(()=>setStatus(''), 1200);
  };

  const restoreSectionDefaults = async (section) => {
    const r = await window.electronAPI.formulasLoadDefaults();
    if (!r.success) { setStatus('기본값 불러오기 실패'); return; }
    const defs = r.data || {};
    const ag = (defs.agencies || []).find(a => a.id === currentAgency.id) || (defs.agencies || [])[0];
    if (!ag) { setStatus('해당 발주처의 기본값이 없습니다'); return; }
    const t = (ag.tiers || [])[tierIdx] || (ag.tiers || [])[0];
    if (!t) { setStatus('해당 구간의 기본값이 없습니다'); return; }
    const rules = t.rules || {};
    const mg = rules?.management || {};
    const comp = (mg.methods || []).find(m => m.id === 'composite') || {};
    const comps = comp.components || {};
    if (section === 'debt') {
      const debt = comps.debtRatio?.thresholds || [];
      setDebtRows(debt.map(tt => ({ op: (tt.lt!=null?'lt':'gte'), value: Num(tt.lt!=null?tt.lt:tt.gte), score: Num(tt.score) })));
    } else if (section === 'current') {
      const curr = comps.currentRatio?.thresholds || [];
      setCurrentRows(curr.map(tt => ({ op: (tt.lt!=null?'lt':'gte'), value: Num(tt.lt!=null?tt.lt:tt.gte), score: Num(tt.score) })));
    } else if (section === 'biz') {
      const biz = comps.bizYears?.thresholds || [];
      if (currentAgencyId === 'MOIS' && (currentTier?.minAmount || 0) >= 3000000000) {
        const value = biz.length ? biz : MOIS_BIZ_DEFAULT;
        setBizRows(value.map(tt => ({ op: (tt.ltYears!=null?'ltYears':'gteYears'), value: Num(tt.ltYears!=null?tt.ltYears:tt.gteYears), score: Num(tt.score) })));
        setBizDefaultRows(value.map((tt) => ({ ...tt })));
      } else {
        setBizRows(biz.map(tt => ({ op: (tt.ltYears!=null?'ltYears':'gteYears'), value: Num(tt.ltYears!=null?tt.ltYears:tt.gteYears), score: Num(tt.score) })));
        setBizDefaultRows(biz.map((tt) => ({ ...tt })));
      }
    } else if (section === 'quality') {
      const q = comps.qualityEval?.thresholds || [];
      setQualityRows(q.map(tt => ({ op: (tt.lt!=null?'lt':'gte'), value: Num(tt.lt!=null?tt.lt:tt.gte), score: Num(tt.score) })));
    } else if (section === 'credit') {
      const credit = (mg.methods || []).find(m => m.id === 'credit');
      const grades = credit?.gradeTable || [];
      setCreditRows(grades.map(g => ({ grade: String(g.grade||''), base: Num(g.base), score: Num(g.score) })));
    } else if (section === 'performance') {
      const pf = rules?.performance || {};
      applyPerformanceRules(pf, { ownerId: currentAgencyId, tierMax: currentTier?.maxAmount || 0 });
    }
    setStatus('기본값으로 복원됨');
    setTimeout(()=>setStatus(''), 1200);
  };

  const ensureTargetSelected = () => {
    if (!currentAgency || !currentTier) {
      setStatus('발주처와 금액구간을 먼저 선택하세요');
      setTimeout(() => setStatus(''), 1200);
      return false;
    }
    return true;
  };

  const saveSectionOverrides = async ({ debt, current, credit, quality, biz, performance }) => {
    if (!ensureTargetSelected()) return;
    try {
      const rules = buildRulesFromFormWithOverrides({
        debtRowsOverride: debt || null,
        currentRowsOverride: current || null,
        creditRowsOverride: credit || null,
        bizRowsOverride: biz || null,
        qualityRowsOverride: isLH ? (quality || null) : null,
        performanceRowsOverride: performance || null,
      });
      const payload = {
        version: 1,
        agencies: [
          { id: currentAgency.id, tiers: [ { minAmount: currentTier.minAmount, maxAmount: currentTier.maxAmount, rules } ] }
        ]
      };
      applyRulesToCurrentSelection(rules);
      setStatus('저장 중...');
      const r = await window.electronAPI.formulasSaveOverrides(payload);
      if (!r.success) throw new Error(r.message || 'save failed');
      const reloaded = await load({ preserveSelection: true, silent: true });
      setStatus(reloaded ? '저장 완료' : '저장 완료 (재로딩 실패)');
      setTimeout(()=>setStatus(''), 1200);
    } catch (e) { setStatus('저장 실패: ' + (e?.message || e)); }
  };

  const saveOverrides = async () => {
    if (!ensureTargetSelected()) return;
    try {
      const rules = buildRulesFromForm();
      const payload = {
        version: 1,
        agencies: [
          { id: currentAgency.id, tiers: [ { minAmount: currentTier.minAmount, maxAmount: currentTier.maxAmount, rules } ] }
        ]
      };
      applyRulesToCurrentSelection(rules);
      setStatus('저장 중...');
      const r = await window.electronAPI.formulasSaveOverrides(payload);
      if (!r.success) throw new Error(r.message || 'save failed');
      const reloaded = await load({ preserveSelection: true, silent: true });
      setStatus(reloaded ? '저장 완료' : '저장 완료 (재로딩 실패)');
      setTimeout(()=>setStatus(''), 1200);
    } catch (e) { setStatus('저장 실패: ' + (e?.message || e)); }
  };

  const doPreview = async () => {
    const payload = {
      agencyId: currentAgency?.id,
      amount: Number(baseAmount) || 0,
      inputs: {
        perf5y: Number(perf5y) || 0,
        baseAmount: Number(baseAmount) || 0,
        debtRatio: Number(debtRatio) || 0,
        currentRatio: Number(currentRatio) || 0,
        bizYears: Number(bizYears) || 0,
        creditGrade: String(creditGrade || ''),
        qualityEval: Number(qualityEval) || 85,
      }
    };
    const r = await window.electronAPI.formulasEvaluate(payload);
    if (r.success) setPreview(r.data); else setPreview({ ok: false, error: r.message });
  };

  const restoreDefaults = async () => {
    if (!currentAgency || !currentTier) return;
    const proceed = window.confirm('현재 폼의 변경사항이 사라지고 기본값으로 되돌립니다. 계속할까요?');
    if (!proceed) return;
    const r = await window.electronAPI.formulasLoadDefaults();
    if (!r.success) { setStatus('기본값 불러오기 실패'); return; }
    const defs = r.data || {};
    const ag = (defs.agencies || []).find(a => a.id === currentAgency.id) || (defs.agencies || [])[0];
    if (!ag) { setStatus('해당 발주처의 기본값이 없습니다'); return; }
    const t = (ag.tiers || []).find(x => x.minAmount === currentTier.minAmount && x.maxAmount === currentTier.maxAmount) || (ag.tiers || [])[0];
    if (!t) { setStatus('해당 구간의 기본값이 없습니다'); return; }
    hydrateFormFromRules(t.rules || {}, { ownerId: currentAgency?.id, minAmount: t.minAmount || 0, maxAmount: t.maxAmount || 0 });
    setStatus('기본값으로 복원됨');
    setTimeout(()=>setStatus(''), 1200);
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
          if (k === 'bid-result') { window.location.hash = '#/bid-result'; return; }
          if (k === 'kakao-send') { window.location.hash = '#/kakao-send'; return; }
          if (k === 'company-notes') { window.location.hash = '#/company-notes'; return; }
          if (k === 'search') window.location.hash = '#/search';
          if (k === 'settings') window.location.hash = '#/settings';
        }}
        fileStatuses={{}}
        collapsed={true}
      />
      <div className="main">
        <div className="title-drag" />
        <div className="topbar" />
        <div className="stage">
          <div className="content">
            <div className="panel" style={{ gridColumn: '1 / -1' }}>
              <h1 className="main-title" style={{ marginTop: 0 }}>설정 • 적격검사 기준</h1>
              {status && <div className="error-message" style={{ background: '#eef2ff', color: '#111827' }}>{status}</div>}
              <div className="search-filter-section">
                <div className="filter-grid">
                  <div className="filter-item">
                    <label>발주처</label>
                    <select className="filter-input" value={agencyId} onChange={(e)=>setAgencyId(e.target.value)}>
                      {(agencies || []).map(a => <option key={a.id} value={a.id}>{a.name} ({a.id})</option>)}
                    </select>
                  </div>
                  <div className="filter-item">
                    <label>금액구간</label>
                    <select className="filter-input" value={String(tierIdx)} onChange={(e)=>setTierIdx(Number(e.target.value)||0)}>
                      {(tiers || []).map((t, i) => (
                        <option key={i} value={String(i)}>{`${t.minAmount?.toLocaleString?.()||t.minAmount} ~ ${t.maxAmount?.toLocaleString?.()||t.maxAmount}`}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div style={{ display:'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <button className="btn-soft" onClick={()=>setRulesModalOpen(true)}>협정 규칙 편집</button>
                <button className="btn-soft" onClick={exportSettings} disabled={busy}>설정 내보내기</button>
                <button className="btn-soft" onClick={importSettings} disabled={busy}>설정 가져오기</button>
                {status && <span style={{ color: '#6b7280' }}>{status}</span>}
              </div>
            </div>

            <div className="panel" style={{ gridColumn: '1 / -1' }}>
              <h3 style={{ marginTop: 0 }}>실시간 SMPP 계정</h3>
              <p style={{ margin: '4px 0 12px', color: '#6b7280' }}>
                ID와 비밀번호를 저장하면 config.json이 자동으로 갱신되고, 검색 상세 화면의 실시간 조회 버튼이 이 계정으로 동작합니다.
              </p>
              <div className="filter-grid">
                <div className="filter-item">
                  <label>SMPP ID</label>
                  <input
                    className="filter-input"
                    value={smppForm.id}
                    onChange={(e) => handleSmppChange('id', e.target.value)}
                    placeholder="예: jium2635"
                  />
                </div>
                <div className="filter-item">
                  <label>SMPP 비밀번호</label>
                  <input
                    className="filter-input"
                    type="password"
                    value={smppForm.password}
                    onChange={(e) => handleSmppChange('password', e.target.value)}
                    placeholder="●●●●"
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  className="btn-soft"
                  onClick={handleSmppSave}
                  disabled={smppSaving || !smppForm.id.trim() || !smppForm.password}
                >
                  {smppSaving ? '저장 중...' : '저장'}
                </button>
                {smppMessage && (
                  <span style={{ color: smppMessage.includes('실패') ? '#dc2626' : '#16a34a' }}>{smppMessage}</span>
                )}
              </div>
            </div>

            <div className="panel" style={{ gridColumn: '1 / -1' }}>
              <h3 style={{ marginTop: 0 }}>경영점수 • 요소합산</h3>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <button onClick={() => setOpenModal('debt')}>부채비율 기준 수정</button>
                <button onClick={() => setOpenModal('current')}>유동비율 기준 수정</button>
                <button onClick={() => setOpenModal('credit')}>신용평가 기준 수정</button>
                {showBizControls && (
                  <button onClick={() => setOpenModal('biz')}>영업기간 기준 수정</button>
                )}
                {showQualityControls && (
                  <button onClick={() => setOpenModal('quality')}>품질평가 기준 수정</button>
                )}
                <button onClick={() => {
                  if (!ensureTargetSelected()) return;
                  const pf = currentTier?.rules?.performance || {};
                  applyPerformanceRules(pf, { ownerId: currentAgencyId, tierMax: currentTier?.maxAmount || 0 });
                  setOpenModal('performance');
                }}>실적점수 기준 수정</button>
                <button onClick={() => setRulesModalOpen(true)} style={{ marginLeft: 'auto' }}>협정 규칙 편집</button>
              </div>
              <div className="filter-grid">
                <div className="filter-item"><label>방식 선택</label>
                  <select className="filter-input" value={mgMethodSelection} onChange={(e)=>setMgMethodSelection(e.target.value)}>
                    <option value="max">둘 다 계산 후 높은 점수 사용</option>
                    <option value="composite">요소합산만 사용</option>
                    <option value="credit">신용등급만 사용</option>
                  </select>
                </div>
                <div className="filter-item"><label>경영점수 절삭</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select className="filter-input" value={mgRoundingMethod} onChange={(e)=>setMgRoundingMethod(e.target.value)} style={{ maxWidth: 160 }}>
                      <option value="truncate">절삭(truncate)</option>
                      <option value="round">반올림(round)</option>
                      <option value="floor">내림(floor)</option>
                      <option value="ceil">올림(ceil)</option>
                    </select>
                    <input className="filter-input" style={{ maxWidth: 120 }} value={mgRoundingDigits} onChange={(e)=>setMgRoundingDigits(e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="filter-item" style={{ marginTop: 12 }}>
                <p style={{ margin: 0, color: '#6b7280' }}>상세 임계값 편집은 위의 버튼으로 모달에서 수행하세요.</p>
              </div>
            </div>

            {/* 협정 규칙은 모달로 편집 */}

            <div className="panel" style={{ gridColumn: '1 / -1' }}>
              <h3 style={{ marginTop: 0 }}>시공점수</h3>
              <div className="filter-grid">
                <div className="filter-item"><label>점수 절삭</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select className="filter-input" value={perfRoundMethod} onChange={(e)=>setPerfRoundMethod(e.target.value)} style={{ maxWidth: 160 }}>
                      <option value="truncate">절삭(truncate)</option>
                      <option value="round">반올림(round)</option>
                      <option value="floor">내림(floor)</option>
                      <option value="ceil">올림(ceil)</option>
                    </select>
                    <input className="filter-input" style={{ maxWidth: 120 }} value={perfRoundDigits} onChange={(e)=>setPerfRoundDigits(e.target.value)} />
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button className="btn-soft" onClick={saveOverrides}>시공점수 저장</button>
                <button className="btn-muted" onClick={restoreDefaults}>기본값으로 복원</button>
              </div>
            </div>

            <div className="panel" style={{ gridColumn: '1 / -1' }}>
              <h3 style={{ marginTop: 0 }}>미리보기</h3>
              <div className="filter-grid">
                <div className="filter-item"><label>기초금액</label><input className="filter-input" value={baseAmount} onChange={(e)=>setBaseAmount(e.target.value)} /></div>
                <div className="filter-item"><label>5년 실적</label><input className="filter-input" value={perf5y} onChange={(e)=>setPerf5y(e.target.value)} /></div>
                <div className="filter-item"><label>부채비율(%)</label><input className="filter-input" value={debtRatio} onChange={(e)=>setDebtRatio(e.target.value)} /></div>
                <div className="filter-item"><label>유동비율(%)</label><input className="filter-input" value={currentRatio} onChange={(e)=>setCurrentRatio(e.target.value)} /></div>
                <div className="filter-item"><label>영업기간(년)</label><input className="filter-input" value={bizYears} onChange={(e)=>setBizYears(e.target.value)} /></div>
                <div className="filter-item"><label>신용등급</label><input className="filter-input" value={creditGrade} onChange={(e)=>setCreditGrade(e.target.value)} /></div>
                {showQualityControls && (
                  <div className="filter-item"><label>품질평가 점수</label><input className="filter-input" value={qualityEval} onChange={(e)=>setQualityEval(e.target.value)} /></div>
                )}
                <div className="filter-item"><label>&nbsp;</label><button className="search-button" onClick={doPreview}>계산</button></div>
              </div>
              {preview && (
                <pre style={{ background: '#f8fafc', padding: 12, borderRadius: 8, overflow: 'auto' }}>
{JSON.stringify(preview, null, 2)}
                </pre>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* 전용 모달 래퍼 연결 (동작 동일) */}
      <DebtModal
        open={openModal === 'debt'}
        rows={debtRows}
        onClose={() => setOpenModal(null)}
        onReload={() => reloadSectionMerged('debt')}
        onRestore={() => restoreSectionDefaults('debt')}
        onSave={(rows) => { setDebtRows(rows); return saveSectionOverrides({ debt: rows }); }}
      />
      <CurrentModal
        open={openModal === 'current'}
        rows={currentRows}
        onClose={() => setOpenModal(null)}
        onReload={() => reloadSectionMerged('current')}
        onRestore={() => restoreSectionDefaults('current')}
        onSave={(rows) => { setCurrentRows(rows); return saveSectionOverrides({ current: rows }); }}
      />
      <CreditModal
        open={openModal === 'credit'}
        rows={creditRows}
        onClose={() => setOpenModal(null)}
        onReload={() => reloadSectionMerged('credit')}
        onRestore={() => restoreSectionDefaults('credit')}
        onSave={(rows) => { setCreditRows(rows); return saveSectionOverrides({ credit: rows }); }}
      />
      <PerformanceModal
        open={openModal === 'performance'}
        mode={performanceMode}
        rows={performanceRows}
        editable={performanceEditable}
        onClose={() => setOpenModal(null)}
        onReload={() => reloadSectionMerged('performance')}
        onRestore={() => restoreSectionDefaults('performance')}
        onSave={(rows) => { setPerformanceRows(Array.isArray(rows) ? rows : []); return saveSectionOverrides({ performance: Array.isArray(rows) ? rows : [] }); }}
      />
      {showBizControls && (
        <BizYearsModal
          open={openModal === 'biz'}
          rows={bizRows}
          fallbackRows={bizDefaultRows}
          onClose={() => setOpenModal(null)}
          onReload={() => reloadSectionMerged('biz')}
          onRestore={() => restoreSectionDefaults('biz')}
          onSave={(rows) => {
            setBizRows(rows);
            setBizDefaultRows((rows || []).map((row) => ({ ...row })));
            return saveSectionOverrides({ biz: rows });
          }}
        />
      )}
      {showQualityControls && (
        <QualityModal
          open={openModal === 'quality'}
          rows={qualityRows}
          onClose={() => setOpenModal(null)}
          onReload={() => reloadSectionMerged('quality')}
          onRestore={() => restoreSectionDefaults('quality')}
          onSave={(rows) => { setQualityRows(rows); return saveSectionOverrides({ quality: rows }); }}
        />
      )}
      <AgreementsRulesModal open={rulesModalOpen} onClose={()=>setRulesModalOpen(false)} />
    </div>
  );
}
