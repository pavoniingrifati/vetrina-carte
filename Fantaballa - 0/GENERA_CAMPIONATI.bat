@echo off
cd /d "%~dp0"
node scripts\build-campionati.mjs
if errorlevel 1 (
  echo.
  echo ERRORE durante la generazione dei Campionati.
  pause
  exit /b 1
)
echo.
echo Campionato Community e Fantacampionato REAL generati correttamente.
pause
