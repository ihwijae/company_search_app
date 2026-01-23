import React from 'react';
import '../../../../styles.css';
import '../../../../fonts.css';
import Sidebar from '../../../../components/Sidebar';

const MENU_ROUTES = {
  search: '#/search',
  agreements: '#/agreement-board',
  'region-search': '#/region-search',
  'agreements-sms': '#/agreements',
  'auto-agreement': '#/auto-agreement',
  records: '#/records',
  mail: '#/mail',
  'excel-helper': '#/excel-helper',
  'bid-result': '#/bid-result',
  settings: '#/settings',
  upload: '#/upload',
};

export default function KakaoSendPage() {
  const [draft, setDraft] = React.useState('');

  const handleMenuSelect = React.useCallback((key) => {
    if (!key || key === 'kakao-send') return;
    const target = MENU_ROUTES[key];
    if (target) window.location.hash = target;
  }, []);

  return (
    <div className="app-shell">
      <Sidebar active="kakao-send" onSelect={handleMenuSelect} collapsed={true} />
      <div className="main">
        <div className="title-drag" />
        <div className="topbar" />
        <div className="stage">
          <div className="content">
            <div className="panel" style={{ gridColumn: '1 / -1' }}>
              <h1 className="main-title" style={{ marginTop: 0 }}>카카오톡 전송</h1>
              <p className="subtext" style={{ marginBottom: '18px' }}>
                협정문자를 입력하면 건별로 분리하고, 업체 담당자에게 전송할 수 있도록 준비 중입니다.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 0.9fr)', gap: '16px' }}>
                <div className="panel" style={{ background: '#f8fafc' }}>
                  <h2 className="section-title" style={{ marginTop: 0 }}>협정문자 입력</h2>
                  <textarea
                    className="filter-input"
                    style={{ width: '100%', minHeight: '240px', resize: 'vertical' }}
                    placeholder="협정문자를 붙여넣어 주세요."
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                  />
                  <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button className="primary" type="button">문자 분리</button>
                    <button className="secondary" type="button">입력 초기화</button>
                  </div>
                </div>
                <div className="panel" style={{ background: '#f8fafc' }}>
                  <h2 className="section-title" style={{ marginTop: 0 }}>담당자 전송 설정</h2>
                  <div className="search-filter-section">
                    <div className="filter-grid" style={{ gridTemplateColumns: '1fr' }}>
                      <div className="filter-item">
                        <label>담당자 채팅방</label>
                        <input className="filter-input" placeholder="채팅방 이름을 입력하세요" />
                      </div>
                      <div className="filter-item">
                        <label>전송 제외 업체</label>
                        <input className="filter-input" placeholder="업체명 선택 후 제외 처리" />
                      </div>
                    </div>
                  </div>
                  <div className="empty-state" style={{ marginTop: '12px' }}>
                    전송 대상을 선택하면 여기에서 확인할 수 있습니다.
                  </div>
                </div>
              </div>
              <div className="panel" style={{ marginTop: '16px', background: '#f8fafc' }}>
                <h2 className="section-title" style={{ marginTop: 0 }}>전송 대상 목록</h2>
                <div className="table-wrap" style={{ maxHeight: '240px' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: '80px' }}>순번</th>
                        <th>업체명</th>
                        <th style={{ width: '140px' }}>담당자</th>
                        <th style={{ width: '140px' }}>전송</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                          아직 분리된 협정문자가 없습니다.
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button className="primary" type="button">카카오톡 전송</button>
                  <button className="secondary" type="button">전송 로그 확인</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
