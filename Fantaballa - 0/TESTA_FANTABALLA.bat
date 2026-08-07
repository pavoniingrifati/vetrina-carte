@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"

title Fantaballa - Test locale
set "PORT=8765"
set "PAGE=index.html"

:MENU
cls
echo ====================================================
echo            FANTABALLA - TEST LOCALE
echo ====================================================
echo.
echo   1. Campionato del Ca***
echo   2. Fantacampionato del Ca***
echo   3. Home
echo   4. Esci
echo.
set /p "SCELTA=Scegli cosa aprire [1-4]: "

if "%SCELTA%"=="1" set "PAGE=campionato.html"& goto START
if "%SCELTA%"=="2" set "PAGE=campionato-real.html"& goto START
if "%SCELTA%"=="3" set "PAGE=index.html"& goto START
if "%SCELTA%"=="4" exit /b 0
goto MENU

:START
cls
echo ====================================================
echo            AVVIO TEST FANTABALLA
echo ====================================================
echo.
echo Pagina: %PAGE%
echo URL: http://127.0.0.1:%PORT%/%PAGE%
echo.

where powershell.exe >nul 2>nul
if errorlevel 1 goto NO_POWERSHELL

echo Avvio server con Windows PowerShell...
start "Fantaballa - Server locale" powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -NoExit -File "%~dp0TEST_SERVER_FANTABALLA.ps1" -Port %PORT%

echo Attendo l'avvio del server...
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:%PORT%/%PAGE%"

echo.
echo Browser aperto.
echo Per fermare il server chiudi la finestra "Fantaballa - Server locale".
echo.
pause
exit /b 0

:NO_POWERSHELL
echo ERRORE: Windows PowerShell non e stato trovato.
echo Il batch usa soltanto PowerShell, normalmente incluso in Windows 10 e 11.
echo.
pause
exit /b 1
