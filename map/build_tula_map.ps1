param(
  [string]$InputPath,
  [string]$GeoJsonPath,
  [string]$SvgPath,
  [string]$ControlPointsPath
)

$ErrorActionPreference = 'Stop'

$inputPath = if ($InputPath) { $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($InputPath) } else { Join-Path $PSScriptRoot 'source\tula_center.osm' }
$geoJsonPath = if ($GeoJsonPath) { $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($GeoJsonPath) } else { Join-Path $PSScriptRoot 'tula_center_features.geojson' }
$svgPath = if ($SvgPath) { $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($SvgPath) } else { Join-Path $PSScriptRoot 'tula_center_detailed.svg' }
$controlPointsPath = if ($ControlPointsPath) { $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($ControlPointsPath) } else { Join-Path $PSScriptRoot 'tula_control_points.geojson' }

if (-not (Test-Path -LiteralPath $inputPath -PathType Leaf)) {
  throw "OSM source file not found: $inputPath"
}

$culture = [System.Globalization.CultureInfo]::InvariantCulture
$xml = New-Object System.Xml.XmlDocument
$xml.Load($inputPath)

$nodes = @{}
$minLon = [double]::PositiveInfinity
$maxLon = [double]::NegativeInfinity
$minLat = [double]::PositiveInfinity
$maxLat = [double]::NegativeInfinity

foreach ($node in $xml.SelectNodes('/osm/node')) {
  $lat = [double]::Parse($node.GetAttribute('lat'), $culture)
  $lon = [double]::Parse($node.GetAttribute('lon'), $culture)
  $nodes[$node.GetAttribute('id')] = [double[]]@($lon, $lat)
  $minLon = [Math]::Min($minLon, $lon)
  $maxLon = [Math]::Max($maxLon, $lon)
  $minLat = [Math]::Min($minLat, $lat)
  $maxLat = [Math]::Max($maxLat, $lat)
}

if ($nodes.Count -eq 0) {
  throw 'OSM source contains no nodes.'
}

$features = New-Object 'System.Collections.Generic.List[object]'
$svgAreas = New-Object 'System.Collections.Generic.List[object]'
$svgBuildings = New-Object 'System.Collections.Generic.List[object]'
$svgRoads = New-Object 'System.Collections.Generic.List[object]'
$svgRailways = New-Object 'System.Collections.Generic.List[object]'
$svgWaterways = New-Object 'System.Collections.Generic.List[object]'
$svgLabels = New-Object 'System.Collections.Generic.List[object]'
$svgPois = New-Object 'System.Collections.Generic.List[object]'

foreach ($way in $xml.SelectNodes('/osm/way')) {
  $tags = @{}
  foreach ($tag in $way.SelectNodes('tag')) {
    $tags[$tag.GetAttribute('k')] = $tag.GetAttribute('v')
  }

  $isRelevant = $false
  foreach ($key in @('highway', 'building', 'railway', 'waterway', 'landuse', 'leisure', 'natural', 'amenity', 'tourism', 'historic', 'public_transport', 'aeroway')) {
    if ($tags.ContainsKey($key)) {
      $isRelevant = $true
      break
    }
  }
  if (-not $isRelevant) {
    continue
  }

  $coordinates = New-Object 'System.Collections.Generic.List[object]'
  foreach ($nd in $way.SelectNodes('nd')) {
    $ref = $nd.GetAttribute('ref')
    if ($nodes.ContainsKey($ref)) {
      [void]$coordinates.Add($nodes[$ref])
    }
  }
  if ($coordinates.Count -lt 2) {
    continue
  }

  $closed = $coordinates.Count -gt 3 -and
    $coordinates[0][0] -eq $coordinates[$coordinates.Count - 1][0] -and
    $coordinates[0][1] -eq $coordinates[$coordinates.Count - 1][1]
  $isArea = $closed -and (
    $tags.ContainsKey('building') -or
    $tags.ContainsKey('landuse') -or
    $tags.ContainsKey('leisure') -or
    $tags.ContainsKey('amenity') -or
    $tags.ContainsKey('aeroway') -or
    $tags.ContainsKey('natural') -or
    $tags['waterway'] -eq 'riverbank'
  )

  $geometryType = if ($isArea) { 'Polygon' } else { 'LineString' }
  $geometryCoordinates = $coordinates.ToArray()
  if ($isArea) {
    $rings = New-Object 'System.Collections.Generic.List[object]'
    [void]$rings.Add($coordinates.ToArray())
    $geometryCoordinates = $rings.ToArray()
  }
  $feature = [ordered]@{
    type = 'Feature'
    properties = [ordered]@{
      osm_type = 'way'
      osm_id = $way.GetAttribute('id')
      tags = $tags
    }
    geometry = [ordered]@{
      type = $geometryType
      coordinates = $geometryCoordinates
    }
  }
  [void]$features.Add($feature)

  $svgFeature = [pscustomobject]@{
    Tags = $tags
    Coordinates = $coordinates.ToArray()
    IsArea = $isArea
  }
  if ($tags.ContainsKey('building')) {
    [void]$svgBuildings.Add($svgFeature)
  } elseif ($tags.ContainsKey('highway')) {
    [void]$svgRoads.Add($svgFeature)
    if ($tags.ContainsKey('name') -and $tags['highway'] -in @('motorway', 'trunk', 'primary', 'secondary', 'tertiary') -and -not $tags.ContainsKey('noname')) {
      [void]$svgLabels.Add($svgFeature)
    }
  } elseif ($tags.ContainsKey('railway')) {
    [void]$svgRailways.Add($svgFeature)
  } elseif ($tags.ContainsKey('waterway')) {
    [void]$svgWaterways.Add($svgFeature)
  } elseif ($isArea) {
    [void]$svgAreas.Add($svgFeature)
  }

  if ($tags.ContainsKey('name') -and
      ($tags.ContainsKey('amenity') -or $tags.ContainsKey('tourism') -or $tags.ContainsKey('historic'))) {
    [void]$svgPois.Add([pscustomobject]@{
      Name = $tags['name']
      Coordinates = $coordinates.ToArray()
    })
  }
}

