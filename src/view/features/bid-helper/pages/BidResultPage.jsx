import React from 'react';
import '../../../../styles.css';
import '../../../../fonts.css';
import Sidebar from '../../../../components/Sidebar';
import { useFeedback } from '../../../../components/FeedbackProvider.jsx';
import { extractManagerNames } from '../../../../utils/companyIndicators.js';
import { BASE_ROUTES } from '../../../../shared/navigation.js';
import * as XLSX from 'xlsx';

const FILE_TYPE_OPTIONS = [
  { value: 'eung', label: '전기' },
  { value: 'tongsin', label: '통신' },
  { value: 'sobang', label: '소방' },
];
const FILE_TYPE_LABELS = {
  eung: '전기',
  tongsin: '통신',
  sobang: '소방',
};

const BIZ_FIELDS = ['사업자번호', 'bizNo', '사업자 번호'];
const NAME_FIELDS = ['업체명', '회사명', 'name', '검색된 회사'];
const REPRESENTATIVE_FIELDS = ['대표자', '대표자명'];
const REGION_FIELDS = ['대표지역', '지역'];
const SPECIAL_NAMES = ['조정', '서권형', '구본진'];

const normalizeName = (value) => {
  let name = String(value || '').replace(/\s+/g, '').toLowerCase();
  name = name.replace(/^(주|\(주\)|㈜|주\)|\(합\))/, '');
  name = name.replace(/(주|\(주\)|㈜|주\)|\(합\))$/, '');
  name = name.replace(/이앤/g, '이엔');
  name = name.replace(/앤/g, '엔');
  name = name.replace(/[^a-zA-Z0-9가-힣]/g, '');
  return name;
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

const COMMON_SURNAMES = new Set([
  '김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황',
  '안', '송', '류', '유', '홍', '전', '민', '구', '우', '문', '양', '손', '배', '백', '허', '노',
  '심', '하', '곽', '성', '차', '주', '우', '채', '남', '원', '방', '표', '변', '염', '여', '석',
  '설', '선', '현', '나', '진', '지', '위', '도', '연', '길', '엄', '복', '제', '탁', '공', '기',
]);
const COMPANY_SUFFIX_DENY = new Set([
  '건설', '공사', '전기', '전력', '토건', '토목', '산업', '정보', '통신', '소방', '기술', '기계', '기전', '기공',
  '환경', '시스템', '테크', '설비', '전설', '플랜트', '이엔지', '이엔씨', '엔지', '엔씨', '건축',
]);
const CORPORATE_PREFIX_PATTERN = /(주식회사|유한회사|농업회사법인|사단법인|재단법인|합자회사|합명회사|법인)$/;
const TRAILING_HANJA_PATTERN = /[\u3400-\u9FFF\uF900-\uFAFF]+$/u;
const JOB_TITLE_TOKENS = new Set(['부장', '차장', '과장', '팀장', '대리', '대표', '실장', '소장', '이사', '사장', '전무', '상무', '부사장', '주임', '사원']);

const looksLikePersonName = (token) => {
  if (!token) return false;
  const normalized = token.replace(/[^가-힣]/g, '');
  if (!/^[가-힣]{2,3}$/.test(normalized)) return false;
  if (!COMMON_SURNAMES.has(normalized[0])) return false;
  if (COMPANY_SUFFIX_DENY.has(normalized)) return false;
  for (const suffix of COMPANY_SUFFIX_DENY) {
    if (suffix && suffix !== normalized && normalized.endsWith(suffix)) return false;
  }
  return true;
};

const stripTrailingPersonSuffix = (text) => {
  if (!text) return '';
  const normalized = text.replace(/[^가-힣]/g, '');
  if (normalized.length <= 3) return text;
  for (let len = 3; len >= 2; len -= 1) {
    const suffix = normalized.slice(-len);
    if (!looksLikePersonName(suffix)) continue;
    const prefix = normalized.slice(0, -len);
    if (!prefix || prefix.length < 3) continue;
    if (looksLikePersonName(prefix) && prefix.length <= 3) continue;
    const idx = text.lastIndexOf(suffix);
    if (idx > 0) {
      const candidate = text.slice(0, idx).trim();
      if (candidate) return candidate;
    }
  }
  return text;
};

