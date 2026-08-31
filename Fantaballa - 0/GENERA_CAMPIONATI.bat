@echo off
cd /d "%~dp0"
node scripts\build-special-rules.mjs
if errorlevel 1 goto :errore
node scripts\build-cache-busting.mjs
if errorlevel 1 goto :errore
node scripts\build-campionati.mjs
if errorlevel 1 goto :errore
echo.
echo Regole speciali, cache-busting e Campionati generati correttamente.
pause
exit /b 0
:errore
echo.
echo ERRORE durante la generazione del progetto.
pause
exit /b 1
