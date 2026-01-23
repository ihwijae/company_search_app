import React from 'react';
import '../../../../styles.css';
import '../../../../fonts.css';
import Sidebar from '../../../../components/Sidebar';
import Modal from '../../../../components/Modal.jsx';
import { useFeedback } from '../../../../components/FeedbackProvider.jsx';
import { extractManagerNames, getCandidateTextField } from '../../../../utils/companyIndicators.js';

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
  settings: '#/settings',
  upload: '#/upload',
};

const ROOM_SETTINGS_KEY = 'kakaoRoomSettings';
const DEFAULT_ROOM_ROWS = [{ id: 1, manager: '', room: '' }];

const COMPANY_NAME_FIELDS = ['업체명', '회사명', '상호', '법인명', 'companyName', 'company', 'name'];
const FILE_TYPE_LABELS = [
  { key: 'eung', match: /전기/ },
  { key: 'tongsin', match: /통신/ },
  { key: 'sobang', match: /소방/ },
];

const normalizeCompanyName = (name) => {
  if (!name) return '';
  let normalized = String(name || '').replace(/\s+/g, '').toLowerCase();
  normalized = normalized.replace(/^(주|\(주\)|㈜|주\)|\(합\))/, '');
  normalized = normalized.replace(/(주|\(주\)|㈜|주\)|\(합\))$/, '');
  normalized = normalized.replace(/이앤/g, '이엔');
  normalized = normalized.replace(/앤/g, '엔');
  normalized = normalized.replace(/[^a-z0-9가-힣]/g, '');
  return normalized;
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

const detectFileTypeFromBlock = (blockText) => {
  const text = String(blockText || '');
  const match = FILE_TYPE_LABELS.find((item) => item.match.test(text));
  return match ? match.key : null;
};

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

