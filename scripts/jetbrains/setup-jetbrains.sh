#!/bin/bash

CURRENT_PATH=$(pwd)
SERVER_PATH="$CURRENT_PATH/dist/server.js"

# Colors
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
GRAY='\033[0;90m'
NC='\033[0m'

echo -e "${CYAN}--- Moodle MCP - Configuration for JetBrains ---${NC}"
echo ""
echo -e "${YELLOW}Copy and paste the following values in Settings | Tools | AI Assistant | MCP:${NC}"
echo ""
echo "Command:   node"
echo "Arguments: \"$SERVER_PATH\""
echo ""
echo -e "${GRAY}Note: Make sure to have the MOODLE_INSTANCE environment variable configured in your system or via an .env file${NC}"
echo "---------------------------------------------"