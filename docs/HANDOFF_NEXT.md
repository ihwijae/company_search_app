# 인계 문서(차후 세션 지속 작업용) — UTF-8 유지 필수

본 문서는 다음 세션에서 그대로 이어서 작업하기 위한 현재 상태/결정사항/다음 단계/인계 프롬프트를 정리합니다. 반드시 파일 인코딩을 UTF-8(한글)로 유지하세요. VS Code 권장: "files.encoding": "utf8", "files.autoGuessEncoding": false.

## 현재 구현 요약
- 메뉴/라우팅
  - LH 단일 메뉴 + 드롭다운(50억 미만, 50억~100억) 구성. 클릭 시 사이드바가 자동 확장/포커스 아웃 시 접힘(부드러운 애니메이션).
  - 파일: `src/components/Sidebar.jsx`, `src/styles.css`, `src/App.jsx`

- LH 50억 미만 마법사 스켈레톤
  - 섹션화: 공고 정보, 금액/일정, 지역 의무(복수 선택, anyOne/shareSum+비율), 팀 구성.
  - 업종별 지역 목록 연동(전기=eung/통신=tongsin/소방=sobang).
  - 파일: `src/view/features/agreements/pages/LHUnder50Page.jsx`

- 전체 복사(엑셀 붙여넣기) 개선
  - 값만 복사(서식 X): 메인 프로세스에서 CSV(1열 N행)로 클립보드에 기록.
  - 셀 내부 줄바꿈: LF(CHAR(10))만 사용 → 음표(♪) 현상 방지. 행 구분은 CRLF.
  - 퍼센트는 "nn.nn%"로 복사(×100 문제 방지).
  - 파일: `main.js`(copy-csv-column IPC), `preload.js`(copyCsvColumn), `src/view/features/search/pages/SearchPage.jsx`(handleCopyAll)

- 협정 규칙 저장/편집(스켈레톤)
  - 저장소/IPC: `userData/agreements.rules.json`, IPC(load/save) 추가.
  - 스키마: `src/shared/agreements/rules/schema.js` — alwaysInclude/alwaysExclude, banManagerPairs/banSameManager, excludeSingleBidEligible 등.
  - 편집 모달: `src/view/features/settings/components/AgreementsRulesModal.jsx`
    - 발주처/공종 선택, 단독 제외 토글, 항상 포함/제외 리스트, 담당자 금지 조합.
    - 모달 내에서 업체 검색 → 리스트에 즉시 추가.
  - 호출 버튼: `src/view/features/settings/pages/SettingsPage.jsx` 상단 "협정 규칙 편집" 버튼.

- 단독입찰 가능 여부 규칙(LH)
  - 금액: 시평 ≥ 입찰참가자격금액(미입력 시 추정가격 사용 권장)
  - 실적만점: 5년실적 ≥ 기초금액(1배)
  - 지역: 선택된 의무지역 OR 매칭
  - 파일: `src/shared/agreements/rules/lh.js` — `isSingleBidEligible(company, params)`

- 기타
  - 개발 포트 5173으로 통일: `vite.config.js`
  - Windows GPU shader cache 로그 완화: `main.js`(disable-gpu-shader-disk-cache)

## 다음 단계(우선순위 제안)
1) 후보 수집 IPC 구현
   - 목적: LH 마법사 Step 2에서 "협정 대상 후보"만 받아오기.
   - IPC 제안: `agreements-fetch-candidates`
   - 입력: `{ fileType: 'eung'|'tongsin'|'sobang', entryAmount, baseAmount, dutyRegions, excludeSingleBidEligible?: true, ownerId: 'LH' }`
   - 처리:
     - 데이터 풀에서 전체 업체 조회(기존 SearchService 활용).
     - `isSingleBidEligible` ok=true인 업체는 기본 제외(excludeSingleBidEligible가 true일 때).
     - rules(alwaysInclude/alwaysExclude) 반영: `alwaysExclude` 즉시 제거, `alwaysInclude`는 무조건 포함.
     - 결과에 flags(금액/실적/지역)와 간단 메타(요약상태/품질/최근자료 등) 포함 권장.
   - 출력: `{ success: true, data: Candidate[] }`

