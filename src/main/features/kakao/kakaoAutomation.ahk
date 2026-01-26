#Requires AutoHotkey v2.0
#NoTrayIcon
#SingleInstance Force
#Warn
SendMode "Event"
SetTitleMatchMode 2
SetWorkingDir A_ScriptDir
FileEncoding "UTF-8"
SetKeyDelay 30, 10
CoordMode "Mouse", "Screen"

; UIA 기반 좌표(화면 좌표) - 필요 시 사용자 환경에 맞게 수정
searchX := 965
searchY := 289
inputX := 772
inputY := 955

if (A_Args.Length < 2) {
  ExitApp 2
}
roomFile := A_Args[1]
msgFile := A_Args[2]

roomText := FileRead(roomFile, "UTF-8")
msgText := FileRead(msgFile, "UTF-8")
roomText := Trim(roomText)
msgText := Trim(msgText, "`r`n")
if (roomText = "" or msgText = "") {
  ExitApp 3
}

roomLines := StrSplit(roomText, ["`r", "`n"])
roomLine := roomLines.Length >= 1 ? roomLines[1] : ""
roomLine := Trim(roomLine)
if (roomLine = "") {
  ExitApp 3
}

winId := WinExist("ahk_exe KakaoTalk.exe")
if !winId {
  winId := WinExist("카카오톡")
}
if !winId {
  ExitApp 4
}
WinRestore "ahk_id " winId
WinActivate "ahk_id " winId
if !WinWaitActive("ahk_id " winId, , 3) {
  ExitApp 4
}

Click searchX, searchY
Sleep 120
SendEvent "^a{Backspace}"
Sleep 80
A_Clipboard := roomLine
SendEvent "^v"
Sleep 120
SendEvent "{Enter}"
Sleep 350
Click inputX, inputY
Sleep 120
A_Clipboard := msgText
SendEvent "^v"
Sleep 120
SendEvent "{Enter}"
ExitApp 0
