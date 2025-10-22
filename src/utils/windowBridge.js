/**
 * Copy inline <style> elements and linked stylesheets from the source document
 * to the target document. Helps ensure popup windows inherit the app styling.
 */
export function copyDocumentStyles(sourceDoc, targetDoc) {
  if (!sourceDoc || !targetDoc) return;

  const marker = 'data-window-bridge-style';

  try {
    const existing = targetDoc.querySelectorAll(`[${marker}]`);
    existing.forEach((node) => {
      if (node?.parentNode) node.parentNode.removeChild(node);
    });
  } catch {
    /* ignore cleanup errors */
  }

  Array.from(sourceDoc.styleSheets).forEach((styleSheet) => {
    try {
      if (styleSheet.href) {
        const link = targetDoc.createElement('link');
        link.rel = 'stylesheet';
        link.href = styleSheet.href;
        link.setAttribute(marker, '1');
        targetDoc.head.appendChild(link);
      } else if (styleSheet.ownerNode && styleSheet.ownerNode.textContent) {
        const style = targetDoc.createElement('style');
        style.type = 'text/css';
        style.textContent = styleSheet.ownerNode.textContent;
        style.setAttribute(marker, '1');
        targetDoc.head.appendChild(style);
      }
    } catch {
      // Accessing cross-origin stylesheets can throw; skip those.
    }
  });
}

