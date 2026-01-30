Option Explicit

Private gStep As String
Public gDbPath As String
Public gFileType As String

' 협정보드 MOIS 30억 미만 템플릿용 PoC 매크로
' - 로컬 업체 DB(시트=지역)에서 업체명 검색 후 값 채움
' - 경영점수는 formulas.defaults.json (행안부 30억 미만) 기준으로 계산

Private Const START_ROW As Long = 5
Private Const MAX_ROWS As Long = 68

Private NAME_COLS As Variant
Private SHARE_COLS As Variant
Private MGMT_COLS As Variant
Private PERF_COLS As Variant
Private ABILITY_COLS As Variant

Public Sub ApplyMoisUnder30()
  Dim dbPath As String
  gStep = "select-db"
  dbPath = GetDbPath()
  If dbPath = "" Then Exit Sub

  InitColumns

  Dim fileType As String
  gStep = "select-filetype"
  fileType = AskFileType()
  If fileType = "" Then Exit Sub

  Dim dbWb As Workbook
  On Error GoTo ErrHandler
  gStep = "open-db"
  Set dbWb = Workbooks.Open(dbPath, ReadOnly:=True)

  Dim ws As Worksheet
  gStep = "scan-target-sheet"
  Set ws = ActiveSheet

  Dim r As Long, slot As Long
  For r = START_ROW To (START_ROW + MAX_ROWS - 1)
    For slot = LBound(NAME_COLS) To UBound(NAME_COLS)
      Dim nameText As String
      nameText = Trim(CStr(ws.Range(NAME_COLS(slot) & r).Value))
      If nameText <> "" Then
        Dim data As Object
        gStep = "lookup-company"
        Set data = FindCompanyData(dbWb, nameText)
        If Not data Is Nothing Then
          Dim mgmtScore As Variant
          gStep = "compute-management"
          mgmtScore = ComputeManagementScore_MoisUnder30(data, fileType)
          If Not IsEmpty(mgmtScore) Then ws.Range(MGMT_COLS(slot) & r).Value = mgmtScore

          Dim perfAmount As Variant
          gStep = "read-performance"
          perfAmount = GetNumber(data, "5년 실적")
          If Not IsEmpty(perfAmount) Then ws.Range(PERF_COLS(slot) & r).Value = perfAmount

          ' 능력/기술자 점수는 원본 데이터에 없으면 비워둠
        End If
      End If
    Next slot
  Next r

  dbWb.Close False
  Exit Sub

ErrHandler:
  On Error Resume Next
  If Not dbWb Is Nothing Then dbWb.Close False
  MsgBox "Error " & Err.Number & ": " & Err.Description & vbCrLf & "Step: " & gStep, vbExclamation
End Sub

' 업체 검색 UI (UserForm)
Public Sub OpenCompanySearchUI()
  gDbPath = GetDbPath()
  If gDbPath = "" Then Exit Sub
  gFileType = AskFileType()
  If gFileType = "" Then Exit Sub
  CompanySearchForm.Show
End Sub

Private Sub InitColumns()
  NAME_COLS = Array("C", "D", "E", "F", "G")
  SHARE_COLS = Array("I", "J", "K", "L", "M")
  MGMT_COLS = Array("P", "Q", "R", "S", "T")
  PERF_COLS = Array("W", "X", "Y", "Z", "AA")
  ABILITY_COLS = Array("AO", "AP", "AQ", "AR", "AS")
End Sub

Private Function GetDbPath() As String
  Dim path As Variant
  path = Application.GetOpenFilename("Excel Files (*.xlsx), *.xlsx", , "업체 DB 파일 선택")
  If path = False Then
    GetDbPath = ""
  Else
    GetDbPath = CStr(path)
  End If
End Function

Private Function FindCompanyData(dbWb As Workbook, companyName As String) As Object
  Dim sheet As Worksheet
  For Each sheet In dbWb.Worksheets
    Dim headerRow As Long
    headerRow = FindHeaderRow(sheet)
    If headerRow = 0 Then GoTo NextSheet

    Dim lastCol As Long
    lastCol = sheet.Cells(headerRow, sheet.Columns.Count).End(xlToLeft).Column

    Dim c As Long
    For c = 2 To lastCol
      Dim rawName As String
      rawName = Trim(CStr(sheet.Cells(headerRow, c).Value))
      If rawName <> "" Then
        If IsNameMatch(rawName, companyName) Then
          Set FindCompanyData = BuildCompanyData(sheet, headerRow, c)
          Exit Function
        End If
      End If
    Next c
NextSheet:
  Next sheet

  Set FindCompanyData = Nothing
End Function

Private Function FindHeaderRow(ws As Worksheet) As Long
  Dim r As Long
  For r = 1 To ws.UsedRange.Rows.Count
    Dim v As String
    v = CStr(ws.Cells(r, 1).Value)
    If InStr(1, v, "회사명", vbTextCompare) > 0 Then
      FindHeaderRow = r
      Exit Function
    End If
  Next r
  FindHeaderRow = 0
End Function

