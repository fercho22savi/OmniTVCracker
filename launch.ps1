# PowerShell Desktop Launcher for TV PIN Ultimate Codificador
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$htmlPath = Join-Path $scriptDir "index.html"
$fileUri = "file:///" + ($htmlPath -replace '\\', '/')

$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

if (Test-Path $chromePath) {
    Write-Host "Iniciando en modo escritorio con Google Chrome..." -ForegroundColor Cyan
    Start-Process -FilePath $chromePath -ArgumentList "--app=`"$fileUri`"", "--window-size=1280,780"
} elseif (Test-Path $edgePath) {
    Write-Host "Iniciando en modo escritorio con Microsoft Edge..." -ForegroundColor Cyan
    Start-Process -FilePath $edgePath -ArgumentList "--app=`"$fileUri`"", "--window-size=1280,780"
} else {
    Write-Host "Iniciando en navegador del sistema..." -ForegroundColor Yellow
    Start-Process $fileUri
}
