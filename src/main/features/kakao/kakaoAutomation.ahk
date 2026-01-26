#Requires AutoHotkey v2.0
#NoTrayIcon
#SingleInstance Force
#Warn
SendMode "Event"
SetTitleMatchMode 2
SetWorkingDir A_ScriptDir
FileEncoding "UTF-8"
SetKeyDelay 30, 10

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

if WinExist("카카오톡") {
  WinActivate "카카오톡"
  WinWaitActive "카카오톡", , 3
} else if WinExist("ahk_exe KakaoTalk.exe") {
  WinActivate "ahk_exe KakaoTalk.exe"
  WinWaitActive "ahk_exe KakaoTalk.exe", , 3
} else {
  ExitApp 4
}
if !WinActive("ahk_exe KakaoTalk.exe") {
  ExitApp 4
}

SendEvent "^f"
Sleep 200
SendEvent "^a{Backspace}"
Sleep 80
A_Clipboard := roomLine
SendEvent "^v"
Sleep 120
SendEvent "{Enter}"
Sleep 350
A_Clipboard := msgText
SendEvent "^v"
Sleep 120
SendEvent "{Enter}"
ExitApp 0
