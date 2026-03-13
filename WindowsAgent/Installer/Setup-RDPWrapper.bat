@echo off
:: ============================================================
:: RDP Wrapper Installer for Multi-Session Support
:: Enables simultaneous local + remote desktop sessions
:: Must be run as Administrator
:: ============================================================

title RDP Wrapper Multi-Session Setup
color 0B

echo ============================================================
echo   RDP Wrapper Multi-Session Setup
echo   Enables simultaneous local + remote sessions
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
set "INSTALL_DIR=C:\Program Files\RDPWrapper"
set "DOWNLOAD_URL=https://github.com/stascorp/rdpwrap/releases/download/v1.6.2/RDPWrap-v1.6.2.zip"
set "INI_URL=https://raw.githubusercontent.com/sebaxakerhtc/rdpwrap.ini/master/rdpwrap.ini"
set "TEMP_ZIP=%TEMP%\RDPWrap.zip"

:: Step 1: Create install directory
echo [STEP 1/7] Creating install directory...
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
echo   Directory: %INSTALL_DIR%
echo.

:: Step 2: Download RDP Wrapper
echo [STEP 2/7] Downloading RDP Wrapper v1.6.2...
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%DOWNLOAD_URL%' -OutFile '%TEMP_ZIP%' -UseBasicParsing" 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Failed to download RDP Wrapper. Check internet connection.
    pause
    exit /b 1
)
echo   Downloaded successfully.
echo.

:: Step 3: Extract files
echo [STEP 3/7] Extracting files...
powershell -Command "Expand-Archive -Path '%TEMP_ZIP%' -DestinationPath '%INSTALL_DIR%' -Force" 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Failed to extract files.
    pause
    exit /b 1
)
del "%TEMP_ZIP%" 2>nul
echo   Extracted to %INSTALL_DIR%
echo.

:: Step 4: Stop Terminal Services before installing
echo [STEP 4/7] Stopping Terminal Services...
net stop TermService /y >nul 2>&1
echo   Service stopped.
echo.

:: Step 5: Install RDP Wrapper
echo [STEP 5/7] Installing RDP Wrapper...
if exist "%INSTALL_DIR%\install.bat" (
    pushd "%INSTALL_DIR%"
    call install.bat
    popd
) else if exist "%INSTALL_DIR%\RDPWInst.exe" (
    "%INSTALL_DIR%\RDPWInst.exe" -i
) else (
    echo [ERROR] Install files not found in %INSTALL_DIR%
    dir "%INSTALL_DIR%"
    pause
    exit /b 1
)
echo   RDP Wrapper installed.
echo.

:: Step 6: Update rdpwrap.ini with latest community version
echo [STEP 6/7] Updating rdpwrap.ini with latest offsets...
echo   Downloading from sebaxakerhtc community repository...

:: Backup existing ini
if exist "C:\Program Files\RDP Wrapper\rdpwrap.ini" (
    copy "C:\Program Files\RDP Wrapper\rdpwrap.ini" "C:\Program Files\RDP Wrapper\rdpwrap.ini.bak" >nul 2>&1
)

powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%INI_URL%' -OutFile 'C:\Program Files\RDP Wrapper\rdpwrap.ini' -UseBasicParsing" 2>nul
if %errorlevel% neq 0 (
    echo [WARNING] Failed to download updated ini. Will try alternate location...
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%INI_URL%' -OutFile '%INSTALL_DIR%\rdpwrap.ini' -UseBasicParsing" 2>nul
)
echo   Updated rdpwrap.ini with latest Windows 11 support.
echo.

:: Step 7: Configure registry for multi-session
echo [STEP 7/7] Configuring multi-session registry settings...
reg add "HKLM\SYSTEM\CurrentControlSet\Control\Terminal Server" /v fSingleSessionPerUser /t REG_DWORD /d 0 /f >nul 2>&1
reg add "HKLM\SYSTEM\CurrentControlSet\Control\Terminal Server" /v fDenyTSConnections /t REG_DWORD /d 0 /f >nul 2>&1
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows NT\Terminal Services" /v MaxInstanceCount /t REG_DWORD /d 999999 /f >nul 2>&1
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows NT\Terminal Services" /v fSingleSessionPerUser /t REG_DWORD /d 0 /f >nul 2>&1

:: Enable Remote Desktop
reg add "HKLM\SYSTEM\CurrentControlSet\Control\Terminal Server" /v fDenyTSConnections /t REG_DWORD /d 0 /f >nul 2>&1

:: Restart Terminal Services
net start TermService >nul 2>&1
echo   Registry configured for multi-session support.
echo.

:: Configure Windows Firewall
echo [BONUS] Configuring firewall rules...
netsh advfirewall firewall set rule group="Remote Desktop" new enable=yes >nul 2>&1
echo   Firewall rules updated.
echo.

echo ============================================================
echo   INSTALLATION COMPLETE!
echo ============================================================
echo.
echo   RDP Wrapper has been installed with multi-session support.
echo   You can now have multiple users logged in simultaneously.
echo.
echo   To verify: Run "RDPConf.exe" from:
echo   %INSTALL_DIR%
echo.
echo   IMPORTANT: If RDPConf shows "Not Supported", your Windows
echo   build may need a newer rdpwrap.ini. Check:
echo   https://github.com/sebaxakerhtc/rdpwrap.ini
echo.
echo   A RESTART is recommended to fully apply changes.
echo.
echo   Restart now? (Y/N)
set /p RESTART_CHOICE="> "
if /i "%RESTART_CHOICE%"=="Y" (
    echo Restarting in 10 seconds...
    shutdown /r /t 10 /c "RDP Wrapper Setup - Restarting for multi-session support"
) else (
    echo Please restart your PC manually when convenient.
)
echo.
pause
