import React from 'react';
import '../../../../styles.css';
import '../../../../fonts.css';
import Sidebar from '../../../../components/Sidebar';
import { BASE_ROUTES } from '../../../../shared/navigation.js';

const ROUTE_HASHES = {
  search: BASE_ROUTES.search,
  agreements: '#/agreement-board',
  'agreements-sms': BASE_ROUTES.agreements,
  'region-search': BASE_ROUTES.regionSearch,
  records: '#/records',
  mail: '#/mail',
  'excel-helper': '#/excel-helper',
  settings: BASE_ROUTES.settings,
  upload: '#/upload',
};

export default function AutoAgreementPage() {
  const handleMenuSelect = React.useCallback((key) => {
    if (!key || key === 'auto-agreement') return;
    const target = ROUTE_HASHES[key] || null;
    if (target) {
      window.location.hash = target;
      return;
    }
  }, []);

  return (
    <div className="app-shell">
      <Sidebar active="auto-agreement" onSelect={handleMenuSelect} collapsed={true} />
      <div className="main">
        <div className="title-drag" />
        <div className="topbar" />
        <div className="stage">
          <div className="content" style={{ gridTemplateColumns: '1fr' }}>
            <div className="panel">
              <h1 className="main-title">협정 자동화</h1>
              <p className="section-help">PRD 및 설계 메모를 기반으로 화면 구조와 기능을 순차적으로 채울 예정입니다.</p>
              <div className="section">
                <h2 className="section-title">현재 상태</h2>
                <ul style={{ listStyle: 'disc', paddingLeft: '20px', color: '#1f2937' }}>
                  <li>좌측 메뉴/라우팅이 준비되어 있으며, 향후 UI를 이 화면에 구성합니다.</li>
                  <li>상세 설계는 <code>docs/자동협정기능.md</code> 및 <code>prd.md</code> 문서를 참조하세요.</li>
                </ul>
              </div>
              <div className="section">
                <h2 className="section-title">다음 단계</h2>
                <ol style={{ paddingLeft: '20px', color: '#4b5563' }}>
                  <li>입력 폼/금액 영역/협정 구성 테이블 UI 설계</li>
                  <li>Config 경로 설정 및 Import/Export 흐름 구현</li>
                  <li>템플릿 복사 + 셀 매핑 기반 엑셀 출력 기능 연동</li>
                </ol>
              </div>
              <p className="section-help">추가 요구 사항이나 변경 사항은 PRD에 업데이트 후 알려주세요.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
