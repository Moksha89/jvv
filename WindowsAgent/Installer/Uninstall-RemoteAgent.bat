@echo off
REM ============================================================
REM  Remote Access Agent - Complete Windows Uninstaller
REM  
REM  This script removes EVERYTHING installed by Setup:
REM   1. FRP tunnel process and scheduled task
REM   2. TightVNC Server
REM   3. RDP Wrapper
REM   4. Installation files and configuration
REM   5. Deregisters device from relay server
REM
REM  Run as Administrator!
REM ============================================================

setlocal enabledelayedexpansion

set "INSTALL_DIR=C:\Program Files\RemoteAgent"
set "DATA_DIR=%ProgramData%\RemoteAgent"
set "SERVICE_NAME=RemoteAccessAgent"
set "RDPWRAP_DIR=C:\Program Files\RDP Wrapper"

title Remote Access Agent - Complete Uninstaller
color 0C

REM Check for admin privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  ERROR: This script must be run as Administrator!
    echo.
    echo  Right-click this file and select "Run as administrator"
    echo.
    pause
    exit /b 1
)

echo.
echo  ================================================================
echo       Remote Access Agent - Complete Uninstaller
echo  ================================================================
echo.
echo  This will remove:
echo    - FRP tunnel process and auto-start task
echo    - TightVNC Server (if installed)
echo    - RDP Wrapper (if installed)
echo    - All installation files and configuration
echo    - Device registration from relay server
echo.
set /p "CONFIRM=  Are you sure you want to uninstall everything? (Y/N): "
if /i not "%CONFIRM%"=="Y" (
    echo  Cancelled.
    pause
    exit /b 0
)

echo.
echo  ================================================================
echo       Starting Uninstallation...
echo  ================================================================
echo.

REM ============================================================
REM  Step 1: Stop and remove FRP tunnel
REM ============================================================
echo  [1/6] Stopping FRP tunnel...
taskkill /f /im frpc.exe >nul 2>&1
taskkill /f /im wscript.exe >nul 2>&1
timeout /t 2 /nobreak >nul
echo         FRP tunnel stopped.

REM ============================================================
REM  Step 2: Remove scheduled tasks
REM ============================================================
echo  [2/6] Removing scheduled tasks...
schtasks /delete /tn "%SERVICE_NAME%" /f >nul 2>&1
schtasks /delete /tn "RemoteAccessAgent" /f >nul 2>&1
schtasks /delete /tn "RemoteAgentTunnel" /f >nul 2>&1
schtasks /delete /tn "FRPTunnel" /f >nul 2>&1
echo         Scheduled tasks removed.

REM ============================================================
REM  Step 3: Uninstall TightVNC Server
REM ============================================================
echo  [3/6] Removing TightVNC Server...
net stop tvnserver >nul 2>&1
sc stop tvnserver >nul 2>&1
timeout /t 2 /nobreak >nul
wmic product where "name like '%%TightVNC%%'" call uninstall /nointeractive >nul 2>&1
sc delete tvnserver >nul 2>&1
taskkill /f /im tvnserver.exe >nul 2>&1
echo         TightVNC removed.

REM ============================================================
REM  Step 4: Uninstall RDP Wrapper
REM ============================================================
echo  [4/6] Removing RDP Wrapper...
if exist "%RDPWRAP_DIR%\uninstall.bat" (
    call "%RDPWRAP_DIR%\uninstall.bat" >nul 2>&1
    echo         RDP Wrapper uninstalled.
) else if exist "%RDPWRAP_DIR%" (
    net stop TermService >nul 2>&1
    rmdir /s /q "%RDPWRAP_DIR%" 2>nul
    net start TermService >nul 2>&1
    echo         RDP Wrapper removed.
) else (
    echo         RDP Wrapper not found (skipped).
)

REM ============================================================
REM  Step 5: Deregister device from server
REM ============================================================
echo  [5/6] Deregistering device from relay server...
if exist "%DATA_DIR%\config.json" (
    for /f "tokens=2 delims=:," %%a in ('type "%DATA_DIR%\config.json" ^| findstr "deviceId"') do (
        set "DEVICE_ID=%%~a"
        set "DEVICE_ID=!DEVICE_ID: =!"
        set "DEVICE_ID=!DEVICE_ID:"=!"
    )
    if defined DEVICE_ID (
        echo         Device ID: !DEVICE_ID!
        powershell -Command "try { Invoke-RestMethod -Uri 'http://93.127.138.82:3000/api/devices/!DEVICE_ID!' -Method DELETE -ErrorAction SilentlyContinue } catch {}" >nul 2>&1
        echo         Server notified.
    )
) else (
    echo         No config found (skipped).
)

REM ============================================================
REM  Step 6: Remove installation files
REM ============================================================
echo  [6/6] Removing installation files...
if exist "%INSTALL_DIR%" (
    rmdir /s /q "%INSTALL_DIR%" 2>nul
    echo         Removed: %INSTALL_DIR%
) else (
    echo         Not found: %INSTALL_DIR% (already removed)
)

echo.
set /p "REMOVE_DATA=  Remove configuration, logs, and data too? (Y/N): "
if /i "%REMOVE_DATA%"=="Y" (
    if exist "%DATA_DIR%" (
        rmdir /s /q "%DATA_DIR%" 2>nul
        echo         Removed: %DATA_DIR%
    )
) else (
    echo         Data preserved at: %DATA_DIR%
)

REM Cleanup firewall rules
echo.
echo  Cleaning up firewall rules...
netsh advfirewall firewall delete rule name="Remote Desktop" >nul 2>&1
netsh advfirewall firewall delete rule name="RemoteAgent FRP" >nul 2>&1
netsh advfirewall firewall delete rule name="TightVNC" >nul 2>&1
netsh advfirewall firewall delete rule name="VNC Server" >nul 2>&1
echo         Firewall rules cleaned.

echo.
echo  ================================================================
echo       Uninstallation Complete!
echo  ================================================================
echo.
echo  Removed: FRP tunnel, TightVNC, RDP Wrapper, firewall rules
echo.
echo  NOTE: To disable Remote Desktop, go to:
echo    Settings ^> System ^> Remote Desktop ^> Toggle OFF
echo.
echo  Restart your PC for all changes to take effect.
echo.
pause
