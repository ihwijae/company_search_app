KakaoSendHelper build (Windows)

1) Install .NET SDK 6.x or later
2) Open PowerShell in this directory
3) Build:
   dotnet build -c Release
4) Copy output exe to:
   src\main\features\kakao\KakaoSendHelper.exe
   (from: bin\Release\net6.0-windows\win-x64\KakaoSendHelper.exe)

Usage (manual):
  KakaoSendHelper.exe input.json output.json

Input JSON:
{
  "items": [
    { "room": "방이름", "message": "메시지", "chatType": "chat" }
  ]
}
