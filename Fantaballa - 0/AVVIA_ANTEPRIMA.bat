@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"
title Fantaballa - Anteprima offline

set "START_PAGE=direttore-sportivo.html"
set "SERVER_SCRIPT=AVVIA_ANTEPRIMA.ps1"

if not exist "%START_PAGE%" (
    echo.
    echo [ERRORE] Non trovo %START_PAGE%.
    echo Metti i file di anteprima nella cartella principale di Fantaballa.
    echo.
    pause
    exit /b 1
)

if not exist "%SERVER_SCRIPT%" (
    echo.
    echo [ERRORE] Non trovo %SERVER_SCRIPT%.
    echo Estrai completamente lo ZIP prima di avviare l'anteprima.
    echo.
    pause
    exit /b 1
)

where powershell.exe >nul 2>nul
if errorlevel 1 (
    echo.
    echo [ERRORE] PowerShell non e disponibile su questo computer.
    echo.
    pause
    exit /b 1
)

rem Il percorso del progetto viene rilevato direttamente dallo script PowerShell.
rem In questo modo funzionano anche cartelle con spazi, trattini o parentesi.
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0%SERVER_SCRIPT%" -StartPage "%START_PAGE%"
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
    echo.
    echo [ERRORE] Il server locale non e riuscito ad avviarsi.
    echo Controlla il messaggio mostrato sopra e riprova.
    echo.
    pause
)

endlocal & exit /b %EXIT_CODE%
