import React from 'react';
import '../../../../styles.css';
import '../../../../fonts.css';
import { recordsClient } from '../../../../shared/recordsClient.js';
import ProjectEditorForm from '../components/ProjectEditorForm.jsx';

const parseEditorRoute = () => {
  const rawHash = window.location.hash || '#/records-editor';
  const normalized = rawHash.startsWith('#') ? rawHash.slice(1) : rawHash;
  const [, query = ''] = normalized.split('?');
  const params = new URLSearchParams(query);
  return {
    mode: params.get('mode') === 'edit' ? 'edit' : 'create',
    projectId: params.get('projectId') ? Number(params.get('projectId')) : null,
    defaultCompanyId: params.get('defaultCompanyId') || '',
    defaultCompanyType: params.get('defaultCompanyType') === 'misc' ? 'misc' : 'our',
  };
};

const closeEditorWindow = () => {
  try {
    window.close();
  } catch {
    window.location.hash = '#/records';
  }
};

export default function RecordsEditorPage() {
  const [routeState, setRouteState] = React.useState(() => parseEditorRoute());
  const [project, setProject] = React.useState(null);
  const [companies, setCompanies] = React.useState([]);
  const [categories, setCategories] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    document.title = routeState.mode === 'edit' ? '실적 수정' : '실적 등록';
  }, [routeState.mode]);

  React.useEffect(() => {
    const onHashChange = () => setRouteState(parseEditorRoute());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  React.useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [categoryItems, companyItems, projectItem] = await Promise.all([
          recordsClient.listCategories({ includeInactive: false }),
          recordsClient.listCompanies({ includeInactive: false }),
          routeState.mode === 'edit' && routeState.projectId
            ? recordsClient.getProject(routeState.projectId)
            : Promise.resolve(null),
        ]);
        if (!alive) return;
        setCategories(Array.isArray(categoryItems) ? categoryItems : []);
        setCompanies(Array.isArray(companyItems) ? companyItems : []);
        setProject(projectItem);
      } catch (err) {
        if (!alive) return;
        setError(err?.message || '실적 입력 창을 불러오지 못했습니다.');
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [routeState]);

  const handleSaved = async (result) => {
    try {
      recordsClient.notifyProjectSaved({
        projectId: result?.id || routeState.projectId || null,
        mode: routeState.mode,
      });
    } catch {}
    closeEditorWindow();
  };

  return (
    <div className="records-editor-page">
      <div className="title-drag" />
      <div className="records-editor-page__backdrop" />
      <main className="records-editor-page__shell">
        <header className="records-editor-page__header">
          <div className="records-editor-page__header-copy">
            <p className="records-editor-page__eyebrow">Record Studio</p>
            <h1>{routeState.mode === 'edit' ? '실적 수정 창' : '실적 등록 창'}</h1>
            <p className="records-editor-page__description">
              실적을 입력하면서 메인 창에서 업체 정보를 계속 확인할 수 있게 별도 창으로 분리된 입력 화면입니다.
            </p>
          </div>
          <button type="button" className="btn-muted records-editor-page__close" onClick={closeEditorWindow}>
            창 닫기
          </button>
        </header>

        <section className="records-editor-page__content">
          <section className="records-editor-page__form-wrap">
            {loading ? (
              <div className="records-editor-page__status">불러오는 중...</div>
            ) : error ? (
              <div className="records-editor-page__status is-error">{error}</div>
            ) : (
              <ProjectEditorForm
                mode={routeState.mode}
                initialProject={project}
                companies={companies}
                categories={categories}
                defaultCompanyId={routeState.defaultCompanyId}
                defaultCompanyType={routeState.defaultCompanyType}
                onCancel={closeEditorWindow}
                onSaved={handleSaved}
              />
            )}
          </section>
        </section>
      </main>
    </div>
  );
}
