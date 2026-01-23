import React from 'react';
import '../../../../styles.css';
import '../../../../fonts.css';
import Sidebar from '../../../../components/Sidebar';
import Modal from '../../../../components/Modal.jsx';

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
  const [splitEntries, setSplitEntries] = React.useState([]);
  const [roomModalOpen, setRoomModalOpen] = React.useState(false);
  const [roomSettings, setRoomSettings] = React.useState([
    { id: 1, manager: '', room: '' },
  ]);

  const handleMenuSelect = React.useCallback((key) => {
    if (!key || key === 'kakao-send') return;
    const target = MENU_ROUTES[key];
    if (target) window.location.hash = target;
  }, []);

  const handleSplitMessages = () => {
    const blocks = String(draft || '')
      .split(/-{5,}/)
      .map((block) => block.trim())
      .filter(Boolean);
    const entries = [];
    blocks.forEach((block, blockIndex) => {
      const lines = block
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      const companyLines = lines.filter((line) => line.includes('%'));
      if (companyLines.length === 0) {
        entries.push({
          id: `${blockIndex}-0`,
          company: `협정안 ${blockIndex + 1}`,
          manager: '미정',
        });
      } else {
        companyLines.forEach((line, lineIndex) => {
          entries.push({
            id: `${blockIndex}-${lineIndex}`,
            company: line,
            manager: '미정',
          });
        });
      }
    });
    setSplitEntries(entries);
  };

  const handleClearDraft = () => {
    setDraft('');
    setSplitEntries([]);
  };

  const handleRoomSettingChange = (id, field, value) => {
    setRoomSettings((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  const handleAddRoomRow = () => {
    setRoomSettings((prev) => [
      ...prev,
      { id: Date.now(), manager: '', room: '' },
    ]);
  };

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
                    <button className="primary" type="button" onClick={handleSplitMessages}>문자 분리</button>
                    <button className="secondary" type="button" onClick={handleClearDraft}>입력 초기화</button>
                  </div>
                </div>
                <div className="panel" style={{ background: '#f8fafc' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <h2 className="section-title" style={{ marginTop: 0 }}>업체별 담당자 목록</h2>
                    <button className="secondary" type="button" onClick={() => setRoomModalOpen(true)}>담당자 카톡방 설정</button>
                  </div>
                  <div className="table-wrap" style={{ maxHeight: '320px' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th style={{ width: '70px' }}>순번</th>
                          <th>업체명</th>
                          <th style={{ width: '140px' }}>담당자</th>
                        </tr>
                      </thead>
                      <tbody>
                        {splitEntries.length === 0 ? (
                          <tr>
                            <td colSpan={3} style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                              문자 분리 후 담당자 목록이 표시됩니다.
                            </td>
                          </tr>
                        ) : (
                          splitEntries.map((entry, index) => (
                            <tr key={entry.id}>
                              <td>{index + 1}</td>
                              <td>{entry.company}</td>
                              <td>{entry.manager}</td>
                            </tr>
                          ))
                        )}
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
      <Modal
        open={roomModalOpen}
        onClose={() => setRoomModalOpen(false)}
        onCancel={() => setRoomModalOpen(false)}
        onSave={() => setRoomModalOpen(false)}
        title="담당자 카톡방 설정"
        confirmLabel="저장"
        cancelLabel="닫기"
        size="md"
        disableBackdropClose={false}
        disableEscClose={false}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '4px 4px 0' }}>
          <p className="subtext" style={{ margin: 0 }}>
            담당자별 카카오톡 채팅방 이름을 설정하세요.
          </p>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '120px' }}>담당자</th>
                  <th>채팅방 이름</th>
                </tr>
              </thead>
              <tbody>
                {roomSettings.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <input
                        className="filter-input"
                        placeholder="담당자 이름"
                        value={row.manager}
                        onChange={(event) => handleRoomSettingChange(row.id, 'manager', event.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className="filter-input"
                        placeholder="채팅방 이름"
                        value={row.room}
                        onChange={(event) => handleRoomSettingChange(row.id, 'room', event.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="secondary" type="button" onClick={handleAddRoomRow}>행 추가</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
