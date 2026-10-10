@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Installa Node.js LTS e rilancia questo file.
  pause
  exit /b 1
)
node tests\auction-competitive.js --seeds 2 --strict --report reports\auction-latest.json
set "TEST_EXIT=%ERRORLEVEL%"
if "%TEST_EXIT%"=="0" node tools\summarize-auctions.js reports\auction-latest.json
if "%TEST_EXIT%"=="2" node tools\summarize-auctions.js reports\auction-latest.json
echo.
if "%TEST_EXIT%"=="2" echo Integrita valida, ma alcune soglie di bilanciamento non sono rispettate.
if "%TEST_EXIT%"=="1" echo Errore tecnico nella verifica delle aste.
pause
exit /b %TEST_EXIT%
