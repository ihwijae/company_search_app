import React from 'react';
import Sidebar from '../../../../components/Sidebar';
import * as XLSX from 'xlsx';
import 'xlsx/dist/cpexcel.js';
import seedContacts from '../addressBook.seed.json';
import { loadPersisted, savePersisted } from '../../../../shared/persistence.js';

const DEFAULT_PROJECT_INFO = {
  announcementNumber: '공고번호를 불러오세요',
  announcementName: '파일을 불러오면 공고명이 표시됩니다',
  owner: '발주기관',
  closingDate: '입찰마감일시를 불러오세요',
  baseAmount: '기초금액을 불러오세요',
};

const SEED_RECIPIENTS = [];

const SEED_CONTACTS = Array.isArray(seedContacts) ? seedContacts : [];
const GLOBAL_RECIPIENTS = Object.freeze([
  { name: '조세희 상무님', email: 'superssay@naver.com' },
]);
const MAIL_DRAFT_STORAGE_KEY = 'mail:draft';

const ITEMS_PER_PAGE = 10;
const normalizeVendorName = (name = '') => name
  .replace(/[\s]/g, '')
  .replace(/^[㈜\(주\)\(합\)\(유\)\(재\)]+/gi, '')
  .replace(/^주식회사|^유한회사|^합자회사|^재단법인|^사단법인/gi, '')
  .toLowerCase();
const trimValue = (value) => (typeof value === 'string' ? value.trim() : '');
const formatEmailAddress = (name, email) => {
  const normalizedEmail = trimValue(email);
  if (!normalizedEmail) return '';
  const normalizedName = trimValue(name);
  return normalizedName ? `${normalizedName} <${normalizedEmail}>` : normalizedEmail;
};
const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const buildAttachmentDescriptor = (raw) => {
  if (!raw) return null;
  if (typeof raw === 'string') {
    const path = trimValue(raw);
    if (!path) return null;
    const name = path.split(/[/\\]/).pop() || path;
    return { path, name };
  }
  const path = trimValue(raw.path || raw.webkitRelativePath || '');
  if (!path) return null;
  const name = raw.name || raw.filename || raw.label || path.split(/[/\\]/).pop();
  return { path, name };
};
const normalizeAttachmentList = (list = []) => {
  if (!Array.isArray(list) || !list.length) return [];
  return list.map(buildAttachmentDescriptor).filter(Boolean);
};
const sanitizeRecipientDraftList = (list = []) => {
  if (!Array.isArray(list) || !list.length) return [];
  return list.map((item, index) => {
    if (!item || typeof item !== 'object') return null;
    const id = Number(item.id);
    return {
      id: Number.isFinite(id) && id > 0 ? id : index + 1,
      vendorName: item.vendorName || '',
      contactName: item.contactName || '',
      email: item.email || '',
      tenderAmount: item.tenderAmount || '',
      attachments: normalizeAttachmentList(item.attachments),
      status: item.status || '대기',
    };
  }).filter(Boolean);
};
const serializeRecipientsForPersist = (recipients = []) => {
  if (!Array.isArray(recipients) || !recipients.length) return [];
  return recipients.map((item, index) => {
    const id = Number(item.id);
    return {
      id: Number.isFinite(id) && id > 0 ? id : index + 1,
      vendorName: item.vendorName || '',
      contactName: item.contactName || '',
      email: item.email || '',
      tenderAmount: item.tenderAmount || '',
      attachments: normalizeAttachmentList(item.attachments),
      status: item.status || '대기',
    };
  });
};
const replaceTemplateTokens = (template, context = {}) => {
  if (!template) return '';
  return String(template).replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, key) => {
    const value = context[key];
    return value === undefined || value === null ? '' : String(value);
  });
};

const stripHtmlTags = (html) => {
  if (!html) return '';
  return String(html)
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/p\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{2,}/g, '\n\n')
    .trim();
};
const DEFAULT_BODY_TEMPLATE = `
<div style="font-family:'Malgun Gothic',Dotum,Arial,sans-serif;font-size:19px;color:#1f2933;line-height:1.7;">
  <p style="margin:0 0 12px;color:#0455c0;font-size:22px;font-weight:bold;">
    {{owner}} "{{announcementNumber}} {{announcementName}}"의 입찰내역을 보내드립니다.
  </p>
  <p style="margin:0 0 12px;">
    이메일에 첨부된 <span style="font-weight:bold;text-decoration:underline;">ENC 파일</span> 1개만 입찰서에 첨부하셔서 투찰해 주시기 바랍니다.<br />
    함께 첨부된 엑셀파일은 투찰 시 금액 확인용이니 <span style="font-weight:bold;text-decoration:underline;">절대로 첨부하지 마시기 바랍니다.</span>
  </p>
  <p style="margin:0 0 18px;">좋은 결과 있으시기 바랍니다.</p>
  <hr style="border:none;border-top:1px solid #c9ced6;margin:16px 0;" />
  <p style="margin:4px 0;">공사명 : <strong>{{announcementName}}</strong></p>
  <p style="margin:4px 0;">공고번호 : <strong>{{announcementNumber}}</strong></p>
  <p style="margin:4px 0;">
    <strong><span style="color:#d22b2b;">{{vendorName}} 투찰금액 : {{tenderAmount}}</span></strong>
  </p>
  <p style="margin:12px 0;color:#0455c0;font-weight:bold;font-size:24px;">ENC 파일만 첨부하세요!!!</p>
  <p style="margin:4px 0;">투찰마감일 {{closingDate}}</p>
</div>`;

