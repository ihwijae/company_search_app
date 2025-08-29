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

                                        // [추가] 색상 테스트를 위한 임시 로그 코드
                            // if (valueCell.style && valueCell.style.fill) {
                            //     // JSON.stringify를 사용해 객체 내부를 자세히 출력합니다.
                            //     console.log(`[스타일 전체 테스트] 셀: ${item}, 값: ${value}, FILL 객체: ${JSON.stringify(valueCell.style.fill)}`);
                            // }
                
                            
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
                    // 비고에서 담당자명 추출 (있으면 리스트 뱃지로 사용)
                    try {
                      const manager = SearchLogic.extractManagerName(companyData["비고"]);
                      if (manager) companyData["담당자명"] = manager;
                    } catch {}
                    this.allCompanies.push(companyData);
                }
            }
        }
    }
    
    this.loaded = true;
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
    return ['전체', ...this.sheetNames.sort()];
  }
  
  search(criteria) {
    if (!this.loaded) throw new Error('엑셀 데이터가 로드되지 않았습니다.');
    let results = [...this.allCompanies];

    // --- 필터링 로직 (Python 원본과 동일) ---
    if (criteria.region && criteria.region !== '전체') {
      results = results.filter(comp => comp['대표지역'] === criteria.region);
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
