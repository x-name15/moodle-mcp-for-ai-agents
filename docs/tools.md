# Catálogo de tools MCP

Inventario actual de tools registradas en el servidor MCP (`src/tools`).

## Resumen

- Total de tools: **28**
- Módulos fuente:
  - `src/tools/plugins.ts`
  - `src/tools/db.ts`
  - `src/tools/config.ts`
  - `src/tools/webservices.ts`
  - `src/tools/users.ts`
  - `src/tools/moodlelog.ts`
  - `src/tools/infra.ts`
  - `src/tools/integration.ts`

## Plugins y código (`src/tools/plugins.ts`)

| Tool | Descripción |
|---|---|
| `list_plugins` | Lista todos los plugins instalados con tipo, versión y dependencias |
| `get_plugin_detail` | Detalle completo de un plugin: tablas DB, hooks, observers, web services y dependencias |
| `get_plugin_dependencies` | Árbol de dependencias: qué plugins requiere y cuáles dependen de él |
| `find_plugins_by_table` | Qué plugins usan una tabla específica de la base de datos |
| `find_plugins_by_hook` | Qué plugins implementan o escuchan un hook o evento específico |
| `get_hook_usage` | En qué archivos PHP de un plugin aparece un hook o clase específica |
| `find_integration_points` | Analiza dos plugins y encuentra cómo pueden integrarse: hooks en común, tablas compartidas, dependencias y observers |
| `get_plugin_api` | Lista las funciones públicas disponibles de un plugin: external lib, clases en classes/external/, y web services declarados |
| `invalidate_plugin_cache` | Re-escanea un plugin específico sin tocar el resto del cache |
| `refresh_plugin_cache` | Re-escanea todos los plugins desde el filesystem |

## Base de datos (`src/tools/db.ts`)

| Tool | Descripción |
|---|---|
| `list_db_tables` | Lista todas las tablas de la base de datos de Moodle con número de filas y tamaño en KB |
| `describe_table` | Muestra columnas, tipos e índices de una tabla. Usa el nombre con o sin prefijo mdl_ |
| `count_plugin_records` | Cuenta cuántos registros hay en cada tabla de un plugin. Útil para ver si tiene datos reales. |
| `find_column` | Busca en qué tablas de Moodle existe una columna con ese nombre |
| `sample_table` | Muestra los primeros registros de una tabla para entender qué datos tiene. Máximo 10 filas. |
| `db_overview` | Resumen general de la base de datos: tamaño total, tablas más grandes y tablas con más registros |

## Configuración (`src/tools/config.ts`)

| Tool | Descripción |
|---|---|
| `get_moodle_config` | Lee el config.php de Moodle y devuelve la configuración del sitio: URL, dataroot, caché, DB, etc. |

## Web services (`src/tools/webservices.ts`)

| Tool | Descripción |
|---|---|
| `list_webservices` | Lista los web services habilitados en Moodle, sus funciones y los tokens de acceso activos |
| `get_service_functions` | Lista las funciones PHP registradas en un web service específico |

## Usuarios (`src/tools/users.ts`)

| Tool | Descripción |
|---|---|
| `get_users_overview` | Resumen de usuarios del sistema: total, activos, por rol, admins y últimos logins |
| `find_user` | Busca un usuario por username, email o nombre y muestra sus roles y cursos |

## Logs y errores (`src/tools/moodlelog.ts`)

| Tool | Descripción |
|---|---|
| `get_moodle_errors` | Muestra los errores y eventos críticos recientes del log de Moodle |
| `get_recent_activity` | Muestra la actividad reciente en Moodle: logins, accesos, eventos importantes |
| `get_php_error_log` | Lee las últimas líneas del log de errores de PHP del servidor Moodle |

## Infraestructura (`src/tools/infra.ts`)

| Tool | Descripción |
|---|---|
| `get_infra_context` | Infraestructura completa de esta instancia: RabbitMQ, servicios externos, URLs y puertos |
| `get_rabbitmq_status` | Estado actual de RabbitMQ: queues activas, mensajes pendientes y consumers conectados |

## Integración y scaffold (`src/tools/integration.ts`)

| Tool | Descripción |
|---|---|
| `suggest_hook_integration` | Sugiere cómo integrar dos plugins usando hooks y eventos de Moodle. Analiza qué eventos dispara A que B podría escuchar, y viceversa. |
| `generate_plugin_scaffold` | Genera la estructura completa de archivos para un plugin nuevo de Moodle listo para desarrollar. |

## Nota de mantenimiento

Si agregas o renombras tools en `src/tools/*`, actualiza este archivo para mantener la documentación sincronizada.