Private Function BuildCompanyData(ws As Worksheet, headerRow As Long, companyCol As Long) As Object
  Dim data As Object
  Set data = CreateObject("Scripting.Dictionary")

  data("대표지역") = ws.Name

  Dim keys As Variant
  keys = Array( _
    Array("대표자", 1), _
    Array("사업자번호", 2), _
    Array("지역", 3), _
    Array("시평", 4), _
    Array("3년 실적", 5), _
    Array("5년 실적", 6), _
    Array("부채비율", 7), _
    Array("유동비율", 8), _
    Array("영업기간", 9), _
    Array("신용평가", 10), _
    Array("여성기업", 11), _
    Array("중소기업", 12), _
    Array("일자리창출", 13), _
    Array("품질평가", 14), _
    Array("비고", 15) _
  )

  Dim i As Long
  For i = LBound(keys) To UBound(keys)
    Dim keyName As String
    keyName = keys(i)(0)
    Dim offset As Long
    offset = keys(i)(1)
    Dim targetRow As Long
    targetRow = headerRow + offset
    Dim value As Variant
    value = ws.Cells(targetRow, companyCol).Value
    data(keyName) = value
  Next i

  Set BuildCompanyData = data
End Function

Private Function IsNameMatch(rawName As String, targetName As String) As Boolean
  Dim a As String, b As String
  a = NormalizeCompanyName(rawName)
  b = NormalizeCompanyName(targetName)
  If a = "" Or b = "" Then
    IsNameMatch = False
    Exit Function
  End If
  IsNameMatch = (a = b) Or (InStr(1, a, b, vbTextCompare) > 0) Or (InStr(1, b, a, vbTextCompare) > 0)
End Function

Private Function NormalizeCompanyName(value As String) As String
  Dim text As String
  text = Trim(value)
  If text = "" Then
    NormalizeCompanyName = ""
    Exit Function
  End If
  text = Split(text, vbLf)(0)
  text = Replace(text, "(주)", "")
  text = Replace(text, "㈜", "")
  text = Replace(text, "주식회사", "")
  text = Trim(text)

  Dim re As Object
  Set re = CreateObject("VBScript.RegExp")
  re.Pattern = "\s*[0-9.,%].*$"
  re.Global = False
  NormalizeCompanyName = Trim(re.Replace(text, ""))
End Function

Private Function GetNumber(data As Object, keyName As String) As Variant
  If data Is Nothing Then
    GetNumber = Empty
    Exit Function
  End If
  If Not data.Exists(keyName) Then
    GetNumber = Empty
    Exit Function
  End If
  Dim raw As String
  raw = CStr(data(keyName))
  raw = Replace(raw, ",", "")
  raw = Replace(raw, " ", "")
  If raw = "" Then
    GetNumber = Empty
  ElseIf IsNumeric(raw) Then
    GetNumber = CDbl(raw)
  Else
    GetNumber = Empty
  End If
End Function

Private Function ComputeManagementScore_MoisUnder30(data As Object, fileType As String) As Variant
  ' 행안부 30억 미만: composite(부채/유동) vs credit 중 높은 점수
  ' - 부채/유동은 산업평균(기본 100) 대비 비율로 평가
  Dim debtRatio As Variant
  debtRatio = GetNumber(data, "부채비율")
  Dim currentRatio As Variant
  currentRatio = GetNumber(data, "유동비율")

  Dim avgDebt As Double
  Dim avgCurrent As Double
  GetIndustryAverages fileType, avgDebt, avgCurrent

  Dim debtNorm As Double
  Dim currentNorm As Double
  debtNorm = IIf(IsEmpty(debtRatio) Or avgDebt = 0, 0, CDbl(debtRatio) / avgDebt)
  currentNorm = IIf(IsEmpty(currentRatio) Or avgCurrent = 0, 0, CDbl(currentRatio) / avgCurrent)

  Dim debtScore As Variant
  debtScore = ScoreDebtRatio_MoisUnder30(debtNorm)
  Dim currentScore As Variant
  currentScore = ScoreCurrentRatio_MoisUnder30(currentNorm)
  Dim composite As Variant
  composite = Nz(debtScore) + Nz(currentScore)

  Dim creditGrade As String
  creditGrade = UCase$(Trim(CStr(GetValue(data, "신용평가"))))
  Dim creditScore As Variant
  creditScore = ScoreByCreditGrade_MoisUnder30(creditGrade)

  Dim best As Variant
  If Not IsEmpty(creditScore) And creditScore > composite Then
    best = creditScore
  Else
    best = composite
  End If

  ComputeManagementScore_MoisUnder30 = TruncateScore(best, 2, 15)
End Function

Private Function ScoreByCreditGrade_MoisUnder30(grade As String) As Variant
  Select Case grade
    Case "AAA", "AA+", "AA0", "AA-", "A+", "A0", "A-", "BBB+", "BBB0", "BBB-", "BB+", "BB0"
      ScoreByCreditGrade_MoisUnder30 = 15
    Case "BB-"
      ScoreByCreditGrade_MoisUnder30 = 14
    Case "B+", "B0", "B-"
      ScoreByCreditGrade_MoisUnder30 = 13
    Case "CCC+", "CCC0", "CCC-", "CC", "C", "D"
      ScoreByCreditGrade_MoisUnder30 = 10
    Case Else
      ScoreByCreditGrade_MoisUnder30 = Empty
  End Select
