@echo off
setlocal
set "PATCH=%~dp0"
set "TARGET=%cd%"
if not exist "%TARGET%\index.html" (
  echo Apri la cartella principale di Fantaballa, poi avvia questo file dalla patch.
  pause
  exit /b 1
)
copy /Y "%PATCH%campionato.html" "%TARGET%\campionato.html" >nul
copy /Y "%PATCH%campionato-real.html" "%TARGET%\campionato-real.html" >nul
copy /Y "%PATCH%classifica.html" "%TARGET%\classifica.html" >nul
copy /Y "%PATCH%assets\season-config-real.js" "%TARGET%\assets\season-config-real.js" >nul
copy /Y "%PATCH%assets\season\03-state-and-data.js" "%TARGET%\assets\season\03-state-and-data.js" >nul
copy /Y "%PATCH%assets\season\04-setup-and-draft.js" "%TARGET%\assets\season\04-setup-and-draft.js" >nul
copy /Y "%PATCH%AGGIORNAMENTO_LISTONE_2026_27.txt" "%TARGET%\AGGIORNAMENTO_LISTONE_2026_27.txt" >nul
copy /Y "%PATCH%AGGIORNAMENTO_DICITURE_STAGIONE_2026_2027.txt" "%TARGET%\AGGIORNAMENTO_DICITURE_STAGIONE_2026_2027.txt" >nul
echo Patch applicata correttamente.
pause
