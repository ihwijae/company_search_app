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

try { Add-Type -AssemblyName System.Windows.Forms } catch {}
$wshell = New-Object -ComObject WScript.Shell

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
  public static extern IntPtr GetForegroundWindow();
  [DllImport(\"user32.dll\", SetLastError=true)]
  public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport(\"user32.dll\", SetLastError=true)]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
  [DllImport(\"user32.dll\", SetLastError=true)]
  public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport(\"user32.dll\", SetLastError=true)]
  public static extern IntPtr GetParent(IntPtr hWnd);
  [DllImport(\"user32.dll\")]
  public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport(\"user32.dll\")]
  public static extern IntPtr SetFocus(IntPtr hWnd);
  [DllImport(\"user32.dll\", CharSet=CharSet.Auto)]
  public static extern IntPtr SendMessage(IntPtr hWnd, int Msg, IntPtr wParam, string lParam);
  [DllImport(\"user32.dll\")]
  public static extern bool PostMessage(IntPtr hWnd, int Msg, IntPtr wParam, IntPtr lParam);
}
\"@

$WM_SETTEXT = 0x000C
$WM_KEYDOWN = 0x0100
$VK_RETURN = 0x0D

function EscapeSendKeys([string]$text) {
  if ($null -eq $text) { return '' }
  $escaped = $text
  $escaped = $escaped -replace '([\+\^\%\~\(\)\[\]\{\}])', '{$1}'
  return $escaped
}

function Get-WindowText([IntPtr]$hWnd) {
  $length = [Win32]::GetWindowTextLength($hWnd)
  if ($length -le 0) { return \"\" }
  $sb = New-Object System.Text.StringBuilder ($length + 1)
  [void][Win32]::GetWindowText($hWnd, $sb, $sb.Capacity)
  return $sb.ToString()
}

function Get-ForegroundTitle {
  $fg = [Win32]::GetForegroundWindow()
  if ($fg -eq [IntPtr]::Zero) { return '' }
  return Get-WindowText $fg
}

function Ensure-KakaoForeground([IntPtr]$mainHwnd, $proc) {
  [void][Win32]::SetForegroundWindow($mainHwnd)
  Start-Sleep -Milliseconds 120
  try {
    if ($proc -and $proc.Id) { [void]$wshell.AppActivate([int]$proc.Id) }
    else { [void]$wshell.AppActivate('카카오톡') }
  } catch {}
  Start-Sleep -Milliseconds 120
  $title = Get-ForegroundTitle
  if ($title -and ($title -match '카카오톡|KakaoTalk')) { return $true }
  return $false
}

function Get-ClassName([IntPtr]$hWnd) {
  $sb = New-Object System.Text.StringBuilder 128
  [void][Win32]::GetClassName($hWnd, $sb, $sb.Capacity)
  return $sb.ToString()
}

function Find-MainKakaoWindow {
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

function Find-ChildWindowByText([IntPtr]$parent, [string]$text) {
  $child = [Win32]::FindWindowEx($parent, [IntPtr]::Zero, $null, $null)
  while ($child -ne [IntPtr]::Zero) {
    $title = Get-WindowText $child
    if ($title -and $title -like (\"*\" + $text + \"*\")) { return $child }
    $child = [Win32]::FindWindowEx($parent, $child, $null, $null)
  }
  return [IntPtr]::Zero
}

function Find-ChildWindowByClassContains([IntPtr]$parent, [string]$classToken) {
  $child = [Win32]::FindWindowEx($parent, [IntPtr]::Zero, $null, $null)
  while ($child -ne [IntPtr]::Zero) {
    $className = Get-ClassName $child
    if ($className -and $className -like (\"*\" + $classToken + \"*\")) { return $child }
    $child = [Win32]::FindWindowEx($parent, $child, $null, $null)
  }
  return [IntPtr]::Zero
}

function Find-DescendantByClassContains([IntPtr]$parent, [string]$classToken) {
  $child = [Win32]::FindWindowEx($parent, [IntPtr]::Zero, $null, $null)
  while ($child -ne [IntPtr]::Zero) {
    $className = Get-ClassName $child
    if ($className -and $className -like (\"*\" + $classToken + \"*\")) { return $child }
    $found = Find-DescendantByClassContains $child $classToken
    if ($found -ne [IntPtr]::Zero) { return $found }
    $child = [Win32]::FindWindowEx($parent, $child, $null, $null)
  }
  return [IntPtr]::Zero
}

function Find-ChildWindowByClass([IntPtr]$parent, [string]$className) {
  return [Win32]::FindWindowEx($parent, [IntPtr]::Zero, $className, $null)
}

function Get-TopLevelWindowsForProcess([string]$processName) {
  $handles = New-Object System.Collections.Generic.List[System.IntPtr]
  $procs = @(Get-Process -Name $processName -ErrorAction SilentlyContinue)
  if ($procs.Count -eq 0) { return $handles }
  $pids = $procs | ForEach-Object { $_.Id }
  $callback = [Win32+EnumWindowsProc]{
    param([IntPtr]$hWnd, [IntPtr]$lParam)
    $procId = 0
    [void][Win32]::GetWindowThreadProcessId($hWnd, [ref]$procId)
    if ($procId -ne 0 -and $pids -contains [int]$procId) {
      if ([Win32]::IsWindowVisible($hWnd)) {
        $handles.Add($hWnd) | Out-Null
      }
    }
    return $true
  }
  [void][Win32]::EnumWindows($callback, [IntPtr]::Zero)
  return $handles
}

function Find-TopLevelWindowByTitleContains([string]$processName, [string]$text) {
  if ([string]::IsNullOrWhiteSpace($text)) { return [IntPtr]::Zero }
  $wins = Get-TopLevelWindowsForProcess $processName
  foreach ($hwnd in $wins) {
    $title = Get-WindowText $hwnd
    if ($title -and $title -like (\"*\" + $text + \"*\")) { return $hwnd }
  }
  return [IntPtr]::Zero
}

function Get-ChildCount([IntPtr]$parent) {
  $count = 0
  $child = [Win32]::FindWindowEx($parent, [IntPtr]::Zero, $null, $null)
  while ($child -ne [IntPtr]::Zero) {
    $count++
    $child = [Win32]::FindWindowEx($parent, $child, $null, $null)
  }
  return $count
}

function Find-DescendantByClass([IntPtr]$parent, [string]$className) {
  $child = [Win32]::FindWindowEx($parent, [IntPtr]::Zero, $null, $null)
  while ($child -ne [IntPtr]::Zero) {
    $childClass = Get-ClassName $child
    if ($childClass -eq $className) { return $child }
    $found = Find-DescendantByClass $child $className
    if ($found -ne [IntPtr]::Zero) { return $found }
    $child = [Win32]::FindWindowEx($parent, $child, $null, $null)
  }
  return [IntPtr]::Zero
}

function Find-DescendantByClassAny([IntPtr]$parent, [string[]]$classNames) {
  foreach ($name in $classNames) {
    $found = Find-DescendantByClass $parent $name
    if ($found -ne [IntPtr]::Zero) { return $found }
  }
  return [IntPtr]::Zero
}

function Find-DescendantByClassContainsWithChildClass([IntPtr]$parent, [string]$classToken, [string]$childClass) {
  $child = [Win32]::FindWindowEx($parent, [IntPtr]::Zero, $null, $null)
  while ($child -ne [IntPtr]::Zero) {
    $className = Get-ClassName $child
    if ($className -and $className -like (\"*\" + $classToken + \"*\")) {
      $childMatch = Find-ChildWindowByClass $child $childClass
      if ($childMatch -ne [IntPtr]::Zero) { return $child }
      $deepChildMatch = Find-DescendantByClassContains $child $childClass
      if ($deepChildMatch -ne [IntPtr]::Zero) { return $child }
    }
    $found = Find-DescendantByClassContainsWithChildClass $child $classToken $childClass
    if ($found -ne [IntPtr]::Zero) { return $found }
    $child = [Win32]::FindWindowEx($parent, $child, $null, $null)
  }
  return [IntPtr]::Zero
}

$mainHwnd = Find-MainKakaoWindow
if ($mainHwnd -eq [IntPtr]::Zero) {
  try {
    $proc = Get-Process -Name KakaoTalk -ErrorAction Stop | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
    if ($proc) { $mainHwnd = [IntPtr]$proc.MainWindowHandle }
  } catch {}
}
if ($mainHwnd -eq [IntPtr]::Zero) {
  $candidates = Get-TopLevelWindowsForProcess 'KakaoTalk'
  if ($candidates.Count -gt 0) {
    $mainHwnd = $candidates[0]
  }
}
if ($mainHwnd -eq [IntPtr]::Zero) { throw '카카오톡 창을 찾을 수 없습니다.' }
 [void][Win32]::SetForegroundWindow($mainHwnd)
 Start-Sleep -Milliseconds 200

function Dump-WindowTree([IntPtr]$parent, [int]$depth = 0, [int]$maxDepth = 4, [int]$maxNodes = 400, [ref]$countRef) {
  if ($countRef.Value -ge $maxNodes) { return \"\" }
  $indent = (' ' * ($depth * 2))
  $className = Get-ClassName $parent
  $title = Get-WindowText $parent
  $line = \"{0}{1} | {2} | 0x{3:X}\" -f $indent, $className, $title, $parent.ToInt64()
  $line = $line + [Environment]::NewLine
  $countRef.Value++
  if ($depth -ge $maxDepth -or $countRef.Value -ge $maxNodes) { return $line }
  $child = [Win32]::FindWindowEx($parent, [IntPtr]::Zero, $null, $null)
  $result = $line
  while ($child -ne [IntPtr]::Zero -and $countRef.Value -lt $maxNodes) {
    $result += Dump-WindowTree $child ($depth + 1) $maxDepth $maxNodes $countRef
    $child = [Win32]::FindWindowEx($parent, $child, $null, $null)
  }
  return $result
}

$debugDump = $false
if ($payload.debugDump -eq $true) { $debugDump = $true }
$dumpText = $null
$dumpCount = 0
if ($debugDump) {
  $cnt = 0
  $topWindows = Get-TopLevelWindowsForProcess 'KakaoTalk'
  $lines = New-Object System.Text.StringBuilder
  foreach ($hwnd in $topWindows) {
    $cls = Get-ClassName $hwnd
    $ttl = Get-WindowText $hwnd
    $childCount = Get-ChildCount $hwnd
    $hex = '0x{0:X}' -f $hwnd.ToInt64()
    [void]$lines.Append(\"TOP | $cls | $ttl | child:$childCount | $hex\")
    [void]$lines.Append([Environment]::NewLine)
  }
  [void]$lines.Append([Environment]::NewLine)
  [void]$lines.Append((Dump-WindowTree $mainHwnd 0 5 600 ([ref]$cnt)))
  $dumpText = $lines.ToString()
  $dumpCount = $cnt
}

foreach ($item in $items) {
  $room = [string]$item.room
  $msg = [string]$item.message
  if ([string]::IsNullOrWhiteSpace($room) -or [string]::IsNullOrWhiteSpace($msg)) {
    $results += [pscustomobject]@{ room = $room; success = $false; error = 'room or message missing' }
    continue
  }
  try {
    $roomLine = ($room -split \"\\r?\\n\")[0]
    if ([string]::IsNullOrWhiteSpace($roomLine)) { throw 'room or message missing' }
    if (-not (Ensure-KakaoForeground $mainHwnd $proc)) { throw '카카오톡 창 포커스에 실패했습니다.' }
    $wshell.SendKeys('^f')
    Start-Sleep -Milliseconds 180
    $wshell.SendKeys('^a{BACKSPACE}')
    Start-Sleep -Milliseconds 80
    $wshell.SendKeys((EscapeSendKeys $roomLine))
    Start-Sleep -Milliseconds 150
    $wshell.SendKeys('{ENTER}')
    Start-Sleep -Milliseconds 350
    [System.Windows.Forms.Clipboard]::SetText($msg)
    Start-Sleep -Milliseconds 120
    $wshell.SendKeys('^v')
    Start-Sleep -Milliseconds 120
    $wshell.SendKeys('{ENTER}')
    Start-Sleep -Milliseconds 150
    $results += [pscustomobject]@{ room = $room; success = $true }
  } catch {
    $results += [pscustomobject]@{ room = $room; success = $false; error = $_.Exception.Message }
  }
  Start-Sleep -Milliseconds $delayMs
}

[pscustomobject]@{
  success = $true
  results = $results
  debugDump = $dumpText
  debugDumpCount = $dumpCount
  debugDumpEnabled = $debugDump
} | ConvertTo-Json -Depth 5 -Compress
}
`;
    try {
      const raw = await this.runPowerShell(script, [], { env: { KAKAO_PAYLOAD: this.encodePayload(payload) } });
      const data = raw ? JSON.parse(raw) : null;
      if (!data?.success) {
        return { success: false, message: '카카오톡 전송에 실패했습니다.' };
      }
      return {
        success: true,
        results: data.results || [],
        debugDump: data.debugDump,
        debugDumpCount: data.debugDumpCount,
        debugDumpEnabled: data.debugDumpEnabled,
      };
    } catch (err) {
      return { success: false, message: err?.message || String(err) };
    }
  }
}

module.exports = { KakaoAutomationService };
