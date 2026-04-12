# === SETUP COMPLET AGENTOS ===
$root = "C:\Users\User\Documents\New project"
$venv = "$root\backend\venv"
$py = "$venv\Scripts\python.exe"
$pip = "$venv\Scripts\pip.exe"

Write-Host "=== 1. Venv Python ===" -ForegroundColor Cyan
if (-not (Test-Path $py)) {
    & "C:\Program Files\Python312\python.exe" -m venv $venv
    Write-Host "Venv créé" -ForegroundColor Green
} else {
    Write-Host "Venv existe" -ForegroundColor Green
}

Write-Host "`n=== 2. Installation dépendances ===" -ForegroundColor Cyan
& $pip install -r "$root\backend\requirements.txt"
if ($LASTEXITCODE -ne 0) { Write-Host "ERREUR pip!" -ForegroundColor Red; Read-Host; exit 1 }
Write-Host "Dépendances OK" -ForegroundColor Green

Write-Host "`n=== 3. Test import ===" -ForegroundColor Cyan
& $py -c "import fastapi,uvicorn,anthropic; print('Imports OK')"
if ($LASTEXITCODE -ne 0) { Write-Host "ERREUR imports!" -ForegroundColor Red; Read-Host; exit 1 }

Write-Host "`n=== 4. Démarrage Backend (port 8000) ===" -ForegroundColor Cyan
Start-Process "cmd.exe" -ArgumentList "/k cd /d `"$root\backend`" && `"$py`" run.py"
Start-Sleep 8

Write-Host "`n=== 5. Test backend ===" -ForegroundColor Cyan
try {
    $h = (Invoke-WebRequest "http://127.0.0.1:8000/health" -UseBasicParsing -TimeoutSec 5 | ConvertFrom-Json)
    Write-Host "Backend UP v$($h.version) | Anthropic=$($h.system.anthropic_key)" -ForegroundColor Green
    Write-Host "DC=$($h.desktop_commander.enabled)" -ForegroundColor Green
} catch {
    Write-Host "Backend pas prêt (normal si uvicorn charge encore)" -ForegroundColor Yellow
}

Write-Host "`n=== 6. Démarrage Frontend (port 8080) ===" -ForegroundColor Cyan
Start-Process "cmd.exe" -ArgumentList "/k cd /d `"$root`" && npm run dev"

Write-Host "`nTout lancé! Ouvre http://127.0.0.1:8080" -ForegroundColor Green
Read-Host "Appuie sur Entrée pour fermer cette fenêtre"
