param(
  [ValidateSet('vaz2106', 'vaz2114')]
  [string]$VehicleId = 'vaz2106',
  [string]$CodeWalkerCorePath,
  [string]$NugetPackagesPath,
  [switch]$Force
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$vehicleConfigurations = @{
  vaz2106 = @{
    ModelName = 'ragerp_vaz2106'
    HandlingId = 'vaz2106'
    DeviceName = 'dlc_vaz2106'
    DisplayName = 'VAZ-2106'
  }
  vaz2114 = @{
    ModelName = 'ragerp_vaz2114'
    HandlingId = 'vaz2114'
    DeviceName = 'dlc_vaz2114'
    DisplayName = 'VAZ-2114 Samara'
  }
}
$vehicleConfiguration = $vehicleConfigurations[$VehicleId]
$modelName = $vehicleConfiguration.ModelName
$handlingId = $vehicleConfiguration.HandlingId
$deviceName = $vehicleConfiguration.DeviceName
$changeSetName = "${VehicleId}_STARTUP".ToUpperInvariant()
$contentDeviceName = "${deviceName}CRC"
$assetDirectory = Join-Path $PSScriptRoot "$VehicleId\stream"
$serverPackages = Join-Path $projectRoot "server\client_packages\game_resources\dlcpacks\$VehicleId"
$serverDlc = Join-Path $serverPackages 'dlc.rpf'
$vehiclesMeta = Join-Path $serverPackages 'vehicles.meta'
$handlingMeta = Join-Path $serverPackages 'handling.meta'
$assetFiles = @("$modelName.yft", "${modelName}_hi.yft", "$modelName.ytd")
$timestamp = [DateTime]::Now.ToString('dd/MM/yyyy HH:mm:ss', [Globalization.CultureInfo]::InvariantCulture)

if (-not $CodeWalkerCorePath) {
  $CodeWalkerCorePath = Join-Path $projectRoot 'tools\CodeWalker\CodeWalker.Core\bin\Release\netstandard2.0\CodeWalker.Core.dll'
}
if (-not $NugetPackagesPath) {
  $NugetPackagesPath = Join-Path $env:USERPROFILE '.nuget\packages'
}

$CodeWalkerCorePath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($CodeWalkerCorePath)
if (-not (Test-Path -LiteralPath $CodeWalkerCorePath -PathType Leaf)) {
  throw "CodeWalker.Core.dll was not found: $CodeWalkerCorePath. Install or build CodeWalker.Core first."
}
foreach ($requiredFile in (($assetFiles | ForEach-Object {
  Join-Path $assetDirectory $_
}) + @($vehiclesMeta, $handlingMeta))) {
  if (-not (Test-Path -LiteralPath $requiredFile -PathType Leaf)) {
    throw "Required $($vehicleConfiguration.DisplayName) file is missing: $requiredFile"
  }
}
if ((Test-Path -LiteralPath $serverDlc) -and -not $Force) {
  throw "DLC already exists: $serverDlc. Use -Force to replace this file."
}

$vehiclesDocument = New-Object System.Xml.XmlDocument
$vehiclesDocument.Load($vehiclesMeta)
$modelNode = $vehiclesDocument.SelectSingleNode('/CVehicleModelInfo__InitDataList/InitDatas/Item/modelName')
$handlingNode = $vehiclesDocument.SelectSingleNode('/CVehicleModelInfo__InitDataList/InitDatas/Item/handlingId')
if (-not $modelNode -or $modelNode.InnerText -ne $modelName -or
    -not $handlingNode -or $handlingNode.InnerText -ne $handlingId) {
  throw "vehicles.meta must define model $modelName and handling entry $handlingId."
}
$handlingDocument = New-Object System.Xml.XmlDocument
$handlingDocument.Load($handlingMeta)
$handlingNode = $handlingDocument.SelectSingleNode('/CHandlingDataMgr/HandlingData/Item/handlingName')
if (-not $handlingNode -or $handlingNode.InnerText -ne $handlingId) {
  throw "handling.meta must define the $handlingId CHandlingData entry."
}

$nugetRoot = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($NugetPackagesPath)
$sharpDxPath = Join-Path $nugetRoot 'sharpdx\4.2.0\lib\netstandard1.1\SharpDX.dll'
$sharpDxMathPath = Join-Path $nugetRoot 'sharpdx.mathematics\4.2.0\lib\netstandard1.1\SharpDX.Mathematics.dll'
foreach ($dependency in @($sharpDxPath, $sharpDxMathPath)) {
  if (-not (Test-Path -LiteralPath $dependency -PathType Leaf)) {
    throw "CodeWalker dependency was not found: $dependency. Restore CodeWalker.Core first."
  }
  Add-Type -Path $dependency
}
Add-Type -Path $CodeWalkerCorePath

$temporaryDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ("$VehicleId-dlc-" + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $temporaryDirectory | Out-Null
$temporaryDlc = Join-Path $temporaryDirectory 'dlc.rpf'
$encoding = New-Object System.Text.UTF8Encoding($false)

$contentXml = @"
<?xml version="1.0" encoding="UTF-8"?>
<CDataFileMgr__ContentsOfDataFileXml>
  <disabledFiles />
  <includedXmlFiles />
  <includedDataFiles />
  <dataFiles>
    <Item>
      <filename>${contentDeviceName}:/common/data/vehicles.meta</filename>
      <fileType>VEHICLE_METADATA_FILE</fileType>
      <overlay value="true" />
      <disabled value="true" />
      <persistent value="true" />
    </Item>
    <Item>
      <filename>${contentDeviceName}:/common/data/handling.meta</filename>
      <fileType>HANDLING_FILE</fileType>
      <overlay value="true" />
      <disabled value="true" />
      <persistent value="true" />
    </Item>
    <Item>
      <filename>${contentDeviceName}:/%PLATFORM%/levels/gta5/vehicles.rpf</filename>
      <fileType>RPF_FILE</fileType>
      <overlay value="true" />
      <disabled value="true" />
      <persistent value="true" />
      <contents>CONTENTS_DLC_VEHICLE_DATA</contents>
    </Item>
  </dataFiles>
  <contentChangeSets>
    <Item>
      <changeSetName>$changeSetName</changeSetName>
      <filesToInvalidate />
      <filesToDisable />
      <filesToEnable>
        <Item>${contentDeviceName}:/common/data/vehicles.meta</Item>
        <Item>${contentDeviceName}:/common/data/handling.meta</Item>
        <Item>${contentDeviceName}:/%PLATFORM%/levels/gta5/vehicles.rpf</Item>
      </filesToEnable>
      <txdToLoad />
      <txdToUnload />
      <residentResources />
      <unregisterResources />
    </Item>
  </contentChangeSets>
  <patchFiles />
</CDataFileMgr__ContentsOfDataFileXml>
"@

$setup2Xml = @"
<?xml version="1.0" encoding="UTF-8"?>
<SSetupData>
  <deviceName>$deviceName</deviceName>
  <datFile>content.xml</datFile>
  <timeStamp>$timestamp</timeStamp>
  <nameHash>$VehicleId</nameHash>
  <contentChangeSets />
  <contentChangeSetGroups>
    <Item>
      <NameHash>GROUP_STARTUP</NameHash>
      <ContentChangeSets>
        <Item>$changeSetName</Item>
      </ContentChangeSets>
    </Item>
  </contentChangeSetGroups>
  <startupScript />
  <scriptCallstackSize value="0" />
  <type>EXTRACONTENT_COMPAT_PACK</type>
  <order value="90" />
  <minorOrder value="0" />
  <isLevelPack value="false" />
  <dependencyPackHash />
  <requiredVersion />
  <subPackCount value="0" />
</SSetupData>
"@

try {
  $rpfEncryption = [CodeWalker.GameFiles.RpfEncryption]::OPEN
  $rootArchive = [CodeWalker.GameFiles.RpfFile]::CreateNew($temporaryDirectory, 'dlc.rpf', $rpfEncryption)
  [void][CodeWalker.GameFiles.RpfFile]::CreateFile($rootArchive.Root, 'content.xml', $encoding.GetBytes($contentXml))
  [void][CodeWalker.GameFiles.RpfFile]::CreateFile($rootArchive.Root, 'setup2.xml', $encoding.GetBytes($setup2Xml))

  $common = [CodeWalker.GameFiles.RpfFile]::CreateDirectory($rootArchive.Root, 'common')
  $data = [CodeWalker.GameFiles.RpfFile]::CreateDirectory($common, 'data')
  [void][CodeWalker.GameFiles.RpfFile]::CreateFile(
    $data, 'vehicles.meta', [System.IO.File]::ReadAllBytes($vehiclesMeta)
  )
  [void][CodeWalker.GameFiles.RpfFile]::CreateFile(
    $data, 'handling.meta', [System.IO.File]::ReadAllBytes($handlingMeta)
  )

  $x64 = [CodeWalker.GameFiles.RpfFile]::CreateDirectory($rootArchive.Root, 'x64')
  $levels = [CodeWalker.GameFiles.RpfFile]::CreateDirectory($x64, 'levels')
  $gta5 = [CodeWalker.GameFiles.RpfFile]::CreateDirectory($levels, 'gta5')
  $vehiclesArchive = [CodeWalker.GameFiles.RpfFile]::CreateNew($gta5, 'vehicles.rpf', $rpfEncryption)
  foreach ($assetFile in $assetFiles) {
    [void][CodeWalker.GameFiles.RpfFile]::CreateFile(
      $vehiclesArchive.Root,
      $assetFile,
      [System.IO.File]::ReadAllBytes((Join-Path $assetDirectory $assetFile))
    )
  }

  $probe = New-Object -TypeName CodeWalker.GameFiles.RpfFile -ArgumentList @($temporaryDlc, 'dlc.rpf')
  $probe.ScanStructure({ param($status) }, { param($error) throw $error })
  foreach ($expectedEntry in @('content.xml', 'setup2.xml', 'vehicles.meta', 'handling.meta')) {
    if (-not ($probe.AllEntries | Where-Object { $_.NameLower -eq $expectedEntry })) {
      throw "The generated DLC is missing $expectedEntry."
    }
  }
  $contentEntry = $probe.AllEntries |
    Where-Object { $_.NameLower -eq 'content.xml' } |
    Select-Object -First 1
  $contentText = [System.Text.Encoding]::UTF8.GetString($probe.ExtractFile($contentEntry))
  if ($contentText -notmatch 'VEHICLE_METADATA_FILE' -or
      $contentText -notmatch 'HANDLING_FILE' -or
      $contentText -notmatch 'CONTENTS_DLC_VEHICLE_DATA' -or
      $contentText -notmatch [regex]::Escape($changeSetName) -or
      $contentText -notmatch [regex]::Escape("${contentDeviceName}:")) {
    throw "content.xml does not register and enable $($vehicleConfiguration.DisplayName) data."
  }
  $setupEntry = $probe.AllEntries |
    Where-Object { $_.NameLower -eq 'setup2.xml' } |
    Select-Object -First 1
  $setupText = [System.Text.Encoding]::UTF8.GetString($probe.ExtractFile($setupEntry))
  if ($setupText -notmatch [regex]::Escape("<deviceName>$deviceName</deviceName>") -or
      $setupText -notmatch [regex]::Escape("<nameHash>$VehicleId</nameHash>") -or
      $setupText -notmatch '<timeStamp>\d{2}/\d{2}/\d{4} \d{2}:\d{2}:\d{2}</timeStamp>') {
    throw 'setup2.xml has an invalid device name, hash, or timestamp.'
  }
  $vehiclesArchiveEntry = $probe.Children |
    Where-Object { $_.NameLower -eq 'vehicles.rpf' } |
    Select-Object -First 1
  if (-not $vehiclesArchiveEntry) {
    throw 'The generated DLC is missing vehicles.rpf.'
  }
  foreach ($assetFile in $assetFiles) {
    if (-not ($vehiclesArchiveEntry.AllEntries | Where-Object { $_.NameLower -eq $assetFile })) {
      throw "The generated vehicle archive is missing $assetFile."
    }
  }

  if (Test-Path -LiteralPath $serverDlc) {
    Remove-Item -LiteralPath $serverDlc -Force
  }
  Move-Item -LiteralPath $temporaryDlc -Destination $serverDlc
  Write-Host "Built $($vehicleConfiguration.DisplayName) RAGE:MP DLC: $serverDlc"
  Write-Host ("Archive size: {0:N0} bytes" -f (Get-Item -LiteralPath $serverDlc).Length)
}
finally {
  if (Test-Path -LiteralPath $temporaryDirectory) {
    Remove-Item -LiteralPath $temporaryDirectory -Recurse -Force
  }
}
