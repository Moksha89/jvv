<#
.SYNOPSIS
    Installs the RemoteAccessAgent Windows Service.

.DESCRIPTION
    This script installs the RemoteAccessAgent as a Windows Service,
    downloads the FRP client, creates the initial configuration,
    and starts the service.

.PARAMETER ServerAddress
    The address of the relay server (hostname or IP).

.PARAMETER ServerPort
    The FRP server port (default: 7000).

.PARAMETER AuthToken
    The authentication token for the relay server.

.PARAMETER RemotePort
    The remote port assigned on the VPS for RDP access.

.PARAMETER InstallPath
    Installation directory (default: C:\Program Files\RemoteAgent).

.PARAMETER FrpVersion
    FRP version to download (default: 0.61.1).

.EXAMPLE
    .\Install-RemoteAgent.ps1 -ServerAddress "your-vps-ip" -AuthToken "your-token" -RemotePort 33890
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$ServerAddress,

    [int]$ServerPort = 7000,

    [Parameter(Mandatory = $true)]
    [string]$AuthToken,

    [Parameter(Mandatory = $true)]
    [int]$RemotePort,

    [string]$InstallPath = "C:\Program Files\RemoteAgent",

    [string]$FrpVersion = "0.61.1"
)

$ErrorActionPreference = "Stop"

# Check for admin privileges
if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error "This script must be run as Administrator."
    exit 1
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " RemoteAccessAgent Installer" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Create installation directory
Write-Host "[1/6] Creating installation directory..." -ForegroundColor Yellow
if (-not (Test-Path $InstallPath)) {
    New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null
}

$dataPath = Join-Path $env:ProgramData "RemoteAgent"
$logsPath = Join-Path $dataPath "Logs"
if (-not (Test-Path $logsPath)) {
    New-Item -ItemType Directory -Path $logsPath -Force | Out-Null
}
Write-Host "  Install path: $InstallPath" -ForegroundColor Green
Write-Host "  Data path: $dataPath" -ForegroundColor Green

# Step 2: Download FRP client
Write-Host "[2/6] Downloading FRP client v$FrpVersion..." -ForegroundColor Yellow
$frpArchive = "frp_${FrpVersion}_windows_amd64.zip"
$frpUrl = "https://github.com/fatedier/frp/releases/download/v${FrpVersion}/$frpArchive"
$frpZipPath = Join-Path $env:TEMP $frpArchive
$frpExtractPath = Join-Path $env:TEMP "frp_extract"

try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $frpUrl -OutFile $frpZipPath -UseBasicParsing
    Write-Host "  Downloaded FRP client" -ForegroundColor Green
}
catch {
    Write-Error "Failed to download FRP client: $_"
    exit 1
}

# Extract FRP client
if (Test-Path $frpExtractPath) {
    Remove-Item -Path $frpExtractPath -Recurse -Force
}
Expand-Archive -Path $frpZipPath -DestinationPath $frpExtractPath -Force
$frpDir = Get-ChildItem -Path $frpExtractPath -Directory | Select-Object -First 1
Copy-Item -Path (Join-Path $frpDir.FullName "frpc.exe") -Destination $InstallPath -Force
Write-Host "  FRP client installed to $InstallPath\frpc.exe" -ForegroundColor Green

# Cleanup
Remove-Item -Path $frpZipPath -Force -ErrorAction SilentlyContinue
Remove-Item -Path $frpExtractPath -Recurse -Force -ErrorAction SilentlyContinue

# Step 3: Copy agent binaries
Write-Host "[3/6] Installing agent binaries..." -ForegroundColor Yellow
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$publishDir = Join-Path $scriptDir "..\RemoteAccessAgent\bin\Release\net8.0-windows\win-x64\publish"

if (Test-Path $publishDir) {
    Copy-Item -Path "$publishDir\*" -Destination $InstallPath -Recurse -Force
    Write-Host "  Agent binaries installed" -ForegroundColor Green
}
else {
    Write-Host "  WARNING: Published binaries not found at $publishDir" -ForegroundColor Red
    Write-Host "  Build the project first: dotnet publish -c Release" -ForegroundColor Red
    Write-Host "  Continuing with configuration setup..." -ForegroundColor Yellow
}

# Step 4: Generate device ID and create configuration
Write-Host "[4/6] Creating encrypted configuration..." -ForegroundColor Yellow
$deviceId = ([guid]::NewGuid().ToString("N")).Substring(0, 12).ToUpper()

