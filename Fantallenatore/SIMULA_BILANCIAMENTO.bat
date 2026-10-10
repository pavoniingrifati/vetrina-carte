@echo off
setlocal
cd /d "%~dp0"
node balance_sim.js --seasons 3 --days 38 --seed balance --report reports\balance-production-latest.json
set "SIM_EXIT=%ERRORLEVEL%"
echo.
echo Questo report usa il motore Serie A del gioco. Non certifica il bilanciamento con sole tre stagioni.
pause
exit /b %SIM_EXIT%
