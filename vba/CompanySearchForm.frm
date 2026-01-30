VERSION 5.00
Begin VB.UserForm CompanySearchForm 
   Caption         =   "Company Search"
   ClientHeight    =   3915
   ClientLeft      =   120
   ClientTop       =   450
   ClientWidth     =   5805
   StartUpPosition =   1  'CenterOwner
   Begin VB.TextBox txtQuery 
      Height          =   315
      Left            =   120
      TabIndex        =   0
      Top             =   120
      Width           =   3495
   End
   Begin VB.CommandButton btnSearch 
      Caption         =   "Search"
      Height          =   315
      Left            =   3720
      TabIndex        =   1
      Top             =   120
      Width           =   855
   End
   Begin VB.CommandButton btnApply 
      Caption         =   "Apply"
      Height          =   315
      Left            =   3720
      TabIndex        =   3
      Top             =   3480
      Width           =   855
   End
   Begin VB.CommandButton btnClose 
      Caption         =   "Close"
      Height          =   315
      Left            =   4680
      TabIndex        =   4
      Top             =   3480
      Width           =   855
   End
   Begin VB.ListBox lstResults 
      Height          =   2745
      Left            =   120
      TabIndex        =   2
      Top             =   600
      Width           =   5655
   End
End
Attribute VB_Name = "CompanySearchForm"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False

Option Explicit

Private dbWb As Workbook

Private Sub UserForm_Initialize()
  On Error GoTo ErrHandler
  If gDbPath = "" Then
    MsgBox "DB path not set.", vbExclamation
    Unload Me
    Exit Sub
  End If
  Set dbWb = Workbooks.Open(gDbPath, ReadOnly:=True)
  lstResults.ColumnCount = 3
  lstResults.ColumnWidths = "220 pt;80 pt;120 pt"
  Exit Sub
ErrHandler:
  MsgBox "Failed to open DB: " & Err.Description, vbExclamation
  Unload Me
End Sub

Private Sub UserForm_Terminate()
  On Error Resume Next
  If Not dbWb Is Nothing Then dbWb.Close False
End Sub

Private Sub btnSearch_Click()
  Dim q As String
  q = Trim$(txtQuery.Text)
  If q = "" Then Exit Sub

  lstResults.Clear
  Dim results As Collection
  Set results = SearchCompaniesInWorkbook(dbWb, q)

  Dim i As Long
  For i = 1 To results.Count
    Dim item As Variant
    item = results(i)
    lstResults.AddItem item(0)
    lstResults.List(lstResults.ListCount - 1, 1) = item(1)
    lstResults.List(lstResults.ListCount - 1, 2) = item(2)
  Next i
End Sub

Private Sub btnApply_Click()
  If lstResults.ListIndex < 0 Then Exit Sub
  Dim nameText As String
  nameText = lstResults.List(lstResults.ListIndex, 0)
  If nameText <> "" Then
    ActiveCell.Value = nameText
  End If
  Unload Me
End Sub

Private Sub btnClose_Click()
  Unload Me
End Sub