const DEFAULT_CUSTOM_PROFILE = Object.freeze({ host: '', port: '587', secure: true, username: '', password: '' });
const SMTP_PROFILE_STORAGE_KEY = 'mail:smtpProfiles';

const EMPTY_MAIL_STATE = {
  projectInfo: { ...DEFAULT_PROJECT_INFO },
  recipients: [],
  vendorAmounts: {},
  subjectTemplate: '{{owner}} "{{announcementNumber}} {{announcementName}}"_{{vendorName}}',
  bodyTemplate: DEFAULT_BODY_TEMPLATE,
  smtpProfile: 'naver',
  senderName: '',
  senderEmail: '',
  replyTo: '',
  customProfile: { ...DEFAULT_CUSTOM_PROFILE },
  sendDelay: 1,
  includeGlobalRecipients: false,
};

const makeSmtpProfileId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export default function MailAutomationPage() {
  const draftRef = React.useRef(null);
  if (draftRef.current === null) {
    draftRef.current = loadPersisted(MAIL_DRAFT_STORAGE_KEY, null);
  }
  const initialDraft = draftRef.current || {};

  const [activeMenu, setActiveMenu] = React.useState('mail');
  const [excelFile, setExcelFile] = React.useState(null);
  const [projectInfo, setProjectInfo] = React.useState(() => (
    isPlainObject(initialDraft.projectInfo)
      ? { ...DEFAULT_PROJECT_INFO, ...initialDraft.projectInfo }
      : { ...DEFAULT_PROJECT_INFO }
  ));
  const [recipients, setRecipients] = React.useState(() => (
    sanitizeRecipientDraftList(initialDraft.recipients) || SEED_RECIPIENTS
  ));
  const persistedContacts = React.useMemo(() => loadPersisted('mail:addressBook', SEED_CONTACTS), []);
  const [contacts, setContacts] = React.useState(persistedContacts);
  const [vendorAmounts, setVendorAmounts] = React.useState(() => (
    isPlainObject(initialDraft.vendorAmounts) ? { ...initialDraft.vendorAmounts } : {}
  ));
  const [subjectTemplate, setSubjectTemplate] = React.useState(() => initialDraft.subjectTemplate || '{{owner}} "{{announcementNumber}} {{announcementName}}"_{{vendorName}}');
  const [bodyTemplate, setBodyTemplate] = React.useState(() => initialDraft.bodyTemplate || DEFAULT_BODY_TEMPLATE);
  const [smtpProfile, setSmtpProfile] = React.useState(() => initialDraft.smtpProfile || 'naver');
  const [senderName, setSenderName] = React.useState(() => initialDraft.senderName || '');
  const [senderEmail, setSenderEmail] = React.useState(() => initialDraft.senderEmail || '');
  const [replyTo, setReplyTo] = React.useState(() => initialDraft.replyTo || '');
  const [smtpProfileName, setSmtpProfileName] = React.useState(() => initialDraft.smtpProfileName || '');
  const [gmailPassword, setGmailPassword] = React.useState('');
  const [naverPassword, setNaverPassword] = React.useState('');
  const [customProfile, setCustomProfile] = React.useState(() => {
    if (isPlainObject(initialDraft.customProfile)) {
      return { ...DEFAULT_CUSTOM_PROFILE, ...initialDraft.customProfile, password: '' };
    }
    return { ...DEFAULT_CUSTOM_PROFILE };
  });
  const [sendDelay, setSendDelay] = React.useState(() => {
    const saved = Number(initialDraft.sendDelay);
    return Number.isFinite(saved) && saved >= 0 ? saved : 1;
  });
  const [statusMessage, setStatusMessage] = React.useState('');
  const [currentPage, setCurrentPageState] = React.useState(1);
  const [addressBookOpen, setAddressBookOpen] = React.useState(false);
  const [addressBookTargetId, setAddressBookTargetId] = React.useState(null);
  const [sending, setSending] = React.useState(false);
  const [includeGlobalRecipients, setIncludeGlobalRecipients] = React.useState(() => Boolean(initialDraft.includeGlobalRecipients));
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewData, setPreviewData] = React.useState({ subject: '', html: '', text: '' });
  const [addressBookQuery, setAddressBookQuery] = React.useState('');
  const persistedSmtpProfiles = React.useMemo(() => {
    const stored = loadPersisted(SMTP_PROFILE_STORAGE_KEY, []);
    if (!Array.isArray(stored)) return [];
    return stored
      .map((profile) => {
        if (!profile || typeof profile !== 'object') return null;
        const id = profile.id || makeSmtpProfileId();
        return {
          id,
          name: profile.name || profile.label || profile.senderEmail || `프로필-${id}`,
          smtpProfile: profile.smtpProfile || 'naver',
          senderName: profile.senderName || '',
          senderEmail: profile.senderEmail || '',
          replyTo: profile.replyTo || '',
          gmailPassword: profile.gmailPassword || '',
          naverPassword: profile.naverPassword || '',
          customProfile: {
            ...DEFAULT_CUSTOM_PROFILE,
            ...profile.customProfile,
            password: profile.customProfile?.password || '',
          },
        };
      })
      .filter(Boolean);
  }, []);
  const [smtpProfiles, setSmtpProfiles] = React.useState(persistedSmtpProfiles);
  const [selectedSmtpProfileId, setSelectedSmtpProfileId] = React.useState(() => persistedSmtpProfiles[0]?.id || '');
  const globalRecipientAddresses = React.useMemo(() => GLOBAL_RECIPIENTS
    .map((recipient) => {
      const email = trimValue(recipient.email);
      const address = formatEmailAddress(recipient.name, recipient.email);
      if (!email || !address) return null;
      return { email: email.toLowerCase(), address };
    })
    .filter(Boolean), []);

  const excelInputRef = React.useRef(null);
  const attachmentInputs = React.useRef({});
  const recipientIdRef = React.useRef(SEED_RECIPIENTS.length + 1);
  const contactIdRef = React.useRef(persistedContacts.length + 1);
  const contactsFileInputRef = React.useRef(null);
  const contactIndex = React.useMemo(() => {
    const index = new Map();
    contacts.forEach((contact) => {
      const raw = contact.vendorName || '';
      if (!raw) return;
      raw.split(',').forEach((part) => {
        const key = normalizeVendorName(part);
        if (!key) return;
        if (!index.has(key)) index.set(key, []);
        index.get(key).push(contact);
      });
    });
    return index;
  }, [contacts]);

  const resolveContactForVendor = React.useCallback((vendor) => {
    const normalized = normalizeVendorName(vendor);
    if (!normalized) return null;
    const candidates = contactIndex.get(normalized);
    if (!candidates || candidates.length === 0) return null;
    if (candidates.length === 1) {
      const best = candidates[0];
      return {
        contactName: best.contactName || '',
        email: best.email || '',
        note: null,
      };
    }
    const summary = candidates.map((c) => c.contactName || c.email || '담당자').join(', ');
    return {
      contactName: `[중복 확인] ${summary}`,
      email: '',
      note: '중복 담당자 확인 필요',
    };
  }, [contactIndex]);

  React.useEffect(() => {
    savePersisted('mail:addressBook', contacts);
    contactIdRef.current = contacts.length + 1;
  }, [contacts]);
  const contactIndexRef = React.useRef(new Map());

  React.useEffect(() => {
    const nextId = recipients.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
    recipientIdRef.current = Math.max(nextId, 1);
  }, [recipients]);

  React.useEffect(() => {
    const payload = {
      projectInfo,
      recipients: serializeRecipientsForPersist(recipients),
      subjectTemplate,
      bodyTemplate,
      sendDelay,
      includeGlobalRecipients,
      vendorAmounts,
      smtpProfile,
      senderName,
      senderEmail,
      replyTo,
      smtpProfileName,
      customProfile: {
        host: customProfile.host || '',
        port: customProfile.port || '587',
        secure: Boolean(customProfile.secure),
        username: customProfile.username || '',
      },
    };
    savePersisted(MAIL_DRAFT_STORAGE_KEY, payload);
  }, [
    projectInfo,
    recipients,
    subjectTemplate,
    bodyTemplate,
    sendDelay,
    includeGlobalRecipients,
    vendorAmounts,
    smtpProfile,
    senderName,
    senderEmail,
    replyTo,
    customProfile.host,
    customProfile.port,
    customProfile.secure,
    customProfile.username,
    smtpProfileName,
  ]);

  React.useEffect(() => {
    savePersisted(SMTP_PROFILE_STORAGE_KEY, smtpProfiles);
  }, [smtpProfiles]);

  React.useEffect(() => {
    if (!selectedSmtpProfileId) return;
    if (!smtpProfiles.some((profile) => profile.id === selectedSmtpProfileId)) {
      setSelectedSmtpProfileId(smtpProfiles[0]?.id || '');
    }
  }, [selectedSmtpProfileId, smtpProfiles]);

  const resolveSmtpConfig = React.useCallback(() => {
    const trimmedSenderEmail = trimValue(senderEmail);
    if (!trimmedSenderEmail) {
      throw new Error('발신 이메일을 입력해 주세요.');
    }
    const base = {
      senderEmail: trimmedSenderEmail,
      senderName: trimValue(senderName),
      replyTo: trimValue(replyTo),
    };
    if (smtpProfile === 'gmail') {
      if (!gmailPassword) {
        throw new Error('Gmail 앱 비밀번호를 입력해 주세요.');
      }
      return {
        ...base,
        connection: {
          host: 'smtp.gmail.com',
          port: 465,
          secure: true,
          auth: { user: trimmedSenderEmail, pass: gmailPassword },
        },
      };
    }
    if (smtpProfile === 'naver') {
      if (!naverPassword) {
        throw new Error('네이버 SMTP 비밀번호를 입력해 주세요.');
      }
      return {
        ...base,
        connection: {
          host: 'smtp.naver.com',
          port: 465,
          secure: true,
          auth: { user: trimmedSenderEmail, pass: naverPassword },
        },
      };
    }
    const host = trimValue(customProfile.host);
    if (!host) {
      throw new Error('SMTP 호스트를 입력해 주세요.');
    }
    const username = trimValue(customProfile.username) || trimmedSenderEmail;
    const password = customProfile.password;
    if (!password) {
      throw new Error('SMTP 비밀번호를 입력해 주세요.');
    }
    const portNumber = Number(customProfile.port) || (customProfile.secure ? 465 : 587);
    return {
      ...base,
      connection: {
        host,
        port: portNumber,
        secure: Boolean(customProfile.secure),
        auth: { user: username, pass: password },
      },
    };
  }, [smtpProfile, senderEmail, senderName, replyTo, gmailPassword, naverPassword, customProfile]);

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
            const resolvedContact = resolveContactForVendor(vendor);
            vendorEntries.push({
              id: vendorEntries.length + 1,
              vendorName: vendor,
              contactName: resolvedContact?.contactName || '',
              email: resolvedContact?.email || '',
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
              const resolvedContact = resolveContactForVendor(item.vendorName);
              return {
                ...item,
                tenderAmount: amount,
                contactName: item.contactName || resolvedContact?.contactName || '',
                email: item.email || resolvedContact?.email || '',
              };
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
        const resolvedContact = resolveContactForVendor(value);
        if (resolvedContact) {
          if (!updated.contactName && resolvedContact.contactName) {
            updated.contactName = resolvedContact.contactName;
          }
          if (!updated.email && resolvedContact.email) {
            updated.email = resolvedContact.email;
          }
        }
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
    const descriptors = normalizeAttachmentList(files);
    if (!descriptors.length) return;
    setRecipients((prev) => prev.map((item) => {
      if (item.id !== id) return item;
      const next = [...(item.attachments || []), ...descriptors];
      return { ...item, attachments: next };
    }));
    if (event.target) event.target.value = '';
  };

  const handleRemoveAttachments = (id) => {
    setRecipients((prev) => prev.map((item) => (item.id === id ? { ...item, attachments: [] } : item)));
  };

  const handleOpenAddressBook = React.useCallback((targetId = null) => {
    setAddressBookTargetId(targetId);
    setAddressBookOpen(true);
  }, []);

  const handleCloseAddressBook = React.useCallback(() => {
    setAddressBookOpen(false);
    setAddressBookTargetId(null);
    setAddressBookQuery('');
  }, []);

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
        setContacts(imported);
        setStatusMessage(`주소록을 ${importedCount}건으로 덮어썼습니다.`);
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

  const handleApplyContactToRecipient = React.useCallback((recipientId, contact) => {
    if (!recipientId || !contact) return;
    setRecipients((prev) => prev.map((item) => {
      if (item.id !== recipientId) return item;
      const updated = {
        ...item,
        vendorName: item.vendorName || contact.vendorName || '',
        contactName: contact.contactName || contact.vendorName || item.contactName || '',
        email: contact.email || item.email || '',
      };
      const normalized = normalizeVendorName(contact.vendorName);
      if (normalized && vendorAmounts[normalized]) {
        updated.tenderAmount = vendorAmounts[normalized];
      }
      return updated;
    }));
    setStatusMessage(`주소록 정보를 적용했습니다: ${contact.vendorName || contact.contactName || ''}`);
    handleCloseAddressBook();
  }, [vendorAmounts, handleCloseAddressBook]);

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

  const handleSaveSmtpProfile = React.useCallback(() => {
    const trimmed = trimValue(smtpProfileName) || trimValue(senderEmail) || trimValue(senderName);
    if (!trimmed) {
      alert('SMTP 프로필 이름을 입력해 주세요.');
      return;
    }
    const profileData = {
      name: trimmed,
      smtpProfile,
      senderName,
      senderEmail,
      replyTo,
      gmailPassword,
      naverPassword,
      customProfile: { ...customProfile },
    };
    let nextId = null;
    let nextMessage = '';
    setSmtpProfiles((prev) => {
      const existingIndex = prev.findIndex((profile) => profile.name === trimmed);
      if (existingIndex >= 0) {
        const updated = [...prev];
        const existingId = updated[existingIndex].id;
        updated[existingIndex] = { ...profileData, id: existingId };
        nextId = existingId;
        nextMessage = `SMTP 프로필 '${trimmed}'을 업데이트했습니다.`;
        return updated;
      }
      const newId = makeSmtpProfileId();
      nextId = newId;
      nextMessage = `SMTP 프로필 '${trimmed}'을 저장했습니다.`;
      return [...prev, { ...profileData, id: newId }];
    });
    if (nextId) {
      setSelectedSmtpProfileId(nextId);
    }
    setSmtpProfileName(trimmed);
    if (nextMessage) {
      setStatusMessage(nextMessage);
    }
  }, [senderEmail, senderName, smtpProfile, replyTo, gmailPassword, naverPassword, customProfile, smtpProfileName]);

  const handleLoadSmtpProfile = React.useCallback(() => {
    if (!selectedSmtpProfileId) {
      alert('불러올 SMTP 프로필을 선택해 주세요.');
      return;
    }
    const profile = smtpProfiles.find((item) => item.id === selectedSmtpProfileId);
    if (!profile) {
      alert('선택한 SMTP 프로필을 찾을 수 없습니다.');
      return;
    }
    setSmtpProfile(profile.smtpProfile || 'naver');
    setSenderName(profile.senderName || '');
    setSenderEmail(profile.senderEmail || '');
    setReplyTo(profile.replyTo || '');
    setGmailPassword(profile.gmailPassword || '');
    setNaverPassword(profile.naverPassword || '');
    setCustomProfile({ ...DEFAULT_CUSTOM_PROFILE, ...profile.customProfile });
    setSmtpProfileName(profile.name || '');
    setStatusMessage(`SMTP 프로필 '${profile.name}'을 불러왔습니다.`);
  }, [selectedSmtpProfileId, smtpProfiles]);

  const handleResetDraft = React.useCallback(() => {
    const confirmed = window.confirm('현재 메일 작성 내용을 모두 비울까요?');
    if (!confirmed) return;
    setExcelFile(null);
    setProjectInfo({ ...DEFAULT_PROJECT_INFO });
    setRecipients([]);
    setVendorAmounts({});
    setSubjectTemplate(EMPTY_MAIL_STATE.subjectTemplate);
    setBodyTemplate(EMPTY_MAIL_STATE.bodyTemplate);
    setSendDelay(EMPTY_MAIL_STATE.sendDelay);
    setIncludeGlobalRecipients(false);
    setSmtpProfile(EMPTY_MAIL_STATE.smtpProfile);
    setSenderName('');
    setSenderEmail('');
    setReplyTo('');
    setSmtpProfileName('');
    setGmailPassword('');
    setNaverPassword('');
    setCustomProfile({ ...EMPTY_MAIL_STATE.customProfile });
    setSelectedSmtpProfileId('');
    setStatusMessage('메일 작성 내용을 초기화했습니다.');
    setCurrentPageState(1);
  }, []);

  const handleApplyGlobalRecipient = React.useCallback(() => {
    setIncludeGlobalRecipients((prev) => {
      const next = !prev;
      setStatusMessage(next ? '팀장님이 모든 메일 받는사람에 포함됩니다.' : '팀장님 자동 추가를 해제했습니다.');
      return next;
    });
  }, []);

  const buildRecipientContext = React.useCallback((recipient) => ({
    announcementNumber: projectInfo.announcementNumber || '',
    announcementName: projectInfo.announcementName || '',
    owner: projectInfo.owner || '',
    closingDate: projectInfo.closingDate || '',
    baseAmount: projectInfo.baseAmount || '',
    vendorName: recipient.vendorName || '',
    tenderAmount: recipient.tenderAmount || '',
  }), [projectInfo]);

  const buildFallbackText = React.useCallback((context) => ([
    `${context.owner || ''} "${context.announcementNumber || ''} ${context.announcementName || ''}"`,
    '',
    `공사명 : ${context.announcementName || '-'}`,
    `공고번호 : ${context.announcementNumber || '-'}`,
    `투찰금액 : ${context.tenderAmount || '-'}`,
    `투찰마감일 : ${context.closingDate || '-'}`,
  ].join('\n')), []);

  const buildRecipientHeader = React.useCallback((recipient) => {
    const primaryEmail = trimValue(recipient.email);
    const primaryName = trimValue(recipient.contactName) || trimValue(recipient.vendorName);
    const primaryAddress = formatEmailAddress(primaryName, primaryEmail);
    const dedup = new Set();
    const addresses = [];
    if (primaryAddress && primaryEmail) {
      addresses.push(primaryAddress);
      dedup.add(primaryEmail.toLowerCase());
    }
    if (includeGlobalRecipients && globalRecipientAddresses.length) {
      globalRecipientAddresses.forEach((entry) => {
        if (dedup.has(entry.email)) return;
        dedup.add(entry.email);
        addresses.push(entry.address);
      });
    }
    return addresses.join(', ');
  }, [includeGlobalRecipients, globalRecipientAddresses]);

  const handleSendAll = React.useCallback(async () => {
    if (sending) return;
    const ready = recipients.filter((item) => trimValue(item.email) && Array.isArray(item.attachments) && item.attachments.length > 0);
    if (!ready.length) {
      alert('발송 대상이 없습니다. 이메일과 첨부를 확인해 주세요.');
      return;
    }

    const mailApi = window.electronAPI?.mail;
    if (typeof mailApi?.sendBatch !== 'function') {
      setStatusMessage('이 빌드에서는 메일 발송 기능을 사용할 수 없습니다.');
      return;
    }

    let smtpConfig;
    try {
      smtpConfig = resolveSmtpConfig();
    } catch (error) {
      setStatusMessage(error?.message || 'SMTP 설정을 확인해 주세요.');
      return;
    }

    const readyIds = new Set(ready.map((item) => item.id));
    setRecipients((prev) => prev.map((item) => (readyIds.has(item.id) ? { ...item, status: '발송 중' } : item)));
    setSending(true);
    setStatusMessage(`총 ${ready.length}건 발송을 시작합니다...`);

    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const messages = ready.map((recipient) => {
      const context = buildRecipientContext(recipient);
      const resolvedSubject = replaceTemplateTokens(subjectTemplate || '', context).trim() || `${context.announcementName || '입찰'} 안내`;
      const resolvedBodyHtml = replaceTemplateTokens(bodyTemplate || '', context).trim();
      const plainText = stripHtmlTags(resolvedBodyHtml) || buildFallbackText(context);
      const recipientAddress = buildRecipientHeader(recipient);
      const attachments = (recipient.attachments || [])
        .map((file) => {
          const filePath = file?.path || file?.webkitRelativePath;
          if (!filePath) return null;
          const filename = file?.name || filePath.split(/[/\\]/).pop();
          return { path: filePath, filename };
        })
        .filter(Boolean);
      return {
        recipientId: recipient.id,
        to: recipientAddress,
        from: smtpConfig.senderEmail,
        fromName: smtpConfig.senderName,
        replyTo: smtpConfig.replyTo || undefined,
        subject: resolvedSubject,
        text: `${plainText}\n\n발송 시각: ${timestamp}`,
        html: resolvedBodyHtml || undefined,
        attachments,
      };
    });

    try {
      const delayMs = Math.max(0, Number(sendDelay) || 0) * 1000;
      const response = await mailApi.sendBatch({
        connection: smtpConfig.connection,
        messages,
        delayMs,
      });
      if (response?.success) {
        const results = response.results || [];
        const resultMap = new Map(results.map((item) => [item.recipientId, item]));
        setRecipients((prev) => prev.map((item) => {
          if (!readyIds.has(item.id)) return item;
          const result = resultMap.get(item.id);
          if (!result) return { ...item, status: '완료' };
          return { ...item, status: result.success ? '완료' : '실패' };
        }));
        const successCount = results.filter((item) => item.success).length;
        const failures = results.filter((item) => !item.success);
        const failCount = failures.length;
        if (failCount > 0) {
          const reason = failures[0]?.error || '원인을 확인해 주세요.';
          console.error('[mail] 일부 발송 실패', failures);
          setStatusMessage(`발송 완료: 성공 ${successCount}건 / 실패 ${failCount}건 (예: ${reason})`);
        } else {
          setStatusMessage(`발송 완료: 성공 ${successCount}건`);
        }
      } else {
        setRecipients((prev) => prev.map((item) => (readyIds.has(item.id) ? { ...item, status: '실패' } : item)));
        setStatusMessage(response?.message || '메일 발송에 실패했습니다.');
      }
    } catch (error) {
      console.error('[mail] send batch failed', error);
      setRecipients((prev) => prev.map((item) => (readyIds.has(item.id) ? { ...item, status: '실패' } : item)));
      setStatusMessage(error?.message || '메일 발송 중 오류가 발생했습니다.');
    } finally {
      setSending(false);
    }
  }, [sending, recipients, resolveSmtpConfig, subjectTemplate, bodyTemplate, buildRecipientContext, buildFallbackText, sendDelay, buildRecipientHeader]);

  const handleTestMail = React.useCallback(async () => {
    const api = window.electronAPI?.mail?.sendTest;
    if (typeof api !== 'function') {
      setStatusMessage('이 빌드에서는 테스트 메일 기능을 사용할 수 없습니다.');
      return;
    }
    let smtpConfig;
    try {
      smtpConfig = resolveSmtpConfig();
    } catch (error) {
      setStatusMessage(error?.message || 'SMTP 설정을 확인해 주세요.');
      return;
    }
    const { connection, senderEmail: trimmedSenderEmail, senderName: normalizedSenderName, replyTo: normalizedReplyTo } = smtpConfig;

    const timestamp = (() => {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const hh = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
    })();

    const sampleRecipient = recipients.find((item) => item.vendorName || item.tenderAmount) || recipients[0] || null;
    const templateContext = {
      announcementNumber: projectInfo.announcementNumber || '',
      announcementName: projectInfo.announcementName || '',
      owner: projectInfo.owner || '',
      closingDate: projectInfo.closingDate || '',
      baseAmount: projectInfo.baseAmount || '',
      vendorName: sampleRecipient?.vendorName || '',
      tenderAmount: sampleRecipient?.tenderAmount || '',
    };

    const resolvedSubjectCore = replaceTemplateTokens(subjectTemplate || '', templateContext).trim();
    const resolvedBodyHtml = replaceTemplateTokens(bodyTemplate || '', templateContext).trim();

    const summaryLines = [
      '이 메일은 협정보조에서 SMTP 설정을 확인하기 위해 발송된 테스트 메일입니다.',
      '',
      `공고번호: ${templateContext.announcementNumber || '-'}`,
      `공고명: ${templateContext.announcementName || '-'}`,
      `발주처: ${templateContext.owner || '-'}`,
      `입찰마감일시: ${templateContext.closingDate || '-'}`,
      `기초금액: ${templateContext.baseAmount || '-'}`,
      '',
      `발송 계정: ${trimmedSenderEmail}`,
      `발송 시각: ${timestamp}`,
      '',
      '※ 본 메일은 테스트 용도로만 발송되었습니다.',
    ];

    const plainBodyFallback = resolvedBodyHtml ? stripHtmlTags(resolvedBodyHtml) : summaryLines.join('\n');
    const finalSubject = `[테스트] ${resolvedSubjectCore || (projectInfo.announcementName || 'SMTP 연결 확인')} (${timestamp})`;

    setStatusMessage('테스트 메일을 보내는 중입니다...');
    try {
      const response = await api({
        connection,
        message: {
          from: trimmedSenderEmail,
          fromName: normalizedSenderName,
          to: trimmedSenderEmail,
          replyTo: normalizedReplyTo || undefined,
          subject: finalSubject,
          text: plainBodyFallback,
          html: resolvedBodyHtml || undefined,
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
  }, [resolveSmtpConfig, projectInfo, recipients, subjectTemplate, bodyTemplate]);

  const handleTemplatePreview = React.useCallback(() => {
    const sampleRecipient = recipients.find((item) => item.vendorName || item.tenderAmount || item.email) || {
      id: 0,
      vendorName: '업체명',
      contactName: '담당자',
      email: 'sample@example.com',
      tenderAmount: '123,456,789 원',
    };
    const context = buildRecipientContext(sampleRecipient);
    const subject = replaceTemplateTokens(subjectTemplate || '', context).trim() || `${context.announcementName || '입찰'} 안내`;
    const html = replaceTemplateTokens(bodyTemplate || '', context).trim();
    const text = stripHtmlTags(html) || buildFallbackText(context);
    setPreviewData({ subject, html, text });
    setPreviewOpen(true);
  }, [recipients, subjectTemplate, bodyTemplate, buildRecipientContext, buildFallbackText]);

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
                <div className="mail-smtp-profile-manager">
                  <label>
                    SMTP 프로필 이름
                    <input value={smtpProfileName} onChange={(event) => setSmtpProfileName(event.target.value)} placeholder="예: 본사_네이버" />
                  </label>
                  <div className="mail-smtp-profile-buttons">
                    <button type="button" className="btn-soft" onClick={handleSaveSmtpProfile}>현재 설정 저장</button>
                  </div>
                  <label>
                    저장된 SMTP 프로필
                    <select value={selectedSmtpProfileId} onChange={(event) => setSelectedSmtpProfileId(event.target.value)}>
                      <option value="">프로필을 선택해 주세요</option>
                      {smtpProfiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.name} {profile.senderEmail ? `(${profile.senderEmail})` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="mail-smtp-profile-buttons">
                    <button type="button" className="btn-soft" onClick={handleLoadSmtpProfile} disabled={!smtpProfiles.length}>불러오기</button>
                  </div>
                </div>
                <div className="mail-smtp-options">
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
                </div>
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
                <p className="mail-hint">HTML 태그/스타일을 그대로 입력하면 실제 메일 본문에 적용됩니다.</p>
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
                  <button type="button" className="btn-soft" onClick={() => handleOpenAddressBook()}>주소록</button>
                  <button
                    type="button"
                    className={`btn-soft ${includeGlobalRecipients ? 'btn-soft--active' : ''}`}
                    onClick={handleApplyGlobalRecipient}
                  >
                    {includeGlobalRecipients ? '팀장님 포함 중' : '받는사람에 팀장님 추가'}
                  </button>
                  <button type="button" className="btn-soft" onClick={handleAddRecipient}>업체 추가</button>
                  <button type="button" className="btn-primary" onClick={handleSendAll} disabled={sending}>{sending ? '발송 중...' : '전체 발송'}</button>
                </div>
              </header>

              <div className="mail-recipient-actions" style={{ justifyContent: 'flex-start', marginBottom: '8px' }}>
                <button type="button" className="btn-soft" onClick={handleResetDraft}>비우기</button>
              </div>

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
                    <span className="mail-recipient-contact">
                      <input
                        value={recipient.contactName}
                        onChange={(event) => handleRecipientFieldChange(recipient.id, 'contactName', event.target.value)}
                        placeholder="담당자"
                      />
                      <button
                        type="button"
                        className="mail-contact-picker"
                        onClick={() => handleOpenAddressBook(recipient.id)}
                        title="주소록에서 불러오기"
                      >
                        🔍
                      </button>
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
      {previewOpen && (
        <div className="mail-addressbook-overlay" role="presentation">
          <div
            className="mail-addressbook-modal"
            role="dialog"
            aria-modal="true"
            style={{ maxWidth: 720 }}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="mail-addressbook-modal__header">
              <h2>템플릿 미리보기</h2>
              <div className="mail-addressbook-modal__actions">
                <button type="button" className="btn-sm btn-muted" onClick={() => setPreviewOpen(false)}>닫기</button>
              </div>
            </header>
            <div className="mail-template-preview">
              <p><strong>제목</strong> {previewData.subject || '(제목 없음)'}</p>
              <div className="mail-template-preview__body" dangerouslySetInnerHTML={{ __html: previewData.html || previewData.text.replace(/\n/g, '<br />') }} />
            </div>
          </div>
        </div>
      )}
      {addressBookOpen && (
        <div className="mail-addressbook-overlay" role="presentation">
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
                <button
                  type="button"
                  className="btn-sm btn-primary"
                  onClick={() => { savePersisted('mail:addressBook', contacts); alert('주소록을 저장했습니다.'); }}
                >
                  저장
                </button>
                <button type="button" className="btn-sm btn-muted" onClick={handleCloseAddressBook}>닫기</button>
              </div>
              <div className="mail-addressbook-search">
                <input
                  value={addressBookQuery}
                  onChange={(event) => setAddressBookQuery(event.target.value)}
                  placeholder="업체명/담당자/이메일 검색"
                />
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
              {contacts.length ? contacts
                .filter((contact) => {
                  if (!addressBookQuery) return true;
                  const keyword = addressBookQuery.trim().toLowerCase();
                  if (!keyword) return true;
                  return [contact.vendorName, contact.contactName, contact.email]
                    .some((value) => (value || '').toLowerCase().includes(keyword));
                })
                .map((contact) => (
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
                    <button
                      type="button"
                      className="btn-sm btn-soft"
                      onClick={() => {
                        if (addressBookTargetId) {
                          handleApplyContactToRecipient(addressBookTargetId, contact);
                        } else {
                          handleUseContact(contact);
                        }
                      }}
                    >
                      {addressBookTargetId ? '적용' : '추가'}
                    </button>
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
