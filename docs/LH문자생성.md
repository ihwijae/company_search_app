 generateAgreementMessages()에서 행 스캔할 때 currentRow = 5부터 시작하고, 행안부·조달청·국철·한국도로공사 등 일반 발주처는 A열 체크 셀
  이 비면 break로 즉시 멈춥니다. 하지만 LH는 isLhOwner가 true면 maxConsecutiveEmptyRows = 2로 설정되어 있어 빈 줄을 최대 두 번까지 허용합니
  다. 빈 줄을 만나면 consecutiveEmptyRows를 1 증가시키고 행만 내려가며 계속 확인하다가, 연속 두 번 비어 있으면 그때 break가 걸립니다 (src/
  view/features/excel-helper/pages/ExcelHelperPage.jsx:1362-1437). 그래서 LH만 “한 칸 더 내려가서 확인”하는 특별 규칙이 적용된 상태입니다.

  ## 즉 LH는 품질점수 표시 칸 떄문에 한칸더 내려가서 확인함 이렇게 해야 문제없이 전부 문자생성이 가능하다.