const TEXT_FALSE_VALUES = ['없음', '무', '-', 'n/a', 'na', '미등록', 'no'];
const MANAGER_KEYS = [
  '담당자명', '담당자', '담당자1', '담당자 1', '담당자2', '담당자 2', '담당자3', '담당자 3',
  '담당자명1', '담당자명2', '담당자명3', '주담당자', '부담당자', '협력담당자', '업체담당자',
  '현장담당자', '사무담당자', '담당', 'manager', 'managerName', 'manager_name',
  'contactPerson', 'contact_person', 'contact',
];
const MANAGER_KEY_SET = new Set(MANAGER_KEYS.map((key) => key.replace(/\s+/g, '').toLowerCase()));

const normalize = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

export const normalizeCellText = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }
  if (typeof value === 'object') {
    // ExcelJS richText cell value
    if (Array.isArray(value.richText)) {
      return value.richText.map((part) => (part && part.text ? String(part.text) : '')).join('').trim();
    }
    if (value.text !== undefined && value.text !== null) {
      return String(value.text).trim();
    }
    if (value.result !== undefined && value.result !== null) {
      return String(value.result).trim();
    }
    if (value.hyperlink !== undefined && value.hyperlink !== null) {
      return String(value.hyperlink).trim();
    }
  }
  return String(value).trim();
};

export const getCandidateTextField = (candidate, fields = []) => {
  if (!candidate || typeof candidate !== 'object') return '';
  const sources = [candidate, candidate.snapshot];
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    for (const field of fields) {
      if (Object.prototype.hasOwnProperty.call(source, field)) {
        const value = source[field];
        if (value !== undefined && value !== null && value !== '') {
          return normalizeCellText(value);
        }
      }
    }
  }
  return '';
};

export const isWomenOwnedCompany = (candidate) => {
  const raw = getCandidateTextField(candidate, ['여성기업', '여성기업여부', 'womenOwned', 'isWomenOwned']);
  const text = normalize(raw);
  if (!text) return false;
  const normalized = text.replace(/\s+/g, '').toLowerCase();
  return normalized.length > 0;
};

export const getQualityBadgeText = (candidate) => {
  let raw = getCandidateTextField(candidate, ['품질평가', 'qualityEvalText', 'qualityEvaluation']);
  let text = normalize(raw);
  if (!text) {
    const numeric = candidate && candidate.qualityEval;
    if (numeric !== undefined && numeric !== null && numeric !== '') {
      const num = Number(numeric);
      if (Number.isFinite(num) && num !== 0) text = String(num);
    }
  }
  if (!text) return null;
  const normalized = text.replace(/\s+/g, '').toLowerCase();
  if (!normalized) return null;
  if (TEXT_FALSE_VALUES.some((token) => normalized === token || normalized.includes(token))) return null;
  if (normalized === '0' || normalized === '0.0') return null;
  return text;
};

export const extractManagerNames = (candidate) => {
  if (!candidate || typeof candidate !== 'object') return [];
  const seen = new Set();
  const names = [];

  const addNameCandidate = (raw) => {
    if (raw == null) return;
    let token = String(raw).trim();
    if (!token) return;
    token = token.replace(/^[\[\(（【]([^\]\)）】]+)[\]\)】]?$/, '$1').trim();
    token = token.replace(/(과장|팀장|차장|대리|사원|부장|대표|실장|소장|님)$/g, '').trim();
    token = token.replace(/[0-9\-]+$/g, '').trim();
    if (!/^[가-힣]{2,4}$/.test(token)) return;
    const key = token.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    names.push(token);
  };

  const collectFromSource = (source) => {
    if (!source || typeof source !== 'object') return;
    Object.entries(source).forEach(([key, value]) => {
      if (value == null || value === '') return;
      const normalizedKey = key.replace(/\s+/g, '').toLowerCase();
      if (MANAGER_KEY_SET.has(normalizedKey)) {
        String(value).split(/[\n,/·•∙ㆍ;|\\]/).forEach((part) => addNameCandidate(part));
        return;
      }
      if (/담당/.test(normalizedKey) || normalizedKey.includes('manager')) {
        String(value).split(/[\n,/·•∙ㆍ;|\\]/).forEach((part) => addNameCandidate(part));
        return;
      }
      if (normalizedKey === '비고') {
        const text = String(value).replace(/\s+/g, ' ').trim();
        if (!text) return;
        const firstToken = text.split(/[ ,\/\|·•∙ㆍ;:\-]+/).filter(Boolean)[0] || '';
        addNameCandidate(firstToken);
        const patterns = [
          /담당자?\s*[:：-]?\s*([가-힣]{2,4})/g,
          /([가-힣]{2,4})\s*(과장|팀장|차장|대리|사원|부장|대표|실장|소장)/g,
          /\b(?!확인서|등록증|증명서|평가|서류)([가-힣]{2,4})\b\s*(?:,|\/|\(|\d|$)/g,
        ];
        patterns.forEach((re) => {
          let match;
          while ((match = re.exec(text)) !== null) {
            addNameCandidate(match[1]);
          }
        });
      }
    });
  };

  collectFromSource(candidate);
  collectFromSource(candidate?.snapshot);

  return names;
};
