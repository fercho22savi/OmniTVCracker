# OmniTVCracker v4.0 - Launcher con Backend Real
# Inicia el servidor Python de backend y luego abre la interfaz

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$htmlPath  = Join-Path $scriptDir "index.html"
$serverPy  = Join-Path $scriptDir "server.py"
$fileUri   = "file:///" + ($htmlPath -replace '\\', '/')

Write-Host ""
Write-Host "  ==========================================" -ForegroundColor Cyan
Write-Host "   OmniTVCracker v4.0 - Real + Sim Mode" -ForegroundColor Cyan
Write-Host "  ==========================================" -ForegroundColor Cyan
Write-Host ""

# ── Iniciar backend Python ──────────────────
$pythonOk = $false
try {
    $pyVer = python --version 2>&1
    if ($LASTEXITCODE -eq 0) { $pythonOk = $true }
} catch {}

if ($pythonOk) {
    # Verificar/instalar websockets
    Write-Host "  [*] Verificando dependencias..." -ForegroundColor Yellow
    python -c "import websockets" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [*] Instalando websockets..." -ForegroundColor Yellow
        python -m pip install websockets --quiet
    }

    Write-Host "  [*] Iniciando backend (server.py)..." -ForegroundColor Yellow
    $backend = Start-Process python -ArgumentList "`"$serverPy`"" `
        -WorkingDirectory $scriptDir `
        -WindowStyle Minimized `
        -PassThru

    Start-Sleep -Milliseconds 1800
    Write-Host "  [OK] Backend PID: $($backend.Id)" -ForegroundColor Green
} else {
    Write-Host "  [!] Python no encontrado - Modo Real NO disponible" -ForegroundColor Red
    Write-Host "      Descarga: https://www.python.org/downloads/" -ForegroundColor DarkRed
}

Write-Host ""

# ── Lanzar interfaz ─────────────────────────
$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$edgePath   = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$exePath    = Join-Path $scriptDir "OmniTVCracker.exe"

if (Test-Path $exePath) {
    Write-Host "  [*] Abriendo interfaz (OmniTVCracker.exe)..." -ForegroundColor Cyan
    Start-Process -FilePath $exePath -WorkingDirectory $scriptDir
} elseif (Test-Path $chromePath) {
    Write-Host "  [*] Abriendo en Chrome..." -ForegroundColor Cyan
    Start-Process -FilePath $chromePath -ArgumentList "--new-window `"$fileUri`""
} elseif (Test-Path $edgePath) {
    Write-Host "  [*] Abriendo en Edge..." -ForegroundColor Cyan
    Start-Process -FilePath $edgePath -ArgumentList "--new-window `"$fileUri`""
} else {
    Write-Host "  [*] Abriendo en navegador predeterminado..." -ForegroundColor Yellow
    Start-Process $fileUri
}

Write-Host ""
Write-Host "  Listo. Cierra esta ventana cuando termines." -ForegroundColor DarkGray
