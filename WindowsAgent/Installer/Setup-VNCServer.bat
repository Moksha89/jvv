@echo off
:: ============================================================
:: VNC Server Setup for Same-Screen Remote Access
:: Installs TightVNC so remote users see the SAME screen
:: as the local user (screen mirroring/sharing)
:: Must be run as Administrator
:: ============================================================

title VNC Server - Same Screen Setup
color 0B

echo ============================================================
echo   VNC Server - Same Screen Remote Access Setup
echo   Mirrors your actual screen to remote viewers
echo ============================================================
echo.

:: Check for Administrator privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] This script must be run as Administrator!
    echo Right-click the file and select "Run as administrator"
    pause
    exit /b 1
)

echo [INFO] Running with Administrator privileges...
echo.

:: Set variables
set "VNC_PORT=5900"
set "VNC_PASSWORD=YOUR_VNC_PASSWORD"
set "TIGHTVNC_URL=https://www.tightvnc.com/download/2.8.85/tightvnc-2.8.85-gpl-setup-64bit.msi"
set "TEMP_MSI=%TEMP%\tightvnc-setup.msi"
set "FRP_CONFIG=%ProgramData%\RemoteAgent\frpc.toml"
set "SERVER_ADDRESS=YOUR_SERVER_IP"
set "SERVER_PORT=7000"
set "AUTH_TOKEN=YOUR_FRP_AUTH_TOKEN"

:: Step 1: Download TightVNC
echo [STEP 1/5] Downloading TightVNC Server...
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%TIGHTVNC_URL%' -OutFile '%TEMP_MSI%' -UseBasicParsing" 2>nul

if not exist "%TEMP_MSI%" (
    echo [ERROR] Failed to download TightVNC. Check internet connection.
    echo Trying alternate download method...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $wc = New-Object System.Net.WebClient; $wc.DownloadFile('%TIGHTVNC_URL%', '%TEMP_MSI%')" 2>nul
)

if not exist "%TEMP_MSI%" (
    echo [ERROR] Download failed. Please download TightVNC manually from:
    echo https://www.tightvnc.com/download.php
    pause
    exit /b 1
)
echo   Downloaded successfully.
echo.

:: Step 2: Install TightVNC silently (server only)
echo [STEP 2/5] Installing TightVNC Server...

:: Stop existing VNC service if running
net stop tvnserver >nul 2>&1

:: Generate password hash for TightVNC (uses a simple hex encoding)
:: TightVNC accepts SET_PASSWORD during MSI install
msiexec /i "%TEMP_MSI%" /quiet /norestart ^
    ADDLOCAL="Server" ^
    SERVER_REGISTER_AS_SERVICE=1 ^
    SERVER_ADD_FIREWALL_EXCEPTION=1 ^
    SET_USEVNCAUTHENTICATION=1 ^
    VALUE_OF_USEVNCAUTHENTICATION=1 ^
    SET_PASSWORD=1 ^
    VALUE_OF_PASSWORD=%VNC_PASSWORD% ^
    SET_USECONTROLAUTHENTICATION=1 ^
    VALUE_OF_USECONTROLAUTHENTICATION=1 ^
    SET_CONTROLPASSWORD=1 ^
    VALUE_OF_CONTROLPASSWORD=%VNC_PASSWORD% ^
    SET_ALLOWLOOPBACK=1 ^
    VALUE_OF_ALLOWLOOPBACK=1 ^
    SET_IPACCESSCONTROL=0 ^
    SET_REMOVEWALLPAPER=0 ^
    VALUE_OF_REMOVEWALLPAPER=0

:: Wait for installation to complete
timeout /t 10 /nobreak >nul

:: Cleanup installer
del /f /q "%TEMP_MSI%" 2>nul

:: Verify installation
if exist "C:\Program Files\TightVNC\tvnserver.exe" (
    echo   TightVNC Server installed successfully.
) else (
    echo [ERROR] TightVNC installation may have failed.
    echo   Please install manually from https://www.tightvnc.com/download.php
    echo   Choose "Server" component only, set password to: %VNC_PASSWORD%
    pause
    exit /b 1
)
echo.

:: Step 3: Configure TightVNC for optimal performance
echo [STEP 3/5] Configuring VNC Server settings...

