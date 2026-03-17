#!/bin/bash

# Moodle MCP - Setup Script for Claude Code (Bash)
# ------------------------------------------------
# Automatically registers Moodle instances in Claude Code.

CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "\n${CYAN}[Moodle MCP] Configuring for Claude Code...${NC}"

PROJECT_ROOT=$(pwd)
SERVER_PATH="$PROJECT_ROOT/dist/server.js"

if [[ ! -f "$SERVER_PATH" ]]; then
    echo -e "${RED}[!] Error: 'dist/server.js' not found. Run 'npm run build' first.${NC}"
    exit 1
fi

INSTANCES=$(ls .env.* 2>/dev/null | grep -v ".env.example")

if [[ -z "$INSTANCES" ]]; then
    echo -e "${RED}[!] Error: No .env.moodleX files found.${NC}"
    exit 1
fi

for INSTANCE_FILE in $INSTANCES; do
    INSTANCE_NAME=${INSTANCE_FILE#".env."}
    echo -n "[+] Registering mcp:$INSTANCE_NAME in Claude..."
    
    # Use native Claude Code command to add the server
    claude mcp add "$INSTANCE_NAME" node "$SERVER_PATH" --env "MOODLE_INSTANCE=$INSTANCE_NAME" > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        echo -e " ${GREEN}[OK]${NC}"
    else
        echo -e " ${RED}[FAILED]${NC}"
        echo "    (Make sure you have claude-code installed)"
    fi
done

echo -e "\n${CYAN}[✓] Claude configured! You can now use the tools in Claude Code.${NC}\n"
