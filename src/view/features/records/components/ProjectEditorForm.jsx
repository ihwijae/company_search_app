import React from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { recordsClient } from '../../../../shared/recordsClient.js';
import { useFeedback } from '../../../../components/FeedbackProvider.jsx';

const DEFAULT_FORM = {
  companyType: 'our',
  companyId: '',
  projectName: '',
  clientName: '',
  startDate: '',
  endDate: '',
  contractAmount: '',
  scopeNotes: '',
  categoryIds: [],
};

const ensureHtml = (value) => {
  if (!value) return '';
  const trimmed = String(value);
  if (/<[a-z][\s\S]*>/i.test(trimmed)) return trimmed;
  return `<p>${trimmed.replace(/\n/g, '<br />')}</p>`;
};

const quillModules = {
  toolbar: [
    [{ font: [] }],
    [{ size: ['small', false, 'large', 'huge'] }],
    ['bold', 'italic', 'underline'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ align: [] }],
    ['clean'],
  ],
};

const quillFormats = [
  'font',
  'size',
  'bold',
  'italic',
  'underline',
  'list',
  'bullet',
  'align',
];

const formatContractAmountInput = (value) => {
  if (value === null || value === undefined) return '';
  const digits = String(value).replace(/[^\d]/g, '');
  if (!digits) return '';
  const numeric = Number(digits);
  if (!Number.isFinite(numeric)) return digits;
  return numeric.toLocaleString();
};

