Option Explicit

'============================
' Windows API 선언 (중복 제거 및 정리)
'============================
#If VBA7 Then
    ' 창 검색 관련
    Public Declare PtrSafe Function FindWindow Lib "user32.dll" Alias "FindWindowA" _
                                                            (ByVal lpClassName As String, _
                                                            ByVal lpWindowName As String) As Long
    
    Public Declare PtrSafe Function FindWindowEx Lib "user32.dll" Alias "FindWindowExA" _
                                                                (ByVal hwndParent As Long, _
                                                                ByVal hwndChildAfter As Long, _
                                                                ByVal lpszClass As String, _
                                                                ByVal lpszWindow As String) As Long
                                                                
    Public Declare PtrSafe Function IsWindow Lib "user32" (ByVal hwnd As LongPtr) As Long

    Public Declare PtrSafe Function ShowWindow Lib "user32" (ByVal hwnd As LongPtr, _
                                                            ByVal nCmdShow As Long) As Long
                                                            
    ' 창 열거 관련
    Public Declare PtrSafe Function EnumWindows Lib "user32" _
                                                            (ByVal lpEnumFunc As LongPtr, _
                                                            ByVal lParam As LongPtr) As Long
    
    ' 창 정보 가져오기
    Public Declare PtrSafe Function GetWindow Lib "user32" _
                                                            (ByVal hwnd As Long, _
                                                            ByVal wCmd As Long) As Long
    
    Public Declare PtrSafe Function GetParent Lib "user32" _
                                                            (ByVal hwnd As Long) As Long
    
    Public Declare PtrSafe Function GetClassName Lib "user32" Alias "GetClassNameA" _
                                                                (ByVal hwnd As Long, _
                                                                ByVal lpClassName As String, _
                                                                ByVal nMaxCount As Long) As Long
    
    Public Declare PtrSafe Function GetWindowText Lib "user32" Alias "GetWindowTextA" _
                                                                (ByVal hwnd As Long, _
                                                                ByVal lpString As String, _
                                                                ByVal cch As Long) As Long
    
    Public Declare PtrSafe Function GetWindowTextLength Lib "user32" Alias "GetWindowTextLengthA" _
                                                                    (ByVal hwnd As LongPtr) As Long
    
    Public Declare PtrSafe Function IsWindowVisible Lib "user32" _
                                                                (ByVal hwnd As LongPtr) As Long
    
    Public Declare PtrSafe Function GetWindowThreadProcessId Lib "user32" _
                                                                    (ByVal hwnd As LongPtr, _
                                                                    lpdwProcessId As Long) As Long
    
    ' 메시지 전송
    Public Declare PtrSafe Function SendMessage Lib "user32" Alias "SendMessageA" _
                                                                (ByVal hwnd As Long, _
                                                                ByVal wMsg As Long, _
                                                                ByVal wParam As Long, _
                                                                ByRef lParam As Any) As Long
    
    Public Declare PtrSafe Function PostMessage Lib "user32" Alias "PostMessageA" _
                                                                (ByVal hwnd As Long, _
                                                                ByVal wMsg As Long, _
                                                                ByVal wParam As Long, _
                                                                ByRef lParam As Any) As Long
    
    ' 키보드 관련
    Public Declare PtrSafe Sub keybd_event Lib "user32.dll" _
                                                                (ByVal bVk As Byte, _
                                                                ByVal bScan As Byte, _
                                                                ByVal dwFlags As Long, _
                                                                ByVal dwExtraInfo As Long)
    
    Public Declare PtrSafe Function GetKeyState Lib "user32" _
                                                                (ByVal nVirtKey As Long) As Long
    Public Declare PtrSafe Function SendInput Lib "user32" _
                                                                (ByVal nInputs As Long, pInputs As INPUT_TYPE, ByVal cbSize As Long) As Long
    
    ' 창 활성화 관련
    Public Declare PtrSafe Function apiSetActiveWindow Lib "user32" Alias "SetActiveWindow" _
                                                                    (ByVal hwnd As Long) As Long
    
    Public Declare PtrSafe Function apiSetFocus Lib "user32" Alias "SetFocus" _
                                                                (ByVal hwnd As Long) As Long
    
    Public Declare PtrSafe Function SetForegroundWindow Lib "user32.dll" _
                                                                    (ByVal hwnd As Long) As Long
    
    Public Declare PtrSafe Function SetWindowText Lib "user32" Alias "SetWindowTextA" _
                                                                (ByVal hwnd As LongPtr, _
                                                                ByVal lpString As String) As Long
    
    ' 기타 유틸리티
    Public Declare PtrSafe Sub Sleep Lib "kernel32" (ByVal dwMilliseconds As LongPtr)
    
    ' 클립보드 관련
    Public Declare PtrSafe Function OpenClipboard Lib "user32" (ByVal hwnd As LongPtr) As Long
    Public Declare PtrSafe Function EmptyClipboard Lib "user32" () As Long
    Public Declare PtrSafe Function CloseClipboard Lib "user32" () As Long
    Public Declare PtrSafe Function SetClipboardData Lib "user32" _
                                                                (ByVal wFormat As Long, _
                                                                ByVal hMem As LongPtr) As LongPtr
    
    ' 메모리 관련
    Public Declare PtrSafe Function GlobalAlloc Lib "kernel32" _
                                                            (ByVal wFlags As Long, _
                                                            ByVal dwBytes As Long) As LongPtr
    
    Public Declare PtrSafe Function GlobalLock Lib "kernel32" (ByVal hMem As LongPtr) As LongPtr
    Public Declare PtrSafe Function GlobalUnlock Lib "kernel32" (ByVal hMem As LongPtr) As Long
    Public Declare PtrSafe Function lstrcpy Lib "kernel32" Alias "lstrcpyA" _
                                                            (ByVal lpString1 As LongPtr, _
                                                            ByVal lpString2 As String) As LongPtr
    
    ' 이미지 관련
    Public Declare PtrSafe Function LoadImage Lib "user32" Alias "LoadImageA" _
                                                            (ByVal hInstance As LongPtr, _
                                                            ByVal lpszName As String, _
                                                            ByVal uType As Long, _
                                                            ByVal cxDesired As Long, _
                                                            ByVal cyDesired As Long, _
                                                            ByVal fuLoad As Long) As LongPtr

