@echo off
REM ============================================================
REM  Remote Access Agent - Windows Uninstaller
REM  Run as Administrator!
REM ============================================================

setlocal enabledelayedexpansion

set "INSTALL_DIR=C:\Program Files\RemoteAgent"
set "DATA_DIR=%ProgramData%\RemoteAgent"
set "SERVICE_NAME=RemoteAccessAgent"

title Remote Access Agent Uninstaller

REM Check for admin privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  ERROR: This script must be run as Administrator!
    echo.
    pause
    exit /b 1
)

echo.
echo  ========================================================
echo       Remote Access Agent - Uninstaller
echo  ========================================================
echo.
echo  This will remove:
echo    - FRP tunnel process
echo    - Scheduled task
echo    - Installation files
echo.
set /p "CONFIRM=  Are you sure? (Y/N): "
if /i not "%CONFIRM%"=="Y" (
    echo  Cancelled.
    pause
    exit /b 0
)

echo.
echo  [1/4] Stopping FRP tunnel...
taskkill /f /im frpc.exe >nul 2>&1
taskkill /f /im wscript.exe >nul 2>&1
timeout /t 2 /nobreak >nul
echo         Done.

echo  [2/4] Removing scheduled task...
schtasks /delete /tn "%SERVICE_NAME%" /f >nul 2>&1
echo         Done.

echo  [3/4] Removing installation files...
if exist "%INSTALL_DIR%" (
    rmdir /s /q "%INSTALL_DIR%" 2>nul
    echo         Removed: %INSTALL_DIR%
) else (
    echo         Not found: %INSTALL_DIR%
)

echo  [4/4] Cleaning up data...
set /p "REMOVE_DATA=  Remove configuration and logs too? (Y/N): "
if /i "%REMOVE_DATA%"=="Y" (
    if exist "%DATA_DIR%" (
        rmdir /s /q "%DATA_DIR%" 2>nul
        echo         Removed: %DATA_DIR%
    )
) else (
    echo         Data preserved at: %DATA_DIR%
)

echo.
echo  ========================================================
echo       Uninstallation Complete
echo  ========================================================
echo.
pause
