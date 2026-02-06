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
const OWNER_OPTIONS = [
  { value: 'LH', label: '한국토지주택공사' },
  { value: 'MOIS', label: '행안부' },
  { value: 'PPS', label: '조달청' },
  { value: 'EX', label: '한국도로공사' },
  { value: 'KRAIL', label: '국가철도공단' },
];

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
  const [ownerId, setOwnerId] = React.useState('');
  const [fileType, setFileType] = React.useState('eung');
  const [formatFile, setFormatFile] = React.useState(null);
  const [isFormatting, setIsFormatting] = React.useState(false);
  const [templatePath, setTemplatePath] = React.useState('');
  const [agreementFile, setAgreementFile] = React.useState(null);
  const [orderingResultFile, setOrderingResultFile] = React.useState(null);
  const [bidAmountTemplatePath, setBidAmountTemplatePath] = React.useState('');
  const [isAgreementProcessing, setIsAgreementProcessing] = React.useState(false);
  const [isOrderingProcessing, setIsOrderingProcessing] = React.useState(false);
  const [isBidAmountProcessing, setIsBidAmountProcessing] = React.useState(false);
  const [bidAmountNoticeNo, setBidAmountNoticeNo] = React.useState('');
  const [bidAmountNoticeTitle, setBidAmountNoticeTitle] = React.useState('');
  const [bidAmountDeadlineDate, setBidAmountDeadlineDate] = React.useState('');
  const [bidAmountDeadlinePeriod, setBidAmountDeadlinePeriod] = React.useState('AM');
  const [bidAmountDeadlineTime, setBidAmountDeadlineTime] = React.useState('');
  const [bidAmountBaseAmount, setBidAmountBaseAmount] = React.useState('');
  const [agreementWorkbook, setAgreementWorkbook] = React.useState(null);
  const [agreementSheetNames, setAgreementSheetNames] = React.useState([]);
  const [selectedAgreementSheet, setSelectedAgreementSheet] = React.useState('');
  const [companyConflictSelections, setCompanyConflictSelections] = React.useState({});
  const [companyConflictModal, setCompanyConflictModal] = React.useState({ open: false, entries: [], isResolving: false });
  const [pendingConflictAction, setPendingConflictAction] = React.useState(null);
  const [pendingAgreementEntries, setPendingAgreementEntries] = React.useState(null);
  const [pendingBidAmountEntries, setPendingBidAmountEntries] = React.useState(null);
  const [pendingBidAmountExcluded, setPendingBidAmountExcluded] = React.useState([]);
  const [pendingCandidatesMap, setPendingCandidatesMap] = React.useState(null);

  const formatFileInputRef = React.useRef(null);
  const templateFileInputRef = React.useRef(null);
  const agreementFileInputRef = React.useRef(null);
  const orderingFileInputRef = React.useRef(null);
  const bidAmountTemplateInputRef = React.useRef(null);
  const templateFileName = templatePath ? templatePath.split(/[\\/]/).pop() : '';
  const bidAmountTemplateName = bidAmountTemplatePath ? bidAmountTemplatePath.split(/[\\/]/).pop() : '';
  const ownerLabel = React.useMemo(() => (
    OWNER_OPTIONS.find((option) => option.value === ownerId)?.label || '한국토지주택공사'
  ), [ownerId]);

  const strongLabelStyle = React.useMemo(() => ({
    display: 'block',
    marginBottom: '6px',
    fontWeight: 600,
    fontSize: '14px',
    color: '#0f172a',
  }), []);
  const sectionCardStyle = React.useMemo(() => ({
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '18px',
    background: '#f8fafc',
    boxShadow: '0 1px 0 rgba(15, 23, 42, 0.04)',
  }), []);
  const sectionTitleBadgeStyle = React.useMemo(() => ({
    display: 'inline-block',
    padding: '6px 12px',
    borderRadius: '999px',
    background: '#0f172a',
    color: '#f8fafc',
    fontSize: '14px',
    fontWeight: 700,
    letterSpacing: '0.2px',
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
    if (key === 'kakao-send') { window.location.hash = '#/kakao-send'; return; }
    if (key === 'company-notes') { window.location.hash = '#/company-notes'; return; }
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

  const handleBidAmountTemplateUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setBidAmountTemplatePath(file.path || '');
      notify({ type: 'info', message: '투찰금액 템플릿 파일이 변경되었습니다.' });
    } else {
      setBidAmountTemplatePath('');
    }
  };

  const handlePickBidAmountTemplate = () => {
    if (bidAmountTemplateInputRef.current) {
      bidAmountTemplateInputRef.current.click();
    }
  };

  const handleClearBidAmountTemplate = () => {
    if (bidAmountTemplateInputRef.current) {
      bidAmountTemplateInputRef.current.value = '';
    }
    setBidAmountTemplatePath('');
    notify({ type: 'info', message: '투찰금액 템플릿 선택이 해제되었습니다.' });
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

  const handleRunBidAmountProcess = async () => {
    if (!bidAmountTemplatePath) {
      notify({ type: 'info', message: '투찰금액 템플릿 파일을 선택하세요.' });
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
    if (!window.electronAPI?.bidResult?.applyBidAmountTemplate) {
      notify({ type: 'error', message: '투찰금액 템플릿 기능을 사용할 수 없습니다.' });
      return;
    }
    if (!window.electronAPI?.searchCompanies) {
      notify({ type: 'error', message: '업체 조회 기능을 사용할 수 없습니다.' });
      return;
    }
    setIsBidAmountProcessing(true);
    try {
      const { entries, excludedNames } = extractBidAmountEntries();
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
        setPendingBidAmountEntries(entries);
        setPendingBidAmountExcluded(excludedNames);
        setPendingCandidatesMap(candidatesMap);
        setPendingConflictAction('bid-amount');
        setCompanyConflictModal({ open: true, entries: conflictEntries, isResolving: false });
        setIsBidAmountProcessing(false);
        return;
      }

      const bidEntries = buildBidAmountEntries(entries, candidatesMap, companyConflictSelections);
      if (!bidEntries.length) throw new Error('조회된 업체명이 없습니다.');
      const deadlineParts = [bidAmountDeadlineDate];
      if (bidAmountDeadlineTime) {
        deadlineParts.push(bidAmountDeadlinePeriod === 'PM' ? '오후' : '오전');
        deadlineParts.push(bidAmountDeadlineTime);
      }
      const response = await window.electronAPI.bidResult.applyBidAmountTemplate({
        templatePath: bidAmountTemplatePath,
        entries: bidEntries,
        header: {
          noticeNo: bidAmountNoticeNo,
          noticeTitle: bidAmountNoticeTitle,
          ownerLabel,
          bidDeadline: deadlineParts.filter(Boolean).join(' '),
          baseAmount: bidAmountBaseAmount,
        },
      });
      if (!response?.success) {
        if (response?.canceled) return;
        throw new Error(response?.message || '투찰금액 템플릿 처리에 실패했습니다.');
      }
      const total = Number.isFinite(response?.totalCount) ? response.totalCount : null;
      const quality = Number.isFinite(response?.qualityCount) ? response.qualityCount : null;
      const tie = Number.isFinite(response?.tieCount) ? response.tieCount : null;
      const parts = [];
      if (total !== null) parts.push(`총 ${total}개`);
      if (quality !== null) parts.push(`품질만점 ${quality}개`);
      if (tie !== null) parts.push(`동가주의 ${tie}개`);
      const summary = parts.length > 0 ? ` (${parts.join(', ')})` : '';
      const missingSummary = summarizeMissingEntries(entries, candidatesMap);
      notify({ type: 'success', message: `투찰금액 템플릿 처리 완료${summary}` });
      if (missingSummary) {
        notify({
          type: 'info',
          duration: 0,
          message: `협정파일 업체 ${missingSummary.totalCount}개 중 ${missingSummary.missingCount}개는 DB에서 찾지 못해 제외되었습니다.\n제외 업체: ${missingSummary.missingNames.join(', ')}`,
        });
      }
      if (excludedNames.length > 0) {
        notify({
          type: 'info',
          duration: 0,
          message: `담당자 제외 업체 (${excludedNames.length}개): ${excludedNames.join(', ')}`,
        });
      }
    } catch (err) {
      notify({ type: 'error', message: err?.message || '투찰금액 템플릿 처리에 실패했습니다.' });
    } finally {
      setIsBidAmountProcessing(false);
    }
  };

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
    if (!ownerId) {
      notify({ type: 'info', message: '발주처를 먼저 선택하세요.' });
      if (event?.target) event.target.value = '';
      return;
    }
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

  const handlePickAgreementFile = () => {
    if (agreementFileInputRef.current) {
      agreementFileInputRef.current.click();
    }
  };

  const extractAgreementEntries = React.useCallback(() => {
    if (!agreementWorkbook || !selectedAgreementSheet) return [];
    const sheet = agreementWorkbook.Sheets?.[selectedAgreementSheet];
    if (!sheet) return [];
    const entries = [];
    const maxConsecutiveEmptyRows = 2;
    let consecutiveEmptyRows = 0;
    for (let row = 5; row <= 1000; row += 1) {
      const checkAddress = XLSX.utils.encode_cell({ r: row - 1, c: 0 });
      const checkCell = sheet[checkAddress];
      const checkValue = checkCell ? XLSX.utils.format_cell(checkCell) : '';
      const hasCheck = String(checkValue || '').trim() !== '';
      if (!hasCheck) {
        consecutiveEmptyRows += 1;
        if (consecutiveEmptyRows >= maxConsecutiveEmptyRows) break;
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
  }, [agreementWorkbook, selectedAgreementSheet]);

  const extractBidAmountEntries = React.useCallback(() => {
    if (!agreementWorkbook || !selectedAgreementSheet) return { entries: [], excludedNames: [] };
    const sheet = agreementWorkbook.Sheets?.[selectedAgreementSheet];
    if (!sheet) return { entries: [], excludedNames: [] };
    const entries = [];
    const excludedNames = [];
    const maxConsecutiveEmptyRows = 2;
    let consecutiveEmptyRows = 0;
    for (let row = 5; row <= 1000; row += 1) {
      const checkAddress = XLSX.utils.encode_cell({ r: row - 1, c: 0 });
      const checkCell = sheet[checkAddress];
      const checkValue = checkCell ? XLSX.utils.format_cell(checkCell) : '';
      const hasCheck = String(checkValue || '').trim() !== '';
      if (!hasCheck) {
        consecutiveEmptyRows += 1;
        if (consecutiveEmptyRows >= maxConsecutiveEmptyRows) break;
        continue;
      }
      consecutiveEmptyRows = 0;
      const nameAddress = XLSX.utils.encode_cell({ r: row - 1, c: 2 });
      const nameCell = sheet[nameAddress];
      const raw = nameCell ? XLSX.utils.format_cell(nameCell) : '';
      const rawName = String(raw || '').trim();
      if (!rawName) continue;
      if (hasSpecialName(rawName)) {
        const cleaned = cleanCompanyName(rawName);
        excludedNames.push(cleaned || rawName);
        continue;
      }
      const cleaned = cleanCompanyName(rawName);
      if (!cleaned) continue;
      const remarkAddress = XLSX.utils.encode_cell({ r: row - 1, c: 7 });
      const remarkCell = sheet[remarkAddress];
      const rawRemark = remarkCell ? XLSX.utils.format_cell(remarkCell) : '';
      const remark = String(rawRemark || '').trim();
      const normalizedRemark = remark.replace(/\s+/g, '');
      const isQuality = normalizedRemark.includes('품질만점');
      const isTie = normalizedRemark.includes('동가주의');
      entries.push({
        rawName,
        cleanedName: cleaned,
        normalizedName: normalizeName(cleaned),
        remark,
        isQuality,
        isTie,
      });
    }
    return { entries, excludedNames };
  }, [agreementWorkbook, selectedAgreementSheet]);

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

  const buildBidAmountEntries = React.useCallback((entries, candidatesMap, selections) => (
    (entries || []).map((entry) => {
      const normalizedName = entry.normalizedName;
      const candidates = normalizedName ? (candidatesMap.get(normalizedName) || []) : [];
      if (!normalizedName || candidates.length === 0) return null;
      let picked = null;
      if (candidates.length === 1) {
        picked = candidates[0];
      } else {
        const savedKey = selections?.[normalizedName];
        if (!savedKey) return null;
        picked = candidates.find((candidate) => buildCompanyOptionKey(candidate) === savedKey) || null;
        if (!picked) return null;
      }
      const resolvedName = String(pickFirstValue(picked, NAME_FIELDS) || entry.cleanedName || entry.rawName || '').trim();
      if (!resolvedName) return null;
      return {
        name: resolvedName,
        isQuality: Boolean(entry.isQuality),
        isTie: Boolean(entry.isTie),
      };
    }).filter(Boolean)
  ), []);

  const handleCompanyConflictPick = (normalizedName, option) => {
    const key = buildCompanyOptionKey(option);
    setCompanyConflictSelections((prev) => ({ ...prev, [normalizedName]: key }));
  };

  const handleCompanyConflictCancel = () => {
    setCompanyConflictModal({ open: false, entries: [], isResolving: false });
    setPendingConflictAction(null);
    setPendingAgreementEntries(null);
    setPendingBidAmountEntries(null);
    setPendingBidAmountExcluded([]);
    setPendingCandidatesMap(null);
  };

  const handleCompanyConflictConfirm = async () => {
    if (!pendingCandidatesMap || !pendingConflictAction) {
      handleCompanyConflictCancel();
      return;
    }
    if (pendingConflictAction === 'agreement' && !pendingAgreementEntries) {
      handleCompanyConflictCancel();
      return;
    }
    if (pendingConflictAction === 'bid-amount' && !pendingBidAmountEntries) {
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
      if (pendingConflictAction === 'bid-amount') {
        const bidEntries = buildBidAmountEntries(pendingBidAmountEntries, pendingCandidatesMap, companyConflictSelections);
        if (!bidEntries.length) throw new Error('조회된 업체명이 없습니다.');
        const deadlineParts = [bidAmountDeadlineDate];
        if (bidAmountDeadlineTime) {
          deadlineParts.push(bidAmountDeadlinePeriod === 'PM' ? '오후' : '오전');
          deadlineParts.push(bidAmountDeadlineTime);
        }
        const response = await window.electronAPI.bidResult.applyBidAmountTemplate({
          templatePath: bidAmountTemplatePath,
          entries: bidEntries,
          header: {
            noticeNo: bidAmountNoticeNo,
            noticeTitle: bidAmountNoticeTitle,
            ownerLabel,
            bidDeadline: deadlineParts.filter(Boolean).join(' '),
            baseAmount: bidAmountBaseAmount,
          },
        });
        if (!response?.success) {
          if (response?.canceled) {
            handleCompanyConflictCancel();
            return;
          }
          throw new Error(response?.message || '투찰금액 템플릿 처리에 실패했습니다.');
        }
        const total = Number.isFinite(response?.totalCount) ? response.totalCount : null;
        const quality = Number.isFinite(response?.qualityCount) ? response.qualityCount : null;
        const tie = Number.isFinite(response?.tieCount) ? response.tieCount : null;
        const parts = [];
        if (total !== null) parts.push(`총 ${total}개`);
        if (quality !== null) parts.push(`품질만점 ${quality}개`);
        if (tie !== null) parts.push(`동가주의 ${tie}개`);
        const summary = parts.length > 0 ? ` (${parts.join(', ')})` : '';
        const missingSummary = summarizeMissingEntries(pendingBidAmountEntries, pendingCandidatesMap);
        notify({ type: 'success', message: `투찰금액 템플릿 처리 완료${summary}` });
        if (missingSummary) {
          notify({
            type: 'info',
            duration: 0,
            message: `협정파일 업체 ${missingSummary.totalCount}개 중 ${missingSummary.missingCount}개는 DB에서 찾지 못해 제외되었습니다.\n제외 업체: ${missingSummary.missingNames.join(', ')}`,
          });
        }
        if (pendingBidAmountExcluded.length > 0) {
          notify({
            type: 'info',
            duration: 0,
            message: `담당자 제외 업체 (${pendingBidAmountExcluded.length}개): ${pendingBidAmountExcluded.join(', ')}`,
          });
        }
      } else {
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
            duration: 0,
            message: `협정파일 업체 ${missingSummary.totalCount}개 중 ${missingSummary.missingCount}개는 DB에서 찾지 못해 제외되었습니다.\n제외 업체: ${missingSummary.missingNames.join(', ')}`,
          });
        }
      }
      setCompanyConflictModal({ open: false, entries: [], isResolving: false });
      setPendingConflictAction(null);
      setPendingAgreementEntries(null);
      setPendingBidAmountEntries(null);
      setPendingBidAmountExcluded([]);
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
        setPendingConflictAction('agreement');
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
          duration: 0,
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
    if (!ownerId) {
      notify({ type: 'info', message: '발주처를 먼저 선택하세요.' });
      return;
    }
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
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'stretch' }}>
                  <div style={{ ...sectionCardStyle, flex: '1 1 360px' }}>
                    <div style={{ marginBottom: '12px' }}>
                      <span style={sectionTitleBadgeStyle}>개찰결과 엑셀 크기 및 폰트 수정</span>
                    </div>
                    <p className="section-help">업로드한 엑셀 파일의 서식/수식을 자동으로 정리합니다. (B열 순번 기준으로 마지막 행까지 적용)</p>
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
                  </div>
                  <div style={{ ...sectionCardStyle, flex: '1 1 360px' }}>
                      <div style={{ marginBottom: '12px' }}>
                        <span style={sectionTitleBadgeStyle}>투찰금액 템플릿 업체 배치</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div>
                          <label className="field-label" style={strongLabelStyle}>공고번호</label>
                          <input
                            className="input"
                            value={bidAmountNoticeNo}
                            onChange={(event) => setBidAmountNoticeNo(event.target.value)}
                            placeholder="예: R26BK..."
                          />
                        </div>
                        <div>
                          <label className="field-label" style={strongLabelStyle}>공사명</label>
                          <input
                            className="input"
                            value={bidAmountNoticeTitle}
                            onChange={(event) => setBidAmountNoticeTitle(event.target.value)}
                            style={{ minWidth: '420px', width: '100%' }}
                            placeholder="공사명을 입력하세요"
                          />
                        </div>
                        <div>
                          <label className="field-label" style={strongLabelStyle}>투찰마감일</label>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <input
                              className="input"
                              type="date"
                              value={bidAmountDeadlineDate}
                              onChange={(event) => setBidAmountDeadlineDate(event.target.value)}
                            />
                            <select
                              className="input"
                              value={bidAmountDeadlinePeriod}
                              onChange={(event) => setBidAmountDeadlinePeriod(event.target.value)}
                            >
                              <option value="AM">오전</option>
                              <option value="PM">오후</option>
                            </select>
                            <input
                              className="input"
                              type="text"
                              inputMode="numeric"
                              value={bidAmountDeadlineTime}
                              onChange={(event) => setBidAmountDeadlineTime(event.target.value)}
                              placeholder="예: 10:30"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="field-label" style={strongLabelStyle}>기초금액</label>
                          <input
                            className="input"
                            value={bidAmountBaseAmount}
                            onChange={(event) => setBidAmountBaseAmount(event.target.value)}
                            placeholder="예: 2,550,405,000"
                          />
                        </div>
                        <div>
                          <label className="field-label" style={strongLabelStyle}>투찰금액 템플릿</label>
                          <input
                            type="file"
                            accept=".xlsx"
                            ref={bidAmountTemplateInputRef}
                            onChange={handleBidAmountTemplateUpload}
                            onClick={(e) => { e.target.value = ''; }}
                            style={{ display: 'none' }}
                          />
                          <div className="input" style={{ fontWeight: 700 }}>
                            {bidAmountTemplateName || '투찰금액 템플릿을 선택하세요.'}
                          </div>
                          {bidAmountTemplatePath && (
                            <p className="section-help" style={{ marginTop: 6, fontWeight: 700 }}>
                              {bidAmountTemplatePath}
                            </p>
                          )}
                          <button
                            type="button"
                            className="btn-soft"
                            style={{ marginTop: '8px' }}
                            onClick={handlePickBidAmountTemplate}
                          >
                            템플릿 선택
                          </button>
                          <button
                            type="button"
                            className="btn-soft"
                            style={{ marginTop: '8px' }}
                            onClick={handleClearBidAmountTemplate}
                            disabled={!bidAmountTemplatePath}
                          >
                            선택 해제
                          </button>
                        </div>
                        <div>
                          <label className="field-label" style={strongLabelStyle}>협정파일 정보</label>
                          <div className="input" style={{ fontWeight: 700 }}>
                            {agreementFile?.name || '협정파일을 선택하세요.'}
                          </div>
                          <p className="section-help" style={{ marginTop: 6 }}>
                            시트: {selectedAgreementSheet || '선택 안 함'}
                          </p>
                          <select
                            className="input"
                            value={selectedAgreementSheet}
                            onChange={handleAgreementSheetSelect}
                            disabled={agreementSheetNames.length === 0}
                            style={{ marginTop: '8px' }}
                          >
                            <option value="">시트를 선택하세요</option>
                            {agreementSheetNames.map((name) => (
                              <option key={name} value={name}>{name}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="btn-soft"
                            style={{ marginTop: '8px' }}
                            onClick={handlePickAgreementFile}
                          >
                            협정파일 선택
                          </button>
                          <button
                            type="button"
                            className="btn-soft"
                            style={{ marginTop: '8px' }}
                            onClick={handleClearAgreementFile}
                            disabled={!agreementFile}
                          >
                            선택 해제
                          </button>
                        </div>
                        <div className="excel-helper-actions">
                          <button
                            type="button"
                            className="primary"
                            onClick={handleRunBidAmountProcess}
                            disabled={isBidAmountProcessing}
                            style={{ minWidth: '180px' }}
                          >
                            {isBidAmountProcessing ? '처리 중...' : '배치 실행'}
                          </button>
                        </div>
                      </div>
                    </div>
                </div>
                <>
                  <div style={{ height: '16px' }} />
                  <div style={sectionCardStyle}>
                    <div style={{ marginBottom: '12px' }}>
                      <span style={sectionTitleBadgeStyle}>개찰결과 엑셀에 협정 업체 체크</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
                  </div>
                  <div style={{ height: '16px' }} />
                  <div style={sectionCardStyle}>
                    <div style={{ marginBottom: '12px' }}>
                      <span style={sectionTitleBadgeStyle}>개찰결과 엑셀에 무효표, 실제낙찰사 표시</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
                        <label className="field-label" style={strongLabelStyle}>발주처</label>
                        <select
                          className="input"
                          value={ownerId}
                          onChange={(event) => {
                            setOwnerId(event.target.value);
                            setOrderingResultFile(null);
                            if (orderingFileInputRef.current) orderingFileInputRef.current.value = '';
                          }}
                        >
                          <option value="">발주처를 선택하세요</option>
                          {OWNER_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
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
                          disabled={!ownerId}
                        />
                        {!ownerId && (
                          <p className="section-help" style={{ marginTop: 8 }}>
                            발주처를 먼저 선택하면 파일 업로드가 가능합니다.
                          </p>
                        )}
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
                          disabled={isOrderingProcessing || !ownerId}
                          style={{ minWidth: '180px' }}
                        >
                          {isOrderingProcessing ? '처리 중...' : '결과 실행'}
                        </button>
                      </div>
                    </div>
                  </div>
                  </>
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
