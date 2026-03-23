import React from 'react';
import '../../../../styles.css';
import '../../../../fonts.css';
import { useFeedback } from '../../../../components/FeedbackProvider.jsx';
import { extractManagerNames } from '../../../../utils/companyIndicators.js';
import tempCompaniesClient from '../../../../shared/tempCompaniesClient.js';

const EMPTY_FORM = {
  id: null,
  name: '',
  industry: '',
  managerName: '',
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
  ['industry', '공종'],
  ['managerName', '담당자'],
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
  ['notes', '비고'],
];

const INDUSTRY_OPTIONS = [
  { value: '', label: '공종 선택' },
  { value: 'eung', label: '전기' },
  { value: 'tongsin', label: '통신' },
  { value: 'sobang', label: '소방' },
];

const normalizeIndustry = (value) => {
  const token = String(value || '').trim().toLowerCase();
  if (!token) return '';
  if (token === '전기' || token === 'eung') return 'eung';
  if (token === '통신' || token === 'tongsin') return 'tongsin';
  if (token === '소방' || token === 'sobang') return 'sobang';
  return '';
};

const getIndustryLabel = (value) => INDUSTRY_OPTIONS.find((option) => option.value === normalizeIndustry(value))?.label || '';

const COMMA_NUMERIC_FIELDS = new Set([
  'sipyung',
  'performance3y',
  'performance5y',
  'qualityEval',
]);

