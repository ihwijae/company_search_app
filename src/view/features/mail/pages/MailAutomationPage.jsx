import React from 'react';
import Sidebar from '../../../../components/Sidebar';
import * as XLSX from 'xlsx';
import 'xlsx/dist/cpexcel.js';

const DEFAULT_PROJECT_INFO = {
  announcementNumber: '공고번호를 불러오세요',
  announcementName: '파일을 불러오면 공고명이 표시됩니다',
  owner: '발주기관',
  closingDate: '입찰마감일시를 불러오세요',
  baseAmount: '기초금액을 불러오세요',
};

const SEED_RECIPIENTS = [
  { id: 1, vendorName: '㈜한빛건설', contactName: '김현수 차장', email: 'hs.kim@example.com', tenderAmount: '', attachments: [], status: '대기' },
  { id: 2, vendorName: '빛돌ENG', contactName: '이서준 팀장', email: 'sj.lee@example.com', tenderAmount: '', attachments: [], status: '대기' },
  { id: 3, vendorName: '세광이엔씨', contactName: '박민아 대리', email: 'mina.park@example.com', tenderAmount: '', attachments: [], status: '대기' },
  { id: 4, vendorName: '하람산업', contactName: '정우성 부장', email: 'ws.jung@example.com', tenderAmount: '', attachments: [], status: '대기' },
  { id: 5, vendorName: '가람기술', contactName: '최은지 과장', email: 'ej.choi@example.com', tenderAmount: '', attachments: [], status: '대기' },
];

const SEED_CONTACTS = [
  { id: 1, vendorName: '㈜한빛건설', contactName: '김현수 차장', email: 'hs.kim@example.com' },
  { id: 2, vendorName: '빛돌ENG', contactName: '이서준 팀장', email: 'sj.lee@example.com' },
  { id: 3, vendorName: '세광이엔씨', contactName: '박민아 대리', email: 'mina.park@example.com' },
  { id: 4, vendorName: '하람산업', contactName: '정우성 부장', email: 'ws.jung@example.com' },
  { id: 5, vendorName: '가람기술', contactName: '최은지 과장', email: 'ej.choi@example.com' },
];

const ITEMS_PER_PAGE = 10;
const normalizeVendorName = (name = '') => name.replace(/\s+/g, '').toLowerCase();
const trimValue = (value) => (typeof value === 'string' ? value.trim() : '');

