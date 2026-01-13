export const BASE_ROUTES = {
  search: '#/search',
  agreements: '#/agreements',
  agreementBoard: '#/agreement-board',
  regionSearch: '#/region-search',
  settings: '#/settings',
  autoAgreement: '#/auto-agreement',
};

export const AGREEMENT_GROUPS = [
  {
    id: 'lh',
    ownerId: 'LH',
    label: 'LH',
    name: '한국토지주택공사',
    hashPrefix: '#/lh/',
    items: [
      { key: 'lh-under50', hash: '#/lh/under50', label: '50억 미만', rangeLabel: '50억 미만' },
      { key: 'lh-50to100', hash: '#/lh/50to100', label: '50억~100억', rangeLabel: '50억~100억' },
    ],
  },
  {
    id: 'krail',
    ownerId: 'KRAIL',
    label: '국가철도공단',
    name: '국가철도공단',
    hashPrefix: '#/krail/',
    items: [
      { key: 'krail-under50', hash: '#/krail/under50', label: '50억 미만', rangeLabel: '50억 미만' },
      { key: 'krail-50to100', hash: '#/krail/50to100', label: '50억~100억', rangeLabel: '50억~100억' },
    ],
  },
  {
    id: 'pps',
    ownerId: 'PPS',
    label: '조달청',
    name: '조달청',
    hashPrefix: '#/pps/',
    items: [
      { key: 'pps-under50', hash: '#/pps/under50', label: '50억 미만', rangeLabel: '50억 미만' },
      { key: 'pps-50to100', hash: '#/pps/50to100', label: '50억~100억', rangeLabel: '50억~100억' },
    ],
  },
  {
    id: 'mois',
    ownerId: 'MOIS',
    label: '행안부',
    name: '행정안전부',
    hashPrefix: '#/mois/',
    items: [
      { key: 'mois-under30', hash: '#/mois/under30', label: '30억 미만', rangeLabel: '30억 미만' },
      { key: 'mois-30to50', hash: '#/mois/30to50', label: '30억~50억', rangeLabel: '30억~50억' },
      { key: 'mois-50to100', hash: '#/mois/50to100', label: '50억~100억', rangeLabel: '50억~100억' },
    ],
  },
];

export const AGREEMENT_MENU_ITEMS = AGREEMENT_GROUPS.flatMap((group) =>
  group.items.map((item) => ({ ...item, groupId: group.id, ownerId: group.ownerId, groupLabel: group.label }))
);

const HASH_TO_MENU = new Map(AGREEMENT_MENU_ITEMS.map((item) => [item.hash, item]));
const KEY_TO_MENU = new Map(AGREEMENT_MENU_ITEMS.map((item) => [item.key, item]));

export function findMenuByHash(hash = '') {
  if (!hash) return null;
  const normalized = hash.startsWith('#') ? hash : `#${hash}`;
  return HASH_TO_MENU.get(normalized) || null;
}

export function findMenuByKey(key) {
  return KEY_TO_MENU.get(key) || null;
}

export function isAgreementHash(hash = '') {
  return AGREEMENT_GROUPS.some((group) => (hash || '').includes(group.hashPrefix));
}

export function getGroupById(groupId) {
  return AGREEMENT_GROUPS.find((group) => group.id === groupId) || null;
}

export function getGroupByHash(hash = '') {
  return AGREEMENT_GROUPS.find((group) => (hash || '').includes(group.hashPrefix)) || null;
}
