const {
  createSmppClient,
  fetchListHtml,
  fetchSummaryHtmlFromList,
} = require('./smppHttp');
const { parseCorpFeatures } = require('./smppParser');

let cachedClient = null;
let cachedCreds = null;
let lastLoginAt = 0;
const SESSION_TTL_MS = 15 * 60 * 1000;

const normalizeBizNo = (value) => String(value || '').replace(/\D/g, '');

const looksLikeLoginPage = (html) => {
  if (!html) return false;
  const token = String(html);
  return token.includes('loginForm') && (token.includes('로그인') || token.includes('아이디'));
};

async function ensureClient(userId, password) {
  const now = Date.now();
  const needNewSession = !cachedClient
    || !cachedCreds
    || cachedCreds.id !== userId
    || cachedCreds.password !== password
    || (now - lastLoginAt) > SESSION_TTL_MS;

  if (needNewSession) {
    cachedClient = await createSmppClient(userId, password);
    cachedCreds = { id: userId, password };
    lastLoginAt = now;
  }
  return cachedClient;
}

async function checkSingleCorp(userId, password, bizNo) {
  const normalizedBizNo = normalizeBizNo(bizNo);
  if (!normalizedBizNo) {
    return { bizNo: '', features: null, error: '사업자등록번호를 확인하세요.' };
  }
  if (!userId || !password) {
    return { bizNo: normalizedBizNo, features: null, error: 'SMPP ID와 비밀번호를 입력하세요.' };
  }

  try {
    const client = await ensureClient(userId, password);
    let listHtml = await fetchListHtml(client, normalizedBizNo);
    if (looksLikeLoginPage(listHtml)) {
      cachedClient = await createSmppClient(userId, password);
      cachedCreds = { id: userId, password };
      lastLoginAt = Date.now();
      listHtml = await fetchListHtml(cachedClient, normalizedBizNo);
    }

    const summaryHtml = await fetchSummaryHtmlFromList(cachedClient, listHtml, normalizedBizNo);
    if (looksLikeLoginPage(summaryHtml)) {
      throw new Error('SMPP 세션이 만료되었습니다. 다시 시도하세요.');
    }

    const features = parseCorpFeatures(summaryHtml);
    console.log('[SMPP] lookup success:', {
      bizNo: normalizedBizNo,
      women: features?.women,
      small: features?.small,
    });
    return {
      bizNo: normalizedBizNo,
      features,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    return {
      bizNo: normalizedBizNo,
      features: null,
      error: err?.message || 'SMPP 조회에 실패했습니다.',
    };
  }
}

module.exports = {
  checkSingleCorp,
};
