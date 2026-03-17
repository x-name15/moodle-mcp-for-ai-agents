# Moodle MCP - Setup Script
Write-Host "Configurando..."

$ProjectRoot = Get-Item "." | Select-Object -ExpandProperty FullName
$ServerPath = Join-Path $ProjectRoot "dist\server.js"

if (-not (Test-Path $ServerPath)) {
    Write-Host "Error: No se encontro dist\server.js"
    exit 1
}

$Instances = Get-ChildItem -Path "." -Filter ".env.*" | Where-Object { $_.Name -ne ".env.example" }

foreach ($Instance in $Instances) {
    $Name = $Instance.Name.Replace(".env.", "")
    Write-Host "Registrando $Name..."
    & gemini mcp add $Name node "$ServerPath" --env "MOODLE_INSTANCE=$Name" --scope user
}

Write-Host "Completado."
