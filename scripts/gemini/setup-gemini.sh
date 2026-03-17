#!/bin/bash

# Moodle MCP - Setup Script (Bash)
# ---------------------------------------------
# Registra automáticamente las instancias de Moodle en la configuración global de Gemini CLI.

# Colores para la salida
CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "\n${CYAN}[Moodle MCP] Configurando entorno nativo para Gemini...${NC}"

# 1. Obtener ruta absoluta del proyecto
PROJECT_ROOT=$(pwd)
SERVER_PATH="$PROJECT_ROOT/dist/server.js"

if [[ ! -f "$SERVER_PATH" ]]; then
    echo -e "${RED}[!] Error: No se encontró 'dist/server.js'. Por favor ejecuta 'npm run build' primero.${NC}"
    exit 1
fi

# 2. Detectar instancias .env.*
INSTANCES=$(ls .env.* 2>/dev/null | grep -v ".env.example")

if [[ -z "$INSTANCES" ]]; then
    echo -e "${RED}[!] Error: No se encontraron archivos .env.moodleX. Crea uno basándote en .env.example.${NC}"
    exit 1
fi

# 3. Registrar cada instancia en Gemini CLI
for INSTANCE_FILE in $INSTANCES; do
    # Extraer el nombre de la instancia (ej: moodle45 de .env.moodle45)
    INSTANCE_NAME=${INSTANCE_FILE#".env."}
    
    echo -n "[+] Registrando mcp:$INSTANCE_NAME..."
    
    # Ejecutar comando nativo de Gemini
    gemini mcp add "$INSTANCE_NAME" node "$SERVER_PATH" --env "MOODLE_INSTANCE=$INSTANCE_NAME" --scope user > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        echo -e " ${GREEN}[OK]${NC}"
    else
        echo -e " ${RED}[FALLÓ]${NC}"
        echo "    (Asegúrate de tener instalado gemini-cli)"
    fi
done

echo -e "\n${CYAN}[✓] ¡Configuración completada! Ahora puedes usar @moodleX en cualquier sesión de Gemini.${NC}\n"
