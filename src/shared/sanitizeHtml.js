const ALLOWED_STYLE_PROPERTIES = new Set(['color', 'background-color', 'font-size', 'text-align']);

const sanitizeStyle = (styleValue) => {
  if (!styleValue) return '';
  const safeRules = [];
  styleValue.split(';').forEach((rule) => {
    const [prop, rawValue] = rule.split(':');
    if (!prop || !rawValue) return;
    const name = prop.trim().toLowerCase();
    if (!ALLOWED_STYLE_PROPERTIES.has(name)) return;
    const value = rawValue.trim();
    if (!value) return;
    safeRules.push(`${name}: ${value}`);
  });
  return safeRules.join('; ');
};

export function sanitizeHtml(input) {
  if (!input) return '';
  try {
    const template = document.createElement('template');
    template.innerHTML = input;
    template.content.querySelectorAll('script, style, iframe, object').forEach((node) => node.remove());
    template.content.querySelectorAll('*').forEach((el) => {
      Array.from(el.attributes).forEach((attr) => {
        const name = attr.name.toLowerCase();
        if (name.startsWith('on')) {
          el.removeAttribute(attr.name);
          return;
        }
        if (name === 'style') {
          const cleaned = sanitizeStyle(attr.value);
          if (cleaned) {
            el.setAttribute('style', cleaned);
          } else {
            el.removeAttribute(attr.name);
          }
        }
      });
    });
    return template.innerHTML;
  } catch (error) {
    console.warn('[Renderer] Failed to sanitize HTML:', error);
    return '';
  }
}

export default sanitizeHtml;
