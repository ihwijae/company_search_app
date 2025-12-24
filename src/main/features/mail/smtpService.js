const nodemailer = require('nodemailer');

const sanitizeString = (value) => (typeof value === 'string' ? value.trim() : '');

const buildFromHeader = (name, email) => {
  const address = sanitizeString(email);
  if (!address) return '';
  const display = sanitizeString(name).replace(/"/g, "'");
  return display ? `"${display}" <${address}>` : address;
};

const normalizePort = (value, fallback = 465) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return numeric;
};

async function sendTestMail(payload = {}) {
  const connection = payload.connection || {};
  const auth = connection.auth || {};
  const host = sanitizeString(connection.host);
  const port = normalizePort(connection.port, connection.secure ? 465 : 587);
  const secure = Boolean(connection.secure);
  const username = sanitizeString(auth.user || auth.username);
  const password = typeof auth.pass === 'string' ? auth.pass : (typeof auth.password === 'string' ? auth.password : '');

  if (!host) {
    throw new Error('SMTP 호스트를 입력해 주세요.');
  }
  if (!username || !password) {
    throw new Error('SMTP 계정 또는 비밀번호가 비어 있습니다.');
  }

  const fromAddress = sanitizeString(payload.message?.from);
  const toAddress = sanitizeString(payload.message?.to || fromAddress);
  if (!fromAddress) {
    throw new Error('발신 이메일 주소를 입력해 주세요.');
  }
  if (!toAddress) {
    throw new Error('수신 이메일 주소를 입력해 주세요.');
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user: username, pass: password },
    tls: {
      rejectUnauthorized: connection.rejectUnauthorized !== false,
    },
  });

  const subject = payload.message?.subject || '[테스트] SMTP 연결 확인';
  const text = payload.message?.text || '이 메일은 SMTP 연결 테스트용으로 발송되었습니다.';
  const replyTo = sanitizeString(payload.message?.replyTo);

  const info = await transporter.sendMail({
    from: buildFromHeader(payload.message?.fromName, fromAddress),
    to: toAddress,
    replyTo: replyTo || undefined,
    subject,
    text,
  });

  try { await transporter.close?.(); } catch {}

  return {
    success: true,
    messageId: info?.messageId || null,
    accepted: Array.isArray(info?.accepted) ? info.accepted : [],
    response: info?.response || '',
  };
}

module.exports = {
  sendTestMail,
};