export default function ProjectEditorForm({
  mode = 'create',
  initialProject = null,
  companies,
  categories,
  defaultCompanyId = '',
  defaultCompanyType = 'our',
  feedbackPortalTarget = null,
  onCancel,
  onSaved,
}) {
  const { confirm, notify } = useFeedback();
  const isEdit = mode === 'edit';
  const [form, setForm] = React.useState(DEFAULT_FORM);
  const [files, setFiles] = React.useState([]);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const [removedAttachmentIds, setRemovedAttachmentIds] = React.useState([]);

  const allCompanies = React.useMemo(
    () => (Array.isArray(companies) ? companies : []),
    [companies],
  );
  const ourCompanies = React.useMemo(
    () => allCompanies.filter((company) => !company.isMisc),
    [allCompanies],
  );
  const miscCompanies = React.useMemo(
    () => allCompanies.filter((company) => company.isMisc),
    [allCompanies],
  );
  const visibleCompanies = React.useMemo(
    () => (form.companyType === 'misc' ? miscCompanies : ourCompanies),
    [form.companyType, miscCompanies, ourCompanies],
  );
  const existingAttachments = React.useMemo(
    () => (Array.isArray(initialProject?.attachments) ? initialProject.attachments : []),
    [initialProject],
  );
  const visibleExistingAttachments = React.useMemo(
    () => existingAttachments.filter((attachment) => !removedAttachmentIds.includes(attachment.id)),
    [existingAttachments, removedAttachmentIds],
  );

  React.useEffect(() => {
    if (isEdit && initialProject) {
      let resolvedCompanyId = initialProject.primaryCompanyId ? String(initialProject.primaryCompanyId) : '';
      let resolvedCompanyType = initialProject.primaryCompanyIsMisc ? 'misc' : 'our';
      if (!resolvedCompanyId && initialProject.corporationName) {
        const matched = allCompanies.find((company) => company.name === initialProject.corporationName);
        if (matched) {
          resolvedCompanyId = String(matched.id);
          resolvedCompanyType = matched.isMisc ? 'misc' : 'our';
        }
      } else if (resolvedCompanyId) {
        const matched = allCompanies.find((company) => String(company.id) === resolvedCompanyId);
        if (matched) {
          resolvedCompanyType = matched.isMisc ? 'misc' : 'our';
        }
      }
      setForm({
        companyType: resolvedCompanyType,
        companyId: resolvedCompanyId,
        projectName: initialProject.projectName || '',
        clientName: initialProject.clientName || '',
        startDate: initialProject.startDate || '',
        endDate: initialProject.endDate || '',
        contractAmount: initialProject.contractAmount ? formatContractAmountInput(initialProject.contractAmount) : '',
        scopeNotes: ensureHtml(initialProject.scopeNotes || ''),
        categoryIds: (initialProject.categories || []).map((category) => category.id),
      });
    } else {
      let normalizedType = defaultCompanyType === 'misc' ? 'misc' : 'our';
      if (defaultCompanyId) {
        const matched = allCompanies.find((company) => String(company.id) === String(defaultCompanyId));
        if (matched) {
          normalizedType = matched.isMisc ? 'misc' : 'our';
        }
      }
      setForm({
        ...DEFAULT_FORM,
        companyType: normalizedType,
        companyId: defaultCompanyId ? String(defaultCompanyId) : '',
        scopeNotes: '',
      });
    }
    setFiles([]);
    setError('');
    setRemovedAttachmentIds([]);
  }, [isEdit, initialProject, allCompanies, defaultCompanyId, defaultCompanyType]);

  const toggleCategory = (categoryId) => {
    setForm((prev) => {
      const exists = prev.categoryIds.includes(categoryId);
      return {
        ...prev,
        categoryIds: exists
          ? prev.categoryIds.filter((id) => id !== categoryId)
          : [...prev.categoryIds, categoryId],
      };
    });
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    if (name === 'contractAmount') {
      setForm((prev) => ({ ...prev, contractAmount: formatContractAmountInput(value) }));
      return;
    }
    if (name === 'companyType') {
      setForm((prev) => ({ ...prev, companyType: value, companyId: '' }));
      return;
    }
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleScopeNotesChange = (html) => {
    setForm((prev) => ({ ...prev, scopeNotes: html }));
  };

  const handleFileChange = (event) => {
    const nextFiles = Array.from(event.target.files || []);
    if (!nextFiles.length) return;
    setFiles((prev) => [...prev, ...nextFiles]);
    event.target.value = '';
  };

  const handleRemovePendingFile = (targetIndex) => {
    setFiles((prev) => prev.filter((_, index) => index !== targetIndex));
  };

  const handleRemoveExistingAttachment = async (attachment) => {
    if (!isEdit || !initialProject?.id || !attachment?.id) return;
    const approved = await confirm({
      title: '첨부 파일 삭제',
      message: `${attachment.displayName || '첨부 파일'}을(를) 삭제할까요?`,
      confirmText: '삭제',
      cancelText: '취소',
      portalTarget: feedbackPortalTarget || null,
    });
    if (!approved) return;
    try {
      await recordsClient.removeAttachment(initialProject.id, attachment.id);
      setRemovedAttachmentIds((prev) => [...prev, attachment.id]);
      setError('');
      notify({
        type: 'success',
        message: '첨부 파일을 삭제했습니다.',
        portalTarget: feedbackPortalTarget || null,
      });
    } catch (err) {
      setError(err?.message || '첨부 파일을 삭제할 수 없습니다.');
      notify({
        type: 'error',
        message: err?.message || '첨부 파일을 삭제할 수 없습니다.',
        portalTarget: feedbackPortalTarget || null,
      });
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.companyId || !form.projectName) {
      setError('법인과 공사명을 선택해 주세요.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const attachmentPayloads = await Promise.all(
        files.map(async (file) => ({
          buffer: await file.arrayBuffer(),
          originalName: file.name,
          mimeType: file.type,
        })),
      );

      const selectedCompany = allCompanies.find((company) => String(company.id) === form.companyId);
      const corporationName = selectedCompany?.name || initialProject?.corporationName || '';
      if (!corporationName) {
        setError('선택한 법인을 확인할 수 없습니다.');
        setSaving(false);
        return;
      }

      const payload = {
        ...form,
        corporationName,
        contractAmount: form.contractAmount ? Number(form.contractAmount.replace(/[,\s]/g, '')) : null,
        primaryCompanyId: Number(form.companyId),
        attachments: attachmentPayloads,
      };

      const result = isEdit && initialProject
        ? await recordsClient.updateProject(initialProject.id, payload)
        : await recordsClient.createProject(payload);

      notify({
        type: 'success',
        message: isEdit ? '실적을 수정했습니다.' : '실적을 등록했습니다.',
        duration: 1600,
        portalTarget: feedbackPortalTarget || null,
      });

      await new Promise((resolve) => {
        window.setTimeout(resolve, 450);
      });

      if (typeof onSaved === 'function') {
        await onSaved(result);
      }
    } catch (err) {
      setError(err?.message || '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="records-editor-form" onSubmit={handleSubmit}>
      <div className="records-editor-form__grid">
        <label className="records-editor-form__field records-editor-form__field--company-type">
          법인 종류
          <select name="companyType" value={form.companyType} onChange={handleChange}>
            <option value="our">우리법인</option>
            <option value="misc">기타</option>
          </select>
        </label>
        <label className="records-editor-form__field records-editor-form__field--company-name">
          법인명
          <select name="companyId" value={form.companyId} onChange={handleChange} required>
            <option value="">{form.companyType === 'misc' ? '기타 법인 선택' : '우리 법인 선택'}</option>
            {visibleCompanies.map((company) => (
              <option key={company.id} value={company.id}>{company.name}</option>
            ))}
          </select>
          {isEdit && initialProject?.corporationName && !form.companyId && (
            <small className="records-editor-form__hint">기존 값: {initialProject.corporationName}</small>
          )}
        </label>
        <label className="records-editor-form__field">
          공사명
          <input name="projectName" value={form.projectName} onChange={handleChange} required />
        </label>
        <label className="records-editor-form__field">
          발주처
          <input name="clientName" value={form.clientName} onChange={handleChange} />
        </label>
        <label className="records-editor-form__field">
          계약금액 (원)
          <input name="contractAmount" value={form.contractAmount} onChange={handleChange} placeholder="예: 128790000" />
        </label>
        <label className="records-editor-form__field">
          공사기간 - 시작
          <input type="date" name="startDate" value={form.startDate} onChange={handleChange} />
        </label>
        <label className="records-editor-form__field">
          공사기간 - 종료
          <input type="date" name="endDate" value={form.endDate} onChange={handleChange} />
        </label>
      </div>

      <section className="records-editor-form__panel">
        <div className="records-editor-form__panel-head records-editor-form__panel-head--stack">
          <div>
            <div className="records-editor-form__panel-title">공사 종류</div>
            <small className="records-editor-form__hint">해당 실적에 맞는 공사 종류를 여러 개 선택할 수 있습니다.</small>
          </div>
        </div>
        <div className="records-editor-form__category-grid">
          {categories.map((category) => (
            <label key={category.id} className="records-editor-form__category-chip">
              <input
                type="checkbox"
                checked={form.categoryIds.includes(category.id)}
                onChange={() => toggleCategory(category.id)}
              />
              <span>{category.name}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="records-editor-form__panel">
        <div className="records-editor-form__panel-title">시공규모 및 비고</div>
        <ReactQuill
          theme="snow"
          value={form.scopeNotes}
          onChange={handleScopeNotesChange}
          modules={quillModules}
          formats={quillFormats}
          placeholder="프로젝트 메모를 입력하세요"
        />
      </section>

      <section className="records-editor-form__panel">
        <div className="records-editor-form__panel-head">
          <div>
            <div className="records-editor-form__panel-title">첨부 파일</div>
            <small className="records-editor-form__hint">PDF와 이미지를 여러 개 추가할 수 있습니다.</small>
          </div>
          <label className="records-editor-form__upload">
            파일 추가
            <input
              type="file"
              accept="application/pdf,image/*"
              multiple
              onChange={handleFileChange}
            />
          </label>
        </div>

        <div className="records-editor-form__attachment-grid">
          {visibleExistingAttachments.map((attachment) => (
            <div key={attachment.id} className="records-editor-form__attachment-card">
              <div className="records-editor-form__attachment-label">기존 첨부</div>
              <div className="records-editor-form__attachment-name">{attachment.displayName}</div>
              <button
                type="button"
                className="btn-danger records-editor-form__attachment-remove"
                onClick={() => handleRemoveExistingAttachment(attachment)}
              >
                삭제
              </button>
            </div>
          ))}
          {files.map((file, index) => (
            <div key={`${file.name}-${file.size}-${index}`} className="records-editor-form__attachment-card is-new">
              <div className="records-editor-form__attachment-label">추가 예정</div>
              <div className="records-editor-form__attachment-name">{file.name}</div>
              <button
                type="button"
                className="btn-danger records-editor-form__attachment-remove"
                onClick={() => handleRemovePendingFile(index)}
              >
                제외
              </button>
            </div>
          ))}
          {visibleExistingAttachments.length === 0 && files.length === 0 && (
            <div className="records-editor-form__attachment-empty">등록된 첨부가 없습니다.</div>
          )}
        </div>
      </section>

      {error && <p className="records-editor-form__error">{error}</p>}

      <footer className="records-editor-form__footer">
        <button type="button" onClick={onCancel} disabled={saving} className="btn-muted">닫기</button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? '저장 중...' : (isEdit ? '실적 수정 저장' : '실적 등록')}
        </button>
      </footer>
    </form>
  );
}
