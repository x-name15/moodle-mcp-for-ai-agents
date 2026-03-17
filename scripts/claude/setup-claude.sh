#!/bin/bash

# Moodle MCP - Setup Script for Claude Code (Bash)
# ------------------------------------------------
# Registra automáticamente las instancias de Moodle en Claude Code.

CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "\n${CYAN}[Moodle MCP] Configurando para Claude Code...${NC}"

PROJECT_ROOT=$(pwd)
SERVER_PATH="$PROJECT_ROOT/dist/server.js"

if [[ ! -f "$SERVER_PATH" ]]; then
    echo -e "${RED}[!] Error: No se encontró 'dist/server.js'. Ejecuta 'npm run build' primero.${NC}"
    exit 1
fi

INSTANCES=$(ls .env.* 2>/dev/null | grep -v ".env.example")

if [[ -z "$INSTANCES" ]]; then
    echo -e "${RED}[!] Error: No se encontraron archivos .env.moodleX.${NC}"
    exit 1
fi

for INSTANCE_FILE in $INSTANCES; do
    INSTANCE_NAME=${INSTANCE_FILE#".env."}
    echo -n "[+] Registrando mcp:$INSTANCE_NAME en Claude..."
    
    # Usar el comando nativo de Claude Code para añadir el servidor
    claude mcp add "$INSTANCE_NAME" node "$SERVER_PATH" --env "MOODLE_INSTANCE=$INSTANCE_NAME" > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        echo -e " ${GREEN}[OK]${NC}"
    else
        echo -e " ${RED}[FALLÓ]${NC}"
        echo "    (Asegúrate de tener instalado claude-code)"
    fi
done

echo -e "\n${CYAN}[✓] ¡Claude configurado! Ahora puedes usar las tools en Claude Code.${NC}\n"
