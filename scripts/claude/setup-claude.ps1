# Moodle MCP - Setup Script for Claude Code
# ---------------------------------------------
# Registra automáticamente las instancias de Moodle en Claude Code.

Write-Host "`n[Moodle MCP] Configurando para Claude Code..." -ForegroundColor Cyan

# 1. Obtener ruta absoluta del proyecto
$ProjectRoot = Get-Item "." | Select-Object -ExpandProperty FullName
$ServerPath = Join-Path $ProjectRoot "dist\server.js"

if (-not (Test-Path $ServerPath)) {
    Write-Host "[!] Error: No se encontró 'dist\server.js'. Por favor ejecuta 'npm run build' primero." -ForegroundColor Red
    exit 1
}

# 2. Detectar instancias .env.*
$Instances = Get-ChildItem -Path "." -Filter ".env.*" | Where-Object { $_.Name -ne ".env.example" }

if ($Instances.Count -eq 0) {
    Write-Host "[!] Error: No se encontraron archivos .env.moodleX." -ForegroundColor Red
    exit 1
}

Write-Host "[i] Encontradas $($Instances.Count) instancias de Moodle."

# 3. Registrar cada instancia en Claude Code
foreach ($InstanceFile in $Instances) {
    $InstanceName = $InstanceFile.Name.Replace(".env.", "")
    
    Write-Host "[+] Registrando mcp:$InstanceName en Claude..." -NoNewline
    
    # Intentar usar el comando nativo 'claude mcp add'
    # Nota: Claude Code suele usar el archivo ~/.claude.json para global
    # o .mcp.json para local. El comando CLI es lo más seguro.
    & claude mcp add $InstanceName node "`"$ServerPath`"" --env "MOODLE_INSTANCE=$InstanceName" 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host " [OK]" -ForegroundColor Green
    } else {
        Write-Host " [FALLÓ]" -ForegroundColor Red
        Write-Host "    (Asegúrate de tener instalado claude-code)" -ForegroundColor Gray
    }
}

Write-Host "`n[✓] ¡Configuración completada! Ahora puedes usar las tools en Claude Code.`n" -ForegroundColor Cyan
