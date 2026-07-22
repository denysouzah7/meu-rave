param(
  [string]$HostIp = "192.168.1.3"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

Set-Location $ProjectRoot

$env:CLIENT_ORIGIN = "http://localhost:5173,http://$($HostIp):5173"
$env:PUBLIC_API_URL = "http://$($HostIp):4000"
$env:BETTER_AUTH_URL = "http://$($HostIp):4000"

$LogFile = "dev-mobile-$((Get-Date).ToString('yyyyMMdd-HHmmss')).log"
npm.cmd run dev *> $LogFile
