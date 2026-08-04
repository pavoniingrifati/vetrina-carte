@echo off
setlocal
chcp 65001 >nul
set "PATCH=%~dp0"
echo.
echo PATCH - EVENTI DAVIDE E GOLIA / PARACADUTE TECNICO
echo.
set /p "TARGET=Trascina qui la cartella principale di Fantaballa, poi premi Invio: "
set "TARGET=%TARGET:"=%"
if not exist "%TARGET%\campionato.html" (
  echo.
  echo ERRORE: nella cartella scelta non trovo campionato.html
  pause
  exit /b 1
)
if not exist "%TARGET%\direttore-sportivo.html" (
  echo.
  echo ERRORE: nella cartella scelta non trovo direttore-sportivo.html
  pause
  exit /b 1
)
copy /Y "%PATCH%campionato.html" "%TARGET%\campionato.html" >nul
copy /Y "%PATCH%campionato-real.html" "%TARGET%\campionato-real.html" >nul
copy /Y "%PATCH%direttore-sportivo.html" "%TARGET%\direttore-sportivo.html" >nul
copy /Y "%PATCH%NUOVI_EVENTI_DAVIDE_GOLIA_OVR.txt" "%TARGET%\NUOVI_EVENTI_DAVIDE_GOLIA_OVR.txt" >nul
if not exist "%TARGET%\assets\season" mkdir "%TARGET%\assets\season"
if not exist "%TARGET%\assets\director" mkdir "%TARGET%\assets\director"
if not exist "%TARGET%\data\events" mkdir "%TARGET%\data\events"
copy /Y "%PATCH%assets\season\*.js" "%TARGET%\assets\season\" >nul
copy /Y "%PATCH%assets\director\director.js" "%TARGET%\assets\director\director.js" >nul
copy /Y "%PATCH%data\events\events-common.json" "%TARGET%\data\events\events-common.json" >nul
copy /Y "%PATCH%data\events\events-director-regulations.json" "%TARGET%\data\events\events-director-regulations.json" >nul
echo.
echo Patch applicata correttamente.
pause