2) LHUnder50Page Step 2 통합
   - 후보 테이블(정렬/필터/선택 고정/제외) UI.
   - 규칙에 의해 포함/제외된 이유 뱃지/툴팁 표시.

3) 제안기 스켈레톤
   - 경로 제안: `src/shared/agreements/jvEvaluator.js`
   - API: `suggestCombos(params)` → 상위 N 조합(지분배분/점수/제약충족 플래그/근거) 반환.
   - 제약: teamConstraints, shareConstraints, banPairs, banManagerPairs/banSameManager 반영.
   - 초기: greedy 또는 간단 빔서치로 최소 기능부터.

4) 규칙 UI 확장(선택)
   - pinCompanies, fixedJV, team/지분 제약 편집 섹션 추가.

## 주의사항(중요)
- 모든 문서/코드/문자열은 UTF-8 한글로 작성/저장(이스케이프 \uXXXX 지양).
- 포뮬러(`formulas.defaults.json` + 오버라이드)는 점수 산식/임계표 전용. 비즈 규칙(단독 제외/담당자 금지 등)은 `src/shared/agreements/rules/*`에 유지.

## 파일 참조(핵심)
- LH 페이지: `src/view/features/agreements/pages/LHUnder50Page.jsx`
- 사이드바: `src/components/Sidebar.jsx`
- 전체 복사: `src/view/features/search/pages/SearchPage.jsx`, `preload.js`, `main.js`
- 규칙 스키마/함수: `src/shared/agreements/rules/schema.js`, `src/shared/agreements/rules/lh.js`
- 규칙 편집 모달: `src/view/features/settings/components/AgreementsRulesModal.jsx`

---

## 인계 프롬프트(다음 세션에 그대로 붙여넣기)
작업 목표: LH 자동협정 1단계 — "협정 대상 후보 수집" 완료 및 UI 연동. 모든 파일은 UTF-8 한글로 저장.

요구 사항:
1) IPC `agreements-fetch-candidates` 구현(`main.js`).
   - 입력: `{ fileType, entryAmount, baseAmount, dutyRegions, ownerId:'LH', excludeSingleBidEligible:true }`.
   - 처리: SearchService 데이터에서 전량 로드 → `isSingleBidEligible`로 단독 가능 업체 제외(옵션) → rules(alwaysInclude/alwaysExclude) 반영.
   - 결과: 후보 배열(회사명/대표/지역/시평/5년실적/요약상태 + flags: moneyOk/perfOk/regionOk/wasAlwaysIncluded/wasAlwaysExcluded 등).

2) `LHUnder50Page.jsx` Step 2에서 위 IPC 호출해 후보 표 렌더.
   - 업종/지역/금액 입력 변경 시 재조회.
   - 고정/제외 토글 컬럼(로컬 상태) 준비.

3) 규칙 편집 모달은 현 상태 유지(UTF-8 한글 라벨 고정). 필요 시 alwaysInclude/Exclude 편집 후 저장 → 후보 재조회로 반영 확인.

파일 경로:
- `main.js`, `preload.js`
- `src/shared/agreements/rules/lh.js`
- `src/view/features/agreements/pages/LHUnder50Page.jsx`

검증:
- "협정 규칙 편집"에서 alwaysExclude로 지정한 업체가 후보에서 사라지는지 확인.
- excludeSingleBidEligible=true 기본에서 시평/실적/지역 모두 충족하는 단독 가능 업체가 후보에서 빠지는지 확인.

주의:
- 반드시 UTF-8 한글로 저장(문자깨짐 금지).
- 포뮬러 파일은 산식/임계표만 수정. 후보 필터는 규칙 파일/함수로 처리.

(문서 끝)