const cleanCompanyName = (rawName) => {
  if (!rawName) return '';
  const original = String(rawName);
  let primary = original.split('\n')[0];
  primary = primary.replace(/\r/g, '');
  const hasDelimiterHints = /[0-9_%]/.test(primary) || /[_\n\r]/.test(original);
  primary = primary.replace(/\s*[\d.,%][\s\S]*$/, '');
  primary = primary.split('_')[0];
  let trimmed = primary.replace(/\s+/g, ' ').trim();
  if (!trimmed) return '';

  let tokens = trimmed.split(' ').filter(Boolean);
  while (tokens.length > 1) {
    const last = tokens[tokens.length - 1];
    const normalized = last.replace(/[^가-힣]/g, '');
    if (!normalized) {
      tokens.pop();
      continue;
    }
    if (JOB_TITLE_TOKENS.has(normalized)) {
      tokens.pop();
      continue;
    }
    const precedingRaw = tokens.slice(0, -1).join(' ').trim();
    if (!precedingRaw) break;
    const precedingNormalized = precedingRaw.replace(/[^가-힣]/g, '');
    if (!looksLikePersonName(normalized)) break;
    if (CORPORATE_PREFIX_PATTERN.test(precedingNormalized)) break;
    tokens.pop();
    break;
  }
  let result = tokens.join(' ').trim();
  if (tokens.length <= 1 && hasDelimiterHints) {
    result = stripTrailingPersonSuffix(result);
  }
  if (hasDelimiterHints) {
    const strippedHanja = result.replace(TRAILING_HANJA_PATTERN, '').trim();
    if (strippedHanja && strippedHanja !== result && /[a-zA-Z0-9가-힣]/.test(strippedHanja)) {
      result = strippedHanja;
    }
  }
  return result;
};

const hasSpecialName = (raw) => {
  const normalized = String(raw || '').replace(/\s+/g, '');
  return SPECIAL_NAMES.some((token) => normalized.includes(token));
};

const summarizeMissingEntries = (entries, candidatesMap) => {
  if (!Array.isArray(entries) || !candidatesMap) return null;
  const seen = new Set();
  const missingNames = [];
  entries.forEach((entry) => {
    const normalized = entry?.normalizedName;
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    const candidates = candidatesMap.get(normalized) || [];
    if (candidates.length > 0) return;
    const displayName = entry.cleanedName || entry.rawName || normalized;
    missingNames.push(displayName);
  });
  if (missingNames.length === 0) return null;
  return {
    totalCount: entries.length,
    missingCount: missingNames.length,
    missingNames,
  };
};

