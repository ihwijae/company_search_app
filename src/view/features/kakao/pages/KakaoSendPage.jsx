import React from 'react';
import '../../../../styles.css';
import '../../../../fonts.css';
import Sidebar from '../../../../components/Sidebar';
import { useFeedback } from '../../../../components/FeedbackProvider.jsx';
import Modal from '../../../../components/Modal.jsx';
import { extractManagerNames, getCandidateTextField } from '../../../../utils/companyIndicators.js';
import { loadPersisted, savePersisted } from '../../../../shared/persistence.js';

const MENU_ROUTES = {
  search: '#/search',
  agreements: '#/agreement-board',
  'region-search': '#/region-search',
  'agreements-sms': '#/agreements',
  'auto-agreement': '#/auto-agreement',
  records: '#/records',
  mail: '#/mail',
  'excel-helper': '#/excel-helper',
  'bid-result': '#/bid-result',
  'company-notes': '#/company-notes',
  settings: '#/settings',
  upload: '#/upload',
};

const TEAM_LEAD_BUCKET_ID = 'team-lead';
const TEAM_LEAD_EXCLUDE = ['윤명숙', '이동훈', '김희준', '김대열', '김기성', '박성균'];
const BIZ_FIELDS = ['사업자번호', 'bizNo', '사업자 번호'];
const NAME_FIELDS = ['업체명', '회사명', 'name', '검색된 회사'];
const REPRESENTATIVE_FIELDS = ['대표자', '대표자명'];
const REGION_FIELDS = ['대표지역', '지역'];
const FILE_TYPE_BADGE_LABELS = {
  eung: '전기',
  tongsin: '통신',
  sobang: '소방',
};

const COMPANY_NAME_FIELDS = [
  '검색된 회사',
  '검색된회사',
  '업체명',
  '회사명',
  '상호',
  '법인명',
  'companyName',
  'company',
  'name',
];
const KAKAO_UI_STORAGE_KEY = 'kakao-send:ui';

const normalizeCompanyName = (name) => {
  if (!name) return '';
  let normalized = String(name || '').replace(/\s+/g, '').toLowerCase();
  normalized = normalized.replace(/이앤/g, '이엔');
  normalized = normalized.replace(/앤/g, '엔');
  normalized = normalized.replace(/[^a-z0-9가-힣㈜\(\)]/g, '');
  return normalized;
};

const normalizeBizNumber = (value) => String(value || '').replace(/[^0-9]/g, '');

const pickFirstValue = (obj, fields) => {
  if (!obj || typeof obj !== 'object') return '';
  for (const key of fields) {
    if (obj[key]) return obj[key];
  }
  return '';
};

const buildCompanyOptionKey = (company) => {
  if (!company || typeof company !== 'object') return '';
  const typeToken = String(company?._file_type || '').trim().toLowerCase();
  const biz = normalizeBizNumber(pickFirstValue(company, BIZ_FIELDS));
  if (biz) return typeToken ? `${typeToken}|biz:${biz}` : `biz:${biz}`;
  const name = String(pickFirstValue(company, NAME_FIELDS) || '').trim();
  if (name) return typeToken ? `${typeToken}|name:${name}` : `name:${name}`;
  const fallback = String(company?.id || company?.rowIndex || company?.row || '');
  return fallback ? `${typeToken}|row:${fallback}` : typeToken || Math.random().toString(36).slice(2);
};

const buildNameVariants = (name) => {
  if (!name) return [];
  const base = String(name).trim();
  if (!base) return [];
  const variants = new Set([base]);
  const noSpace = base.replace(/\s+/g, '');
  if (noSpace) variants.add(noSpace);
  const swapToAen = base.replace(/이엔/g, '이앤');
  if (swapToAen !== base) variants.add(swapToAen);
  const swapToEn = base.replace(/이앤/g, '이엔');
  if (swapToEn !== base) variants.add(swapToEn);
  return Array.from(variants);
};

const extractCompanyNameFromLine = (line) => {
  if (!line) return '';
  let cleaned = String(line).replace(/\[.*?\]/g, '');
  cleaned = cleaned.replace(/\d+(?:\.\d+)?\s*%.*$/g, '');
  return cleaned.trim();
};

const normalizeManagerName = (name) => String(name || '').replace(/\s+/g, '').toLowerCase();

const getCandidateName = (candidate) => {
  const raw = getCandidateTextField(candidate, COMPANY_NAME_FIELDS);
  return String(raw || '').trim();
};

