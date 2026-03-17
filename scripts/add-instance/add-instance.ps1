# scripts/add-instance/add-instance.ps1
# Script to add a new Moodle instance to the MCP server.

Write-Host "--- Moodle MCP: Agregar Nueva Instancia ---" -ForegroundColor Cyan

# 1. Solicitar datos de la instancia
$InstanceId = Read-Host "ID de la instancia (ej. moodle41, prod, dev)"
if ([string]::IsNullOrWhiteSpace($InstanceId)) {
    Write-Host "[!] El ID es obligatorio." -ForegroundColor Red
    exit 1
}

$MoodleName = Read-Host "Nombre descriptivo de Moodle (ej. Moodle 4.1 Test)"
$MoodleVersion = Read-Host "Versión de Moodle (ej. 4.1)"
$MoodlePath = Read-Host "Ruta raíz en el disco (ej. C:\moodle\server)"
$MoodleUrl = Read-Host "URL de acceso (ej. http://localhost:8080)"

$DbHost = Read-Host "DB Host [localhost]"
if ([string]::IsNullOrWhiteSpace($DbHost)) { $DbHost = "localhost" }
$DbPort = Read-Host "DB Port [3306]"
if ([string]::IsNullOrWhiteSpace($DbPort)) { $DbPort = "3306" }
$DbName = Read-Host "DB Name [moodle]"
if ([string]::IsNullOrWhiteSpace($DbName)) { $DbName = "moodle" }
$DbUser = Read-Host "DB User [root]"
if ([string]::IsNullOrWhiteSpace($DbUser)) { $DbUser = "root" }
$DbPass = Read-Host "DB Password"

$RabbitHost = Read-Host "RabbitMQ Host [localhost]"
if ([string]::IsNullOrWhiteSpace($RabbitHost)) { $RabbitHost = "localhost" }
$RabbitMgmtPort = Read-Host "RabbitMQ Management Port [15672]"
if ([string]::IsNullOrWhiteSpace($RabbitMgmtPort)) { $RabbitMgmtPort = "15672" }
$RabbitPort = Read-Host "RabbitMQ Port [5672]"
if ([string]::IsNullOrWhiteSpace($RabbitPort)) { $RabbitPort = "5672" }
$RabbitUser = Read-Host "RabbitMQ User [guest]"
if ([string]::IsNullOrWhiteSpace($RabbitUser)) { $RabbitUser = "guest" }
$RabbitPass = Read-Host "RabbitMQ Password [guest]"
if ([string]::IsNullOrWhiteSpace($RabbitPass)) { $RabbitPass = "guest" }

# 2. Definir rutas (asumiendo ejecución desde la raíz o dentro de scripts/add-instance)
$CurrentDir = Get-Location
if ($CurrentDir.Path -like "*scripts\add-instance") {
    $ProjectRoot = (Get-Item "..\..").FullName
} else {
    $ProjectRoot = (Get-Item ".").FullName
}

$EnvFile = Join-Path $ProjectRoot ".env.$InstanceId"
$MicroservicesFile = Join-Path $ProjectRoot "data\microservices.$InstanceId.json"
$McpFile = Join-Path $ProjectRoot "mcp.json"
$VsCodeMcpFile = Join-Path $ProjectRoot ".vscode\mcp.json"
$ServerPath = Join-Path $ProjectRoot "dist\server.js"

# 3. Crear archivo .env
$EnvContent = @"
MOODLE_NAME="$MoodleName"
MOODLE_VERSION="$MoodleVersion"
MOODLE_ROOT_PATH="$MoodlePath"
MOODLE_URL="$MoodleUrl"

DB_HOST="$DbHost"
DB_PORT="$DbPort"
DB_NAME="$DbName"
DB_USER="$DbUser"
DB_PASSWORD="$DbPass"

RABBITMQ_HOST="$RabbitHost"
RABBITMQ_PORT="$RabbitPort"
RABBITMQ_MANAGEMENT_PORT="$RabbitMgmtPort"
RABBITMQ_USER="$RabbitUser"
RABBITMQ_PASSWORD="$RabbitPass"

MICROSERVICES_CONFIG="./data/microservices.$InstanceId.json"
"@

$EnvContent | Out-File -FilePath $EnvFile -Encoding UTF8
Write-Host "[+] Archivo .env.$InstanceId creado." -ForegroundColor Green

# 4. Crear microservices.json si no existe
if (-not (Test-Path $MicroservicesFile)) {
    $MsContent = @'
{
    "microservices": []
}
'@
    $MsContent | Out-File -FilePath $MicroservicesFile -Encoding UTF8
    Write-Host "[+] Archivo microservices.$InstanceId.json creado." -ForegroundColor Green
}

# 5. Función para actualizar un archivo mcp.json
function Update-McpConfig {
    param($Path)
    if (Test-Path $Path) {
        $Config = Get-Content $Path | ConvertFrom-Json
    } else {
        $Config = [PSCustomObject]@{ servers = [PSCustomObject]@{} }
    }

    $NewServer = [PSCustomObject]@{
        type = "stdio"
        command = "node"
        args = @($ServerPath)
        env = [PSCustomObject]@{
            MOODLE_INSTANCE = $InstanceId
        }
    }

    if (-not $Config.servers) {
        $Config | Add-Member -MemberType NoteProperty -Name "servers" -Value ([PSCustomObject]@{})
    }

    $Config.servers | Add-Member -MemberType NoteProperty -Name $InstanceId -Value $NewServer -Force
    $Config | ConvertTo-Json -Depth 10 | Out-File -FilePath $Path -Encoding UTF8
}

# 6. Actualizar mcp.json en la raíz
Update-McpConfig $McpFile
Write-Host "[+] mcp.json (raíz) actualizado." -ForegroundColor Green

# 7. Actualizar .vscode/mcp.json si existe o si se solicita
if (Test-Path (Join-Path $ProjectRoot ".vscode")) {
    Update-McpConfig $VsCodeMcpFile
    Write-Host "[+] .vscode/mcp.json actualizado para GitHub Copilot." -ForegroundColor Green
} else {
    $CreateVsCode = Read-Host "¿Deseas crear la configuración para VS Code (.vscode/mcp.json)? (s/n)"
    if ($CreateVsCode -eq "s") {
        New-Item -ItemType Directory -Path (Join-Path $ProjectRoot ".vscode") -Force | Out-Null
        Update-McpConfig $VsCodeMcpFile
        Write-Host "[+] .vscode/mcp.json creado para GitHub Copilot." -ForegroundColor Green
    }
}

# 8. Registrar en clientes MCP
Write-Host "`n--- Registrando en Clientes MCP ---" -ForegroundColor Cyan

$GeminiScript = Join-Path $ProjectRoot "scripts\gemini\setup-gemini.ps1"
if (Test-Path $GeminiScript) {
    Write-Host "[i] Registrando en Gemini CLI..."
    Set-Location $ProjectRoot
    & $GeminiScript
}

$ClaudeScript = Join-Path $ProjectRoot "scripts\claude\setup-claude.ps1"
if (Test-Path $ClaudeScript) {
    Write-Host "[i] Registrando en Claude Code..."
    Set-Location $ProjectRoot
    & $ClaudeScript
}

Write-Host "`n[✓] Proceso finalizado. Instancia $InstanceId lista para usar." -ForegroundColor Green
