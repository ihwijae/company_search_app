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

const owners = ['LH', '행안부', '조달청'];
const industries = ['전기', '통신', '소방'];
const RANGE_OPTIONS = {
  LH: ['50억 미만', '50억~100억'],
  행안부: ['30억 미만', '30억~50억', '50억~100억', '100억 이상'],
  조달청: ['50억 미만', '50억~100억', '100억 이상'],
};
const ALL_REGIONS = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];

export default function AutoAgreementPage() {
  const handleMenuSelect = React.useCallback((key) => {
    if (!key || key === 'auto-agreement') return;
    const target = ROUTE_HASHES[key] || null;
    if (target) {
      window.location.hash = target;
    }
  }, []);

  const [form, setForm] = React.useState({
    owner: owners[0],
    range: RANGE_OPTIONS[owners[0]][0],
    noticeTitle: '',
    noticeNo: '',
    industry: industries[0],
    dutyRate: '49',
    dutyRegions: ['경기'],
    maxMembers: '3',
  });

  const [amounts, setAmounts] = React.useState({
    base: '',
    estimated: '',
    bid: '',
    ratioBase: '',
    schedule: '',
  });

  const [templatePaths, setTemplatePaths] = React.useState({
    templateDir: 'C:/templates/협정',
    mappingFile: 'C:/templates/mapping.json',
  });

  const [sheetName, setSheetName] = React.useState('[포천2공공하수처리시설]');
  const [regionPickerOpen, setRegionPickerOpen] = React.useState(false);
  const [regionFilter, setRegionFilter] = React.useState('');

  const [teams, setTeams] = React.useState([
    { id: 1, leader: '대표사 A', members: ['구성1', '구성2'], shares: ['51', '29', '20'] },
    { id: 2, leader: '대표사 B', members: ['구성1', '구성2'], shares: ['60', '20', '20'] },
  ]);

  const updateForm = (key) => (event) => {
    const value = event?.target ? event.target.value : event;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const availableRanges = React.useMemo(() => RANGE_OPTIONS[form.owner] || RANGE_OPTIONS.LH, [form.owner]);

  const handleOwnerChange = (event) => {
    const nextOwner = event.target.value;
    const options = RANGE_OPTIONS[nextOwner] || RANGE_OPTIONS.LH;
    setForm((prev) => ({
      ...prev,
      owner: nextOwner,
      range: options.includes(prev.range) ? prev.range : options[0],
    }));
  };

  const updateAmount = (key) => (event) => {
    const value = event?.target ? event.target.value : event;
    setAmounts((prev) => ({ ...prev, [key]: value }));
  };

  const toggleDutyRegion = (region) => {
    setForm((prev) => {
      const exists = prev.dutyRegions.includes(region);
      const dutyRegions = exists
        ? prev.dutyRegions.filter((item) => item !== region)
        : [...prev.dutyRegions, region];
      return { ...prev, dutyRegions };
    });
  };

  const handleAutoArrange = () => {
    alert('자동 구성 로직은 추후 연결됩니다.');
  };

  const handleConfigAction = (type) => {
    alert(`${type} 기능은 추후 연결됩니다.`);
  };

  const handleCreateSheet = () => {
    alert('시트 생성 & 값 입력은 추후 연동됩니다.');
  };

  const combinedNoticeValue = React.useMemo(() => {
    return [form.noticeNo, form.noticeTitle].filter(Boolean).join(' ').trim();
  }, [form.noticeNo, form.noticeTitle]);

  const handleCombinedNoticeChange = (event) => {
    const raw = event.target.value || '';
    const trimmed = raw.trim();
    if (!trimmed) {
      setForm((prev) => ({ ...prev, noticeNo: '', noticeTitle: '' }));
      return;
    }
    const firstSpace = trimmed.indexOf(' ');
    if (firstSpace <= 0) {
      setForm((prev) => ({ ...prev, noticeNo: trimmed, noticeTitle: '' }));
    } else {
      const noPart = trimmed.slice(0, firstSpace).trim();
      const titlePart = trimmed.slice(firstSpace + 1).trim();
      setForm((prev) => ({ ...prev, noticeNo: noPart, noticeTitle: titlePart }));
    }
  };

  const filteredRegions = React.useMemo(() => {
    const keyword = regionFilter.trim().toLowerCase();
    if (!keyword) return ALL_REGIONS;
    return ALL_REGIONS.filter((region) => region.toLowerCase().includes(keyword));
  }, [regionFilter]);

  const toggleRegionPanel = () => {
    setRegionPickerOpen((prev) => !prev);
  };

  return (
    <div className="app-shell">
      <Sidebar active="auto-agreement" onSelect={handleMenuSelect} collapsed={true} />
      <div className="main">
        <div className="title-drag" />
        <div className="topbar" />
        <div className="stage">
          <div className="content auto-agreement-layout">
            <div className="panel auto-panel">
              <div className="panel-heading">
                <h1 className="main-title" style={{ marginTop: 0 }}>협정 자동화</h1>
                <p className="section-help">필수 정보를 입력하면 자동 구성과 엑셀 시트 생성을 준비할 수 있습니다.</p>
              </div>
              <section className="auto-section-card">
                <div className="section-header">
                  <h2 className="section-title">기본 정보</h2>
                  <button type="button" className="btn-chip" onClick={() => setForm((prev) => ({ ...prev, dutyRegions: ['경기'], dutyRate: '49' }))}>기본값</button>
                </div>
                <div className="auto-field-grid">
                  <label className="auto-field">
                    <span>발주처</span>
                    <select value={form.owner} onChange={handleOwnerChange}>
                      {owners.map((owner) => <option key={owner} value={owner}>{owner}</option>)}
                    </select>
                  </label>
                  <label className="auto-field">
                    <span>금액 구간</span>
                    <select value={form.range} onChange={updateForm('range')}>
                      {availableRanges.map((range) => <option key={range} value={range}>{range}</option>)}
                    </select>
                  </label>
                  <label className="auto-field" style={{ gridColumn: 'span 2' }}>
                    <span>공고번호 + 공고명</span>
                    <input value={combinedNoticeValue} onChange={handleCombinedNoticeChange} placeholder="예: R25BK... 포천2 공공하수..." />
                  </label>
                  <label className="auto-field">
                    <span>공종</span>
                    <select value={form.industry} onChange={updateForm('industry')}>
                      {industries.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </label>
                  <label className="auto-field">
                    <span>최대 구성사 수</span>
                    <select value={form.maxMembers} onChange={updateForm('maxMembers')}>
                      {[2, 3, 4, 5].map((num) => <option key={num} value={num}>{num}개</option>)}
                    </select>
                  </label>
                  <label className="auto-field">
                    <span>의무지분(%)</span>
                    <input value={form.dutyRate} onChange={updateForm('dutyRate')} />
                  </label>
                  <div className="auto-field" style={{ gridColumn: 'span 2' }}>
                    <span>의무지역</span>
                    <div className="auto-region-display">
                      {form.dutyRegions.length === 0 && <span className="auto-region-placeholder">선택된 지역 없음</span>}
                      {form.dutyRegions.map((region) => (
                        <span key={region} className="auto-region-chip">{region}</span>
                      ))}
                      <div className="auto-region-actions">
                        {form.dutyRegions.length > 0 && (
                          <button type="button" className="btn-soft" onClick={() => setForm((prev) => ({ ...prev, dutyRegions: [] }))}>초기화</button>
                        )}
                        <button type="button" className="btn-soft" onClick={toggleRegionPanel}>{regionPickerOpen ? '닫기' : '지역 선택'}</button>
                      </div>
                    </div>
                    {regionPickerOpen && (
                      <div className="auto-region-panel">
                        <input
                          value={regionFilter}
                          onChange={(event) => setRegionFilter(event.target.value)}
                          placeholder="지역명 검색"
                        />
                        <div className="auto-region-panel-list">
                          {filteredRegions.map((region) => (
                            <label key={region}>
                              <input
                                type="checkbox"
                                checked={form.dutyRegions.includes(region)}
                                onChange={() => toggleDutyRegion(region)}
                              />
                              <span>{region}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <section className="auto-section-card">
                <div className="section-header">
                  <h2 className="section-title">금액 / 일정</h2>
                  <span className="section-help">발주처별 필수 금액 정보를 채워 주세요.</span>
                </div>
                <div className="auto-field-grid">
                  <label className="auto-field">
                    <span>기초금액</span>
                    <input value={amounts.base} onChange={updateAmount('base')} placeholder="원" />
                  </label>
                  <label className="auto-field">
                    <span>추정가격</span>
                    <input value={amounts.estimated} onChange={updateAmount('estimated')} placeholder="원" />
                  </label>
                  <label className="auto-field">
                    <span>투찰금액</span>
                    <input value={amounts.bid} onChange={updateAmount('bid')} placeholder="원" />
                  </label>
                  <label className="auto-field">
                    <span>시공비율 기준</span>
                    <input value={amounts.ratioBase} onChange={updateAmount('ratioBase')} placeholder="원" />
                  </label>
                  <label className="auto-field">
                    <span>개찰/일정</span>
                    <input type="datetime-local" value={amounts.schedule} onChange={updateAmount('schedule')} />
                  </label>
                </div>
              </section>

              <section className="auto-section-card">
                <div className="section-header">
                  <h2 className="section-title">협정 구성</h2>
                  <button type="button" className="btn-primary" style={{ padding: '6px 16px' }} onClick={handleAutoArrange}>자동 구성</button>
                </div>
                <div className="auto-table-card">
                  <table>
                    <thead>
                      <tr>
                        <th>협정</th>
                        <th>대표사</th>
                        <th>구성사</th>
                        <th>지분(%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teams.map((team) => (
                        <tr key={team.id}>
                          <td>#{team.id}</td>
                          <td>{team.leader}</td>
                          <td>{team.members.join(', ')}</td>
                          <td>{team.shares.join(' / ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <div className="panel auto-panel">
              <section className="auto-section-card">
                <h2 className="section-title">템플릿 / 매핑</h2>
                <div className="auto-field">
                  <span>템플릿 폴더</span>
                  <div className="auto-path-row">
                    <input value={templatePaths.templateDir} onChange={(event) => setTemplatePaths((prev) => ({ ...prev, templateDir: event.target.value }))} />
                    <button type="button" className="btn-soft" onClick={() => handleConfigAction('경로 선택')}>찾기</button>
                  </div>
                </div>
                <div className="auto-field">
                  <span>셀 매핑 파일</span>
                  <div className="auto-path-row">
                    <input value={templatePaths.mappingFile} onChange={(event) => setTemplatePaths((prev) => ({ ...prev, mappingFile: event.target.value }))} />
                    <button type="button" className="btn-soft" onClick={() => handleConfigAction('매핑 선택')}>찾기</button>
                  </div>
                </div>
                <div className="auto-config-actions">
                  <button type="button" className="btn-chip" onClick={() => handleConfigAction('Config Import')}>Config 가져오기</button>
                  <button type="button" className="btn-chip" onClick={() => handleConfigAction('Config Export')}>Config 내보내기</button>
                </div>
              </section>

              <section className="auto-section-card">
                <h2 className="section-title">시트 정보</h2>
                <label className="auto-field">
                  <span>시트 이름</span>
                  <input value={sheetName} onChange={(event) => setSheetName(event.target.value)} />
                </label>
                <div className="auto-summary">
                  <div>
                    <strong>공고 요약</strong>
                    <p>{form.noticeTitle || '공고명을 입력하세요'}</p>
                  </div>
                  <div>
                    <strong>공종/의무지분</strong>
                    <p>{form.industry} · {form.dutyRate}%</p>
                  </div>
                  <div>
                    <strong>의무지역</strong>
                    <p>{form.dutyRegions.length ? form.dutyRegions.join(', ') : '미선택'}</p>
                  </div>
                </div>
                <div className="auto-action-group">
                  <button type="button" className="btn-primary" onClick={handleCreateSheet}>시트 생성 & 값 입력</button>
                  <button type="button" className="btn-soft" onClick={() => handleConfigAction('검증')}>실행 전 검증</button>
                </div>
              </section>
            </div>

            <div className="panel auto-panel" style={{ gridColumn: '1 / -1' }}>
              <div className="auto-file-actions">
                <div>
                  <h2 className="section-title" style={{ marginTop: 0 }}>엑셀 대상 파일</h2>
                  <p className="section-help">해당 공고의 마스터 파일을 선택하면 새 시트가 추가됩니다.</p>
                </div>
                <div className="auto-path-row">
                  <input readOnly value="C:/projects/master.xlsx" />
                  <button type="button" className="btn-soft" onClick={() => handleConfigAction('파일 선택')}>파일 선택</button>
                </div>
              </div>
              <div className="auto-inline-cards">
                <div className="auto-inline-card">
                  <strong>검증 상태</strong>
                  <p>금액 정보 부족</p>
                </div>
                <div className="auto-inline-card">
                  <strong>Config 버전</strong>
                  <p>v1.0 (2025-01)</p>
                </div>
                <div className="auto-inline-card">
                  <strong>마지막 저장</strong>
                  <p>방금 전</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