:: Set registry values for TightVNC server
reg add "HKLM\SOFTWARE\TightVNC\Server" /v AcceptRfbConnections /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKLM\SOFTWARE\TightVNC\Server" /v UseVncAuthentication /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKLM\SOFTWARE\TightVNC\Server" /v RfbPort /t REG_DWORD /d %VNC_PORT% /f >nul 2>&1
reg add "HKLM\SOFTWARE\TightVNC\Server" /v AllowLoopback /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKLM\SOFTWARE\TightVNC\Server" /v RemoveWallpaper /t REG_DWORD /d 0 /f >nul 2>&1
reg add "HKLM\SOFTWARE\TightVNC\Server" /v BlockRemoteInput /t REG_DWORD /d 0 /f >nul 2>&1
reg add "HKLM\SOFTWARE\TightVNC\Server" /v BlankScreen /t REG_DWORD /d 0 /f >nul 2>&1
reg add "HKLM\SOFTWARE\TightVNC\Server" /v DisconnectAction /t REG_DWORD /d 0 /f >nul 2>&1
reg add "HKLM\SOFTWARE\TightVNC\Server" /v GrabTransparentWindows /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKLM\SOFTWARE\TightVNC\Server" /v NeverShared /t REG_DWORD /d 0 /f >nul 2>&1
reg add "HKLM\SOFTWARE\TightVNC\Server" /v AlwaysShared /t REG_DWORD /d 1 /f >nul 2>&1

echo   VNC Server configured for screen sharing.
echo.

:: Step 4: Configure Windows Firewall for VNC
echo [STEP 4/5] Configuring firewall...
netsh advfirewall firewall delete rule name="TightVNC Server (Custom)" >nul 2>&1
netsh advfirewall firewall add rule name="TightVNC Server (Custom)" dir=in action=allow protocol=tcp localport=%VNC_PORT% >nul 2>&1
echo   Firewall rule added for port %VNC_PORT%.
echo.

:: Step 5: Update FRP config to tunnel VNC port
echo [STEP 5/5] Updating FRP tunnel configuration...

if not exist "%FRP_CONFIG%" (
    echo [WARNING] FRP config not found at %FRP_CONFIG%
    echo   VNC server is installed but not tunneled.
    echo   You'll need to manually add VNC proxy to your FRP config.
    goto :skip_frp
)

:: Check if VNC proxy already exists in config
findstr /c:"vnc-" "%FRP_CONFIG%" >nul 2>&1
if %errorlevel% equ 0 (
    echo   VNC tunnel already configured in FRP.
    goto :skip_frp
)

:: Append VNC proxy to existing FRP config
echo.>> "%FRP_CONFIG%"
echo [[proxies]]>> "%FRP_CONFIG%"
echo name = "vnc-%COMPUTERNAME%">> "%FRP_CONFIG%"
echo type = "tcp">> "%FRP_CONFIG%"
echo localIP = "127.0.0.1">> "%FRP_CONFIG%"
echo localPort = %VNC_PORT%>> "%FRP_CONFIG%"
echo remotePort = 59000>> "%FRP_CONFIG%"

echo   VNC tunnel added to FRP config (port 59000).

:: Restart FRP to pick up new config
echo   Restarting FRP tunnel...
taskkill /f /im frpc.exe >nul 2>&1
timeout /t 2 /nobreak >nul

:: Find and restart the FRP launcher
set "FRP_LAUNCHER=C:\Program Files\RemoteAgent\start-tunnel-hidden.vbs"
if exist "%FRP_LAUNCHER%" (
    start "" wscript.exe "%FRP_LAUNCHER%"
    timeout /t 3 /nobreak >nul
    echo   FRP tunnel restarted with VNC support.
) else (
    echo [WARNING] Could not find FRP launcher. Please restart FRP manually.
)

:skip_frp

:: Start/Restart TightVNC service
echo.
echo Starting VNC Server...
net stop tvnserver >nul 2>&1
timeout /t 2 /nobreak >nul
net start tvnserver >nul 2>&1

:: Verify VNC is listening
timeout /t 2 /nobreak >nul
netstat -an | find ":%VNC_PORT%" | find "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo   VNC Server is LISTENING on port %VNC_PORT%.
) else (
    echo [WARNING] VNC Server may not be listening yet. Try restarting your PC.
)

echo.
echo ============================================================
echo   INSTALLATION COMPLETE!
echo ============================================================
echo.
echo   TightVNC Server is installed and running.
echo   VNC Port: %VNC_PORT%
echo   VNC Password: %VNC_PASSWORD%
echo.
echo   This allows remote viewers to see your EXACT screen
echo   (same desktop, same windows, same everything).
echo.
echo   Both you and the remote user can control the PC
echo   at the same time - mouse and keyboard are shared.
echo.
echo   Access via: http://YOUR_SERVER_IP (Same Screen mode)
echo.
pause
