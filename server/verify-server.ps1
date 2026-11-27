$ErrorActionPreference = 'Stop'

$ServerFiles = if ($args[0]) { $args[0] } else { Join-Path $PSScriptRoot 'server-files' }
$serverFiles = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($ServerFiles)
$checks = [ordered]@{}

$checks.serverExe = Test-Path -LiteralPath (Join-Path $serverFiles 'ragemp-server.exe') -PathType Leaf
$checks.serverPackage = Test-Path -LiteralPath (Join-Path $serverFiles 'packages\ragerp\index.js') -PathType Leaf
$checks.clientIndex = Test-Path -LiteralPath (Join-Path $serverFiles 'client_packages\index.js') -PathType Leaf
$checks.projectClientIndex = Test-Path -LiteralPath (Join-Path $PSScriptRoot 'client_packages\index.js') -PathType Leaf
$checks.projectServerIndex = Test-Path -LiteralPath (Join-Path $PSScriptRoot 'resources\ragerp\index.js') -PathType Leaf
$checks.projectMapDlc = Test-Path -LiteralPath (Join-Path $PSScriptRoot 'client_packages\game_resources\dlcpacks\tula_pilot\dlc.rpf') -PathType Leaf
$checks.installedMapDlc = Test-Path -LiteralPath (Join-Path $serverFiles 'client_packages\game_resources\dlcpacks\tula_pilot\dlc.rpf') -PathType Leaf

$conf = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'conf.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$checks.port = [int]$conf.port
$checks.bind = [string]$conf.bind

foreach ($check in $checks.GetEnumerator()) {
  if ($check.Value -eq $false) {
    throw "Verification failed: $($check.Key)"
  }
}

[PSCustomObject]$checks | Format-List
