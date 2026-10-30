@echo off
title OmniTVCracker v4.0 REAL
cd /d "%~dp0"

echo.
echo  ==========================================
echo   OmniTVCracker v4.0 - Modo Real + Sim
echo  ==========================================
echo.

:: ── Verificar Python ──────────────────────
where python >nul 2>&1
if errorlevel 1 (
    echo  [!] Python no encontrado. El Modo Real no estara disponible.
    echo      Descarga Python desde https://www.python.org/downloads/
    echo.
    goto :launch_ui
)

:: ── Instalar dependencias si faltan ───────
echo  [*] Verificando dependencias Python...
python -c "import websockets" >nul 2>&1
if errorlevel 1 (
    echo  [*] Instalando websockets...
    python -m pip install websockets --quiet
)

:: ── Iniciar backend en segundo plano ──────
echo  [*] Iniciando backend real (server.py)...
start "OmniTVCracker Backend" /min cmd /c "python server.py & pause"
timeout /t 2 /nobreak >nul
echo  [OK] Backend iniciado.
echo.

:launch_ui
:: ── Lanzar interfaz ───────────────────────
echo  [*] Abriendo interfaz...
if exist "%~dp0OmniTVCracker.exe" (
    start "" "%~dp0OmniTVCracker.exe"
    exit /b 0
)

set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if exist "%CHROME%" (
    start "" "%CHROME%" --new-window "%~dp0index.html"
    exit /b 0
)

start "" "%~dp0index.html"