foreach ($node in $xml.SelectNodes('/osm/node')) {
  $tags = @{}
  foreach ($tag in $node.SelectNodes('tag')) {
    $tags[$tag.GetAttribute('k')] = $tag.GetAttribute('v')
  }
  if (-not $tags.ContainsKey('name') -or
      -not ($tags.ContainsKey('amenity') -or $tags.ContainsKey('tourism') -or $tags.ContainsKey('historic') -or $tags.ContainsKey('public_transport') -or $tags.ContainsKey('place'))) {
    continue
  }

  $coordinates = $nodes[$node.GetAttribute('id')]
  [void]$features.Add([ordered]@{
    type = 'Feature'
    properties = [ordered]@{
      osm_type = 'node'
      osm_id = $node.GetAttribute('id')
      tags = $tags
    }
    geometry = [ordered]@{
      type = 'Point'
      coordinates = $coordinates
    }
  })
  $pointCoordinates = New-Object 'System.Collections.Generic.List[object]'
  [void]$pointCoordinates.Add($coordinates)
  [void]$svgPois.Add([pscustomobject]@{
    Name = $tags['name']
    Coordinates = $pointCoordinates.ToArray()
  })
}

$featureCollection = [ordered]@{
  type = 'FeatureCollection'
  name = 'Tula detailed central map features'
  attribution = '© OpenStreetMap contributors'
  license = 'Open Database License (ODbL) 1.0'
  features = $features.ToArray()
}
$geoJson = ConvertTo-Json -InputObject $featureCollection -Depth 20
[System.IO.File]::WriteAllText($geoJsonPath, $geoJson, (New-Object System.Text.UTF8Encoding($false)))

$centerLat = ($minLat + $maxLat) / 2
$metersPerLonDegree = 111320 * [Math]::Cos($centerLat * [Math]::PI / 180)
$metersPerLatDegree = 111320
$scale = 0.45
$mapWidth = ($maxLon - $minLon) * $metersPerLonDegree * $scale
$mapHeight = ($maxLat - $minLat) * $metersPerLatDegree * $scale
$mapLeft = 80
$mapTop = 118
$svgWidth = [Math]::Ceiling($mapWidth + 160)
$svgHeight = [Math]::Ceiling($mapHeight + 210)

function Convert-ToSvgPoint {
  param([double]$Longitude, [double]$Latitude)
  $x = $mapLeft + (($Longitude - $minLon) * $metersPerLonDegree * $scale)
  $y = $mapTop + (($maxLat - $Latitude) * $metersPerLatDegree * $scale)
  return ,([double[]]@($x, $y))
}

function Convert-ToPathData {
  param([object[]]$Coordinates, [bool]$ClosePath = $false)
  $parts = New-Object 'System.Collections.Generic.List[string]'
  for ($i = 0; $i -lt $Coordinates.Count; $i++) {
    $point = Convert-ToSvgPoint -Longitude $Coordinates[$i][0] -Latitude $Coordinates[$i][1]
    $command = if ($i -eq 0) { 'M' } else { 'L' }
    [void]$parts.Add([string]::Format($culture, '{0}{1:0.##},{2:0.##}', $command, $point[0], $point[1]))
  }
  if ($ClosePath) {
    [void]$parts.Add('Z')
  }
  return ($parts -join ' ')
}

