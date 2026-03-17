# Moodle MCP - Setup Script
Write-Host "Configuring..."

$ProjectRoot = Get-Item "." | Select-Object -ExpandProperty FullName
$ServerPath = Join-Path $ProjectRoot "dist\server.js"

if (-not (Test-Path $ServerPath)) {
    Write-Host "Error: dist\server.js not found"
    exit 1
}

$Instances = Get-ChildItem -Path "." -Filter ".env.*" | Where-Object { $_.Name -ne ".env.example" }

foreach ($Instance in $Instances) {
    $Name = $Instance.Name.Replace(".env.", "")
    Write-Host "Registering $Name..."
    & gemini mcp add $Name node "$ServerPath" --env "MOODLE_INSTANCE=$Name" --scope user
}

Write-Host "Completed."
