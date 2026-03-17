# MCP Tools Catalog

Current inventory of registered tools in the MCP server (`src/tools`).

## Summary

- Total tools: **32**
- Source modules:
  - `src/tools/plugins.ts`
  - `src/tools/db.ts`
  - `src/tools/config.ts`
  - `src/tools/webservices.ts`
  - `src/tools/users.ts`
  - `src/tools/moodlelog.ts`
  - `src/tools/infra.ts`
  - `src/tools/integration.ts`
  - `src/tools/changelog.ts`

## Plugins and code (`src/tools/plugins.ts`)

| Tool | Description |
|---|---|
| `list_plugins` | Lists all installed plugins with type, version and dependencies |
| `get_plugin_detail` | Complete details of a plugin: DB tables, hooks, observers, web services and dependencies |
| `get_plugin_dependencies` | Dependency tree: which plugins it requires and which depend on it |
| `find_plugins_by_table` | Which plugins use a specific database table |
| `find_plugins_by_hook` | Which plugins implement or listen to a specific hook or event |
| `get_hook_usage` | In which PHP files of a plugin a specific hook or class appears |
| `find_integration_points` | Analyzes two plugins and finds how they can integrate: common hooks, shared tables, dependencies and observers |
| `get_plugin_api` | Lists available public functions of a plugin: external lib, classes in classes/external/, and declared web services |
| `invalidate_plugin_cache` | Re-scans a specific plugin without touching the rest of the cache |
| `refresh_plugin_cache` | Re-scans all plugins from the filesystem |

## Database (`src/tools/db.ts`)

| Tool | Description |
|---|---|
| `list_db_tables` | Lists all Moodle database tables with row count and size in KB |
| `describe_table` | Shows columns, types and indexes of a table. Can use the name with or without the mdl_ prefix |
| `count_plugin_records` | Counts how many records there are in each table of a plugin. Useful to see if it has real data. |
| `find_column` | Finds which Moodle tables have a column with that name |
| `sample_table` | Shows the first records of a table to understand its data. Maximum 10 rows. |
| `db_overview` | General database overview: total size, largest tables and tables with the most records |

## Configuration (`src/tools/config.ts`)

| Tool | Description |
|---|---|
| `get_moodle_config` | Reads Moodle config.php and returns site configuration: URL, dataroot, cache, DB, etc. |

## Web services (`src/tools/webservices.ts`)

| Tool | Description |
|---|---|
| `list_webservices` | Lists enabled web services in Moodle, their functions and active access tokens |
| `get_service_functions` | Lists PHP functions registered in a specific web service |

## Users (`src/tools/users.ts`)

| Tool | Description |
|---|---|
| `get_users_overview` | System user overview: total, active, by role, admins and latest logins |
| `find_user` | Searches for a user by username, email or name and shows their roles and courses |

## Logs and errors (`src/tools/moodlelog.ts`)

| Tool | Description |
|---|---|
| `get_moodle_errors` | Shows recent errors and critical events from the Moodle log |
| `get_recent_activity` | Shows recent activity in Moodle: logins, accesses, key events |
| `get_php_error_log` | Reads the latest lines from the Moodle server PHP error log |

## Infrastructure (`src/tools/infra.ts`)

| Tool | Description |
|---|---|
| `get_infra_context` | Complete infrastructure of this instance: RabbitMQ, external services, URLs and ports |
| `get_rabbitmq_status` | Current RabbitMQ status: active queues, pending messages and connected consumers |

## Integration and scaffold (`src/tools/integration.ts`)

| Tool | Description |
|---|---|
| `suggest_hook_integration` | Suggests how to integrate two plugins using Moodle hooks and events. Analyzes what events A fires that B could listen to, and vice versa. |
| `generate_plugin_scaffold` | Generates the complete file structure for a new Moodle plugin ready for development. |

## History and changes (`src/tools/changelog.ts`)

| Tool | Description |
|---|---|
| `get_plugin_history` | Complete history of a plugin: combined upgrade.php, CHANGELOG.md and CHANGES.md |
| `get_db_upgrade_steps` | Exact DB changes a plugin made in upgrade.php, filterable by source version |
| `get_breaking_changes` | Detects breaking changes in a plugin's history and which dependent plugins are at risk |
| `scan_all_upgrade_histories` | Scans all plugins with upgrade.php and returns a risk ranking for breaking changes |

---

## Slash prompts (`src/prompts/templates.ts`)

| Prompt | Parameters | Description |
|---|---|---|
| `moodle_capabilities` | — | Complete list of available tools in this instance |
| `moodle_status` | — | Complete diagnosis of Moodle status before making changes |
| `understand_plugin` | `pluginName` | Analyzes an unknown plugin in depth |
| `debug_error` | `errorDescription` | Investigates a production error or problem |
| `new_plugin` | `pluginType`, `pluginPurpose` | Full context to develop a new plugin from scratch |
| `integrate_plugins` | `pluginA`, `pluginB`, `integrationGoal` | Plans integration between two existing plugins |
| `webservice_context` | `pluginName`, `wsAction` | Creates or modifies a Web Service with real site context |

---

## Maintenance Note

If you add or rename tools in `src/tools/*`, update this file to keep the documentation in sync.