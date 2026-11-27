param(
  [string]$CodeWalkerCorePath,
  [switch]$Force
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$assetDirectory = Join-Path $PSScriptRoot 'tula_pilot_game_asset\gen8'
$serverPackages = Join-Path $projectRoot 'server\client_packages\game_resources\dlcpacks\tula_pilot'
$serverDlc = Join-Path $serverPackages 'dlc.rpf'
$assetName = 'tula_pilot_greybox_v2'
$deviceName = 'dlc_tulapilot'
$contentDeviceName = "${deviceName}CRC"
$archiveName = "$assetName.rpf"
$timestamp = [DateTime]::Now.ToString('dd/MM/yyyy HH:mm:ss', [Globalization.CultureInfo]::InvariantCulture)

if (-not $CodeWalkerCorePath) {
  $CodeWalkerCorePath = Join-Path $projectRoot 'tools\CodeWalker\CodeWalker.Core\bin\Release\netstandard2.0\CodeWalker.Core.dll'
}

$CodeWalkerCorePath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($CodeWalkerCorePath)
if (-not (Test-Path -LiteralPath $CodeWalkerCorePath -PathType Leaf)) {
  throw "CodeWalker.Core.dll was not found: $CodeWalkerCorePath. Build CodeWalker.Core first."
}

$assets = @(
  (Join-Path $assetDirectory "$assetName.ydr"),
  (Join-Path $assetDirectory "$assetName.ytyp"),
  (Join-Path $assetDirectory "$assetName.ymap")
)
foreach ($asset in $assets) {
  if (-not (Test-Path -LiteralPath $asset -PathType Leaf)) {
    throw "Required map asset is missing: $asset. Export the Sollumz assets first."
  }
}

if ((Test-Path -LiteralPath $serverDlc) -and -not $Force) {
  throw "DLC already exists: $serverDlc. Use -Force to replace this file."
}

$nugetRoot = Join-Path $env:USERPROFILE '.nuget\packages'
$sharpDxPath = Join-Path $nugetRoot 'sharpdx\4.2.0\lib\netstandard1.1\SharpDX.dll'
$sharpDxMathPath = Join-Path $nugetRoot 'sharpdx.mathematics\4.2.0\lib\netstandard1.1\SharpDX.Mathematics.dll'
foreach ($dependency in @($sharpDxPath, $sharpDxMathPath)) {
  if (-not (Test-Path -LiteralPath $dependency -PathType Leaf)) {
    throw "CodeWalker dependency was not found: $dependency. Restore CodeWalker.Core first."
  }
  Add-Type -Path $dependency
}
Add-Type -Path $CodeWalkerCorePath

$temporaryDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ("tula-pilot-dlc-" + [Guid]::NewGuid().ToString('N'))
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
      <filename>${contentDeviceName}:/%PLATFORM%/levels/gta5/$archiveName</filename>
      <fileType>RPF_FILE</fileType>
      <overlay value="true" />
      <disabled value="true" />
      <persistent value="true" />
      <contents>CONTENTS_DLC_MAP_DATA</contents>
    </Item>
    <Item>
      <filename>${contentDeviceName}:/%PLATFORM%/levels/gta5/$assetName.ityp</filename>
      <fileType>DLC_ITYP_REQUEST</fileType>
      <overlay value="false" />
      <disabled value="true" />
      <persistent value="false" />
    </Item>
  </dataFiles>
  <contentChangeSets>
    <Item>
      <changeSetName>TULAPILOT_STARTUP</changeSetName>
      <filesToInvalidate />
      <filesToDisable />
      <filesToEnable>
        <Item>${contentDeviceName}:/%PLATFORM%/levels/gta5/$archiveName</Item>
        <Item>${contentDeviceName}:/%PLATFORM%/levels/gta5/$assetName.ityp</Item>
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
  <nameHash>tulapilot</nameHash>
  <contentChangeSets />
  <contentChangeSetGroups>
    <Item>
      <NameHash>GROUP_STARTUP</NameHash>
      <ContentChangeSets>
        <Item>TULAPILOT_STARTUP</Item>
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
  $utf8Bytes = $encoding.GetBytes($contentXml)
  [void][CodeWalker.GameFiles.RpfFile]::CreateFile($rootArchive.Root, 'content.xml', $utf8Bytes)
  $utf8Bytes = $encoding.GetBytes($setup2Xml)
  [void][CodeWalker.GameFiles.RpfFile]::CreateFile($rootArchive.Root, 'setup2.xml', $utf8Bytes)

  $x64 = [CodeWalker.GameFiles.RpfFile]::CreateDirectory($rootArchive.Root, 'x64')
  $levels = [CodeWalker.GameFiles.RpfFile]::CreateDirectory($x64, 'levels')
  $gta5 = [CodeWalker.GameFiles.RpfFile]::CreateDirectory($levels, 'gta5')
  $mapArchive = [CodeWalker.GameFiles.RpfFile]::CreateNew($gta5, $archiveName, $rpfEncryption)

  foreach ($asset in $assets) {
    $assetBytes = [System.IO.File]::ReadAllBytes($asset)
    [void][CodeWalker.GameFiles.RpfFile]::CreateFile($mapArchive.Root, [System.IO.Path]::GetFileName($asset), $assetBytes)
  }
  foreach ($asset in $assets) {
    $assetNameInArchive = [System.IO.Path]::GetFileName($asset).ToLowerInvariant()
    if (-not ($mapArchive.AllEntries | Where-Object { $_.NameLower -eq $assetNameInArchive })) {
      throw "The generated map archive is missing $assetNameInArchive."
    }
  }

  $probe = New-Object -TypeName CodeWalker.GameFiles.RpfFile -ArgumentList @($temporaryDlc, 'dlc.rpf')
  $probe.ScanStructure({ param($status) }, { param($error) throw $error })
  $contentEntry = $probe.AllEntries | Where-Object { $_.NameLower -eq 'content.xml' } | Select-Object -First 1
  if (-not $contentEntry) {
    throw 'The generated DLC is missing content.xml.'
  }
  $contentText = [System.Text.Encoding]::UTF8.GetString($probe.ExtractFile($contentEntry))
  if ($contentText -notmatch 'CONTENTS_DLC_MAP_DATA' -or
      $contentText -notmatch 'DLC_ITYP_REQUEST' -or
      $contentText -notmatch 'filesToEnable' -or
      $contentText -notmatch [regex]::Escape("${contentDeviceName}:") -or
      $contentText -match [regex]::Escape("${deviceName}:") -or
      $contentText -notmatch [regex]::Escape("${assetName}.ityp")) {
    throw 'content.xml does not register and enable the map data and archetype.'
  }
  $setupEntry = $probe.AllEntries | Where-Object { $_.NameLower -eq 'setup2.xml' } | Select-Object -First 1
  if (-not $setupEntry) {
    throw 'The generated DLC is missing setup2.xml.'
  }
  $setupText = [System.Text.Encoding]::UTF8.GetString($probe.ExtractFile($setupEntry))
  if ($setupText -notmatch [regex]::Escape("<deviceName>$deviceName</deviceName>") -or
      $setupText -notmatch '<timeStamp>\d{2}/\d{2}/\d{4} \d{2}:\d{2}:\d{2}</timeStamp>' -or
      $setupText -notmatch '<minorOrder value="0" />') {
    throw 'setup2.xml has an invalid device name, timestamp, or minor order.'
  }
  $mapArchiveEntry = $probe.Children | Where-Object { $_.NameLower -eq $archiveName.ToLowerInvariant() } | Select-Object -First 1
  if (-not $mapArchiveEntry) {
    throw 'The generated DLC is missing the nested map archive.'
  }
  foreach ($asset in $assets) {
    $assetNameInArchive = [System.IO.Path]::GetFileName($asset).ToLowerInvariant()
    if (-not ($mapArchiveEntry.AllEntries | Where-Object { $_.NameLower -eq $assetNameInArchive })) {
      throw "The packed DLC is missing $assetNameInArchive."
    }
  }

  New-Item -ItemType Directory -Path $serverPackages -Force | Out-Null
  if (Test-Path -LiteralPath $serverDlc) {
    Remove-Item -LiteralPath $serverDlc -Force
  }
  Move-Item -LiteralPath $temporaryDlc -Destination $serverDlc
  Write-Host "Built RAGE MP map DLC: $serverDlc"
  Write-Host ("Archive size: {0:N0} bytes" -f (Get-Item -LiteralPath $serverDlc).Length)
}
finally {
  if (Test-Path -LiteralPath $temporaryDirectory) {
    Remove-Item -LiteralPath $temporaryDirectory -Recurse -Force
  }
}
