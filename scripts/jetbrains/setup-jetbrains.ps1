$currentPath = Get-Location
$serverPath = Join-Path $currentPath "dist\server.js"

Write-Host "--- Moodle MCP - Configuration for JetBrains ---" -ForegroundColor Cyan
Write-Host ""
Write-Host "Copy and paste the following values in Settings | Tools | AI Assistant | MCP:" -ForegroundColor Yellow
Write-Host ""
Write-Host "Command:   node"
Write-Host "Arguments: `"$serverPath`""
Write-Host ""
Write-Host "Note: Make sure to have the MOODLE_INSTANCE environment variable configured in your system or via an .env file" -ForegroundColor Gray
Write-Host "---------------------------------------------"