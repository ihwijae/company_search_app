import React from 'react';
import Sidebar from '../../../../components/Sidebar';
import * as XLSX from 'xlsx';

const DEFAULT_PROJECT_INFO = {
  announcementNumber: '공고번호를 불러오세요',
  announcementName: '파일을 불러오면 공고명이 표시됩니다',
  owner: '발주기관',
  closingDate: '입찰마감일시를 불러오세요',
  baseAmount: '기초금액을 불러오세요',
};

const SEED_RECIPIENTS = [
  { id: 1, vendorName: '㈜한빛건설', contactName: '김현수 차장', email: 'hs.kim@example.com', attachments: [], status: '대기' },
  { id: 2, vendorName: '빛돌ENG', contactName: '이서준 팀장', email: 'sj.lee@example.com', attachments: [], status: '대기' },
  { id: 3, vendorName: '세광이엔씨', contactName: '박민아 대리', email: 'mina.park@example.com', attachments: [], status: '대기' },
  { id: 4, vendorName: '하람산업', contactName: '정우성 부장', email: 'ws.jung@example.com', attachments: [], status: '대기' },
  { id: 5, vendorName: '가람기술', contactName: '최은지 과장', email: 'ej.choi@example.com', attachments: [], status: '대기' },
];

const ITEMS_PER_PAGE = 3;

