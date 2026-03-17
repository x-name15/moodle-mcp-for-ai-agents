# Moodle MCP - Guía para Gemini

Este proyecto es un servidor MCP especializado en Moodle. Como modelo de IA, tienes herramientas nativas para interactuar con el ecosistema de Moodle (DB, Plugins, Config, Logs).

## 🚀 Cómo empezar

1. **Seleccionar Instancia**: Asegúrate de que el servidor esté corriendo con la instancia correcta (`moodle41` o `moodle45`). Esto se controla con la variable de entorno `MOODLE_INSTANCE`.
2. **Contexto Inicial**: Siempre comienza usando el prompt `moodle_capabilities` para ver qué herramientas tienes activas en la instancia actual.
3. **Diagnóstico**: Si vas a realizar cambios, usa el prompt `moodle_status` para verificar que no haya errores críticos en la base de datos o en los logs de PHP.

## 🛠 Herramientas Clave

- **Análisis de Código**: Usa `get_plugin_detail` y `get_plugin_api` antes de sugerir cambios en un plugin.
- **Base de Datos**: Usa `describe_table` para conocer los tipos de datos exactos y `sample_table` para ver ejemplos reales.
- **Depuración**: Si algo falla, `get_moodle_errors` y `get_php_error_log` son tus mejores amigos.

## 💡 Consejos para Gemini

- **Surgical Updates**: Cuando modifiques un plugin, verifica siempre `get_plugin_dependencies` para no romper integraciones.
- **Estilo de Código**: Moodle sigue estándares estrictos (Moodle Coding Style). Usa `list_plugins` de un tipo similar para ver ejemplos de convenciones de nombres y estructuras.
- **Seguridad**: Nunca expongas credenciales. El servidor ya enmascara contraseñas en `get_moodle_config`, pero ten cuidado al leer tablas de usuarios.

## 📂 Estructura de Configuración

- `.env.<instancia>`: Configuración de conexión.
- `data/microservices.<instancia>.json`: Definición de la infraestructura extendida.
- `mcp.json`: Configuración para lanzarme como cliente MCP.

---
*Generado automáticamente para compatibilidad nativa con Gemini.*
