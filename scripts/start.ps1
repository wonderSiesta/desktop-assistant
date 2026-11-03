param([switch]$CreateShortcutOnly,[switch]$UpdateDesktopShortcut)
$ErrorActionPreference = 'Stop'
$projectDir = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$package = Get-Content -LiteralPath (Join-Path $projectDir 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$outputDir = Join-Path $projectDir $package.build.directories.output
$packedExe = Join-Path $outputDir ('win-unpacked\' + $package.build.productName + '.exe')
if (Test-Path -LiteralPath $packedExe) {
  $target = $packedExe
  $targetArguments = ''
} else {
  $target = Join-Path $projectDir 'node_modules\electron\dist\electron.exe'
  $targetArguments = '.'
  if (-not (Test-Path -LiteralPath $target)) { throw 'Dependencies missing. Run npm ci in the project directory first.' }
  Set-Location -LiteralPath $projectDir
  if (-not (Test-Path -LiteralPath (Join-Path $projectDir 'dist-electron\main.js'))) {
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Build failed. See the output above.' }
  }
}
# Explorer launches a native shortcut; no persistent terminal parent is needed.
$shortcutPath = Join-Path $projectDir 'DesktopAssistant.lnk'
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $target
$shortcut.Arguments = $targetArguments
$shortcut.WorkingDirectory = $projectDir
$iconPath = Join-Path $projectDir 'build-resources\desktop-assistant.ico'
$shortcut.IconLocation = if (Test-Path -LiteralPath $iconPath) { $iconPath + ',0' } else { $target + ',0' }
$shortcut.Description = 'Desktop Assistant'
$shortcut.WindowStyle = 1
$shortcut.Save()
$friendlyShortcutPath = Join-Path $projectDir ($package.build.productName + '.lnk')
Copy-Item -LiteralPath $shortcutPath -Destination $friendlyShortcutPath -Force
if ($UpdateDesktopShortcut) {
  $desktopDir = [Environment]::GetFolderPath('Desktop')
  $desktopShortcutPath = Join-Path $desktopDir ($package.build.productName + '.lnk')
  if (Test-Path -LiteralPath $desktopShortcutPath) {
    $existing = $shell.CreateShortcut($desktopShortcutPath)
    if (-not $existing.TargetPath.StartsWith($projectDir + '\',[StringComparison]::OrdinalIgnoreCase)) { throw 'An unrelated desktop shortcut with this name was preserved.' }
  }
  Copy-Item -LiteralPath $friendlyShortcutPath -Destination $desktopShortcutPath -Force
}
if ($CreateShortcutOnly) {
  Write-Output 'DesktopAssistant.lnk is ready. Double-click it to launch without a terminal.'
  exit 0
}
$explorer = New-Object -ComObject Shell.Application
$explorer.ShellExecute($shortcutPath, '', $projectDir, 'open', 1)