export default function MailAutomationPage() {
  const [activeMenu, setActiveMenu] = React.useState('mail');
  const [excelFile, setExcelFile] = React.useState(null);
  const [projectInfo, setProjectInfo] = React.useState(DEFAULT_PROJECT_INFO);
  const [recipients, setRecipients] = React.useState(SEED_RECIPIENTS);
  const [subjectTemplate, setSubjectTemplate] = React.useState('[{{announcementName}}] 투찰 자료 전달드립니다.');
  const [bodyTemplate, setBodyTemplate] = React.useState('안녕하세요, {{vendorName}} 담당자님.\n\n공고번호: {{announcementNumber}}\n발주처: {{owner}}\n입찰마감: {{closingDate}}\n기초금액: {{baseAmount}}\n\n첨부된 자료 확인 부탁드립니다.\n감사합니다.');
  const [smtpProfile, setSmtpProfile] = React.useState('gmail');
  const [customProfile, setCustomProfile] = React.useState({ senderName: '', senderEmail: '', host: '', port: '587', secure: true });
  const [sendDelay, setSendDelay] = React.useState(1);
  const [statusMessage, setStatusMessage] = React.useState('');
  const [currentPage, setCurrentPageState] = React.useState(1);

  const excelInputRef = React.useRef(null);
  const attachmentInputs = React.useRef({});
  const recipientIdRef = React.useRef(SEED_RECIPIENTS.length + 1);

  React.useEffect(() => {
    window.location.hash = '#/mail';
  }, []);

  const handleMenuSelect = React.useCallback((key) => {
    if (key === 'search') {
      window.location.hash = '#/search';
    } else if (key === 'records') {
      window.location.hash = '#/records';
    } else if (key === 'agreements') {
      window.location.hash = '#/agreements';
    } else if (key === 'settings') {
      window.location.hash = '#/settings';
    } else if (key === 'mail') {
      window.location.hash = '#/mail';
    }
    setActiveMenu(key);
  }, []);

  const handleExcelChange = (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    setExcelFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result;
        if (!buffer) throw new Error('파일을 읽을 수 없습니다.');
        const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
        const sheetName = workbook.SheetNames?.[0];
        const sheet = sheetName ? workbook.Sheets[sheetName] : null;
        if (!sheet) throw new Error('첫 번째 시트를 찾을 수 없습니다.');

        const getCell = (addr) => sheet?.[addr] || null;
        const getText = (addr) => {
          const cell = getCell(addr);
          if (!cell) return '';
          if (cell.w) return String(cell.w).trim();
          if (cell.v === undefined || cell.v === null) return '';
          return String(cell.v).trim();
        };

        const formatExcelDate = (cell) => {
          if (!cell) return '';
          if (cell.t === 'n' && Number.isFinite(cell.v)) {
            const parsed = XLSX.SSF.parse_date_code(cell.v);
            if (parsed) {
              const date = new Date(Date.UTC(parsed.y, (parsed.m || 1) - 1, parsed.d || 1, parsed.H || 0, parsed.M || 0));
              if (!Number.isNaN(date.getTime())) {
                const base = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
                const hours = date.getUTCHours();
                const minutes = date.getUTCMinutes();
                if (hours === 0 && minutes === 0) return base;
                return `${base} ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
              }
            }
          }
          if (cell.t === 'd' && cell.v instanceof Date && !Number.isNaN(cell.v.getTime())) {
            const date = cell.v;
            const base = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            const hours = date.getHours();
            const minutes = date.getMinutes();
            if (hours === 0 && minutes === 0) return base;
            return `${base} ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
          }
          const raw = cell.w ?? cell.v;
          if (!raw) return '';
          const text = String(raw).trim();
          const parsedDate = new Date(text);
          if (!Number.isNaN(parsedDate.getTime())) {
            const base = `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}-${String(parsedDate.getDate()).padStart(2, '0')}`;
            const hours = parsedDate.getHours();
            const minutes = parsedDate.getMinutes();
            if (hours === 0 && minutes === 0) return base;
            return `${base} ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
          }
          return text;
        };

        const formatAmount = (cell) => {
          if (!cell) return '';
          const raw = cell.v ?? cell.w;
          if (raw === undefined || raw === null) return '';
          const numeric = Number(String(raw).replace(/[^0-9.-]/g, ''));
          if (Number.isFinite(numeric)) {
            return `${numeric.toLocaleString()} 원`;
          }
          return String(raw).trim();
        };

        const extracted = {
          announcementNumber: getText('C1') || DEFAULT_PROJECT_INFO.announcementNumber,
          announcementName: getText('C2') || DEFAULT_PROJECT_INFO.announcementName,
          owner: getText('C3') || DEFAULT_PROJECT_INFO.owner,
          closingDate: formatExcelDate(getCell('C4')) || DEFAULT_PROJECT_INFO.closingDate,
          baseAmount: formatAmount(getCell('C5')) || DEFAULT_PROJECT_INFO.baseAmount,
        };

        setProjectInfo(extracted);
        setStatusMessage(`엑셀에서 공고 정보를 불러왔습니다. (공고번호: ${extracted.announcementNumber})`);
      } catch (error) {
        console.error('[mail] excel parsing failed', error);
        setProjectInfo(DEFAULT_PROJECT_INFO);
        setStatusMessage('엑셀 구조를 분석하지 못했습니다. 셀 위치를 확인해 주세요.');
      }
    };
    reader.onerror = () => {
      setStatusMessage('엑셀 파일을 읽는 중 오류가 발생했습니다.');
    };
    reader.readAsArrayBuffer(file);
  };

  const handleRecipientFieldChange = (id, field, value) => {
    setRecipients((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const handleAttachmentClick = (id) => {
    const ref = attachmentInputs.current[id];
    if (ref) ref.click();
  };

  const handleAttachmentChange = (id, event) => {
    const files = Array.from(event.target.files || []);
    setRecipients((prev) => prev.map((item) => (item.id === id ? { ...item, attachments: files } : item)));
  };

  const handleRemoveAttachments = (id) => {
    setRecipients((prev) => prev.map((item) => (item.id === id ? { ...item, attachments: [] } : item)));
  };

  const handleAddRecipient = () => {
    const nextId = recipientIdRef.current;
    recipientIdRef.current += 1;
    const newRecipient = {
      id: nextId,
      vendorName: '',
      contactName: '',
      email: '',
      attachments: [],
      status: '대기',
    };
    setRecipients((prev) => {
      const nextList = [...prev, newRecipient];
      const lastPage = Math.max(1, Math.ceil(nextList.length / ITEMS_PER_PAGE));
      setCurrentPageState(lastPage);
      return nextList;
    });
  };

  const handleSendAll = () => {
    const ready = recipients.filter((item) => item.email && item.attachments.length);
    if (!ready.length) {
      alert('발송 대상이 없습니다. 이메일과 첨부를 확인해 주세요.');
      return;
    }
    setStatusMessage(`총 ${ready.length}건 발송 준비 완료 (데모). SMTP 연동 후 이 영역에 진행 상황을 표시합니다.`);
  };

  const handleTestMail = () => {
    setStatusMessage('SMTP 설정 테스트 요청을 전송했습니다. (데모)');
  };

  const handleTemplatePreview = () => {
    setStatusMessage('템플릿 치환 결과는 구현 시 미리보기 창으로 제공할 예정입니다.');
  };

  const totalPages = React.useMemo(() => (
    recipients.length ? Math.max(1, Math.ceil(recipients.length / ITEMS_PER_PAGE)) : 1
  ), [recipients]);

  const paginatedRecipients = React.useMemo(() => {
    const page = Math.min(currentPage, totalPages);
    const start = (page - 1) * ITEMS_PER_PAGE;
    return recipients.slice(start, start + ITEMS_PER_PAGE);
  }, [recipients, currentPage, totalPages]);

  React.useEffect(() => {
    setCurrentPageState((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const setCurrentPage = React.useCallback((page) => {
    setCurrentPageState((prev) => {
      const next = Math.min(Math.max(page, 1), totalPages);
      return next === prev ? prev : next;
    });
  }, [totalPages]);

  return (
    <div className="app-shell">
      <Sidebar active={activeMenu} onSelect={handleMenuSelect} collapsed={true} />
      <div className="main">
        <div className="title-drag" />
        <div className="topbar" />
        <div className="stage mail-stage">
          <div className="mail-layout">
            <section className="mail-panel mail-panel--config">
              <header className="mail-panel__header">
                <h2>엑셀 불러오기</h2>
                <button type="button" className="btn-soft" onClick={() => excelInputRef.current?.click()}>파일 선택</button>
                <input
                  ref={excelInputRef}
                  type="file"
                  accept=".xlsx,.xlsm"
                  style={{ display: 'none' }}
                  onChange={handleExcelChange}
                />
              </header>
              <div className="mail-upload">
                <div className="mail-upload__dropzone" role="presentation" onClick={() => excelInputRef.current?.click()}>
                  {excelFile ? (
                    <>
                      <strong>{excelFile.name}</strong>
                      <span>{(excelFile.size / 1024).toFixed(1)} KB</span>
                    </>
                  ) : (
                    <>
                      <span className="mail-upload__icon">📄</span>
                      <p>엑셀 파일을 끌어오거나 클릭하여 선택하세요 (.xlsx / .xlsm)</p>
                    </>
                  )}
                </div>
                <div className="mail-project">
                  <dl>
                    <div>
                      <dt>공고번호</dt>
                      <dd>{projectInfo.announcementNumber}</dd>
                    </div>
                    <div>
                      <dt>공고명</dt>
                      <dd>{projectInfo.announcementName}</dd>
                    </div>
                    <div>
                      <dt>발주처</dt>
                      <dd>{projectInfo.owner}</dd>
                    </div>
                    <div>
                      <dt>입찰마감일시</dt>
                      <dd>{projectInfo.closingDate}</dd>
                    </div>
                    <div>
                      <dt>기초금액</dt>
                      <dd>{projectInfo.baseAmount}</dd>
                    </div>
                  </dl>
                </div>
              </div>

              <div className="mail-section">
                <h3>SMTP 프로필</h3>
                <div className="mail-smtp-options">
                  <label>
                    <input
                      type="radio"
                      value="gmail"
                      checked={smtpProfile === 'gmail'}
                      onChange={(event) => setSmtpProfile(event.target.value)}
                    />
                    Gmail (smtp.gmail.com)
                  </label>
                  <label>
                    <input
                      type="radio"
                      value="naver"
                      checked={smtpProfile === 'naver'}
                      onChange={(event) => setSmtpProfile(event.target.value)}
                    />
                    Naver (smtp.naver.com)
                  </label>
                  <label>
                    <input
                      type="radio"
                      value="custom"
                      checked={smtpProfile === 'custom'}
                      onChange={(event) => setSmtpProfile(event.target.value)}
                    />
                    기타 SMTP 직접 입력
                  </label>
                </div>
                {smtpProfile === 'custom' && (
                  <div className="mail-smtp-custom">
                    <label>
                      발신자 이름
                      <input value={customProfile.senderName} onChange={(event) => setCustomProfile((prev) => ({ ...prev, senderName: event.target.value }))} placeholder="예: 홍길동" />
                    </label>
                    <label>
                      발신 이메일 주소
                      <input value={customProfile.senderEmail} onChange={(event) => setCustomProfile((prev) => ({ ...prev, senderEmail: event.target.value }))} placeholder="user@example.com" />
                    </label>
                    <div className="mail-smtp-grid">
                      <label>
                        SMTP 호스트
                        <input value={customProfile.host} onChange={(event) => setCustomProfile((prev) => ({ ...prev, host: event.target.value }))} placeholder="smtp.example.com" />
                      </label>
                      <label>
                        포트
                        <input value={customProfile.port} onChange={(event) => setCustomProfile((prev) => ({ ...prev, port: event.target.value }))} placeholder="587" />
                      </label>
                    </div>
                    <label className="mail-smtp-secure">
                      <input
                        type="checkbox"
                        checked={customProfile.secure}
                        onChange={(event) => setCustomProfile((prev) => ({ ...prev, secure: event.target.checked }))}
                      />
                      TLS/SSL 사용 (기본값)
                    </label>
                  </div>
                )}
                <button type="button" className="btn-soft" onClick={handleTestMail}>테스트 메일 보내기</button>
              </div>

              <div className="mail-section">
                <h3>템플릿</h3>
                <label>
                  제목 템플릿
                  <input value={subjectTemplate} onChange={(event) => setSubjectTemplate(event.target.value)} />
                </label>
                <label>
                  본문 템플릿
                  <textarea rows={6} value={bodyTemplate} onChange={(event) => setBodyTemplate(event.target.value)} />
                </label>
                <button type="button" className="btn-soft" onClick={handleTemplatePreview}>치환 미리보기</button>
              </div>

              <div className="mail-section">
                <h3>발송 설정</h3>
                <label>
                  건당 지연 (초)
                  <input type="number" min="0" value={sendDelay} onChange={(event) => setSendDelay(Number(event.target.value) || 0)} />
                </label>
                <p className="mail-hint">지연을 주면 스팸 가능성을 줄일 수 있습니다. (예: 1초)</p>
              </div>
            </section>

            <section className="mail-panel mail-panel--recipients">
              <header className="mail-panel__header">
                <h2>업체 목록</h2>
                <div className="mail-recipient-actions">
                  <button type="button" className="btn-soft" onClick={handleAddRecipient}>업체 추가</button>
                  <button type="button" className="btn-primary" onClick={handleSendAll}>전체 발송</button>
                </div>
              </header>

              <div className="mail-recipients-table">
                <div className="mail-recipients-header">
                  <span>#</span>
                  <span>업체명</span>
                  <span>담당자</span>
                  <span>이메일</span>
                  <span>첨부</span>
                  <span>상태</span>
                </div>
                {paginatedRecipients.length ? paginatedRecipients.map((recipient) => (
                  <div key={recipient.id} className="mail-recipients-row">
                    <span>{recipient.id}</span>
                    <span>
                      <input
                        value={recipient.vendorName}
                        onChange={(event) => handleRecipientFieldChange(recipient.id, 'vendorName', event.target.value)}
                        placeholder="업체명"
                      />
                    </span>
                    <span>
                      <input
                        value={recipient.contactName}
                        onChange={(event) => handleRecipientFieldChange(recipient.id, 'contactName', event.target.value)}
                        placeholder="담당자"
                      />
                    </span>
                    <span>
                      <input
                        value={recipient.email}
                        onChange={(event) => handleRecipientFieldChange(recipient.id, 'email', event.target.value)}
                        placeholder="example@company.com"
                      />
                    </span>
                    <span className="mail-recipient-attachments">
                      <div className="mail-recipient-attachments__list">
                        {recipient.attachments.length ? recipient.attachments.map((file, index) => (
                          <span key={`${recipient.id}-${index}`} className="mail-recipient-attachment-chip">{file.name || file}</span>
                        )) : <span className="mail-recipient-attachment-empty">첨부 없음</span>}
                      </div>
                      <div className="mail-recipient-attachments__buttons">
                        <button type="button" className="btn-sm btn-soft" onClick={() => handleAttachmentClick(recipient.id)}>첨부</button>
                        {recipient.attachments.length > 0 && (
                          <button type="button" className="btn-sm btn-muted" onClick={() => handleRemoveAttachments(recipient.id)}>비우기</button>
                        )}
                      </div>
                      <input
                        ref={(node) => { attachmentInputs.current[recipient.id] = node; }}
                        type="file"
                        multiple
                        style={{ display: 'none' }}
                        onChange={(event) => handleAttachmentChange(recipient.id, event)}
                      />
                    </span>
                    <span className={`mail-recipient-status mail-recipient-status--${recipient.status}`}>
                      {recipient.status}
                    </span>
                  </div>
                )) : (
                  <div className="mail-recipients-empty">업체가 없습니다. 엑셀을 불러오거나 직접 추가하세요.</div>
                )}
              </div>

              <div className="mail-pagination">
                <button
                  type="button"
                  className="mail-pagination__nav"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  이전
                </button>
                {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    className={`mail-pagination__page ${currentPage === page ? 'is-active' : ''}`}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                ))}
                <button
                  type="button"
                  className="mail-pagination__nav"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  다음
                </button>
              </div>

              {statusMessage && (
                <div className="mail-status">
                  <strong>알림</strong>
                  <span>{statusMessage}</span>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
