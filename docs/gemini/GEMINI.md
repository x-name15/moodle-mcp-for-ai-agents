# Moodle MCP - Guide for Gemini

This project is an MCP server specialized in Moodle. As an AI model, you have native tools to interact with the Moodle ecosystem (DB, Plugins, Config, Logs).

## 🚀 Getting Started

1. **Select Instance**: Ensure the server is running with the correct instance (`moodle41` or `moodle45`). This is controlled by the `MOODLE_INSTANCE` environment variable.
2. **Initial Context**: Always start using the prompt `moodle_capabilities` to see what tools are active in the current instance.
3. **Diagnostics**: If you are going to make changes, use the prompt `moodle_status` to verify there are no critical errors in the database or PHP logs.

## 🛠 Key Tools

- **Code Analysis**: Use `get_plugin_detail` and `get_plugin_api` before suggesting changes to a plugin.
- **Database**: Use `describe_table` to know exactly the data types and `sample_table` to see real examples.
- **Debugging**: If something fails, `get_moodle_errors` and `get_php_error_log` are your best friends.

## 💡 Tips for Gemini

- **Surgical Updates**: When modifying a plugin, always verify `get_plugin_dependencies` to avoid breaking integrations.
- **Coding Style**: Moodle follows strict standards (Moodle Coding Style). Use `list_plugins` of a similar type to see examples of naming conventions and structures.
- **Security**: Never expose credentials. The server already masks passwords in `get_moodle_config`, but be careful when reading user tables.

## 📂 Configuration Structure

- `.env.<instance>`: Connection configuration.
- `data/microservices.<instance>.json`: Definition of extended infrastructure.
- `mcp.json`: Configuration to launch me as an MCP client.

---
*Automatically generated for native compatibility with Gemini.*
