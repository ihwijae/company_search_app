# Automation Engine — New Repo Setup and Handoff

목표: 현재 앱은 가볍게 유지하고, “입찰 참가신청 자동화”는 별도 프로그램(엔진)으로 완전 분리해 안정성/업데이트 유연성을 확보.

## 무엇을 만들까
- 별도 리포/프로그램(엔진): 브라우저 자동화 + 인증서 네이티브 창 제어를 담당
- 현재 앱: 메뉴/버튼/상태표시 + 엔진 실행/로그 표시만 수행
- 통신 방식: 표준출력(JSON Lines) 기반의 단방향 이벤트 스트림 + 종료코드로 성공/실패 판단

## 새 리포 구조(권장)
```
automation-engine/
  package.json
  README.md
  .gitignore
  src/
    cli.js                # 진입점(표준출력으로 JSON 이벤트 송신)
    jobs/schema.sample.json
    core/orchestrator.js  # 실행 흐름(큐, 재시도, 타임아웃)
    web/playwright.js     # (추후) Playwright 제어
    native/uia.js         # (추후) Windows UIA/AutoHotkey/WinAppDriver 연동
    util/logger.js        # JSONL 로거
```

## 초기 의존성(최소)
- 처음에는 외부 대형 의존성 없이 시작합니다. (엔진 뼈대 + CLI만)
- 실제 자동화 단계에서만 추가: `playwright`, `selenium-webdriver`(WinAppDriver), 또는 `autoit/ahk` 호출 등

## package.json 예시
```json
{
  "name": "automation-engine",
  "version": "0.1.0",
  "private": true,
  "type": "commonjs",
  "bin": {
    "automation-engine": "src/cli.js"
  },
  "scripts": {
    "start": "node src/cli.js --help",
    "dev": "node src/cli.js --demo"
  },
  "dependencies": {},
  "devDependencies": {}
}
```

## CLI 시그널/프로토콜
- 입력: `--job <json파일경로>`
- 출력: 한 줄당 하나의 JSON 객체(JSON Lines). `type`으로 이벤트 구분

이벤트 예시
```text
{"type":"started","pid":1234,"ts":"2025-01-01T00:00:00.000Z"}
{"type":"progress","step":"open_site","pct":10}
{"type":"progress","step":"fill_form","pct":45}
{"type":"screenshot","path":"C:/logs/shot_001.png"}
{"type":"done","ok":true,"result":{"receiptId":"KEPCO-2025-..."}}
```

Job JSON 예시(`jobs/schema.sample.json`)
```json
{
  "site": "kepco",                  
  "url": "https://...",
  "bidId": "공고ID 또는 URL",
  "fields": { "대표자": "홍길동", "연락처": "010-..." },
  "cert": { "type": "GPKI|범용", "policy": "AnySign|Delfino|TouchEn" },
  "options": { "headless": false, "timeoutSec": 300 }
}
```

## 최소 동작 CLI 샘플(`src/cli.js`)
아래는 설치 없이 데모가 가능한 더미 흐름 예시입니다.
```js
#!/usr/bin/env node
const fs = require('fs');

function emit(obj){
  try { process.stdout.write(JSON.stringify(obj) + "\n"); } catch {}
}

function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

async function main(){
  const args = process.argv.slice(2);
  if(args.includes('--help')){
    console.log('usage: automation-engine --job <path> [--demo]');
    process.exit(0);
  }
  const demo = args.includes('--demo');
  const i = args.indexOf('--job');
  const jobPath = i >= 0 ? args[i+1] : null;
  let job = null;
  if(jobPath && fs.existsSync(jobPath)){
    try { job = JSON.parse(fs.readFileSync(jobPath,'utf-8')); } catch {}
  }
  emit({ type:'started', pid: process.pid, ts: new Date().toISOString() });
  try {
    // 데모 시나리오(실제 자동화 호출 위치)
    emit({ type:'progress', step:'open_site', pct:10 }); await sleep(300);
    emit({ type:'progress', step:'navigate', pct:25 }); await sleep(300);
    if(demo) emit({ type:'log', level:'info', msg:'Demo mode running' });
    emit({ type:'progress', step:'fill_form', pct:50 }); await sleep(400);
    emit({ type:'progress', step:'cert_dialog', pct:70 }); await sleep(500);
    emit({ type:'progress', step:'submit', pct:90 }); await sleep(300);
    emit({ type:'done', ok:true, result:{ receiptId:'DEMO-12345', job } });
    process.exit(0);
  } catch (err) {
    emit({ type:'error', msg: String(err) });
    process.exit(1);
  }
}
main();
```

