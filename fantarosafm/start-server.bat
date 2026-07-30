@echo off
setlocal
title Fantarosa FM - Server locale
cd /d "%~dp0"

echo Avvio del sito su http://localhost:8000/
echo Non serve installare Python.
echo.

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1" -Port 8000

if errorlevel 1 (
    echo.
    echo Il server non e stato avviato.
    pause
)
endlocal
