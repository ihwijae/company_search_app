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

export default function RecordsPage() {
  const [activeMenu, setActiveMenu] = React.useState('records');
  const [projects, setProjects] = React.useState([]);
  const [categories, setCategories] = React.useState([]);
  const [companies, setCompanies] = React.useState([]);
  const [flatCategories, setFlatCategories] = React.useState([]);
  const [filters, setFilters] = React.useState({ keyword: '', companyId: '', categoryId: null });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [isModalOpen, setModalOpen] = React.useState(false);
  const [selectedProjectId, setSelectedProjectId] = React.useState(null);

  const selectedProject = React.useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );

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
      if (!selectedProjectId && list.length) {
        setSelectedProjectId(list[0].id);
      }
      if (selectedProjectId && !list.some((item) => item.id === selectedProjectId)) {
        setSelectedProjectId(list.length ? list[0].id : null);
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

            <section className="records-panel records-panel--list">
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
                  <button type="button" className="btn-primary" onClick={() => setModalOpen(true)}>
                    + 실적 등록
                  </button>
                </div>
              </header>

              {error && <p className="records-error">{error}</p>}

              <div className="records-list" role="list">
                {projects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    className={`records-list-item ${selectedProjectId === project.id ? 'active' : ''}`}
                    onClick={() => setSelectedProjectId(project.id)}
                  >
                    <div className="records-list-item__title-row">
                      <div className="records-list-item__title">{project.projectName}</div>
                      <div className="records-list-item__amount">{formatCurrency(project.contractAmount)} 원</div>
                    </div>
                    <div className="records-list-item__meta">
                      <span className="records-list-item__corp">{project.corporationName}</span>
                      <span>{project.clientName || '발주처 미정'}</span>
                      <span>{project.startDate || '시작일 미정'} ~ {project.endDate || '종료일 미정'}</span>
                    </div>
                    <div className="records-list-item__notes">
                      {project.scopeNotes ? project.scopeNotes.slice(0, 120) : '메모 없음'}
                    </div>
                    <div className="records-list-item__tags">
                      {project.categories?.map((category) => (
                        <span key={category.id} className="records-tag">{category.name}</span>
                      ))}
                      {project.primaryCompanyName && (
                        <span className="records-tag records-tag--company">{project.primaryCompanyName}</span>
                      )}
                    </div>
                  </button>
                ))}
                {!projects.length && !loading && (
                  <div className="records-list-empty">등록된 실적이 없습니다.</div>
                )}
              </div>
            </section>

            <aside className="records-panel records-panel--detail">
              {selectedProject ? (
                <div className="records-detail">
                  <header className="records-detail__header">
                    <h2>{selectedProject.projectName}</h2>
                    <p>{selectedProject.corporationName}</p>
                  </header>
                  <dl className="records-detail__grid">
                    <dt>발주처</dt>
                    <dd>{selectedProject.clientName || '—'}</dd>
                    <dt>계약금액</dt>
                    <dd>{formatCurrency(selectedProject.contractAmount)} 원</dd>
                    <dt>공사기간</dt>
                    <dd>{selectedProject.startDate || '—'} ~ {selectedProject.endDate || '—'}</dd>
                    <dt>공사 종류</dt>
                    <dd>{(selectedProject.categories || []).map((category) => category.name).join(', ') || '—'}</dd>
                    <dt>우리 업체</dt>
                    <dd>{selectedProject.primaryCompanyName || '—'}</dd>
                  </dl>
                  <section className="records-detail__notes">
                    <h3>시공규모 및 비고</h3>
                    <p>{selectedProject.scopeNotes || '등록된 메모가 없습니다.'}</p>
                  </section>
                  <section className="records-detail__attachments">
                    <h3>첨부</h3>
                    {selectedProject.attachment ? (
                      <div className="records-detail__attachment-row">
                        <span>{selectedProject.attachment.displayName}</span>
                        <button
                          type="button"
                          className="btn-primary btn-sm"
                          onClick={() => window.electronAPI.records.openAttachment?.(selectedProject.id)}
                        >
                          실적증명서 보기
                        </button>
                      </div>
                    ) : (
                      <p className="records-detail__attachment-empty">첨부된 파일이 없습니다.</p>
                    )}
                  </section>
                </div>
              ) : (
                <div className="records-detail-empty">좌측 목록에서 실적을 선택하면 상세 정보를 확인할 수 있습니다.</div>
              )}
            </aside>
          </div>
        </div>
      </div>

      <ProjectModal
        open={isModalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={fetchProjects}
        companies={companies}
        categories={flatCategories}
      />
    </div>
  );
}
