param(
  [string]$InstallerPath = "",
  [switch]$LeaveInstalled
)

$ErrorActionPreference = "Stop"
if ($env:PASKO_INSTALLER_ACCEPTANCE -ne "YES") {
  throw "Set PASKO_INSTALLER_ACCEPTANCE=YES only on a disposable Windows acceptance machine."
}

$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\..\.."))
if (-not $InstallerPath) {
  $InstallerPath = Join-Path $repositoryRoot "release\PASKO-Performance-Volleyball-Setup-1.0.0.exe"
}
$InstallerPath = [IO.Path]::GetFullPath($InstallerPath)
if (-not (Test-Path -LiteralPath $InstallerPath -PathType Leaf)) {
  throw "Installer not found: $InstallerPath"
}

$installRoot = Join-Path $env:LOCALAPPDATA "pasko_performance"
$dataRoot = Join-Path $env:LOCALAPPDATA "PaskoPerformance"
$installedExe = Join-Path $installRoot "app-1.0.0\PaskoPerformance.exe"
$updateExe = Join-Path $installRoot "Update.exe"
$installationFile = Join-Path $dataRoot "security\installation.json"
$installationHashBefore = if (Test-Path -LiteralPath $installationFile) {
  (Get-FileHash -Algorithm SHA256 -LiteralPath $installationFile).Hash
} else { $null }
$databaseExistedBefore = Test-Path -LiteralPath (Join-Path $dataRoot "database\pg16\PG_VERSION")

function Wait-Condition([scriptblock]$Condition, [string]$Failure, [int]$Seconds = 30) {
  $deadline = [DateTime]::UtcNow.AddSeconds($Seconds)
  do {
    if (& $Condition) { return }
    Start-Sleep -Milliseconds 250
  } while ([DateTime]::UtcNow -lt $deadline)
  throw $Failure
}

function Get-ShellLocations {
  $shell = New-Object -ComObject WScript.Shell
  [pscustomobject]@{
    Desktop = [string]$shell.SpecialFolders.Item("Desktop")
    Programs = [string]$shell.SpecialFolders.Item("Programs")
  }
}

function Get-PaskoShortcuts {
  $locations = Get-ShellLocations
  $desktop = @(Get-ChildItem -LiteralPath $locations.Desktop -Filter "PASKO Performance.lnk" -File -ErrorAction SilentlyContinue)
  $startMenu = @(Get-ChildItem -LiteralPath $locations.Programs -Filter "PASKO Performance.lnk" -File -Recurse -ErrorAction SilentlyContinue)
  [pscustomobject]@{ Locations = $locations; Desktop = $desktop; StartMenu = $startMenu }
}

function Assert-Shortcut([IO.FileInfo]$Shortcut) {
  $shell = New-Object -ComObject WScript.Shell
  $link = $shell.CreateShortcut($Shortcut.FullName)
  if ([IO.Path]::GetFileName($link.TargetPath) -ne "PaskoPerformance.exe") {
    throw "Unexpected shortcut target: $($link.TargetPath)"
  }
  if (-not (Test-Path -LiteralPath $link.TargetPath -PathType Leaf)) {
    throw "Shortcut target does not exist: $($link.TargetPath)"
  }
  if ([IO.Path]::GetFileName(($link.IconLocation -split ',')[0]) -ne "PaskoPerformance.exe") {
    throw "Unexpected shortcut icon: $($link.IconLocation)"
  }
}

function Assert-ShortcutsPresent {
  $links = Get-PaskoShortcuts
  if ($links.Desktop.Count -ne 1) { throw "Expected one Desktop shortcut, found $($links.Desktop.Count)" }
  if ($links.StartMenu.Count -ne 1) { throw "Expected one Start Menu shortcut, found $($links.StartMenu.Count)" }
  Assert-Shortcut $links.Desktop[0]
  Assert-Shortcut $links.StartMenu[0]
  $publicDesktop = Join-Path $env:PUBLIC "Desktop"
  $commonPrograms = Join-Path $env:ProgramData "Microsoft\Windows\Start Menu\Programs"
  if (@(Get-ChildItem -LiteralPath $publicDesktop -Filter "PASKO Performance.lnk" -File -Recurse -ErrorAction SilentlyContinue).Count) {
    throw "Unexpected public Desktop shortcut"
  }
  if (@(Get-ChildItem -LiteralPath $commonPrograms -Filter "PASKO Performance.lnk" -File -Recurse -ErrorAction SilentlyContinue).Count) {
    throw "Unexpected machine-wide Start Menu shortcut"
  }
  return $links
}

function Assert-ShortcutsAbsent {
  $links = Get-PaskoShortcuts
  if ($links.Desktop.Count -or $links.StartMenu.Count) { throw "Application shortcut remains after uninstall" }
}

function Stop-PaskoApplication {
  $mainProcesses = @(Get-CimInstance Win32_Process -Filter "Name='PaskoPerformance.exe'" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -notmatch "--type=" })
  foreach ($process in $mainProcesses) {
    $native = Get-Process -Id $process.ProcessId -ErrorAction SilentlyContinue
    if ($native) { [void]$native.CloseMainWindow() }
  }
  if ($mainProcesses.Count) {
    Wait-Condition { -not @(Get-CimInstance Win32_Process -Filter "Name='PaskoPerformance.exe'" -ErrorAction SilentlyContinue).Count } "PASKO process did not close cleanly" 30
  }
}

