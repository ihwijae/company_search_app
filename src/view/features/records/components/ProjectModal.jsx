import React from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { recordsClient } from '../../../../shared/recordsClient.js';

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

export default function ProjectModal({
  open,
  mode = 'create',
  initialProject = null,
  onClose,
  onSaved,
  companies,
  categories,
  defaultCompanyId = '',
  defaultCompanyType = 'our',
  onAttachmentRemoved,
}) {
  const isEdit = mode === 'edit';
  const [form, setForm] = React.useState(DEFAULT_FORM);
  const [file, setFile] = React.useState(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const [attachmentRemoved, setAttachmentRemoved] = React.useState(false);
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

  React.useEffect(() => {
    if (!open) return;
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
    setFile(null);
    setError('');
    setAttachmentRemoved(false);
  }, [open, isEdit, initialProject, allCompanies, defaultCompanyId, defaultCompanyType]);

  const handleRemoveExistingAttachment = async () => {
    if (!isEdit || !initialProject?.id || attachmentRemoved || !initialProject.attachment) return;
    if (!window.confirm('첨부 파일을 삭제할까요?')) return;
    try {
      await recordsClient.removeAttachment(initialProject.id);
      setAttachmentRemoved(true);
      if (typeof onAttachmentRemoved === 'function') {
        onAttachmentRemoved(initialProject.id);
      }
      alert('첨부 파일을 삭제했습니다.');
    } catch (err) {
      setError(err?.message || '첨부 파일을 삭제할 수 없습니다.');
    }
  };

  if (!open) return null;

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
      const formatted = formatContractAmountInput(value);
      setForm((prev) => ({ ...prev, contractAmount: formatted }));
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

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.companyId || !form.projectName) {
      setError('법인과 공사명을 선택해 주세요.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      let attachmentPayload;
      if (file) {
        const arrayBuffer = await file.arrayBuffer();
        attachmentPayload = {
          buffer: arrayBuffer,
          originalName: file.name,
          mimeType: file.type,
        };
      }

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
      };
      let result;
      if (isEdit && initialProject) {
        result = await recordsClient.updateProject(initialProject.id, {
          ...payload,
          attachment: attachmentPayload,
        });
      } else {
        result = await recordsClient.createProject({
          ...payload,
          attachment: attachmentPayload,
        });
      }
      if (onSaved) onSaved(result);
      onClose();
    } catch (err) {
      setError(err?.message || '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="records-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="records-modal"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="records-modal__header">
          <h2>{isEdit ? '실적 수정' : '실적 등록'}</h2>
          <button className="records-modal__close" onClick={onClose} aria-label="닫기">×</button>
        </header>
        <form className="records-modal__body" onSubmit={handleSubmit}>
          <div className="records-form-grid">
            <label>
              법인 종류
              <select name="companyType" value={form.companyType} onChange={handleChange}>
                <option value="our">우리법인</option>
                <option value="misc">기타</option>
              </select>
            </label>
            <label>
              법인명
              <select name="companyId" value={form.companyId} onChange={handleChange} required>
                <option value="">{form.companyType === 'misc' ? '기타 법인 선택' : '우리 법인을 선택하세요'}</option>
                {visibleCompanies.map((company) => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </select>
              {isEdit && initialProject?.corporationName && !form.companyId && (
                <small className="records-modal__attachment-hint">기존 값: {initialProject.corporationName}</small>
              )}
            </label>
            <label>
              공사명
              <input name="projectName" value={form.projectName} onChange={handleChange} required />
            </label>
            <label>
              발주처
              <input name="clientName" value={form.clientName} onChange={handleChange} />
            </label>
            <label>
              계약금액 (원)
              <input name="contractAmount" value={form.contractAmount} onChange={handleChange} placeholder="예: 128790000" />
            </label>
            <label>
              공사기간 - 시작
              <input type="date" name="startDate" value={form.startDate} onChange={handleChange} />
            </label>
            <label>
              공사기간 - 종료
              <input type="date" name="endDate" value={form.endDate} onChange={handleChange} />
            </label>
          </div>

          <label className="records-modal__notes">
            시공규모 및 비고
            <ReactQuill
              theme="snow"
              value={form.scopeNotes}
              onChange={handleScopeNotesChange}
              modules={quillModules}
              formats={quillFormats}
              placeholder="프로젝트 메모를 입력하세요"
            />
          </label>

          <div className="records-modal__categories">
            <span>공사 종류 (다중 선택)</span>
            <div className="records-modal__category-grid">
              {categories.map((category) => (
                <label key={category.id} className="records-modal__category-chip">
                  <input
                    type="checkbox"
                    checked={form.categoryIds.includes(category.id)}
                    onChange={() => toggleCategory(category.id)}
                  />
                  {category.name}
                </label>
              ))}
            </div>
          </div>

          <label className="records-modal__notes">
            첨부 파일 (PDF/이미지)
            <input
              type="file"
              accept="application/pdf,image/*"
              onChange={(event) => setFile(event.target.files && event.target.files[0] ? event.target.files[0] : null)}
            />
            {isEdit && initialProject?.attachment && !attachmentRemoved && !file && (
              <small className="records-modal__attachment-hint">기존 파일 유지 (새 파일 선택 시 교체됩니다)</small>
            )}
            {isEdit && initialProject?.attachment && !attachmentRemoved && (
              <button
                type="button"
                className="btn-danger records-modal__remove-attachment"
                onClick={handleRemoveExistingAttachment}
              >
                실적증명서 삭제
              </button>
            )}
            {isEdit && attachmentRemoved && (
              <small className="records-modal__attachment-hint">첨부 파일이 삭제되었습니다.</small>
            )}
          </label>

          {error && <p className="records-modal__error">{error}</p>}

          <footer className="records-modal__footer">
            <button type="button" onClick={onClose} disabled={saving} className="btn-muted">취소</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? '저장 중...' : (isEdit ? '수정 저장' : '저장')}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
