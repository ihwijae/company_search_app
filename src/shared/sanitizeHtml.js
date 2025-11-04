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
        }
        if (name === 'style') {
          el.removeAttribute(attr.name);
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
