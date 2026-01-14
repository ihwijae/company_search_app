import React from 'react';

const FeedbackContext = React.createContext({
  notify: () => null,
  confirm: async () => false,
  showLoading: () => null,
  hideLoading: () => null,
});

const generateId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function useFeedback() {
  return React.useContext(FeedbackContext);
}

export default function FeedbackProvider({ children }) {
  const [toasts, setToasts] = React.useState([]);
  const [confirmState, setConfirmState] = React.useState(null);
  const [loadingState, setLoadingState] = React.useState(null);

  const removeToast = React.useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const notify = React.useCallback(({ message, title, type = 'info', duration = 3800 } = {}) => {
    if (!message && !title) return null;
    const id = generateId();
    const nextToast = { id, message, title, type };
    setToasts((prev) => [...prev, nextToast]);
    if (duration > 0) {
      setTimeout(() => removeToast(id), duration);
    }
    return id;
  }, [removeToast]);

  const confirm = React.useCallback((options = {}) => new Promise((resolve) => {
    setConfirmState({
      title: options.title || '확인해 주세요',
      message: options.message || '',
      confirmText: options.confirmText || '확인',
      cancelText: options.cancelText || '취소',
      tone: options.tone || 'info',
      onResolve: (result) => {
        resolve(result);
        setConfirmState(null);
      },
    });
  }), []);

  const showLoading = React.useCallback((options = {}) => {
    const title = options.title || '처리 중입니다';
    const message = options.message || '';
    setLoadingState({ title, message });
  }, []);

  const hideLoading = React.useCallback(() => {
    setLoadingState(null);
  }, []);

  const contextValue = React.useMemo(() => ({
    notify,
    confirm,
    showLoading,
    hideLoading,
  }), [notify, confirm, showLoading, hideLoading]);

  return (
    <FeedbackContext.Provider value={contextValue}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast--${toast.type}`} role="status">
            <div className="toast__content">
              {toast.title && <strong>{toast.title}</strong>}
              {toast.message && <span>{toast.message}</span>}
            </div>
            <button
              type="button"
              className="toast__close"
              onClick={() => removeToast(toast.id)}
              aria-label="알림 닫기"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      {confirmState && (
        <div className="confirm-overlay" role="presentation">
          <div className="confirm-dialog" role="dialog" aria-modal="true">
            <div className="confirm-dialog__body">
              <strong>{confirmState.title}</strong>
              {confirmState.message && <p>{confirmState.message}</p>}
            </div>
            <div className="confirm-dialog__actions">
              <button type="button" className="btn-muted" onClick={() => confirmState.onResolve(false)}>
                {confirmState.cancelText}
              </button>
              <button type="button" className="btn-primary" onClick={() => confirmState.onResolve(true)}>
                {confirmState.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
      {loadingState && (
        <div className="feedback-loading-overlay" role="presentation">
          <div className="feedback-loading-modal" role="dialog" aria-modal="true">
            <h3>{loadingState.title}</h3>
            {loadingState.message && <p>{loadingState.message}</p>}
            <div className="feedback-loading-bar">
              <div className="feedback-loading-bar__value" style={{ width: '70%' }} />
            </div>
          </div>
        </div>
      )}
    </FeedbackContext.Provider>
  );
}
