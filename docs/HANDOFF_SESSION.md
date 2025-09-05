# 인계 문서 — UTF-8 유지 필수

본 문서는 다음 세션에서 지금까지의 작업을 정확히 이어가기 위한 상태 정리와 인계 프롬프트를 포함합니다. 반드시 파일 인코딩을 UTF-8(한글)로 유지하세요. VS Code 권장 설정: `"files.encoding": "utf8"`, `"files.autoGuessEncoding": false`.

## 현재 구현 요약
- 빌드/패키징 안정화
  - Vite `base: './'` 설정으로 패키징 앱에서 file:// 자산 경로 문제 해결.
  - `package.json > build.files`에 `src/shared/**` 포함(규칙 모듈 asar 누락 해결).

- 협정 규칙 편집(설정)
  - 모달 UI 정돈, 공종 라벨 한글화(전기/통신/소방), 검색을 별도 모달로 분리.
  - 항상 포함/항상 제외, 담당자 금지 조합, 단독입찰 가능 제외 토글 등 동작.
  - 좌/우 박스 분리(`rules-box`), 버튼 톤/배치 정리.
  - 저장/로드 IPC: `agreements-rules-load`/`agreements-rules-save`.
  - 기본값 시드: 패키지 `resources/defaults/agreements.rules.json` 존재 시 초기 복사.

- 업체 조회 공용 모달(`CompanySearchModal`)
  - 검색 입력/결과 테이블 정렬, 버튼 톤을 연보라(`btn-soft`)로 통일.
  - 테이블 정렬/레이아웃 개선(좌측 정렬, 고정 헤더, 호버, 버튼 잘림 방지).

- LH 50억 미만 마법사
  - 금액 입력 공용 컴포넌트 `AmountInput`(천 단위 콤마).
  - 지역 의무(OR/지분합계 모드 선택, 현재 입력 허용), 선택 칩 표시.
  - Step 2 “후보 산출” 버튼 + `CandidatesModal` 연동.

- 후보 산출 모달(`CandidatesModal`)
  - 좌측: 입찰참가자격금액/기초금액/시공비율 기준금액/의무지역/지분 필터/옵션.
  - 우측: 결과 테이블(회사/대표/지역/시평/5년실적/가능지분(%) + 상태 뱃지).
  - 지분율 표시/정렬
    - 지분율 = 시평 ÷ 기준금액 × 100
    - 표시는 소수 둘째 자리 내림, 정렬은 원시값으로만(`_pctRaw`) 수행.
    - null(계산 불가)은 항상 하단, 동률은 회사명으로 안정 정렬.
  - 정렬 버튼(높은순/낮은순) 연속 클릭 이슈 해결: `sortSeq`로 강제 재정렬.
  - 자동 핀 상위 N, 최소/최대 지분율 필터, 선택 초기화.
  - 렌더링 key 고유화(`id-index`)로 중복 key에 의한 재정렬 누락 방지.

- 후보 산출 IPC(`agreements-fetch-candidates`)
  - 입력: `{ ownerId:'LH', fileType, entryAmount, baseAmount, dutyRegions, excludeSingleBidEligible, filterByRegion }`.
  - 처리: SearchService 데이터 조회 → alwaysExclude 제거/alwaysInclude 유지 → `isSingleBidEligible` 판정 → 옵션에 따라 단독가능/지역불일치 제외.
  - 숫자 파싱 보강: 시평/실적 값에서 숫자만 추출하여 안전 계산.
  - 출력: 후보 배열 + 플래그(`moneyOk/perfOk/regionOk/singleBidEligible/wasAlwaysIncluded`)와 간단 메타.

- 설정 내보내기/가져오기
  - IPC: `agreements-settings-export`/`agreements-settings-import`.
  - 묶어서 내보냄: `agreements.rules.json`(규칙) + `formulas.json`(산식 오버라이드). 기존 파일은 `.bak` 백업 후 덮어쓰기.
  - Settings 페이지 버튼 추가.

