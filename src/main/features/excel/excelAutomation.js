const { spawn } = require('child_process');

class ExcelAutomationService {
  constructor(options = {}) {
    this.powershellCommand = this.resolvePowerShellCommand();
    this.commandTimeoutMs = options.commandTimeoutMs || 8000;
  }

  encodePayload(payload = {}) {
    try {
      const json = JSON.stringify(payload ?? {});
      return Buffer.from(json, 'utf8').toString('base64');
    } catch {
      return Buffer.from('{}', 'utf8').toString('base64');
    }
  }

  resolvePowerShellCommand() {
    if (process.platform === 'win32') return 'powershell.exe';
    if (process.env.WSL_DISTRO_NAME) return 'powershell.exe';
    return null;
  }

  ensureSupported() {
    if (!this.powershellCommand) {
      throw new Error('Excel 연동은 Windows 환경에서만 지원됩니다.');
    }
  }

  runPowerShell(script, args = [], { timeoutMs } = {}) {
    this.ensureSupported();
    return new Promise((resolve, reject) => {
      const ps = spawn(
        this.powershellCommand,
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script, ...args],
        { windowsHide: true }
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

  async getSelection() {
    const script = `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$excel = $null
try {
  $excel = [Runtime.InteropServices.Marshal]::GetActiveObject('Excel.Application')
} catch {
  throw '실행 중인 Excel 인스턴스를 찾을 수 없습니다. 먼저 엑셀 파일을 열어주세요.'
}
if (-not $excel) { throw 'Excel 인스턴스를 가져오지 못했습니다.' }
$selection = $excel.Selection
if (-not $selection) { throw '엑셀에서 셀을 먼저 선택한 뒤 다시 시도하세요.' }
$cell = $selection.Cells.Item(1)
$sheet = $excel.ActiveSheet
$workbook = $excel.ActiveWorkbook
$result = [pscustomobject]@{
  Workbook = if ($workbook) { $workbook.Name } else { $null }
  Worksheet = if ($sheet) { $sheet.Name } else { $null }
  Address = $cell.Address($false, $false)
  Row = $cell.Row
  Column = $cell.Column
  Text = $cell.Text
}
$result | ConvertTo-Json -Depth 4 -Compress
`;
    try {
      const raw = await this.runPowerShell(script);
      const data = raw ? JSON.parse(raw) : null;
      if (!data) {
        return { success: false, message: '엑셀 선택 정보를 파싱하지 못했습니다.' };
      }
      return { success: true, data };
    } catch (err) {
      return { success: false, message: err?.message || String(err) };
    }
  }

  async applyOffsets(payload = {}) {
    if (!payload.baseRow || !payload.baseColumn) {
      return { success: false, message: '기준 셀 정보가 누락되었습니다.' };
    }
    const script = `
& {
param([string]$payloadBase64)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$payloadJson = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($payloadBase64))
$payload = $payloadJson | ConvertFrom-Json
if (-not $payload) { throw 'payload 파싱에 실패했습니다.' }
try { Add-Type -AssemblyName System.Drawing } catch {}
$excel = $null
try {
  $excel = [Runtime.InteropServices.Marshal]::GetActiveObject('Excel.Application')
} catch {
  throw '실행 중인 Excel 인스턴스를 찾을 수 없습니다. 엑셀을 먼저 실행해주세요.'
}
if (-not $excel) { throw 'Excel 인스턴스를 찾지 못했습니다.' }
$targetSheet = $excel.ActiveSheet
if ($payload.workbook -and $payload.worksheet) {
  foreach ($book in $excel.Workbooks) {
    if ($book.Name -eq $payload.workbook) {
      $book.Activate() | Out-Null
      $candidate = $book.Worksheets | Where-Object { $_.Name -eq $payload.worksheet } | Select-Object -First 1
      if ($candidate) {
        $candidate.Activate() | Out-Null
        $targetSheet = $candidate
      }
      break
    }
  }
}
if (-not $targetSheet) { throw '대상 시트를 찾을 수 없습니다.' }
$baseRow = [int]$payload.baseRow
$baseCol = [int]$payload.baseColumn
foreach ($update in $payload.updates) {
  $rowOffset = [int]$update.rowOffset
  $colOffset = [int]$update.colOffset
  $targetRow = $baseRow + $rowOffset
  $targetCol = $baseCol + $colOffset
  if ($targetRow -lt 1 -or $targetCol -lt 1) { continue }
  $cell = $targetSheet.Cells.Item($targetRow, $targetCol)
  if (-not $cell) { continue }
  if ($null -eq $update.value) {
    $cell.ClearContents() | Out-Null
  } else {
    $value = $update.value
    if ($value -is [double] -or $value -is [float] -or $value -is [decimal] -or $value -is [int] -or $value -is [long]) {
      $cell.Value2 = [double]$value
    } else {
      $cell.Value2 = [string]$value
    }
  }
  if ($update.fillColor) {
    try {
      $hex = [string]$update.fillColor
      if ([string]::IsNullOrWhiteSpace($hex) -eq $false) {
        if (-not $hex.StartsWith('#')) { $hex = '#'+$hex }
        $colorObj = [System.Drawing.ColorTranslator]::FromHtml($hex)
        $oleColor = [System.Drawing.ColorTranslator]::ToOle($colorObj)
        $cell.Interior.Color = $oleColor
      }
    } catch {}
  } elseif ($update.clearFill) {
    try {
      $cell.Interior.ColorIndex = -4142
    } catch {}
  }
}
[pscustomobject]@{ success = $true } | ConvertTo-Json -Compress
}`;
    try {
      const raw = await this.runPowerShell(script, [this.encodePayload(payload)]);
      const data = raw ? JSON.parse(raw) : null;
      if (!data?.success) {
        return { success: false, message: '엑셀 업데이트가 실패했습니다.' };
      }
      return { success: true };
    } catch (err) {
      return { success: false, message: err?.message || String(err) };
    }
  }

  async readOffsets(payload = {}) {
    if (!payload.baseRow || !payload.baseColumn || !Array.isArray(payload.requests)) {
      return { success: false, message: '읽을 셀 정보가 부족합니다.' };
    }
    const script = `
& {
param([string]$payloadBase64)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$payloadJson = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($payloadBase64))
$payload = $payloadJson | ConvertFrom-Json
if (-not $payload) { throw 'payload 파싱에 실패했습니다.' }
$excel = $null
try {
  $excel = [Runtime.InteropServices.Marshal]::GetActiveObject('Excel.Application')
} catch {
  throw '실행 중인 Excel 인스턴스를 찾을 수 없습니다.'
}
if (-not $excel) { throw 'Excel 인스턴스를 찾지 못했습니다.' }
$targetSheet = $excel.ActiveSheet
if ($payload.workbook -and $payload.worksheet) {
  foreach ($book in $excel.Workbooks) {
    if ($book.Name -eq $payload.workbook) {
      $book.Activate() | Out-Null
      $candidate = $book.Worksheets | Where-Object { $_.Name -eq $payload.worksheet } | Select-Object -First 1
      if ($candidate) {
        $candidate.Activate() | Out-Null
        $targetSheet = $candidate
      }
      break
    }
  }
}
if (-not $targetSheet) { throw '대상 시트를 찾을 수 없습니다.' }
$baseRow = [int]$payload.baseRow
$baseCol = [int]$payload.baseColumn
$items = @()
foreach ($req in $payload.requests) {
  $rowOffset = [int]$req.rowOffset
  $colOffset = [int]$req.colOffset
  $targetRow = $baseRow + $rowOffset
  $targetCol = $baseCol + $colOffset
  if ($targetRow -lt 1 -or $targetCol -lt 1) { continue }
  $cell = $targetSheet.Cells.Item($targetRow, $targetCol)
  if (-not $cell) { continue }
$items += [pscustomobject]@{
  key = $req.key
  row = $targetRow
  column = $targetCol
  value = $cell.Value2
  text = $cell.Text
}
}
[pscustomobject]@{ success = $true; items = $items } | ConvertTo-Json -Depth 5 -Compress
}`;
    try {
      const raw = await this.runPowerShell(script, [this.encodePayload(payload)]);
      const data = raw ? JSON.parse(raw) : null;
      if (!data?.success) {
        return { success: false, message: '엑셀 셀 읽기에 실패했습니다.' };
      }
      return { success: true, items: data.items || [] };
    } catch (err) {
      return { success: false, message: err?.message || String(err) };
    }
  }

  async exportAgreementExcelCom(payload = {}) {
    const script = `
& {
param([string]$payloadBase64)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$payloadJson = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($payloadBase64))
$payload = $payloadJson | ConvertFrom-Json
if (-not $payload) { throw 'payload 파싱에 실패했습니다.' }
try { Add-Type -AssemblyName System.Drawing } catch {}
$excel = $null
$templateWb = $null
$targetWb = $null
$ws = $null
function Resolve-UniqueSheetName($workbook, $desired) {
  if (-not $desired) { return $null }
  $name = [string]$desired
  $exists = $false
  foreach ($s in $workbook.Worksheets) {
    if ($s.Name -eq $name) { $exists = $true; break }
  }
  if (-not $exists) { return $name }
  $base = $name -replace "\\(\\d+\\)$",""
  for ($i = 2; $i -lt 1000; $i++) {
    $candidate = ($base.Substring(0, [Math]::Min($base.Length, 31 - ($i.ToString().Length + 2)))) + "($i)"
    $exists = $false
    foreach ($s in $workbook.Worksheets) {
      if ($s.Name -eq $candidate) { $exists = $true; break }
    }
    if (-not $exists) { return $candidate }
  }
  return $name.Substring(0, [Math]::Min($name.Length, 31))
}

try {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false

  $templateWb = $excel.Workbooks.Open([string]$payload.templatePath)
  if (-not $templateWb) { throw '템플릿 파일을 열지 못했습니다.' }
  if ($payload.sheetName) {
    $ws = $templateWb.Worksheets.Item([string]$payload.sheetName)
  }
  if (-not $ws) { $ws = $templateWb.Worksheets.Item(1) }
  if (-not $ws) { throw '엑셀 시트를 찾을 수 없습니다.' }

  if ($payload.renameSheet) {
    $ws.Name = [string]$payload.renameSheet
  }

  foreach ($update in $payload.updates) {
    $addr = [string]$update.address
    if (-not $addr) { continue }
    $cell = $ws.Range($addr)
    if (-not $update.noValueChange) {
      if ($null -eq $update.value -and -not $update.formula) {
        $cell.ClearContents() | Out-Null
      } elseif ($update.formula) {
        $cell.Formula = [string]$update.formula
      } else {
        $val = $update.value
        if ($val -is [double] -or $val -is [float] -or $val -is [decimal] -or $val -is [int] -or $val -is [long]) {
          $cell.Value2 = [double]$val
        } else {
          $cell.Value2 = [string]$val
        }
      }
    }
    if ($update.numFmt) {
      $cell.NumberFormat = [string]$update.numFmt
    }
    if ($update.fillColor) {
      try {
        $hex = [string]$update.fillColor
        if (-not $hex.StartsWith('#')) { $hex = '#'+$hex }
        $colorObj = [System.Drawing.ColorTranslator]::FromHtml($hex)
        $oleColor = [System.Drawing.ColorTranslator]::ToOle($colorObj)
        $cell.Interior.Color = $oleColor
      } catch {}
    } elseif ($update.clearFill) {
      try { $cell.Interior.ColorIndex = -4142 } catch {}
    }
  }

  if ($payload.appendTargetPath) {
    $targetWb = $excel.Workbooks.Open([string]$payload.appendTargetPath)
    if (-not $targetWb) { throw '대상 엑셀 파일을 열지 못했습니다.' }
    $desiredName = if ($payload.renameSheet) { [string]$payload.renameSheet } else { [string]$ws.Name }
    $resolvedName = Resolve-UniqueSheetName $targetWb $desiredName
    $ws.Copy([Type]::Missing, $targetWb.Worksheets.Item($targetWb.Worksheets.Count)) | Out-Null
    $newSheet = $targetWb.Worksheets.Item($targetWb.Worksheets.Count)
    if ($resolvedName) { $newSheet.Name = $resolvedName }
    $targetWb.Save()
    $templateWb.Close($false)
    $targetWb.Close($true)
    [pscustomobject]@{ success = $true; path = $payload.appendTargetPath; sheetName = $resolvedName } | ConvertTo-Json -Compress
  } else {
    $templateWb.SaveAs([string]$payload.outputPath)
    $templateWb.Close($false)
    [pscustomobject]@{ success = $true; path = $payload.outputPath; sheetName = $ws.Name } | ConvertTo-Json -Compress
  }
} finally {
  if ($targetWb) { try { [System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($targetWb) | Out-Null } catch {} }
  if ($templateWb) { try { [System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($templateWb) | Out-Null } catch {} }
  if ($ws) { try { [System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($ws) | Out-Null } catch {} }
  if ($excel) { try { $excel.Quit() | Out-Null } catch {} }
  if ($excel) { try { [System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($excel) | Out-Null } catch {} }
}
}
`;
    try {
      const raw = await this.runPowerShell(script, [this.encodePayload(payload)], { timeoutMs: 60000 });
      const data = raw ? JSON.parse(raw) : null;
      if (!data?.success) {
        throw new Error(data?.message || '엑셀 COM 내보내기에 실패했습니다.');
      }
      return { success: true, path: data.path, sheetName: data.sheetName };
    } catch (err) {
      return { success: false, message: err?.message || String(err) };
    }
  }
}

module.exports = { ExcelAutomationService };
