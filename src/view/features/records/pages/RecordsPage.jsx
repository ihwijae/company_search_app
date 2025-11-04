import React from 'react';
import '../../../../styles.css';
import '../../../../fonts.css';
import Sidebar from '../../../../components/Sidebar';
import { recordsClient } from '../../../../shared/recordsClient.js';
import ProjectModal from '../components/ProjectModal.jsx';

const formatCurrency = (value) => {
  if (value === null || value === undefined) return '-';
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value);
  return num.toLocaleString();
};

const formatDateToken = (value) => {
  if (!value) return '';
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str.replace(/-/g, '.');
  }
  if (/^\d{4}\.\d{2}\.\d{2}$/.test(str)) {
    return str;
  }
  if (/^\d{4}[.\-]\d{2}$/.test(str)) {
    return str.replace(/-/g, '.');
  }
  return str;
};

const formatDateRange = (start, end) => {
  const startText = start ? formatDateToken(start) : '';
  const endText = end ? formatDateToken(end) : '';
  if (!startText && !endText) return '—';
  if (startText && !endText) return `${startText} ~ 진행 중`;
  if (!startText && endText) return `~ ${endText}`;
  return `${startText} ~ ${endText}`;
};

const toDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const formatElapsedPeriod = (targetDate, baseDate) => {
  if (!(baseDate instanceof Date) || Number.isNaN(baseDate.getTime())) return '';
  const parsedTarget = toDate(targetDate);
  if (!parsedTarget) return '';
  let years = baseDate.getFullYear() - parsedTarget.getFullYear();
  let months = baseDate.getMonth() - parsedTarget.getMonth();
  let days = baseDate.getDate() - parsedTarget.getDate();

  if (days < 0) {
    const prevMonth = new Date(baseDate.getFullYear(), baseDate.getMonth(), 0);
    days += prevMonth.getDate();
    months -= 1;
  }
  if (months < 0) {
    months += 12;
    years -= 1;
  }
  if (years < 0) return '0년 0개월 0일';
  return `${years}년 ${months}개월 ${days}일`;
};

const buildCategoryTree = (items) => {
  const map = new Map();
  const roots = [];
  items.forEach((item) => {
    map.set(item.id, { ...item, children: [] });
  });
  map.forEach((item) => {
    if (item.parentId && map.has(item.parentId)) {
      map.get(item.parentId).children.push(item);
    } else {
      roots.push(item);
    }
  });
  const sortRecursive = (nodes) => nodes
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name))
    .map((node) => ({ ...node, children: sortRecursive(node.children || []) }));
  return sortRecursive(roots);
};

const flattenCategories = (tree) => {
  const list = [];
  const walk = (nodes) => {
    nodes.forEach((node) => {
      list.push(node);
      if (node.children && node.children.length) walk(node.children);
    });
  };
  walk(tree);
  return list;
};

function CategoryTree({ items, activeId, onSelect }) {
  const renderNode = (node, depth = 0) => (
    <li key={node.id}>
      <button
        type="button"
        className={activeId === node.id ? 'records-category active' : 'records-category'}
        onClick={() => onSelect(node.id)}
        style={{ paddingLeft: `${12 + depth * 12}px` }}
      >
        {node.name}
      </button>
      {node.children && node.children.length > 0 && (
        <ul className="records-category-tree">
          {node.children.map((child) => renderNode(child, depth + 1))}
        </ul>
      )}
    </li>
  );

  return (
    <ul className="records-category-tree">
      <li>
        <button
          type="button"
          className={!activeId ? 'records-category active' : 'records-category'}
          onClick={() => onSelect(null)}
        >
          전체 보기
        </button>
      </li>
      {items.map((node) => renderNode(node))}
    </ul>
  );
}

const DEFAULT_MODAL_STATE = { open: false, mode: 'create', project: null, defaultCompanyId: '' };

