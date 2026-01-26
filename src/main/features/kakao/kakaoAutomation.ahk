#NoTrayIcon
#SingleInstance Force
#Warn
SendMode Input
SetTitleMatchMode, 2
SetWorkingDir, %A_ScriptDir%
FileEncoding, UTF-8

roomFile := A_Args[1]
msgFile := A_Args[2]
if (roomFile = "" or msgFile = "")
  ExitApp, 2

FileRead, roomText, %roomFile%
FileRead, msgText, %msgFile%
roomText := Trim(roomText)
msgText := Trim(msgText, "`r`n")
if (roomText = "" or msgText = "")
  ExitApp, 3

StringSplit, roomLines, roomText, `n, `r
roomLine := roomLines1

if WinExist("ahk_exe KakaoTalk.exe") {
  WinActivate
  WinWaitActive, ahk_exe KakaoTalk.exe, , 3
} else {
  ExitApp, 4
}

SendInput, ^f
Sleep, 200
SendInput, ^a{Backspace}
Sleep, 80
Clipboard := roomLine
SendInput, ^v
Sleep, 120
SendInput, {Enter}
Sleep, 350
Clipboard := msgText
SendInput, ^v
Sleep, 120
SendInput, {Enter}
ExitApp, 0
