# Moodle MCP Server for AIs

[![Node.js Version](https://img.shields.io/badge/node-20+-brightgreen?style=flat-square)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.2-blue?style=flat-square)](https://www.typescriptlang.org/)
[![Moodle](https://img.shields.io/badge/Moodle-4.1%20|%204.5-orange?style=flat-square)](https://moodle.org/)
[![MCP Server](https://img.shields.io/badge/MCP-Server-purple?style=flat-square)](https://modelcontextprotocol.org/)
[![Gemini CLI](https://img.shields.io/badge/Gemini-CLI-4285F4?style=flat-square&logo=google&logoColor=white)](https://ai.google.dev/)
[![Claude Code](https://img.shields.io/badge/Claude-Code-000000?style=flat-square&logo=anthropic&logoColor=white)](https://www.anthropic.com/)
[![GitHub Copilot](https://img.shields.io/badge/GitHub%20Copilot-AI-181717?style=flat-square&logo=github&logoColor=white)](https://github.com/features/copilot)

MCP (Model Context Protocol) server to connect different AIs with Moodle instances and expose real context of plugins, database, logs, web services, RabbitMQ and infrastructure.

## Documentation

- Complete MCP tools catalog: [docs/tools.md](docs/tools/tools.md)
- Installation guide for Gemini CLI: [docs/gemini/GEMINI.md](docs/gemini/GEMINI.md)
- Installation guide for Claude Code: [docs/claude/CLAUDE.md](docs/claude/CLAUDE.md)
- Installation guide for JetBrains (PhpStorm/IntelliJ): [docs/jetbrains/JETBRAINS.md](docs/jetbrains/JETBRAINS.md)

## Requirements

- Node.js 20+
- Access to the Moodle MariaDB/MySQL database
- Access to the Moodle filesystem (for plugin/config analysis)
- RabbitMQ Management API optional (if using RabbitMQ tools)

## Installation

```bash
npm install
npm run build
```

## Quick setup (EXPERIMENTAL)

You can playfully add a new Moodle instance interactively:

- Windows: `./scripts/add-instance/add-instance.ps1`
- Linux/Mac: `bash scripts/add-instance/add-instance.sh`

This script will automatically configure the `.env.<instance>` file, create the microservices template, and register the instance in:
- **Gemini CLI**
- **Claude Code**
- **VS Code / GitHub Copilot** (updates `.vscode/mcp.json`)
- **Project Root** (`mcp.json`)

### Manual configuration

1. Create a `.env.<instance>` file in the project root (e.g. `.env.moodle41`).
2. Define at least these variables:

```dotenv
MOODLE_NAME="Moodle 4.1"
MOODLE_VERSION="4.1"
MOODLE_ROOT_PATH="/path/to/moodle"
MOODLE_URL="http://localhost:8080"

DB_HOST="localhost"
DB_PORT="3306"
DB_NAME="moodle"
DB_USER="root"
DB_PASSWORD="password"

RABBITMQ_HOST="localhost"
RABBITMQ_MANAGEMENT_PORT="15672"
RABBITMQ_USER="guest"
RABBITMQ_PASSWORD="guest"

MICROSERVICES_CONFIG="./data/microservices.moodle41.json"
```

3. In VS Code, configure `.vscode/mcp.json` and define `MOODLE_INSTANCE` with the same suffix of the `.env.<instance>`.

## Usage

- Interactive development:

```bash
npm run dev
```

- Production (MCP via `stdio`):

```bash
npm run build
node dist/server.js
```

## Supported Clients

### GitHub Copilot for VS Code

- Configure the MCP server in the workspace with `mcp.json`.
- You can use [examples/mcp.json.example](examples/mcp.json.example) as a base.
- Define `MOODLE_INSTANCE` with the instance you want to use (`moodle41`, `moodle45`, etc.).

### Gemini CLI

- Windows: `./scripts/gemini/setup-gemini.ps1`
- Linux/Mac: `bash scripts/gemini/setup-gemini.sh`
- The script automatically registers each `.env.*` found.

### Claude Code

- Windows: `./scripts/claude/setup-claude.ps1`
- Linux/Mac: `bash scripts/claude/setup-claude.sh`
- The script automatically registers each `.env.*` found.

### JetBrains (PhpStorm / IntelliJ / WebStorm)

- Native support through **AI Assistant** (2024.3+) or plugins like **Continue**.
- Detailed guide: [docs/jetbrains/JETBRAINS.md](docs/jetbrains/JETBRAINS.md)
- Configuration script: 
  - Windows: `./scripts/jetbrains/setup-jetbrains.ps1`
  - Linux/Mac: `bash scripts/jetbrains/setup-jetbrains.sh`

## MCP connection maintenance

If you add new tools or change configuration per instance:

1. Rebuild the server: `npm run build`
2. Re-run the client setup script you use (Gemini/Claude)
3. Restart the MCP client session to reload tools

## Included MCP Prompts

- `moodle_capabilities`
- `moodle_status`
- `understand_plugin`
- `debug_error`
- `new_plugin`
- `integrate_plugins`

## Security

- SQL queries use prepared statements.
- `get_moodle_config` masks `dbpass` in the output.