#Else  ' 32비트 버전
    ' 창 검색 관련
    Public Declare Function FindWindow Lib "user32.dll" Alias "FindWindowA" _
                                                            (ByVal lpClassName As String, _
                                                            ByVal lpWindowName As String) As Long
    
    Public Declare Function FindWindowEx Lib "user32.dll" Alias "FindWindowExA" _
                                                                (ByVal hwndParent As Long, _
                                                                ByVal hwndChildAfter As Long, _
                                                                ByVal lpszClass As String, _
                                                                ByVal lpszWindow As String) As Long
                                                                
    public Declare Function IsWindow Lib "user32" (ByVal hwnd As Long) As Long
    
    Public Declare Function ShowWindow Lib "user32" (ByVal hwnd As LongPtr, _
                                                            ByVal nCmdShow As Long) As Long
    
    ' 창 열거 관련
    Public Declare Function EnumWindows Lib "user32" _
                                                            (ByVal lpEnumFunc As Long, _
                                                            ByVal lParam As Long) As Long
    
    ' 창 정보 가져오기
    Public Declare Function GetWindow Lib "user32" _
                                                            (ByVal hwnd As Long, _
                                                            ByVal wCmd As Long) As Long
    
    Public Declare Function GetParent Lib "user32" _
                                                            (ByVal hwnd As Long) As Long
    
    Public Declare Function GetClassName Lib "user32" Alias "GetClassNameA" _
                                                                (ByVal hwnd As Long, _
                                                                ByVal lpClassName As String, _
                                                                ByVal nMaxCount As Long) As Long
    
    Public Declare Function GetWindowText Lib "user32" Alias "GetWindowTextA" _
                                                                (ByVal hwnd As Long, _
                                                                ByVal lpString As String, _
                                                                ByVal cch As Long) As Long
    
    Public Declare Function GetWindowTextLength Lib "user32" Alias "GetWindowTextLengthA" _
                                                                    (ByVal hwnd As Long) As Long
    
    Public Declare Function IsWindowVisible Lib "user32" _
                                                                (ByVal hwnd As Long) As Long
    
    Public Declare Function GetWindowThreadProcessId Lib "user32" _
                                                                    (ByVal hwnd As Long, _
                                                                    lpdwProcessId As Long) As Long
    
    ' 메시지 전송
    Public Declare Function SendMessage Lib "user32" Alias "SendMessageA" _
                                                                (ByVal hwnd As Long, _
                                                                ByVal wMsg As Long, _
                                                                ByVal wParam As Long, _
                                                                ByRef lParam As Any) As Long
    
    Public Declare Function PostMessage Lib "user32" Alias "PostMessageA" _
                                                                (ByVal hwnd As Long, _
                                                                ByVal wMsg As Long, _
                                                                ByVal wParam As Long, _
                                                                ByRef lParam As Any) As Long
    
    ' 키보드 관련
    Public Declare Sub keybd_event Lib "user32.dll" _
                                                                (ByVal bVk As Byte, _
                                                                ByVal bScan As Byte, _
                                                                ByVal dwFlags As Long, _
                                                                ByVal dwExtraInfo As Long)
    
    Public Declare Function GetKeyState Lib "user32" _
                                                                (ByVal nVirtKey As Long) As Long
    Public Declare Function SendInput Lib "user32" _
                                                                (ByVal nInputs As Long, pInputs As INPUT_TYPE, ByVal cbSize As Long) As Long
    
    ' 창 활성화 관련
    Public Declare Function apiSetActiveWindow Lib "user32" Alias "SetActiveWindow" _
                                                                    (ByVal hwnd As Long) As Long
    
    Public Declare Function apiSetFocus Lib "user32" Alias "SetFocus" _
                                                                (ByVal hwnd As Long) As Long
    
    Public Declare Function SetForegroundWindow Lib "user32.dll" _
                                                                    (ByVal hwnd As Long) As Long
    
    Public Declare Function SetWindowText Lib "user32" Alias "SetWindowTextA" _
                                                                (ByVal hwnd As Long, _
                                                                ByVal lpString As String) As Long
    
    ' 기타 유틸리티
    Public Declare Sub Sleep Lib "kernel32" (ByVal dwMilliseconds As Long)
    
    ' 클립보드 관련
    Public Declare Function OpenClipboard Lib "user32" (ByVal hwnd As Long) As Long
    Public Declare Function EmptyClipboard Lib "user32" () As Long
    Public Declare Function CloseClipboard Lib "user32" () As Long
    Public Declare Function SetClipboardData Lib "user32" _
                                                                (ByVal wFormat As Long, _
                                                                ByVal hMem As Long) As Long
    
    ' 메모리 관련
    Public Declare Function GlobalAlloc Lib "kernel32" _
                                                            (ByVal wFlags As Long, _
                                                            ByVal dwBytes As Long) As Long
    
    Public Declare Function GlobalLock Lib "kernel32" (ByVal hMem As Long) As Long
    Public Declare Function GlobalUnlock Lib "kernel32" (ByVal hMem As Long) As Long
    Public Declare Function lstrcpy Lib "kernel32" Alias "lstrcpyA" _
                                                            (ByVal lpString1 As Long, _
                                                            ByVal lpString2 As String) As Long
    
    ' 이미지 관련
    Public Declare Function LoadImage Lib "user32" Alias "LoadImageA" _
                                                            (ByVal hInstance As Long, _
                                                            ByVal lpszName As String, _
                                                            ByVal uType As Long, _
                                                            ByVal cxDesired As Long, _
                                                            ByVal cyDesired As Long, _
                                                            ByVal fuLoad As Long) As Long
