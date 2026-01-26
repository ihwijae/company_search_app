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
    $pid = 0
    [void][Win32]::GetWindowThreadProcessId($hWnd, [ref]$pid)
    if ($pid -ne 0 -and $pids -contains [int]$pid) {
      if ([Win32]::IsWindowVisible($hWnd)) {
        $handles.Add($hWnd) | Out-Null
      }
    }
    return $true
  }
  [void][Win32]::EnumWindows($callback, [IntPtr]::Zero)
  return $handles
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
    [void]$lines.Append(\"TOP | {0} | {1} | child:{2} | 0x{3:X}\" -f $cls, $ttl, $childCount, $hwnd.ToInt64())
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
    $onlineView = Find-ChildWindowByText $mainHwnd 'OnlineMainView'
    if ($onlineView -eq [IntPtr]::Zero) {
      $onlineView = Find-ChildWindowByClassContains $mainHwnd 'OnlineMainView'
    }
    if ($onlineView -eq [IntPtr]::Zero) {
      $onlineView = Find-DescendantByClassContains $mainHwnd 'OnlineMainView'
    }
    if ($onlineView -eq [IntPtr]::Zero) {
      $onlineView = $mainHwnd
    }

    $chatType = [string]$item.chatType
    if ([string]::IsNullOrWhiteSpace($chatType)) { throw 'chatType is required' }

    if ($chatType -eq 'friend') {
      $chatList = Find-ChildWindowByText $onlineView 'ContactListView'
      if ($chatList -eq [IntPtr]::Zero) {
        $chatList = Find-ChildWindowByClassContains $onlineView 'ContactListView'
      }
      if ($chatList -eq [IntPtr]::Zero) {
        $chatList = Find-DescendantByClassContains $onlineView 'ContactListView'
      }
      if ($chatList -eq [IntPtr]::Zero) {
        $chatList = Find-DescendantByClassContainsWithChildClass $onlineView 'ContactListView' 'Edit'
      }
      if ($chatList -eq [IntPtr]::Zero) {
        $chatList = Find-DescendantByClassContainsWithChildClass $mainHwnd 'ContactListView' 'Edit'
      }
      if ($chatList -eq [IntPtr]::Zero) {
        $chatList = Find-DescendantByClassContainsWithChildClass $onlineView 'ListView' 'Edit'
      }
      if ($chatList -eq [IntPtr]::Zero) {
        $chatList = Find-DescendantByClassContainsWithChildClass $mainHwnd 'ListView' 'Edit'
      }
    } else {
      $chatList = Find-ChildWindowByText $onlineView 'ChatRoomListView'
      if ($chatList -eq [IntPtr]::Zero) {
        $chatList = Find-ChildWindowByClassContains $onlineView 'ChatRoomListView'
      }
      if ($chatList -eq [IntPtr]::Zero) {
        $chatList = Find-DescendantByClassContains $onlineView 'ChatRoomListView'
      }
      if ($chatList -eq [IntPtr]::Zero) {
        $chatList = Find-DescendantByClassContainsWithChildClass $onlineView 'ChatRoomListView' 'Edit'
      }
      if ($chatList -eq [IntPtr]::Zero) {
        $chatList = Find-DescendantByClassContainsWithChildClass $mainHwnd 'ChatRoomListView' 'Edit'
      }
      if ($chatList -eq [IntPtr]::Zero) {
        $chatList = Find-DescendantByClassContainsWithChildClass $onlineView 'ListView' 'Edit'
      }
      if ($chatList -eq [IntPtr]::Zero) {
        $chatList = Find-DescendantByClassContainsWithChildClass $mainHwnd 'ListView' 'Edit'
      }
    }
    $edit = [IntPtr]::Zero
    $editClasses = @('Edit', 'RichEdit50W', 'RICHEDIT50W', 'RichEdit20W', 'RICHEDIT20W')
    if ($chatList -ne [IntPtr]::Zero) {
      $edit = Find-ChildWindowByClass $chatList 'Edit'
      if ($edit -eq [IntPtr]::Zero) {
        $edit = Find-DescendantByClassAny $chatList $editClasses
      }
    }
    if ($edit -eq [IntPtr]::Zero) {
      $edit = Find-DescendantByClassAny $onlineView $editClasses
    }
    if ($edit -eq [IntPtr]::Zero) {
      $edit = Find-DescendantByClassAny $mainHwnd $editClasses
    }
    if ($edit -eq [IntPtr]::Zero) { throw '채팅 검색창(Edit)을 찾을 수 없습니다.' }

    [void][Win32]::SetForegroundWindow($mainHwnd)
    Start-Sleep -Milliseconds 120
    [void][Win32]::SetFocus($edit)
    Start-Sleep -Milliseconds 80
    if ($chatType -eq 'open') {
      $wshell.SendKeys('^{RIGHT}')
      Start-Sleep -Milliseconds 160
    } elseif ($chatType -eq 'chat') {
      $wshell.SendKeys('^{LEFT}')
      Start-Sleep -Milliseconds 160
    }

    [void][Win32]::SendMessage($edit, $WM_SETTEXT, [IntPtr]::Zero, $room)
    Start-Sleep -Milliseconds 120
    [void][Win32]::PostMessage($edit, $WM_KEYDOWN, [IntPtr]$VK_RETURN, [IntPtr]::Zero)
    Start-Sleep -Milliseconds 300

    $chatHwnd = [Win32]::FindWindow($null, $room)
    if ($chatHwnd -eq [IntPtr]::Zero) { throw '채팅방 창을 찾지 못했습니다.' }

    $richEdit = Find-ChildWindowByClass $chatHwnd 'RichEdit50W'
    if ($richEdit -eq [IntPtr]::Zero) {
      $richEdit = Find-ChildWindowByClass $chatHwnd 'Edit'
    }
    if ($richEdit -eq [IntPtr]::Zero) { throw '메시지 입력창을 찾지 못했습니다.' }

    [void][Win32]::SetForegroundWindow($chatHwnd)
    Start-Sleep -Milliseconds 80
    [void][Win32]::SendMessage($richEdit, $WM_SETTEXT, [IntPtr]::Zero, $msg)
    Start-Sleep -Milliseconds 80
    [void][Win32]::PostMessage($chatHwnd, $WM_KEYDOWN, [IntPtr]$VK_RETURN, [IntPtr]::Zero)
    Start-Sleep -Milliseconds 120
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
