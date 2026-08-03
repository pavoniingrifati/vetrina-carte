@echo off
setlocal
cd /d "%~dp0"
set "TARGET=%~1"
if not defined TARGET (
  echo Trascina la cartella principale di Fantaballa sopra questo file,
  echo oppure esegui: APPLICA_PATCH.bat "C:\percorso\Fantaballa - 0"
  echo.
  pause
  exit /b 1
)
if not exist "%TARGET%\direttore-sportivo.html" (
  echo ERRORE: la cartella indicata non sembra la cartella principale di Fantaballa.
  pause
  exit /b 1
)
copy /Y "direttore-sportivo.html" "%TARGET%\direttore-sportivo.html" >nul
if not exist "%TARGET%\assets\director" mkdir "%TARGET%\assets\director"
copy /Y "assets\director\director.js" "%TARGET%\assets\director\director.js" >nul
copy /Y "assets\director\director.css" "%TARGET%\assets\director\director.css" >nul
copy /Y "CORREZIONE_INFLUENZA_ESAURITA.txt" "%TARGET%\CORREZIONE_INFLUENZA_ESAURITA.txt" >nul
echo.
echo Patch applicata correttamente.
echo Non serve aggiornare Google Apps Script.
pause
