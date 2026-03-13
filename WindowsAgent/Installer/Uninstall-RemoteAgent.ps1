<#
.SYNOPSIS
    Uninstalls the RemoteAccessAgent Windows Service.

.DESCRIPTION
    Stops and removes the RemoteAccessAgent service, cleans up files and firewall rules.

.PARAMETER RemoveData
    If specified, also removes configuration and log files.

.PARAMETER InstallPath
    Installation directory (default: C:\Program Files\RemoteAgent).
#>

param(
    [switch]$RemoveData,
    [string]$InstallPath = "C:\Program Files\RemoteAgent"
)

$ErrorActionPreference = "Stop"

if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error "This script must be run as Administrator."
    exit 1
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " RemoteAccessAgent Uninstaller" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$serviceName = "RemoteAccessAgent"

# Step 1: Stop and remove service
Write-Host "[1/3] Stopping and removing service..." -ForegroundColor Yellow
$service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if ($service) {
    if ($service.Status -eq "Running") {
        Stop-Service -Name $serviceName -Force
        Start-Sleep -Seconds 3
    }
    sc.exe delete $serviceName | Out-Null
    Write-Host "  Service removed" -ForegroundColor Green
}
else {
    Write-Host "  Service not found (already removed)" -ForegroundColor Yellow
}

# Step 2: Remove firewall rule
Write-Host "[2/3] Removing firewall rule..." -ForegroundColor Yellow
$firewallRuleName = "RemoteAccessAgent-Outbound"
Remove-NetFirewallRule -DisplayName $firewallRuleName -ErrorAction SilentlyContinue
Write-Host "  Firewall rule removed" -ForegroundColor Green

# Step 3: Remove files
Write-Host "[3/3] Removing files..." -ForegroundColor Yellow
if (Test-Path $InstallPath) {
    Remove-Item -Path $InstallPath -Recurse -Force
    Write-Host "  Install directory removed: $InstallPath" -ForegroundColor Green
}

if ($RemoveData) {
    $dataPath = Join-Path $env:ProgramData "RemoteAgent"
    if (Test-Path $dataPath) {
        Remove-Item -Path $dataPath -Recurse -Force
        Write-Host "  Data directory removed: $dataPath" -ForegroundColor Green
    }
}
else {
    Write-Host "  Data directory preserved. Use -RemoveData to also remove config and logs." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Uninstallation complete." -ForegroundColor Green
Write-Host ""
