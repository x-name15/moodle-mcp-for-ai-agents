# Moodle MCP - Guide for JetBrains (PhpStorm, IntelliJ, WebStorm)

This guide explains how to integrate the Moodle MCP server into JetBrains IDEs to empower your Moodle development.

## Requirements

*   **JetBrains IDE** (Version 2024.3 or higher).
*   **AI Assistant Plugin** installed and activated (or third-party plugins like Continue/CodeGPT).
*   **Node.js** installed on your system.

## 🛠 Configuration in JetBrains AI Assistant

1.  Open your IDE (e.g. PhpStorm).
2.  Go to `Settings` (Ctrl+Alt+S / Cmd+,).
3.  Navigate to **Tools | AI Assistant | Model Context Protocol (MCP)**.
4.  Click on the **+ (Add)** button.
5.  Configure the following fields:
    *   **Name**: `Moodle MCP` (or your instance name, e.g. `Moodle 4.1`)
    *   **Transport**: `STDIO`
    *   **Command**: `node` (Ensure `node` is in your PATH)
    *   **Arguments**: The absolute path to this project's `dist/server.js` file, followed by the necessary environment variables.

### Recommended Command
To avoid errors with relative paths, use the absolute path. You can get it by running the utility script:

**Windows (PowerShell):**
```powershell
.\scripts\jetbrains\setup-jetbrains.ps1
```

**Linux/macOS (Bash):**
```bash
bash scripts/jetbrains/setup-jetbrains.sh
```

## 🧩 Third-Party Plugins (Continue / CodeGPT)

If you don't use the official AI Assistant, you can configure the server in your plugin's `config.json` file:

```json
{
  "mcpServers": {
    "moodle-mcp": {
      "command": "node",
      "args": ["C:/path/to/moodle-mcp-for-copilot/dist/server.js"],
      "env": {
        "MOODLE_INSTANCE": "moodle41"
      }
    }
  }
}
```

## 💡 Capabilities in PhpStorm

Once configured, you can ask the IDE chat:

*   "What are the database tables of the local_messagebroker plugin?"
*   "Search for errors in the PHP logs over the last 30 minutes."
*   "What hooks fired by mod_assign could my new plugin use?"

--- 
*Developed to optimize the Moodle workflow in the JetBrains ecosystem.*