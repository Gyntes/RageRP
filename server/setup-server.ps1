param(
  [Parameter(Mandatory = $true)]
  [string]$ServerFiles
)

$ErrorActionPreference = 'Stop'

$serverFiles = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($ServerFiles)
$serverRoot = Split-Path -Parent $PSScriptRoot
$serverExe = Join-Path $serverFiles 'ragemp-server.exe'

if (-not (Test-Path -LiteralPath $serverExe -PathType Leaf)) {
  throw "Не найден $serverExe. Укажите распакованную официальную Windows-пачку RAGE MP."
}

$requiredServerSource = @(
  (Join-Path $PSScriptRoot 'resources\ragerp\index.js'),
  (Join-Path $PSScriptRoot 'client_packages\index.js'),
  (Join-Path $PSScriptRoot 'conf.json')
)

foreach ($required in $requiredServerSource) {
  if (-not (Test-Path -LiteralPath $required -PathType Leaf)) {
    throw "В проекте отсутствует обязательный файл: $required"
  }
}

$packageTarget = Join-Path $serverFiles 'packages\ragerp'
$clientTarget = Join-Path $serverFiles 'client_packages'

New-Item -ItemType Directory -Force -Path $packageTarget | Out-Null
New-Item -ItemType Directory -Force -Path $clientTarget | Out-Null

Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'resources\ragerp') -Force |
  Copy-Item -Destination $packageTarget -Recurse -Force
$packageCopy = Join-Path $packageTarget 'index.js'
if (-not (Test-Path -LiteralPath $packageCopy -Type Leaf)) {
  throw "Не удалось установить серверный пакет ragerp."
}

Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'client_packages') -Force |
  Copy-Item -Destination $clientTarget -Recurse -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'conf.json') -Destination (Join-Path $serverFiles 'conf.json') -Force

Write-Host "RAGE MP server configured: $serverFiles"
Write-Host "Run: server\start-server.bat `"$serverFiles`""
