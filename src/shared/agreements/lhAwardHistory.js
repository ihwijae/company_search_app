const LH_AWARD_HISTORY_RAW_TEXT = `< LH 낙찰이력 보유 현황 > - ①

㈜지음이엔아이
- 계약일 : 2025.03.20 (9,428,462,975원) - 충북혁신 전기공사 1공구
- 계약일 : 2025.09.03 (3,979,189,607원) - 고양장항 소방시설공사 6공구

㈜아람이엔테크
- 계약일 : 2025.10.16 (2,256,233,999원) - 대전대동2 소방시설공사

㈜대흥디씨티
- 계약일 : 2025.10.16 (7,187,735,979원) - 군포대야미 전기공사 1공구

㈜성전사
- 계약일 : 2025.03.06 (4,892,709,215원) - 구리갈매역세권 전기공사 2공구

㈜대상전력
- 계약일 : 2025.03.06 (3,914,167,372원) - 구리갈매역세권 전기공사 2공구

일렉파워㈜
- 계약일 : 2025.03.13 (9,751,734,115) - 청주지북 전기공사

㈜송원이앤씨
- 계약일 : 2025.03.13 (1,950,346,823) - 청주지북 전기공사

㈜부현전기
- 계약일 : 2025.10.16 (14,375,471,958원) - 군포대야미 전기공사 1공구
- 계약일 : 2025.06.25 (5,436,090,832원) - 남양주왕숙 전기공사 4공구

신신이앤씨㈜
- 계약일 : 2025.04.03 (5,135,947,500원) - 원주무실 전기공사 2공구

㈜도화엔지니어링
- 계약일 : 2025.03.20 (1,885,692,595원) - 충북혁신 전기공사 1공구

㈜온세이엔씨
- 계약일 : 2025.03.12(6,576,671,731원) - 의정부우정 전기공사 1공구

㈜보원엔지니어링
- 계약일 : 2025.03.12(2,818,573,599원) - 의정부우정 전기공사 1공구

(유)우전
- 계약일 : 2026.01.14(4,596,128,195원) - 인천계양 전기공사 4공구

대명에너지㈜
- 계약일 : 2026.01.14(919,225,639원) - 인천계양 전기공사 4공구

에스지씨이앤씨㈜
- 계약일 : 2025.12.22 - 시흥거모 A-7BL 아파트 건설공사 5공구

일성건설㈜
- 계약일 : 2025.12.22 - 경산대임 A-3BL 아파트 건설공사 3공구

㈜대광건영
- 계약일 : 2025.12.16 - 수원당수 B-3BL 아파트 건설공사 7공구

㈜녹십자이엠
- 계약일 : 2025.11.12`;

const sanitizeCompanyName = (value) => {
  if (!value) return '';
  let result = String(value).trim();
  result = result.replace(/㈜/g, '');
  result = result.replace(/\(주\)/g, '');
  result = result.replace(/\(유\)/g, '');
  result = result.replace(/\(합\)/g, '');
  result = result.replace(/주식회사/g, '');
  result = result.replace(/\s+/g, ' ').trim();
  return result;
};

const normalizeCompanyKey = (value) => sanitizeCompanyName(value).toLowerCase();

const parseSimpleDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const raw = String(value).trim();
  const match = raw.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
};

const withinPreviousYear = (contractDate, noticeDate) => {
  if (!(contractDate instanceof Date) || Number.isNaN(contractDate.getTime())) return false;
  if (!(noticeDate instanceof Date) || Number.isNaN(noticeDate.getTime())) return false;
  if (contractDate.getTime() > noticeDate.getTime()) return false;
  const oneYearAgo = new Date(noticeDate.getFullYear() - 1, noticeDate.getMonth(), noticeDate.getDate());
  return contractDate.getTime() >= oneYearAgo.getTime();
};

const LH_AWARD_HISTORY = [
  { companyName: '㈜지음이엔아이', contracts: ['2025.03.20', '2025.09.03'] },
  { companyName: '㈜아람이엔테크', contracts: ['2025.10.16'] },
  { companyName: '㈜대흥디씨티', contracts: ['2025.10.16'] },
  { companyName: '㈜성전사', contracts: ['2025.03.06'] },
  { companyName: '㈜대상전력', contracts: ['2025.03.06'] },
  { companyName: '일렉파워㈜', contracts: ['2025.03.13'] },
  { companyName: '㈜송원이앤씨', contracts: ['2025.03.13'] },
  { companyName: '㈜부현전기', contracts: ['2025.10.16', '2025.06.25'] },
  { companyName: '신신이앤씨㈜', contracts: ['2025.04.03'] },
  { companyName: '㈜도화엔지니어링', contracts: ['2025.03.20'] },
  { companyName: '㈜온세이엔씨', contracts: ['2025.03.12'] },
  { companyName: '㈜보원엔지니어링', contracts: ['2025.03.12'] },
  { companyName: '(유)우전', contracts: ['2026.01.14'] },
  { companyName: '대명에너지㈜', contracts: ['2026.01.14'] },
  { companyName: '에스지씨이앤씨㈜', contracts: ['2025.12.22'] },
  { companyName: '일성건설㈜', contracts: ['2025.12.22'] },
  { companyName: '㈜대광건영', contracts: ['2025.12.16'] },
  { companyName: '㈜녹십자이엠', contracts: ['2025.11.12'] },
].map((entry) => ({
  ...entry,
  companyKey: normalizeCompanyKey(entry.companyName),
  contractDates: entry.contracts.map(parseSimpleDate).filter(Boolean),
}));

const LH_AWARD_HISTORY_BY_COMPANY = new Map(
  LH_AWARD_HISTORY.map((entry) => [entry.companyKey, entry]),
);

export function getLhAwardHistoryText() {
  return LH_AWARD_HISTORY_RAW_TEXT;
}

export function hasRecentLhAwardHistory(companyName, noticeDate) {
  const notice = parseSimpleDate(noticeDate);
  if (!notice) return false;
  const key = normalizeCompanyKey(companyName);
  if (!key) return false;
  const entry = LH_AWARD_HISTORY_BY_COMPANY.get(key);
  if (!entry) return false;
  return entry.contractDates.some((contractDate) => withinPreviousYear(contractDate, notice));
}
