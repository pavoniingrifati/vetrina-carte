@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo =====================================================
echo   FANTABALLA - 16 INFLUENZE E INTERVENTI RIPETIBILI
echo =====================================================
echo.
set "TARGET=%~1"
if not defined TARGET (
  set /p "TARGET=Incolla il percorso della cartella principale di Fantaballa: "
)
set "TARGET=%TARGET:"=%"
if not exist "%TARGET%\index.html" (
  echo.
  echo [ERRORE] Nel percorso indicato non trovo index.html.
  echo Controlla di aver selezionato la cartella principale del sito.
  pause
  exit /b 1
)
echo.
echo Copia dei file in corso...
robocopy "%~dp0" "%TARGET%" /E /R:1 /W:1 /XF "APPLICA_PATCH.bat" "LEGGIMI_PATCH.txt" >nul
set "RC=%ERRORLEVEL%"
if %RC% GEQ 8 (
  echo [ERRORE] La copia non e riuscita. Codice Robocopy: %RC%
  pause
  exit /b %RC%
)
echo.
echo [OK] Patch applicata.
echo Le missioni iniziano con 16 Influenze e puoi usare piu interventi nella stessa giornata.
echo.
echo IMPORTANTE: aggiorna anche il deployment Google Apps Script seguendo AGGIORNA_GOOGLE_SCRIPT.txt.
pause
exit /b 0