## 파일 참조(핵심)
- 메인/패키징: `main.js`, `vite.config.js`, `package.json`
- 규칙 스키마/함수: `src/shared/agreements/rules/schema.js`, `src/shared/agreements/rules/lh.js`
- 규칙 모달: `src/view/features/settings/components/AgreementsRulesModal.jsx`
- 공용 검색 모달: `src/components/CompanySearchModal.jsx`
- 금액 입력: `src/components/AmountInput.jsx`
- 후보 모달: `src/view/features/agreements/components/CandidatesModal.jsx`
- LH 50억 미만: `src/view/features/agreements/pages/LHUnder50Page.jsx`
- 프리로드: `preload.js`

## 남은 과제 / 다음 단계 제안
1) 후보 엔진 고도화
   - `filterByRegion` 외에 rules의 `regionDutyOverride`(anyOne/shareSum+rate) 모드 통합.
   - 후보 캐시(입력 파라미터 해시 기반) 및 간단 페이징/가상 스크롤.

2) 조합 제안 엔진(스켈레톤)
   - 새 파일 `src/shared/agreements/jvEvaluator.js`: `suggestCombos({ candidates, teamConstraints, shareConstraints, rules, topN })`.
   - 제약: 팀 크기, 지분 범위/스텝, 금지(회사/담당자), pin 우선 포함.
   - 탐색: greedy → 소형 빔서치, 근거(trace) 제공.

3) UI 연동
   - Step 3 카드/표에 제안 리스트, 핀/잠금/지분 미세조정, 근거 툴팁.
   - “협정 문자 생성” 단계로 송신(기존 `generator.js` 활용).

4) 설정
   - formulas 프리셋도 `resources/defaults/formulas.json`에서 초기 시드하도록 확장(선택).
   - 설정 가져오기 이후 후보/점수 화면 자동 재조회 트리거.

## 주의사항(매우 중요)
- 모든 문서/코드는 UTF-8 한글 인코딩으로 저장. `\uXXXX` 이스케이프나 다른 인코딩 금지.
- 포뮬러(`formulas.defaults.json` + 오버라이드)는 점수/임계표 전용. 비즈니스 규칙(단독 제외/담당자 금지/항상 포함·제외)은 `src/shared/agreements/rules/*`에 유지.
- 배포 전 체크: `vite build` → `npm run dist:win`(또는 portable). 빈 화면이면 `base:'./'`/asar 포함 목록/콘솔 에러 확인.

---

## 인계 프롬프트(다음 세션에 그대로 붙여넣기)
작업 목표: LH 자동협정 — 후보 엔진 고도화 및 조합 제안 스켈레톤 연결. 모든 파일은 UTF-8 한글로 저장.

요구 사항:
1) 후보 IPC 정교화(`main.js:agreements-fetch-candidates`).
   - `regionDutyOverride`(anyOne/shareSum+rate) 지원. shareSum은 팀 조합 단계와 연계되므로 현재는 후보 표시용 뱃지/필터만 제공.
   - 후보 캐시/간단 페이징.

2) 조합 제안(스켈레톤) 구현.
   - 파일: `src/shared/agreements/jvEvaluator.js`
   - API: `suggestCombos(params)` → 상위 N 조합(지분배분/점수/제약충족/근거) 반환.
   - 제약: teamConstraints, shareConstraints, banPairs, banManagerPairs/banSameManager, pinned 포함.

3) LHUnder50Page Step 3 연동.
   - “제안 실행” 버튼으로 엔진 호출 → 카드/표 렌더 → 핀/지분 조정 후 “문자 생성” 호출.

검증:
- 후보 산출 모달에서 지분 정렬/필터/자동 핀이 안정적으로 동작.
- 설정 내보내기/가져오기 후 규칙/산식이 즉시 반영.
- 패키징 앱에서 규칙/공유 모듈 누락/자산 경로 문제 없이 실행.

주의:
- 반드시 UTF-8 한글로 저장(문자 깨짐 금지).
- 규칙/산식은 각각 전용 파일과 IPC를 통해서만 수정.

(문서 끝)

