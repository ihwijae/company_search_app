// CommonJS module exporting default rules shape and a simple validator

const KIND_IDS = ['eung', 'tongsin', 'sobang'];

function makeDefaultKinds() {
  return KIND_IDS.map((id) => ({ id, rules: baseKindRules() }));
}

function defaultRules() {
  return {
    version: 1,
    globalRules: {
      kinds: makeDefaultKinds(),
    },
    owners: [
      {
        id: 'LH',
        name: '한국토지주택공사',
        kinds: makeDefaultKinds(),
      },
      {
        id: 'MOIS',
        name: '행정안전부',
        kinds: makeDefaultKinds(),
      },
    ],
    regions: [],
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

function validateKindArray(list, label, errors) {
  if (!Array.isArray(list)) {
    errors.push(`${label} must be array`);
    return;
  }
  list.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      errors.push(`${label}[${index}] must be object`);
      return;
    }
    if (entry.rules !== undefined && typeof entry.rules !== 'object') {
      errors.push(`${label}[${index}].rules must be object`);
    }
  });
}

function validateRules(rules) {
  const errors = [];
  if (!rules || typeof rules !== 'object') return { ok: false, errors: ['payload must be object'] };
  if (!Array.isArray(rules.owners)) errors.push('owners must be array');
  (rules.owners || []).forEach((owner, oi) => {
    if (!owner || typeof owner !== 'object') {
      errors.push(`owners[${oi}] must be object`);
      return;
    }
    if (owner.kinds !== undefined) {
      validateKindArray(owner.kinds, `owners[${oi}].kinds`, errors);
    }
    if (Array.isArray(owner.ranges)) {
      owner.ranges.forEach((range, ri) => {
        if (!range || typeof range !== 'object') {
          errors.push(`owners[${oi}].ranges[${ri}] must be object`);
          return;
        }
        validateKindArray(range.kinds, `owners[${oi}].ranges[${ri}].kinds`, errors);
      });
    }
  });
  if (rules.globalRules && typeof rules.globalRules === 'object') {
    validateKindArray(rules.globalRules.kinds, 'globalRules.kinds', errors);
  }
  if (rules.regions !== undefined) {
    if (!Array.isArray(rules.regions)) {
      errors.push('regions must be array');
    } else {
      rules.regions.forEach((region, ri) => {
        if (!region || typeof region !== 'object') {
          errors.push(`regions[${ri}] must be object`);
          return;
        }
        validateKindArray(region.kinds, `regions[${ri}].kinds`, errors);
      });
    }
  }
  return { ok: errors.length === 0, errors };
}

module.exports = { defaultRules, validateRules };

