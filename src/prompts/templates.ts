import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { MoodleConfig } from '../config.js'

export async function registerPrompts(server: McpServer, config: MoodleConfig) {

  // ── /moodle_capabilities ──────────────────────────────────────────────────
  server.prompt(
    'moodle_capabilities',
    'Lista todo lo que el MCP puede hacer en esta instancia',
    () => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `Eres un asistente experto en Moodle conectado a "${config.MOODLE_NAME}" (v${config.MOODLE_VERSION}).

Tienes 26 tools MCP disponibles. Aquí está el mapa completo:

## Plugins y código
- list_plugins — todos los plugins con tipo, versión, dependencias
- get_plugin_detail — detalle completo: tablas, hooks, observers, WS
- get_plugin_dependencies — árbol completo de dependencias
- find_plugins_by_table — qué plugins tocan una tabla
- find_plugins_by_hook — qué plugins implementan un hook
- get_hook_usage — en qué archivos PHP de un plugin aparece un hook
- get_plugin_api — funciones públicas, externallib, classes/external
- find_integration_points — puntos de integración entre dos plugins
- refresh_plugin_cache — re-escanea todo el filesystem
- invalidate_plugin_cache — re-escanea solo un plugin

## Base de datos
- list_db_tables — todas las tablas con tamaño y filas
- describe_table — columnas, tipos e índices de una tabla
- count_plugin_records — registros reales de las tablas de un plugin
- find_column — en qué tablas existe una columna
- sample_table — muestra filas reales (máx 10)
- db_overview — resumen: tamaño total, tablas más grandes

## Configuración
- get_moodle_config — lee config.php completo del sitio

## Web services
- list_webservices — servicios habilitados y tokens activos
- get_service_functions — funciones de un servicio específico

## Usuarios y roles
- get_users_overview — totales, por rol, admins, últimos logins
- find_user — busca usuario y ve sus roles y cursos

## Logs y errores
- get_moodle_errors — errores recientes filtrados por horas
- get_recent_activity — actividad reciente del sitio
- get_php_error_log — últimas líneas del log PHP

## Infraestructura
- get_infra_context — RabbitMQ, microservicios, URLs, puertos
- get_rabbitmq_status — queues activas, mensajes, consumers en vivo

Instancia: ${config.MOODLE_NAME} | DB: ${config.DB_HOST}:${config.DB_PORT}/${config.DB_NAME} | ${config.MOODLE_URL}`,
        },
      }],
    })
  )

  // ── /moodle_status ────────────────────────────────────────────────────────
  server.prompt(
    'moodle_status',
    'Revisión completa del estado de este Moodle antes de tocar algo',
    () => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `Necesito un diagnóstico completo de "${config.MOODLE_NAME}" antes de empezar a trabajar.

Por favor ejecuta estos tools en orden y dame un resumen estructurado:

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
  server.prompt(
    'understand_plugin',
    'Analiza en profundidad un plugin que no conoces',
    {
      pluginName: z.string().describe('Nombre del plugin a analizar, ej: local_messagebroker'),
    },
    ({ pluginName }) => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `Necesito entender completamente el plugin "${pluginName}" en "${config.MOODLE_NAME}".

Ejecuta estos tools en orden:

1. get_plugin_detail con "${pluginName}" — estructura completa
2. get_plugin_dependencies con "${pluginName}" — qué necesita y quién lo usa
3. count_plugin_records con "${pluginName}" — cuántos datos tiene
4. get_plugin_api con "${pluginName}" — qué funciones expone públicamente
5. Si tiene tablas, usa describe_table en la tabla principal
6. Si tiene observers, usa find_plugins_by_hook con el evento principal

Con esa información explícame:
- Para qué sirve este plugin (inferido del código y estructura)
- Qué tablas usa y qué datos guarda en cada una
- De qué otros plugins depende y por qué
- Qué plugins dependen de él (riesgo si lo modifico)
- Qué funciones expone para que otros lo consuman
- Si tiene datos reales, qué volumen maneja
- Cómo está integrado en el ecosistema de este Moodle`,
        },
      }],
    })
  )

  // ── /debug_error ──────────────────────────────────────────────────────────
  server.prompt(
    'debug_error',
    'Investiga un error o problema en producción',
    {
      errorDescription: z.string().describe('Describe el error o problema, ej: usuarios no pueden autenticarse'),
    },
    ({ errorDescription }) => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `Hay un problema en "${config.MOODLE_NAME}": ${errorDescription}

Investiga ejecutando estos tools:

1. get_moodle_errors (hours=24) — errores recientes que puedan estar relacionados
2. get_recent_activity (hours=2) — actividad justo antes del problema
3. get_php_error_log (lines=50) — errores PHP del servidor
4. get_rabbitmq_status — si hay queues acumuladas que bloqueen algo
5. Si el error menciona un plugin específico:
   - get_plugin_detail con ese plugin
   - count_plugin_records para ver si hay datos corruptos o vacíos
6. Si el error menciona una tabla:
   - describe_table con esa tabla
   - sample_table para ver el estado real de los datos

Con esa información:
- Identifica la causa más probable del error
- Señala exactamente en qué plugin o tabla está el problema
- Sugiere pasos concretos para resolverlo
- Indica si hay riesgo de afectar otros plugins

Moodle: ${config.MOODLE_NAME} v${config.MOODLE_VERSION} | DB: ${config.DB_NAME}`,
        },
      }],
    })
  )

  // ── /new_plugin ───────────────────────────────────────────────────────────
  server.prompt(
    'new_plugin',
    'Contexto completo para empezar a desarrollar un plugin nuevo',
    {
      pluginType: z.string().describe('Tipo de plugin, ej: local, mod, block, auth'),
      pluginPurpose: z.string().describe('Para qué sirve el plugin, ej: gestionar notificaciones push'),
    },
    ({ pluginType, pluginPurpose }) => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `Voy a desarrollar un nuevo plugin de tipo "${pluginType}" en "${config.MOODLE_NAME}" v${config.MOODLE_VERSION}.

Propósito: ${pluginPurpose}

Antes de escribir código, recopila el contexto necesario:

1. list_plugins — filtra los plugins de tipo "${pluginType}" existentes para ver convenciones usadas en este Moodle
2. get_moodle_config — verifica la versión exacta y configuración del sitio
3. Si el plugin necesita interactuar con usuarios o cursos:
   - describe_table con "user" y "course" para conocer la estructura
4. Si el plugin tipo "${pluginType}" suele usar hooks:
   - find_plugins_by_hook con hooks comunes de ese tipo

Con esa información dame:
- Estructura de carpetas y archivos mínimos para un plugin "${pluginType}" en Moodle ${config.MOODLE_VERSION}
- Contenido del version.php con la versión correcta de requires para este Moodle
- Si necesita tablas, el esqueleto del db/install.xml
- Si necesita web services, el esqueleto de db/services.php y la clase external
- Si debe reaccionar a eventos, el esqueleto de db/observers.php
- Convenciones de naming que usan los otros plugins "${pluginType}" de este Moodle
- Qué plugins existentes podría necesitar como dependencia para: ${pluginPurpose}

Moodle: ${config.MOODLE_NAME} | Plugins path: ${config.MOODLE_ROOT_PATH}/${pluginType}/`,
        },
      }],
    })
  )

  // ── /integrate_plugins ────────────────────────────────────────────────────
  server.prompt(
    'integrate_plugins',
    'Planifica la integración entre dos plugins existentes',
    {
      pluginA: z.string().describe('Plugin que inicia o consume, ej: local_messagebroker'),
      pluginB: z.string().describe('Plugin que provee o recibe, ej: mod_assign'),
      integrationGoal: z.string().describe('Qué quieres lograr, ej: notificar cuando se entrega una tarea'),
    },
    ({ pluginA, pluginB, integrationGoal }) => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `Necesito integrar "${pluginA}" con "${pluginB}" en "${config.MOODLE_NAME}".

Objetivo: ${integrationGoal}

Ejecuta el análisis completo:

1. find_integration_points con pluginA="${pluginA}" y pluginB="${pluginB}"
2. get_plugin_api con "${pluginA}" — qué funciones expone
3. get_plugin_api con "${pluginB}" — qué funciones expone
4. get_plugin_detail con "${pluginA}" — hooks y observers actuales
5. get_plugin_detail con "${pluginB}" — hooks y observers actuales
6. get_plugin_dependencies con "${pluginA}" — verificar si ya depende de B
7. Si hay tablas relevantes, describe_table para entender la estructura de datos

Con toda esa información, genera un plan de integración:
- Mecanismo recomendado (observer de evento, llamada directa a WS, dependencia + API call)
- Cambios necesarios en version.php de ${pluginA}
- Código exacto del observer o llamada de integración
- Cambios en DB si se necesitan nuevas tablas o campos
- Riesgos: qué podría romperse si modifico estos plugins
- Tests mínimos para verificar que la integración funciona

Moodle: ${config.MOODLE_NAME} v${config.MOODLE_VERSION}`,
        },
      }],
    })
  )

  // ── /webservice_context ───────────────────────────────────────────────────
  server.prompt(
    'webservice_context',
    'Contexto completo para crear o modificar un Web Service',
    {
      pluginName: z.string().describe('Plugin donde vive o vivirá el WS, ej: local_myapi'),
      wsAction: z.string().describe('Qué debe hacer el WS, ej: devolver el progreso de un usuario en un curso'),
    },
    ({ pluginName, wsAction }) => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `Necesito crear o modificar un Web Service en el plugin "${pluginName}" de "${config.MOODLE_NAME}".

Acción del WS: ${wsAction}

Recopila el contexto:

1. get_plugin_detail con "${pluginName}" — estado actual del plugin
2. get_plugin_api con "${pluginName}" — WS existentes para no duplicar
3. list_webservices — servicios habilitados y tokens activos en este Moodle
4. get_service_functions con el servicio relevante si ya existe
5. Si el WS necesita datos de usuarios o cursos:
   - describe_table "user", "course", "user_enrolments" según lo que necesite
6. find_plugins_by_hook con "webservice" para ver patrones de otros plugins

Con ese contexto dame:
- Si el WS ya existe: cómo modificarlo correctamente sin romper consumers actuales
- Si es nuevo:
  - Clase PHP completa con execute(), execute_parameters() y execute_returns()
  - Entrada en db/services.php
  - Capabilities necesarias en db/access.php
  - Cómo registrarlo en el servicio externo correcto
- Cómo probarlo con token desde: ${config.MOODLE_URL}/webservice/rest/server.php
- Tokens activos que podrían usarlo: (ver list_webservices)

Moodle: ${config.MOODLE_NAME} v${config.MOODLE_VERSION} | URL: ${config.MOODLE_URL}`,
        },
      }],
    })
  )
}