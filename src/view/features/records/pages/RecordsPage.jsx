import React from 'react';
import '../../../../styles.css';
import '../../../../fonts.css';
import Sidebar from '../../../../components/Sidebar';
import Modal from '../../../../components/Modal.jsx';
import { useFeedback } from '../../../../components/FeedbackProvider.jsx';
import { recordsClient } from '../../../../shared/recordsClient.js';
import sanitizeHtml from '../../../../shared/sanitizeHtml.js';
import RecordsEditorWindow from '../components/RecordsEditorWindow.jsx';

const formatCurrency = (value) => {
  if (value === null || value === undefined) return '-';
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value);
  return num.toLocaleString();
};

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildKeywordRegex = (keyword) => {
  const trimmed = String(keyword || '').trim();
  if (!trimmed) return null;
  return new RegExp(`(${escapeRegExp(trimmed)})`, 'gi');
};

const highlightPlainText = (value, keyword) => {
  const text = value == null ? '' : String(value);
  const regex = buildKeywordRegex(keyword);
  if (!regex || !text) return text || '—';

  const parts = text.split(regex);
  if (parts.length <= 1) return text;
  const normalizedKeyword = String(keyword || '').trim().toLowerCase();

  return parts.map((part, index) => (
    part.toLowerCase() === normalizedKeyword
      ? <mark key={`${part}-${index}`} className="records-highlight">{part}</mark>
      : <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
  ));
};

const highlightSanitizedHtml = (html, keyword) => {
  const trimmedKeyword = String(keyword || '').trim();
  const regex = buildKeywordRegex(trimmedKeyword);
  if (!regex || !html || typeof document === 'undefined') return html;

  try {
    const template = document.createElement('template');
    template.innerHTML = html;
    const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
    const textNodes = [];

    while (walker.nextNode()) {
      textNodes.push(walker.currentNode);
    }

    textNodes.forEach((node) => {
      const text = node.textContent || '';
      if (!text || !buildKeywordRegex(trimmedKeyword)?.test(text)) return;

      const fragment = document.createDocumentFragment();
      const localRegex = buildKeywordRegex(trimmedKeyword);
      let lastIndex = 0;
      let match = localRegex.exec(text);

      while (match) {
        const matchText = match[0];
        const matchIndex = match.index;
        if (matchIndex > lastIndex) {
          fragment.appendChild(document.createTextNode(text.slice(lastIndex, matchIndex)));
        }
        const mark = document.createElement('mark');
        mark.className = 'records-highlight';
        mark.textContent = matchText;
        fragment.appendChild(mark);
        lastIndex = matchIndex + matchText.length;
        match = localRegex.exec(text);
      }

      if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
      }

      node.parentNode?.replaceChild(fragment, node);
    });

    return template.innerHTML;
  } catch (error) {
    console.warn('[Renderer] Failed to highlight records HTML:', error);
    return html;
  }
};

const ITEMS_PER_PAGE = 3;
const TEN_YEARS_MS = 10 * 365 * 24 * 60 * 60 * 1000;

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

const DEFAULT_EDITOR_STATE = {
  open: false,
  mode: 'create',
  project: null,
  defaultCompanyId: '',
  defaultCompanyType: 'our',
};