#End If

'============================
' 윈도우 메시지 상수
'============================
Public Const WM_SETTEXT = &HC
Public Const WM_GETTEXT = &HD
Public Const WM_GETTEXTLENGTH = &HE
Public Const WM_KEYDOWN = &H100
Public Const WM_KEYUP = &H101
Public Const WM_CHAR = &H102
Public Const WM_COMMAND = &H111
Public Const WM_LBUTTONDOWN = &H201
Public Const WM_LBUTTONUP = &H202
Public Const WM_PASTE = &H302
Public Const WM_CLOSE = &H10
Public Const WM_DESTROY = &H2
Public Const WM_QUIT = &H12

'============================
' 가상 키 코드 (Virtual Key Codes)
'============================
' 제어 키
Public Const VK_BACK = &H8          ' Backspace
Public Const VK_TAB = &H9           ' Tab
Public Const VK_RETURN = &HD        ' Enter
Public Const VK_SHIFT = &H10        ' Shift (일반)
Public Const VK_LSHIFT = &HA0       ' Left Shift
Public Const VK_RSHIFT = &HA1       ' Right Shift
Public Const VK_CONTROL = &H11      ' Ctrl
Public Const VK_MENU = &H12         ' Alt
Public Const VK_ESCAPE = &H1B       ' Esc
Public Const VK_ESC = &H1B          ' Esc (별칭)
Public Const VK_SPACE = &H20        ' Space
Public Const VK_DELETE = &H2E       ' Delete

