import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { MoodleConfig } from '../config.js'

export async function registerPrompts(server: McpServer, config: MoodleConfig) {

  // ── /moodle_capabilities ──────────────────────────────────────────────────
  server.registerPrompt(
    'moodle_capabilities',
    {
      description: 'Lista todo lo que el MCP puede hacer en esta instancia',
    },
    () => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `Eres un asistente experto en Moodle conectado a "${config.MOODLE_NAME}" (v${config.MOODLE_VERSION}).

Tienes 26 tools MCP disponibles:

## Plugins y código
- list_plugins — todos los plugins con tipo, versión, dependencias
- get_plugin_detail — detalle completo: tablas, hooks, observers, WS
- get_plugin_dependencies — árbol completo de dependencias
- find_plugins_by_table — qué plugins tocan una tabla
- find_plugins_by_hook — qué plugins implementan un hook
- get_hook_usage — en qué archivos PHP aparece un hook
- get_plugin_api — funciones públicas, externallib, classes/external
- find_integration_points — puntos de integración entre dos plugins
- refresh_plugin_cache — re-escanea todo el filesystem
- invalidate_plugin_cache — re-escanea solo un plugin

## Base de datos
- list_db_tables — todas las tablas con tamaño y filas
- describe_table — columnas, tipos e índices
- count_plugin_records — registros reales de un plugin
- find_column — en qué tablas existe una columna
- sample_table — filas reales (máx 10)
- db_overview — resumen general

## Configuración
- get_moodle_config — lee config.php completo

## Web services
- list_webservices — servicios y tokens activos
- get_service_functions — funciones de un servicio

## Usuarios y roles
- get_users_overview — totales, por rol, admins, logins
- find_user — busca usuario con roles y cursos

## Logs y errores
- get_moodle_errors — errores recientes por horas
- get_recent_activity — actividad reciente
- get_php_error_log — últimas líneas del log PHP

## Infraestructura
- get_infra_context — RabbitMQ, microservicios, URLs
- get_rabbitmq_status — queues, mensajes, consumers en vivo

Instancia: ${config.MOODLE_NAME} | DB: ${config.DB_HOST}:${config.DB_PORT}/${config.DB_NAME} | ${config.MOODLE_URL}`,
        },
      }],
    })
  )

  // ── /moodle_status ────────────────────────────────────────────────────────
  server.registerPrompt(
    'moodle_status',
    {
      description: 'Diagnóstico completo del estado de este Moodle antes de tocar algo',
    },
    () => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `Necesito un diagnóstico completo de "${config.MOODLE_NAME}" antes de empezar a trabajar.

Ejecuta estos tools en orden y dame un resumen estructurado:

1. get_moodle_config — configuración actual del sitio
2. db_overview — estado de la base de datos
3. get_users_overview — resumen de usuarios activos
4. list_webservices — servicios y tokens activos
5. get_moodle_errors (hours=24) — errores de las últimas 24 horas
6. get_rabbitmq_status — estado de las queues
7. get_infra_context — infraestructura y microservicios

Al terminar quiero saber:
- ¿Hay errores críticos activos?
- ¿Hay tokens de WS activos y quién los usa?
- ¿RabbitMQ tiene mensajes acumulados sin procesar?
- ¿La configuración del sitio es la esperada?

Instancia: ${config.MOODLE_NAME} v${config.MOODLE_VERSION}`,
        },
      }],
    })
  )

  // ── /understand_plugin ────────────────────────────────────────────────────
  server.registerPrompt(
    'understand_plugin',
    {
      description: 'Analiza en profundidad un plugin que no conoces',
      argsSchema: {
        pluginName: z.string().describe('Nombre del plugin, ej: local_messagebroker'),
      },
    },
    ({ pluginName }) => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `Necesito entender completamente el plugin "${pluginName}" en "${config.MOODLE_NAME}".

Ejecuta estos tools en orden:

1. get_plugin_detail con "${pluginName}"
2. get_plugin_dependencies con "${pluginName}"
3. count_plugin_records con "${pluginName}"
4. get_plugin_api con "${pluginName}"
5. Si tiene tablas, describe_table en la tabla principal
6. Si tiene observers, find_plugins_by_hook con el evento principal

Con esa información explícame:
- Para qué sirve este plugin
- Qué tablas usa y qué datos guarda
- De qué otros plugins depende y por qué
- Qué plugins dependen de él (riesgo si lo modifico)
- Qué funciones expone para que otros lo consuman
- Cómo está integrado en el ecosistema de este Moodle`,
        },
      }],
    })
  )

  // ── /debug_error ──────────────────────────────────────────────────────────
  server.registerPrompt(
    'debug_error',
    {
      description: 'Investiga un error o problema en producción',
      argsSchema: {
        errorDescription: z.string().describe('Describe el error, ej: usuarios no pueden autenticarse'),
      },
    },
    ({ errorDescription }) => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `Hay un problema en "${config.MOODLE_NAME}": ${errorDescription}

Investiga ejecutando:

1. get_moodle_errors (hours=24)
2. get_recent_activity (hours=2)
3. get_php_error_log (lines=50)
4. get_rabbitmq_status — si hay queues bloqueadas
5. Si el error menciona un plugin: get_plugin_detail y count_plugin_records
6. Si el error menciona una tabla: describe_table y sample_table

Con esa información:
- Identifica la causa más probable
- Señala en qué plugin o tabla está el problema
- Sugiere pasos concretos para resolverlo
- Indica si hay riesgo de afectar otros plugins

Moodle: ${config.MOODLE_NAME} v${config.MOODLE_VERSION}`,
        },
      }],
    })
  )

  // ── /new_plugin ───────────────────────────────────────────────────────────
  server.registerPrompt(
    'new_plugin',
    {
      description: 'Contexto completo para desarrollar un plugin nuevo desde cero',
      argsSchema: {
        pluginType: z.string().describe('Tipo de plugin, ej: local, mod, block, auth'),
        pluginPurpose: z.string().describe('Para qué sirve, ej: gestionar notificaciones push'),
      },
    },
    ({ pluginType, pluginPurpose }) => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `Voy a desarrollar un nuevo plugin de tipo "${pluginType}" en "${config.MOODLE_NAME}" v${config.MOODLE_VERSION}.

Propósito: ${pluginPurpose}

Recopila contexto:

1. list_plugins — plugins de tipo "${pluginType}" existentes para ver convenciones
2. get_moodle_config — versión exacta y configuración del sitio
3. Si necesita interactuar con usuarios o cursos: describe_table "user" y "course"
4. find_plugins_by_hook con hooks comunes de plugins tipo "${pluginType}"

Dame:
- Estructura de carpetas y archivos mínimos para Moodle ${config.MOODLE_VERSION}
- version.php con requires correcto para esta instancia
- db/install.xml si necesita tablas
- db/services.php y clase external si necesita WS
- db/observers.php si debe reaccionar a eventos
- Convenciones de naming de otros plugins "${pluginType}" de este Moodle
- Qué plugins existentes podría necesitar como dependencia

Path de plugins: ${config.MOODLE_ROOT_PATH}/${pluginType}/`,
        },
      }],
    })
  )

  // ── /integrate_plugins ────────────────────────────────────────────────────
  server.registerPrompt(
    'integrate_plugins',
    {
      description: 'Planifica la integración entre dos plugins existentes',
      argsSchema: {
        pluginA: z.string().describe('Plugin que inicia o consume, ej: local_messagebroker'),
        pluginB: z.string().describe('Plugin que provee o recibe, ej: mod_assign'),
        integrationGoal: z.string().describe('Qué quieres lograr, ej: notificar cuando se entrega una tarea'),
      },
    },
    ({ pluginA, pluginB, integrationGoal }) => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `Necesito integrar "${pluginA}" con "${pluginB}" en "${config.MOODLE_NAME}".

Objetivo: ${integrationGoal}

Ejecuta:

1. find_integration_points pluginA="${pluginA}" pluginB="${pluginB}"
2. get_plugin_api con "${pluginA}"
3. get_plugin_api con "${pluginB}"
4. get_plugin_detail con "${pluginA}"
5. get_plugin_detail con "${pluginB}"
6. get_plugin_dependencies con "${pluginA}"

Genera un plan de integración:
- Mecanismo recomendado (observer, llamada directa a WS, dependencia + API)
- Cambios necesarios en version.php de ${pluginA}
- Código del observer o llamada de integración
- Cambios en DB si se necesitan
- Riesgos si modifico estos plugins
- Tests mínimos para verificar la integración

Moodle: ${config.MOODLE_NAME} v${config.MOODLE_VERSION}`,
        },
      }],
    })
  )

  // ── /webservice_context ───────────────────────────────────────────────────
  server.registerPrompt(
    'webservice_context',
    {
      description: 'Contexto completo para crear o modificar un Web Service',
      argsSchema: {
        pluginName: z.string().describe('Plugin donde vive el WS, ej: local_myapi'),
        wsAction: z.string().describe('Qué debe hacer el WS, ej: devolver progreso de usuario en curso'),
      },
    },
    ({ pluginName, wsAction }) => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `Necesito crear o modificar un Web Service en "${pluginName}" de "${config.MOODLE_NAME}".

Acción: ${wsAction}

Recopila contexto:

1. get_plugin_detail con "${pluginName}"
2. get_plugin_api con "${pluginName}" — WS existentes para no duplicar
3. list_webservices — servicios y tokens activos
4. Si necesita datos de usuarios o cursos: describe_table "user", "course", "user_enrolments"

Dame:
- Si el WS ya existe: cómo modificarlo sin romper consumers actuales
- Si es nuevo:
  - Clase PHP completa con execute(), execute_parameters(), execute_returns()
  - Entrada en db/services.php
  - Capabilities en db/access.php
  - Cómo registrarlo en el servicio externo correcto
- Cómo probarlo: ${config.MOODLE_URL}/webservice/rest/server.php
- Tokens activos que podrían usarlo

Moodle: ${config.MOODLE_NAME} v${config.MOODLE_VERSION}`,
        },
      }],
    })
  )
}