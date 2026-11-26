$ErrorActionPreference = 'Stop'

$ServerFiles = if ($args[0]) { $args[0] } else { Join-Path $PSScriptRoot 'server-files' }
$serverFiles = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($ServerFiles)
$checks = [ordered]@{}

$checks.serverExe = Test-Path -LiteralPath (Join-Path $serverFiles 'ragemp-server.exe') -PathType Leaf
$checks.serverPackage = Test-Path -LiteralPath (Join-Path $serverFiles 'packages\ragerp\index.js') -PathType Leaf
$checks.clientIndex = Test-Path -LiteralPath (Join-Path $serverFiles 'client_packages\index.js') -PathType Leaf
$checks.projectClientIndex = Test-Path -LiteralPath (Join-Path $PSScriptRoot 'client_packages\index.js') -PathType Leaf
$checks.projectServerIndex = Test-Path -LiteralPath (Join-Path $PSScriptRoot 'resources\ragerp\index.js') -PathType Leaf
$checks.projectMapMeta = Test-Path -LiteralPath (Join-Path $PSScriptRoot 'resources\tula_pilot_map\meta.xml') -PathType Leaf
$checks.installedMapYdr = Test-Path -LiteralPath (Join-Path $serverFiles 'packages\tula_pilot_map\stream\tula_pilot_greybox.ydr') -PathType Leaf
$checks.installedMapYtyp = Test-Path -LiteralPath (Join-Path $serverFiles 'packages\tula_pilot_map\stream\tula_pilot_greybox.ytyp') -PathType Leaf
$checks.installedMapYmap = Test-Path -LiteralPath (Join-Path $serverFiles 'packages\tula_pilot_map\stream\tula_pilot_greybox.ymap') -PathType Leaf

$conf = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'conf.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$checks.port = [int]$conf.port
$checks.bind = [string]$conf.bind

foreach ($check in $checks.GetEnumerator()) {
  if ($check.Value -eq $false) {
    throw "Verification failed: $($check.Key)"
  }
}

[PSCustomObject]$checks | Format-List
