# Moodle MCP Server para IAs

[![Node.js Version](https://img.shields.io/badge/node-20+-brightgreen?style=flat-square)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.2-blue?style=flat-square)](https://www.typescriptlang.org/)
[![Moodle](https://img.shields.io/badge/Moodle-4.1%20|%204.5-orange?style=flat-square)](https://moodle.org/)
[![MCP Server](https://img.shields.io/badge/MCP-Server-purple?style=flat-square)](https://modelcontextprotocol.org/)
[![Gemini CLI](https://img.shields.io/badge/Gemini-CLI-4285F4?style=flat-square&logo=google&logoColor=white)](https://ai.google.dev/)
[![Claude Code](https://img.shields.io/badge/Claude-Code-000000?style=flat-square&logo=anthropic&logoColor=white)](https://www.anthropic.com/)
[![GitHub Copilot](https://img.shields.io/badge/GitHub%20Copilot-AI-181717?style=flat-square&logo=github&logoColor=white)](https://github.com/features/copilot)

Servidor MCP (Model Context Protocol) para conectar diferentes IAs con instancias de Moodle y exponer contexto real de plugins, base de datos, logs, web services, RabbitMQ e infraestructura.

## Documentación

- Catálogo completo de herramientas MCP: [docs/tools.md](docs/tools/tools.md)
- Guía de instalación para Gemini CLI: [docs/gemini/GEMINI.md](docs/gemini/GEMINI.md)
- Guía de instalación para Claude Code: [docs/claude/CLAUDE.md](docs/claude/CLAUDE.md)

## Requisitos

- Node.js 20+
- Acceso a la base de datos MariaDB/MySQL de Moodle
- Acceso al filesystem de Moodle (para análisis de plugins/config)
- RabbitMQ Management API opcional (si usarás herramientas de RabbitMQ)

## Instalación

```bash
npm install
npm run build
```

## Configuración rápida (EXPERIMENTAL)

Puedes añadir una nueva instancia de Moodle interactivamente:

- Windows: `./scripts/add-instance/add-instance.ps1`
- Linux/Mac: `bash scripts/add-instance/add-instance.sh`

Este script configurará automáticamente el archivo `.env.<instancia>`, creará el template de microservicios y registrará la instancia en:
- **Gemini CLI**
- **Claude Code**
- **VS Code / GitHub Copilot** (actualiza `.vscode/mcp.json`)
- **Raíz del proyecto** (`mcp.json`)

### Configuración manual

1. Crea un archivo `.env.<instancia>` en la raíz del proyecto (ejemplo: `.env.moodle41`).
2. Define al menos estas variables:

```dotenv
MOODLE_NAME="Moodle 4.1"
MOODLE_VERSION="4.1"
MOODLE_ROOT_PATH="/ruta/a/moodle"
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

3. En VS Code, configura `.vscode/mcp.json` y define `MOODLE_INSTANCE` con el mismo sufijo del `.env.<instancia>`.

## Uso

- Desarrollo interactivo:

```bash
npm run dev
```

- Producción (MCP por `stdio`):

```bash
npm run build
node dist/server.js
```

## Clientes soportados

### GitHub Copilot for VS Code

- Configura el servidor MCP en el workspace con `mcp.json`.
- Puedes usar como base [examples/mcp.json.example](examples/mcp.json.example).
- Define `MOODLE_INSTANCE` con la instancia que quieras usar (`moodle41`, `moodle45`, etc.).

### Gemini CLI

- Windows: `./scripts/gemini/setup-gemini.ps1`
- Linux/Mac: `bash scripts/gemini/setup-gemini.sh`
- El script registra automáticamente cada `.env.*` encontrado.

### Claude Code

- Windows: `./scripts/claude/setup-claude.ps1`
- Linux/Mac: `bash scripts/claude/setup-claude.sh`
- El script registra automáticamente cada `.env.*` encontrado.

## Mantenimiento de conexión MCP

Si agregas tools nuevas o cambias configuración por instancia:

1. Reconstruye el servidor: `npm run build`
2. Vuelve a ejecutar el setup del cliente que uses (Gemini/Claude)
3. Reinicia la sesión del cliente MCP para recargar tools

## Prompts MCP incluidos

- `moodle_capabilities`
- `moodle_status`
- `understand_plugin`
- `debug_error`
- `new_plugin`
- `integrate_plugins`

## Seguridad 

- Las consultas SQL usan prepared statements.
- `get_moodle_config` enmascara `dbpass` en la salida.