function Install-Pasko {
  $process = Start-Process -FilePath $InstallerPath -ArgumentList "--silent" -PassThru -Wait
  if ($process.ExitCode -ne 0) { throw "Setup exited with $($process.ExitCode)" }
  Wait-Condition { Test-Path -LiteralPath $installedExe -PathType Leaf } "Installed executable was not created" 60
  Wait-Condition { $links = Get-PaskoShortcuts; $links.Desktop.Count -eq 1 -and $links.StartMenu.Count -eq 1 } "Squirrel shortcuts were not created" 30
  Assert-ShortcutsPresent
}

function Uninstall-Pasko {
  Stop-PaskoApplication
  if (-not (Test-Path -LiteralPath $updateExe -PathType Leaf)) { throw "Update.exe not found for uninstall" }
  $process = Start-Process -FilePath $updateExe -ArgumentList "--uninstall", "-s" -PassThru -Wait
  if ($process.ExitCode -ne 0) { throw "Uninstall exited with $($process.ExitCode)" }
  Wait-Condition { Test-Path -LiteralPath (Join-Path $installRoot ".dead") } "Squirrel uninstall tombstone was not created" 60
  Assert-ShortcutsAbsent
  Assert-ArpAbsent
}

function Assert-ArpEntry {
  $entry = Get-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*" -ErrorAction SilentlyContinue |
    Where-Object { $_.UninstallString -like "*$installRoot*" } |
    Select-Object -First 1
  if (-not $entry) { throw "Per-user Add/Remove Programs entry not found" }
  if ($entry.DisplayName -ne "PASKO Performance" -or $entry.DisplayVersion -ne "1.0.0") {
    throw "Unexpected Add/Remove Programs identity/version"
  }
  return $entry
}

function Assert-ArpAbsent {
  $entry = Get-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*" -ErrorAction SilentlyContinue |
    Where-Object { $_.UninstallString -like "*$installRoot*" } |
    Select-Object -First 1
  if ($entry) { throw "Add/Remove Programs entry remains after uninstall" }
}

function Assert-DataPreserved {
  if ($installationHashBefore) {
    if (-not (Test-Path -LiteralPath $installationFile)) { throw "Installation identity was removed" }
    if ((Get-FileHash -Algorithm SHA256 -LiteralPath $installationFile).Hash -ne $installationHashBefore) {
      throw "Installation identity changed"
    }
  }
  if ($databaseExistedBefore -and -not (Test-Path -LiteralPath (Join-Path $dataRoot "database\pg16\PG_VERSION"))) {
    throw "Persistent database was removed"
  }
}

# Establish a clean application install while preserving the separate product data root.
if ((Test-Path -LiteralPath $installedExe) -and -not (Test-Path -LiteralPath (Join-Path $installRoot ".dead"))) {
  Uninstall-Pasko
}
Install-Pasko | Out-Null
$links = Assert-ShortcutsPresent
$arp = Assert-ArpEntry

# Exercise the installed application's real --squirrel-updated handler. It must
# refresh, not duplicate, both links and exit before normal runtime startup.
$updated = Start-Process -FilePath $installedExe -ArgumentList "--squirrel-updated" -PassThru -Wait
if ($updated.ExitCode -ne 0) { throw "--squirrel-updated lifecycle exited with $($updated.ExitCode)" }
$links = Assert-ShortcutsPresent

# Launch through each real Windows shortcut and verify the single-instance contract.
Start-Process -FilePath $links.Desktop[0].FullName
Wait-Condition { @(Get-CimInstance Win32_Process -Filter "Name='PaskoPerformance.exe'" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -notmatch "--type=" }).Count -eq 1 } "Desktop shortcut did not launch one main process" 60
Start-Process -FilePath $links.StartMenu[0].FullName
Start-Sleep -Seconds 2
$mainCount = @(Get-CimInstance Win32_Process -Filter "Name='PaskoPerformance.exe'" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -notmatch "--type=" }).Count
if ($mainCount -ne 1) { throw "Repeated shortcut launch created $mainCount main processes" }
Stop-PaskoApplication

# Same-version reinstall must keep one valid shortcut in each per-user location.
Install-Pasko | Out-Null
Assert-ShortcutsPresent | Out-Null

# Uninstall removes binaries/shell integration but never the separate persistent data root.
Uninstall-Pasko
Assert-DataPreserved

# Reinstall recreates shell integration and reuses the same installation identity/database.
Install-Pasko | Out-Null
Assert-ShortcutsPresent | Out-Null
Assert-ArpEntry | Out-Null
Assert-DataPreserved

if (-not $LeaveInstalled) { Uninstall-Pasko; Assert-DataPreserved }

[pscustomobject]@{
  Result = "PASS"
  DesktopShortcut = $links.Desktop[0].FullName
  StartMenuShortcut = $links.StartMenu[0].FullName
  DisplayName = $arp.DisplayName
  DisplayVersion = $arp.DisplayVersion
  PerUserInstall = $true
  PersistentDataPreserved = $true
  LeftInstalled = [bool]$LeaveInstalled
} | Format-List
