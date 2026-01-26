#Requires AutoHotkey v2.0
#NoTrayIcon
#SingleInstance Force
#Warn
SendMode "Input"
SetTitleMatchMode 2
SetWorkingDir A_ScriptDir
FileEncoding "UTF-8"

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

if WinExist("ahk_exe KakaoTalk.exe") {
  WinActivate
  WinWaitActive "ahk_exe KakaoTalk.exe", , 3
} else {
  ExitApp 4
}

Send "^f"
Sleep 200
Send "^a{Backspace}"
Sleep 80
A_Clipboard := roomLine
Send "^v"
Sleep 120
Send "{Enter}"
Sleep 350
A_Clipboard := msgText
Send "^v"
Sleep 120
Send "{Enter}"
ExitApp 0