export default function MailAutomationPage() {
  const [activeMenu, setActiveMenu] = React.useState('mail');
  const [excelFile, setExcelFile] = React.useState(null);
  const [projectInfo, setProjectInfo] = React.useState(DEFAULT_PROJECT_INFO);
  const [recipients, setRecipients] = React.useState(SEED_RECIPIENTS);
  const [contacts, setContacts] = React.useState(SEED_CONTACTS);
  const [vendorAmounts, setVendorAmounts] = React.useState({});
  const [subjectTemplate, setSubjectTemplate] = React.useState('{{owner}} "{{announcementNumber}} {{announcementName}}"_{{vendorName}}');
  const [bodyTemplate, setBodyTemplate] = React.useState(
    '안녕하세요, {{vendorName}} 담당자님.\n\n'
    + '{{owner}} "{{announcementNumber}} {{announcementName}}"의 입찰내역을 보내드립니다.\n\n'
    + '이메일에 첨부된 ENC 파일 1개만 입찰서에 첨부하셔서 투찰해 주시기 바랍니다.\n'
    + '함께 첨부된 엑셀 파일은 투찰 시 금액 확인용이니 절대로 첨부하지 마시기 바랍니다.\n\n'
    + '좋은 결과 있으시기 바랍니다.\n\n'
    + '공사명 : {{announcementName}}\n'
    + '공고번호 : {{announcementNumber}}\n\n'
    + '{{vendorName}} 투찰금액 : {{tenderAmount}}\n\n'
    + 'ENC 파일만 첨부하세요!!!\n\n'
    + '투찰마감일 {{closingDate}}\n'
  );
  const [smtpProfile, setSmtpProfile] = React.useState('gmail');
  const [senderName, setSenderName] = React.useState('');
  const [senderEmail, setSenderEmail] = React.useState('');
  const [replyTo, setReplyTo] = React.useState('');
  const [gmailPassword, setGmailPassword] = React.useState('');
  const [naverPassword, setNaverPassword] = React.useState('');
  const [customProfile, setCustomProfile] = React.useState({ host: '', port: '587', secure: true, username: '', password: '' });
  const [sendDelay, setSendDelay] = React.useState(1);
  const [statusMessage, setStatusMessage] = React.useState('');
  const [currentPage, setCurrentPageState] = React.useState(1);
  const [addressBookOpen, setAddressBookOpen] = React.useState(false);

  const excelInputRef = React.useRef(null);
  const attachmentInputs = React.useRef({});
  const recipientIdRef = React.useRef(SEED_RECIPIENTS.length + 1);
  const contactIdRef = React.useRef(SEED_CONTACTS.length + 1);
  const contactsFileInputRef = React.useRef(null);

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
    } else if (key === 'excel-helper') {
      window.electronAPI?.excelHelper?.openWindow?.();
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
    setStatusMessage('엑셀 데이터를 분석 중입니다...');
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

        const amountMap = {};
        const vendorEntries = [];
        let emptyStreak = 0;
        for (let row = 8; row < 1000; row += 1) {
          const vendor = getText(`C${row}`);
          const amountCell = getCell(`D${row}`);
          const hasContent = Boolean(vendor || (amountCell && amountCell.v));
          if (!hasContent) {
            emptyStreak += 1;
            if (emptyStreak >= 3) break;
            continue;
          }
          emptyStreak = 0;
          const formattedAmount = formatAmount(amountCell);
          const normalized = normalizeVendorName(vendor);
          if (normalized) {
            amountMap[normalized] = formattedAmount;
          }
          if (vendor) {
            vendorEntries.push({
              id: vendorEntries.length + 1,
              vendorName: vendor,
              contactName: '',
              email: '',
              tenderAmount: formattedAmount,
              attachments: [],
              status: '대기',
            });
          }
        }

        setVendorAmounts(amountMap);
        if (vendorEntries.length > 0) {
          setRecipients(vendorEntries);
          recipientIdRef.current = vendorEntries.length + 1;
          setCurrentPageState(1);
          setStatusMessage(`엑셀에서 공고 정보를 불러왔습니다. (공고번호: ${extracted.announcementNumber}, 업체 ${vendorEntries.length}건)`);
        } else {
          let matched = 0;
          const nextRecipients = recipients.map((item) => {
            const normalized = normalizeVendorName(item.vendorName);
            const amount = normalized ? amountMap[normalized] : '';
            if (amount) {
              matched += 1;
              return { ...item, tenderAmount: amount };
            }
            return item;
          });
          setRecipients(nextRecipients);
          setStatusMessage(`엑셀에서 공고 정보를 불러왔습니다. (공고번호: ${extracted.announcementNumber}, 업체 매칭 ${matched}건)`);
        }

        setProjectInfo(extracted);
      } catch (error) {
        console.error('[mail] excel parsing failed', error);
        setProjectInfo(DEFAULT_PROJECT_INFO);
        setStatusMessage('엑셀 구조를 분석하지 못했습니다. 셀 위치를 확인해 주세요.');
      }
    };
    reader.onerror = () => {
      setProjectInfo(DEFAULT_PROJECT_INFO);
      setStatusMessage('엑셀 파일을 읽는 중 오류가 발생했습니다.');
    };
    reader.readAsArrayBuffer(file);
  };

  const handleRecipientFieldChange = (id, field, value) => {
    if (field === 'tenderAmount') {
      const formatted = formatTenderAmountInput(value);
      setRecipients((prev) => prev.map((item) => (item.id === id ? { ...item, tenderAmount: formatted } : item)));
      return;
    }
    if (field === 'vendorName') {
      setRecipients((prev) => prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, vendorName: value };
        const match = vendorAmounts[normalizeVendorName(value)];
        if (match) updated.tenderAmount = match;
        return updated;
      }));
      return;
    }
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

  const formatTenderAmountInput = React.useCallback((rawValue) => {
    if (!rawValue) return '';
    const digits = String(rawValue).replace(/[^0-9]/g, '');
    if (!digits) return '';
    const numeric = Number(digits);
    if (!Number.isFinite(numeric)) return digits;
    return `${numeric.toLocaleString()} 원`;
  }, []);

  const handleAddContact = () => {
    const nextId = contactIdRef.current;
    contactIdRef.current += 1;
    setContacts((prev) => ([
      ...prev,
      { id: nextId, vendorName: '', contactName: '', email: '' },
    ]));
    setStatusMessage('주소록에 빈 항목을 추가했습니다. 정보를 입력해 주세요.');
  };

  const handleContactFieldChange = (id, field, value) => {
    setContacts((prev) => prev.map((contact) => (contact.id === id ? { ...contact, [field]: value } : contact)));
  };

  const handleRemoveContact = (id) => {
    setContacts((prev) => prev.filter((contact) => contact.id !== id));
    setStatusMessage('주소록에서 항목을 삭제했습니다.');
  };

  const handleImportContacts = (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result;
        if (!text) throw new Error('파일이 비어 있습니다.');
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) throw new Error('배열 형태의 JSON이 아닙니다.');
        let importedCount = 0;
        const imported = parsed.map((item) => {
          importedCount += 1;
          return {
            id: contactIdRef.current++,
            vendorName: item.vendorName || '',
            contactName: item.contactName || '',
            email: item.email || '',
          };
        });
        setContacts((prev) => [...prev, ...imported]);
        setStatusMessage(`주소록 ${importedCount}건을 가져왔습니다.`);
      } catch (error) {
        console.error('[mail] contacts import failed', error);
        setStatusMessage('주소록 파일을 읽지 못했습니다. JSON 형식을 확인해 주세요.');
      }
    };
    reader.readAsText(file, 'utf-8');
    if (event.target) event.target.value = '';
  };

  const handleExportContacts = () => {
    if (!contacts.length) {
      alert('내보낼 주소록이 없습니다.');
      return;
    }
    const data = contacts.map(({ id, ...rest }) => rest);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `mail-addressbook-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatusMessage(`주소록 ${contacts.length}건을 내보냈습니다.`);
  };

  const handleUseContact = (contact) => {
    if (!contact.email && !contact.vendorName) return;
    setRecipients((prev) => {
      if (prev.some((item) => item.email && contact.email && item.email === contact.email)) {
        setStatusMessage('이미 동일한 이메일이 수신자 목록에 있습니다.');
        return prev;
      }
      const nextId = recipientIdRef.current;
      recipientIdRef.current += 1;
      const normalized = normalizeVendorName(contact.vendorName);
      const tenderAmount = normalized ? (vendorAmounts[normalized] || '') : '';
      const nextRecipient = {
        id: nextId,
        vendorName: contact.vendorName || '',
        contactName: contact.contactName || '',
        email: contact.email || '',
        tenderAmount,
        attachments: [],
        status: '대기',
      };
      const nextList = [...prev, nextRecipient];
      const lastPage = Math.max(1, Math.ceil(nextList.length / ITEMS_PER_PAGE));
      setCurrentPageState(lastPage);
      setStatusMessage(`주소록에서 '${contact.vendorName || '업체'}'를 수신자 목록에 추가했습니다.`);
      return nextList;
    });
  };

  const handleRemoveRecipient = (id) => {
    setRecipients((prev) => {
      const nextList = prev.filter((item) => item.id !== id);
      const totalPages = Math.max(1, Math.ceil((nextList.length || 0) / ITEMS_PER_PAGE));
      setCurrentPageState((prevPage) => Math.min(prevPage, totalPages));
      return nextList;
    });
    setStatusMessage('수신자 목록에서 항목을 삭제했습니다.');
  };

  const handleAddRecipient = () => {
    const nextId = recipientIdRef.current;
    recipientIdRef.current += 1;
    const newRecipient = {
      id: nextId,
      vendorName: '',
      contactName: '',
      email: '',
      tenderAmount: '',
      attachments: [],
      status: '대기',
    };
    setRecipients((prev) => {
      const nextList = [...prev, newRecipient];
      const lastPage = Math.max(1, Math.ceil(nextList.length / ITEMS_PER_PAGE));
      setCurrentPageState(lastPage);
      return nextList;
    });
    setStatusMessage('새 수신자를 추가했습니다. 업체명과 이메일을 입력해 주세요.');
  };

  const handleSendAll = () => {
    const ready = recipients.filter((item) => item.email && item.attachments.length);
    if (!ready.length) {
      alert('발송 대상이 없습니다. 이메일과 첨부를 확인해 주세요.');
      return;
    }
    setStatusMessage(`총 ${ready.length}건 발송 준비 완료 (발신: ${senderEmail || '미입력'}, 회신: ${replyTo || '미지정'}, 프로필: ${smtpProfile}). SMTP 연동 후 실제 발송 로직을 연결합니다.`);
  };

  const handleTestMail = React.useCallback(async () => {
    const api = window.electronAPI?.mail?.sendTest;
    if (typeof api !== 'function') {
      setStatusMessage('이 빌드에서는 테스트 메일 기능을 사용할 수 없습니다.');
      return;
    }

    const trimmedSenderEmail = trimValue(senderEmail);
    if (!trimmedSenderEmail) {
      setStatusMessage('발신 이메일을 입력해 주세요.');
      return;
    }

    let connection = null;
    if (smtpProfile === 'gmail') {
      if (!gmailPassword) {
        setStatusMessage('Gmail 앱 비밀번호를 입력해 주세요.');
        return;
      }
      connection = {
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: { user: trimmedSenderEmail, pass: gmailPassword },
      };
    } else if (smtpProfile === 'naver') {
      if (!naverPassword) {
        setStatusMessage('네이버 SMTP 비밀번호를 입력해 주세요.');
        return;
      }
      connection = {
        host: 'smtp.naver.com',
        port: 465,
        secure: true,
        auth: { user: trimmedSenderEmail, pass: naverPassword },
      };
    } else {
      const host = trimValue(customProfile.host);
      const username = trimValue(customProfile.username) || trimmedSenderEmail;
      const password = customProfile.password;
      if (!host) {
        setStatusMessage('SMTP 호스트를 입력해 주세요.');
        return;
      }
      if (!password) {
        setStatusMessage('SMTP 비밀번호를 입력해 주세요.');
        return;
      }
      const portNumber = Number(customProfile.port) || (customProfile.secure ? 465 : 587);
      connection = {
        host,
        port: portNumber,
        secure: Boolean(customProfile.secure),
        auth: { user: username, pass: password },
      };
    }

    if (!connection) {
      setStatusMessage('SMTP 설정을 확인해 주세요.');
      return;
    }

    const timestamp = (() => {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const hh = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
    })();

    const subjectBase = projectInfo.announcementName || 'SMTP 연결 확인';
    const summaryLines = [
      '이 메일은 협정보조에서 SMTP 설정을 확인하기 위해 발송된 테스트 메일입니다.',
      '',
      `공고번호: ${projectInfo.announcementNumber || '-'}`,
      `공고명: ${projectInfo.announcementName || '-'}`,
      `발주처: ${projectInfo.owner || '-'}`,
      `입찰마감일시: ${projectInfo.closingDate || '-'}`,
      `기초금액: ${projectInfo.baseAmount || '-'}`,
      '',
      `발송 계정: ${trimmedSenderEmail}`,
      `발송 시각: ${timestamp}`,
      '',
      '※ 본 메일은 테스트 용도로만 발송되었습니다.',
    ];

    setStatusMessage('테스트 메일을 보내는 중입니다...');
    try {
      const response = await api({
        connection,
        message: {
          from: trimmedSenderEmail,
          fromName: trimValue(senderName),
          to: trimmedSenderEmail,
          replyTo: trimValue(replyTo) || undefined,
          subject: `[테스트] ${subjectBase} (${timestamp})`,
          text: summaryLines.join('\n'),
        },
      });
      if (response?.success) {
        const acceptedList = response?.data?.accepted || response?.accepted || [];
        const accepted = Array.isArray(acceptedList) && acceptedList.length ? acceptedList[0] : trimmedSenderEmail;
        setStatusMessage(`테스트 메일 발송 완료: ${accepted}. 메일함을 확인해 주세요.`);
      } else {
        setStatusMessage(response?.message ? `테스트 메일 실패: ${response.message}` : '테스트 메일 발송에 실패했습니다.');
      }
    } catch (error) {
      console.error('[mail] test send failed', error);
      setStatusMessage(error?.message ? `테스트 메일 실패: ${error.message}` : '테스트 메일 발송 중 오류가 발생했습니다.');
    }
  }, [smtpProfile, senderEmail, senderName, replyTo, gmailPassword, naverPassword, customProfile, projectInfo]);

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
                  accept=".xlsx,.xlsm,.xls"
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
                <div className="mail-smtp-sender">
                  <label>
                    발신자 이름
                    <input value={senderName} onChange={(event) => setSenderName(event.target.value)} placeholder="예: 홍길동" />
                  </label>
                  <label>
                    발신 이메일
                    <input value={senderEmail} onChange={(event) => setSenderEmail(event.target.value)} placeholder="example@company.com" />
                  </label>
                  <label>
                    회신 이메일 (선택)
                    <input value={replyTo} onChange={(event) => setReplyTo(event.target.value)} placeholder="reply@example.com" />
                  </label>
                </div>
                {smtpProfile === 'gmail' && (
                  <label>
                    Gmail 앱 비밀번호
                    <input
                      type="password"
                      value={gmailPassword}
                      onChange={(event) => setGmailPassword(event.target.value)}
                      placeholder="16자리 앱 비밀번호"
                    />
                    <span className="mail-hint">Google 계정 보안 설정에서 앱 비밀번호를 발급해야 합니다.</span>
                  </label>
                )}
                {smtpProfile === 'naver' && (
                  <label>
                    SMTP 비밀번호
                    <input
                      type="password"
                      value={naverPassword}
                      onChange={(event) => setNaverPassword(event.target.value)}
                      placeholder="네이버 메일 비밀번호 또는 SMTP 전용 비밀번호"
                    />
                    <span className="mail-hint">네이버 메일 환경설정에서 SMTP/IMAP 사용을 허용해야 합니다.</span>
                  </label>
                )}
                {smtpProfile === 'custom' && (
                  <div className="mail-smtp-custom">
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
                      TLS/SSL 사용
                    </label>
                    <div className="mail-smtp-grid">
                      <label>
                        사용자명
                        <input value={customProfile.username} onChange={(event) => setCustomProfile((prev) => ({ ...prev, username: event.target.value }))} placeholder="SMTP 로그인 아이디" />
                      </label>
                      <label>
                        암호
                        <input type="password" value={customProfile.password} onChange={(event) => setCustomProfile((prev) => ({ ...prev, password: event.target.value }))} placeholder="SMTP 비밀번호" />
                      </label>
                    </div>
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
                  <button type="button" className="btn-soft" onClick={() => setAddressBookOpen(true)}>주소록</button>
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
                    <span>투찰금액</span>
                    <span>첨부</span>
                    <span>상태</span>
                    <span>작업</span>
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
                    <span>
                      <input
                        value={recipient.tenderAmount || ''}
                        onChange={(event) => handleRecipientFieldChange(recipient.id, 'tenderAmount', event.target.value)}
                        placeholder="예: 123,456,789 원"
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
                    <span className="mail-recipient-actions-cell">
                      <button type="button" className="btn-sm btn-muted" onClick={() => handleRemoveRecipient(recipient.id)}>삭제</button>
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
      {addressBookOpen && (
        <div className="mail-addressbook-overlay" role="presentation" onClick={() => setAddressBookOpen(false)}>
          <div
            className="mail-addressbook-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="mail-addressbook-modal__header">
              <h2>주소록 ({contacts.length})</h2>
              <div className="mail-addressbook-modal__actions">
                <button type="button" className="btn-sm btn-soft" onClick={handleAddContact}>주소 추가</button>
                <button type="button" className="btn-sm btn-soft" onClick={() => contactsFileInputRef.current?.click()}>가져오기</button>
                <button type="button" className="btn-sm btn-soft" onClick={handleExportContacts} disabled={!contacts.length}>내보내기</button>
                <button type="button" className="btn-sm btn-muted" onClick={() => setAddressBookOpen(false)}>닫기</button>
              </div>
              <input
                ref={contactsFileInputRef}
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                onChange={handleImportContacts}
              />
            </header>
            <div className="mail-addressbook-modal__body">
              {contacts.length ? contacts.map((contact) => (
                <div key={contact.id} className="mail-addressbook-modal__row">
                  <input
                    value={contact.vendorName}
                    onChange={(event) => handleContactFieldChange(contact.id, 'vendorName', event.target.value)}
                    placeholder="업체명"
                  />
                  <input
                    value={contact.contactName}
                    onChange={(event) => handleContactFieldChange(contact.id, 'contactName', event.target.value)}
                    placeholder="담당자"
                  />
                  <input
                    value={contact.email}
                    onChange={(event) => handleContactFieldChange(contact.id, 'email', event.target.value)}
                    placeholder="example@company.com"
                  />
                  <div className="mail-addressbook-modal__row-actions">
                    <button type="button" className="btn-sm btn-soft" onClick={() => handleUseContact(contact)}>추가</button>
                    <button type="button" className="btn-sm btn-muted" onClick={() => handleRemoveContact(contact.id)}>삭제</button>
                  </div>
                </div>
              )) : (
                <div className="mail-addressbook-modal__empty">주소록이 비어 있습니다. 주소를 추가하거나 가져오세요.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