End Function

Private Function ScoreDebtRatio_MoisUnder30(ratio As Double) As Variant
  If ratio < 0.5 Then ScoreDebtRatio_MoisUnder30 = 8#
  If ratio >= 0.5 And ratio < 0.75 Then ScoreDebtRatio_MoisUnder30 = 7.2
  If ratio >= 0.75 And ratio < 1# Then ScoreDebtRatio_MoisUnder30 = 6.4
  If ratio >= 1# And ratio < 1.25 Then ScoreDebtRatio_MoisUnder30 = 5.6
  If ratio >= 1.25 Then ScoreDebtRatio_MoisUnder30 = 4.8
End Function

Private Function ScoreCurrentRatio_MoisUnder30(ratio As Double) As Variant
  If ratio >= 1.5 Then ScoreCurrentRatio_MoisUnder30 = 7#
  If ratio >= 1.2 And ratio < 1.5 Then ScoreCurrentRatio_MoisUnder30 = 6.3
  If ratio >= 1# And ratio < 1.2 Then ScoreCurrentRatio_MoisUnder30 = 5.6
  If ratio >= 0.7 And ratio < 1# Then ScoreCurrentRatio_MoisUnder30 = 4.9
  If ratio < 0.7 Then ScoreCurrentRatio_MoisUnder30 = 4.2
End Function

Private Function TruncateScore(value As Variant, digits As Long, maxScore As Double) As Variant
  If IsEmpty(value) Then
    TruncateScore = Empty
    Exit Function
  End If
  Dim n As Double
  n = CDbl(value)
  If n < 0 Then n = 0
  If n > maxScore Then n = maxScore
  Dim factor As Double
  factor = 10 ^ digits
  TruncateScore = Fix(n * factor) / factor
End Function

Private Function AskFileType() As String
  Dim inputVal As String
  inputVal = InputBox("Enter file type: 전기 / 통신 / 소방", "File Type", "전기")
  inputVal = Trim(inputVal)
  If inputVal = "" Then
    AskFileType = ""
    Exit Function
  End If
  Select Case inputVal
    Case "전기", "eung"
      AskFileType = "eung"
    Case "통신", "tongsin"
      AskFileType = "tongsin"
    Case "소방", "sobang"
      AskFileType = "sobang"
    Case Else
      MsgBox "Invalid file type. Use 전기/통신/소방.", vbExclamation
      AskFileType = ""
  End Select
End Function

Private Sub GetIndustryAverages(fileType As String, ByRef debtAvg As Double, ByRef currentAvg As Double)
  Select Case LCase$(fileType)
    Case "eung"
      debtAvg = 124.41
      currentAvg = 142.58
    Case "tongsin"
      debtAvg = 124.03
      currentAvg = 140.06
    Case "sobang"
      debtAvg = 110.08
      currentAvg = 139.32
    Case Else
      debtAvg = 100#
      currentAvg = 100#
  End Select
End Sub

Public Function SearchCompaniesInWorkbook(dbWb As Workbook, query As String, Optional maxResults As Long = 200) As Collection
  Dim results As New Collection
  Dim q As String
  q = NormalizeCompanyName(query)
  If q = "" Then
    Set SearchCompaniesInWorkbook = results
    Exit Function
  End If

  Dim sheet As Worksheet
  For Each sheet In dbWb.Worksheets
    Dim headerRow As Long
    headerRow = FindHeaderRow(sheet)
    If headerRow = 0 Then GoTo NextSheet

    Dim lastCol As Long
    lastCol = sheet.Cells(headerRow, sheet.Columns.Count).End(xlToLeft).Column

    Dim c As Long
    For c = 2 To lastCol
      Dim rawName As String
      rawName = Trim(CStr(sheet.Cells(headerRow, c).Value))
      If rawName <> "" Then
        Dim normName As String
        normName = NormalizeCompanyName(rawName)
        If normName <> "" Then
          If InStr(1, normName, q, vbTextCompare) > 0 Or InStr(1, q, normName, vbTextCompare) > 0 Then
            Dim data As Object
            Set data = BuildCompanyData(sheet, headerRow, c)
            Dim item(0 To 2) As String
            item(0) = normName
            item(1) = CStr(data("대표지역"))
            item(2) = CStr(data("사업자번호"))
            results.Add item
            If results.Count >= maxResults Then
              Set SearchCompaniesInWorkbook = results
              Exit Function
            End If
          End If
        End If
      End If
    Next c
NextSheet:
  Next sheet

  Set SearchCompaniesInWorkbook = results
End Function

Private Function Nz(value As Variant) As Double
  If IsEmpty(value) Then
    Nz = 0
  Else
    Nz = CDbl(value)
  End If
End Function

Private Function GetValue(data As Object, keyName As String) As Variant
  If data Is Nothing Then
    GetValue = Empty
    Exit Function
  End If
  If Not data.Exists(keyName) Then
    GetValue = Empty
    Exit Function
  End If
  GetValue = data(keyName)
End Function
