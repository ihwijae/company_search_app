import React from 'react';
import { createPortal } from 'react-dom';
import { copyDocumentStyles } from '../../../../utils/windowBridge.js';
import ProjectEditorForm from './ProjectEditorForm.jsx';

export default function RecordsEditorWindow({
  open,
  mode = 'create',
  initialProject = null,
  companies,
  categories,
  defaultCompanyId = '',
  defaultCompanyType = 'our',
  onClose,
  onSaved,
}) {
  const windowRef = React.useRef(null);
  const [portalContainer, setPortalContainer] = React.useState(null);

  const closeWindow = React.useCallback(() => {
    const win = windowRef.current;
    if (win && !win.closed) {
      if (win.__recordsEditorCleanup) {
        try { win.__recordsEditorCleanup(); } catch {}
        delete win.__recordsEditorCleanup;
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
      const width = Math.min(1340, Math.max(1080, window.innerWidth - 80));
      const height = Math.min(980, Math.max(820, window.innerHeight - 64));
      const dualScreenLeft = window.screenLeft !== undefined ? window.screenLeft : window.screenX;
      const dualScreenTop = window.screenTop !== undefined ? window.screenTop : window.screenY;
      const left = Math.max(20, dualScreenLeft + Math.max(0, (window.innerWidth - width) / 2));
      const top = Math.max(24, dualScreenTop + Math.max(0, (window.innerHeight - height) / 5));
      const features = `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`;
      const child = window.open('', 'company-search-records-editor', features);
      if (!child) return;
      child.document.title = mode === 'edit' ? '실적 수정' : '실적 등록';
      child.document.documentElement.style.height = '100%';
      child.document.body.style.margin = '0';
      child.document.body.style.height = '100%';
      child.document.body.style.background = '#f4eddc';
      child.document.body.innerHTML = '';

      const root = child.document.createElement('div');
      root.id = 'records-editor-root';
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
      child.__recordsEditorCleanup = () => child.removeEventListener('beforeunload', handleBeforeUnload);
    } else {
      const win = windowRef.current;
      try { win.focus(); } catch {}
      if (win.document) {
        try {
          win.document.title = mode === 'edit' ? '실적 수정' : '실적 등록';
          copyDocumentStyles(document, win.document);
        } catch {}
      }
      if (!portalContainer && win.document) {
        const existingRoot = win.document.getElementById('records-editor-root');
        if (existingRoot) setPortalContainer(existingRoot);
      }
    }
  }, [mode, onClose, portalContainer]);

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

  const markup = (
    <div className="records-popup-shell">
      <div className="records-popup-shell__hero">
        <div>
          <p className="records-popup-shell__eyebrow">Records Workspace</p>
          <h1>{mode === 'edit' ? '실적 수정' : '실적 등록'}</h1>
          <p className="records-popup-shell__description">
            메인 실적 목록과 분리된 전용 입력 창입니다. 다른 화면을 보면서 계속 작업할 수 있습니다.
          </p>
        </div>
        <button type="button" className="btn-muted" onClick={onClose}>창 닫기</button>
      </div>
      <div className="records-popup-shell__body">
        <ProjectEditorForm
          mode={mode}
          initialProject={initialProject}
          companies={companies}
          categories={categories}
          defaultCompanyId={defaultCompanyId}
          defaultCompanyType={defaultCompanyType}
          feedbackPortalTarget={portalContainer}
          onCancel={onClose}
          onSaved={onSaved}
        />
      </div>
    </div>
  );

  return createPortal(markup, portalContainer);
}
