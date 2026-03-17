# Moodle MCP - Guía para Claude Code

Este proyecto es un servidor MCP especializado en Moodle. Como instancia de **Claude Code**, tienes herramientas nativas para interactuar con el ecosistema de Moodle (DB, Plugins, Config, Logs, Mantenimiento).

## 🚀 Cómo empezar

1. **Instalación**: Ejecuta el script de setup para registrar el servidor globalmente en Claude:
   - Windows: `.\scripts\claude\setup-claude.ps1`
   - Linux/Mac: `bash scripts/claude/setup-claude.sh`
2. **Verificación**: Dentro de la sesión de Claude Code, puedes usar:
   - `/config` — para ver y activar los servidores MCP.
   - `/mcp` — para gestionar conexiones activas.
3. **Contexto Inicial**: Usa el prompt `moodle_capabilities` para listar tus tools disponibles.

## 🛠 Herramientas Clave

- **Mantenimiento**: `purge_moodle_caches` y `run_moodle_cron`. Úsalas después de modificar archivos del core o plugins.
- **Análisis de Código**: `get_plugin_detail` y `get_plugin_api` para entender la arquitectura de un plugin.
- **Depuración**: `get_moodle_errors` y `get_php_error_log` para investigar fallos en tiempo real.

## 💡 Consejos para Claude Code

- **Surgical Updates**: Cuando modifiques un plugin, verifica siempre `get_plugin_dependencies`.
- **Estilo de Código**: Respeta el Moodle Coding Style. Consulta `list_plugins` de un tipo similar para ver ejemplos de convenciones.
- **Persistencia**: Claude Code lee la configuración de `~/.claude.json` o de un archivo `.mcp.json` local en el proyecto.

## 📂 Estructura de Configuración

- `.env.<instancia>`: Configuración de conexión (DB, Paths, RabbitMQ).
- `dist/server.js`: El punto de entrada del servidor MCP que Claude ejecuta.

---
*Moodle MCP - Contexto experto nativo para Claude Code.*
