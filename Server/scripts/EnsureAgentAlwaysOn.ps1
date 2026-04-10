# ============================================================
#  Remote Access Agent - Always-On Setup Script
#  
#  This script ensures:
#   1. FRP tunnel agent is running
#   2. Auto-starts on boot (even before user login)
#   3. Auto-restarts if it crashes (watchdog)
#   4. PC never sleeps or hibernates
#   5. Screen lock does NOT affect the agent
#
#  Run as Administrator!
#  Right-click PowerShell > "Run as Administrator" > paste:
#    Set-ExecutionPolicy Bypass -Scope Process -Force
#    & "C:\path\to\EnsureAgentAlwaysOn.ps1"
# ============================================================

#Requires -RunAsAdministrator

$ErrorActionPreference = "Continue"

# ======================== CONFIGURATION ========================
$INSTALL_DIR   = "C:\Program Files\RemoteAgent"
$DATA_DIR      = "$env:ProgramData\RemoteAgent"
$LOG_DIR       = "$DATA_DIR\Logs"
$TASK_NAME     = "RemoteAccessAgent"
$WATCHDOG_TASK = "RemoteAccessAgent-Watchdog"
$FRP_EXE       = "$INSTALL_DIR\frpc.exe"
$FRP_CONFIG    = "$DATA_DIR\frpc.toml"
$LAUNCHER_BAT  = "$INSTALL_DIR\start-tunnel.bat"
$LAUNCHER_VBS  = "$INSTALL_DIR\start-tunnel-hidden.vbs"
# ===============================================================

Write-Host ""
Write-Host "  ================================================================" -ForegroundColor Cyan
Write-Host "    REMOTE ACCESS AGENT - ALWAYS-ON SETUP" -ForegroundColor Cyan
Write-Host "  ================================================================" -ForegroundColor Cyan
Write-Host ""

# ---- Check if agent is installed ----
Write-Host "  [1/7] Checking agent installation..." -ForegroundColor Yellow

