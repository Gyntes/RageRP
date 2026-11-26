param(
  [Parameter(Mandatory = $true)]
  [ValidateRange(-180.0, 180.0)]
  [double]$Longitude,

  [Parameter(Mandatory = $true)]
  [ValidateRange(-90.0, 90.0)]
  [double]$Latitude,

  [double]$Height = 0.0
)

$originLongitude = 37.6175
$originLatitude = 54.1930
$metersPerLatitude = 111320.0
$metersPerLongitude = $metersPerLatitude * [Math]::Cos($originLatitude * [Math]::PI / 180.0)
$distanceScale = 0.5

$east = ($Longitude - $originLongitude) * $metersPerLongitude * $distanceScale
$north = ($Latitude - $originLatitude) * $metersPerLatitude * $distanceScale

[PSCustomObject]@{
  wgs84 = @{ longitude = $Longitude; latitude = $Latitude }
  local = @{
    east = [Math]::Round($east, 3)
    north = [Math]::Round($north, 3)
    up = [Math]::Round($Height, 3)
  }
  gtaWorld = @{
    x = [Math]::Round(215.76 + $east, 3)
    y = [Math]::Round(-810.12 + $north, 3)
    z = [Math]::Round(30.73 + $Height, 3)
  }
  status = 'temporary-test-origin'
} | ConvertTo-Json -Depth 4
