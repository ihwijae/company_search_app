const { spawn } = require('child_process');

class KakaoAutomationService {
  constructor(options = {}) {
    this.powershellCommand = this.resolvePowerShellCommand();
    this.commandTimeoutMs = options.commandTimeoutMs || 60000;
  }

  resolvePowerShellCommand() {
    if (process.platform === 'win32') return 'powershell.exe';
    if (process.env.WSL_DISTRO_NAME) return 'powershell.exe';
    return null;
  }

  ensureSupported() {
    if (!this.powershellCommand) {
      throw new Error('카카오톡 자동 전송은 Windows 환경에서만 지원됩니다.');
    }
  }

  encodePayload(payload = {}) {
    try {
      const json = JSON.stringify(payload ?? {});
      return Buffer.from(json, 'utf8').toString('base64');
    } catch {
      return Buffer.from('{}', 'utf8').toString('base64');
    }
  }

  runPowerShell(script, args = [], { timeoutMs, env } = {}) {
    this.ensureSupported();
    return new Promise((resolve, reject) => {
      const ps = spawn(
        this.powershellCommand,
        ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-Command', script, ...args],
        { windowsHide: true, env: env ? { ...process.env, ...env } : process.env }
      );
      let stdout = '';
      let stderr = '';
      const timer = setTimeout(() => {
        ps.kill();
        reject(new Error('PowerShell 명령이 시간 초과되었습니다.'));
      }, timeoutMs || this.commandTimeoutMs);
      ps.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
      ps.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
      ps.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
      ps.on('close', (code) => {
        clearTimeout(timer);
        if (code !== 0 && stderr.trim()) {
          reject(new Error(stderr.trim()));
          return;
        }
        resolve(stdout.trim());
      });
    });
  }

