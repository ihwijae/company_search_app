import React from 'react';
import { recordsClient } from '../../../../shared/recordsClient.js';

export default function ProjectModal({ open, onClose, onSaved, companies, categories }) {
  const [form, setForm] = React.useState({
    corporationName: '',
    projectName: '',
    clientName: '',
    startDate: '',
    endDate: '',
    contractAmount: '',
    scopeNotes: '',
    primaryCompanyId: '',
    categoryIds: [],
  });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (open) {
      setForm({
        corporationName: '',
        projectName: '',
        clientName: '',
        startDate: '',
        endDate: '',
        contractAmount: '',
        scopeNotes: '',
        primaryCompanyId: '',
        categoryIds: [],
      });
      setError('');
    }
  }, [open]);

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
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.corporationName || !form.projectName) {
      setError('법인명과 공사명을 입력해 주세요.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        contractAmount: form.contractAmount ? Number(form.contractAmount.replace(/[,\s]/g, '')) : null,
        primaryCompanyId: form.primaryCompanyId ? Number(form.primaryCompanyId) : null,
      };
      await recordsClient.createProject(payload);
      if (onSaved) onSaved();
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
          <h2>새 실적 등록</h2>
          <button className="records-modal__close" onClick={onClose} aria-label="닫기">×</button>
        </header>
        <form className="records-modal__body" onSubmit={handleSubmit}>
          <div className="records-form-grid">
            <label>
              법인명
              <input name="corporationName" value={form.corporationName} onChange={handleChange} required />
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
            <label>
              우리 업체
              <select name="primaryCompanyId" value={form.primaryCompanyId} onChange={handleChange}>
                <option value="">선택 안 함</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="records-modal__notes">
            시공규모 및 비고
            <textarea
              name="scopeNotes"
              value={form.scopeNotes}
              onChange={handleChange}
              rows={4}
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

          {error && <p className="records-modal__error">{error}</p>}

          <footer className="records-modal__footer">
            <button type="button" onClick={onClose} disabled={saving} className="btn-muted">취소</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? '저장 중...' : '저장'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