' 방향 키
Public Const VK_LEFT = &H25         ' 왼쪽 화살표
Public Const VK_UP = &H26           ' 위쪽 화살표
Public Const VK_RIGHT = &H27        ' 오른쪽 화살표
Public Const VK_DOWN = &H28         ' 아래쪽 화살표

' 알파벳 키 (A-Z)
Public Const VK_A = &H41
Public Const VK_B = &H42
Public Const VK_C = &H43
Public Const VK_D = &H44
Public Const VK_E = &H45
Public Const VK_F = &H46
Public Const VK_G = &H47
Public Const VK_H = &H48
Public Const VK_I = &H49
Public Const VK_J = &H4A
Public Const VK_K = &H4B
Public Const VK_L = &H4C
Public Const VK_M = &H4D
Public Const VK_N = &H4E
Public Const VK_O = &H4F
Public Const VK_P = &H50
Public Const VK_Q = &H51
Public Const VK_R = &H52
Public Const VK_S = &H53
Public Const VK_T = &H54
Public Const VK_U = &H55
Public Const VK_V = &H56
Public Const VK_W = &H57
Public Const VK_X = &H58
Public Const VK_Y = &H59
Public Const VK_Z = &H5A

' 숫자 키 (0-9)
Public Const VK_0 = &H30
Public Const VK_1 = &H31
Public Const VK_2 = &H32
Public Const VK_3 = &H33
Public Const VK_4 = &H34
Public Const VK_5 = &H35
Public Const VK_6 = &H36
Public Const VK_7 = &H37
Public Const VK_8 = &H38
Public Const VK_9 = &H39

' 펑션 키 (F1-F12)
Public Const VK_F1 = &H70
Public Const VK_F2 = &H71
Public Const VK_F3 = &H72
Public Const VK_F4 = &H73
Public Const VK_F5 = &H74
Public Const VK_F6 = &H75
Public Const VK_F7 = &H76
Public Const VK_F8 = &H77
Public Const VK_F9 = &H78
Public Const VK_F10 = &H79
Public Const VK_F11 = &H7A
Public Const VK_F12 = &H7B

'============================
' 키보드 이벤트 플래그
'============================
Public Const KEYEVENTF_KEYDOWN = 0
Public Const KEYEVENTF_KEYUP = &H2
Public Const KEYEVENTF_EXTENDEDKEY = &H1

'============================
' 클립보드 관련 상수
'============================
Public Const CF_TEXT = 1
Public Const CF_UNICODETEXT = 13

'============================
' 메모리 할당 플래그
'============================
Public Const GMEM_MOVEABLE = &H2
Public Const GMEM_ZEROINIT = &H40
Public Const GHND = &H42            ' GMEM_MOVEABLE + GMEM_ZEROINIT

'============================
' GetWindow 상수
'============================
Public Const GW_HWNDNEXT = 2
Public Const GW_CHILD = 5
Public Const GW_HWNDFIRST = 0
Public Const GW_HWNDLAST = 1
Public Const GW_HWNDPREV = 3
Public Const GW_OWNER = 4

