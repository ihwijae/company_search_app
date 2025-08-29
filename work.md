# 작업 제안 및 질문 (요약판)

이 문서는 제안과 질문만 정리합니다. “구현해줘/수정해줘” 요청 전까지는 코드 변경을 하지 않습니다.

## 합의된 작업 규칙
- 사용자가 명시적으로 요청하기 전까지 코드 변경 금지
- 제안/질문은 이 파일에만 기록 및 갱신
- 변경 전 사전 설명, 최소 범위로 수행

## 현재 상태 요약(완료)
- 엑셀 업로드 안정화: `.xlsx`만 허용, 댓글/메모 정화(강화) 적용, 오류 메시지 보강
- 자동 반영: 파일 변경 감시(chokidar) + 500ms 디바운스 재로딩 + 렌더러 `data-updated` 연동
- 임시 파일 관리: 정화본 자동 정리(최근 3개 유지, 24h 만료, 6h 주기 정리)
- UI 구조: 좌측 사이드바 + 우측 드로어(업로드), 메인 영역(필터/결과/상세) 적용

## 최근 수정 요청 반영(완료)
- 상세 패널 폭 축소: 과도하게 넓지 않도록 `max-width` 제한
- 톤 전환: 전체 라이트 톤, 사이드바만 짙은 보라색
- 업로드 드로어 클릭 문제: 오버레이/드로어 z-index 조정(드로어가 위)

## 확인 요청(피드백)
- 상세 패널 폭이 적절한가요? 더 줄이거나 늘릴까요?
- 라이트 톤/사이드바 보라색감이 만족스러운가요? 원하는 색상 코드가 있으면 알려주세요.
- 드로어 내부의 업로드 버튼 등 상호작용이 정상적으로 동작하나요?

## 다음 작업(원하시면 진행)
- 사이드바 축소 모드(아이콘 전용, 툴팁)
- 헤더 전역 검색/단축키(Ctrl/⌘+K)
- 드로어 접근성 보강(포커스 트랩/첫 포커스 이동)
- 리스트/테이블 타이포·간격 미세 조정(컴팩트 유지)

## 창 크기/최대화·복원 일관성 개선 제안
문제: 최소화/최대화/복원 시 창 크기와 위치가 모니터에 따라 제각각으로 보임.

목표(수용 기준)
- 복원 시: 마지막 “일반 크기(normal bounds)”로 정확히 복원(다중 모니터에서도 화면 밖으로 벗어나지 않음)
- 최대화 시: 현재 창이 위치한 모니터의 작업 영역(workArea) 기준으로 꽉 차게 표시
- 재실행 시: 마지막 상태(최대화 여부, 위치/크기)를 복원하되, 유효 범위 밖이면 자동 보정

접근(코드 변경, main.js)
- 상태 저장: `browserWindow.getNormalBounds()`와 `isMaximized()`를 `CONFIG_PATH`에 저장
- 이벤트 처리: `resize`/`move` 시 디바운스 저장, `maximize`/`unmaximize`/`minimize`/`restore`에서 상태 업데이트
- 복원 로직: 앱 시작 시 저장된 상태를 읽어 유효성 검사 후 `setBounds()` 또는 `maximize()` 수행
- 유효성 검사: Electron `screen.getDisplayMatching(bounds)`로 대상 디스플레이를 찾고, 화면 밖이면 해당 디스플레이의 workArea 안으로 스냅

개략 변경안(설명용)
- createWindow 이전에 `loadWindowState()` 호출 → `{ x,y,width,height,isMaximized }`
- `new BrowserWindow({ x,y,width,height, ... })`로 생성(없으면 기본값)
- `mainWindow.on('resize'|'move'|'maximize'|'unmaximize'|'restore'|'close', saveWindowState)`
- 복원 시(`restore`): 저장된 normalBounds가 유효하면 `setBounds(normalBounds)`; 저장 상태가 ‘최대화’였다면 `maximize()`

질문/승인 요청
- 위 창 상태 일관성 개선을 적용할까요? 적용 시 main.js만 수정하며, 기존 기능에 영향은 없습니다.

## 이미지 기반 추가 피드백 해석 및 제안(v2)
첨부 스크린샷 기준 관찰 사항과 순수 CSS 수정 제안을 정리합니다. 승인해주시면 CSS만 수정하겠습니다.

