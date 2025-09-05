// CommonJS module exporting default rules shape and a simple validator

function defaultRules() {
  return {
    version: 1,
    owners: [
      {
        id: 'LH',
        name: '한국토지주택공사',
        kinds: [
          { id: 'eung', rules: baseKindRules() },
          { id: 'tongsin', rules: baseKindRules() },
          { id: 'sobang', rules: baseKindRules() },
        ],
      },
    ],
  };
}

function baseKindRules() {
  return {
    excludeSingleBidEligible: true,
    alwaysInclude: [], // [{ bizNo, name, note }]
    alwaysExclude: [], // [{ bizNo, name, note }]
    pinCompanies: [],  // [{ bizNo, name, minShare?, maxShare?, note? }]
    fixedJV: [],       // [{ leader:{bizNo,name,share?}, members:[{bizNo,name,share?}], note? }]
    teamConstraints: { minSize: 2, maxSize: 4 },
    shareConstraints: { minPerMember: 0, maxPerMember: 100, shareStep: 1 },
    banPairs: [],      // [[{bizNo?,name?},{bizNo?,name?}], ...]
    // 담당자(비고에서 추출된 담당자명) 간 금지 조합
    banManagerPairs: [], // [["홍길동","김철수"], ...]
    banSameManager: false, // true면 동일 담당자 2인 이상 포함 금지
    // 선택적으로 지역 의무를 강제 오버라이드 할 수 있음
    regionDutyOverride: null, // { dutyRegions: ["경기","강원"], mode: 'anyOne'|'shareSum', rate?: number }
  };
}

function validateRules(rules) {
  const errors = [];
  if (!rules || typeof rules !== 'object') return { ok: false, errors: ['payload must be object'] };
  if (!Array.isArray(rules.owners)) errors.push('owners must be array');
  (rules.owners || []).forEach((o, oi) => {
    if (!o || typeof o !== 'object') errors.push(`owners[${oi}] must be object`);
    if (!Array.isArray(o.kinds)) errors.push(`owners[${oi}].kinds must be array`);
  });
  return { ok: errors.length === 0, errors };
}

module.exports = { defaultRules, validateRules };

