# 구조 설명과 리팩터링 가이드 (쉽게 보기)

이 문서는 현재 앱의 구조를 웹 개발 관점으로 쉽게 설명하고, 앞으로 진행할 “SearchService로 이전” 작업이 무엇인지 정리합니다.

## 한눈에 요약
- main.js: 앱 부팅/창 생성/핸들러 등록만 담당(비즈니스 로직 최소화).
- Controller(IPC 핸들러): 기능(도메인)별로 분리해 등록. 예) search/ipc.js
- Service: 실제 업무 흐름(파일 로드, 감시, 집계 등) 오케스트레이션. 예) search/services/searchService.js
- Repository(Adapter): 데이터 소스 접근 계층. 현재 searchLogic.js(엑셀 파서). 나중에 adapters/로 이동.
- Renderer(React): 화면/상호작용. Preload는 Renderer와 Main 사이의 안전한 다리(API 게이트웨이).

## “SearchService로 이전”이란?
지금 main.js 안에 흩어져 있는 “검색 관련 실제 동작”을 SearchService로 옮겨서 한 곳에서 관리하는 것을 의미합니다.

옮길 대상(예시)
- 파일 선택 이후 처리: sanitizeXlsx → SearchLogic 로드
- 파일 변경 감시(chokidar) + 디바운스 재로딩
- 타입별 로딩 상태/지역 목록/검색 집계(전체) 계산
- 로딩 완료 시 렌더러에 갱신 이벤트 전송

옮기지 않는 것
- 앱 시작/창 생성/핸들러 등록 같은 부팅 로직(= main.js의 역할)
- 화면(UI) 로직(= React)

## 웹 개발 비유
- main.js = 애플리케이션 부트스트랩 + 라우터 연결부(Express의 app.js에 해당)
- Controller = IPC 핸들러(예: search/ipc.js). 요청을 받아 Service를 호출.
- Service = 업무 로직(예: search/services/searchService.js). 파서/유틸을 조합해 동작.
- Repository/Adapter = 데이터 접근(현재 searchLogic.js: 엑셀 파서)
- Preload = API 게이트웨이(window.api.* 노출)
- Renderer(React) = View + 사용자 상호작용

## main.js의 역할
- 앱 설정 로드/저장, 초기화, 창 생성, 공용 타이머/정리(clean-up)
- 각 기능의 IPC 컨트롤러를 등록 호출
- 비즈니스 로직(파일 파싱/감시/검색 계산)은 점점 줄이고 Service로 이전

## Controller 레이어는 어디에?
- 현재: main.js의 일부 IPC 핸들러 + src/main/features/search/ipc.js(전체 검색 관련)
- 앞으로: “기능(도메인)별”로 파일을 분리하고, 각 기능에 전용 controller(IPC) 파일을 둡니다.
  - 예) src/main/features/search/ipc.js, src/main/features/settings/ipc.js, …
- 장점: 새 기능 추가 시 해당 기능 폴더만 건드리면 됨. 전체 컨트롤러 1개보다 유지보수성이 좋음.

## Service 레이어는 어디에?
- 현재: src/main/features/search/services/searchService.js (스켈레톤 존재)
- 앞으로: 기능마다 services/ 디렉토리를 두고, 해당 기능의 업무 흐름을 여기서 처리
  - 예) searchService가 파일 로드/감시/집계 담당, settingsService가 설정 저장/검증 담당 등

## Repository(Adapter) 레이어는 어디에?
- 현재: 프로젝트 루트의 searchLogic.js (엑셀 파서)
- 앞으로: 기능 폴더의 adapters/ 아래로 이동 예정
  - 예) src/main/features/search/adapters/excel/SearchLogic.js
  - 나중에 DB/REST로 소스가 바뀌면 adapters만 교체하고 Service/Controller는 유지

## 추천 디렉터리 예시
```
src/
  main/
    features/
      search/
        ipc.js                # Controller: IPC 등록
        services/
          searchService.js    # Service: 오케스트레이션(파일 로드, 감시, 집계)
        adapters/
          excel/
            SearchLogic.js    # Repository/Adapter: 엑셀 접근
    ipc/
      router.js               # (선택) 기능별 register 모아 호출
  preload/
    index.js                  # window.api.search.* 등 네임스페이스 API
  renderer/
    features/search/...       # React 컴포넌트/훅/상태
```

## 단계별 이전 계획(안전하게)
1) Controller 분리 고도화: search 관련 IPC는 search/ipc.js로 일원화(이미 1차 적용됨)
2) Service 이전: main.js의 파일 로드/감시/집계 로직을 searchService로 이동, main.js는 호출만
3) Repository 정리: searchLogic.js를 adapters/excel/SearchLogic.js로 이동(경로만 바꾸고 동작 동일)
4) Preload 네임스페이스: window.electronAPI → window.api.search.*로 래핑(렌더러 의존성 축소)

## 질문과 답(정리)
- Q: “SearchService로 이전”은 main.js가 하던 걸 옮기는 건가요?
  - A: 네. 파일 로드/감시/집계 같은 “검색 도메인 로직”을 Service로 옮겨 모듈화합니다.
- Q: 현재 구조를 웹 개발로 비유하면?
  - A: main(app.js) + controller(IPC) + service + repository(adapter) + view(React) 구조입니다.
- Q: main.js 역할은?
  - A: 앱 부팅/창 생성/핸들러 등록. 비즈니스 로직은 최소화합니다.
- Q: Controller는 기능별로 나누나요, 하나로 모으나요?
  - A: 기능(도메인)별로 나눕니다. search/ipc.js, settings/ipc.js처럼요.
- Q: Service는 어디에, 기능 추가 시 어떻게?
  - A: features/<도메인>/services/에 두고, 기능 추가 시 해당 폴더에 서비스 파일을 추가합니다.
- Q: Repository(searchLogic)는 어디로?
  - A: features/<도메인>/adapters/로 옮깁니다. 소스가 바뀌면 어댑터만 교체하면 됩니다.

---
필요하면 위 구조로 폴더만 먼저 잡아 드리고(동작 동일), 단계적으로 Service/Controller 모듈화까지 진행하겠습니다.

