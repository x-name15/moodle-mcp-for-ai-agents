#!/bin/bash

# Moodle MCP - Setup Script (Bash)
# ---------------------------------------------
# Automatically registers Moodle instances in the global Gemini CLI configuration.

# Output colors
CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "\n${CYAN}[Moodle MCP] Configuring native environment for Gemini...${NC}"

# 1. Get absolute project path
PROJECT_ROOT=$(pwd)
SERVER_PATH="$PROJECT_ROOT/dist/server.js"

if [[ ! -f "$SERVER_PATH" ]]; then
    echo -e "${RED}[!] Error: 'dist/server.js' not found. Please run 'npm run build' first.${NC}"
    exit 1
fi

# 2. Detect .env.* instances
INSTANCES=$(ls .env.* 2>/dev/null | grep -v ".env.example")

if [[ -z "$INSTANCES" ]]; then
    echo -e "${RED}[!] Error: No .env.moodleX files found. Create one based on .env.example.${NC}"
    exit 1
fi

# 3. Register each instance in Gemini CLI
for INSTANCE_FILE in $INSTANCES; do
    # Extract instance name (e.g. moodle45 from .env.moodle45)
    INSTANCE_NAME=${INSTANCE_FILE#".env."}
    
    echo -n "[+] Registering mcp:$INSTANCE_NAME..."
    
    # Run native Gemini command
    gemini mcp add "$INSTANCE_NAME" node "$SERVER_PATH" --env "MOODLE_INSTANCE=$INSTANCE_NAME" --scope user > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        echo -e " ${GREEN}[OK]${NC}"
    else
        echo -e " ${RED}[FAILED]${NC}"
        echo "    (Make sure you have gemini-cli installed)"
    fi
done

echo -e "\n${CYAN}[✓] Configuration completed! You can now use @moodleX in any Gemini session.${NC}\n"
