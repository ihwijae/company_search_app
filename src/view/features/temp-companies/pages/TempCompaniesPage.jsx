import React from 'react';
import tempCompaniesClient from '../../../../shared/tempCompaniesClient.js';

const EMPTY_FORM = {
  id: null,
  name: '',
  representative: '',
  bizNo: '',
  region: '',
  sipyung: '',
  performance3y: '',
  performance5y: '',
  debtRatio: '',
  currentRatio: '',
  bizYears: '',
  creditGrade: '',
  womenOwned: '',
  smallBusiness: '',
  jobCreation: '',
  qualityEval: '',
  notes: '',
};

const FIELD_LAYOUT = [
  ['name', '업체명'],
  ['representative', '대표자'],
  ['bizNo', '사업자번호'],
  ['region', '지역'],
  ['sipyung', '시평'],
  ['performance3y', '3년실적'],
  ['performance5y', '5년실적'],
  ['debtRatio', '부채비율'],
  ['currentRatio', '유동비율'],
  ['bizYears', '영업기간'],
  ['creditGrade', '신용평가'],
  ['womenOwned', '여성기업'],
  ['smallBusiness', '중소기업'],
  ['jobCreation', '일자리창출'],
  ['qualityEval', '품질평가'],
];

const COMMA_NUMERIC_FIELDS = new Set([
  'sipyung',
  'performance3y',
  'performance5y',
  'bizYears',
  'qualityEval',
]);

const RATIO_FIELDS = new Set([
  'debtRatio',
  'currentRatio',
]);

const normalizeNumericValue = (value) => {
  const text = String(value ?? '').replace(/,/g, '').replace(/[^\d.]/g, '');
  if (!text) return '';
  const [integerPart = '', ...decimalParts] = text.split('.');
  const normalizedInteger = integerPart.replace(/^0+(?=\d)/, '') || (integerPart ? '0' : '');
  if (decimalParts.length === 0) return normalizedInteger;
  return `${normalizedInteger}.${decimalParts.join('')}`;
};

const normalizeRatioValue = (value) => {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  const trimmed = digits.replace(/^0+(?=\d)/, '') || '0';
  if (trimmed.length <= 2) {
    return `0.${trimmed.padStart(2, '0')}`;
  }
  const integerPart = trimmed.slice(0, -2).replace(/^0+(?=\d)/, '') || '0';
  const decimalPart = trimmed.slice(-2);
  return `${integerPart}.${decimalPart}`;
};

const formatNumericValue = (value) => {
  const normalized = normalizeNumericValue(value);
  if (!normalized) return '';
  const [integerPart = '', decimalPart] = normalized.split('.');
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decimalPart !== undefined ? `${formattedInteger}.${decimalPart}` : formattedInteger;
};

const normalizeFormValues = (payload = {}) => {
  const next = { ...payload };
  COMMA_NUMERIC_FIELDS.forEach((field) => {
    next[field] = normalizeNumericValue(next[field]);
  });
  RATIO_FIELDS.forEach((field) => {
    next[field] = normalizeRatioValue(next[field]);
  });
  return next;
};

const closeTempCompaniesWindow = () => {
  try {
    window.close();
  } catch {
    window.location.hash = '#/search';
  }
};

