#!/bin/bash
# scripts/add-instance/add-instance.sh
# Script to add a new Moodle instance to the MCP server.

echo "--- Moodle MCP: Agregar Nueva Instancia ---"

# 1. Solicitar datos de la instancia
read -p "ID de la instancia (ej. moodle41, prod, dev): " InstanceId
if [ -z "$InstanceId" ]; then
    echo "[!] El ID es obligatorio."
    exit 1
fi

read -p "Nombre descriptivo de Moodle (ej. Moodle 4.1 Test): " MoodleName
read -p "Versión de Moodle (ej. 4.1): " MoodleVersion
read -p "Ruta raíz en el disco (ej. /var/www/html/moodle): " MoodlePath
read -p "URL de acceso (ej. http://localhost:8080): " MoodleUrl

read -p "DB Host [localhost]: " DbHost
DbHost=${DbHost:-localhost}
read -p "DB Port [3306]: " DbPort
DbPort=${DbPort:-3306}
read -p "DB Name [moodle]: " DbName
DbName=${DbName:-moodle}
read -p "DB User [root]: " DbUser
DbUser=${DbUser:-root}
read -p "DB Password: " DbPass

read -p "RabbitMQ Host [localhost]: " RabbitHost
RabbitHost=${RabbitHost:-localhost}
read -p "RabbitMQ Management Port [15672]: " RabbitMgmtPort
RabbitMgmtPort=${RabbitMgmtPort:-15672}
read -p "RabbitMQ Port [5672]: " RabbitPort
RabbitPort=${RabbitPort:-5672}
read -p "RabbitMQ User [guest]: " RabbitUser
RabbitUser=${RabbitUser:-guest}
read -p "RabbitMQ Password [guest]: " RabbitPass
RabbitPass=${RabbitPass:-guest}

# 2. Definir rutas
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
if [[ "$SCRIPT_DIR" == *"scripts/add-instance" ]]; then
    PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
else
    PROJECT_ROOT="$(pwd)"
fi

EnvFile="$PROJECT_ROOT/.env.$InstanceId"
MicroservicesFile="$PROJECT_ROOT/data/microservices.$InstanceId.json"
McpFile="$PROJECT_ROOT/mcp.json"
VsCodeMcpFile="$PROJECT_ROOT/.vscode/mcp.json"
ServerPath="$PROJECT_ROOT/dist/server.js"

# 3. Crear archivo .env
cat <<EOF > "$EnvFile"
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
EOF

echo "[+] Archivo .env.$InstanceId creado."

# 4. Crear microservices.json si no existe
if [ ! -f "$MicroservicesFile" ]; then
    echo '{"microservices": []}' > "$MicroservicesFile"
    echo "[+] Archivo microservices.$InstanceId.json creado."
fi

# 5. Función para actualizar mcp.json usando Node
update_mcp() {
    local target_file=$1
    node -e "
const fs = require('fs');
const path = require('path');
const mcpFile = '$target_file';
const instanceId = '$InstanceId';
const serverPath = '$ServerPath';

let config = { servers: {} };
if (fs.existsSync(mcpFile)) {
    try {
        config = JSON.parse(fs.readFileSync(mcpFile, 'utf8'));
    } catch (e) {}
}

if (!config.servers) config.servers = {};

config.servers[instanceId] = {
    type: 'stdio',
    command: 'node',
    args: [serverPath],
    env: {
        MOODLE_INSTANCE: instanceId
    }
};

if (!fs.existsSync(path.dirname(mcpFile))) {
    fs.mkdirSync(path.dirname(mcpFile), { recursive: true });
}
fs.writeFileSync(mcpFile, JSON.stringify(config, null, 4), 'utf8');
"
}

# 6. Actualizar mcp.json en la raíz
update_mcp "$McpFile"
echo "[+] mcp.json (raíz) actualizado."

# 7. Actualizar .vscode/mcp.json
if [ -d "$PROJECT_ROOT/.vscode" ]; then
    update_mcp "$VsCodeMcpFile"
    echo "[+] .vscode/mcp.json actualizado para GitHub Copilot."
else
    read -p "¿Deseas crear la configuración para VS Code (.vscode/mcp.json)? (s/n): " CreateVsCode
    if [ "$CreateVsCode" == "s" ]; then
        update_mcp "$VsCodeMcpFile"
        echo "[+] .vscode/mcp.json creado para GitHub Copilot."
    fi
fi

# 8. Registrar en clientes MCP
echo ""
echo "--- Registrando en Clientes MCP ---"

if [ -f "$PROJECT_ROOT/scripts/gemini/setup-gemini.sh" ]; then
    echo "[i] Registrando en Gemini CLI..."
    (cd "$PROJECT_ROOT" && bash ./scripts/gemini/setup-gemini.sh)
fi

if [ -f "$PROJECT_ROOT/scripts/claude/setup-claude.sh" ]; then
    echo "[i] Registrando en Claude Code..."
    (cd "$PROJECT_ROOT" && bash ./scripts/claude/setup-claude.sh)
fi

echo ""
echo "[✓] Proceso finalizado. Instancia $InstanceId lista para usar."