if (-not (Test-Path $FRP_EXE)) {
    Write-Host "    ERROR: FRP client not found at $FRP_EXE" -ForegroundColor Red
    Write-Host "    Please run Setup-RemoteAgent.bat first to install the agent." -ForegroundColor Red
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

if (-not (Test-Path $FRP_CONFIG)) {
    Write-Host "    ERROR: FRP config not found at $FRP_CONFIG" -ForegroundColor Red
    Write-Host "    Please run Setup-RemoteAgent.bat first to install the agent." -ForegroundColor Red
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "    Agent found at $INSTALL_DIR" -ForegroundColor Green

# ---- Ensure log directory exists ----
if (-not (Test-Path $LOG_DIR)) {
    New-Item -ItemType Directory -Path $LOG_DIR -Force | Out-Null
}

# ---- Step 2: Create/update the launcher batch script with auto-restart loop ----
Write-Host "  [2/7] Creating auto-restart launcher..." -ForegroundColor Yellow

$launcherContent = @"
@echo off
REM Remote Access Agent - FRP Tunnel Launcher with Auto-Restart
REM This script runs in a loop - if FRP crashes, it restarts automatically

:loop
echo [%date% %time%] Starting FRP tunnel... >> "$LOG_DIR\launcher.log"
"$FRP_EXE" -c "$FRP_CONFIG"
echo [%date% %time%] FRP disconnected. Restarting in 10 seconds... >> "$LOG_DIR\launcher.log"
timeout /t 10 /nobreak >nul
goto loop
"@

Set-Content -Path $LAUNCHER_BAT -Value $launcherContent -Force
Write-Host "    Launcher script created: $LAUNCHER_BAT" -ForegroundColor Green

# ---- Step 3: Create hidden VBS launcher (no console window) ----
Write-Host "  [3/7] Creating hidden launcher (no console window)..." -ForegroundColor Yellow

$vbsContent = @"
' Remote Access Agent - Hidden Launcher
' Runs the tunnel in background without showing a console window
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run chr(34) & "$LAUNCHER_BAT" & chr(34), 0, False
Set WshShell = Nothing
"@

Set-Content -Path $LAUNCHER_VBS -Value $vbsContent -Force
Write-Host "    Hidden launcher created: $LAUNCHER_VBS" -ForegroundColor Green

# ---- Step 4: Create scheduled task to run on boot (as SYSTEM) ----
Write-Host "  [4/7] Setting up auto-start on boot..." -ForegroundColor Yellow

# Remove existing task if any
schtasks /delete /tn $TASK_NAME /f 2>$null | Out-Null

# Create task that runs at system startup as SYSTEM (runs even when no user is logged in)
$taskResult = schtasks /create `
    /tn $TASK_NAME `
    /tr "wscript.exe `"$LAUNCHER_VBS`"" `
    /sc onstart `
    /ru SYSTEM `
    /rl HIGHEST `
    /f 2>&1

if ($LASTEXITCODE -ne 0) {
    # Fallback: create as onlogon task
    Write-Host "    SYSTEM task failed, trying onlogon..." -ForegroundColor Yellow
    schtasks /create `
        /tn $TASK_NAME `
        /tr "wscript.exe `"$LAUNCHER_VBS`"" `
        /sc onlogon `
        /rl HIGHEST `
        /f 2>$null | Out-Null
}

Write-Host "    Auto-start task '$TASK_NAME' created (runs on boot)" -ForegroundColor Green

# ---- Step 5: Create watchdog task (checks every 5 minutes) ----
Write-Host "  [5/7] Setting up watchdog (auto-restart if crashed)..." -ForegroundColor Yellow

$watchdogScript = "$INSTALL_DIR\watchdog.ps1"
$watchdogContent = @'
# Remote Access Agent Watchdog
# Checks if FRP is running, restarts if not

$FRP_EXE = "C:\Program Files\RemoteAgent\frpc.exe"
$LAUNCHER_VBS = "C:\Program Files\RemoteAgent\start-tunnel-hidden.vbs"
$LOG_DIR = "$env:ProgramData\RemoteAgent\Logs"

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$frpRunning = Get-Process -Name "frpc" -ErrorAction SilentlyContinue

if (-not $frpRunning) {
    "$timestamp - FRP not running. Restarting..." | Out-File -Append "$LOG_DIR\watchdog.log"
    
    # Kill any zombie processes
    Stop-Process -Name "frpc" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    
    # Restart via hidden launcher
    & wscript.exe $LAUNCHER_VBS
    
    "$timestamp - FRP restarted successfully." | Out-File -Append "$LOG_DIR\watchdog.log"
} else {
    "$timestamp - FRP is running (PID: $($frpRunning.Id))." | Out-File -Append "$LOG_DIR\watchdog.log"
}
'@

Set-Content -Path $watchdogScript -Value $watchdogContent -Force

# Remove existing watchdog task
schtasks /delete /tn $WATCHDOG_TASK /f 2>$null | Out-Null

# Create watchdog task that runs every 5 minutes
schtasks /create `
    /tn $WATCHDOG_TASK `
    /tr "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$watchdogScript`"" `
    /sc minute `
    /mo 5 `
    /ru SYSTEM `
    /rl HIGHEST `
    /f 2>$null | Out-Null

Write-Host "    Watchdog task '$WATCHDOG_TASK' created (checks every 5 min)" -ForegroundColor Green

# ---- Step 6: Disable sleep, hibernation, and screen timeout ----
Write-Host "  [6/7] Disabling sleep and hibernation..." -ForegroundColor Yellow

# Disable hibernation
powercfg /hibernate off 2>$null

# Set power plan to High Performance
$highPerf = powercfg /list | Select-String "High Performance"
if ($highPerf) {
    $guid = ($highPerf -split '\s+')[3]
    powercfg /setactive $guid 2>$null
    Write-Host "    Switched to High Performance power plan" -ForegroundColor Green
}

# Disable sleep on AC power (0 = never)
powercfg /change standby-timeout-ac 0
powercfg /change standby-timeout-dc 0

# Disable hibernate timeout
powercfg /change hibernate-timeout-ac 0
powercfg /change hibernate-timeout-dc 0

# Keep monitor on (set to never turn off) - optional, can be changed
# powercfg /change monitor-timeout-ac 0  # Uncomment to keep screen always on

# Disable automatic sleep
powercfg /setacvalueindex SCHEME_CURRENT SUB_SLEEP STANDBYIDLE 0 2>$null
powercfg /setactive SCHEME_CURRENT 2>$null

# Disable connected standby / Modern Standby (S0 Low Power Idle)
reg add "HKLM\SYSTEM\CurrentControlSet\Control\Power" /v CsEnabled /t REG_DWORD /d 0 /f 2>$null | Out-Null

# Disable fast startup (can cause issues with scheduled tasks)
reg add "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Power" /v HiberbootEnabled /t REG_DWORD /d 0 /f 2>$null | Out-Null

Write-Host "    Sleep and hibernation disabled" -ForegroundColor Green
Write-Host "    PC will stay on even when screen is locked" -ForegroundColor Green

# ---- Step 7: Start the agent NOW if not running ----
Write-Host "  [7/7] Ensuring agent is running now..." -ForegroundColor Yellow

$frpProcess = Get-Process -Name "frpc" -ErrorAction SilentlyContinue
if ($frpProcess) {
    Write-Host "    Agent is already running (PID: $($frpProcess.Id))" -ForegroundColor Green
} else {
    Write-Host "    Starting agent..." -ForegroundColor Yellow
    & wscript.exe $LAUNCHER_VBS
    Start-Sleep -Seconds 3
    $frpProcess = Get-Process -Name "frpc" -ErrorAction SilentlyContinue
    if ($frpProcess) {
        Write-Host "    Agent started successfully (PID: $($frpProcess.Id))" -ForegroundColor Green
    } else {
        Write-Host "    WARNING: Agent may have failed to start. Check logs at $LOG_DIR" -ForegroundColor Red
    }
}

# ---- Summary ----
Write-Host ""
Write-Host "  ================================================================" -ForegroundColor Cyan
Write-Host "    SETUP COMPLETE!" -ForegroundColor Green
Write-Host "  ================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  What was configured:" -ForegroundColor White
Write-Host "    [OK] FRP tunnel agent auto-starts on boot (as SYSTEM)" -ForegroundColor Green
Write-Host "    [OK] Watchdog checks every 5 min and restarts if crashed" -ForegroundColor Green
Write-Host "    [OK] Sleep and hibernation disabled" -ForegroundColor Green
Write-Host "    [OK] PC stays on even when screen is locked" -ForegroundColor Green
Write-Host "    [OK] Agent restarts automatically if it disconnects" -ForegroundColor Green
Write-Host ""
Write-Host "  Logs location: $LOG_DIR" -ForegroundColor Gray
Write-Host ""
Write-Host "  To check status anytime, run:" -ForegroundColor White
Write-Host "    Get-Process frpc" -ForegroundColor Gray
Write-Host "    schtasks /query /tn $TASK_NAME" -ForegroundColor Gray
Write-Host "    schtasks /query /tn $WATCHDOG_TASK" -ForegroundColor Gray
Write-Host ""
Write-Host "  To view logs:" -ForegroundColor White
Write-Host "    Get-Content $LOG_DIR\launcher.log -Tail 20" -ForegroundColor Gray
Write-Host "    Get-Content $LOG_DIR\watchdog.log -Tail 20" -ForegroundColor Gray
Write-Host ""
Read-Host "Press Enter to close"