'============================
' 프로그램 핸들 검색 전역 변수
'============================
Private gProgramList As Collection
Private gProgramCount As Long
Private gChildList As Collection
Private gLevel As Integer
Private gCount As Integer

'============================
' iDealy 전역 Property 변수 선언
'============================
Private m_iDelay As Long
Private m_Loaded As Boolean

'============================
' KEYBDINPUT 구조체 정의
'============================
Public Type KEYBDINPUT
    wVk As Integer
    wScan As Integer
    dwFlags As Long
    time As Long
    dwExtraInfo As LongPtr
End Type

Public Type INPUT_TYPE
    dwType As Long
    ki As KEYBDINPUT
    padding(0 To 7) As Byte  ' 64비트 호환용
End Type

Public Const INPUT_KEYBOARD = 1


' iDelay를 변수처럼 사용 (자동 로드)
Public Property Get iDelay() As Long
    If Not m_Loaded Then
        m_iDelay = shtSetting.Range("E2").Value
        m_Loaded = True
    End If
    iDelay = m_iDelay
End Property

Sub SetDelay(i)
Sleep i * iDelay
End Sub

'============================
' hwnd 컨트롤에 텍스트 입력
'============================
Sub SetText(hwnd, text As String)
Call SendMessage(hwnd, WM_SETTEXT, 0, ByVal text)
End Sub

Sub SetEnter(hwnd)
Call PostMessage(hwnd, WM_KEYDOWN, VK_RETURN, 0)
End Sub

Sub SetESC(hwnd)
Call PostMessage(hwnd, WM_KEYDOWN, VK_ESC, 0)
End Sub

'============================
' 텍스트 이름으로 창 검색
'============================
Function FindChildWindowByName(ByVal hwndParent As Long, ByVal strName As String) As Long
    Dim hwndChild As Long
    Dim strWindowName As String
    Dim lngLength As Long
    
    hwndChild = 0
    
    ' 모든 자식 창을 순회
    Do
        hwndChild = FindWindowEx(hwndParent, hwndChild, vbNullString, vbNullString)
        
        If hwndChild <> 0 Then
            ' 창 이름 가져오기
            lngLength = GetWindowTextLength(hwndChild)
            
            If lngLength > 0 Then
                strWindowName = Space(lngLength + 1)
                GetWindowText hwndChild, strWindowName, lngLength + 1
                strWindowName = Left(strWindowName, lngLength)
                
                ' 텍스트 포함 여부 확인 (대소문자 구분 안함)
                If InStr(1, strWindowName, strName, vbTextCompare) > 0 Then
                    FindChildWindowByName = hwndChild
                    Exit Function
                End If
            End If
        End If
    Loop While hwndChild <> 0
    
    FindChildWindowByName = 0
End Function

'============================
' 클립보드에 텍스트 설정
'============================
Sub SetClipboardText(ByVal text As String)
    Dim hGlobalMemory As LongPtr
    Dim lpGlobalMemory As LongPtr

    ' 메모리 할당 및 내용 복사
    hGlobalMemory = GlobalAlloc(GHND, LenB(text) + 1)
    lpGlobalMemory = GlobalLock(hGlobalMemory)
    lstrcpy lpGlobalMemory, text
    GlobalUnlock hGlobalMemory

    ' 클립보드 열기 및 데이터 설정
    OpenClipboard 0
    EmptyClipboard
    SetClipboardData CF_TEXT, hGlobalMemory
    CloseClipboard
End Sub

'============================
' Ctrl 키 눌림 여부 확인
'============================
Function IsCtrlKeyDown(Optional LeftRightKey As Long = 0) As Boolean

' LeftRightKey
' 1 : 왼쪽 Ctrl키 입력시 TRUE
' 2 : 오른쪽 Ctrl키 입력시 TRUE
' 3 : 양쪽 Ctrl키 동시 입력시 TRUE
' 0 : 둘 중 하나라도 입력시 TRUE

Const VK_LCTRL = &HA2
Const VK_RCTRL = &HA3
Const KEY_MASK As Integer = &HFF80

