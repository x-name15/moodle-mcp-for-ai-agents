$currentPath = Get-Location
$serverPath = Join-Path $currentPath "dist\server.js"

Write-Host "--- Moodle MCP - Configuración para JetBrains ---" -ForegroundColor Cyan
Write-Host ""
Write-Host "Copia y pega los siguientes valores en Settings | Tools | AI Assistant | MCP:" -ForegroundColor Yellow
Write-Host ""
Write-Host "Command:   node"
Write-Host "Arguments: \"$serverPath\""
Write-Host ""
Write-Host "Nota: Asegúrate de tener configurada la variable de entorno MOODLE_INSTANCE en tu sistema o mediante un archivo .env" -ForegroundColor Gray
Write-Host "---------------------------------------------"