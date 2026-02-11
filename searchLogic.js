// searchLogic.js (데이터 누락 문제를 해결하고 원본 로직을 100% 따른 최종 버전)

const ExcelJS = require('exceljs');
const { RELATIVE_OFFSETS: RELATIVE_OFFSETS } = require('./config.js'); 
const CREDIT_GRADE_ORDER = require('./src/shared/creditGrades.json');

// --- Helper Functions (Python 원본과 동일 기능) ---
const parseAmount = (value) => {
  if (value === null || value === undefined) return 0;
  const textValue = String(value).trim();
  if (!textValue) return 0;
  try {
    const cleaned = textValue
      .replace(/[,\s]/g, '')
      .replace(/(억원|억|만원|만|원)$/g, '');
    const normalized = cleaned.replace(/[^0-9.+-]/g, '');
    if (!normalized) return 0;
    const num = Number(normalized);
    return Number.isFinite(num) ? num : 0;
  } catch (e) {
    return 0;
  }
};

const normalizeCellText = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }
  if (typeof value === 'object') {
    if (Array.isArray(value.richText)) {
      return value.richText.map((part) => (part && part.text ? String(part.text) : '')).join('').trim();
    }
    if (value.text !== undefined && value.text !== null) return String(value.text).trim();
    if (value.result !== undefined && value.result !== null) return String(value.result).trim();
    if (value.hyperlink !== undefined && value.hyperlink !== null) return String(value.hyperlink).trim();
  }
  return String(value).trim();
};

const isWomenOwned = (company) => {
  if (!company || typeof company !== 'object') return false;
  const raw = company['여성기업'];
  if (raw === null || raw === undefined) return false;
  const text = String(raw).trim();
  if (!text) return false;
  const normalized = text.replace(/\s+/g, '').toLowerCase();
  if (!normalized) return false;
  if (normalized === '없음' || normalized === '-' || normalized === '무') return false;
  return true;
};

const hasQualityEvaluation = (company) => {
  if (!company || typeof company !== 'object') return false;
  const raw = company['품질평가'];
  if (raw === null || raw === undefined) return false;
  const text = String(raw).trim();
  if (!text) return false;
  const normalized = text.replace(/\s+/g, '').toLowerCase();
  if (!normalized) return false;
  if (normalized.includes('없음')) return false;
  if (normalized === '-' || normalized === '무') return false;
  return /\d/.test(normalized);
};

const getStatusFromColor = (cell) => {
    // 1. 셀 스타일 정보나 fill 객체가 없는 경우 -> "1년 이상 경과"
    if (!cell || !cell.style || !cell.style.fill) {
        return "1년 이상 경과";
    }

    const fgColor = cell.style.fill.fgColor;

    // 2. fgColor 객체가 없거나, 그 안에 theme 속성이 없는 경우도 "1년 이상 경과"로 처리합니다.
    if (!fgColor || fgColor.theme === undefined) {
        return "1년 이상 경과";
    }

    // 3. 실제 데이터 로그에서 확인된 theme 번호를 기준으로 상태를 반환합니다.
    switch (fgColor.theme) {
        case 6: // "최신"의 실제 테마 번호
            return "최신";
        case 3: // "1년 경과"의 실제 테마 번호
            return "1년 경과";
        case 0: // "1년 이상 경과"의 실제 테마 번호
        case 1: // Python 원본 호환성을 위해 1도 포함
            return "1년 이상 경과";
        default:
            // 그 외 예상치 못한 테마 번호는 "미지정"으로 처리합니다.
            return "미지정";
    }
};

const getSummaryStatus = (statusesDict) => {
    const keyStatuses = [ statusesDict['시평'] || '미지정', statusesDict['3년 실적'] || '미지정', statusesDict['5년 실적'] || '미지정' ];
    if (keyStatuses.includes('1년 이상 경과')) return '1년 이상 경과';
    if (keyStatuses.includes('1년 경과')) return '1년 경과';
    if (keyStatuses.every(s => s === '최신')) return '최신';
    return '미지정';
};

const SORT_FIELD_MAP = { sipyung: '시평', '3y': '3년 실적', '5y': '5년 실적' };

const normalizeBizNumber = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[^0-9]/g, '').trim();
};

