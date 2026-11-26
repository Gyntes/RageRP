$ErrorActionPreference = 'Stop'

$ServerFiles = $args[0]
if (-not $ServerFiles) {
  throw 'ServerFiles argument is required.'
}
$serverFiles = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($ServerFiles)
$serverExe = Join-Path $serverFiles 'ragemp-server.exe'

if (-not (Test-Path -LiteralPath $serverExe -PathType Leaf)) {
  throw "ragemp-server.exe was not found in $serverFiles"
}

$requiredServerSource = @(
  (Join-Path $PSScriptRoot 'resources\ragerp\index.js'),
  (Join-Path $PSScriptRoot 'client_packages\index.js'),
  (Join-Path $PSScriptRoot 'conf.json'),
  (Join-Path $PSScriptRoot 'resources\tula_pilot_map\meta.xml'),
  (Join-Path $PSScriptRoot 'resources\tula_pilot_map\stream\tula_pilot_greybox.ydr'),
  (Join-Path $PSScriptRoot 'resources\tula_pilot_map\stream\tula_pilot_greybox.ytyp'),
  (Join-Path $PSScriptRoot 'resources\tula_pilot_map\stream\tula_pilot_greybox.ymap')
)

foreach ($required in $requiredServerSource) {
  if (-not (Test-Path -LiteralPath $required -PathType Leaf)) {
    throw "Required project file is missing: $required"
  }
}

$packageTarget = Join-Path $serverFiles 'packages'
$clientTarget = Join-Path $serverFiles 'client_packages'

New-Item -ItemType Directory -Force -Path $packageTarget | Out-Null
New-Item -ItemType Directory -Force -Path $clientTarget | Out-Null

foreach ($resource in Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'resources') -Directory -Force) {
  $resourceTarget = Join-Path $packageTarget $resource.Name
  New-Item -ItemType Directory -Force -Path $resourceTarget | Out-Null
  Get-ChildItem -LiteralPath $resource.FullName -Force |
    Copy-Item -Destination $resourceTarget -Recurse -Force
}

$packageCopy = Join-Path $packageTarget 'ragerp\index.js'
if (-not (Test-Path -LiteralPath $packageCopy -PathType Leaf)) {
  throw 'Ragerp server package was not installed.'
}

Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'client_packages') -Force |
  Copy-Item -Destination $clientTarget -Recurse -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'conf.json') -Destination (Join-Path $serverFiles 'conf.json') -Force

& (Join-Path $PSScriptRoot 'patch-node-loader.ps1') $serverFiles

Write-Host "RAGE MP server configured: $serverFiles"
Write-Host "Run: server\start-server.bat `"$serverFiles`""