const getCandidateFileType = (candidate) => {
  const raw = candidate?._file_type || candidate?.file_type || candidate?.fileType || candidate?.snapshot?._file_type;
  if (!raw) return null;
  const text = String(raw).toLowerCase();
  if (text.includes('eung') || text.includes('전기')) return 'eung';
  if (text.includes('tongsin') || text.includes('통신')) return 'tongsin';
  if (text.includes('sobang') || text.includes('소방')) return 'sobang';
  return null;
};

const normalizeMessageText = (value) => String(value || '').replace(/\r\n/g, '\n').trim();

export default function KakaoSendPage() {
  const initialUiState = React.useMemo(() => {
    const stored = loadPersisted(KAKAO_UI_STORAGE_KEY, null);
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return null;
    return stored;
  }, []);
  const { notify, confirm } = useFeedback();
  const [draft, setDraft] = React.useState(() => String(initialUiState?.draft || ''));
  const [splitEntries, setSplitEntries] = React.useState(() => (
    Array.isArray(initialUiState?.splitEntries) ? initialUiState.splitEntries : []
  ));
  const [messageOverrides, setMessageOverrides] = React.useState(() => (
    initialUiState?.messageOverrides && typeof initialUiState.messageOverrides === 'object' && !Array.isArray(initialUiState.messageOverrides)
      ? initialUiState.messageOverrides
      : {}
  ));
  const [messageModal, setMessageModal] = React.useState({ open: false, entryId: null });
  const [messageDraft, setMessageDraft] = React.useState('');
  const [messageTemplate, setMessageTemplate] = React.useState('');
  const [industryFilter, setIndustryFilter] = React.useState(() => {
    const next = String(initialUiState?.industryFilter || '');
    return ['eung', 'tongsin', 'sobang'].includes(next) ? next : '';
  });
  const [companySearchKeyword, setCompanySearchKeyword] = React.useState('');
  const [selectedManagerId, setSelectedManagerId] = React.useState(() => String(initialUiState?.selectedManagerId || ''));
  const [companyConflictSelections, setCompanyConflictSelections] = React.useState({});
  const [companyConflictModal, setCompanyConflictModal] = React.useState({ open: false, entries: [], isResolving: false });
  const [pendingConflictPayload, setPendingConflictPayload] = React.useState(null);

  React.useEffect(() => {
    const payload = {
      version: 1,
      updatedAt: Date.now(),
      draft,
      splitEntries,
      messageOverrides,
      industryFilter,
      selectedManagerId,
    };
    savePersisted(KAKAO_UI_STORAGE_KEY, payload);
  }, [draft, splitEntries, messageOverrides, industryFilter, selectedManagerId]);

  const handleMenuSelect = React.useCallback((key) => {
    if (!key || key === 'kakao-send') return;
    const target = MENU_ROUTES[key];
    if (target) window.location.hash = target;
  }, []);

  const managerOptions = React.useMemo(() => {
    const order = [];
    const seen = new Set();
    (splitEntries || []).forEach((entry) => {
      if (!entry || entry.managerId === 'none' || entry.managerId === 'exclude') return;
      const label = String(entry.managerId || '').trim();
      if (!label || seen.has(label)) return;
      seen.add(label);
      order.push({ id: label, label });
    });
    return order;
  }, [splitEntries]);

  const managerBuckets = React.useMemo(() => {
    const map = new Map();
    const order = [];
    const blockMap = new Map();
    (splitEntries || []).forEach((entry) => {
      if (!entry) return;
      if (entry.managerId === 'exclude') return;
      const key = entry.managerId && entry.managerId !== 'exclude' ? entry.managerId : 'none';
      if (!map.has(key)) {
        const label = key === 'none' ? '없음' : String(key);
        map.set(key, { id: key, label, entries: [] });
        order.push(key);
      }
      map.get(key).entries.push(entry);
      const blockKey = String(entry.baseText || '').trim() || entry.id;
      if (!blockMap.has(blockKey)) {
        blockMap.set(blockKey, []);
      }
      blockMap.get(blockKey).push(entry);
    });
    const teamLeadEntries = [];
    blockMap.forEach((entries) => {
      const shouldInclude = entries.some((entry) => {
        if (entry.managerId === 'exclude') return false;
        if (entry.managerId === 'none') return true;
        const normalized = normalizeManagerName(entry.managerId);
        return !TEAM_LEAD_EXCLUDE.some((name) => normalizeManagerName(name) === normalized);
      });
      if (!shouldInclude) return;
      const overrideEntry = entries.find((entry) => messageOverrides[entry.id]);
      teamLeadEntries.push(overrideEntry || entries[0]);
    });
    if (teamLeadEntries.length > 0) {
      map.set(TEAM_LEAD_BUCKET_ID, { id: TEAM_LEAD_BUCKET_ID, label: '[팀장님]', entries: teamLeadEntries });
      order.push(TEAM_LEAD_BUCKET_ID);
    }
    return order.map((key) => map.get(key));
  }, [splitEntries, messageOverrides]);

  const filteredEntries = React.useMemo(() => {
    const keyword = String(companySearchKeyword || '').trim();
    if (!keyword) return splitEntries;
    const normalizedKeyword = normalizeCompanyName(keyword);
    return (splitEntries || []).filter((entry) => {
      const companyName = String(entry?.companyName || '').trim();
      const companyLine = String(entry?.company || '').trim();
      const normalizedName = normalizeCompanyName(companyName);
      const normalizedLine = normalizeCompanyName(companyLine);
      return normalizedName.includes(normalizedKeyword) || normalizedLine.includes(normalizedKeyword);
    });
  }, [splitEntries, companySearchKeyword]);

  React.useEffect(() => {
    if (managerBuckets.length === 0) {
      setSelectedManagerId('');
      return;
    }
    if (!managerBuckets.find((bucket) => bucket.id === selectedManagerId)) {
      setSelectedManagerId(managerBuckets[0].id);
    }
  }, [managerBuckets, selectedManagerId]);

  const autoMatchManagers = async (entries, overrideFileType, selections = {}) => {
    if (!window?.electronAPI?.searchManyCompanies) return { entries, conflictEntries: [] };
    const nameSet = new Set();
    entries.forEach((entry) => {
      if (!entry.companyName) return;
      buildNameVariants(entry.companyName).forEach((variant) => nameSet.add(variant));
    });
    if (nameSet.size === 0) return { entries, conflictEntries: [] };
    console.log('[kakao-auto-match] query names:', Array.from(nameSet));
    const searchFileType = overrideFileType || 'all';
    console.log('[kakao-auto-match] fileType:', searchFileType);
    const response = await window.electronAPI.searchManyCompanies(Array.from(nameSet), searchFileType);
    if (!response?.success) {
      notify({ type: 'warning', message: '업체 담당자 자동 매칭에 실패했습니다.' });
      return { entries, conflictEntries: [] };
    }
    const candidates = Array.isArray(response.data) ? response.data : [];
    console.log('[kakao-auto-match] candidates:', candidates.length);
    const map = new Map();
    candidates.forEach((candidate) => {
      const name = getCandidateName(candidate);
      const normalized = normalizeCompanyName(name);
      if (!normalized) return;
      if (!map.has(normalized)) map.set(normalized, []);
      map.get(normalized).push(candidate);
    });
    console.log('[kakao-auto-match] mapped names:', Array.from(map.keys()));
    const conflictMap = new Map();
    const nextEntries = entries.map((entry) => {
      const normalizedName = normalizeCompanyName(entry.companyName);
      let list = map.get(normalizedName) || [];
      if (list.length === 0) {
        const variants = buildNameVariants(entry.companyName).map((variant) => normalizeCompanyName(variant));
        for (const variantKey of variants) {
          const fallback = map.get(variantKey);
          if (fallback && fallback.length > 0) {
            list = fallback;
            break;
          }
        }
      }
      console.log('[kakao-auto-match] match for', entry.companyName, '->', list.length);
      if (list.length > 0) {
        console.log('[kakao-auto-match] candidates for', entry.companyName, list);
      }
      const targetType = overrideFileType || entry.fileType;
      const filtered = targetType
        ? list.filter((candidate) => getCandidateFileType(candidate) === targetType)
        : list;
      const pool = filtered.length > 0 ? filtered : list;
      if (pool.length > 1 && normalizedName) {
        const savedKey = selections?.[normalizedName];
        const picked = savedKey
          ? pool.find((candidate) => buildCompanyOptionKey(candidate) === savedKey)
          : null;
        if (!picked) {
          if (!conflictMap.has(normalizedName)) {
            conflictMap.set(normalizedName, {
              normalizedName,
              displayName: entry.companyName || entry.company || normalizedName,
              options: pool,
            });
          }
          return entry;
        }
        const managers = extractManagerNames(picked);
        const matchedId = managers.length > 0 ? (String(managers[0] || '').trim() || 'none') : 'none';
        console.log('[kakao-auto-match] manager result:', entry.companyName, matchedId);
        return matchedId === 'none' ? entry : { ...entry, managerId: matchedId };
      }
      let matchedId = 'none';
      for (const candidate of pool) {
        const managers = extractManagerNames(candidate);
        if (managers.length > 0) {
          matchedId = String(managers[0] || '').trim() || 'none';
          break;
        }
      }
      console.log('[kakao-auto-match] manager result:', entry.companyName, matchedId);
      return matchedId === 'none' ? entry : { ...entry, managerId: matchedId };
    });
    return {
      entries: nextEntries,
      conflictEntries: Array.from(conflictMap.values()),
    };
  };

  const handleCompanyConflictPick = (normalizedName, option) => {
    const key = buildCompanyOptionKey(option);
    setCompanyConflictSelections((prev) => ({ ...prev, [normalizedName]: key }));
  };

  const handleCompanyConflictCancel = () => {
    setCompanyConflictModal({ open: false, entries: [], isResolving: false });
    setPendingConflictPayload(null);
  };

  const handleCompanyConflictConfirm = async () => {
    if (!pendingConflictPayload?.entries) {
      handleCompanyConflictCancel();
      return;
    }
    const unresolved = (companyConflictModal.entries || []).filter((entry) => {
      const savedKey = companyConflictSelections?.[entry.normalizedName];
      if (!savedKey) return true;
      return !entry.options.some((candidate) => buildCompanyOptionKey(candidate) === savedKey);
    });
    if (unresolved.length > 0) {
      notify({ type: 'info', message: '중복된 업체가 있습니다. 모든 항목을 선택해 주세요.' });
      return;
    }
    setCompanyConflictModal((prev) => ({ ...prev, isResolving: true }));
    try {
      const result = await autoMatchManagers(
        pendingConflictPayload.entries,
        pendingConflictPayload.overrideFileType,
        companyConflictSelections
      );
      if (result.conflictEntries.length > 0) {
        setCompanyConflictModal({ open: true, entries: result.conflictEntries, isResolving: false });
        return;
      }
      setSplitEntries(result.entries);
      const matchedCount = result.entries.filter((entry) => entry.managerId !== 'none').length;
      notify({
        type: 'success',
        message: pendingConflictPayload.mode === 'split'
          ? `총 ${result.entries.length}개 업체로 분리되었습니다. 담당자 매칭 ${matchedCount}건.`
          : `담당자 매칭 ${matchedCount}건 완료.`,
      });
      handleCompanyConflictCancel();
    } catch {
      notify({ type: 'warning', message: '업체 담당자 자동 매칭에 실패했습니다.' });
      setCompanyConflictModal((prev) => ({ ...prev, isResolving: false }));
    }
  };

  const ensureIndustrySelected = React.useCallback(() => {
    if (industryFilter) return true;
    confirm({
      title: '공종 선택 필요',
      message: '문자 분리 전에 공종을 먼저 선택해 주세요.',
      confirmText: '확인',
      cancelText: '닫기',
      tone: 'info',
    });
    return false;
  }, [confirm, industryFilter]);

  const handleSplitMessages = async () => {
    if (!ensureIndustrySelected()) return;
    const blocks = String(draft || '')
      .split(/-{5,}/)
      .map((block) => block.trim())
      .filter(Boolean);
    const entries = [];
    blocks.forEach((block, blockIndex) => {
      const fileType = industryFilter;
      const lines = block
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      const companyLines = lines.filter((line) => line.includes('%'));
      if (companyLines.length === 0) {
          entries.push({
            id: `${blockIndex}-0`,
            company: `협정안 ${blockIndex + 1}`,
            companyName: '',
            managerId: 'none',
            baseText: block,
            fileType,
          });
      } else {
        companyLines.forEach((line, lineIndex) => {
          entries.push({
            id: `${blockIndex}-${lineIndex}`,
            company: line,
            companyName: extractCompanyNameFromLine(line),
            managerId: 'none',
            baseText: block,
            fileType,
          });
        });
      }
    });
    if (entries.length === 0) {
      setSplitEntries([]);
      notify({ type: 'info', message: '분리할 협정문자가 없습니다.' });
      return;
    }
    notify({ type: 'info', message: '업체 담당자를 자동 매칭 중입니다.' });
    const result = await autoMatchManagers(entries, industryFilter, companyConflictSelections);
    if (result.conflictEntries.length > 0) {
      setPendingConflictPayload({ mode: 'split', entries, overrideFileType: industryFilter });
      setCompanyConflictModal({ open: true, entries: result.conflictEntries, isResolving: false });
      notify({ type: 'info', message: '동일 업체명이 여러 건 조회되어 선택이 필요합니다.' });
      return;
    }
    setSplitEntries(result.entries);
    const matchedCount = result.entries.filter((entry) => entry.managerId !== 'none').length;
    notify({
      type: 'success',
      message: `총 ${result.entries.length}개 업체로 분리되었습니다. 담당자 매칭 ${matchedCount}건.`,
    });
  };

  const handleClearDraft = () => {
    setDraft('');
    setSplitEntries([]);
    notify({ type: 'info', message: '협정문자가 초기화되었습니다.' });
  };

  const handleAutoMatchClick = async () => {
    if (!ensureIndustrySelected()) return;
    if (splitEntries.length === 0) {
      notify({ type: 'info', message: '먼저 협정문자를 분리해 주세요.' });
      return;
    }
    notify({ type: 'info', message: '업체 담당자를 자동 매칭 중입니다.' });
    const result = await autoMatchManagers(splitEntries, industryFilter, companyConflictSelections);
    if (result.conflictEntries.length > 0) {
      setPendingConflictPayload({ mode: 'rematch', entries: splitEntries, overrideFileType: industryFilter });
      setCompanyConflictModal({ open: true, entries: result.conflictEntries, isResolving: false });
      notify({ type: 'info', message: '동일 업체명이 여러 건 조회되어 선택이 필요합니다.' });
      return;
    }
    setSplitEntries(result.entries);
    const matchedCount = result.entries.filter((entry) => entry.managerId !== 'none').length;
    notify({
      type: 'success',
      message: `담당자 매칭 ${matchedCount}건 완료.`,
    });
  };


  const handleEntryManagerChange = (entryId, value) => {
    setSplitEntries((prev) =>
      prev.map((entry) => (entry.id === entryId ? { ...entry, managerId: value } : entry))
    );
  };

  const handleRemoveEntry = (entryId) => {
    setSplitEntries((prev) => prev.filter((entry) => entry.id !== entryId));
    setMessageOverrides((prev) => {
      if (!prev[entryId]) return prev;
      const next = { ...prev };
      delete next[entryId];
      return next;
    });
    notify({ type: 'info', message: '해당 업체를 목록에서 제거했습니다.' });
  };

  const getEffectiveOverride = React.useCallback((entryId) => {
    const entry = splitEntries.find((item) => item.id === entryId);
    if (!entry) return '';
    const override = messageOverrides[entryId];
    if (override === null || override === undefined) return '';
    return normalizeMessageText(override) === normalizeMessageText(entry.baseText) ? '' : String(override);
  }, [messageOverrides, splitEntries]);

  React.useEffect(() => {
    setMessageOverrides((prev) => {
      const next = { ...prev };
      let changed = false;
      Object.keys(next).forEach((entryId) => {
        const entry = splitEntries.find((item) => item.id === entryId);
        if (!entry) {
          delete next[entryId];
          changed = true;
          return;
        }
        if (normalizeMessageText(next[entryId]) === normalizeMessageText(entry.baseText)) {
          delete next[entryId];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [splitEntries]);

  const openMessageModal = (entryId) => {
    const entry = splitEntries.find((item) => item.id === entryId);
    if (!entry) return;
    const existing = getEffectiveOverride(entryId);
    setMessageDraft(existing ?? entry.baseText ?? '');
    setMessageTemplate('');
    setMessageModal({ open: true, entryId });
  };

  const closeMessageModal = () => {
    setMessageModal({ open: false, entryId: null });
    setMessageDraft('');
    setMessageTemplate('');
  };

  const handleSaveMessageOverride = () => {
    if (!messageModal.entryId) return;
    const entry = splitEntries.find((item) => item.id === messageModal.entryId);
    const baseText = entry?.baseText || '';
    setMessageOverrides((prev) => ({
      ...(() => {
        const next = { ...prev };
        if (normalizeMessageText(messageDraft) === normalizeMessageText(baseText)) {
          delete next[messageModal.entryId];
        } else {
          next[messageModal.entryId] = messageDraft;
        }
        return next;
      })(),
    }));
    notify({ type: 'success', message: '담당자별 메시지가 저장되었습니다.' });
    closeMessageModal();
  };

  const handleResetMessageOverride = () => {
    if (!messageModal.entryId) return;
    setMessageOverrides((prev) => {
      const next = { ...prev };
      delete next[messageModal.entryId];
      return next;
    });
    const entry = splitEntries.find((item) => item.id === messageModal.entryId);
    setMessageDraft(entry?.baseText || '');
    setMessageTemplate('');
    notify({ type: 'info', message: '기본 메시지로 되돌렸습니다.' });
  };

  const handleCopyManagerMessages = async (text) => {
    if (!text) {
      notify({ type: 'info', message: '복사할 메시지가 없습니다.' });
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      notify({ type: 'success', message: '담당자별 메시지를 복사했습니다.' });
    } catch {
      notify({ type: 'warning', message: '복사에 실패했습니다. 텍스트를 직접 선택해 주세요.' });
    }
  };

  const handleTemplateChange = (value) => {
    if (!messageModal.entryId) return;
    const entry = splitEntries.find((item) => item.id === messageModal.entryId);
    const baseText = entry?.baseText || '';
    const normalizedBase = baseText.replace(/^\[(협정 정정|협정 취소)\]\s*\n?/, '').trim();
    if (!value) {
      setMessageDraft(baseText);
      setMessageTemplate('');
      return;
    }
    if (value === 'fix') {
      setMessageDraft(`[협정 정정]\n${normalizedBase}`);
      setMessageTemplate(value);
      return;
    }
    if (value === 'cancel') {
      const stripped = normalizedBase.replace(/협정\s*부탁드립니다\.?/g, '협정 취소 부탁드립니다.');
      const finalText = stripped.includes('협정 취소 부탁드립니다.')
        ? stripped
        : `${stripped}\n\n협정 취소 부탁드립니다.`;
      setMessageDraft(`[협정 취소]\n${finalText}\n\n사유: `);
      setMessageTemplate(value);
      return;
    }
    setMessageTemplate(value);
  };

  return (
    <div className="app-shell">
      <Sidebar active="kakao-send" onSelect={handleMenuSelect} collapsed={true} />
      <div className="main">
        <div className="title-drag" />
        <div className="topbar" />
        <div className="stage">
          <div className="content">
            <div className="panel" style={{ gridColumn: '1 / -1' }}>
              <h1 className="main-title" style={{ marginTop: 0 }}>카카오톡 전송</h1>
              <p className="subtext" style={{ marginBottom: '18px' }}>
                협정문자를 건별로 분리하고 담당자를 자동 매칭합니다. 전송은 수동으로 진행하세요.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.9fr) minmax(0, 1.1fr)', gap: '16px' }}>
                <div className="panel" style={{ background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '12px', minHeight: 0, overflow: 'hidden' }}>
                  <h2 className="section-title" style={{ marginTop: 0 }}>협정문자 입력</h2>
                  <textarea
                    className="filter-input"
                    style={{ width: '100%', minHeight: '240px', resize: 'vertical' }}
                    placeholder="협정문자를 붙여넣어 주세요."
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                  />
                  <div className="filter-item" style={{ maxWidth: '160px' }}>
                    <label>공종 선택</label>
                    <select
                      className="filter-input"
                      value={industryFilter}
                      onChange={(event) => setIndustryFilter(event.target.value)}
                    >
                      <option value="">선택</option>
                      <option value="eung">전기</option>
                      <option value="tongsin">통신</option>
                      <option value="sobang">소방</option>
                    </select>
                  </div>
                  <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button className="primary" type="button" onClick={handleSplitMessages}>문자 분리</button>
                    <button className="secondary" type="button" onClick={handleClearDraft}>입력 초기화</button>
                  </div>
                </div>
                <div className="panel" style={{ background: '#f8fafc' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <h2 className="section-title" style={{ marginTop: 0 }}>업체별 담당자 목록</h2>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        className="filter-input"
                        style={{ minWidth: '180px' }}
                        type="text"
                        placeholder="업체명 검색"
                        value={companySearchKeyword}
                        onChange={(event) => setCompanySearchKeyword(event.target.value)}
                      />
                      <button className="secondary" type="button" onClick={handleAutoMatchClick}>담당자 자동매칭</button>
                    </div>
                  </div>
                  <div className="table-wrap" style={{ maxHeight: '320px' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th style={{ width: '70px' }}>순번</th>
                          <th>업체명</th>
                          <th style={{ width: '160px' }}>담당자</th>
                          <th style={{ width: '140px' }}>메시지</th>
                          <th style={{ width: '90px' }}>제거</th>
                        </tr>
                      </thead>
                      <tbody>
                        {splitEntries.length === 0 ? (
                          <tr>
                            <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                              문자 분리 후 담당자 목록이 표시됩니다.
                            </td>
                          </tr>
                        ) : filteredEntries.length === 0 ? (
                          <tr>
                            <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                              검색 결과가 없습니다.
                            </td>
                          </tr>
                        ) : (
                          filteredEntries.map((entry, index) => (
                            <tr key={entry.id}>
                              <td>{index + 1}</td>
                              <td>{entry.company}</td>
                              <td>
                                <select
                                  className="filter-input"
                                  value={entry.managerId}
                                  onChange={(event) => handleEntryManagerChange(entry.id, event.target.value)}
                                >
                                  <option value="none">없음</option>
                                  <option value="exclude">제외</option>
                                  {managerOptions.map((option) => (
                                    <option key={option.id} value={option.id}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  className={getEffectiveOverride(entry.id) ? 'kakao-override-btn' : 'secondary'}
                                  type="button"
                                  onClick={() => openMessageModal(entry.id)}
                                >
                                  {getEffectiveOverride(entry.id) ? '수정됨' : '기본'}
                                </button>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <button className="secondary" type="button" onClick={() => handleRemoveEntry(entry.id)}>
                                  제거
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ marginTop: '4px' }}>
                    <span style={{ color: '#64748b', fontSize: '14px', fontWeight: 700 }}>
                      자동 전송 기능은 제거되었습니다. 카카오톡에서 수동으로 전송해 주세요.
                    </span>
                  </div>
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '12px', minHeight: 0 }}>
                    <h3 className="section-title" style={{ margin: 0 }}>담당자별 전송 묶음</h3>
                    {managerBuckets.length === 0 ? (
                      <p className="subtext" style={{ margin: 0 }}>
                        담당자 매칭 후 담당자별 전송 묶음이 표시됩니다.
                      </p>
                    ) : (
                      <>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {managerBuckets.map((bucket) => (
                            <button
                              key={bucket.id}
                              className={bucket.id === selectedManagerId ? 'primary' : 'secondary'}
                              type="button"
                              onClick={() => setSelectedManagerId(bucket.id)}
                            >
                              {bucket.label} ({bucket.entries.length})
                            </button>
                          ))}
                        </div>
                        {managerBuckets.filter((bucket) => bucket.id === selectedManagerId).map((bucket) => {
                          const combinedText = bucket.entries
                            .map((entry) => getEffectiveOverride(entry.id) || entry.baseText)
                            .filter(Boolean)
                            .join('\n\n---------------------\n\n');
                          return (
                            <div key={bucket.id} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                                <span style={{ fontWeight: 700, color: '#1f2937' }}>{bucket.label} 전송 목록</span>
                                <button
                                  className="secondary"
                                  type="button"
                                  onClick={() => handleCopyManagerMessages(combinedText)}
                                >
                                  전체 복사
                                </button>
                              </div>
                              <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', background: '#ffffff', padding: '10px', maxHeight: '360px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {bucket.entries.map((entry, index) => {
                                  const overrideText = getEffectiveOverride(entry.id);
                                  const isOverride = Boolean(overrideText);
                                  const entryText = (overrideText || entry.baseText || '').trim();
                                  return (
                                    <div key={entry.id} style={{ border: '1px solid #e5e7eb', borderRadius: '10px', padding: '10px', background: '#fdfdfd', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                      <pre
                                        className={isOverride ? 'kakao-override-text' : undefined}
                                        style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '13px' }}
                                      >
                                        {entryText || '(비어있음)'}
                                      </pre>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>{index + 1} / {bucket.entries.length}</span>
                                        <button
                                          className="secondary"
                                          type="button"
                                          onClick={() => handleCopyManagerMessages(entryText)}
                                        >
                                          복사
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              <p className="subtext" style={{ margin: 0 }}>
                                메시지는 \"-------------\" 구분선으로 나뉘어 표시됩니다.
                              </p>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Modal
        open={messageModal.open}
        onClose={closeMessageModal}
        onCancel={closeMessageModal}
        onSave={handleSaveMessageOverride}
        title="담당자별 메시지 편집"
        confirmLabel="저장"
        cancelLabel="닫기"
        size="lg"
        disableBackdropClose={false}
        disableEscClose={false}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '4px 4px 0' }}>
          <div className="filter-item">
            <label>템플릿 선택</label>
            <select
              className="filter-input"
              value={messageTemplate}
              onChange={(event) => handleTemplateChange(event.target.value)}
            >
              <option value="">직접 입력</option>
              <option value="fix">[협정 정정] 템플릿</option>
              <option value="cancel">[협정 취소] 템플릿</option>
            </select>
          </div>
          <div className="filter-item">
            <label>기본 메시지</label>
            <textarea
              className="filter-input"
              style={{ width: '100%', minHeight: '140px', resize: 'vertical', background: '#f8fafc' }}
              value={splitEntries.find((item) => item.id === messageModal.entryId)?.baseText || ''}
              readOnly
            />
          </div>
          <div className="filter-item">
            <label>담당자 전용 메시지</label>
            <textarea
              className="filter-input"
              style={{ width: '100%', minHeight: '180px', resize: 'vertical' }}
              value={messageDraft}
              onChange={(event) => setMessageDraft(event.target.value)}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button className="secondary" type="button" onClick={handleResetMessageOverride}>
              기본으로 되돌리기
            </button>
            <span style={{ color: '#94a3b8', fontSize: '12px' }}>전송 시 담당자 전용 메시지가 우선 적용됩니다.</span>
          </div>
        </div>
      </Modal>
      {companyConflictModal.open && (
        <div className="excel-helper-modal-overlay" role="presentation">
          <div className="excel-helper-modal" role="dialog" aria-modal="true">
            <header className="excel-helper-modal__header">
              <h3>중복된 업체 선택</h3>
              <p>동일한 이름의 업체가 여러 건 조회되었습니다. 각 업체에 맞는 자료를 선택해 주세요.</p>
            </header>
            <div className="excel-helper-modal__body">
              {(companyConflictModal.entries || []).map((entry) => (
                <div key={entry.normalizedName} className="excel-helper-modal__conflict">
                  <div className="excel-helper-modal__conflict-title">{entry.displayName}</div>
                  <div className="excel-helper-modal__options">
                    {entry.options.map((option) => {
                      const optionKey = buildCompanyOptionKey(option);
                      const selectedKey = companyConflictSelections?.[entry.normalizedName];
                      const isActive = selectedKey === optionKey;
                      const bizNo = pickFirstValue(option, BIZ_FIELDS) || '-';
                      const representative = pickFirstValue(option, REPRESENTATIVE_FIELDS) || '-';
                      const region = pickFirstValue(option, REGION_FIELDS) || '-';
                      const typeKey = String(option?._file_type || '').toLowerCase();
                      const typeLabel = FILE_TYPE_BADGE_LABELS[typeKey] || '';
                      const managers = extractManagerNames(option);
                      return (
                        <button
                          key={optionKey}
                          type="button"
                          className={isActive ? 'excel-helper-modal__option active' : 'excel-helper-modal__option'}
                          onClick={() => handleCompanyConflictPick(entry.normalizedName, option)}
                        >
                          <div className="excel-helper-modal__option-name">
                            {pickFirstValue(option, NAME_FIELDS) || entry.displayName}
                            {typeLabel && <span className={`file-type-badge-small file-type-${typeKey}`}>{typeLabel}</span>}
                          </div>
                          <div className="excel-helper-modal__option-meta">사업자번호 {bizNo}</div>
                          <div className="excel-helper-modal__option-meta">대표자 {representative} · 지역 {region}</div>
                          {managers.length > 0 && (
                            <div className="excel-helper-modal__option-managers">
                              {managers.map((manager) => (
                                <span key={`${optionKey}-${manager}`} className="badge-person">{manager}</span>
                              ))}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <footer className="excel-helper-modal__footer">
              <button type="button" className="btn-soft" onClick={handleCompanyConflictCancel} disabled={companyConflictModal.isResolving}>취소</button>
              <button
                type="button"
                className="primary"
                onClick={handleCompanyConflictConfirm}
                disabled={companyConflictModal.isResolving}
              >
                {companyConflictModal.isResolving ? '처리 중...' : '선택 완료'}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
