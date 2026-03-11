import React from 'react';
import { copyDocumentStyles } from '../../../../utils/windowBridge.js';

export default function useLhAwardHistoryWindow({
  open,
  setOpen,
  sourceDocument,
}) {
  const windowRef = React.useRef(null);
  const [portalContainer, setPortalContainer] = React.useState(null);

  const closeWindow = React.useCallback(() => {
    const win = windowRef.current;
    if (win && !win.closed) {
      if (win.__agreementBoardCleanup) {
        try { win.__agreementBoardCleanup(); } catch {}
        delete win.__agreementBoardCleanup;
      }
      win.close();
    }
    windowRef.current = null;
    setPortalContainer(null);
  }, []);

  const ensureWindow = React.useCallback(() => {
    if (typeof window === 'undefined') return;
    if (!open) return;
    if (windowRef.current && windowRef.current.closed) {
      windowRef.current = null;
      setPortalContainer(null);
    }

    if (!windowRef.current) {
      const width = Math.min(860, Math.max(680, window.innerWidth - 260));
      const height = Math.min(820, Math.max(620, window.innerHeight - 140));
      const dualScreenLeft = window.screenLeft !== undefined ? window.screenLeft : window.screenX;
      const dualScreenTop = window.screenTop !== undefined ? window.screenTop : window.screenY;
      const left = Math.max(60, dualScreenLeft + window.innerWidth - width - 56);
      const top = Math.max(40, dualScreenTop + Math.max(0, (window.innerHeight - height) / 2));
      const features = `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`;
      const child = window.open('', 'company-search-lh-award-history', features);
      if (!child) return;
      child.document.title = '낙찰이력업체';
      child.document.documentElement.style.height = '100%';
      child.document.documentElement.style.overflow = 'hidden';
      child.document.body.style.margin = '0';
      child.document.body.style.height = '100%';
      child.document.body.style.background = '#f8fafc';
      child.document.body.innerHTML = '';
      const root = child.document.createElement('div');
      root.id = 'lh-award-history-root';
      root.style.height = '100%';
      child.document.body.appendChild(root);
      copyDocumentStyles(sourceDocument, child.document);
      windowRef.current = child;
      setPortalContainer(root);
      const handleBeforeUnload = () => {
        windowRef.current = null;
        setPortalContainer(null);
        setOpen(false);
      };
      child.addEventListener('beforeunload', handleBeforeUnload);
      child.__agreementBoardCleanup = () => child.removeEventListener('beforeunload', handleBeforeUnload);
    } else {
      const win = windowRef.current;
      if (win.document && win.document.readyState === 'complete') {
        copyDocumentStyles(sourceDocument, win.document);
      }
      if (!portalContainer && win.document) {
        const existingRoot = win.document.getElementById('lh-award-history-root');
        if (existingRoot) setPortalContainer(existingRoot);
      }
      win.document.title = '낙찰이력업체';
      try { win.focus(); } catch {}
    }
  }, [open, portalContainer, setOpen, sourceDocument]);

  React.useEffect(() => {
    if (!open) {
      closeWindow();
      return undefined;
    }
    ensureWindow();
    return undefined;
  }, [closeWindow, ensureWindow, open]);

  return {
    portalContainer,
    closeWindow,
  };
}