export default function TempCompaniesPage() {
  const [items, setItems] = React.useState([]);
  const [query, setQuery] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [status, setStatus] = React.useState('');
  const [error, setError] = React.useState('');
  const [form, setForm] = React.useState(EMPTY_FORM);

  React.useEffect(() => {
    document.title = '임시 업체 관리';
  }, []);

  const loadItems = React.useCallback(async (nextQuery = query) => {
    setLoading(true);
    setError('');
    try {
      const list = await tempCompaniesClient.listCompanies({ query: nextQuery });
      setItems(Array.isArray(list) ? list : []);
      if (Array.isArray(list) && list.length > 0 && !form.id) {
        setForm((prev) => (prev.id ? prev : normalizeFormValues({ ...EMPTY_FORM, ...list[0] })));
      }
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }, [form.id, query]);

  React.useEffect(() => {
    void loadItems('');
  }, [loadItems]);

  const handleSelect = React.useCallback((item) => {
    setForm(normalizeFormValues({ ...EMPTY_FORM, ...(item || {}) }));
    setStatus('');
    setError('');
  }, []);

  const handleChange = React.useCallback((key, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: COMMA_NUMERIC_FIELDS.has(key)
        ? normalizeNumericValue(value)
        : RATIO_FIELDS.has(key)
          ? normalizeRatioValue(value)
          : value,
    }));
  }, []);

  const handleReset = React.useCallback(() => {
    setForm(EMPTY_FORM);
    setStatus('');
    setError('');
  }, []);

  const handleSave = React.useCallback(async () => {
    setSaving(true);
    setError('');
    setStatus('');
    try {
      const saved = await tempCompaniesClient.saveCompany(normalizeFormValues(form));
      setStatus('저장되었습니다.');
      setForm(normalizeFormValues({ ...EMPTY_FORM, ...(saved || {}) }));
      await loadItems(query);
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setSaving(false);
    }
  }, [form, loadItems, query]);

  const handleDelete = React.useCallback(async () => {
    if (!form.id) return;
    if (!window.confirm('선택한 임시 업체를 삭제하시겠습니까?')) return;
    setSaving(true);
    setError('');
    setStatus('');
    try {
      await tempCompaniesClient.deleteCompany(form.id);
      setStatus('삭제되었습니다.');
      setForm(EMPTY_FORM);
      await loadItems(query);
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setSaving(false);
    }
  }, [form.id, loadItems, query]);

  const handleExport = React.useCallback(async () => {
    setError('');
    setStatus('');
    try {
      const result = await tempCompaniesClient.exportCompanies();
      if (!result?.canceled) {
        setStatus(`내보내기 완료 (${result?.count || 0}건)`);
      }
    } catch (err) {
      setError(err?.message || String(err));
    }
  }, []);

  const handleImport = React.useCallback(async () => {
    setError('');
    setStatus('');
    try {
      const result = await tempCompaniesClient.importCompanies();
      if (!result?.canceled) {
        setStatus(`가져오기 완료 (${result?.importedCount || 0}건, 덮어쓰기 ${result?.replacedCount || 0}건)`);
        await loadItems(query);
      }
    } catch (err) {
      setError(err?.message || String(err));
    }
  }, [loadItems, query]);

  return (
    <div className="records-editor-page">
      <div className="title-drag" />
      <div className="records-editor-page__backdrop" />
      <main className="records-editor-page__shell" style={{ maxWidth: 1320 }}>
        <header className="records-editor-page__header">
          <div className="records-editor-page__header-copy">
            <p className="records-editor-page__eyebrow">Temp Companies</p>
            <h1>임시 업체 관리</h1>
            <p className="records-editor-page__description">DB와 분리된 임시 업체를 저장하고 협정보드 검색에서 함께 사용할 수 있습니다.</p>
          </div>
          <button type="button" className="btn-muted records-editor-page__close" onClick={closeTempCompaniesWindow}>창 닫기</button>
        </header>

        <section className="records-editor-page__content" style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 16 }}>
          <section className="records-editor-page__form-wrap" style={{ padding: 18 }}>
            <div className="toolbar" style={{ marginBottom: 12 }}>
              <input
                className="input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="업체명/대표자/사업자번호 검색"
                style={{ flex: 1 }}
              />
              <button type="button" className="btn-soft" onClick={() => void loadItems(query)} disabled={loading}>검색</button>
            </div>
            <div className="toolbar" style={{ marginBottom: 12 }}>
              <button type="button" className="btn-soft" onClick={handleImport}>가져오기</button>
              <button type="button" className="btn-soft" onClick={handleExport}>내보내기</button>
              <button type="button" className="btn-muted" onClick={handleReset}>새 항목</button>
            </div>
            {loading ? (
              <div className="records-editor-page__status">불러오는 중...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 640, overflow: 'auto' }}>
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(item)}
                    style={{
                      textAlign: 'left',
                      border: form.id === item.id ? '1px solid #2563eb' : '1px solid #d1d5db',
                      background: form.id === item.id ? '#eff6ff' : '#ffffff',
                      borderRadius: 12,
                      padding: 12,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>{item.name || '이름 없음'}</div>
                    <div style={{ color: '#475569', fontSize: 13 }}>{item.representative || '-'} | {item.bizNo || '-'}</div>
                    <div style={{ color: '#64748b', fontSize: 12 }}>{item.region || '-'}</div>
                  </button>
                ))}
                {items.length === 0 && (
                  <div className="records-editor-page__status">등록된 임시 업체가 없습니다.</div>
                )}
              </div>
            )}
          </section>

          <section className="records-editor-page__form-wrap">
            <div className="records-editor-form">
              <div className="records-editor-form__grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                {FIELD_LAYOUT.map(([key, label]) => (
                  <div key={key} className="records-editor-form__field">
                    <label>{label}</label>
                    <input
                      value={COMMA_NUMERIC_FIELDS.has(key) ? formatNumericValue(form[key]) : (form[key] || '')}
                      onChange={(e) => handleChange(key, e.target.value)}
                      placeholder={label}
                    />
                  </div>
                ))}
                <div className="records-editor-form__field" style={{ gridColumn: '1 / -1' }}>
                  <label>비고</label>
                  <textarea
                    value={form.notes || ''}
                    onChange={(e) => handleChange('notes', e.target.value)}
                    placeholder="비고"
                    style={{
                      minHeight: 140,
                      borderRadius: 14,
                      border: '1px solid #d4d4d8',
                      padding: 14,
                      fontSize: 14,
                      fontFamily: 'inherit',
                      resize: 'vertical',
                    }}
                  />
                </div>
              </div>
              {(status || error) && (
                <div className={`records-editor-page__status${error ? ' is-error' : ''}`} style={{ marginTop: 12 }}>
                  {error || status}
                </div>
              )}
              <div className="toolbar" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
                {form.id && (
                  <button type="button" className="btn-danger" onClick={handleDelete} disabled={saving}>삭제</button>
                )}
                <button type="button" className="primary" onClick={handleSave} disabled={saving}>
                  {saving ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}
