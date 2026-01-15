import React from 'react';
import '../../../../styles.css';
import '../../../../fonts.css';
import Sidebar from '../../../../components/Sidebar';
import { useFeedback } from '../../../../components/FeedbackProvider.jsx';
import { BASE_ROUTES } from '../../../../shared/navigation.js';
import * as XLSX from 'xlsx';

export default function BidResultPage() {
  const { notify } = useFeedback();
  const [ownerId, setOwnerId] = React.useState('LH');
  const [formatFile, setFormatFile] = React.useState(null);
  const [isFormatting, setIsFormatting] = React.useState(false);
  const [templatePath, setTemplatePath] = React.useState('');
  const [agreementFile, setAgreementFile] = React.useState(null);
  const [orderingResultFile, setOrderingResultFile] = React.useState(null);
  const [isAgreementProcessing, setIsAgreementProcessing] = React.useState(false);
  const [isOrderingProcessing, setIsOrderingProcessing] = React.useState(false);
  const [agreementSheetNames, setAgreementSheetNames] = React.useState([]);
  const [selectedAgreementSheet, setSelectedAgreementSheet] = React.useState('');

  const formatFileInputRef = React.useRef(null);
  const templateFileInputRef = React.useRef(null);
  const agreementFileInputRef = React.useRef(null);
  const orderingFileInputRef = React.useRef(null);
  const templateFileName = templatePath ? templatePath.split(/[\\/]/).pop() : '';

  const strongLabelStyle = React.useMemo(() => ({
    display: 'block',
    marginBottom: '6px',
    fontWeight: 600,
    fontSize: '14px',
    color: '#0f172a',
  }), []);

  const handleSidebarSelect = React.useCallback((key) => {
    if (!key) return;
    if (key === 'search') { window.location.hash = BASE_ROUTES.search; return; }
    if (key === 'agreements') { window.location.hash = BASE_ROUTES.agreementBoard; return; }
    if (key === 'region-search') { window.location.hash = BASE_ROUTES.regionSearch; return; }
    if (key === 'agreements-sms') { window.location.hash = BASE_ROUTES.agreements; return; }
    if (key === 'auto-agreement') { window.location.hash = BASE_ROUTES.autoAgreement; return; }
    if (key === 'records') { window.location.hash = '#/records'; return; }
    if (key === 'mail') { window.location.hash = '#/mail'; return; }
    if (key === 'excel-helper') { window.location.hash = '#/excel-helper'; return; }
    if (key === 'bid-result') { window.location.hash = '#/bid-result'; return; }
    if (key === 'settings') { window.location.hash = BASE_ROUTES.settings; return; }
    if (key === 'upload') { window.location.hash = BASE_ROUTES.agreementBoard; }
  }, []);

  const handleTemplateFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setTemplatePath(file.path || '');
      notify({ type: 'info', message: '개찰결과파일이 변경되었습니다.' });
    } else {
      setTemplatePath('');
    }
  };

  const handlePickTemplateFile = () => {
    if (templateFileInputRef.current) {
      templateFileInputRef.current.click();
    }
  };

  const handleClearTemplateFile = () => {
    if (templateFileInputRef.current) {
      templateFileInputRef.current.value = '';
    }
    setTemplatePath('');
    notify({ type: 'info', message: '개찰결과파일 선택이 해제되었습니다.' });
  };

  const handleFormatFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setFormatFile(file);
    } else {
      setFormatFile(null);
    }
  };

  const handleClearFormatFile = React.useCallback(() => {
    if (formatFileInputRef.current) {
      formatFileInputRef.current.value = '';
    }
    setFormatFile(null);
  }, []);

  const handleFormatWorkbook = async () => {
    if (!formatFile?.path) {
      notify({ type: 'info', message: '엑셀 파일을 선택하세요.' });
      return;
    }
    if (!window.electronAPI?.excelHelper?.formatUploaded) {
      notify({ type: 'error', message: '엑셀 서식 변환 기능을 사용할 수 없습니다.' });
      return;
    }
    setIsFormatting(true);
    try {
      const response = await window.electronAPI.excelHelper.formatUploaded({ path: formatFile.path });
      if (!response?.success) throw new Error(response?.message || '엑셀 서식 변환에 실패했습니다.');
      if (response?.path) setTemplatePath(response.path);
      notify({
        type: 'success',
        message: response?.path ? `변환이 완료되었습니다. (${response.path})` : '변환이 완료되었습니다.',
      });
    } catch (err) {
      notify({ type: 'error', message: err.message || '엑셀 서식 변환에 실패했습니다.' });
    } finally {
      setIsFormatting(false);
    }
  };

  const handleAgreementFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setAgreementFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        setAgreementSheetNames(workbook.SheetNames || []);
        setSelectedAgreementSheet(workbook.SheetNames?.[0] || '');
      };
      reader.readAsArrayBuffer(file);
    } else {
      setAgreementFile(null);
      setAgreementSheetNames([]);
      setSelectedAgreementSheet('');
    }
  };

  const handleOrderingResultUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setOrderingResultFile(file);
    } else {
      setOrderingResultFile(null);
    }
  };

  const handleClearAgreementFile = React.useCallback(() => {
    if (agreementFileInputRef.current) {
      agreementFileInputRef.current.value = '';
    }
    setAgreementFile(null);
    setAgreementSheetNames([]);
    setSelectedAgreementSheet('');
  }, []);

  const handleClearOrderingFile = React.useCallback(() => {
    if (orderingFileInputRef.current) {
      orderingFileInputRef.current.value = '';
    }
    setOrderingResultFile(null);
  }, []);

  const handleAgreementSheetSelect = (event) => {
    setSelectedAgreementSheet(event.target.value);
  };

  const handleRunAgreementProcess = async () => {
    if (!templatePath) {
      notify({ type: 'info', message: '먼저 템플릿 파일을 서식 변환으로 생성하세요.' });
      return;
    }
    if (!agreementFile?.path) {
      notify({ type: 'info', message: '협정파일을 선택하세요.' });
      return;
    }
    if (!selectedAgreementSheet) {
      notify({ type: 'info', message: '협정파일 시트를 선택하세요.' });
      return;
    }
    setIsAgreementProcessing(true);
    try {
      notify({ type: 'info', message: `협정파일 처리는 준비 중입니다. (템플릿: ${templatePath})` });
    } finally {
      setIsAgreementProcessing(false);
    }
  };

  const handleRunOrderingProcess = async () => {
    if (!templatePath) {
      notify({ type: 'info', message: '먼저 템플릿 파일을 서식 변환으로 생성하세요.' });
      return;
    }
    if (!orderingResultFile?.path) {
      notify({ type: 'info', message: '발주처결과 파일을 선택하세요.' });
      return;
    }
    setIsOrderingProcessing(true);
    try {
      notify({ type: 'info', message: `발주처결과 처리는 준비 중입니다. (템플릿: ${templatePath})` });
    } finally {
      setIsOrderingProcessing(false);
    }
  };

  return (
    <div className="app-shell">
      <Sidebar active="bid-result" onSelect={handleSidebarSelect} fileStatuses={{}} collapsed={true} />
      <div className="main">
        <div className="title-drag" />
        <div className="topbar" />
        <div className="stage excel-helper-stage">
          <div className="excel-helper-shell">
            <h1 className="excel-helper-title">개찰결과 도우미</h1>
            <div className="excel-helper-body">
              <section className="excel-helper-section">
                <h2>엑셀 서식 변환</h2>
                <p className="section-help">업로드한 엑셀 파일의 서식/수식을 자동으로 정리합니다. (B열 순번 기준으로 마지막 행까지 적용)</p>
                <div style={{ marginBottom: '16px' }}>
                  <label className="field-label" style={strongLabelStyle}>발주처</label>
                  <select
                    className="input"
                    value={ownerId}
                    onChange={(e) => setOwnerId(e.target.value)}
                  >
                    <option value="LH">LH</option>
                    <option value="MOIS">행안부</option>
                    <option value="PPS">조달청</option>
                    <option value="EX">한국도로공사</option>
                    <option value="KRAIL">국가철도공단</option>
                  </select>
                </div>
                {ownerId !== 'LH' && (
                  <div className="excel-inline-alert">
                    선택한 발주처 양식은 아직 준비 중입니다. 현재는 LH만 지원합니다.
                  </div>
                )}
                {ownerId === 'LH' && (
                  <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label className="field-label" style={strongLabelStyle}>엑셀 파일 선택</label>
                    <input
                      type="file"
                      className="input"
                      accept=".xlsx"
                      ref={formatFileInputRef}
                      onChange={handleFormatFileUpload}
                      onClick={(e) => { e.target.value = ''; }}
                    />
                    <button
                      type="button"
                      className="btn-soft"
                      style={{ marginTop: '8px' }}
                      onClick={handleClearFormatFile}
                      disabled={!formatFile}
                    >
                      업로드 파일 지우기
                    </button>
                    {formatFile && (
                      <p className="section-help" style={{ marginTop: 8 }}>
                        선택된 파일: {formatFile.name}
                      </p>
                    )}
                  </div>
                  <div className="excel-helper-actions">
                    <button
                      type="button"
                      className="primary"
                      onClick={handleFormatWorkbook}
                      disabled={isFormatting}
                      style={{ width: '100%' }}
                    >
                      {isFormatting ? '변환 중...' : '서식 변환'}
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '18px' }}>
                  <div>
                    <label className="field-label" style={strongLabelStyle}>개찰결과파일</label>
                    <input
                      type="file"
                      accept=".xlsx"
                      ref={templateFileInputRef}
                      onChange={handleTemplateFileUpload}
                      onClick={(e) => { e.target.value = ''; }}
                      style={{ display: 'none' }}
                    />
                    <div className="input" style={{ fontWeight: 700 }}>
                      {templateFileName || '템플릿을 먼저 생성하세요.'}
                    </div>
                    {templatePath && (
                      <p className="section-help" style={{ marginTop: 6, fontWeight: 700 }}>
                        {templatePath}
                      </p>
                    )}
                    <button
                      type="button"
                      className="btn-soft"
                      style={{ marginTop: '8px' }}
                      onClick={handlePickTemplateFile}
                    >
                      개찰결과파일 변경
                    </button>
                    <button
                      type="button"
                      className="btn-soft"
                      style={{ marginTop: '8px' }}
                      onClick={handleClearTemplateFile}
                      disabled={!templatePath}
                    >
                      업로드 파일 지우기
                    </button>
                  </div>
                  <div>
                    <label className="field-label" style={strongLabelStyle}>협정파일 업로드</label>
                    <input
                      type="file"
                      className="input"
                      accept=".xlsx"
                      ref={agreementFileInputRef}
                      onChange={handleAgreementFileUpload}
                      onClick={(e) => { e.target.value = ''; }}
                    />
                    <button
                      type="button"
                      className="btn-soft"
                      style={{ marginTop: '8px' }}
                      onClick={handleClearAgreementFile}
                      disabled={!agreementFile}
                    >
                      업로드 파일 지우기
                    </button>
                    {agreementFile && (
                      <p className="section-help" style={{ marginTop: 8 }}>
                        선택된 파일: {agreementFile.name}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="field-label" style={strongLabelStyle}>협정파일 시트 선택</label>
                    <select
                      className="input"
                      value={selectedAgreementSheet}
                      onChange={handleAgreementSheetSelect}
                      disabled={agreementSheetNames.length === 0}
                    >
                      <option value="">시트를 선택하세요</option>
                      {agreementSheetNames.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="excel-helper-actions">
                    <button
                      type="button"
                      className="primary"
                      onClick={handleRunAgreementProcess}
                      disabled={isAgreementProcessing}
                      style={{ width: '100%' }}
                    >
                      {isAgreementProcessing ? '처리 중...' : '협정 실행'}
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '18px' }}>
                  <div>
                    <label className="field-label" style={strongLabelStyle}>개찰결과파일</label>
                    <div className="input" style={{ fontWeight: 700 }}>
                      {templateFileName || '템플릿을 먼저 생성하세요.'}
                    </div>
                    {templatePath && (
                      <p className="section-help" style={{ marginTop: 6, fontWeight: 700 }}>
                        {templatePath}
                      </p>
                    )}
                    <button
                      type="button"
                      className="btn-soft"
                      style={{ marginTop: '8px' }}
                      onClick={handlePickTemplateFile}
                    >
                      개찰결과파일 변경
                    </button>
                    <button
                      type="button"
                      className="btn-soft"
                      style={{ marginTop: '8px' }}
                      onClick={handleClearTemplateFile}
                      disabled={!templatePath}
                    >
                      업로드 파일 지우기
                    </button>
                  </div>
                  <div>
                    <label className="field-label" style={strongLabelStyle}>발주처결과 업로드</label>
                    <input
                      type="file"
                      className="input"
                      accept=".xlsx"
                      ref={orderingFileInputRef}
                      onChange={handleOrderingResultUpload}
                      onClick={(e) => { e.target.value = ''; }}
                    />
                    <button
                      type="button"
                      className="btn-soft"
                      style={{ marginTop: '8px' }}
                      onClick={handleClearOrderingFile}
                      disabled={!orderingResultFile}
                    >
                      업로드 파일 지우기
                    </button>
                    {orderingResultFile && (
                      <p className="section-help" style={{ marginTop: 8 }}>
                        선택된 파일: {orderingResultFile.name}
                      </p>
                    )}
                  </div>
                  <div className="excel-helper-actions">
                    <button
                      type="button"
                      className="primary"
                      onClick={handleRunOrderingProcess}
                      disabled={isOrderingProcessing}
                      style={{ width: '100%' }}
                    >
                      {isOrderingProcessing ? '처리 중...' : '결과 실행'}
                    </button>
                  </div>
                </div>
                  </>
                )}
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