Dim Result As Long

Select Case LeftRightKey
    Case 1
        Result = GetKeyState(VK_LCTRL) And KEY_MASK
    Case 2
        Result = GetKeyState(VK_RCTRL) And KEY_MASK
    Case 3
        Result = (GetKeyState(VK_LCTRL) And GetKeyState(VK_RCTRL) And KEY_MASK)
    Case Else
        Result = GetKeyState(vbKeyControl) And KEY_MASK
End Select

IsCtrlKeyDown = CBool(Result)

End Function

'===========================
'카톡 업데이트 이후 오픈 채팅으로 이동
'===========================
Sub SendCtrlRight(hwnd)
    ' 창 활성화 및 딜레이적용
    SetForegroundWindow hwnd
    DoEvents
    Sleep 10 * 30
    
    ' 키 입력 및 올리기
    keybd_event VK_CONTROL, 0, 0, 0
    keybd_event VK_RIGHT, 0, 0, 0
    keybd_event VK_RIGHT, 0, KEYEVENTF_KEYUP, 0
    keybd_event VK_CONTROL, 0, KEYEVENTF_KEYUP, 0
End Sub

'===========================
'카톡 업데이트 이후 일반 채팅으로 이동
'===========================
Sub SendCtrlLeft(hwnd)
    ' 창 활성화 및 딜레이적용
    SetForegroundWindow hwnd
    DoEvents
    Sleep 10 * 30
    
    ' 키 입력 및 올리기
    keybd_event VK_CONTROL, 0, 0, 0
    keybd_event VK_LEFT, 0, 0, 0
    keybd_event VK_LEFT, 0, KEYEVENTF_KEYUP, 0
    keybd_event VK_CONTROL, 0, KEYEVENTF_KEYUP, 0
End Sub

'===========================
' 카카오톡 메인창 실행여부 확인 후, 실행중일 시 메인창의 hWnd 반환
'===========================
Function FindHwndEVA() As Long

Dim hwnd As Long
Dim lngT As Long: Dim strT As String

' 실행중인 윈도우 모든 창 돌아가며 확인
hwnd = FindWindowEx(0, 0, vbNullString, vbNullString)

While hwnd <> 0
    strT = String(100, Chr(0))
    lngT = GetClassName(hwnd, strT, 100)
    If InStr(1, Left(strT, lngT), "EVA_Window_Dblclk") > 0 Then
        strT = String(100, Chr(0))
        lngT = GetWindowText(hwnd, strT, 100)
        If InStr(1, Left(strT, lngT), "카카오톡") > 0 Or InStr(1, Left(strT, lngT), "KakaoTalk") > 0 Then FindHwndEVA = hwnd: Exit Function
    End If
'다음 윈도우로 넘어감
hwnd = FindWindowEx(0, hwnd, vbNullString, vbNullString)
Wend

End Function


Sub ActiveChat(Target As String, ChatType As Integer)
'chatType = 0 : 사용자
'chatType = 1 : 채팅
'chatType = 2 : 오픈채팅

If ChatType = 0 Then
    ActiveUserChat Target
ElseIf ChatType = 1 Then
    ActiveGroupChat Target, False
Else
    ActiveGroupChat Target, True
End If

End Sub

'===========================
'사용자 채팅방 열기
'===========================
Sub ActiveUserChat(Target As String)

Dim hwndMain As Long
Dim hwndOnline As Long
Dim hwndListView As Long
Dim hwndEdit As Long

hwndMain = FindHwndEVA
hwndOnline = FindChildWindowByName(hwndMain, "OnlineMainView")
hwndListView = FindChildWindowByName(hwndOnline, "ContactListView")
hwndEdit = FindWindowEx(hwndListView, 0, "Edit", vbNullString)

SetDelay 10
SetText hwndEdit, Target
SetDelay 50
SetEnter hwndEdit
SetDelay 10
SetText hwndEdit, ""

End Sub

'===========================
'오픈 채팅방 열기
'===========================
Sub ActiveGroupChat(Target As String, isOpenChat As Boolean)

Dim hwndMain As Long
Dim hwndOnline As Long
Dim hwndListView As Long
Dim hwndEdit As Long

