# 새 PC 작업 환경 세팅 가이드

이 문서는 PC를 포맷한 뒤 이 저장소를 다시 받아서 작업할 때 필요한 환경 세팅을 정리한 문서다.

## Codex에 바로 넘길 때

이 문서는 설명서이고, 실제 자동 설치는 `scripts/setup-wsl-dev.sh`가 수행한다.

Codex에게는 아래처럼 지시하면 된다.

```text
docs/pc백업.md를 읽고 WSL 개발 환경을 세팅해줘.
설치 작업은 scripts/setup-wsl-dev.sh를 실행해서 진행하고,
실패하는 단계가 있으면 멈추지 말고 원인과 필요한 조치를 정리해줘.
설치가 끝나면 node, npm, codex 버전과 npm install 결과를 요약해줘.
```

`codex` 전역 설치를 제외하려면 아래처럼 지시하면 된다.

```text
docs/pc백업.md를 읽고 WSL 개발 환경을 세팅해줘.
scripts/setup-wsl-dev.sh를 INSTALL_CODEX=0 옵션으로 실행해줘.
실패하는 단계가 있으면 원인과 필요한 조치를 정리해줘.
```

## 1. 먼저 설치할 프로그램

### Windows 필수
- Git
- Node.js 20 LTS
- npm
- Visual Studio Code
- Microsoft Excel Desktop

### 권장
- Windows Terminal
- PowerShell 7
- 7-Zip

### WSL 작업용
- WSL2
- Ubuntu

## 2. 설치 순서

1. Windows 업데이트를 먼저 완료한다.
2. Git, Node.js 20 LTS, VS Code를 설치한다.
3. WSL2와 Ubuntu를 설치한다.
4. 필요하면 Microsoft Excel Desktop을 설치한다.
5. 저장소를 클론한다.
6. 프로젝트 의존성을 설치한다.
7. 앱이 실행되는지 확인한다.
8. WSL 안에 `codex`를 설치한다.

## 3. 저장소 내려받기

```bash
git clone <저장소 주소>
cd company_search_app
```

## 4. 프로젝트 실행에 필요한 라이브러리

이 프로젝트는 `package.json` 기준으로 Node.js 의존성을 설치해서 사용한다.

### 설치 명령

```bash
npm install
```

### 런타임 라이브러리
- `adm-zip`
- `axios`
- `axios-cookiejar-support`
- `cheerio`
- `chokidar`
- `exceljs`
- `nodemailer`
- `react`
- `react-dom`
- `react-quill`
- `sql.js`
- `tough-cookie`
- `xlsx`

### 개발 라이브러리
- `@types/react`
- `@types/react-dom`
- `@vitejs/plugin-react`
- `concurrently`
- `electron`
- `electron-builder`
- `electron-icon-builder`
- `eslint`
- `eslint-plugin-react`
- `eslint-plugin-react-hooks`
- `eslint-plugin-react-refresh`
- `vite`

## 5. 권장 버전

현재 작업 환경 기준:

- Node.js: `v20.19.5`
- npm: `10.8.2`
- codex-cli: `0.115.0`

새 PC에서도 가능하면 Node.js 20 LTS를 맞추는 것이 안전하다.

## 6. 프로젝트 실행 명령

### 개발 실행

```bash
npm run start:dev
```

### 빌드

```bash
npm run build
```

### 앱 실행

```bash
npm run start
```

### 윈도우 설치 파일 생성

```bash
npm run dist:win
```

## 7. 새 PC에서 체크할 항목

- `npm install`이 정상 완료되는지 확인
- `npm run start:dev` 실행 시 Electron 창이 뜨는지 확인
- Excel 연동 기능을 쓸 경우 Microsoft Excel Desktop이 설치되어 있는지 확인
- 설정 파일 경로는 PC마다 다를 수 있으므로 앱에서 다시 지정
- 실데이터 엑셀 파일은 Git에 넣지 말고 로컬 경로로 다시 연결

## 8. WSL 설치

관리자 PowerShell에서 실행:

```powershell
wsl --install
```

재부팅 후 Ubuntu를 처음 실행해서 사용자 계정을 만든다.

설치 확인:

```powershell
wsl -l -v
```

Ubuntu가 `WSL2`로 잡히면 된다.

## 9. WSL 기본 패키지 설치

Ubuntu 안에서 실행:

```bash
sudo apt update
sudo apt install -y curl git build-essential
```

## 10. WSL에 Node.js 설치

가장 단순한 방법은 `nvm` 또는 NodeSource 중 하나를 쓰는 것이다.
버전 관리까지 하려면 `nvm`이 편하다.

### nvm 설치

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
```

설치 확인:

```bash
node -v
npm -v
```

## 11. WSL에 codex 설치

현재 환경 기준으로 `codex`는 npm 전역 패키지 `@openai/codex`로 설치되어 있다.

### 설치

```bash
npm install -g @openai/codex
```

### 확인

```bash
codex --version
```

정상 설치되면 `codex-cli` 버전이 출력된다.

## 12. WSL에서 codex 사용 준비

### 저장소 진입

```bash
cd ~/projects
git clone <저장소 주소>
cd company_search_app
```

### 프로젝트 의존성 설치

```bash
npm install
```

### codex 실행

```bash
codex
```

필요하면 WSL 안에서 OpenAI 인증 또는 관련 환경변수 설정을 추가로 진행한다.

## 13. 권장 작업 방식

- 앱 실행과 최종 확인은 Windows에서 진행
- 코드 편집과 `codex` 사용은 WSL에서 진행
- 저장소는 가능하면 WSL 홈 디렉터리 아래에 두고 작업
- Windows Excel 의존 기능은 WSL이 아니라 Windows에서 확인

## 14. WSL 개발 환경 자동 설치 스크립트

이 저장소에는 WSL 기준 개발 환경 복구용 스크립트를 추가해두었다.

파일:
- `scripts/setup-wsl-dev.sh`

수행 내용:
- Ubuntu 기본 패키지 설치
- `nvm` 설치
- Node.js 20 설치 및 기본 버전 지정
- `@openai/codex` 전역 설치
- 프로젝트 `npm install`
- 설치 버전 출력

실행 방법:

```bash
cd ~/projects/company_search_app
bash scripts/setup-wsl-dev.sh
```

`codex` 설치를 제외하고 싶으면:

```bash
INSTALL_CODEX=0 bash scripts/setup-wsl-dev.sh
```

Node 메이저 버전을 바꾸고 싶으면:

```bash
NODE_MAJOR_VERSION=20 bash scripts/setup-wsl-dev.sh
```

## 15. 복구 후 빠른 체크리스트

- Git 설치
- Node.js 20 LTS 설치
- 저장소 클론
- `npm install`
- `npm run start:dev`
- Excel 설치 여부 확인
- WSL2 + Ubuntu 설치
- WSL 내부에 Node.js 설치
- `npm install -g @openai/codex`
- `codex --version` 확인
