import React from 'react';

/**
 * 공용 모달 컴포넌트 (껍데기/행동 표준화)
 * 
 * Props
 * - open: boolean — 표시 여부
 * - title: string — 제목
 * - children: ReactNode — 본문 컨텐츠(부모에서 주입)
 * - onClose: () => void — 닫기 요청(ESC/배경 클릭 포함)
 * - onCancel: () => void — 취소 버튼 클릭(기본: onClose)
 * - onSave: () => void | Promise<void> — 저장 버튼 클릭
 * - closeOnSave: boolean — 저장 성공 시 자동 닫기(기본 true)
 * - disableEscClose: boolean — ESC로 닫힘 비활성화
 * - disableBackdropClose: boolean — 배경 클릭 닫힘 비활성화
 * - initialFocusRef: React.RefObject — 모달 오픈 시 포커스 줄 요소
 * - lockScroll: boolean — 오픈 중 바디 스크롤 잠금(기본 true)
 * - size: 'sm' | 'md' | 'lg' — 사전 정의 폭(기본 'md')
 * - maxWidth: number — 최대 폭(px)
 * - width: number|string — 폭(px 또는 '92%')
 * - overlayClassName: string — 오버레이 추가 클래스
 * - boxClassName: string — 박스 추가 클래스
 * - ariaLabel: string — 접근성 label
 * - ariaLabelledby: string — 접근성 labelledby id
 * - role: string — ARIA role(기본 'dialog')
 */
export default function Modal({
  open,
  title,
  children,
  onSave,
  onCancel,
  onClose,
  confirmLabel = '저장',
  cancelLabel = '취소',
  closeOnSave = true,
  disableEscClose = true,
  disableBackdropClose = true,
  initialFocusRef,
  lockScroll = true,
  size = 'md',
  maxWidth,
  width,
  overlayClassName = '',
  boxClassName = '',
  ariaLabel,
  ariaLabelledby,
  role = 'dialog',
}) {
  React.useEffect(() => {
    if (!open || disableEscClose) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose && onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, disableEscClose, onClose]);

  React.useEffect(() => {
    if (!open || !lockScroll) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original; };
  }, [open, lockScroll]);

  React.useEffect(() => {
    if (open && initialFocusRef?.current) {
      try { initialFocusRef.current.focus(); } catch {}
    }
  }, [open, initialFocusRef]);

  if (!open) return null;

  const handleOverlayClick = () => {
    if (disableBackdropClose) return;
    onClose && onClose();
  };
  const stop = (e) => e.stopPropagation();

  const sizeMaxWidth = size === 'sm' ? 480 : size === 'lg' ? 900 : 720;
  const computedMaxWidth = maxWidth ?? sizeMaxWidth;
  const computedWidth = width ?? '92%';

  const doCancel = onCancel || onClose;
  const doSave = async () => {
    if (!onSave) return;
    try {
      const r = onSave();
      if (r && typeof r.then === 'function') {
        await r;
      }
      if (closeOnSave) onClose && onClose();
    } catch (e) {
      // onSave에서 에러 발생 시 닫지 않음
      console.warn('Modal onSave failed:', e);
    }
  };

  return (
    <div
      className={`dialog-overlay ${overlayClassName}`.trim()}
      onClick={handleOverlayClick}
      role="presentation"
    >
      <div
        className={`dialog-box ${boxClassName}`.trim()}
        style={{
          maxWidth: computedMaxWidth,
          width: computedWidth,
          textAlign: 'left',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={stop}
        role={role}
        aria-modal
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
      >
        {title && (
          <h3
            style={{
              marginTop: 0,
              marginBottom: 12,
              textAlign: 'center',
              position: 'sticky',
              top: 0,
              background: '#ffffff',
              paddingTop: 4,
              paddingBottom: 8,
              zIndex: 2,
            }}
          >
            {title}
          </h3>
        )}
        <div style={{ marginBottom: 0, overflow: 'auto', flex: 1, minHeight: 0 }}>
          {children}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid #e5e7eb', paddingTop: 12, marginTop: 12, background: '#ffffff' }}>
          <button onClick={doCancel} style={{ backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db' }}>{cancelLabel}</button>
          <button onClick={doSave} style={{ backgroundColor: '#2563eb', border: '1px solid #2563eb', color: '#ffffff' }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
