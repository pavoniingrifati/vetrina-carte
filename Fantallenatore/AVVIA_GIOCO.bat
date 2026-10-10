@echo off
cd /d "%~dp0"
title Fantallenatore - Server locale
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0server_fantallenatore.ps1"
