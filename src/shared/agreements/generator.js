// Agreements text generator and validation (shared, UI-agnostic)

const OWNER = {
  MOIS: '행정안전부 조달청',
  LH: '한국토지주택공사',
};

function normalizeShare(v) {
  if (v === null || v === undefined) return NaN;
  const s = String(v).trim();
  if (!s) return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function formatBizNo(bizNo) {
  const cleaned = String(bizNo || '').replace(/[^0-9]/g, '');
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 5)}-${cleaned.slice(5)}`;
  }
  return cleaned;
}

function hasDuplicateNames(item) {
  const names = [];
  if (item?.leader?.name) names.push(String(item.leader.name).trim());
  (item?.members || []).forEach(m => { if (m?.name) names.push(String(m.name).trim()); });
  const seen = new Set();
  for (const n of names) {
    if (!n) continue;
    if (seen.has(n)) return true;
    seen.add(n);
  }
  return false;
}

export function validateAgreement(item) {
  const errors = [];
  if (!item?.noticeNo || !String(item.noticeNo).trim()) errors.push('공고번호를 입력하세요');
  if (!item?.title || !String(item.title).trim()) errors.push('공고명을 입력하세요');
  if (!item?.leader?.name || !String(item.leader.name).trim()) errors.push('대표사를 선택/입력하세요');
  const lShare = normalizeShare(item?.leader?.share);
  if (!Number.isFinite(lShare)) errors.push('대표사 지분(%)를 입력하세요');
  if ((item?.members || []).length > 4) errors.push('구성원은 최대 4명입니다.');

  if (hasDuplicateNames(item)) errors.push('대표사/구성원에 중복 업체가 있습니다.');

  return { ok: errors.length === 0, errors };
}

function isMOIS(owner) {
  const raw = String(owner || '').trim();
  if (!raw) return false;
  const upper = raw.toUpperCase();
  if (upper === 'MOIS') return true;
  return /행정|행안|조달/.test(raw);
}

function isLH(owner) {
  const s = String(owner || '');
  return /주택공사|LH/.test(s);
}

function isPPS(owner) {
  const s = String(owner || '');
  return /조달청|PPS/.test(s);
}

function needsHeader(owner) {
  return !isMOIS(owner) && !isPPS(owner);
}

function leaderNeedsBizNo(owner) {
  return isLH(owner); // LH only
}

function memberNeedsBizNo(owner) {
  if (isMOIS(owner)) return true; // MOIS: member biz no
  if (isLH(owner)) return false;  // LH: no member biz no
  return true; // others: member biz no
}

export function generateOne(item) {
  const lines = [];
  const owner = String(item.owner || '').trim();
  const ownerDisplayName = owner === 'LH' ? '한국토지주택공사' : owner;

  if (needsHeader(owner)) lines.push(`[${ownerDisplayName}]`);
  lines.push(`${item.noticeNo} ${item.title}`);
  lines.push('');

  const leaderName = String(item.leader?.name || '').trim();
  const leaderShare = String(item.leader?.share || '').trim();
  if (leaderName && leaderShare) {
    const leaderBiz = leaderNeedsBizNo(owner) && item.leader?.bizNo ? ` [${formatBizNo(item.leader.bizNo)}]` : '';
    lines.push(`${leaderName} ${leaderShare}%${leaderBiz}`);
  }

  const effectiveMembers = (item.members || [])
    .filter(m => String(m?.name || '').trim() && String(m?.share || '').trim());
  effectiveMembers.forEach(m => {
    const n = String(m?.name || '').trim();
    const s = String(m?.share || '').trim();
    const biz = memberNeedsBizNo(owner) && m?.bizNo ? ` [${formatBizNo(m.bizNo)}]` : '';
    lines.push(`${n} ${s}%${biz}`);
  });
  lines.push('');
  const leaderShareNum = Number(leaderShare);
  if (Number.isFinite(leaderShareNum) && leaderShareNum === 100 && effectiveMembers.length === 0) {
    lines.push('입찰 참여 부탁드립니다.');
  } else {
    lines.push('협정 부탁드립니다.');
  }
  return lines.join('\n');
}

export function generateMany(items) {
  const sep = '---------------------';
  const blocks = (items || []).map(it => generateOne(it));
  return blocks.join(`\n\n${sep}\n\n`);
}

export function helpers() {
  return { hasDuplicateNames };
}