  async sendBatch(payload = {}) {
    if (!Array.isArray(payload.items) || payload.items.length === 0) {
      return { success: false, message: '전송할 항목이 없습니다.' };
    }
    const script = `
& {
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$payloadBase64 = $env:KAKAO_PAYLOAD
if (-not $payloadBase64) { throw 'payload base64가 없습니다.' }
$payloadJson = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($payloadBase64))
$payload = $payloadJson | ConvertFrom-Json
if (-not $payload) { throw 'payload 파싱에 실패했습니다.' }
$items = $payload.items
$delayMs = if ($payload.delayMs) { [int]$payload.delayMs } else { 250 }
$results = @()

Add-Type @\"
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class Win32 {
  [DllImport(\"user32.dll\", SetLastError=true)]
  public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
  [DllImport(\"user32.dll\", SetLastError=true)]
  public static extern IntPtr FindWindowEx(IntPtr hwndParent, IntPtr hwndChildAfter, string lpszClass, string lpszWindow);
  [DllImport(\"user32.dll\", SetLastError=true)]
  public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);
  [DllImport(\"user32.dll\", SetLastError=true)]
  public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
  [DllImport(\"user32.dll\", SetLastError=true)]
  public static extern int GetWindowTextLength(IntPtr hWnd);
  [DllImport(\"user32.dll\")]
  public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport(\"user32.dll\")]
  public static extern IntPtr SetFocus(IntPtr hWnd);
  [DllImport(\"user32.dll\", CharSet=CharSet.Auto)]
  public static extern IntPtr SendMessage(IntPtr hWnd, int Msg, IntPtr wParam, string lParam);
  [DllImport(\"user32.dll\")]
  public static extern bool PostMessage(IntPtr hWnd, int Msg, IntPtr wParam, IntPtr lParam);
  [DllImport(\"user32.dll\")]
  public static extern void keybd_event(byte bVk, byte bScan, int dwFlags, int dwExtraInfo);
  [DllImport(\"user32.dll\")]
  public static extern bool SetWindowText(IntPtr hWnd, string lpString);
}
\"@

$WM_SETTEXT = 0x000C
$WM_KEYDOWN = 0x0100
$VK_RETURN = 0x0D
$VK_CONTROL = 0x11
$VK_LEFT = 0x25
$VK_RIGHT = 0x27
$KEYEVENTF_KEYUP = 0x0002

function Get-WindowText([IntPtr]$hWnd) {
  $length = [Win32]::GetWindowTextLength($hWnd)
  if ($length -le 0) { return \"\" }
  $sb = New-Object System.Text.StringBuilder ($length + 1)
  [void][Win32]::GetWindowText($hWnd, $sb, $sb.Capacity)
  return $sb.ToString()
}

function Get-ClassName([IntPtr]$hWnd) {
  $sb = New-Object System.Text.StringBuilder 128
  [void][Win32]::GetClassName($hWnd, $sb, $sb.Capacity)
  return $sb.ToString()
}

function Find-ChildWindowByName([IntPtr]$parent, [string]$text) {
  $child = [Win32]::FindWindowEx($parent, [IntPtr]::Zero, $null, $null)
  while ($child -ne [IntPtr]::Zero) {
    $title = Get-WindowText $child
    if ($title -and $title -like (\"*\" + $text + \"*\")) { return $child }
    $child = [Win32]::FindWindowEx($parent, $child, $null, $null)
  }
  return [IntPtr]::Zero
}

function Find-ChildWindowByClass([IntPtr]$parent, [string]$className) {
  return [Win32]::FindWindowEx($parent, [IntPtr]::Zero, $className, $null)
}

function FindHwndEVA {
  $hwnd = [Win32]::FindWindowEx([IntPtr]::Zero, [IntPtr]::Zero, $null, $null)
  while ($hwnd -ne [IntPtr]::Zero) {
    $className = Get-ClassName $hwnd
    if ($className -like \"*EVA_Window_Dblclk*\") {
      $title = Get-WindowText $hwnd
      if ($title -match '카카오톡|KakaoTalk') { return $hwnd }
    }
    $hwnd = [Win32]::FindWindowEx([IntPtr]::Zero, $hwnd, $null, $null)
  }
  return [IntPtr]::Zero
}

function SetText([IntPtr]$hwnd, [string]$text) {
  [void][Win32]::SendMessage($hwnd, $WM_SETTEXT, [IntPtr]::Zero, $text)
}

function SetEnter([IntPtr]$hwnd) {
  [void][Win32]::PostMessage($hwnd, $WM_KEYDOWN, [IntPtr]$VK_RETURN, [IntPtr]::Zero)
}

function SendCtrlRight([IntPtr]$hwnd) {
  [void][Win32]::SetForegroundWindow($hwnd)
  Start-Sleep -Milliseconds 300
  [Win32]::keybd_event([byte]$VK_CONTROL, 0, 0, 0)
  [Win32]::keybd_event([byte]$VK_RIGHT, 0, 0, 0)
  [Win32]::keybd_event([byte]$VK_RIGHT, 0, $KEYEVENTF_KEYUP, 0)
  [Win32]::keybd_event([byte]$VK_CONTROL, 0, $KEYEVENTF_KEYUP, 0)
}

function SendCtrlLeft([IntPtr]$hwnd) {
  [void][Win32]::SetForegroundWindow($hwnd)
  Start-Sleep -Milliseconds 300
  [Win32]::keybd_event([byte]$VK_CONTROL, 0, 0, 0)
  [Win32]::keybd_event([byte]$VK_LEFT, 0, 0, 0)
  [Win32]::keybd_event([byte]$VK_LEFT, 0, $KEYEVENTF_KEYUP, 0)
  [Win32]::keybd_event([byte]$VK_CONTROL, 0, $KEYEVENTF_KEYUP, 0)
}

function ActiveUserChat([string]$target) {
  $hwndMain = FindHwndEVA
  if ($hwndMain -eq [IntPtr]::Zero) { throw '카카오톡 창을 찾을 수 없습니다.' }
  $hwndOnline = Find-ChildWindowByName $hwndMain 'OnlineMainView'
  $hwndListView = Find-ChildWindowByName $hwndOnline 'ContactListView'
  $hwndEdit = Find-ChildWindowByClass $hwndListView 'Edit'
  if ($hwndEdit -eq [IntPtr]::Zero) { throw '채팅 검색창(Edit)을 찾을 수 없습니다.' }
  SetText $hwndEdit $target
  Start-Sleep -Milliseconds 500
  SetEnter $hwndEdit
  Start-Sleep -Milliseconds 200
  SetText $hwndEdit ''
}

function ActiveGroupChat([string]$target, [bool]$isOpenChat) {
  $hwndMain = FindHwndEVA
  if ($hwndMain -eq [IntPtr]::Zero) { throw '카카오톡 창을 찾을 수 없습니다.' }
  $hwndOnline = Find-ChildWindowByName $hwndMain 'OnlineMainView'
  $hwndListView = Find-ChildWindowByName $hwndOnline 'ChatRoomListView'
  $hwndEdit = Find-ChildWindowByClass $hwndListView 'Edit'
  if ($hwndEdit -eq [IntPtr]::Zero) { throw '채팅 검색창(Edit)을 찾을 수 없습니다.' }
  if ($isOpenChat) { SendCtrlRight $hwndEdit } else { SendCtrlLeft $hwndEdit }
  SetText $hwndEdit $target
  Start-Sleep -Milliseconds 500
  SetEnter $hwndEdit
  Start-Sleep -Milliseconds 200
  SetText $hwndEdit ''
}

function ActiveChat([string]$target, [int]$chatType) {
  if ($chatType -eq 0) { ActiveUserChat $target }
  elseif ($chatType -eq 2) { ActiveGroupChat $target $true }
  else { ActiveGroupChat $target $false }
}

foreach ($item in $items) {
  $room = [string]$item.room
  $msg = [string]$item.message
  $chatTypeRaw = [string]$item.chatType
  if ([string]::IsNullOrWhiteSpace($room) -or [string]::IsNullOrWhiteSpace($msg)) {
    $results += [pscustomobject]@{ room = $room; success = $false; error = 'room or message missing' }
    continue
  }
  try {
    $chatType = 1
    if ($chatTypeRaw -eq 'friend') { $chatType = 0 }
    elseif ($chatTypeRaw -eq 'open') { $chatType = 2 }
    ActiveChat $room $chatType
    Start-Sleep -Milliseconds 200
    $chatHwnd = [Win32]::FindWindow($null, $room)
    $start = Get-Date
    while ($chatHwnd -eq [IntPtr]::Zero) {
      $chatHwnd = [Win32]::FindWindow($null, $room)
      if ((New-TimeSpan -Start $start -End (Get-Date)).TotalSeconds -gt 5) { break }
    }
    if ($chatHwnd -eq [IntPtr]::Zero) { throw '채팅방 창을 찾지 못했습니다.' }
    $richEdit = Find-ChildWindowByClass $chatHwnd 'RichEdit50W'
    if ($richEdit -eq [IntPtr]::Zero) { $richEdit = Find-ChildWindowByClass $chatHwnd 'Edit' }
    if ($richEdit -eq [IntPtr]::Zero) { throw '메시지 입력창을 찾지 못했습니다.' }
    [void][Win32]::SetForegroundWindow($chatHwnd)
    Start-Sleep -Milliseconds 100
    [void][Win32]::SetFocus($richEdit)
    Start-Sleep -Milliseconds 100
    [void][Win32]::SetWindowText($richEdit, '')
    Start-Sleep -Milliseconds 100
    SetText $richEdit $msg
    Start-Sleep -Milliseconds 100
    SetEnter $chatHwnd
    $results += [pscustomobject]@{ room = $room; success = $true }
  } catch {
    $results += [pscustomobject]@{ room = $room; success = $false; error = $_.Exception.Message }
  }
  Start-Sleep -Milliseconds $delayMs
}

[pscustomobject]@{ success = $true; results = $results } | ConvertTo-Json -Depth 5 -Compress
}
`;
    try {
      const raw = await this.runPowerShell(script, [], { env: { KAKAO_PAYLOAD: this.encodePayload(payload) } });
      const data = raw ? JSON.parse(raw) : null;
      if (!data?.success) {
        return { success: false, message: '카카오톡 전송에 실패했습니다.' };
      }
      return { success: true, results: data.results || [] };
    } catch (err) {
      return { success: false, message: err?.message || String(err) };
    }
  }
}

module.exports = { KakaoAutomationService };
