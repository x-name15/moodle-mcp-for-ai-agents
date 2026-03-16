# Moodle MCP Server para GitHub Copilot

[![Node.js Version](https://img.shields.io/badge/node-20+-brightgreen?style=flat-square)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.2-blue?style=flat-square)](https://www.typescriptlang.org/)
[![Moodle](https://img.shields.io/badge/Moodle-4.1%20|%204.5-orange?style=flat-square)](https://moodle.org/)
[![MCP Server](https://img.shields.io/badge/MCP-Server-purple?style=flat-square)](https://modelcontextprotocol.org/)

Servidor MCP (Model Context Protocol) para conectar GitHub Copilot con instancias de Moodle y exponer contexto real de plugins, base de datos, logs, web services, RabbitMQ e infraestructura.

## Documentación

- Catálogo completo de herramientas MCP: [docs/tools.md](docs/tools.md)

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

## Configuración rápida

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

## Prompts MCP incluidos

- `moodle_capabilities`
- `moodle_status`
- `understand_plugin`
- `debug_error`
- `new_plugin`
- `integrate_plugins`

## Seguridad (resumen)

- No subas archivos `.env.*` al repositorio.
- Las consultas SQL usan prepared statements.
- `get_moodle_config` enmascara `dbpass` en la salida.