# Moodle MCP - Guía para JetBrains (PhpStorm, IntelliJ, WebStorm)

Esta guía explica cómo integrar el servidor MCP de Moodle en los IDEs de JetBrains para potenciar tu desarrollo con Moodle.

## requisitos

*   **JetBrains IDE** (Versión 2024.3 o superior).
*   **AI Assistant Plugin** instalado y activado (o plugins de terceros como Continue/CodeGPT).
*   **Node.js** instalado en tu sistema.

## 🛠 Configuración en JetBrains AI Assistant

1.  Abre tu IDE (ej. PhpStorm).
2.  Ve a `Settings` (Ctrl+Alt+S / Cmd+,).
3.  Navega a **Tools | AI Assistant | Model Context Protocol (MCP)**.
4.  Haz clic en el botón **+ (Add)**.
5.  Configura los siguientes campos:
    *   **Name**: `Moodle MCP` (o el nombre de tu instancia, ej. `Moodle 4.1`)
    *   **Transport**: `STDIO`
    *   **Command**: `node` (Asegúrate de que `node` esté en tu PATH)
    *   **Arguments**: El path absoluto al archivo `dist/server.js` de este proyecto, seguido de las variables de entorno necesarias.

### Comando Recomendado
Para evitar errores con rutas relativas, usa el path absoluto. Puedes obtenerlo ejecutando el script de utilidad:

**Windows (PowerShell):**
```powershell
.\scripts\jetbrains\setup-jetbrains.ps1
```

**Linux/macOS (Bash):**
```bash
bash scripts/jetbrains/setup-jetbrains.sh
```

## 🧩 Plugins de Terceros (Continue / CodeGPT)

Si no usas el AI Assistant oficial, puedes configurar el servidor en el archivo `config.json` de tu plugin:

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

## 💡 Capacidades en PhpStorm

Una vez configurado, puedes preguntar al chat de la IDE:

*   "¿Cuáles son las tablas de base de datos del plugin local_messagebroker?"
*   "Busca errores en los logs de PHP de los últimos 30 minutos."
*   "¿Qué hooks disparados por mod_assign podría usar mi nuevo plugin?"

--- 
*Desarrollado para optimizar el flujo de trabajo de Moodle en el ecosistema JetBrains.*