export default function KakaoSendPage() {
  const { notify } = useFeedback();
  const [draft, setDraft] = React.useState('');
  const [splitEntries, setSplitEntries] = React.useState([]);
  const [roomModalOpen, setRoomModalOpen] = React.useState(false);
  const [roomSettings, setRoomSettings] = React.useState(DEFAULT_ROOM_ROWS);
  const [messageOverrides, setMessageOverrides] = React.useState({});
  const [messageModal, setMessageModal] = React.useState({ open: false, entryId: null });
  const [messageDraft, setMessageDraft] = React.useState('');
  const [messageTemplate, setMessageTemplate] = React.useState('');
  const [industryFilter, setIndustryFilter] = React.useState('auto');

  const handleMenuSelect = React.useCallback((key) => {
    if (!key || key === 'kakao-send') return;
    const target = MENU_ROUTES[key];
    if (target) window.location.hash = target;
  }, []);

  React.useEffect(() => {
    try {
      if (window?.electronAPI?.stateLoadSync) {
        const saved = window.electronAPI.stateLoadSync(ROOM_SETTINGS_KEY);
        if (saved && !saved.__companySearchStateMissing && Array.isArray(saved) && saved.length > 0) {
          setRoomSettings(saved);
        }
        return;
      }
      const saved = window.localStorage.getItem(ROOM_SETTINGS_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setRoomSettings(parsed);
      }
    } catch {}
  }, []);

  const managerOptions = React.useMemo(() => {
    return (roomSettings || [])
      .map((row) => ({
        id: row.id,
        label: String(row.manager || '').trim(),
        room: String(row.room || '').trim(),
      }))
      .filter((row) => row.label);
  }, [roomSettings]);

  const autoMatchManagers = async (entries, overrideFileType) => {
    if (!window?.electronAPI?.searchManyCompanies) return entries;
    const availableManagers = managerOptions.map((item) => ({
      id: item.id,
      label: String(item.label || '').trim(),
      normalized: String(item.label || '').replace(/\s+/g, '').toLowerCase(),
    }));
    if (availableManagers.length === 0) return entries;
    const nameSet = new Set();
    entries.forEach((entry) => {
      if (!entry.companyName) return;
      buildNameVariants(entry.companyName).forEach((variant) => nameSet.add(variant));
    });
    if (nameSet.size === 0) return entries;
    console.log('[kakao-auto-match] query names:', Array.from(nameSet));
    const searchFileType = overrideFileType && overrideFileType !== 'auto' ? overrideFileType : 'all';
    console.log('[kakao-auto-match] fileType:', searchFileType);
    const response = await window.electronAPI.searchManyCompanies(Array.from(nameSet), searchFileType);
    if (!response?.success) {
      notify({ type: 'warning', message: '업체 담당자 자동 매칭에 실패했습니다.' });
      return entries;
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
    const nextEntries = entries.map(entry => {
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
      const targetType = overrideFileType && overrideFileType !== 'auto' ? overrideFileType : entry.fileType;
      const filtered = targetType
        ? list.filter((candidate) => getCandidateFileType(candidate) === targetType)
        : list;
      const pool = filtered.length > 0 ? filtered : list;
      let matchedId = 'none';
      for (const candidate of pool) {
        const managers = extractManagerNames(candidate);
        for (const manager of managers) {
          const normalizedManager = String(manager || '').replace(/\s+/g, '').toLowerCase();
          const option = availableManagers.find((item) => item.normalized === normalizedManager);
          if (option) {
            matchedId = option.id;
            break;
          }
        }
        if (matchedId !== 'none') break;
      }
      console.log('[kakao-auto-match] manager result:', entry.companyName, matchedId);
      return matchedId === 'none' ? entry : { ...entry, managerId: matchedId };
    });
    return nextEntries;
  };

  const handleSplitMessages = async () => {
    const blocks = String(draft || '')
      .split(/-{5,}/)
      .map((block) => block.trim())
      .filter(Boolean);
    const entries = [];
    blocks.forEach((block, blockIndex) => {
      const fileType = industryFilter === 'auto' ? detectFileTypeFromBlock(block) : industryFilter;
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
    const matchedEntries = await autoMatchManagers(entries, industryFilter);
    setSplitEntries(matchedEntries);
    const matchedCount = matchedEntries.filter((entry) => entry.managerId !== 'none').length;
    notify({
      type: 'success',
      message: `총 ${matchedEntries.length}개 업체로 분리되었습니다. 담당자 매칭 ${matchedCount}건.`,
    });
  };

  const handleClearDraft = () => {
    setDraft('');
    setSplitEntries([]);
    notify({ type: 'info', message: '협정문자가 초기화되었습니다.' });
  };

  const handleAutoMatchClick = async () => {
    if (splitEntries.length === 0) {
      notify({ type: 'info', message: '먼저 협정문자를 분리해 주세요.' });
      return;
    }
    notify({ type: 'info', message: '업체 담당자를 자동 매칭 중입니다.' });
    const matchedEntries = await autoMatchManagers(splitEntries, industryFilter);
    setSplitEntries(matchedEntries);
    const matchedCount = matchedEntries.filter((entry) => entry.managerId !== 'none').length;
    notify({
      type: 'success',
      message: `담당자 매칭 ${matchedCount}건 완료.`,
    });
  };

  const handleRoomSettingChange = (id, field, value) => {
    setRoomSettings((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  const handleAddRoomRow = () => {
    setRoomSettings((prev) => [
      ...prev,
      { id: Date.now(), manager: '', room: '' },
    ]);
  };

  const handleSaveRoomSettings = async () => {
    const normalized = (roomSettings || [])
      .map((row) => ({
        id: row.id || Date.now(),
        manager: String(row.manager || '').trim(),
        room: String(row.room || '').trim(),
      }))
      .filter((row) => row.manager || row.room);
    const nextRows = normalized.length > 0 ? normalized : DEFAULT_ROOM_ROWS;
    setRoomSettings(nextRows);
    try {
      if (window?.electronAPI?.stateSave) {
        await window.electronAPI.stateSave(ROOM_SETTINGS_KEY, nextRows);
      } else {
        window.localStorage.setItem(ROOM_SETTINGS_KEY, JSON.stringify(nextRows));
      }
      notify({ type: 'success', message: '담당자 카톡방 설정이 저장되었습니다.' });
    } catch {}
    setRoomModalOpen(false);
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

  const openMessageModal = (entryId) => {
    const entry = splitEntries.find((item) => item.id === entryId);
    if (!entry) return;
    const existing = messageOverrides[entryId];
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
    setMessageOverrides((prev) => ({
      ...prev,
      [messageModal.entryId]: messageDraft,
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
                협정문자를 입력하면 건별로 분리하고, 업체 담당자에게 전송할 수 있도록 준비 중입니다.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.9fr) minmax(0, 1.1fr)', gap: '16px' }}>
                <div className="panel" style={{ background: '#f8fafc' }}>
                  <h2 className="section-title" style={{ marginTop: 0 }}>협정문자 입력</h2>
                  <textarea
                    className="filter-input"
                    style={{ width: '100%', minHeight: '240px', resize: 'vertical' }}
                    placeholder="협정문자를 붙여넣어 주세요."
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                  />
                  <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button className="primary" type="button" onClick={handleSplitMessages}>문자 분리</button>
                    <button className="secondary" type="button" onClick={handleClearDraft}>입력 초기화</button>
                  </div>
                </div>
                <div className="panel" style={{ background: '#f8fafc' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <h2 className="section-title" style={{ marginTop: 0 }}>업체별 담당자 목록</h2>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <select
                        className="filter-input"
                        value={industryFilter}
                        onChange={(event) => setIndustryFilter(event.target.value)}
                        style={{ minWidth: '120px' }}
                      >
                        <option value="auto">공종 자동</option>
                        <option value="eung">전기</option>
                        <option value="tongsin">통신</option>
                        <option value="sobang">소방</option>
                      </select>
                      <button className="secondary" type="button" onClick={handleAutoMatchClick}>담당자 자동매칭</button>
                      <button className="secondary" type="button" onClick={() => setRoomModalOpen(true)}>담당자 카톡방 설정</button>
                    </div>
                  </div>
                  <div className="table-wrap" style={{ maxHeight: '320px' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th style={{ width: '70px' }}>순번</th>
                          <th>업체명</th>
                          <th style={{ width: '160px' }}>담당자</th>
                          <th style={{ width: '180px' }}>채팅방</th>
                          <th style={{ width: '140px' }}>메시지</th>
                          <th style={{ width: '90px' }}>제거</th>
                        </tr>
                      </thead>
                      <tbody>
                        {splitEntries.length === 0 ? (
                          <tr>
                            <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                              문자 분리 후 담당자 목록이 표시됩니다.
                            </td>
                          </tr>
                        ) : (
                          splitEntries.map((entry, index) => (
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
                              <td>
                                {entry.managerId === 'exclude' || entry.managerId === 'none' ? (
                                  <span style={{ color: '#94a3b8' }}>-</span>
                                ) : (
                                  <span className="chip" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                    {managerOptions.find((row) => String(row.id) === String(entry.managerId))?.room || '채팅방 미지정'}
                                  </span>
                                )}
                              </td>
                              <td>
                                <button className="secondary" type="button" onClick={() => openMessageModal(entry.id)}>
                                  {messageOverrides[entry.id] ? '수정됨' : '기본'}
                                </button>
                              </td>
                              <td>
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
                  <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button className="primary" type="button">카카오톡 전송</button>
                    <button className="secondary" type="button">전송 로그 확인</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Modal
        open={roomModalOpen}
        onClose={() => setRoomModalOpen(false)}
        onCancel={() => setRoomModalOpen(false)}
        onSave={handleSaveRoomSettings}
        title="담당자 카톡방 설정"
        confirmLabel="저장"
        cancelLabel="닫기"
        size="md"
        disableBackdropClose={false}
        disableEscClose={false}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '4px 4px 0' }}>
          <p className="subtext" style={{ margin: 0 }}>
            담당자별 카카오톡 채팅방 이름을 설정하세요.
          </p>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '120px' }}>담당자</th>
                  <th>채팅방 이름</th>
                </tr>
              </thead>
              <tbody>
                {roomSettings.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <input
                        className="filter-input"
                        placeholder="담당자 이름"
                        value={row.manager}
                        onChange={(event) => handleRoomSettingChange(row.id, 'manager', event.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className="filter-input"
                        placeholder="채팅방 이름"
                        value={row.room}
                        onChange={(event) => handleRoomSettingChange(row.id, 'room', event.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="secondary" type="button" onClick={handleAddRoomRow}>행 추가</button>
          </div>
        </div>
      </Modal>
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
    </div>
  );
}