관찰(현재 UI)
- 좌측 패널에 내부 스크롤바가 크게 보임 → 패널 높이 대비 여백/패딩이 커서 스크롤이 과하게 노출됨.
- 우측 상세 패널이 넓은 공백을 가짐 → 폭을 더 줄여도 정보 가독성에 문제 없음.
- 카드 그림자/모서리 느낌이 다소 강함 → 라이트 톤에선 옅은 경계선 + 약한 섀도가 더 자연스러움.
- 사이드바 색감은 의도대로 보라 톤이나 hover/active 대비를 조금만 더 부드럽게 하면 좋음.

제안(코드 미적용, CSS만 변경)
1) 레이아웃
- `.content` 그리드 비율: `300px 1fr`로 좌측을 소폭 축소(현재 320px) → 우측 공간 확보.
- 상세 패널 폭 제한: `.company-details{ max-width: 760px; }`(현재 860px)로 더 컴팩트하게.

2) 패널/카드 톤
- `.panel`: `border: 1px solid #e5e7eb`, `box-shadow: 0 1px 2px rgba(16,24,40,.06)`로 그림자 약화, 배경 `#fff` 유지, radius 12px로 약간 증가.
- 섹션 제목 상단 여백을 줄여 밀도 개선.

3) 폼/버튼 밀도
- `input, select` 높이 고정: `height: 36px`(현재 대비 약간 컴팩트) + 내부 padding `8px 10px` 유지.
- 버튼 기본은 라이트 톤(흰 배경) 유지, 주요 버튼은 `.primary`(indigo 톤) 사용을 유지.

4) 사이드바 디테일
- hover/active 배경을 약간 더 연하고 부드럽게 조정(투명도 상향) → 텍스트 대비 유지.
- 브랜드 타이틀 좌우 패딩 소폭 축소로 더 컴팩트하게.

계획된 CSS 변경안(요약)
- `.content { grid-template-columns: 300px 1fr; }`
- `.company-details { max-width: 760px; }`
- `.panel { border: 1px solid #e5e7eb; box-shadow: 0 1px 2px rgba(16,24,40,.06); border-radius: 12px; }`
- `input, select { height: 36px; }`
- `.nav-item:hover { background: rgba(255,255,255,0.10); }`
- `.nav-item.active { background: rgba(255,255,255,0.18); }`

질문(확인 필요)
- 좌측 패널 300px로 더 줄여도 괜찮을까요? (필요 시 320px 유지)
    대답: 괜찮아
- 상세 패널 760px로 축소하는 데 동의하시나요? 더 좁히거나 넓힐 값이 있으면 알려주세요.
    -대답: 동의해
- 폼 입력 높이 36px(컴팩트) OK?
    -대답: 동의해

요청 시 바로 적용하겠습니다(스타일 파일만 수정). 

## 이미지 기반 추가 피드백 제안(v3)
스크린샷 상 보이는 좌측 패널 가로 스크롤과 내부 스크롤바 노출을 줄이고, 카드/폼의 시각적 균형을 더 다듬는 CSS 제안입니다. 승인 시 CSS만 수정 적용합니다.

추가 제안(CSS만 변경, 코드 미적용)
- 패널 가로 스크롤 제거: `.panel { overflow-x: hidden; }`
- 전체 가로 스크롤 억제(안전장치): `body { overflow-x: hidden; }`
- 패널 내부 간격 정리: 카드 제목 하단 여백 `margin-bottom: 10px`, 섹션 구분선 `border-top: 1px solid #eef2f6`
- 라디오/라벨 간격: `.radio-group label { margin-right: 10px; }`
- 입력 폭 균일화: `.filter-input { width: 100%; }`, 범위 입력 `.range-inputs input { width: 100%; }`
- 검색 버튼 높이 통일: `.search-button { height: 36px; }`

적용 예정 CSS 스니펫(요약)
```
.panel { overflow-x: hidden; }
body { overflow-x: hidden; }
.search-filter-section h3 { margin: 0 0 10px 0; }
.search-filter-section .section-divider { border-top: 1px solid #eef2f6; margin: 10px 0; }
.radio-group label { margin-right: 10px; }
.filter-input { width: 100%; }
.range-inputs input { width: 100%; }
.search-button { height: 36px; }
```

승인 요청
- 위 v3 CSS를 적용해도 될까요? 적용 후 스크롤바 노출과 여백이 줄어드는지 함께 확인드리겠습니다.
대



## 사용자 UI 편의성을 위해 배치를 수정 요청
    -  현재는 검색대상 밑에 검색결과 박스가 있는데 이것을 검색대상 옆에 검색결과 상자를 배치
    - 즉 왼쪽부터 검색대상 - 검색결과 - 업체상세정보
    - 검색대상에서 검색을 하면 오른쪽에 검색 결과표시 후 검색결과에 조회된 업체를 누르면 업체상세정보에 표시 해주는 구조.