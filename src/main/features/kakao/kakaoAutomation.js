const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

class KakaoAutomationService {
  constructor(options = {}) {
    this.powershellCommand = this.resolvePowerShellCommand();
    this.commandTimeoutMs = options.commandTimeoutMs || 60000;
    this.autoHotkeyPath = this.resolveAutoHotkeyPath();
  }

  resolvePowerShellCommand() {
    if (process.platform === 'win32') return 'powershell.exe';
    if (process.env.WSL_DISTRO_NAME) return 'powershell.exe';
    return null;
  }

  resolveAutoHotkeyPath() {
    if (process.platform !== 'win32' && !process.env.WSL_DISTRO_NAME) return null;
    const envPath = process.env.AHK_PATH;
    const candidates = [
      envPath,
      'C:\\Program Files\\AutoHotkey\\AutoHotkey.exe',
      'C:\\Program Files\\AutoHotkey\\AutoHotkeyU64.exe',
      'C:\\Program Files (x86)\\AutoHotkey\\AutoHotkey.exe',
      'C:\\Program Files (x86)\\AutoHotkey\\AutoHotkeyU64.exe',
    ].filter(Boolean);
    for (const candidate of candidates) {
      try {
        if (candidate && fs.existsSync(candidate)) return candidate;
      } catch {}
    }
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

  runAutoHotkey(room, message) {
    this.ensureSupported();
    if (!this.autoHotkeyPath) {
      return Promise.reject(new Error('AutoHotkey가 설치되어 있지 않습니다. AutoHotkey v1을 설치하거나 AHK_PATH를 설정하세요.'));
    }
    const scriptPath = path.join(__dirname, 'kakaoAutomation.ahk');
    if (!fs.existsSync(scriptPath)) {
      return Promise.reject(new Error('kakaoAutomation.ahk 파일을 찾을 수 없습니다.'));
    }
    const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const roomFile = path.join(os.tmpdir(), `kakao_room_${stamp}.txt`);
    const msgFile = path.join(os.tmpdir(), `kakao_msg_${stamp}.txt`);
    fs.writeFileSync(roomFile, String(room || ''), 'utf8');
    fs.writeFileSync(msgFile, String(message || ''), 'utf8');
    return new Promise((resolve, reject) => {
      const ahk = spawn(this.autoHotkeyPath, [scriptPath, roomFile, msgFile], {
        windowsHide: true,
      });
      let stderr = '';
      const timer = setTimeout(() => {
        ahk.kill();
        reject(new Error('AutoHotkey 실행이 시간 초과되었습니다.'));
      }, this.commandTimeoutMs);
      ahk.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
      ahk.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
      ahk.on('close', (code) => {
        clearTimeout(timer);
        try { fs.unlinkSync(roomFile); } catch {}
        try { fs.unlinkSync(msgFile); } catch {}
        if (code !== 0) {
          reject(new Error(stderr.trim() || `AutoHotkey 실패 (code ${code})`));
          return;
        }
        resolve(true);
      });
    });
  }

  async sendBatch(payload = {}) {
    if (!Array.isArray(payload.items) || payload.items.length === 0) {
      return { success: false, message: '전송할 항목이 없습니다.' };
    }
    if (payload.useUia === true) {
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
try { Add-Type -AssemblyName UIAutomationClient } catch { throw 'UIAutomationClient 로드에 실패했습니다.' }
$wshell = New-Object -ComObject WScript.Shell

$proc = $null
try { $proc = Get-Process -Name KakaoTalk -ErrorAction Stop | Select-Object -First 1 } catch {}
if (-not $proc) { throw '카카오톡 프로세스를 찾을 수 없습니다.' }

$main = $null
try { $main = [System.Windows.Automation.AutomationElement]::FromHandle($proc.MainWindowHandle) } catch {}
if (-not $main) {
  $root = [System.Windows.Automation.AutomationElement]::RootElement
  $cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ProcessIdProperty, $proc.Id)
  $main = $root.FindFirst([System.Windows.Automation.TreeScope]::Children, $cond)
}
if (-not $main) { throw '카카오톡 메인 창(UIA)을 찾을 수 없습니다.' }

$paneCond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Pane)
$allPanes = $main.FindAll([System.Windows.Automation.TreeScope]::Descendants, $paneCond)
$chatPane = $null
foreach ($p in $allPanes) {
  $name = $p.Current.Name
  if ($name -and $name -like 'ChatRoomListView*') { $chatPane = $p; break }
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

    # focus main window
    try { $main.SetFocus() } catch {}
    try { [void]$wshell.AppActivate($proc.Id) } catch {}
    Start-Sleep -Milliseconds 120

    # find search edit inside chat pane
    $searchEdit = $null
    if ($chatPane) {
      $editCond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Edit)
      $edits = $chatPane.FindAll([System.Windows.Automation.TreeScope]::Descendants, $editCond)
      foreach ($e in $edits) {
        if ($e.Current.IsKeyboardFocusable) { $searchEdit = $e; break }
      }
    }

    if (-not $searchEdit) { throw '검색창(UIA Edit)을 찾지 못했습니다.' }
    try { $searchEdit.SetFocus() } catch {}
    Start-Sleep -Milliseconds 80
    try {
      $vp = $searchEdit.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
      $vp.SetValue('')
      $vp.SetValue($roomLine)
    } catch {
      [System.Windows.Forms.Clipboard]::SetText('')
      Start-Sleep -Milliseconds 40
      $wshell.SendKeys('^a{BACKSPACE}')
      Start-Sleep -Milliseconds 80
      [System.Windows.Forms.Clipboard]::SetText($roomLine)
      Start-Sleep -Milliseconds 80
      $wshell.SendKeys('^v')
    }
    Start-Sleep -Milliseconds 120
    $wshell.SendKeys('{ENTER}')
    Start-Sleep -Milliseconds 300

    # find message input
    $docCond = New-Object System.Windows.Automation.AndCondition(
      (New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Document)),
      (New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, 'RichEdit Control'))
    )
    $msgDoc = $main.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $docCond)
    if (-not $msgDoc) { throw '메시지 입력창(UIA Document)을 찾지 못했습니다.' }
    try { $msgDoc.SetFocus() } catch {}
    Start-Sleep -Milliseconds 80
    [System.Windows.Forms.Clipboard]::SetText($msg)
    Start-Sleep -Milliseconds 80
    $wshell.SendKeys('^v')
    Start-Sleep -Milliseconds 80
    $wshell.SendKeys('{ENTER}')

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
          return { success: false, message: '카카오톡(UIA) 전송에 실패했습니다.' };
        }
        return { success: true, results: data.results || [] };
      } catch (err) {
        return { success: false, message: err?.message || String(err) };
      }
    }
    const preferAhk = payload.useAhk === true;
    if (preferAhk && !this.autoHotkeyPath) {
      return { success: false, message: 'AutoHotkey가 설치되어 있지 않습니다. AutoHotkey v1 설치 후 AHK_PATH를 설정하세요.' };
    }
    if (this.autoHotkeyPath) {
      const results = [];
      for (const item of payload.items) {
        const room = String(item?.room || '');
        const message = String(item?.message || '');
        if (!room || !message) {
          results.push({ room, success: false, error: 'room or message missing' });
          continue;
        }
        try {
          await this.runAutoHotkey(room, message);
          results.push({ room, success: true });
        } catch (err) {
          results.push({ room, success: false, error: err?.message || String(err) });
        }
      }
      return { success: true, results };
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
$kakaoProc = $null
try { $kakaoProc = Get-Process -Name KakaoTalk -ErrorAction Stop | Select-Object -First 1 } catch {}

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
  [StructLayout(LayoutKind.Sequential)]
  public struct INPUT {
    public uint type;
    public KEYBDINPUT ki;
  }
  [StructLayout(LayoutKind.Sequential)]
  public struct KEYBDINPUT {
    public ushort wVk;
    public ushort wScan;
    public uint dwFlags;
    public uint time;
    public IntPtr dwExtraInfo;
  }
  [DllImport(\"user32.dll\", SetLastError=true)]
  public static extern uint SendInput(uint nInputs, ref INPUT pInputs, int cbSize);
  [DllImport(\"user32.dll\", CharSet=CharSet.Auto)]
  public static extern IntPtr SendMessage(IntPtr hWnd, int Msg, IntPtr wParam, string lParam);
  [DllImport(\"user32.dll\")]
  public static extern bool PostMessage(IntPtr hWnd, int Msg, IntPtr wParam, IntPtr lParam);
}
\"@

$WM_SETTEXT = 0x000C
$WM_KEYDOWN = 0x0100
$VK_RETURN = 0x0D
$VK_CONTROL = 0x11
$VK_SHIFT = 0x10
$VK_ALT = 0x12
$VK_BACK = 0x08
$VK_A = 0x41
$VK_F = 0x46

$INPUT_KEYBOARD = 1
$KEYEVENTF_KEYUP = 0x0002

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

function Get-ForegroundPid {
  $fg = [Win32]::GetForegroundWindow()
  if ($fg -eq [IntPtr]::Zero) { return 0 }
  $fgProcId = 0
  [void][Win32]::GetWindowThreadProcessId($fg, [ref]$fgProcId)
  return $fgProcId
}

function Ensure-KakaoForeground([IntPtr]$mainHwnd, $proc) {
  [void][Win32]::SetForegroundWindow($mainHwnd)
  Start-Sleep -Milliseconds 120
  try {
    if ($proc -and $proc.Id) { [void]$wshell.AppActivate([int]$proc.Id) }
    else { [void]$wshell.AppActivate('카카오톡') }
  } catch {}
  Start-Sleep -Milliseconds 120
  $fgPid = Get-ForegroundPid
  if ($proc -and $fgPid -eq [int]$proc.Id) { return $true }
  if ($kakaoProc -and $fgPid -eq [int]$kakaoProc.Id) { return $true }
  $title = Get-ForegroundTitle
  if ($title -and ($title -match '카카오톡|KakaoTalk')) { return $true }
  return $false
}

function Send-Key([UInt16]$vk, [bool]$isKeyUp=$false) {
  $input = New-Object Win32+INPUT
  $input.type = $INPUT_KEYBOARD
  $input.ki.wVk = $vk
  if ($isKeyUp) { $input.ki.dwFlags = $KEYEVENTF_KEYUP } else { $input.ki.dwFlags = 0 }
  [void][Win32]::SendInput(1, [ref]$input, [System.Runtime.InteropServices.Marshal]::SizeOf([Win32+INPUT]))
}

function Send-KeyCombo([UInt16[]]$modifiers, [UInt16]$key) {
  foreach ($m in $modifiers) { Send-Key $m $false }
  Send-Key $key $false
  Send-Key $key $true
  for ($i = $modifiers.Length - 1; $i -ge 0; $i--) { Send-Key $modifiers[$i] $true }
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
    Send-KeyCombo @($VK_CONTROL) $VK_F
    Start-Sleep -Milliseconds 180
    Send-KeyCombo @($VK_CONTROL) $VK_A
    Start-Sleep -Milliseconds 80
    Send-Key $VK_BACK $false
    Send-Key $VK_BACK $true
    Start-Sleep -Milliseconds 80
    [System.Windows.Forms.Clipboard]::SetText($roomLine)
    Start-Sleep -Milliseconds 80
    Send-KeyCombo @($VK_CONTROL) 0x56
    Start-Sleep -Milliseconds 150
    Send-Key $VK_RETURN $false
    Send-Key $VK_RETURN $true
    Start-Sleep -Milliseconds 350
    [System.Windows.Forms.Clipboard]::SetText($msg)
    Start-Sleep -Milliseconds 120
    Send-KeyCombo @($VK_CONTROL) 0x56
    Start-Sleep -Milliseconds 120
    Send-Key $VK_RETURN $false
    Send-Key $VK_RETURN $true
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