export default function BidResultPage() {
  const { notify } = useFeedback();
  const [ownerId, setOwnerId] = React.useState('LH');
  const [fileType, setFileType] = React.useState('eung');
  const [formatFile, setFormatFile] = React.useState(null);
  const [isFormatting, setIsFormatting] = React.useState(false);
  const [templatePath, setTemplatePath] = React.useState('');
  const [agreementFile, setAgreementFile] = React.useState(null);
  const [orderingResultFile, setOrderingResultFile] = React.useState(null);
  const [isAgreementProcessing, setIsAgreementProcessing] = React.useState(false);
  const [isOrderingProcessing, setIsOrderingProcessing] = React.useState(false);
  const [agreementWorkbook, setAgreementWorkbook] = React.useState(null);
  const [agreementSheetNames, setAgreementSheetNames] = React.useState([]);
  const [selectedAgreementSheet, setSelectedAgreementSheet] = React.useState('');
  const [companyConflictSelections, setCompanyConflictSelections] = React.useState({});
  const [companyConflictModal, setCompanyConflictModal] = React.useState({ open: false, entries: [], isResolving: false });
  const [pendingAgreementEntries, setPendingAgreementEntries] = React.useState(null);
  const [pendingCandidatesMap, setPendingCandidatesMap] = React.useState(null);

  const formatFileInputRef = React.useRef(null);
  const templateFileInputRef = React.useRef(null);
  const agreementFileInputRef = React.useRef(null);
  const orderingFileInputRef = React.useRef(null);
  const templateFileName = templatePath ? templatePath.split(/[\\/]/).pop() : '';

  const strongLabelStyle = React.useMemo(() => ({
    display: 'block',
    marginBottom: '6px',
    fontWeight: 600,
    fontSize: '14px',
    color: '#0f172a',
  }), []);

  const handleSidebarSelect = React.useCallback((key) => {
    if (!key) return;
    if (key === 'search') { window.location.hash = BASE_ROUTES.search; return; }
    if (key === 'agreements') { window.location.hash = BASE_ROUTES.agreementBoard; return; }
    if (key === 'region-search') { window.location.hash = BASE_ROUTES.regionSearch; return; }
    if (key === 'agreements-sms') { window.location.hash = BASE_ROUTES.agreements; return; }
    if (key === 'auto-agreement') { window.location.hash = BASE_ROUTES.autoAgreement; return; }
    if (key === 'records') { window.location.hash = '#/records'; return; }
    if (key === 'mail') { window.location.hash = '#/mail'; return; }
    if (key === 'excel-helper') { window.location.hash = '#/excel-helper'; return; }
    if (key === 'bid-result') { window.location.hash = '#/bid-result'; return; }
    if (key === 'settings') { window.location.hash = BASE_ROUTES.settings; return; }
    if (key === 'upload') { window.location.hash = BASE_ROUTES.agreementBoard; }
  }, []);

  const handleTemplateFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setTemplatePath(file.path || '');
      notify({ type: 'info', message: '개찰결과파일이 변경되었습니다.' });
    } else {
      setTemplatePath('');
    }
  };

  const handlePickTemplateFile = () => {
    if (templateFileInputRef.current) {
      templateFileInputRef.current.click();
    }
  };

  const handleClearTemplateFile = () => {
    if (templateFileInputRef.current) {
      templateFileInputRef.current.value = '';
    }
    setTemplatePath('');
    notify({ type: 'info', message: '개찰결과파일 선택이 해제되었습니다.' });
  };

  const handleFormatFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setFormatFile(file);
    } else {
      setFormatFile(null);
    }
  };

  const handleClearFormatFile = React.useCallback(() => {
    if (formatFileInputRef.current) {
      formatFileInputRef.current.value = '';
    }
    setFormatFile(null);
  }, []);

  const handleFormatWorkbook = async () => {
    if (!formatFile?.path) {
      notify({ type: 'info', message: '엑셀 파일을 선택하세요.' });
      return;
    }
    if (!window.electronAPI?.excelHelper?.formatUploaded) {
      notify({ type: 'error', message: '엑셀 서식 변환 기능을 사용할 수 없습니다.' });
      return;
    }
    setIsFormatting(true);
    try {
      const response = await window.electronAPI.excelHelper.formatUploaded({ path: formatFile.path });
      if (!response?.success) throw new Error(response?.message || '엑셀 서식 변환에 실패했습니다.');
      if (response?.path) setTemplatePath(response.path);
      notify({
        type: 'success',
        message: response?.path ? `변환이 완료되었습니다. (${response.path})` : '변환이 완료되었습니다.',
      });
    } catch (err) {
      notify({ type: 'error', message: err.message || '엑셀 서식 변환에 실패했습니다.' });
    } finally {
      setIsFormatting(false);
    }
  };

  const handleAgreementFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setAgreementFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        setAgreementWorkbook(workbook);
        setAgreementSheetNames(workbook.SheetNames || []);
        setSelectedAgreementSheet(workbook.SheetNames?.[0] || '');
      };
      reader.readAsArrayBuffer(file);
    } else {
      setAgreementFile(null);
      setAgreementWorkbook(null);
      setAgreementSheetNames([]);
      setSelectedAgreementSheet('');
    }
  };

  const handleOrderingResultUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setOrderingResultFile(file);
    } else {
      setOrderingResultFile(null);
    }
  };

  const handleClearAgreementFile = React.useCallback(() => {
    if (agreementFileInputRef.current) {
      agreementFileInputRef.current.value = '';
    }
    setAgreementFile(null);
    setAgreementWorkbook(null);
    setAgreementSheetNames([]);
    setSelectedAgreementSheet('');
  }, []);

  const handleClearOrderingFile = React.useCallback(() => {
    if (orderingFileInputRef.current) {
      orderingFileInputRef.current.value = '';
    }
    setOrderingResultFile(null);
  }, []);

  const handleAgreementSheetSelect = (event) => {
    setSelectedAgreementSheet(event.target.value);
  };

  const extractAgreementEntries = React.useCallback(() => {
    if (!agreementWorkbook || !selectedAgreementSheet) return [];
    const sheet = agreementWorkbook.Sheets?.[selectedAgreementSheet];
    if (!sheet) return [];
    const entries = [];
    const isLhOwner = ownerId === 'LH';
    const maxConsecutiveEmptyRows = isLhOwner ? 2 : 1;
    let consecutiveEmptyRows = 0;
    for (let row = 5; row <= 1000; row += 1) {
      const checkAddress = XLSX.utils.encode_cell({ r: row - 1, c: 0 });
      const checkCell = sheet[checkAddress];
      const checkValue = checkCell ? XLSX.utils.format_cell(checkCell) : '';
      const hasCheck = String(checkValue || '').trim() !== '';
      if (!hasCheck) {
        consecutiveEmptyRows += 1;
        if (!isLhOwner || consecutiveEmptyRows >= maxConsecutiveEmptyRows) break;
        continue;
      }
      consecutiveEmptyRows = 0;
      const nameAddress = XLSX.utils.encode_cell({ r: row - 1, c: 2 });
      const nameCell = sheet[nameAddress];
      const raw = nameCell ? XLSX.utils.format_cell(nameCell) : '';
      const rawName = String(raw || '').trim();
      if (!rawName) continue;
      const cleaned = cleanCompanyName(rawName);
      if (!cleaned) continue;
      entries.push({
        rawName,
        cleanedName: cleaned,
        normalizedName: normalizeName(cleaned),
        special: hasSpecialName(rawName),
      });
    }
    return entries;
  }, [agreementWorkbook, selectedAgreementSheet, ownerId]);

  const buildBizEntries = React.useCallback((entries, candidatesMap, selections) => {
    const bizEntries = [];
    entries.forEach((entry) => {
      const normalizedName = entry.normalizedName;
      if (!normalizedName) return;
      const candidates = candidatesMap.get(normalizedName) || [];
      if (!candidates.length) return;
      let picked = null;
      if (candidates.length === 1) {
        picked = candidates[0];
      } else {
        const savedKey = selections?.[normalizedName];
        if (!savedKey) return;
        picked = candidates.find((candidate) => buildCompanyOptionKey(candidate) === savedKey) || null;
        if (!picked) return;
      }
      const bizNo = pickFirstValue(picked, BIZ_FIELDS);
      const normalizedBiz = normalizeBizNumber(bizNo);
      if (!normalizedBiz || normalizedBiz.length !== 10) return;
      bizEntries.push({ bizNo: normalizedBiz, special: entry.special });
    });
    return bizEntries;
  }, []);

  const handleCompanyConflictPick = (normalizedName, option) => {
    const key = buildCompanyOptionKey(option);
    setCompanyConflictSelections((prev) => ({ ...prev, [normalizedName]: key }));
  };

  const handleCompanyConflictCancel = () => {
    setCompanyConflictModal({ open: false, entries: [], isResolving: false });
    setPendingAgreementEntries(null);
    setPendingCandidatesMap(null);
  };

  const handleCompanyConflictConfirm = async () => {
    if (!pendingAgreementEntries || !pendingCandidatesMap) {
      handleCompanyConflictCancel();
      return;
    }
    const missingSelections = (companyConflictModal.entries || []).filter((entry) => {
      const savedKey = companyConflictSelections?.[entry.normalizedName];
      if (!savedKey) return true;
      const candidates = pendingCandidatesMap.get(entry.normalizedName) || [];
      return !candidates.some((candidate) => buildCompanyOptionKey(candidate) === savedKey);
    });
    if (missingSelections.length > 0) {
      notify({ type: 'info', message: '중복된 업체가 있습니다. 모든 항목을 선택해 주세요.' });
      return;
    }
    setCompanyConflictModal((prev) => ({ ...prev, isResolving: true }));
    try {
      const bizEntries = buildBizEntries(pendingAgreementEntries, pendingCandidatesMap, companyConflictSelections);
      if (!bizEntries.length) throw new Error('조회된 사업자번호가 없습니다.');
      const response = await window.electronAPI.bidResult.applyAgreement({
        templatePath,
        entries: bizEntries,
      });
      if (!response?.success) throw new Error(response?.message || '협정파일 처리에 실패했습니다.');
      const matched = Number.isFinite(response?.matchedCount) ? response.matchedCount : null;
      const scanned = Number.isFinite(response?.scannedCount) ? response.scannedCount : null;
      const summary = matched !== null && scanned !== null
        ? ` (매칭 ${matched}/${scanned})`
        : '';
      const missingSummary = summarizeMissingEntries(pendingAgreementEntries, pendingCandidatesMap);
      notify({ type: 'success', message: `협정파일 처리 완료: 개찰결과파일에 색상이 반영되었습니다.${summary}` });
      if (missingSummary) {
        notify({
          type: 'info',
          message: `협정파일 업체 ${missingSummary.totalCount}개 중 ${missingSummary.missingCount}개는 DB에서 찾지 못해 제외되었습니다.\n제외 업체: ${missingSummary.missingNames.join(', ')}`,
        });
      }
      setCompanyConflictModal({ open: false, entries: [], isResolving: false });
      setPendingAgreementEntries(null);
      setPendingCandidatesMap(null);
    } catch (err) {
      notify({ type: 'error', message: err?.message || '협정파일 처리에 실패했습니다.' });
      setCompanyConflictModal((prev) => ({ ...prev, isResolving: false }));
    }
  };

  const handleRunAgreementProcess = async () => {
    if (!templatePath) {
      notify({ type: 'info', message: '먼저 템플릿 파일을 서식 변환으로 생성하세요.' });
      return;
    }
    if (!agreementFile?.path) {
      notify({ type: 'info', message: '협정파일을 선택하세요.' });
      return;
    }
    if (!selectedAgreementSheet) {
      notify({ type: 'info', message: '협정파일 시트를 선택하세요.' });
      return;
    }
    if (!fileType) {
      notify({ type: 'info', message: '업체 분류(전기/통신/소방)를 선택하세요.' });
      return;
    }
    if (!window.electronAPI?.bidResult?.applyAgreement) {
      notify({ type: 'error', message: '협정파일 실행 기능을 사용할 수 없습니다.' });
      return;
    }
    if (!window.electronAPI?.searchCompanies) {
      notify({ type: 'error', message: '업체 조회 기능을 사용할 수 없습니다.' });
      return;
    }
    setIsAgreementProcessing(true);
    try {
      const entries = extractAgreementEntries();
      if (!entries.length) throw new Error('협정파일에서 업체명을 찾지 못했습니다.');
      const candidatesMap = new Map();
      for (const entry of entries) {
        if (!entry.normalizedName) continue;
        if (candidatesMap.has(entry.normalizedName)) continue;
        const response = await window.electronAPI.searchCompanies({ name: entry.cleanedName }, fileType);
        if (!response?.success) {
          candidatesMap.set(entry.normalizedName, []);
          continue;
        }
        const data = Array.isArray(response.data) ? response.data : [];
        candidatesMap.set(entry.normalizedName, data);
      }

      const conflictEntries = [];
      entries.forEach((entry) => {
        const normalized = entry.normalizedName;
        if (!normalized) return;
        const candidates = candidatesMap.get(normalized) || [];
        if (candidates.length <= 1) return;
        const savedKey = companyConflictSelections?.[normalized];
        const hasValidSelection = savedKey
          ? candidates.some((candidate) => buildCompanyOptionKey(candidate) === savedKey)
          : false;
        if (hasValidSelection) return;
        conflictEntries.push({
          normalizedName: normalized,
          displayName: entry.cleanedName || entry.rawName || normalized,
          options: candidates,
        });
      });

      if (conflictEntries.length > 0) {
        setPendingAgreementEntries(entries);
        setPendingCandidatesMap(candidatesMap);
        setCompanyConflictModal({ open: true, entries: conflictEntries, isResolving: false });
        setIsAgreementProcessing(false);
        return;
      }

      const bizEntries = buildBizEntries(entries, candidatesMap, companyConflictSelections);
      console.log('[bid-result] agreement entries:', entries.length);
      console.log('[bid-result] biz entries:', bizEntries.slice(0, 5), 'total:', bizEntries.length);
      const missingSummary = summarizeMissingEntries(entries, candidatesMap);
      if (!bizEntries.length) throw new Error('조회된 사업자번호가 없습니다.');

      const response = await window.electronAPI.bidResult.applyAgreement({
        templatePath,
        entries: bizEntries,
      });
      if (!response?.success) throw new Error(response?.message || '협정파일 처리에 실패했습니다.');
      const matched = Number.isFinite(response?.matchedCount) ? response.matchedCount : null;
      const scanned = Number.isFinite(response?.scannedCount) ? response.scannedCount : null;
      const summary = matched !== null && scanned !== null
        ? ` (매칭 ${matched}/${scanned})`
        : '';
      notify({ type: 'success', message: `협정파일 처리 완료: 개찰결과파일에 색상이 반영되었습니다.${summary}` });
      if (missingSummary) {
        notify({
          type: 'info',
          message: `협정파일 업체 ${missingSummary.totalCount}개 중 ${missingSummary.missingCount}개는 DB에서 찾지 못해 제외되었습니다.\n제외 업체: ${missingSummary.missingNames.join(', ')}`,
        });
      }
    } catch (err) {
      notify({ type: 'error', message: err?.message || '협정파일 처리에 실패했습니다.' });
    } finally {
      setIsAgreementProcessing(false);
    }
  };

  const handleRunOrderingProcess = async () => {
    if (!templatePath) {
      notify({ type: 'info', message: '먼저 템플릿 파일을 서식 변환으로 생성하세요.' });
      return;
    }
    if (!orderingResultFile?.path) {
      notify({ type: 'info', message: '발주처결과 파일을 선택하세요.' });
      return;
    }
    if (!window.electronAPI?.bidResult?.applyOrdering) {
      notify({ type: 'error', message: '발주처결과 실행 기능을 사용할 수 없습니다.' });
      return;
    }
    setIsOrderingProcessing(true);
    try {
      const response = await window.electronAPI.bidResult.applyOrdering({
        templatePath,
        orderingPath: orderingResultFile.path,
      });
      if (!response?.success) throw new Error(response?.message || '발주처결과 처리에 실패했습니다.');
      const invalidCount = Number.isFinite(response?.invalidCount) ? response.invalidCount : null;
      const summary = invalidCount !== null ? ` (무효 ${invalidCount}건)` : '';
      const winnerInfo = response?.winnerInfo;
      const winnerList = Array.isArray(winnerInfo) ? winnerInfo : (winnerInfo ? [winnerInfo] : []);
      const winnerParts = winnerList
        .filter((info) => info?.rank && info?.companyName)
        .map((info) => `${info.rank}순위 ${info.companyName}`);
      const winnerSummary = winnerParts.length > 0
        ? ` 실제낙찰사: 균형근접 ${winnerParts.join(', ')}`
        : '';
      notify({ type: 'success', message: `발주처결과 처리 완료: 무효 업체가 표시되었습니다.${summary}${winnerSummary}` });
    } catch (err) {
      notify({ type: 'error', message: err?.message || '발주처결과 처리에 실패했습니다.' });
    } finally {
      setIsOrderingProcessing(false);
    }
  };

  return (
    <div className="app-shell">
      <Sidebar active="bid-result" onSelect={handleSidebarSelect} fileStatuses={{}} collapsed={true} />
      <div className="main">
        <div className="title-drag" />
        <div className="topbar" />
        <div className="stage excel-helper-stage">
          <div className="excel-helper-shell">
            <h1 className="excel-helper-title">개찰결과 도우미</h1>
            <div className="excel-helper-body">
              <section className="excel-helper-section">
                <h2>개찰결과 엑셀 크기 및 폰트 수정</h2>
                <p className="section-help">업로드한 엑셀 파일의 서식/수식을 자동으로 정리합니다. (B열 순번 기준으로 마지막 행까지 적용)</p>
                <div style={{ marginBottom: '16px' }}>
                  <label className="field-label" style={strongLabelStyle}>발주처</label>
                  <select
                    className="input"
                    value={ownerId}
                    onChange={(e) => setOwnerId(e.target.value)}
                  >
                    <option value="LH">LH</option>
                    <option value="MOIS">행안부</option>
                    <option value="PPS">조달청</option>
                    <option value="EX">한국도로공사</option>
                    <option value="KRAIL">국가철도공단</option>
                  </select>
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label className="field-label" style={strongLabelStyle}>업체 분류</label>
                  <select
                    className="input"
                    value={fileType}
                    onChange={(e) => setFileType(e.target.value)}
                  >
                    {FILE_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                {ownerId !== 'LH' && (
                  <div className="excel-inline-alert">
                    선택한 발주처 양식은 아직 준비 중입니다. 현재는 LH만 지원합니다.
                  </div>
                )}
                {ownerId === 'LH' && (
                  <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label className="field-label" style={strongLabelStyle}>엑셀 파일 선택</label>
                    <input
                      type="file"
                      className="input"
                      accept=".xlsx"
                      ref={formatFileInputRef}
                      onChange={handleFormatFileUpload}
                      onClick={(e) => { e.target.value = ''; }}
                    />
                    <button
                      type="button"
                      className="btn-soft"
                      style={{ marginTop: '8px' }}
                      onClick={handleClearFormatFile}
                      disabled={!formatFile}
                    >
                      업로드 파일 지우기
                    </button>
                    {formatFile && (
                      <p className="section-help" style={{ marginTop: 8 }}>
                        선택된 파일: {formatFile.name}
                      </p>
                    )}
                  </div>
                  <div className="excel-helper-actions">
                    <button
                      type="button"
                      className="primary"
                      onClick={handleFormatWorkbook}
                      disabled={isFormatting}
                      style={{ minWidth: '180px' }}
                    >
                      {isFormatting ? '변환 중...' : '서식 변환'}
                    </button>
                  </div>
                </div>
                <div className="section-divider" style={{ margin: '18px 0' }} />
                <h3 className="section-title" style={{ fontSize: '18px', fontWeight: 700 }}>개찰결과 엑셀에 협정 업체 체크</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '18px' }}>
                  <div>
                    <label className="field-label" style={strongLabelStyle}>개찰결과파일</label>
                    <input
                      type="file"
                      accept=".xlsx"
                      ref={templateFileInputRef}
                      onChange={handleTemplateFileUpload}
                      onClick={(e) => { e.target.value = ''; }}
                      style={{ display: 'none' }}
                    />
                    <div className="input" style={{ fontWeight: 700 }}>
                      {templateFileName || '템플릿을 먼저 생성하세요.'}
                    </div>
                    {templatePath && (
                      <p className="section-help" style={{ marginTop: 6, fontWeight: 700 }}>
                        {templatePath}
                      </p>
                    )}
                    <button
                      type="button"
                      className="btn-soft"
                      style={{ marginTop: '8px' }}
                      onClick={handlePickTemplateFile}
                    >
                      개찰결과파일 변경
                    </button>
                    <button
                      type="button"
                      className="btn-soft"
                      style={{ marginTop: '8px' }}
                      onClick={handleClearTemplateFile}
                      disabled={!templatePath}
                    >
                      업로드 파일 지우기
                    </button>
                  </div>
                  <div>
                    <label className="field-label" style={strongLabelStyle}>협정파일 업로드</label>
                    <input
                      type="file"
                      className="input"
                      accept=".xlsx"
                      ref={agreementFileInputRef}
                      onChange={handleAgreementFileUpload}
                      onClick={(e) => { e.target.value = ''; }}
                    />
                    <button
                      type="button"
                      className="btn-soft"
                      style={{ marginTop: '8px' }}
                      onClick={handleClearAgreementFile}
                      disabled={!agreementFile}
                    >
                      업로드 파일 지우기
                    </button>
                    {agreementFile && (
                      <p className="section-help" style={{ marginTop: 8 }}>
                        선택된 파일: {agreementFile.name}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="field-label" style={strongLabelStyle}>협정파일 시트 선택</label>
                    <select
                      className="input"
                      value={selectedAgreementSheet}
                      onChange={handleAgreementSheetSelect}
                      disabled={agreementSheetNames.length === 0}
                    >
                      <option value="">시트를 선택하세요</option>
                      {agreementSheetNames.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="excel-helper-actions">
                    <button
                      type="button"
                      className="primary"
                      onClick={handleRunAgreementProcess}
                      disabled={isAgreementProcessing}
                      style={{ minWidth: '180px' }}
                    >
                      {isAgreementProcessing ? '처리 중...' : '협정 실행'}
                    </button>
                  </div>
                </div>
                <div className="section-divider" style={{ margin: '18px 0' }} />
                <h3 className="section-title" style={{ fontSize: '18px', fontWeight: 700 }}>개찰결과 엑셀에 무효표, 실제낙찰사 표시</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '18px' }}>
                  <div>
                    <label className="field-label" style={strongLabelStyle}>개찰결과파일</label>
                    <div className="input" style={{ fontWeight: 700 }}>
                      {templateFileName || '템플릿을 먼저 생성하세요.'}
                    </div>
                    {templatePath && (
                      <p className="section-help" style={{ marginTop: 6, fontWeight: 700 }}>
                        {templatePath}
                      </p>
                    )}
                    <button
                      type="button"
                      className="btn-soft"
                      style={{ marginTop: '8px' }}
                      onClick={handlePickTemplateFile}
                    >
                      개찰결과파일 변경
                    </button>
                    <button
                      type="button"
                      className="btn-soft"
                      style={{ marginTop: '8px' }}
                      onClick={handleClearTemplateFile}
                      disabled={!templatePath}
                    >
                      업로드 파일 지우기
                    </button>
                  </div>
                  <div>
                    <label className="field-label" style={strongLabelStyle}>발주처결과 업로드</label>
                    <input
                      type="file"
                      className="input"
                      accept=".xlsx,.xls"
                      ref={orderingFileInputRef}
                      onChange={handleOrderingResultUpload}
                      onClick={(e) => { e.target.value = ''; }}
                    />
                    <button
                      type="button"
                      className="btn-soft"
                      style={{ marginTop: '8px' }}
                      onClick={handleClearOrderingFile}
                      disabled={!orderingResultFile}
                    >
                      업로드 파일 지우기
                    </button>
                    {orderingResultFile && (
                      <p className="section-help" style={{ marginTop: 8 }}>
                        선택된 파일: {orderingResultFile.name}
                      </p>
                    )}
                  </div>
                  <div className="excel-helper-actions">
                    <button
                      type="button"
                      className="primary"
                      onClick={handleRunOrderingProcess}
                      disabled={isOrderingProcessing}
                      style={{ minWidth: '180px' }}
                    >
                      {isOrderingProcessing ? '처리 중...' : '결과 실행'}
                    </button>
                  </div>
                </div>
                  </>
                )}
              </section>
            </div>
          </div>
        </div>
      </div>
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
                      const typeLabel = FILE_TYPE_LABELS[typeKey] || '';
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
