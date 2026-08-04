@echo off
setlocal
set "PATCH=%~dp0"
set "TARGET=%cd%"
copy /Y "%PATCH%direttore-sportivo.html" "%TARGET%\direttore-sportivo.html" >nul
if not exist "%TARGET%\assets\director" mkdir "%TARGET%\assets\director"
copy /Y "%PATCH%assets\director\director.js" "%TARGET%\assets\director\director.js" >nul
copy /Y "%PATCH%assets\director\director.css" "%TARGET%\assets\director\director.css" >nul
copy /Y "%PATCH%assets\director\player-avatars.js" "%TARGET%\assets\director\player-avatars.js" >nul
copy /Y "%PATCH%assets\creator-avatars.js" "%TARGET%\assets\creator-avatars.js" >nul
echo Patch applicata.
pause
