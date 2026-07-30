@echo off
title Fantarosa FM - Server locale
cd /d "%~dp0"

echo Avvio del sito su http://localhost:8000/
echo Lascia aperta questa finestra mentre lavori.
echo Per chiudere il server premi CTRL+C.
echo.

where py >nul 2>nul
if %errorlevel%==0 (
  start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 1; Start-Process 'http://localhost:8000/'"
  py -m http.server 8000
) else (
  where python >nul 2>nul
  if %errorlevel% neq 0 (
    echo ERRORE: Python non e installato o non e disponibile nel PATH.
    echo Installa Python e riprova.
    pause
    exit /b 1
  )
  start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 1; Start-Process 'http://localhost:8000/'"
  python -m http.server 8000
)

pause
