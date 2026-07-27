@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Fantaballa - Anteprima locale

set "PAGE=campionato.html"

echo.
echo ==============================================
echo        FANTABALLA - ANTEPRIMA LOCALE
echo ==============================================
echo.
echo  1. Campionato
echo  2. Campionato Real
echo  3. Tricolore col Pisa
echo  4. Home del sito
echo.
set /p "CHOICE=Scegli la pagina [1-4, Invio = 1]: "

if "%CHOICE%"=="2" set "PAGE=campionato-real.html"
if "%CHOICE%"=="3" set "PAGE=tricolore-pisa.html"
if "%CHOICE%"=="4" set "PAGE=index.html"

if not exist "%PAGE%" (
  echo.
  echo ERRORE: "%PAGE%" non si trova in questa cartella.
  echo.
  echo Copia ENTRAMBI i file:
  echo - AVVIA-ANTEPRIMA.bat
  echo - server-fantaballa.ps1
  echo.
  echo nella cartella principale del progetto, dove si trovano
  echo campionato.html, index.html e la cartella assets.
  echo.
  pause
  exit /b 1
)

if not exist "server-fantaballa.ps1" (
  echo.
  echo ERRORE: manca server-fantaballa.ps1.
  echo Estrai tutto lo ZIP e copia entrambi i file insieme.
  echo.
  pause
  exit /b 1
)

echo.
echo Avvio del server locale...
echo La finestra deve restare aperta durante l'anteprima.
echo.

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0server-fantaballa.ps1" -Root "%CD%" -Page "%PAGE%"

set "ERR=%ERRORLEVEL%"
echo.
if not "%ERR%"=="0" (
  echo Il server si e' chiuso con errore %ERR%.
  echo Leggi il messaggio sopra e premi un tasto.
) else (
  echo Anteprima terminata.
)
pause
exit /b %ERR%
