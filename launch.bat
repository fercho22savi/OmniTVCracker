@echo off
title TV PIN Ultimate Codificador
cd /d "%~dp0"

set "CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe"
set "HTML_FILE=%~dp0index.html"

if exist "%~dp0OmniTVCracker.exe" (
    start "" "%~dp0OmniTVCracker.exe"
    exit /b 0
)

if exist "%CHROME_PATH%" (
    start "" "%CHROME_PATH%" --new-window "%HTML_FILE%"
    exit /b 0
)

start "" "%HTML_FILE%"
exit /b 0
