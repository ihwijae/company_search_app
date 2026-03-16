export function openTempCompaniesWindow({ industry = '' } = {}) {
  if (typeof window === 'undefined') {
    throw new Error('브라우저 환경에서만 임시 업체 창을 열 수 있습니다.');
  }

  const width = Math.min(1280, Math.max(980, window.innerWidth - 120));
  const height = Math.min(920, Math.max(760, window.innerHeight - 96));
  const dualScreenLeft = window.screenLeft !== undefined ? window.screenLeft : window.screenX;
  const dualScreenTop = window.screenTop !== undefined ? window.screenTop : window.screenY;
  const left = Math.max(24, dualScreenLeft + Math.max(0, (window.innerWidth - width) / 2));
  const top = Math.max(32, dualScreenTop + Math.max(0, (window.innerHeight - height) / 3));
  const features = `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`;
  const baseHref = String(window.location.href || '').split('#')[0];
  const normalizedIndustry = String(industry || '').trim();
  const hash = normalizedIndustry
    ? `#/temp-companies?industry=${encodeURIComponent(normalizedIndustry)}`
    : '#/temp-companies';
  const child = window.open(`${baseHref}${hash}`, 'temp-companies-window', features);
  if (!child) {
    throw new Error('임시 업체 창을 열지 못했습니다.');
  }
  try { child.focus(); } catch {}
  return child;
}

export default openTempCompaniesWindow;
