# Performance Scoring Modes

정리해 둔 현재 실적점수 계산/설정 규칙입니다.

## 평가 엔진 기본 동작
- 계산은 `src/shared/evaluator.js` → `evaluateScores()`가 담당한다.
- 평가에 사용하는 규칙은 `loadFormulasMerged()`에서 로드한 `formulas` 데이터를 따른다.
  - 사용자가 설정 화면에서 저장한 값이 있으면 Electron userdata(`formulas.json`)의 override가 우선 적용된다.
  - override가 없으면 repo 기본값(`src/shared/formulas.defaults.json`)이 사용된다.
- `performance.mode`가 `ratio-bands`인 경우 밴드 표(최고점·최저점 포함)를 읽어서 점수를 산출하고, `formula` 등 다른 값이면 계산식 기반 로직을 사용한다.

## 등급제( ratio-bands ) 사용 범위
- **행안부 30억 미만**과 **행안부 30억~50억** 두 구간만 등급제 실적점수를 지원한다.
- 해당 구간은 설정 UI에서 "실적점수 기준 수정"을 누르면 등급표 모달이 열린다.
  - 구간별 비율/점수는 직접 편집 가능하며, 마지막 행은 "X% 미만" 구간으로 고정하되 입력 값에 따라 상위 구간의 하한이 자동 정렬된다.
  - 저장 시 최저점은 1점, 최고점은 15점 범위로 유지된다.
- 그 외 발주처/금액 구간은 계산식 기반이라 등급표 편집 UI는 비활성화되고 안내 팝업만 표시된다.

## UI 동작 요약
- `PerformanceModal` 컴포넌트는 `mode`와 `editable` 플래그를 입력으로 받아서 분기한다.
  - `mode === 'ratio-bands'` + `editable === true` → 등급표 편집 UI 렌더링.
  - `mode === 'ratio-bands'` + `editable === false` → "계산식 기반이라 UI에서 수정 불가" 안내 팝업 표시.
  - `mode !== 'ratio-bands'` → 기존 안내 팝업 유지.
- `SettingsPage`에서 `editable` 값은 현재 선택된 발주처/금액이 행안부 30억 미만 또는 30억~50억인지에 따라 결정한다.

## 향후 계산식 편집 지원 시
- 계산식 구간(`mode === 'formula'`)을 지원하려면 별도 모달 컴포넌트를 추가하고 `PerformanceModal` 호출부에서 모드 값에 따라 해당 모달을 열도록 확장하면 된다.
- 계산식 모달을 구현하더라도 override 저장 경로(`formulasSaveOverrides`)와 평가 엔진이 동일한 데이터를 사용하므로, 현재 구조를 그대로 재활용 가능하다.

