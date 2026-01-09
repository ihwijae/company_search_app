import React from 'react';

function AgreementAlertModal({ message, onClose }) {
  if (!message) return null;

  return (
    <div className="agreement-alert-overlay" role="presentation" onClick={onClose}>
      <div
        className="agreement-alert-modal"
        role="alertdialog"
        aria-live="assertive"
        onClick={(event) => event.stopPropagation()}
      >
        <p>{message}</p>
        <button type="button" onClick={onClose}>확인</button>
      </div>
    </div>
  );
}

export default AgreementAlertModal;