const THOUSAND_UNIT_FIELDS = new Set([
  'sipyung',
  'performance3y',
  'performance5y',
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

const normalizeBizNoDigits = (value) => String(value ?? '').replace(/\D/g, '').slice(0, 10);

const formatBizNoValue = (value) => {
  const digits = normalizeBizNoDigits(value);
  if (digits.length <= 3) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
};

const formatNumericValue = (value) => {
  const normalized = normalizeNumericValue(value);
  if (!normalized) return '';
  const [integerPart = '', decimalPart] = normalized.split('.');
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decimalPart !== undefined ? `${formattedInteger}.${decimalPart}` : formattedInteger;
};

const multiplyThousandsStorage = (value) => {
  const normalized = normalizeNumericValue(value);
  if (!normalized) return '';
  const [integerPart = '', decimalPart = ''] = normalized.split('.');
  const digitsOnly = `${integerPart}${decimalPart}`.replace(/^0+(?=\d)/, '') || '0';
  const decimalPlaces = decimalPart.length;
  const number = Number(digitsOnly);
  if (!Number.isFinite(number)) return normalized;
  const scaled = (number / (10 ** decimalPlaces)) * 1000;
  return normalizeNumericValue(String(scaled));
};

const divideThousandsDisplay = (value) => {
  const normalized = normalizeNumericValue(value);
  if (!normalized) return '';
  const [integerPart = '', decimalPart = ''] = normalized.split('.');
  const digitsOnly = `${integerPart}${decimalPart}`.replace(/^0+(?=\d)/, '') || '0';
  const decimalPlaces = decimalPart.length;
  const number = Number(digitsOnly);
  if (!Number.isFinite(number)) return normalized;
  const scaled = number / (10 ** decimalPlaces) / 1000;
  return normalizeNumericValue(String(scaled));
};

const normalizeFormValues = (payload = {}) => {
  const next = { ...payload };
  next.industry = normalizeIndustry(next.industry);
  next.bizNo = formatBizNoValue(next.bizNo);
  COMMA_NUMERIC_FIELDS.forEach((field) => {
    next[field] = normalizeNumericValue(next[field]);
  });
  RATIO_FIELDS.forEach((field) => {
    next[field] = normalizeRatioValue(next[field]);
  });
  return next;
};

const buildSavePayload = (payload = {}) => {
  const next = { ...payload };
  next.industry = normalizeIndustry(next.industry);
  next.bizNo = normalizeBizNoDigits(next.bizNo);
  COMMA_NUMERIC_FIELDS.forEach((field) => {
    next[field] = THOUSAND_UNIT_FIELDS.has(field)
      ? multiplyThousandsStorage(next[field])
      : normalizeNumericValue(next[field]);
  });
  RATIO_FIELDS.forEach((field) => {
    next[field] = normalizeRatioValue(next[field]);
  });
  return next;
};

const getRouteIndustry = () => {
  const rawHash = window.location.hash || '#/temp-companies';
  const normalized = rawHash.startsWith('#') ? rawHash.slice(1) : rawHash;
  const [, query = ''] = normalized.split('?');
  const params = new URLSearchParams(query);
  return normalizeIndustry(params.get('industry'));
};

const closeTempCompaniesWindow = () => {
  try {
    window.close();
  } catch {
    window.location.hash = '#/search';
  }
};

export default function TempCompaniesPage() {
  const { notify, confirm } = useFeedback();
  const [items, setItems] = React.useState([]);
  const [query, setQuery] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [status, setStatus] = React.useState('');
  const [error, setError] = React.useState('');
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [isCreatingNew, setIsCreatingNew] = React.useState(false);
  const [defaultIndustry, setDefaultIndustry] = React.useState(() => getRouteIndustry());
  const [focusedField, setFocusedField] = React.useState('');

  React.useEffect(() => {
    document.title = '임시 업체 관리';
  }, []);

  React.useEffect(() => {
    const onHashChange = () => setDefaultIndustry(getRouteIndustry());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  React.useEffect(() => {
    const unsubscribe = window.electronAPI?.tempCompanies?.onDefaultIndustry?.((industry) => {
      const normalized = normalizeIndustry(industry);
      setDefaultIndustry(normalized);
      setForm((prev) => (prev.id || !isCreatingNew ? prev : { ...prev, industry: normalized }));
    });
    return typeof unsubscribe === 'function' ? unsubscribe : undefined;
  }, [isCreatingNew]);

  const loadItems = React.useCallback(async (nextQuery = query) => {
    setLoading(true);
    setError('');
    try {
      const list = await tempCompaniesClient.listCompanies({ query: nextQuery });
      setItems(Array.isArray(list) ? list : []);
      if (Array.isArray(list) && list.length > 0 && !form.id && !isCreatingNew) {
        setForm((prev) => (prev.id ? prev : normalizeFormValues({ ...EMPTY_FORM, ...list[0] })));
      }
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }, [form.id, isCreatingNew, query]);

  React.useEffect(() => {
    void loadItems('');
  }, [loadItems]);

  const handleSelect = React.useCallback((item) => {
    setForm(normalizeFormValues({ ...EMPTY_FORM, ...(item || {}) }));
    setIsCreatingNew(false);
    setFocusedField('');
    setStatus('');
    setError('');
  }, []);

  const handleChange = React.useCallback((key, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: key === 'bizNo'
        ? formatBizNoValue(value)
        : COMMA_NUMERIC_FIELDS.has(key)
          ? THOUSAND_UNIT_FIELDS.has(key)
            ? multiplyThousandsStorage(value)
            : normalizeNumericValue(value)
          : RATIO_FIELDS.has(key)
            ? normalizeRatioValue(value)
            : value,
    }));
  }, []);

  const handleReset = React.useCallback(() => {
    setForm({ ...EMPTY_FORM, industry: defaultIndustry || '' });
    setIsCreatingNew(true);
    setFocusedField('');
    setStatus('');
    setError('');
  }, [defaultIndustry]);

  const handleSave = React.useCallback(async () => {
    setSaving(true);
    setError('');
    setStatus('');
    try {
      const saved = await tempCompaniesClient.saveCompany(buildSavePayload(form));
      setIsCreatingNew(false);
      setForm(normalizeFormValues({ ...EMPTY_FORM, ...(saved || {}) }));
      await loadItems(query);
      notify({
        type: 'success',
        message: form.id ? '임시 업체를 수정했습니다.' : '임시 업체를 저장했습니다.',
      });
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setSaving(false);
    }
  }, [form, loadItems, notify, query]);

  const handleDelete = React.useCallback(async () => {
    if (!form.id) return;
    const approved = await confirm({
      title: '임시 업체 삭제',
      message: '선택한 임시 업체를 삭제하시겠습니까?',
      confirmText: '삭제',
      cancelText: '취소',
    });
    if (!approved) return;
    setSaving(true);
    setError('');
    setStatus('');
    try {
      await tempCompaniesClient.deleteCompany(form.id);
      setForm(EMPTY_FORM);
      setIsCreatingNew(false);
      await loadItems(query);
      notify({ type: 'success', message: '임시 업체를 삭제했습니다.' });
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setSaving(false);
    }
  }, [confirm, form.id, loadItems, notify, query]);

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
    <div className="records-editor-page temp-companies-page">
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
              <button type="button" className="btn-muted" onClick={handleReset}>업체추가</button>
            </div>
            {loading ? (
              <div className="records-editor-page__status">불러오는 중...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 640, overflow: 'auto' }}>
                {isCreatingNew && (
                  <button
                    type="button"
                    onClick={handleReset}
                    style={{
                      textAlign: 'left',
                      border: '1px solid #7c3aed',
                      background: '#f5f3ff',
                      borderRadius: 12,
                      padding: 12,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 700, color: '#5b21b6' }}>새 업체</div>
                    <div style={{ color: '#7c3aed', fontSize: 13 }}>
                      {getIndustryLabel(form.industry) ? `${getIndustryLabel(form.industry)} 공종으로 신규 등록 중` : '빈 입력 폼으로 신규 등록 중'}
                    </div>
                    <div style={{ color: '#8b5cf6', fontSize: 12 }}>업체 정보를 입력하고 저장하세요.</div>
                  </button>
                )}
                {items.map((item) => (
                  (() => {
                    const managerBadges = extractManagerNames({
                      managerName: item.managerName,
                      manager: item.managerName,
                      담당자: item.managerName,
                      비고: item.notes,
                      notes: item.notes,
                    });
                    const industryLabel = getIndustryLabel(item.industry);
                    return (
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ fontWeight: 700 }}>{item.name || '이름 없음'}</div>
                      {industryLabel && (
                        <span className={`records-tag records-tag--industry-${normalizeIndustry(item.industry)}`}>{industryLabel}</span>
                      )}
                      {managerBadges.map((manager) => (
                        <span key={`${item.id}-${manager}`} className="badge-person">{manager}</span>
                      ))}
                    </div>
                    <div style={{ color: '#475569', fontSize: 13 }}>{item.representative || '-'} | {item.bizNo || '-'}</div>
                    <div style={{ color: '#64748b', fontSize: 12 }}>{item.region || '-'}</div>
                  </button>
                    );
                  })()
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
                    {key === 'industry' ? (
                      <select
                        value={form.industry || ''}
                        onChange={(e) => handleChange('industry', e.target.value)}
                      >
                        {INDUSTRY_OPTIONS.map((option) => (
                          <option key={option.value || 'empty'} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    ) : key === 'notes' ? (
                      <textarea
                        value={form.notes || ''}
                        onChange={(e) => handleChange('notes', e.target.value)}
                        placeholder="비고"
                        style={{
                          minHeight: 44,
                          borderRadius: 14,
                          border: '1px solid #d4d4d8',
                          padding: 12,
                          fontSize: 14,
                          fontFamily: 'inherit',
                          resize: 'vertical',
                        }}
                      />
                    ) : (
                      <input
                        value={
                          COMMA_NUMERIC_FIELDS.has(key)
                            ? formatNumericValue(
                              THOUSAND_UNIT_FIELDS.has(key) && focusedField === key
                                ? divideThousandsDisplay(form[key])
                                : form[key]
                            )
                            : (form[key] || '')
                        }
                        onChange={(e) => handleChange(key, e.target.value)}
                        onFocus={() => {
                          if (THOUSAND_UNIT_FIELDS.has(key)) setFocusedField(key);
                        }}
                        onBlur={() => {
                          if (THOUSAND_UNIT_FIELDS.has(key) && focusedField === key) setFocusedField('');
                        }}
                        placeholder={label}
                      />
                    )}
                  </div>
                ))}
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
