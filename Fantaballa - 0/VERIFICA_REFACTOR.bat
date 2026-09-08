@echo off
cd /d "%~dp0"
node scripts\build-champions-data.mjs --check
if errorlevel 1 goto :errore
node scripts\build-special-rules.mjs --check
if errorlevel 1 goto :errore
node scripts\build-cache-busting.mjs --check
if errorlevel 1 goto :errore
node scripts\build-campionati.mjs --check
if errorlevel 1 goto :errore
node scripts\check-gameplay-fixes.mjs
if errorlevel 1 goto :errore
node scripts\check-champions-mode.mjs
if errorlevel 1 goto :errore
node scripts\check-champions-positions.mjs
if errorlevel 1 goto :errore
node scripts\check-player-database-champions.mjs
if errorlevel 1 goto :errore
node --check scripts\build-champions-data.mjs || goto :errore
node --check scripts\check-champions-mode.mjs || goto :errore
node --check scripts\check-champions-positions.mjs || goto :errore
node --check scripts\check-player-database-champions.mjs || goto :errore
node --check scripts\build-cache-busting.mjs || goto :errore
node --check scripts\lib\cache-busting.mjs || goto :errore
for %%F in (assets\season\*.js assets\season\rules\*.js) do node --check "%%F" || goto :errore
echo.
echo Tutti i controlli del refactor e della Champions sono OK.
pause
exit /b 0
:errore
echo.
echo ERRORE: build non sincronizzato, Champions non valida o JavaScript non valido.
pause
exit /b 1
