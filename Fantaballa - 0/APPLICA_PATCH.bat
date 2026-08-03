@echo off
setlocal
cd /d "%~dp0"
echo.
echo PATCH PUNTEGGIO DIRETTORE SPORTIVO
if not exist "assets\director\director.js" goto :missing
if not exist "classifica.html" goto :missing
if not exist "google-apps-script\invio_vittoria.gs" goto :missing
echo I file della patch sono presenti.
echo.
echo Copia o estrai questa cartella nella directory principale di Fantaballa,
echo confermando la sostituzione dei file.
echo.
echo PASSAGGIO OBBLIGATORIO: aggiorna Google Apps Script.
start "" notepad.exe "AGGIORNA_GOOGLE_SCRIPT.txt"
pause
exit /b 0
:missing
echo [ERRORE] Estrai completamente lo ZIP prima di usare questo file.
pause
exit /b 1
