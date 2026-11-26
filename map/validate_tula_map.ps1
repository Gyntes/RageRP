param(
  [string]$MapDirectory = $PSScriptRoot,
  [switch]$Pilot
)

$ErrorActionPreference = 'Stop'

function Get-XmlCounts {
  param([string]$Path)

  $xml = New-Object System.Xml.XmlDocument
  $xml.Load($Path)
  [PSCustomObject]@{
    nodes = @($xml.SelectNodes('/osm/node')).Count
    ways = @($xml.SelectNodes('/osm/way')).Count
    relations = @($xml.SelectNodes('/osm/relation')).Count
  }
}

function Test-File {
  param([string]$Name)
  $path = Join-Path $MapDirectory $Name
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
    throw "Required file is missing: $Name"
  }
  $item = Get-Item -LiteralPath $path
  if ($item.Length -le 0) {
    throw "Required file is empty: $Name"
  }
  return $item
}

$osmName = if ($Pilot) { 'source\tula_pilot.osm' } else { 'source\tula_center.osm' }
$geoJsonName = if ($Pilot) { 'tula_pilot_features.geojson' } else { 'tula_center_features.geojson' }
$svgName = if ($Pilot) { 'tula_pilot_detailed.svg' } else { 'tula_center_detailed.svg' }

$osm = Test-File $osmName
$geojson = Test-File $geoJsonName
$svg = Test-File $svgName
if (-not $Pilot) {
  [void](Test-File 'tula_center_greybox.obj')
  [void](Test-File 'tula_center_greybox.mtl')
}
$manifest = Test-File 'tula_pilot_manifest.json'

$osmCounts = Get-XmlCounts $osm.FullName
$geoCollection = Get-Content -LiteralPath $geojson.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
$lineCount = @($geoCollection.features | Where-Object { $_.geometry.type -eq 'LineString' }).Count
$pointCount = @($geoCollection.features | Where-Object { $_.geometry.type -eq 'Point' }).Count
$polygonCount = @($geoCollection.features | Where-Object { $_.geometry.type -eq 'Polygon' }).Count

$objVertices = $null
$objFaces = $null
$objBuildings = $null
$objRoadSegments = $null
$objBytes = $null
if (-not $Pilot) {
  $obj = Test-File 'tula_center_greybox.obj'
  $objText = Get-Content -LiteralPath $obj.FullName
  $objVertices = @($objText | Where-Object { $_ -match '^v ' }).Count
  $objFaces = @($objText | Where-Object { $_ -match '^f ' }).Count
  $objBuildings = @($objText | Where-Object { $_ -match '^g buildings$' }).Count
  $objRoadSegments = @($objText | Where-Object { $_ -match '^g roads$' }).Count
  $objBytes = $obj.Length
} else {
  $obj = Test-File 'tula_pilot_greybox_compact.obj'
  [void](Test-File 'tula_pilot_greybox_compact.mtl')
  [void](Test-File 'tula_pilot_greybox_compact.blend')
  [void](Test-File 'tula_pilot_compact_manifest.json')
  $objText = Get-Content -LiteralPath $obj.FullName
  $objVertices = @($objText | Where-Object { $_ -match '^v ' }).Count
  $objFaces = @($objText | Where-Object { $_ -match '^f ' }).Count
  $objBuildings = @($objText | Where-Object { $_ -match '^o pilot_buildings$' }).Count
  $objRoadSegments = @($objText | Where-Object { $_ -match '^o pilot_roads$' }).Count
  $objBytes = $obj.Length
}

$manifestData = Get-Content -LiteralPath $manifest.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
if ($manifestData.origin.units -ne 'metres') {
  throw 'Pilot manifest units must be metres.'
}

[PSCustomObject]@{
  osmNodes = $osmCounts.nodes
  osmWays = $osmCounts.ways
  osmRelations = $osmCounts.relations
  geoJsonFeatures = @($geoCollection.features).Count
  geoJsonLines = $lineCount
  geoJsonPoints = $pointCount
  geoJsonPolygons = $polygonCount
  objVertices = $objVertices
  objFaces = $objFaces
  objBuildings = $objBuildings
  objRoadSegments = $objRoadSegments
  manifestStatus = $manifestData.status
  svgBytes = $svg.Length
  objBytes = $objBytes
  result = 'VALID'
} | Format-List