hwndMain = FindHwndEVA
hwndOnline = FindChildWindowByName(hwndMain, "OnlineMainView")
hwndListView = FindChildWindowByName(hwndOnline, "ChatRoomListView")
hwndEdit = FindWindowEx(hwndListView, 0, "Edit", vbNullString)

If isOpenChat = True Then SendCtrlRight hwndEdit Else SendCtrlLeft hwndEdit

SetDelay 10
SetText hwndEdit, Target
SetDelay 50
SetEnter hwndEdit
SetDelay 10
SetText hwndEdit, ""

End Sub

Function SendKakao(Target As String, sMsg As String, sImgTxt As String, _
                    Optional SendAsImage As Long = 0, Optional iDelay As Long = 30, _
                    Optional OpenInAdvance As Boolean = True, Optional ChatType As Integer = 1) As Boolean

' hwnd_KakaoTalk    : 카톡 채팅방 hwnd
' hwnd_RichEdit     : 채팅방 입력창 hwnd
' Message, SendTo   : 보낼 메세지, 받을 사람 스트링

Dim hwnd_KakaoTalk As Long: Dim hwnd_RichEdit As Long: Dim hWnd_Next As Long
Dim hwnd_FilePath As Long: Dim sTime As String: Dim sPath As String
Dim hwnd_Edit As Long
    
Dim cAttempts As Integer
Dim cSuccess As Boolean

Dim Message As String: Dim SendTo As String
Dim dStart As Date: Dim i As Long

If SendAsImage <> 1 Then
    If sMsg = "" Then
        SendKakao = False
        Exit Function
    End If
    Message = sMsg
End If

'채팅 우선 실행 아닐 경우, 채팅창 실행 및 딜레이 적용
cAttempts = 0
cSuccess = False
Do While Not cSuccess And cAttempts < 3 And Not OpenInAdvance
    cAttempts = cAttempts + 1
        
    ActiveChat Target, ChatType
    SetDelay 5
    hwnd_KakaoTalk = FindWindow(vbNullString, Target)

    ' 복사 성공 여부 확인 및 재시도
    If hwnd_KakaoTalk > 0 Then
        cSuccess = True
    Else
        If cAttempts < 3 Then SetDelay 10
    End If
Loop
        
'실행한 채팅창 검색
dStart = Now
While hwnd_KakaoTalk = 0
    hwnd_KakaoTalk = FindWindow(vbNullString, Target)
    ' 창 못찾을 경우 False 반환하고 함수 종료
    If DateDiff("s", dStart, Now) > 5 Then SendKakao = False: Exit Function
Wend
dStart = Now
While hwnd_RichEdit = 0
    hwnd_RichEdit = FindWindowEx(hwnd_KakaoTalk, 0, "RichEdit50W", vbNullString)
    hwnd_Edit = FindWindowEx(hwnd_KakaoTalk, 0, "Edit", vbNullString)
    If DateDiff("s", dStart, Now) > 5 Then SendKakao = False: Exit Function
Wend

' 문자로 보낼 경우
If SendAsImage > 0 Then
    SendKakao = SendKakaoImage(hwnd_KakaoTalk, hwnd_RichEdit, sImgTxt, hwnd_Edit)
End If

If SendAsImage <> 1 Then
    SendKakao = SendKakaoMsg(hwnd_KakaoTalk, hwnd_RichEdit, Message)
End If

SetDelay 10
SetESC hwnd_KakaoTalk

End Function

Function SendKakaoMsg(hwnd_KakaoTalk, hwnd_RichEdit, Message As String) As Boolean