const buildDedupKey = (item) => {
  if (!item || typeof item !== 'object') return '';
  const typeToken = item._file_type ? String(item._file_type).trim().toLowerCase() : '';
  const regionSource = item['대표지역'] || item['지역'];
  const regionToken = regionSource ? String(regionSource).trim() : '';
  const appendRegion = (baseKey) => (regionToken ? `${baseKey}|region:${regionToken}` : baseKey);
  const biz = normalizeBizNumber(item['사업자번호']);
  if (biz) {
    const baseKey = typeToken ? `biz:${biz}|type:${typeToken}` : `biz:${biz}`;
    return appendRegion(baseKey);
  }
  const nameSource = item['검색된 회사'] || item['회사명'] || item['대표자'];
  if (nameSource) {
    const normalized = String(nameSource).trim();
    if (normalized) {
      const baseKey = typeToken ? `name:${normalized}|type:${typeToken}` : `name:${normalized}`;
      return appendRegion(baseKey);
    }
  }
  return '';
};

const dedupeCompanies = (list) => {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const deduped = [];
  let fallbackIndex = 0;
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    let key = buildDedupKey(item);
    if (!key) {
      key = `row:${fallbackIndex++}`;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  return deduped;
};

const CREDIT_GRADE_RANK = Array.isArray(CREDIT_GRADE_ORDER)
  ? CREDIT_GRADE_ORDER.map((grade) => String(grade || '').trim().toUpperCase()).reduce((map, grade, index) => {
    if (grade) map.set(grade, index);
    return map;
  }, new Map())
  : new Map();

const extractCreditGradeToken = (value) => {
  if (value === null || value === undefined) return '';
  const source = String(value).trim();
  if (!source) return '';
  const cleaned = source.replace(/\s+/g, ' ').toUpperCase();
  const match = cleaned.match(/^([A-Z]{1,3}[0-9]?(?:[+-])?)/);
  if (match && match[1]) return match[1];
  const token = cleaned.split(/[\s(]/)[0] || '';
  return token.replace(/[^A-Z0-9+-]/g, '') || '';
};

const getCreditGradeRank = (gradeToken) => {
  if (!gradeToken) return Number.POSITIVE_INFINITY;
  const normalized = String(gradeToken).trim().toUpperCase();
  if (!normalized) return Number.POSITIVE_INFINITY;
  if (CREDIT_GRADE_RANK.has(normalized)) {
    return CREDIT_GRADE_RANK.get(normalized);
  }
  return Number.POSITIVE_INFINITY;
};

class SearchLogic {
  constructor(filePath) {
    this.filePath = filePath;
    this.loaded = false;
    this.allCompanies = [];
    this.sheetNames = [];
  }

  // 비고 텍스트에서 담당자 이름을 추출하는 휴리스틱 함수
  static extractManagerName(notes) {
    if (!notes) return null;
    const text = String(notes).replace(/\s+/g, ' ').trim();
    if (!text) return null;
    // 우선 규칙: 비고란 맨 앞에 항상 담당자 이름이 배치됨
    // 첫 토큰(공백/구분자 전)의 한글 2~4글자를 우선적으로 사용
    const firstToken = text.split(/[ ,\/\|·\-]+/).filter(Boolean)[0] || '';
    const cleanedFirst = firstToken.replace(/^[\[\(（【]([^\]\)）】]+)[\]\)】]?$/, '$1');
    if (/^[가-힣]{2,4}$/.test(cleanedFirst)) return cleanedFirst;
    // 1) '담당' 또는 '담당자' 키워드 기반 추출
    let m = text.match(/담당자?\s*[:：-]?\s*([가-힣]{2,4})/);
    if (m && m[1]) return m[1];
    // 2) 직함 동반 패턴: 이름 + 직함
    m = text.match(/([가-힣]{2,4})\s*(과장|팀장|차장|대리|사원|부장|대표|실장|소장)/);
    if (m && m[1]) return m[1];
    // 3) 일반 이름 다음에 전화/구분 기호가 오는 패턴(문서 용어를 배제)
    // 단, '확인서', '등록증' 등 문서 명칭을 이름으로 오인하지 않도록 1차 배제
    m = text.match(/\b(?!확인서|등록증|증명서|평가|서류)([가-힣]{2,4})\b\s*(?:,|\/|\(|\d|$)/);
    if (m && m[1]) return m[1];
    return null;
  }

  async load() {
    const workbook = new ExcelJS.Workbook();
    // [핵심] Python의 data_only=False 와 유사하게, 스타일 정보를 포함하여 읽습니다.
    await workbook.xlsx.readFile(this.filePath);
    this.allCompanies = [];
    this.sheetNames = [];

    const regionFilter = null; // 현재는 항상 모든 시트를 읽도록 설정

    let targetSheetNames = [];
    if (regionFilter && regionFilter !== '전체') {
        if (workbook.worksheets.some(s => s.name === regionFilter)) {
            targetSheetNames.push(regionFilter);
        }
    } else {
        targetSheetNames = workbook.worksheets.map(s => s.name);
    }

    for (const sheetName of targetSheetNames) {
        const sheet = workbook.getWorksheet(sheetName);
        if (!sheet) continue;

        this.sheetNames.push(sheetName.trim());

        const maxRow = sheet.rowCount;
        const maxCol = sheet.columnCount;

        for (let rIdx = 1; rIdx <= maxRow; rIdx++) {
            const firstCellValue = sheet.getCell(rIdx, 1).value;
            // 1. A열에서 "회사명"이 포함된 헤더 행을 찾습니다.
            if (typeof firstCellValue === 'string' && firstCellValue.trim().includes("회사명")) {
                
                // 2. 해당 행의 B열부터 끝까지 순회하며 회사들을 찾습니다.
                for (let cIdx = 2; cIdx <= maxCol; cIdx++) {
                    const companyNameCell = sheet.getCell(rIdx, cIdx);
                    const rawCompanyName = companyNameCell.value;

                    if (typeof rawCompanyName !== 'string' || !rawCompanyName.trim()) {
                        continue; // 회사 이름이 없으면 건너뜁니다.
                    }

                    const companyName = String(rawCompanyName).split('\n')[0].replace(/\s*[\d.,%].*$/, '').trim();
                    if (!companyName) {
                        continue;
                    }

                    const companyData = { "검색된 회사": companyName };
                    companyData['대표지역'] = sheetName.trim();
                    const companyStatuses = {};
                    
                    // 3. 찾은 회사의 열(cIdx)을 기준으로 아래로 내려가며 데이터를 추출합니다.
                    for (const item in RELATIVE_OFFSETS) {
                        const offset = RELATIVE_OFFSETS[item];
                        const targetRow = rIdx + offset;
                        
                        if (targetRow <= maxRow) {
                            const valueCell = sheet.getCell(targetRow, cIdx);
                            const value = valueCell.value;
                            const status = getStatusFromColor(valueCell);

                                        // [추가] 색상 테스트를 위한 임시 로그 코드
                            // if (valueCell.style && valueCell.style.fill) {
                            //     // JSON.stringify를 사용해 객체 내부를 자세히 출력합니다.
                            //     console.log(`[스타일 전체 테스트] 셀: ${item}, 값: ${value}, FILL 객체: ${JSON.stringify(valueCell.style.fill)}`);
                            // }
                
                            
                            // 부채/유동비율은 100을 곱해 퍼센트로 변환
                            let processedValue = (item === "부채비율" || item === "유동비율") && typeof value === 'number'
                                ? value * 100
                                : value;
                            if (processedValue && typeof processedValue === 'object') {
                                processedValue = normalizeCellText(processedValue);
                            }

                            companyData[item] = processedValue ?? ""; // null이나 undefined는 빈 문자열로
                            companyStatuses[item] = status;
                        } else {
                            companyData[item] = "N/A";
                            companyStatuses[item] = "N/A";
                        }
                    }

                    companyData["데이터상태"] = companyStatuses;
                    companyData["요약상태"] = getSummaryStatus(companyStatuses);
                    // 비고에서 담당자명 추출 (있으면 리스트 뱃지로 사용)
                    try {
                      const manager = SearchLogic.extractManagerName(companyData["비고"]);
                      if (manager) companyData["담당자명"] = manager;
                    } catch {}
                    const normalizedCreditGrade = extractCreditGradeToken(companyData['신용평가']);
                    if (normalizedCreditGrade) {
                      companyData._creditGrade = normalizedCreditGrade;
                    }
                    companyData._creditGradeRank = getCreditGradeRank(normalizedCreditGrade);
                    this.allCompanies.push(companyData);
                }
            }
        }
    }
    
    this.loaded = true;
    this.buildNameIndex();
    console.log(`총 ${this.allCompanies.length}개의 업체 데이터를 ${this.sheetNames.length}개의 시트에서 로드했습니다.`);
  }



  // searchLogic.js 파일의 load 함수만 아래 코드로 잠시 교체해주세요. 색상 테스트 코드

  // async load() {
  //   console.log('[색상 테스트] 테스트를 시작합니다...');
  //   const workbook = new ExcelJS.Workbook();
  //   await workbook.xlsx.readFile(this.filePath); // main.js에서 지정한 파일을 읽습니다.
  //   const sheet = workbook.getWorksheet(1); // 첫 번째 시트를 사용합니다.

  //   if (!sheet) {
  //       console.log('[색상 테스트] 테스트 파일을 열 수 없습니다.');
  //       return;
  //   }

  //   const testCells = ['A1', 'A2', 'A3', 'A4'];
  //   console.log('--- [색상 테스트 결과] ---');

  //   testCells.forEach(cellAddress => {
  //       const cell = sheet.getCell(cellAddress);
  //       const cellValue = cell.value;
  //       const fillStyle = cell.style.fill;

  //       if (fillStyle && fillStyle.fgColor) {
  //           console.log(`셀: ${cellValue}, FILL 객체: ${JSON.stringify(fillStyle)}`);
  //       } else {
  //           console.log(`셀: ${cellValue}, FILL 객체: 색상 정보 없음`);
  //       }
  //   });
  //   console.log('--- [테스트 종료] ---');
    
  //   // 테스트 중에는 실제 데이터 로딩을 중단합니다.
  //   this.loaded = false; 
  //   // throw new Error("색상 테스트가 완료되었습니다. 터미널 로그를 확인해주세요.");
  // }



  isLoaded() { return this.loaded; }

  getUniqueRegions() {
    if (!this.loaded) throw new Error('엑셀 파일이 로드되지 않았습니다.');
    return ['전체', ...this.sheetNames];
  }
  
  search(criteria = {}, options = {}) {
    if (!this.loaded) throw new Error('엑셀 데이터가 로드되지 않았습니다.');
    let results = [...this.allCompanies];

    // --- 필터링 로직 (Python 원본과 동일) ---
    const normalizeRegion = (v) => String(v || '').trim();
    const includeRegions = Array.isArray(criteria.includeRegions)
      ? criteria.includeRegions.map(normalizeRegion).filter((r) => r && r !== '전체')
      : [];
    const excludeRegions = Array.isArray(criteria.excludeRegions)
      ? criteria.excludeRegions.map(normalizeRegion).filter((r) => r && r !== '전체')
      : [];

    if (includeRegions.length > 0) {
      const includeSet = new Set(includeRegions);
      results = results.filter((comp) => includeSet.has(normalizeRegion(comp['대표지역'])));
    } else if (criteria.region && criteria.region !== '전체') {
      const target = normalizeRegion(criteria.region);
      results = results.filter(comp => normalizeRegion(comp['대표지역']) === target);
    }

    if (excludeRegions.length > 0) {
      const excludeSet = new Set(excludeRegions);
      results = results.filter((comp) => !excludeSet.has(normalizeRegion(comp['대표지역'])));
    }

    if (criteria.name) {
      const searchName = criteria.name.toLowerCase();
      results = results.filter(comp => String(comp["검색된 회사"] || '').toLowerCase().includes(searchName));
    }
    if (criteria.manager) {
      const searchManager = criteria.manager.toLowerCase();
      results = results.filter(comp => String(comp["비고"] || '').toLowerCase().includes(searchManager));
    }
    if (criteria.bizNumber) {
      const searchBiz = normalizeBizNumber(criteria.bizNumber);
      if (searchBiz) {
        results = results.filter((comp) => normalizeBizNumber(comp['사업자번호']).includes(searchBiz));
      }
    }
    const minCreditRaw = criteria.min_credit_grade || criteria.minCreditGrade || '';
    const minCreditGrade = extractCreditGradeToken(minCreditRaw);
    const minCreditRank = getCreditGradeRank(minCreditGrade);
    if (minCreditGrade && Number.isFinite(minCreditRank)) {
      results = results.filter((comp) => {
        const rankValue = comp && comp._creditGradeRank;
        const effectiveRank = Number.isFinite(rankValue)
          ? rankValue
          : getCreditGradeRank(extractCreditGradeToken(comp && comp['신용평가']));
        if (!Number.isFinite(effectiveRank)) return false;
        return effectiveRank <= minCreditRank;
      });
    }
    const rangeFilters = { sipyung: '시평', '3y': '3년 실적', '5y': '5년 실적' };
     for (const key in rangeFilters) {
      const minVal = parseAmount(criteria[`min_${key}`]);
      const maxVal = parseAmount(criteria[`max_${key}`]);
      const fieldName = rangeFilters[key];
      if (minVal) { // 0도 유효한 값으로 처리
        results = results.filter(comp => {
          const compVal = parseAmount(comp[fieldName]);
          return compVal !== null && compVal >= minVal;
        });
      }
      if (maxVal) {
        results = results.filter(comp => {
          const compVal = parseAmount(comp[fieldName]);
          return compVal !== null && compVal <= maxVal;
        });
      }
    }
    const processed = SearchLogic.postProcessResults(results, options || {});
    if (processed && processed.paginated) {
      return { items: processed.items, meta: processed.meta };
    }
    return processed.items;
  }

  buildNameIndex() {
    if (this.nameIndex) return;
    this.nameIndex = new Map();
    for (const company of this.allCompanies) {
      const name = company['검색된 회사'];
      if (name) {
        const normalizedName = String(name).replace(/\s+/g, '').toLowerCase();
        if (!this.nameIndex.has(normalizedName)) {
          this.nameIndex.set(normalizedName, company);
        }
      }
    }
  }

  searchMany(names = [], options = {}) {
    if (!this.loaded) throw new Error('엑셀 데이터가 로드되지 않았습니다.');
    const uniqueResults = new Map(); // Use a Map to store unique companies by a unique key (e.g., bizNo or full name)

    for (const nameQuery of names) {
      const searchName = String(nameQuery).trim();
      if (!searchName) continue;

      // Use the existing 'search' method with a name criteria
      const resultsForQuery = this.search({ name: searchName }, options);
      
      // Add unique results to the map
      resultsForQuery.forEach(company => {
        const dedupKey = buildDedupKey(company); // Re-use the existing deduplication key logic
        if (dedupKey && !uniqueResults.has(dedupKey)) {
          uniqueResults.set(dedupKey, company);
        }
      });
    }
    return Array.from(uniqueResults.values());
  }
}

SearchLogic.postProcessResults = function postProcessResults(inputResults, options = {}) {
  const base = Array.isArray(inputResults) ? [...inputResults] : [];
  const {
    onlyLatest = false,
    onlyWomenOwned = false,
    onlyLHQuality = false,
    sortKey = null,
    sortDir = 'desc',
    pagination = null,
  } = options || {};

  let working = [...base];

  if (onlyLatest) {
    working = working.filter((item) => (item?.['요약상태'] || '') === '최신');
  }

  if (onlyWomenOwned) {
    working = working.filter((item) => isWomenOwned(item));
  }

  if (onlyLHQuality) {
    working = working.filter((item) => hasQualityEvaluation(item));
  }

  const sortField = sortKey && SORT_FIELD_MAP[sortKey] ? SORT_FIELD_MAP[sortKey] : null;
  if (sortField) {
    const direction = sortDir === 'asc' ? 1 : -1;
    const collator = new Intl.Collator('ko', { sensitivity: 'base' });
    const hasMetric = (value) => {
      if (value === null || value === undefined) return false;
      const str = String(value).trim();
      if (!str) return false;
      if (str === '-' || str === 'N/A' || str === 'NA') return false;
      return true;
    };
    working = [...working].sort((a, b) => {
      const rawA = a?.[sortField];
      const rawB = b?.[sortField];
      const aHas = hasMetric(rawA);
      const bHas = hasMetric(rawB);
      if (aHas && !bHas) return -1;
      if (!aHas && bHas) return 1;

      const av = aHas ? parseAmount(rawA) : 0;
      const bv = bHas ? parseAmount(rawB) : 0;
      if (av === bv) {
        const nameA = String(a?.['검색된 회사'] || '');
        const nameB = String(b?.['검색된 회사'] || '');
        const byName = collator.compare(nameA, nameB);
        if (byName !== 0) return byName;
        const typeA = String(a?._file_type || '').toLowerCase();
        const typeB = String(b?._file_type || '').toLowerCase();
        if (typeA !== typeB) {
          return collator.compare(typeA, typeB);
        }
        const bizA = String(a?.['사업자번호'] || '');
        const bizB = String(b?.['사업자번호'] || '');
        return collator.compare(bizA, bizB);
      }
      return av > bv ? direction : -direction;
    });
  }

  working = dedupeCompanies(working);

  const totalCount = working.length;

  if (pagination && Number.isFinite(Number.parseInt(pagination.pageSize, 10)) && Number(pagination.pageSize) > 0) {
    const rawSize = Number.parseInt(pagination.pageSize, 10);
    const pageSize = rawSize > 0 ? rawSize : totalCount || 1;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const rawPage = Number.parseInt(pagination.page, 10) || 1;
    const page = Math.min(Math.max(rawPage, 1), totalPages);
    const start = (page - 1) * pageSize;
    const items = working.slice(start, start + pageSize);
    return {
      items,
      meta: { totalCount, totalPages, page, pageSize },
      paginated: true,
    };
  }

  return {
    items: working,
    meta: { totalCount },
    paginated: false,
  };
};

module.exports = { SearchLogic };