export default function RecordsPage() {
  const { notify, confirm } = useFeedback();
  const [activeMenu, setActiveMenu] = React.useState('records');
  const [projects, setProjects] = React.useState([]);
  const [categories, setCategories] = React.useState([]);
  const [companies, setCompanies] = React.useState([]);
  const [flatCategories, setFlatCategories] = React.useState([]);
  const [filters, setFilters] = React.useState({ keyword: '', companyType: 'our', companyId: '', categoryId: null });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [editorState, setEditorState] = React.useState(DEFAULT_EDITOR_STATE);
  const [selectedProjectId, setSelectedProjectId] = React.useState(null);
  const [companyDialog, setCompanyDialog] = React.useState({ open: false, name: '', isMisc: false, saving: false, error: '' });
  const [currentPage, setCurrentPage] = React.useState(1);
  const [categoryDialog, setCategoryDialog] = React.useState({ open: false, id: null, mode: 'create', name: '', saving: false, error: '' });
  const pendingSelectRef = React.useRef(null);
  const baseDateRef = React.useRef(new Date());
  const companyInputRef = React.useRef(null);
  const categoryInputRef = React.useRef(null);
  const baseDateLabel = React.useMemo(() => {
    const baseDate = baseDateRef.current;
    const year = baseDate.getFullYear();
    const month = String(baseDate.getMonth() + 1).padStart(2, '0');
    const day = String(baseDate.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
  }, []);

  const selectedCategory = React.useMemo(
    () => flatCategories.find((item) => item.id === filters.categoryId) || null,
    [flatCategories, filters.categoryId],
  );

  const selectedCategorySiblings = React.useMemo(() => {
    if (!selectedCategory) return [];
    return flatCategories
      .filter((item) => item.parentId === selectedCategory.parentId)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
  }, [flatCategories, selectedCategory]);

  const selectedCategoryIndex = React.useMemo(
    () => selectedCategorySiblings.findIndex((item) => item.id === selectedCategory?.id),
    [selectedCategory, selectedCategorySiblings],
  );

  const canMoveCategoryUp = selectedCategoryIndex > 0;
  const canMoveCategoryDown = selectedCategoryIndex >= 0 && selectedCategoryIndex < selectedCategorySiblings.length - 1;

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

  const visibleCompanies = React.useMemo(() => {
    if (!Array.isArray(companies)) return [];
    return companies.filter((company) => (filters.companyType === 'misc' ? company.isMisc : !company.isMisc));
  }, [companies, filters.companyType]);

  const fetchProjects = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const payload = {
        keyword: filters.keyword || undefined,
        companyIds: filters.companyId ? [Number(filters.companyId)] : undefined,
        categoryIds: filters.categoryId ? [filters.categoryId] : undefined,
        companyType: filters.companyType || undefined,
      };
      const list = await recordsClient.listProjects(payload);
      setProjects(list);
      const pendingId = pendingSelectRef.current;
      let resolvedSelectedId = selectedProjectId;
      if (pendingId && list.some((item) => item.id === pendingId)) {
        resolvedSelectedId = pendingId;
        pendingSelectRef.current = null;
      } else if (resolvedSelectedId && !list.some((item) => item.id === resolvedSelectedId)) {
        resolvedSelectedId = list.length ? list[0].id : null;
      } else if (!resolvedSelectedId && list.length) {
        resolvedSelectedId = list[0].id;
      }
      setSelectedProjectId(resolvedSelectedId);

      const totalPages = Math.max(1, Math.ceil((list.length || 0) / ITEMS_PER_PAGE));
      setCurrentPage((prev) => {
        if (resolvedSelectedId) {
          const index = list.findIndex((item) => item.id === resolvedSelectedId);
          if (index >= 0) {
            return Math.floor(index / ITEMS_PER_PAGE) + 1;
          }
        }
        const next = Math.min(prev, totalPages);
        return next > 0 ? next : 1;
      });
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

  React.useEffect(() => {
    if (!recordsClient?.onProjectSaved) return undefined;
    const unsubscribe = recordsClient.onProjectSaved(async (payload) => {
      const savedProjectId = payload?.projectId;
      if (savedProjectId) {
        pendingSelectRef.current = savedProjectId;
        setSelectedProjectId(savedProjectId);
      }
      await fetchProjects();
    });
    return typeof unsubscribe === 'function' ? unsubscribe : undefined;
  }, [fetchProjects]);

  React.useEffect(() => {
    if (!companyDialog.open) return undefined;
    const frame = window.requestAnimationFrame(() => {
      try {
        companyInputRef.current?.focus();
        companyInputRef.current?.select?.();
      } catch {}
    });
    return () => window.cancelAnimationFrame(frame);
  }, [companyDialog.open]);

  React.useEffect(() => {
    if (!categoryDialog.open) return undefined;
    const frame = window.requestAnimationFrame(() => {
      try {
        categoryInputRef.current?.focus();
        categoryInputRef.current?.select?.();
      } catch {}
    });
    return () => window.cancelAnimationFrame(frame);
  }, [categoryDialog.open, categoryDialog.mode]);

  const handleMenuSelect = (key) => {
    if (key === 'records') {
      setActiveMenu('records');
      window.location.hash = '#/records';
    } else if (key === 'search') {
      window.location.hash = '#/search';
    } else if (key === 'mail') {
      window.location.hash = '#/mail';
    } else if (key === 'agreements') {
      window.location.hash = '#/agreement-board';
    } else if (key === 'region-search') {
      window.location.hash = '#/region-search';
    } else if (key === 'agreements-sms') {
      window.location.hash = '#/agreements';
    } else if (key === 'auto-agreement') {
      window.location.hash = '#/auto-agreement';
    } else if (key === 'excel-helper') {
      window.location.hash = '#/excel-helper';
    } else if (key === 'bid-result') {
      window.location.hash = '#/bid-result';
    } else if (key === 'kakao-send') {
      window.location.hash = '#/kakao-send';
    } else if (key === 'company-notes') {
      window.location.hash = '#/company-notes';
    } else if (key === 'settings') {
      window.location.hash = '#/settings';
    }
  };

  const clearFilters = () => {
    setFilters({ keyword: '', companyType: 'our', companyId: '', categoryId: null });
  };

  const handleCompanyTypeChange = (event) => {
    const { value } = event.target;
    setFilters((prev) => ({ ...prev, companyType: value, companyId: '' }));
  };

  React.useEffect(() => {
    setCurrentPage(1);
  }, [filters.keyword, filters.companyId, filters.categoryId, filters.companyType]);

  const closeEditor = React.useCallback(() => {
    setEditorState(DEFAULT_EDITOR_STATE);
  }, []);

  const handleProjectSaved = React.useCallback((project) => {
    if (project?.id) {
      pendingSelectRef.current = project.id;
      setSelectedProjectId(project.id);
    }
    closeEditor();
    fetchProjects();
  }, [closeEditor, fetchProjects]);

  const handleOpenAttachment = React.useCallback(async (projectId, attachmentId) => {
    try {
      if (!projectId) return;
      await recordsClient.openAttachment(projectId, attachmentId);
    } catch (err) {
      notify({ type: 'error', message: err?.message || '첨부 파일을 열 수 없습니다.' });
    }
  }, [notify]);

  const handleDeleteProject = React.useCallback(async (project) => {
    if (!project?.id) return;
    const title = project.projectName || project.name || project.clientName || '해당 실적';
    const confirmed = await confirm({
      title: '실적 삭제',
      message: `정말로 삭제하시겠습니까?\n${title}`,
      confirmText: '삭제',
      cancelText: '취소',
    });
    if (!confirmed) return;
    try {
      await recordsClient.deleteProject(project.id);
      setSelectedProjectId((prev) => (prev === project.id ? null : prev));
      if (pendingSelectRef.current === project.id) {
        pendingSelectRef.current = null;
      }
      fetchProjects();
    } catch (err) {
      notify({ type: 'error', message: err?.message || '실적을 삭제할 수 없습니다.' });
    }
  }, [confirm, fetchProjects, notify]);

  const handleAddCompany = React.useCallback(() => {
    setCompanyDialog({ open: true, name: '', isMisc: filters.companyType === 'misc', saving: false, error: '' });
  }, [filters.companyType]);

  const closeCompanyDialog = React.useCallback(() => {
    setCompanyDialog({ open: false, name: '', isMisc: false, saving: false, error: '' });
  }, []);

  const handleCompanyNameChange = (event) => {
    const { value } = event.target;
    setCompanyDialog((prev) => ({ ...prev, name: value, error: '' }));
  };

  const handleCompanyMiscChange = (event) => {
    const { checked } = event.target;
    setCompanyDialog((prev) => ({ ...prev, isMisc: checked }));
  };

  const handleCompanyDialogSubmit = async () => {
    const trimmedName = companyDialog.name.trim();
    if (!trimmedName) {
      setCompanyDialog((prev) => ({ ...prev, error: '법인명을 입력해 주세요.' }));
      return;
    }
    setCompanyDialog((prev) => ({ ...prev, saving: true, error: '' }));
    try {
      const saved = await recordsClient.saveCompany({
        name: trimmedName,
        alias: trimmedName,
        isPrimary: false,
        isMisc: companyDialog.isMisc,
      });
      await fetchTaxonomies();
      setFilters((prev) => ({
        ...prev,
        companyType: saved.isMisc ? 'misc' : 'our',
        companyId: String(saved.id),
      }));
      setCompanyDialog({ open: false, name: '', isMisc: false, saving: false, error: '' });
      notify({ type: 'success', message: '법인을 등록했습니다.' });
    } catch (err) {
      const message = err?.message || '법인을 추가할 수 없습니다.';
      const normalizedMessage = message.includes('UNIQUE constraint failed') ? '이미 등록된 법인명입니다.' : message;
      setCompanyDialog((prev) => ({ ...prev, saving: false, error: normalizedMessage }));
    }
  };

  const handleDeleteCompany = React.useCallback(async () => {
    if (!filters.companyId) return;
    const company = companies.find((item) => String(item.id) === String(filters.companyId));
    const label = company?.name || '선택한 법인';
    const confirmed = await confirm({
      title: '법인 삭제',
      message: `'${label}' 법인을 삭제할까요?\n실적과 연결된 경우 기본값(미지정)으로 변경됩니다.`,
      confirmText: '삭제',
      cancelText: '취소',
    });
    if (!confirmed) return;
    try {
      await recordsClient.deleteCompany(Number(filters.companyId));
      await fetchTaxonomies();
      setFilters((prev) => ({ ...prev, companyId: '' }));
      await fetchProjects();
      notify({ type: 'success', message: '법인을 삭제했습니다.' });
    } catch (err) {
      notify({ type: 'error', message: err?.message || '법인을 삭제할 수 없습니다.' });
    }
  }, [confirm, filters.companyId, companies, fetchTaxonomies, fetchProjects, notify]);

  const handleDeleteCategory = React.useCallback(async () => {
    if (!filters.categoryId) return;
    const category = flatCategories.find((item) => item.id === filters.categoryId);
    const label = category?.name || '선택한 공사 종류';
    const confirmed = await confirm({
      title: '공사 종류 삭제',
      message: `'${label}' 공사 종류를 삭제할까요?\n하위 항목과 실적 연결 정보가 함께 제거됩니다.`,
      confirmText: '삭제',
      cancelText: '취소',
    });
    if (!confirmed) return;
    try {
      await recordsClient.deleteCategory(filters.categoryId);
      await fetchTaxonomies();
      setFilters((prev) => ({ ...prev, categoryId: null }));
      await fetchProjects();
      notify({ type: 'success', message: '공사 종류를 삭제했습니다.' });
    } catch (err) {
      notify({ type: 'error', message: err?.message || '공사 종류를 삭제할 수 없습니다.' });
    }
  }, [confirm, filters.categoryId, flatCategories, fetchTaxonomies, fetchProjects, notify]);

  const handleMoveCategory = React.useCallback(async (direction) => {
    if (!selectedCategory) return;
    const siblings = selectedCategorySiblings;
    const currentIndex = siblings.findIndex((item) => item.id === selectedCategory.id);
    if (currentIndex < 0) return;
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const swapTarget = siblings[targetIndex];
    if (!swapTarget) return;

    try {
      const reordered = [...siblings];
      const [moved] = reordered.splice(currentIndex, 1);
      reordered.splice(targetIndex, 0, moved);

      await Promise.all(reordered.map((category, index) => recordsClient.saveCategory({
        id: category.id,
        name: category.name,
        parentId: category.parentId ?? undefined,
        active: category.active,
        sortOrder: index,
      })));
      await fetchTaxonomies();
      notify({
        type: 'success',
        message: direction === 'up' ? '공사 종류를 위로 이동했습니다.' : '공사 종류를 아래로 이동했습니다.',
        duration: 1800,
      });
    } catch (err) {
      notify({ type: 'error', message: err?.message || '공사 종류 순서를 변경할 수 없습니다.' });
    }
  }, [fetchTaxonomies, notify, selectedCategory, selectedCategorySiblings]);

  const handleAddCategory = React.useCallback(() => {
    try {
      if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
      }
    } catch {}
    setCategoryDialog({ open: true, id: null, mode: 'create', name: '', saving: false, error: '' });
  }, []);

  const handleEditCategory = React.useCallback(() => {
    if (!filters.categoryId) return;
    const category = flatCategories.find((item) => item.id === filters.categoryId);
    if (!category) return;
    try {
      if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
      }
    } catch {}
    setCategoryDialog({
      open: true,
      id: category.id,
      mode: 'edit',
      name: category.name || '',
      saving: false,
      error: '',
    });
  }, [filters.categoryId, flatCategories]);

  const closeCategoryDialog = React.useCallback(() => {
    setCategoryDialog({ open: false, id: null, mode: 'create', name: '', saving: false, error: '' });
  }, []);

  const handleCategoryNameChange = (event) => {
    const { value } = event.target;
    setCategoryDialog((prev) => ({ ...prev, name: value, error: '' }));
  };

  const handleCategoryDialogSubmit = async () => {
    const trimmed = categoryDialog.name.trim();
    if (!trimmed) {
      setCategoryDialog((prev) => ({ ...prev, error: '공사 종류명을 입력해 주세요.' }));
      return;
    }
    setCategoryDialog((prev) => ({ ...prev, saving: true, error: '' }));
    try {
      const saved = await recordsClient.saveCategory({
        id: categoryDialog.mode === 'edit' ? categoryDialog.id : undefined,
        name: trimmed,
      });
      await fetchTaxonomies();
      if (saved?.id) {
        setFilters((prev) => ({ ...prev, categoryId: saved.id }));
      }
      setCategoryDialog({ open: false, id: null, mode: 'create', name: '', saving: false, error: '' });
      notify({
        type: 'success',
        message: categoryDialog.mode === 'edit' ? '공사 종류명을 수정했습니다.' : '공사 종류를 등록했습니다.',
      });
    } catch (err) {
      const message = err?.message || '공사 종류를 추가할 수 없습니다.';
      setCategoryDialog((prev) => ({ ...prev, saving: false, error: message }));
    }
  };

  const totalPages = React.useMemo(() => (
    projects.length
      ? Math.max(1, Math.ceil(projects.length / ITEMS_PER_PAGE))
      : 1
  ), [projects]);

  const paginatedProjects = React.useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return projects.slice(start, start + ITEMS_PER_PAGE);
  }, [projects, currentPage]);

  const keyword = React.useMemo(() => String(filters.keyword || '').trim(), [filters.keyword]);

  React.useEffect(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const slice = projects.slice(start, start + ITEMS_PER_PAGE);
    if (!slice.length && currentPage > 1) {
      const adjusted = Math.max(1, Math.ceil((projects.length || 0) / ITEMS_PER_PAGE));
      if (adjusted !== currentPage) {
        setCurrentPage(adjusted);
      }
      return;
    }
    if (slice.length && (!selectedProjectId || !slice.some((item) => item.id === selectedProjectId))) {
      setSelectedProjectId(slice[0].id);
    }
  }, [projects, currentPage, selectedProjectId]);

  const handlePageChange = React.useCallback((page) => {
    setCurrentPage(page);
  }, []);

  const openCreateModal = React.useCallback(() => {
    setEditorState({
      open: true,
      mode: 'create',
      project: null,
      defaultCompanyId: filters.companyId || '',
      defaultCompanyType: filters.companyType || 'our',
    });
  }, [filters.companyId, filters.companyType]);

  const openEditModal = React.useCallback((project) => {
    setSelectedProjectId(project.id);
    setEditorState({
      open: true,
      mode: 'edit',
      project,
      defaultCompanyId: '',
      defaultCompanyType: project?.primaryCompanyIsMisc ? 'misc' : 'our',
    });
  }, []);

  const handleExportDatabase = React.useCallback(async () => {
    try {
      const result = await recordsClient.exportDatabase();
      if (!result || result.canceled) return;
      const exportedPath = result.exportedPath || result.targetPath || result.path;
      if (exportedPath) {
        const attachmentNote = result.includedAttachments ? ' (첨부 포함)' : ' (첨부 없음)';
        notify({
          type: 'success',
          title: 'DB 내보내기 완료',
          message: `${exportedPath}${attachmentNote}`,
          duration: 5200,
        });
      }
    } catch (err) {
      notify({ type: 'error', message: err?.message || 'DB 파일을 내보낼 수 없습니다.' });
    }
  }, [notify]);

  const handleImportDatabase = React.useCallback(async () => {
    const confirmed = await confirm({
      title: 'DB 가져오기',
      message: '가져오기를 실행하면 현재 실적 데이터가 덮어써집니다. 계속할까요?',
      confirmText: '가져오기',
      cancelText: '취소',
    });
    if (!confirmed) return;
    try {
      const result = await recordsClient.importDatabase();
      if (!result || result.canceled) return;
      await fetchTaxonomies();
      await fetchProjects();
      const importedNote = result.attachmentsImported ? ' (첨부 포함)' : '';
      notify({ type: 'success', message: `실적 데이터를 가져왔습니다.${importedNote}` });
    } catch (err) {
      notify({ type: 'error', message: err?.message || 'DB 파일을 가져올 수 없습니다.' });
    }
  }, [confirm, fetchProjects, fetchTaxonomies, notify]);

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
                <div className="records-panel__header-top">
                  <h2>공사 종류</h2>
                  <button type="button" className="btn-soft" onClick={handleAddCategory}>+ 추가</button>
                </div>
                <div className="records-panel__header-actions">
                  {filters.categoryId && (
                    <button type="button" className="btn-muted btn-sm" onClick={() => handleMoveCategory('up')} disabled={!canMoveCategoryUp}>위로</button>
                  )}
                  {filters.categoryId && (
                    <button type="button" className="btn-muted btn-sm" onClick={() => handleMoveCategory('down')} disabled={!canMoveCategoryDown}>아래로</button>
                  )}
                  {filters.categoryId && (
                    <button type="button" className="btn-muted btn-sm" onClick={handleEditCategory}>수정</button>
                  )}
                  {filters.categoryId && (
                    <button type="button" className="btn-muted btn-sm" onClick={handleDeleteCategory}>삭제</button>
                  )}
                </div>
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
                    placeholder="공사명/발주처/시공규모 및 비고 검색"
                    value={filters.keyword}
                    onChange={(event) => setFilters((prev) => ({ ...prev, keyword: event.target.value }))}
                  />
                  <select
                    value={filters.companyType}
                    onChange={handleCompanyTypeChange}
                  >
                    <option value="our">우리법인</option>
                    <option value="misc">기타</option>
                  </select>
                  <select
                    value={filters.companyId}
                    onChange={(event) => setFilters((prev) => ({ ...prev, companyId: event.target.value }))}
                  >
                    <option value="">{filters.companyType === 'misc' ? '전체 기타 법인' : '전체 우리 법인'}</option>
                    {visibleCompanies.map((company) => (
                      <option key={company.id} value={company.id}>{company.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn-muted"
                    onClick={handleDeleteCompany}
                    disabled={!filters.companyId}
                  >
                    법인 삭제
                  </button>
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
                    paginatedProjects.map((project) => {
                      const isSelected = selectedProjectId === project.id;
                      const attachments = Array.isArray(project.attachments) ? project.attachments : [];
                      const hasAttachment = attachments.length > 0;
                      const sanitizedNotes = sanitizeHtml(project.scopeNotes);
                      const highlightedNotes = highlightSanitizedHtml(sanitizedNotes, keyword);
                      let isExpired = false;
                      const expirySource = project.endDate || project.startDate;
                      const expiryDate = toDate(expirySource);
                      if (expiryDate) {
                        const diff = baseDateRef.current.getTime() - expiryDate.getTime();
                        if (diff >= TEN_YEARS_MS) {
                          isExpired = true;
                        }
                      }
                      const elapsedText = formatElapsedPeriod(project.endDate || project.startDate, baseDateRef.current);
                      const categoriesText = project.categories && project.categories.length > 0
                        ? project.categories.map((category) => category.name).join(' · ')
                        : '공사 종류 없음';
                      const companyName = project.corporationName || project.primaryCompanyName || '—';
                      return (
                        <div
                          key={project.id}
                          className={`records-grid__row ${isSelected ? 'is-selected' : ''} ${isExpired ? 'records-grid__row--expired' : ''}`}
                          onClick={() => setSelectedProjectId(project.id)}
                        >
                          <div className="records-grid__cell records-grid__cell--company">
                            <span className="records-grid__company-text">{highlightPlainText(companyName, keyword)}</span>
                          </div>
                          <div className="records-grid__cell records-grid__cell--info">
                            <div className="records-grid__project-name">공사명: {highlightPlainText(project.projectName, keyword)}</div>
                            <div className="records-grid__info">
                              <div className="records-grid__info-item">
                                <span className="records-grid__info-label">발주처</span>
                                <span className="records-grid__info-value">{highlightPlainText(project.clientName, keyword)}</span>
                              </div>
                              <div className="records-grid__info-item">
                                <span className="records-grid__info-label">공사기간</span>
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
                            {highlightedNotes ? (
                              <div className="records-grid__notes" dangerouslySetInnerHTML={{ __html: highlightedNotes }} />
                            ) : (
                              <div className="records-grid__notes">—</div>
                            )}
                          </div>
                          <div className="records-grid__cell records-grid__cell--elapsed">
                            <div className="records-grid__elapsed">{elapsedText || '—'}</div>
                          </div>
                          <div className="records-grid__cell records-grid__cell--actions">
                            <div className="records-grid__attachment-summary">
                              {hasAttachment ? (
                                <div>
                                  <div className="records-grid__attachment-name">첨부 {attachments.length}개</div>
                                  {attachments.map((attachment) => (
                                    <button
                                      key={attachment.id}
                                      type="button"
                                      className="btn-link records-grid__attachment-name"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        handleOpenAttachment(project.id, attachment.id);
                                      }}
                                    >
                                      {attachment.displayName}
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <span className="records-grid__no-attachment">첨부 없음</span>
                              )}
                            </div>
                            <div className="records-grid__actions">
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
              {projects.length > 0 && (
                <div className="records-pagination">
                  <button
                    type="button"
                    className="records-pagination__nav"
                    onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    이전
                  </button>
                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                    <button
                      key={page}
                      type="button"
                      className={`records-pagination__page ${currentPage === page ? 'is-active' : ''}`}
                      onClick={() => handlePageChange(page)}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="records-pagination__nav"
                    onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                  >
                    다음
                  </button>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      <RecordsEditorWindow
        open={editorState.open}
        mode={editorState.mode}
        initialProject={editorState.project}
        companies={companies}
        categories={flatCategories}
        defaultCompanyId={editorState.defaultCompanyId}
        defaultCompanyType={editorState.defaultCompanyType}
        onClose={closeEditor}
        onSaved={handleProjectSaved}
      />

      <Modal
        open={categoryDialog.open}
        title={categoryDialog.mode === 'edit' ? '공사 종류 수정' : '공사 종류 추가'}
        onClose={closeCategoryDialog}
        onSave={handleCategoryDialogSubmit}
        closeOnSave={false}
        disableEscClose={false}
        disableBackdropClose={false}
        initialFocusRef={categoryInputRef}
        confirmLabel={categoryDialog.saving ? '저장 중...' : categoryDialog.mode === 'edit' ? '수정' : '저장'}
        cancelLabel="취소"
        width={420}
        maxWidth={420}
        boxClassName="records-form-modal"
      >
        <form className="records-form-modal__body" onSubmit={(event) => { event.preventDefault(); handleCategoryDialogSubmit(); }}>
          <p className="records-form-modal__description">
            {categoryDialog.mode === 'edit' ? '선택한 공사 종류 이름을 바꿉니다.' : '새 공사 종류를 바로 등록합니다.'}
          </p>
          <label className="records-form-modal__field">
            {categoryDialog.mode === 'edit' ? '공사 종류명' : '새 공사 종류명'}
            <input
              ref={categoryInputRef}
              type="text"
              value={categoryDialog.name}
              onChange={handleCategoryNameChange}
              placeholder="예: 전기 공사"
              disabled={categoryDialog.saving}
            />
          </label>
          {categoryDialog.error && (
            <p className="records-form-modal__error">{categoryDialog.error}</p>
          )}
        </form>
      </Modal>

      <Modal
        open={companyDialog.open}
        title="법인 추가"
        onClose={closeCompanyDialog}
        onSave={handleCompanyDialogSubmit}
        closeOnSave={false}
        disableEscClose={false}
        disableBackdropClose={false}
        initialFocusRef={companyInputRef}
        confirmLabel={companyDialog.saving ? '저장 중...' : '저장'}
        cancelLabel="취소"
        width={430}
        maxWidth={430}
        boxClassName="records-form-modal"
      >
        <form className="records-form-modal__body" onSubmit={(event) => { event.preventDefault(); handleCompanyDialogSubmit(); }}>
          <p className="records-form-modal__description">
            실적에 연결할 법인을 현재 화면 안에서 바로 등록합니다.
          </p>
          <label className="records-form-modal__field">
            새 법인명
            <input
              ref={companyInputRef}
              type="text"
              value={companyDialog.name}
              onChange={handleCompanyNameChange}
              placeholder="예: 지음이엔아이㈜"
              disabled={companyDialog.saving}
            />
          </label>
          <label className="records-form-modal__check">
            <input
              id="company-dialog-misc"
              type="checkbox"
              checked={companyDialog.isMisc}
              onChange={handleCompanyMiscChange}
              disabled={companyDialog.saving}
            />
            <span>기타로 등록</span>
          </label>
          {companyDialog.error && (
            <p className="records-form-modal__error">{companyDialog.error}</p>
          )}
        </form>
      </Modal>
    </div>
  );
}
