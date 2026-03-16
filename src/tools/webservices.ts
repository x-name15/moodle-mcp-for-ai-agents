import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import mysql from 'mysql2/promise'
import type { MoodleConfig } from '../config.js'

export async function registerWebServiceTools(server: McpServer, config: MoodleConfig) {
  const pool = mysql.createPool({
    host: config.DB_HOST,
    port: config.DB_PORT,
    database: config.DB_NAME,
    user: config.DB_USER,
    password: config.DB_PASSWORD,
    connectionLimit: 3,
  })

  server.tool(
    'list_webservices',
    'Lista los web services habilitados en Moodle, sus funciones y los tokens de acceso activos',
    {},
    async () => {
      try {
        const [services] = await pool.execute<any[]>(`
          SELECT s.id, s.name, s.shortname, s.enabled,
                 COUNT(sf.id) as function_count
          FROM mdl_external_services s
          LEFT JOIN mdl_external_services_functions sf ON sf.externalserviceid = s.id
          GROUP BY s.id
          ORDER BY s.enabled DESC, s.name
        `)

        const [tokens] = await pool.execute<any[]>(`
          SELECT t.id, u.username, u.email,
                 s.name as service_name, s.enabled as service_enabled,
                 FROM_UNIXTIME(t.timecreated) as created,
                 FROM_UNIXTIME(t.lastaccess)  as last_access,
                 t.iprestriction
          FROM mdl_external_tokens t
          JOIN mdl_external_services s ON s.id = t.externalserviceid
          JOIN mdl_user u ON u.id = t.userid
          WHERE t.tokentype = 0
          ORDER BY t.lastaccess DESC
        `)

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              moodle: config.MOODLE_NAME,
              services,
              activeTokens: tokens,
            }, null, 2),
          }],
        }
      } catch (err: any) {
        return { content: [{ type: 'text', text: `Error: ${err.message}` }] }
      }
    }
  )

  server.tool(
    'get_service_functions',
    'Lista las funciones PHP registradas en un web service específico',
    { serviceName: z.string().describe('Nombre o parte del nombre del servicio') },
    async ({ serviceName }) => {
      try {
        const [rows] = await pool.execute<any[]>(`
          SELECT sf.functionname, ef.classname, ef.methodname,
                 ef.component, ef.capabilities
          FROM mdl_external_services_functions sf
          JOIN mdl_external_services s ON s.id = sf.externalserviceid
          LEFT JOIN mdl_external_functions ef ON ef.name = sf.functionname
          WHERE s.name LIKE ? OR s.shortname LIKE ?
        `, [`%${serviceName}%`, `%${serviceName}%`])

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ service: serviceName, functions: rows }, null, 2),
          }],
        }
      } catch (err: any) {
        return { content: [{ type: 'text', text: `Error: ${err.message}` }] }
      }
    }
  )
}