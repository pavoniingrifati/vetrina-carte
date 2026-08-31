@echo off
cd /d "%~dp0"
node scripts\build-special-rules.mjs --check
if errorlevel 1 goto :errore
node scripts\build-cache-busting.mjs --check
if errorlevel 1 goto :errore
node scripts\build-campionati.mjs --check
if errorlevel 1 goto :errore
node scripts\check-gameplay-fixes.mjs
if errorlevel 1 goto :errore
node --check scripts\build-cache-busting.mjs || goto :errore
node --check scripts\lib\cache-busting.mjs || goto :errore
for %%F in (assets\season\rules\*.js) do node --check "%%F" || goto :errore
echo.
echo Tutti i controlli del refactor sono OK.
pause
exit /b 0
:errore
echo.
echo ERRORE: build non sincronizzato o JavaScript non valido.
pause
exit /b 1
