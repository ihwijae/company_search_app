const axios = require('axios');
const { CookieJar } = require('tough-cookie');
const cheerio = require('cheerio');

const loadCookieJarSupport = (() => {
  let cached = null;
  return async () => {
    if (cached) return cached;
    const mod = await import('axios-cookiejar-support');
    const fn = mod?.default || mod?.axiosCookieJarSupport || mod?.wrapper;
    cached = typeof fn === 'function' ? fn : (() => {});
    return cached;
  };
})();

const USER_AGENT = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  'AppleWebKit/537.36 (KHTML, like Gecko)',
  'Chrome/120.0.0.0 Safari/537.36',
].join(' ');

const LOGIN_PAGE_URL = 'https://www.smpp.go.kr/uat/uia/egovLoginUsr.do';
const LOGIN_ACTION_URL = 'https://www.smpp.go.kr/uat/uia/actionLogin.do';
const LIST_URL = 'https://www.smpp.go.kr/cop/registcorp/selectRegistCorpListVw.do';
const SUMMARY_URL = 'https://www.smpp.go.kr/cop/registcorp/selectRegistCorpSumryInfoVw.do';
const REQUEST_TIMEOUT_MS = 20000;

const encodeForm = (payload) => new URLSearchParams(payload).toString();

async function createSmppClient(userId, password) {
  if (!userId || !password) {
    throw new Error('SMPP 계정을 입력하세요.');
  }

  const jar = new CookieJar();
  const client = axios.create({
    jar,
    withCredentials: true,
    timeout: REQUEST_TIMEOUT_MS,
    headers: { 'User-Agent': USER_AGENT },
  });
  try {
    const applySupport = await loadCookieJarSupport();
    applySupport(client);
  } catch (err) {
    console.warn('[SMPP] 쿠키 지원 초기화 실패:', err?.message || err);
  }

  const pre = await client.get(LOGIN_PAGE_URL, {
    headers: { 'User-Agent': USER_AGENT },
  });
  try {
    console.log('[SMPP] login page status:', pre?.status);
  } catch {}
  const $ = cheerio.load(pre.data || '');
  const form = $('form[name="loginForm"], form#loginForm').first();
  if (!form.length) {
    throw new Error('SMPP 로그인 폼을 찾지 못했습니다.');
  }

  const formData = {};
  form.find('input[name]').each((_, el) => {
    const name = $(el).attr('name');
    if (!name) return;
    const value = $(el).attr('value') ?? '';
    formData[name] = value;
  });

  formData.id = userId;
  formData.password = password;

  const payload = encodeForm(formData);
  let resp;
  try {
    resp = await client.post(LOGIN_ACTION_URL, payload, {
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/x-www-form-urlencoded',
        Origin: 'https://www.smpp.go.kr',
        Referer: LOGIN_PAGE_URL,
      },
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 400,
    });
    console.log('[SMPP] login action status:', resp?.status);
  } catch (err) {
    console.error('[SMPP] login request failed:', err?.message, err?.response?.status);
    if (err?.response?.status === 403) {
      console.error('[SMPP] login response body preview:', String(err?.response?.data || '').slice(0, 200));
    }
    throw err;
  }

  const body = resp?.data ? String(resp.data) : '';
  if (body.includes('아이디 입력') && body.includes('loginForm')) {
    throw new Error('SMPP 로그인에 실패했습니다.');
  }

  return client;
}

async function fetchListHtml(client, bizNo) {
  if (!client) throw new Error('SMPP 세션이 없습니다.');
  const digits = String(bizNo || '').replace(/\D/g, '');
  if (!digits) throw new Error('사업자등록번호를 입력하세요.');

  const payload = encodeForm({
    chks: '',
    fileType: '',
    pageIndex: '1',
    ctprvnNm: '전체',
    signguNm: '전체',
    cntrctEsntlNo: '',
    entrpsNm: '',
    searchBsnmNo: digits,
    chargerNm: '',
    detailPrdnm: '',
    detailPrdnmNo: '',
    ksicNm: '',
    ksic: '',
    prductNm: '',
    ctprvnCode: '',
    signguCode: '',
    smbizCode: '',
    femtrbleCode: '',
    hitechCode: '',
    envqualCode: '',
    entrpsNmMbl: '',
    searchBsnmNoMbl: '',
    chargerNmMbl: '',
    pageUnit: '15',
  });

  try {
    console.log('[SMPP] list request start:', { bizNo: digits });
  } catch {}

  try {
    const resp = await client.post(LIST_URL, payload, {
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: LIST_URL,
      },
    });

    try {
      console.log('[SMPP] list response status:', resp?.status);
    } catch {}

    return resp?.data ? String(resp.data) : '';
  } catch (err) {
    console.error('[SMPP] list request failed:', err?.message, err?.response?.status);
    if (err?.response?.status === 403) {
      console.error('[SMPP] list response body preview:', String(err?.response?.data || '').slice(0, 200));
    }
    throw err;
  }
}

async function fetchSummaryHtmlFromList(client, listHtml, bizNo) {
  if (!client) throw new Error('SMPP 세션이 없습니다.');
  const $ = cheerio.load(listHtml || '');
  const moveForm = $('form[name="moveForm"]').first();
  if (!moveForm.length) {
    throw new Error('SMPP 상세 폼이 응답에 없습니다.');
  }

  const payload = {};
  moveForm.find('input[name]').each((_, el) => {
    const name = $(el).attr('name');
    if (!name) return;
    payload[name] = $(el).attr('value') ?? '';
  });

  const digits = String(bizNo || '').replace(/\D/g, '');
  payload.bsnmNo = digits;
  if (payload.searchBsnmNo === undefined || payload.searchBsnmNo === '') {
    payload.searchBsnmNo = digits;
  }

  try {
    console.log('[SMPP] summary request start:', { bizNo: digits });
  } catch {}

  try {
    const resp = await client.post(SUMMARY_URL, encodeForm(payload), {
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/x-www-form-urlencoded',
        Origin: 'https://www.smpp.go.kr',
        Referer: LIST_URL,
      },
    });

    try {
      console.log('[SMPP] summary response status:', resp?.status);
    } catch {}

    return resp?.data ? String(resp.data) : '';
  } catch (err) {
    console.error('[SMPP] summary request failed:', err?.message, err?.response?.status);
    if (err?.response?.status === 403) {
      console.error('[SMPP] summary response body preview:', String(err?.response?.data || '').slice(0, 200));
    }
    throw err;
  }
}

module.exports = {
  createSmppClient,
  fetchListHtml,
  fetchSummaryHtmlFromList,
};