## 오케스트레이션(추후 확장)
- `src/core/orchestrator.js`: 재시도, 타임아웃, 스크린샷 저장, 로그 파일(JSONL) 출력
- `src/web/playwright.js`: Edge/Chrome 채널 선택, 셀렉터 안정화, 오류 복구 루틴
- `src/native/uia.js`: 인증서 창 자동 제어(WinAppDriver/Power Automate/AutoHotkey 중 택1)
- 보안: PIN 저장이 필요하면 DPAPI/Windows Credential Manager 사용(로그/덤프에 노출 금지)

## 현재 앱과 연동(요약)
- 앱 설정에 `enginePath`(엔진 실행 파일) 저장
- 버튼 클릭 시 메인 프로세스에서만 실행
- 표준출력을 읽어 렌더러로 IPC 중계

Electron 메인 예시(개념)
```js
// main.js (개념 예시)
const { spawn } = require('child_process');
function runEngine(enginePath, jobPath, onEvent){
  const ps = spawn(enginePath, ['--job', jobPath], { stdio:['ignore','pipe','pipe'] });
  ps.stdout.setEncoding('utf8');
  ps.stdout.on('data', chunk => {
    for(const line of String(chunk).split(/\r?\n/)){
      if(!line.trim()) continue;
      try { onEvent(JSON.parse(line)); } catch {}
    }
  });
  ps.on('close', code => onEvent({ type:'exit', code }));
  return ps;
}
```

## 배포/업데이트 전략
- 별도 설치형(추천): 엔진을 독립 설치파일로 배포 → 앱은 경로만 사용
- 최초 실행 시 다운로드: 앱에서 엔진 미설치 감지 시 안내/자동 설치
- 함께 동봉(선택): `extraResources`로 포함 가능하나 설치 용량/동기화 비용 증가

## 보안·제약 참고
- 사이트 약관/보안 정책(매크로/자동화 금지 여부) 확인 필요
- 캡차/OTP는 정책상 무인 자동화 불가일 수 있음(사람 개입 흐름 백업)
- 보안모듈 업데이트에 대비해 UIA 선택자 다중화/오류 복구 루틴 준비

## 단계별 진행 가이드(명령 예시)
1) 새 리포 생성
```powershell
mkdir automation-engine; cd automation-engine
npm init -y
# 위 package.json 예시대로 수정
mkdir src src/core src/web src/native src/jobs src/util
ni src/cli.js -ItemType File
ni src/core/orchestrator.js -ItemType File
ni src/web/playwright.js -ItemType File
ni src/native/uia.js -ItemType File
ni src/util/logger.js -ItemType File
ni src/jobs/schema.sample.json -ItemType File
```
2) 데모 실행(설치 없이 동작)
```powershell
node src/cli.js --demo
```
3) 실제 자동화 착수 시
```powershell
# 필요 시에만 설치
npm i -D playwright
# 또는 WinAppDriver/PAD/AutoHotkey 등 선택에 따라 추가 구성
```

## 이 문서를 만든 이유
- 별도 프로그램으로 분리하여 안정성과 유지보수성을 높이는 방향에 합의함
- 현재 세션의 의사결정과 다음 단계, 파일구조, 프로토콜을 한눈에 전달

---
필요하면 이 뼈대 그대로 현재 리포 내에 폴더로 먼저 만들어 두고, 이후 독립 리포로 옮겨도 됩니다.
