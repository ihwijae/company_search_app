// searchLogic.js (데이터 누락 문제를 해결하고 원본 로직을 100% 따른 최종 버전)

const ExcelJS = require('exceljs');
const { RELATIVE_OFFSETS } = require('./config.js'); 

// --- Helper Functions (Python 원본과 동일 기능) ---
const parseAmount = (value) => {
  if (value === null || value === undefined) return 0;
  const textValue = String(value).trim();
  if (!textValue) return 0;
  try {
    return parseInt(textValue.replace(/,/g, ''), 10);
  } catch (e) {
    return 0;
  }
};

const getStatusFromColor = (cell) => {
    if (!cell || !cell.style || !cell.style.fill) return "미지정";
    const fill = cell.style.fill;
    if (fill.type !== 'pattern' || !fill.fgColor) return "미지정";
    const argb = fill.fgColor.argb;
    if (!argb) return "미지정";
    
    // Python openpyxl의 theme 번호에 해당하는 표준 Office 테마의 ARGB 값
    if (argb === 'FFFFC000') return "최신";      // 주황 (theme 6)
    if (argb === 'FF9BC2E6') return "1년 경과";  // 파랑-회색 (theme 3)
    if (argb === 'FFFFFFFF' || argb === '00000000' || argb === 'FFFDEDEC') return "1년 이상 경과"; // 흰색, 검은색, 옅은 빨강
    
    return "미지정";
};

// Python의 get_summary_status 함수
const getSummaryStatus = (statusesDict) => {
    const keyStatuses = [
        statusesDict['시평'] || '미지정',
        statusesDict['3년 실적'] || '미지정',
        statusesDict['5년 실적'] || '미지정',
    ];

    if (keyStatuses.includes('1년 이상 경과')) return '1년 이상 경과';
    if (keyStatuses.includes('1년 경과')) return '1년 경과';
    if (keyStatuses.every(s => s === '최신')) return '최신';
    
    return '미지정';
};

class SearchLogic {
  constructor(filePath) {
    this.filePath = filePath;
    this.loaded = false;
    this.allCompanies = [];
    this.sheetNames = [];
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

        const maxRow = sheet.rowCount;
        const maxCol = sheet.columnCount;

        for (let rIdx = 1; rIdx <= maxRow; rIdx++) {
            const firstCellValue = sheet.getCell(rIdx, 1).value;
            // 1. A열에서 "회사명"이 포함된 헤더 행을 찾습니다.
            if (typeof firstCellValue === 'string' && firstCellValue.trim().includes("회사명")) {
                
                // 2. 해당 행의 B열부터 끝까지 순회하며 회사들을 찾습니다.
                for (let cIdx = 2; cIdx <= maxCol; cIdx++) {
                    const companyNameCell = sheet.getCell(rIdx, cIdx);
                    const companyName = companyNameCell.value;

                    if (typeof companyName !== 'string' || !companyName.trim()) {
                        continue; // 회사 이름이 없으면 건너뜁니다.
                    }

                    const companyData = { "검색된 회사": companyName.trim() };
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
                            
                            // 부채/유동비율은 100을 곱해 퍼센트로 변환
                            let processedValue = (item === "부채비율" || item === "유동비율") && typeof value === 'number'
                                ? value * 100
                                : value;

                            companyData[item] = processedValue ?? ""; // null이나 undefined는 빈 문자열로
                            companyStatuses[item] = status;
                        } else {
                            companyData[item] = "N/A";
                            companyStatuses[item] = "N/A";
                        }
                    }

                    companyData["데이터상태"] = companyStatuses;
                    companyData["요약상태"] = getSummaryStatus(companyStatuses);
                    this.allCompanies.push(companyData);
                }
            }
        }
    }
    
    this.loaded = true;
    console.log(`총 ${this.allCompanies.length}개의 업체 데이터를 ${this.sheetNames.length}개의 시트에서 로드했습니다.`);
  }

  isLoaded() { return this.loaded; }

  getUniqueRegions() {
    if (!this.loaded) throw new Error('엑셀 파일이 로드되지 않았습니다.');
    return ['전체', ...this.sheetNames.sort()];
  }
  
  search(criteria) {
    if (!this.loaded) throw new Error('엑셀 데이터가 로드되지 않았습니다.');
    let results = [...this.allCompanies];

    // --- 필터링 로직 (Python 원본과 동일) ---
    if (criteria.region && criteria.region !== '전체') {
      results = results.filter(comp => comp['지역'] === criteria.region);
    }
    if (criteria.name) {
      const searchName = criteria.name.toLowerCase();
      results = results.filter(comp => String(comp["검색된 회사"] || '').toLowerCase().includes(searchName));
    }
    if (criteria.manager) {
      const searchManager = criteria.manager.toLowerCase();
      results = results.filter(comp => String(comp["비고"] || '').toLowerCase().includes(searchManager));
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
    return results;
  }
}

module.exports = { SearchLogic };