$configJson = @{
    DeviceId                = $deviceId
    ServerAddress           = $ServerAddress
    ServerPort              = $ServerPort
    AuthToken               = $AuthToken
    RdpPort                 = 3389
    RemotePort              = $RemotePort
    HeartbeatIntervalSeconds = 30
    ReconnectDelaySeconds   = 5
    MaxReconnectDelaySeconds = 300
    FrpClientPath           = Join-Path $InstallPath "frpc.exe"
    EnableTls               = $true
    ApiBaseUrl              = "https://${ServerAddress}:3000"
} | ConvertTo-Json

$configPath = Join-Path $dataPath "config.json"
$configJson | Out-File -FilePath $configPath -Encoding UTF8
Write-Host "  Device ID: $deviceId" -ForegroundColor Green
Write-Host "  Configuration saved (plaintext for initial setup)" -ForegroundColor Green
Write-Host "  NOTE: The agent will re-encrypt this on first run using DPAPI" -ForegroundColor Yellow

# Step 5: Install Windows Service
Write-Host "[5/6] Installing Windows Service..." -ForegroundColor Yellow
$serviceName = "RemoteAccessAgent"
$serviceExe = Join-Path $InstallPath "RemoteAccessAgent.exe"

# Stop and remove existing service if present
$existingService = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if ($existingService) {
    Write-Host "  Stopping existing service..." -ForegroundColor Yellow
    Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    sc.exe delete $serviceName | Out-Null
    Start-Sleep -Seconds 1
}

if (Test-Path $serviceExe) {
    New-Service -Name $serviceName `
        -BinaryPathName $serviceExe `
        -DisplayName "Remote Access Agent" `
        -Description "Windows Remote Access Agent with Cloud Relay - CGNAT Bypass" `
        -StartupType Automatic `
        -ErrorAction Stop | Out-Null

    # Configure service recovery options (restart on failure)
    sc.exe failure $serviceName reset= 86400 actions= restart/5000/restart/10000/restart/30000 | Out-Null

    Write-Host "  Service installed: $serviceName" -ForegroundColor Green
    Write-Host "  Startup type: Automatic" -ForegroundColor Green
    Write-Host "  Recovery: Auto-restart on failure" -ForegroundColor Green
}
else {
    Write-Host "  WARNING: Service executable not found at $serviceExe" -ForegroundColor Red
    Write-Host "  Build and publish the project, then re-run the installer." -ForegroundColor Red
}

# Step 6: Configure firewall
Write-Host "[6/6] Configuring Windows Firewall..." -ForegroundColor Yellow
$firewallRuleName = "RemoteAccessAgent-Outbound"
$existingRule = Get-NetFirewallRule -DisplayName $firewallRuleName -ErrorAction SilentlyContinue

if (-not $existingRule) {
    New-NetFirewallRule -DisplayName $firewallRuleName `
        -Direction Outbound `
        -Action Allow `
        -Program $serviceExe `
        -Protocol TCP `
        -Description "Allow RemoteAccessAgent outbound connections" `
        -ErrorAction SilentlyContinue | Out-Null
    Write-Host "  Firewall rule created" -ForegroundColor Green
}
else {
    Write-Host "  Firewall rule already exists" -ForegroundColor Green
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Installation Complete" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Device ID:      $deviceId" -ForegroundColor White
Write-Host "Server:         ${ServerAddress}:${ServerPort}" -ForegroundColor White
Write-Host "Remote Port:    $RemotePort" -ForegroundColor White
Write-Host "Install Path:   $InstallPath" -ForegroundColor White
Write-Host "Config Path:    $dataPath" -ForegroundColor White
Write-Host "Log Path:       $logsPath" -ForegroundColor White
Write-Host ""
Write-Host "To start the service:" -ForegroundColor Yellow
Write-Host "  Start-Service RemoteAccessAgent" -ForegroundColor White
Write-Host ""
Write-Host "To check service status:" -ForegroundColor Yellow
Write-Host "  Get-Service RemoteAccessAgent" -ForegroundColor White
Write-Host ""
Write-Host "To view logs:" -ForegroundColor Yellow
Write-Host "  Get-Content '$logsPath\agent-*.log' -Tail 50" -ForegroundColor White
Write-Host ""
Write-Host "RDP Connection from remote:" -ForegroundColor Yellow
Write-Host "  Connect to ${ServerAddress}:${RemotePort} using Remote Desktop" -ForegroundColor White
Write-Host ""
