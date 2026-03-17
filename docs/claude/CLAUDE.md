# Moodle MCP - Guide for Claude Code

This project is an MCP server specialized in Moodle. As an instance of **Claude Code**, you have native tools to interact with the Moodle ecosystem (DB, Plugins, Config, Logs, Maintenance).

## 🚀 Getting Started

1. **Installation**: Run the setup script to register the server globally in Claude:
   - Windows: `.\scripts\claude\setup-claude.ps1`
   - Linux/Mac: `bash scripts/claude/setup-claude.sh`
2. **Verification**: Within the Claude Code session, you can use:
   - `/config` — to view and activate MCP servers.
   - `/mcp` — to manage active connections.
3. **Initial Context**: Use the prompt `moodle_capabilities` to list your available tools.

## 🛠 Key Tools

- **Maintenance**: `purge_moodle_caches` and `run_moodle_cron`. Use them after modifying core or plugin files.
- **Code Analysis**: `get_plugin_detail` and `get_plugin_api` to understand a plugin's architecture.
- **Debugging**: `get_moodle_errors` and `get_php_error_log` to investigate real-time failures.

## 💡 Tips for Claude Code

- **Surgical Updates**: When modifying a plugin, always verify `get_plugin_dependencies`.
- **Coding Style**: Respect the Moodle Coding Style. Check `list_plugins` of a similar type to see examples of conventions.
- **Persistence**: Claude Code reads the configuration from `~/.claude.json` or a local `.mcp.json` file in the project.

## 📂 Configuration Structure

- `.env.<instance>`: Connection configuration (DB, Paths, RabbitMQ).
- `dist/server.js`: The MCP server entry point executed by Claude.

---
*Moodle MCP - Native expert context for Claude Code.*