Dim hWnd_Next As Long

   ' 채팅창 Edit 윈도우 호출 후 포커싱
    hWnd_Next = GetWindow(hwnd_RichEdit, 2)
    SetForegroundWindow hwnd_KakaoTalk
    SetDelay 5
    apiSetFocus hwnd_RichEdit
    SetDelay 5
    
    ' 사용자 Ctrl 키 입력여부 확인 후 강제 키업
    If IsCtrlKeyDown = True Then keybd_event VK_CONTROL, 0, KEYEVENTF_KEYUP, 0
    
    ' 메시지 입력
    SetText hwnd_RichEdit, ""
    SetDelay 5
    keybd_event VK_SHIFT, 0, 0, 0
    keybd_event VK_RETURN, 0, 0, 0
    
    SetDelay 5
    keybd_event VK_SHIFT, 0, KEYEVENTF_KEYUP, 0
    keybd_event VK_RETURN, 0, KEYEVENTF_KEYUP, 0
    SetDelay 5

    keybd_event VK_BACK, 0, 0, 0
    SetDelay 5
    keybd_event VK_BACK, 0, KEYEVENTF_KEYUP, 0
    
    '클립보드 PASTE OR SET_TEXT
    SetWindowText hwnd_RichEdit, ""
    SetDelay 5
    SetText hwnd_RichEdit, Message
    SetDelay 5
    
    SetClipboardText ""
    SetDelay 5
    SendMessage hwnd_RichEdit, WM_PASTE, 0, ByVal 0&
    SetDelay 5
    
    '문자 발송
    SetEnter hwnd_KakaoTalk
    
    SendKakaoMsg = True
    
End Function

Function SendKakaoImage(hwnd_KakaoTalk, hwnd_RichEdit, sImgTxt, hwnd_Edit) As Boolean

Dim cAttempts As Integer
Dim cSuccess As Boolean

Dim shp As Shape: Dim tshp As Shape
Dim hWnd_Next As Long

Dim inputEvents(0 To 3) As INPUT_TYPE

cAttempts = 0
cSuccess = False

'이미지로 보낼 경우
Do While Not cSuccess And cAttempts < 3
    cAttempts = cAttempts + 1
    On Error Resume Next
    
    '복사 시도 (M365 클립보드 오류)
    Set tshp = shtSetting.Shapes("텍스트")
    If Not tshp Is Nothing Then
        tshp.TextFrame2.TextRange.text = sImgTxt
    Else
        SendKakaoImage = False
        Exit Function
    End If
    
    SetDelay 20
    DoEvents
    Application.ScreenUpdating = True
    
    Set shp = shtSetting.Shapes("이미지")
    If Not shp Is Nothing Then
        shp.Copy
    Else
        SendKakaoImage = False
        Exit Function
    End If
    
    ' 복사 성공 여부 확인 및 재시도
    If Err.Number = 0 Then
        cSuccess = True
    Else
        Err.Clear
        If cAttempts < 3 Then SetDelay 10
    End If

    On Error GoTo 0
Loop

' 채팅창 Edit 윈도우 호출, 메세지 입력
hWnd_Next = GetWindow(hwnd_RichEdit, 2)

'채팅창 Set Focus
SetForegroundWindow hwnd_KakaoTalk
SetDelay 5
apiSetFocus hwnd_RichEdit
SetDelay 5

'빈 메시지 임시 입력
SetText hwnd_RichEdit, ""

'이미지 입력을 위한 inputEvent 컨트롤 _4.2 수정
' Ctrl 누름
inputEvents(0).dwType = INPUT_KEYBOARD
inputEvents(0).ki.wVk = VK_CONTROL
inputEvents(0).ki.dwFlags = 0

' V 누름
inputEvents(1).dwType = INPUT_KEYBOARD
inputEvents(1).ki.wVk = VK_V
inputEvents(1).ki.dwFlags = 0

' V 뗌
inputEvents(2).dwType = INPUT_KEYBOARD
inputEvents(2).ki.wVk = VK_V
inputEvents(2).ki.dwFlags = KEYEVENTF_KEYUP

' Ctrl 뗌
inputEvents(3).dwType = INPUT_KEYBOARD
inputEvents(3).ki.wVk = VK_CONTROL
inputEvents(3).ki.dwFlags = KEYEVENTF_KEYUP

SendInput 4, inputEvents(0), LenB(inputEvents(0))

'이미지 발송
SetDelay 5
keybd_event VK_RETURN, 0, 0, 0
SetDelay 10
keybd_event VK_RETURN, 0, KEYEVENTF_KEYUP, 0
SetDelay 15

SendKakaoImage = True

End Function


