@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js non e installato o non e disponibile nel PATH.
  echo Installa Node.js LTS e rilancia questo file.
  pause
  exit /b 1
)
node tests\run-all.js
set "TEST_EXIT=%ERRORLEVEL%"
echo.
if "%TEST_EXIT%"=="3" echo Copertura incompleta: browser non eseguito.
if "%TEST_EXIT%"=="1" echo Verifiche fallite.
if "%TEST_EXIT%"=="0" echo Verifiche dello scope superate; leggere i limiti in TEST_AUTOMATICI.md.
pause
exit /b %TEST_EXIT%
