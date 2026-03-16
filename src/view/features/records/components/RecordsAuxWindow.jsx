import React from 'react';
import { createPortal } from 'react-dom';
import { copyDocumentStyles } from '../../../../utils/windowBridge.js';

export default function RecordsAuxWindow({
  open,
  title,
  description = '',
  width = 430,
  height = 360,
  windowName = 'company-search-records-aux',
  onClose,
  children,
}) {
  const windowRef = React.useRef(null);
  const [portalContainer, setPortalContainer] = React.useState(null);

  const closeWindow = React.useCallback(() => {
    const win = windowRef.current;
    if (win && !win.closed) {
      if (win.__recordsAuxCleanup) {
        try { win.__recordsAuxCleanup(); } catch {}
        delete win.__recordsAuxCleanup;
      }
      win.close();
    }
    windowRef.current = null;
    setPortalContainer(null);
  }, []);

  const ensureWindow = React.useCallback(() => {
    if (typeof window === 'undefined') return;

    if (windowRef.current && windowRef.current.closed) {
      windowRef.current = null;
      setPortalContainer(null);
    }

    if (!windowRef.current) {
      const actualWidth = Math.max(380, width);
      const actualHeight = Math.max(320, height);
      const dualScreenLeft = window.screenLeft !== undefined ? window.screenLeft : window.screenX;
      const dualScreenTop = window.screenTop !== undefined ? window.screenTop : window.screenY;
      const left = Math.max(20, dualScreenLeft + Math.max(0, (window.innerWidth - actualWidth) / 2));
      const top = Math.max(24, dualScreenTop + Math.max(0, (window.innerHeight - actualHeight) / 3));
      const features = `width=${actualWidth},height=${actualHeight},left=${left},top=${top},resizable=yes,scrollbars=yes`;
      const child = window.open('', windowName, features);
      if (!child) return;

      child.document.title = title || '입력 창';
      child.document.documentElement.style.height = '100%';
      child.document.body.style.margin = '0';
      child.document.body.style.height = '100%';
      child.document.body.style.background = '#f4eddc';
      child.document.body.innerHTML = '';

      const root = child.document.createElement('div');
      root.id = `${windowName}-root`;
      root.style.height = '100%';
      child.document.body.appendChild(root);

      copyDocumentStyles(document, child.document);
      windowRef.current = child;
      setPortalContainer(root);

      const handleBeforeUnload = () => {
        windowRef.current = null;
        setPortalContainer(null);
        onClose?.();
      };

      child.addEventListener('beforeunload', handleBeforeUnload);
      child.__recordsAuxCleanup = () => child.removeEventListener('beforeunload', handleBeforeUnload);
    } else {
      const win = windowRef.current;
      try { win.focus(); } catch {}
      if (win.document) {
        try {
          win.document.title = title || '입력 창';
          copyDocumentStyles(document, win.document);
        } catch {}
      }
      if (!portalContainer && win.document) {
        const existingRoot = win.document.getElementById(`${windowName}-root`);
        if (existingRoot) setPortalContainer(existingRoot);
      }
    }
  }, [height, onClose, portalContainer, title, width, windowName]);

  React.useEffect(() => {
    if (open) {
      ensureWindow();
    } else {
      closeWindow();
    }
    return undefined;
  }, [open, ensureWindow, closeWindow]);

  React.useEffect(() => () => { closeWindow(); }, [closeWindow]);

  if (!open || !portalContainer) return null;

  const content = typeof children === 'function' ? children(portalContainer) : children;

  return createPortal(
    <div className="records-aux-window">
      <header className="records-aux-window__header">
        <div>
          <p className="records-aux-window__eyebrow">Records Utility</p>
          <h1>{title}</h1>
          {description ? <p className="records-aux-window__description">{description}</p> : null}
        </div>
        <button type="button" className="btn-muted" onClick={onClose}>닫기</button>
      </header>
      <div className="records-aux-window__body">
        {content}
      </div>
    </div>,
    portalContainer,
  );
}
