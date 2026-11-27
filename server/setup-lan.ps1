$ErrorActionPreference = 'Stop'

$requiredPorts = @(
  @{ Protocol = 'UDP'; Port = 22005; Name = 'RAGE MP server' },
  @{ Protocol = 'TCP'; Port = 22006; Name = 'RAGE MP client package HTTP' }
)

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw 'Run this script from a PowerShell window opened as Administrator.'
}

foreach ($requiredPort in $requiredPorts) {
  $ruleName = "RageRP $($requiredPort.Name) $($requiredPort.Port) $($requiredPort.Protocol)"
  $existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
  if (-not $existing) {
    New-NetFirewallRule `
      -DisplayName $ruleName `
      -Direction Inbound `
      -Action Allow `
      -Protocol $requiredPort.Protocol `
      -LocalPort $requiredPort.Port `
      -Program 'Any' | Out-Null
  }
}

$lanInterfaceIndexes = Get-NetIPConfiguration |
  Where-Object { $_.NetAdapter.Status -eq 'Up' -and $_.IPv4DefaultGateway } |
  ForEach-Object { $_.InterfaceIndex }

$addresses = Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.InterfaceIndex -in $lanInterfaceIndexes } |
  Where-Object { $_.IPAddress -notin @('127.0.0.1', '0.0.0.0') } |
  Sort-Object InterfaceMetric

if (-not $addresses) {
  throw 'No active LAN IPv4 address with a default gateway was found.'
}

Write-Host 'LAN addresses:'
$addresses | ForEach-Object {
  Write-Host "  $($_.IPAddress)  ($($_.InterfaceAlias))"
}

Write-Host ''
Write-Host 'Firewall rules opened for ports 22005 UDP and 22006 TCP.'
Write-Host 'For LAN players use your LAN IPv4 address and port 22005.'
Write-Host 'Example: 192.168.0.5:22005'
Write-Host ''
Write-Host 'For internet players: forward UDP 22005 and TCP 22006 from the router'
Write-Host 'to this PC LAN IPv4 address. Keep your server PC address as a DHCP reservation.'
Write-Host 'If the router has no public IPv4, your ISP uses CGNAT and direct hosting will not work.'