function Get-AreaStyle {
  param([hashtable]$Tags)
  if ($Tags['natural'] -eq 'water' -or $Tags['waterway'] -eq 'riverbank') {
    return 'water-area'
  }
  if ($Tags['leisure'] -eq 'park' -or $Tags['landuse'] -in @('grass', 'forest', 'recreation_ground', 'allotments') -or $Tags['natural'] -in @('wood', 'scrub')) {
    return 'green-area'
  }
  if ($Tags['landuse'] -in @('industrial', 'commercial', 'retail')) {
    return 'work-area'
  }
  return 'land-area'
}

$svg = New-Object System.Text.StringBuilder
[void]$svg.AppendLine('<?xml version="1.0" encoding="UTF-8"?>')
[void]$svg.AppendLine([string]::Format($culture, '<svg xmlns="http://www.w3.org/2000/svg" width="{1}" height="{0}" viewBox="0 0 {1} {0}" role="img" aria-labelledby="title description">', $svgHeight, $svgWidth))
[void]$svg.AppendLine('<title id="title">Детальная центральная Тула по OpenStreetMap</title>')
[void]$svg.AppendLine('<desc id="description">Здания, уличная сеть и водные объекты на основе выгрузки OSM. Геометрия упрощённо визуализирована для разработки игрового блок-аута.</desc>')
[void]$svg.AppendLine('<style>text{font-family:"Segoe UI",Arial,sans-serif;fill:#172033}.title{font-size:30px;font-weight:700}.subtitle{font-size:14px;fill:#526174}.road-motorway,.road-trunk{fill:none;stroke:#c75f4e;stroke-width:7;stroke-linecap:round;stroke-linejoin:round}.road-primary{fill:none;stroke:#e79c50;stroke-width:5.5;stroke-linecap:round;stroke-linejoin:round}.road-secondary{fill:none;stroke:#f0c77d;stroke-width:4;stroke-linecap:round;stroke-linejoin:round}.road-tertiary{fill:none;stroke:#f6dfa9;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}.road-local{fill:none;stroke:#c8d0d9;stroke-width:1.45;stroke-linecap:round;stroke-linejoin:round}.road-service{fill:none;stroke:#dbe1e8;stroke-width:.8;stroke-linecap:round;stroke-linejoin:round}.building{fill:#e2e6eb;stroke:#b8c0ca;stroke-width:.45}.land-area{fill:#f1f3f5;stroke:#e0e5ea;stroke-width:.8}.green-area{fill:#dcebd4;stroke:#a8c59d;stroke-width:1}.work-area{fill:#eee4d8;stroke:#cfbda7;stroke-width:1}.water-area{fill:#d4edf7;stroke:#87c7e1;stroke-width:1}.water-line{fill:none;stroke:#83c9e6;stroke-width:4;stroke-linecap:round;stroke-linejoin:round}.rail{fill:none;stroke:#8a6da8;stroke-width:2.2;stroke-dasharray:8 4}.street-label,.poi-label{font-size:12px;paint-order:stroke;stroke:#fff;stroke-width:3px;stroke-linejoin:round}.poi-label{font-size:13px;font-weight:700}</style>')
[void]$svg.AppendLine([string]::Format($culture, '<rect width="{0}" height="{1}" fill="#f8fafc"/>', $svgWidth, $svgHeight))
[void]$svg.AppendLine([string]::Format($culture, '<text x="40" y="52" class="title">Центральная Тула — детальная основа</text><text x="40" y="78" class="subtitle">Фрагмент {0:0.0} × {1:0.0} км · здания и улицы из OSM · слои пригодны для импорта в GIS</text>', $mapWidth / $scale / 1000, $mapHeight / $scale / 1000))
[void]$svg.AppendLine([string]::Format($culture, '<rect x="{0}" y="{1}" width="{2:0.##}" height="{3:0.##}" fill="#fff" stroke="#d7dee7"/>', $mapLeft, $mapTop, $mapWidth, $mapHeight))

foreach ($feature in $svgAreas) {
  $path = Convert-ToPathData -Coordinates $feature.Coordinates -ClosePath $true
  $className = Get-AreaStyle -Tags $feature.Tags
  [void]$svg.AppendLine([string]::Format($culture, '<path d="{0}" class="{1}"/>', $path, $className))
}

foreach ($feature in $svgWaterways) {
  $path = Convert-ToPathData -Coordinates $feature.Coordinates -ClosePath $feature.IsArea
  $className = if ($feature.IsArea) { 'water-area' } else { 'water-line' }
  [void]$svg.AppendLine([string]::Format($culture, '<path d="{0}" class="{1}"/>', $path, $className))
}