export default function RecordsPage() {
  const [activeMenu, setActiveMenu] = React.useState('records');
  const [projects, setProjects] = React.useState([]);
  const [categories, setCategories] = React.useState([]);
  const [companies, setCompanies] = React.useState([]);
  const [flatCategories, setFlatCategories] = React.useState([]);
  const [filters, setFilters] = React.useState({ keyword: '', companyId: '', categoryId: null });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [modalState, setModalState] = React.useState(DEFAULT_MODAL_STATE);
  const [selectedProjectId, setSelectedProjectId] = React.useState(null);
  const [companyDialog, setCompanyDialog] = React.useState({ open: false, name: '', saving: false, error: '' });
  const pendingSelectRef = React.useRef(null);
  const baseDateRef = React.useRef(new Date());
  const baseDateLabel = React.useMemo(() => {
    const baseDate = baseDateRef.current;
    const year = baseDate.getFullYear();
    const month = String(baseDate.getMonth() + 1).padStart(2, '0');
    const day = String(baseDate.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
  }, []);

  const fetchTaxonomies = React.useCallback(async () => {
    try {
      const [cats, comps] = await Promise.all([
        recordsClient.listCategories({ includeInactive: false }),
        recordsClient.listCompanies({ includeInactive: false }),
      ]);
      const tree = buildCategoryTree(cats);
      setCategories(tree);
      setFlatCategories(flattenCategories(tree));
      setCompanies(comps);
    } catch (err) {
      console.error('[Renderer] Failed to load taxonomies:', err);
    }
  }, []);

  const fetchProjects = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const payload = {
        keyword: filters.keyword || undefined,
        companyIds: filters.companyId ? [Number(filters.companyId)] : undefined,
        categoryIds: filters.categoryId ? [filters.categoryId] : undefined,
      };
      const list = await recordsClient.listProjects(payload);
      setProjects(list);
      const pendingId = pendingSelectRef.current;
      if (pendingId && list.some((item) => item.id === pendingId)) {
        setSelectedProjectId(pendingId);
        pendingSelectRef.current = null;
      } else if (selectedProjectId && !list.some((item) => item.id === selectedProjectId)) {
        setSelectedProjectId(list.length ? list[0].id : null);
      } else if (!selectedProjectId && list.length) {
        setSelectedProjectId(list[0].id);
      }
    } catch (err) {
      setError(err?.message || '실적을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [filters, selectedProjectId]);

  React.useEffect(() => {
    fetchTaxonomies();
  }, [fetchTaxonomies]);

  React.useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleMenuSelect = (key) => {
    if (key === 'records') {
      setActiveMenu('records');
      window.location.hash = '#/records';
    } else if (key === 'search') {
      window.location.hash = '#/search';
    } else if (key === 'agreements') {
      window.location.hash = '#/agreements';
    } else if (key === 'settings') {
      window.location.hash = '#/settings';
    }
  };

  const clearFilters = () => {
    setFilters({ keyword: '', companyId: '', categoryId: null });
  };

  const closeModal = React.useCallback(() => {
    setModalState({ ...DEFAULT_MODAL_STATE, defaultCompanyId: filters.companyId || '' });
  }, [filters.companyId]);

  const handleProjectSaved = React.useCallback((project) => {
    if (project?.id) {
      pendingSelectRef.current = project.id;
      setSelectedProjectId(project.id);
    }
    closeModal();
    fetchProjects();
  }, [fetchProjects, closeModal]);

  const handleOpenAttachment = React.useCallback(async (projectId) => {
    try {
      if (!projectId) return;
      await recordsClient.openAttachment(projectId);
    } catch (err) {
      alert(err?.message || '첨부 파일을 열 수 없습니다.');
    }
  }, []);

  const handleDeleteProject = React.useCallback(async (project) => {
    if (!project?.id) return;
    const title = project.projectName || project.name || project.clientName || '해당 실적';
    const confirmed = window.confirm(`정말로 삭제하시겠습니까?\n${title}`);
    if (!confirmed) return;
    try {
      await recordsClient.deleteProject(project.id);
      setSelectedProjectId((prev) => (prev === project.id ? null : prev));
      if (pendingSelectRef.current === project.id) {
        pendingSelectRef.current = null;
      }
      fetchProjects();
    } catch (err) {
      alert(err?.message || '실적을 삭제할 수 없습니다.');
    }
  }, [fetchProjects]);

  const handleAddCompany = React.useCallback(() => {
    setCompanyDialog({ open: true, name: '', saving: false, error: '' });
  }, []);

  const closeCompanyDialog = React.useCallback(() => {
    setCompanyDialog({ open: false, name: '', saving: false, error: '' });
  }, []);

  const handleCompanyNameChange = (event) => {
    const { value } = event.target;
    setCompanyDialog((prev) => ({ ...prev, name: value, error: '' }));
  };

  const handleCompanyDialogSubmit = async (event) => {
    event.preventDefault();
    const trimmedName = companyDialog.name.trim();
    if (!trimmedName) {
      setCompanyDialog((prev) => ({ ...prev, error: '법인명을 입력해 주세요.' }));
      return;
    }
    setCompanyDialog((prev) => ({ ...prev, saving: true, error: '' }));
    try {
      const saved = await recordsClient.saveCompany({ name: trimmedName, alias: trimmedName, isPrimary: false });
      await fetchTaxonomies();
      setFilters((prev) => ({ ...prev, companyId: String(saved.id) }));
      setCompanyDialog({ open: false, name: '', saving: false, error: '' });
    } catch (err) {
      setCompanyDialog((prev) => ({ ...prev, saving: false, error: err?.message || '법인을 추가할 수 없습니다.' }));
    }
  };

  const openCreateModal = React.useCallback(() => {
    setModalState({ open: true, mode: 'create', project: null, defaultCompanyId: filters.companyId || '' });
  }, [filters.companyId]);

  const openEditModal = React.useCallback((project) => {
    setSelectedProjectId(project.id);
    setModalState({ open: true, mode: 'edit', project, defaultCompanyId: '' });
  }, []);

  const handleAttachmentRemoved = React.useCallback((projectId) => {
    if (!projectId) return;
    pendingSelectRef.current = projectId;
    setSelectedProjectId(projectId);
    fetchProjects();
  }, [fetchProjects]);

  const handleExportDatabase = React.useCallback(async () => {
    try {
      const result = await recordsClient.exportDatabase();
      if (!result || result.canceled) return;
      const exportedPath = result.exportedPath || result.targetPath || result.path;
      if (exportedPath) {
        const attachmentNote = result.includedAttachments ? ' (첨부 포함)' : ' (첨부 없음)';
        alert(`실적 데이터 패키지를 내보냈습니다.\n${exportedPath}${attachmentNote}`);
      }
    } catch (err) {
      alert(err?.message || 'DB 파일을 내보낼 수 없습니다.');
    }
  }, []);

  const handleImportDatabase = React.useCallback(async () => {
    const confirmed = window.confirm('가져오기를 실행하면 현재 실적 데이터가 덮어써집니다. 계속할까요?');
    if (!confirmed) return;
    try {
      const result = await recordsClient.importDatabase();
      if (!result || result.canceled) return;
      await fetchTaxonomies();
      await fetchProjects();
      const importedNote = result.attachmentsImported ? ' (첨부 포함)' : '';
      alert(`실적 데이터를 가져왔습니다.${importedNote}`);
    } catch (err) {
      alert(err?.message || 'DB 파일을 가져올 수 없습니다.');
    }
  }, [fetchProjects, fetchTaxonomies]);

  return (
    <div className="app-shell">
      <Sidebar
        active={activeMenu}
        onSelect={handleMenuSelect}
        fileStatuses={{}}
        collapsed={true}
      />
      <div className="main">
        <div className="title-drag" />
        <div className="topbar" />
        <div className="stage records-stage">
          <div className="records-layout">
            <aside className="records-panel records-panel--categories">
              <header className="records-panel__header">
                <h2>공사 종류</h2>
              </header>
              <CategoryTree
                items={categories}
                activeId={filters.categoryId}
                onSelect={(id) => setFilters((prev) => ({ ...prev, categoryId: id }))}
              />
            </aside>

            <section className="records-panel records-panel--workspace">
              <header className="records-toolbar">
                <div className="records-toolbar__filters">
                  <input
                    type="text"
                    placeholder="공사명/발주처 검색"
                    value={filters.keyword}
                    onChange={(event) => setFilters((prev) => ({ ...prev, keyword: event.target.value }))}
                  />
                  <select
                    value={filters.companyId}
                    onChange={(event) => setFilters((prev) => ({ ...prev, companyId: event.target.value }))}
                  >
                    <option value="">전체 업체</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>{company.name}</option>
                    ))}
                  </select>
                  <button type="button" onClick={fetchProjects} disabled={loading}>
                    {loading ? '불러오는 중...' : '필터 적용'}
                  </button>
                  <button type="button" className="btn-muted" onClick={clearFilters} disabled={loading}>초기화</button>
                </div>
                <div className="records-toolbar__actions">
                  <button type="button" className="btn-soft" onClick={handleImportDatabase}>DB 가져오기</button>
                  <button type="button" className="btn-soft" onClick={handleExportDatabase}>DB 내보내기</button>
                  <button type="button" className="btn-soft" onClick={handleAddCompany}>법인 추가</button>
                  <button type="button" className="btn-primary" onClick={openCreateModal}>+ 실적 등록</button>
                </div>
              </header>

              {error && <p className="records-error">{error}</p>}

              <div className="records-grid-wrapper">
                <div className="records-grid">
                  <div className="records-grid__header">
                    <div className="records-grid__header-cell records-grid__header-cell--company">법인</div>
                    <div className="records-grid__header-cell">공사 정보</div>
                    <div className="records-grid__header-cell">시공규모 및 비고</div>
                    <div className="records-grid__header-cell records-grid__header-cell--elapsed">{baseDateLabel} 기준 경과일수</div>
                    <div className="records-grid__header-cell records-grid__header-cell--actions">첨부 / 작업</div>
                  </div>
                  {projects.length ? (
                    projects.map((project) => {
                      const isSelected = selectedProjectId === project.id;
                      const hasAttachment = !!project.attachment;
                      const elapsedText = formatElapsedPeriod(project.endDate || project.startDate, baseDateRef.current);
                      const categoriesText = project.categories && project.categories.length > 0
                        ? project.categories.map((category) => category.name).join(' · ')
                        : '공사 종류 없음';
                      const companyName = project.corporationName || project.primaryCompanyName || '—';
                      return (
                        <div
                          key={project.id}
                          className={`records-grid__row ${isSelected ? 'is-selected' : ''}`}
                          onClick={() => setSelectedProjectId(project.id)}
                        >
                          <div className="records-grid__cell records-grid__cell--company">
                            <span className="records-grid__company-text">{companyName}</span>
                          </div>
                          <div className="records-grid__cell records-grid__cell--info">
                            <div className="records-grid__project-name">공사명: {project.projectName}</div>
                            <div className="records-grid__info">
                              <div className="records-grid__info-item">
                                <span className="records-grid__info-label">발주처</span>
                                <span className="records-grid__info-value">{project.clientName || '—'}</span>
                              </div>
                              <div className="records-grid__info-item">
                                <span className="records-grid__info-label">기간</span>
                                <span className="records-grid__info-value">{formatDateRange(project.startDate, project.endDate)}</span>
                              </div>
                              <div className="records-grid__info-item">
                                <span className="records-grid__info-label">금액</span>
                                <span className="records-grid__info-value records-grid__info-value--amount">{formatCurrency(project.contractAmount)} 원</span>
                              </div>
                              <div className="records-grid__info-item records-grid__info-item--muted">
                                <span className="records-grid__info-label">공종</span>
                                <span className="records-grid__info-value">{categoriesText}</span>
                              </div>
                            </div>
                          </div>
                          <div className="records-grid__cell records-grid__cell--notes">
                            <div className="records-grid__notes">{project.scopeNotes || '—'}</div>
                          </div>
                          <div className="records-grid__cell records-grid__cell--elapsed">
                            <div className="records-grid__elapsed">{elapsedText || '—'}</div>
                          </div>
                          <div className="records-grid__cell records-grid__cell--actions">
                            <div className="records-grid__attachment-summary">
                              {hasAttachment ? (
                                <span className="records-grid__attachment-name">{project.attachment.displayName}</span>
                              ) : (
                                <span className="records-grid__no-attachment">첨부 없음</span>
                              )}
                            </div>
                            <div className="records-grid__actions">
                              <button
                                type="button"
                                className="btn-sm btn-primary"
                                disabled={!hasAttachment}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  if (hasAttachment) handleOpenAttachment(project.id);
                                }}
                              >
                                실적증명서
                              </button>
                              <button
                                type="button"
                                className="btn-sm btn-soft"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openEditModal(project);
                                }}
                              >
                                실적 수정
                              </button>
                              <button
                                type="button"
                                className="btn-sm btn-danger"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleDeleteProject(project);
                                }}
                              >
                                삭제
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="records-grid__empty">등록된 실적이 없습니다.</div>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      <ProjectModal
        open={modalState.open}
        mode={modalState.mode}
        initialProject={modalState.project}
        onClose={closeModal}
        onSaved={handleProjectSaved}
        companies={companies}
        categories={flatCategories}
        defaultCompanyId={modalState.mode === 'create' ? (modalState.defaultCompanyId || filters.companyId || '') : ''}
        onAttachmentRemoved={handleAttachmentRemoved}
      />

      {companyDialog.open && (
        <div className="records-dialog-overlay" role="presentation" onClick={closeCompanyDialog}>
          <div
            className="records-dialog"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <h3>법인 추가</h3>
            <form onSubmit={handleCompanyDialogSubmit}>
              <label>
                새 법인명
                <input
                  type="text"
                  value={companyDialog.name}
                  onChange={handleCompanyNameChange}
                  placeholder="예: 지음이엔아이㈜"
                  autoFocus
                />
              </label>
              {companyDialog.error && (
                <p className="records-dialog__error">{companyDialog.error}</p>
              )}
              <div className="records-dialog__actions">
                <button type="button" className="btn-muted" onClick={closeCompanyDialog} disabled={companyDialog.saving}>취소</button>
                <button type="submit" className="btn-primary" disabled={companyDialog.saving}>
                  {companyDialog.saving ? '저장 중...' : '저장'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
