#!/bin/bash

CURRENT_PATH=$(pwd)
SERVER_PATH="$CURRENT_PATH/dist/server.js"

# Colores
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

echo -e "${CYAN}--- Moodle MCP - Configuración para JetBrains ---${NC}"
echo ""
echo -e "${YELLOW}Copia y pega los siguientes valores en Settings | Tools | AI Assistant | MCP:${NC}"
echo ""
echo "Command:   node"
echo "Arguments: \"$SERVER_PATH\""
echo ""
echo -e "${GRAY}Nota: Asegúrate de tener configurada la variable de entorno MOODLE_INSTANCE en tu sistema o mediante un archivo .env${NC}"
echo "---------------------------------------------"