foreach ($feature in $svgBuildings) {
  if (-not $feature.IsArea) {
    continue
  }
  $path = Convert-ToPathData -Coordinates $feature.Coordinates -ClosePath $true
  [void]$svg.AppendLine([string]::Format($culture, '<path d="{0}" class="building"/>', $path))
}

foreach ($feature in $svgRoads) {
  $path = Convert-ToPathData -Coordinates $feature.Coordinates -ClosePath $feature.IsArea
  $highway = $feature.Tags['highway']
  $className = switch -Regex ($highway) {
    '^(motorway|trunk)$' { 'road-motorway'; break }
    '^primary$' { 'road-primary'; break }
    '^secondary$' { 'road-secondary'; break }
    '^tertiary$' { 'road-tertiary'; break }
    '^(service|track)$' { 'road-service'; break }
    default { 'road-local' }
  }
  [void]$svg.AppendLine([string]::Format($culture, '<path d="{0}" class="{1}"/>', $path, $className))
}

foreach ($feature in $svgRailways) {
  if ($feature.IsArea) {
    continue
  }
  $path = Convert-ToPathData -Coordinates $feature.Coordinates
  [void]$svg.AppendLine([string]::Format($culture, '<path d="{0}" class="rail"/>', $path))
}

$seenStreetNames = @{}
$streetLabelCount = 0
foreach ($feature in $svgLabels) {
  $name = $feature.Tags['name']
  if ($seenStreetNames.ContainsKey($name) -or $streetLabelCount -ge 60) {
    continue
  }
  $seenStreetNames[$name] = $true
  $middle = $feature.Coordinates[[Math]::Floor($feature.Coordinates.Count / 2)]
  $point = Convert-ToSvgPoint -Longitude $middle[0] -Latitude $middle[1]
  $label = [System.Security.SecurityElement]::Escape($name)
  [void]$svg.AppendLine([string]::Format($culture, '<text x="{0:0.##}" y="{1:0.##}" class="street-label" text-anchor="middle">{2}</text>', $point[0], $point[1], $label))
  $streetLabelCount++
}

$poiCount = 0
foreach ($poi in $svgPois) {
  if ($poiCount -ge 80) {
    break
  }
  $point = Convert-ToSvgPoint -Longitude $poi.Coordinates[0][0] -Latitude $poi.Coordinates[0][1]
  $label = [System.Security.SecurityElement]::Escape($poi.Name)
  [void]$svg.AppendLine([string]::Format($culture, '<circle cx="{0:0.##}" cy="{1:0.##}" r="3" fill="#6c55a3" stroke="#fff" stroke-width="1.5"/><text x="{2:0.##}" y="{3:0.##}" class="poi-label">{4}</text>', $point[0], $point[1], $point[0] + 5, $point[1] - 4, $label))
  $poiCount++
}

if (Test-Path -LiteralPath $controlPointsPath -PathType Leaf) {
  $controlPoints = Get-Content -LiteralPath $controlPointsPath -Raw -Encoding UTF8 | ConvertFrom-Json
  foreach ($controlPoint in $controlPoints.features) {
    $longitude = [double]$controlPoint.geometry.coordinates[0]
    $latitude = [double]$controlPoint.geometry.coordinates[1]
    if ($longitude -lt $minLon -or $longitude -gt $maxLon -or $latitude -lt $minLat -or $latitude -gt $maxLat) {
      continue
    }

    $point = Convert-ToSvgPoint -Longitude $longitude -Latitude $latitude
    $label = [System.Security.SecurityElement]::Escape($controlPoint.properties.name)
    [void]$svg.AppendLine([string]::Format($culture, '<circle cx="{0:0.##}" cy="{1:0.##}" r="11" fill="#4f46e5" stroke="#fff" stroke-width="4"/><text x="{2:0.##}" y="{3:0.##}" class="poi-label">{4}</text>', $point[0], $point[1], $point[0] + 14, $point[1] - 8, $label))
  }
}

$footerY = $svgHeight - 48
[void]$svg.AppendLine([string]::Format($culture, '<text x="40" y="{0}" class="subtitle">Условные обозначения: застройка · магистрали · локальные улицы · железная дорога · водные объекты</text>', $footerY))
[void]$svg.AppendLine([string]::Format($culture, '<text x="40" y="{0}" class="subtitle">© OpenStreetMap contributors · ODbL 1.0 · Исходный фрагмент: map/source/tula_center.osm · Не является готовым игровым ассетом</text>', $footerY + 24))
[void]$svg.AppendLine('</svg>')
[System.IO.File]::WriteAllText($svgPath, $svg.ToString(), (New-Object System.Text.UTF8Encoding($false)))

Write-Output ("Wrote {0} GeoJSON features." -f $features.Count)
Write-Output ("Wrote detailed SVG ({0} named road labels, {1} named POIs)." -f $streetLabelCount, $poiCount)
