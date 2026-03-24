const normalizeBizNo = (value) => String(value || '').replace(/[^0-9]/g, '');

const normalizeCompanyKey = (value) => (
  String(value || '')
    .replace(/\s+/g, '')
    .replace(/주식회사|\(주\)|\(유\)|㈜|㈐/g, '')
    .toLowerCase()
);

const stripCompanyCorp = (value) => (
  String(value || '')
    .replace(/주식회사/g, '')
    .replace(/\(주\)|\(유\)|㈜|㈐/g, '')
    .replace(/\s+/g, ' ')
    .trim()
);

const formatBizNo = (value) => {
  const digits = normalizeBizNo(value);
  if (digits.length !== 10) return value ? String(value).trim() : '';
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
};

const getShareText = (value) => {
  const text = String(value ?? '').trim();
  if (!text) return '0';
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) return text;
  return Number.isInteger(parsed) ? String(parsed) : String(parsed);
};

const getCandidateName = (candidate) => (
  candidate?.name
  || candidate?.companyName
  || candidate?.bizName
  || candidate?.['업체명']
  || candidate?.['검색된 회사']
  || candidate?.snapshot?.['업체명']
  || candidate?.snapshot?.['검색된 회사']
  || ''
);

const getCandidateBizNo = (candidate) => (
  candidate?.bizNo
  || candidate?.biz_no
  || candidate?.bizno
  || candidate?.bizNumber
  || candidate?.biznumber
  || candidate?.businessNumber
  || candidate?.['사업자번호']
  || candidate?.['사업자 번호']
  || candidate?.['사업자등록번호']
  || candidate?.['사업자등록 번호']
  || candidate?.['법인등록번호']
  || candidate?.['법인등록 번호']
  || candidate?.['법인번호']
  || candidate?.snapshot?.bizNo
  || candidate?.snapshot?.biz_no
  || candidate?.snapshot?.bizno
  || candidate?.snapshot?.bizNumber
  || candidate?.snapshot?.biznumber
  || candidate?.snapshot?.businessNumber
  || candidate?.snapshot?.['사업자번호']
  || candidate?.snapshot?.['사업자 번호']
  || candidate?.snapshot?.['사업자등록번호']
  || candidate?.snapshot?.['사업자등록 번호']
  || candidate?.snapshot?.['법인등록번호']
  || candidate?.snapshot?.['법인등록 번호']
  || candidate?.snapshot?.['법인번호']
  || ''
);

const TOP_AMOUNT_TARGETS = new Set([
  '삼보종합이앤씨',
  '김앤드이',
  '스타버킷',
  '포어링크',
  '하나전기',
  '동우텍',
  '일렉파워',
  '비에이에너지',
  '케이너스',
  '아이디스',
]);

const LOWER_SECTION_TARGETS = new Set([
  '지음이엔아이',
  '대흥디씨티',
  '삼영플랜트',
  '이엘케이',
  '엠라이테크',
  '영웅개발',
]);

const UPPER_SECTION_TARGETS = new Set([
  '아람이엔테크',
  '우진일렉트',
  '지음쏠라테크',
  '에코엠이엔씨',
]);

const getSoloDisplayName = (name) => {
  const stripped = stripCompanyCorp(name);
  return stripped;
};

const isSoloGroup = (members) => {
  if (members.length !== 1) return false;
  const share = Number(getShareText(members[0]?.share));
  return Number.isFinite(share) && share === 100;
};

const buildGroupBlock = (members, lhLeaderBizNoFormat = false) => {
  if (!Array.isArray(members) || members.length === 0) return '';
  if (isSoloGroup(members)) {
    return `${getSoloDisplayName(members[0].name)} 단독`;
  }
  const leaderBizNo = members[0]?.bizNo || '';
  return members.map((member, index) => {
    const name = String(member.name || '').trim();
    const shareText = getShareText(member.share);
    if (index === 0) {
      const leaderBiz = lhLeaderBizNoFormat ? formatBizNo(leaderBizNo) : '';
      return leaderBiz ? `${name} ${shareText}% [${leaderBiz}]` : `${name} ${shareText}%`;
    }
    if (lhLeaderBizNoFormat) {
      return `${name} ${shareText}%`;
    }
    const bizNo = formatBizNo(member.bizNo);
    return bizNo ? `${name} ${shareText}% [${bizNo}]` : `${name} ${shareText}%`;
  }).join('\n');
};

const classifyGroup = (members) => {
  const normalizedNames = members.map((member) => normalizeCompanyKey(member.name));
  const leaderKey = normalizedNames[0] || '';
  if (leaderKey && TOP_AMOUNT_TARGETS.has(leaderKey)) return 'top';
  if (normalizedNames.some((name) => LOWER_SECTION_TARGETS.has(name))) return 'lower';
  if (normalizedNames.some((name) => UPPER_SECTION_TARGETS.has(name))) return 'upper';
  return null;
};

export const buildInconMemoText = ({
  fileType = '',
  dutyRegions = [],
  groupAssignments = [],
  groupShares = [],
  groupApprovals = [],
  participantMap,
  lhLeaderBizNoFormat = false,
}) => {
  const topLines = [];
  const upperBlocks = [];
  const lowerBlocks = [];

  groupAssignments.forEach((group, groupIndex) => {
    const memberIds = Array.isArray(group) ? group.filter(Boolean) : [];
    if (memberIds.length === 0) return;

    const approval = String(groupApprovals[groupIndex] || '').trim();
    if (approval === '취소') return;

    const members = memberIds.map((uid, slotIndex) => {
      const entry = participantMap?.get(uid);
      const candidate = entry?.candidate || null;
      return {
        name: String(getCandidateName(candidate) || '').trim(),
        bizNo: getCandidateBizNo(candidate),
        share: groupShares[groupIndex]?.[slotIndex] ?? '',
      };
    }).filter((member) => member.name);

    if (members.length === 0) return;

    const section = classifyGroup(members);
    if (!section) return;

    if (section === 'top') {
      topLines.push(`${getSoloDisplayName(members[0].name)} 금액`);
      return;
    }

    const block = buildGroupBlock(members, lhLeaderBizNoFormat);
    if (!block) return;

    if (section === 'upper') {
      upperBlocks.push(block);
      return;
    }
    lowerBlocks.push(block);
  });

  const isTongsin = String(fileType || '').trim().toLowerCase() === 'tongsin';
  const hasDaejeonDuty = Array.isArray(dutyRegions)
    && dutyRegions.some((region) => String(region || '').replace(/\s+/g, '').includes('대전'));
  if (isTongsin && hasDaejeonDuty && !topLines.includes('아이디스 금액')) {
    topLines.push('아이디스 금액');
  }

  const sections = [];
  if (topLines.length > 0) sections.push(topLines.join('\n'));
  if (upperBlocks.length > 0) sections.push(upperBlocks.join('\n\n'));
  if (lowerBlocks.length > 0) {
    const lowerSection = lowerBlocks.join('\n\n');
    if (sections.length > 0) {
      sections.push(`-----------\n\n${lowerSection}`);
    } else {
      sections.push(lowerSection);
    }
  }

  return sections.join('\n\n').trim();
};
