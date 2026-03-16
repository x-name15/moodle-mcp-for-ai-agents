import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import mysql from 'mysql2/promise'
import fs from 'fs'
import path from 'path'
import type { MoodleConfig } from '../config.js'

export async function registerLogTools(server: McpServer, config: MoodleConfig) {
  const pool = mysql.createPool({
    host: config.DB_HOST,
    port: config.DB_PORT,
    database: config.DB_NAME,
    user: config.DB_USER,
    password: config.DB_PASSWORD,
    connectionLimit: 3,
  })

  // Tool 1: Errores recientes del log de Moodle
  server.tool(
    'get_moodle_errors',
    'Muestra los errores y eventos críticos recientes del log de Moodle',
    {
      hours: z.number().min(1).max(168).default(24)
        .describe('Cuántas horas hacia atrás buscar, máximo 168 (7 días)'),
      limit: z.number().min(1).max(50).default(20)
        .describe('Máximo de errores a devolver'),
    },
    async ({ hours, limit }) => {
      try {
        const since = Math.floor(Date.now() / 1000) - (hours * 3600)

        const [rows] = await pool.execute<any[]>(`
          SELECT
            FROM_UNIXTIME(l.timecreated) as time,
            l.eventname,
            l.component,
            l.action,
            l.target,
            u.username,
            l.ip,
            l.other
          FROM mdl_logstore_standard_log l
          LEFT JOIN mdl_user u ON u.id = l.userid
          WHERE l.timecreated > ?
            AND (
              l.action = 'failed'
              OR l.eventname LIKE '%failed%'
              OR l.eventname LIKE '%error%'
              OR l.eventname LIKE '%denied%'
            )
          ORDER BY l.timecreated DESC
          LIMIT ?
        `, [since, limit])

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              moodle: config.MOODLE_NAME,
              period: `últimas ${hours} horas`,
              errors: rows,
              total: (rows as any[]).length,
            }, null, 2),
          }],
        }
      } catch (err: any) {
        return { content: [{ type: 'text', text: `Error: ${err.message}` }] }
      }
    }
  )

  // Tool 2: Actividad reciente general
  server.tool(
    'get_recent_activity',
    'Muestra la actividad reciente en Moodle: logins, accesos, eventos importantes',
    {
      hours: z.number().min(1).max(48).default(1)
        .describe('Cuántas horas hacia atrás'),
      limit: z.number().min(1).max(50).default(20)
        .describe('Máximo de eventos'),
    },
    async ({ hours, limit }) => {
      try {
        const since = Math.floor(Date.now() / 1000) - (hours * 3600)

        const [rows] = await pool.execute<any[]>(`
          SELECT
            FROM_UNIXTIME(l.timecreated) as time,
            l.eventname,
            l.component,
            l.action,
            u.username,
            l.ip
          FROM mdl_logstore_standard_log l
          LEFT JOIN mdl_user u ON u.id = l.userid
          WHERE l.timecreated > ?
          ORDER BY l.timecreated DESC
          LIMIT ?
        `, [since, limit])

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              moodle: config.MOODLE_NAME,
              period: `últimas ${hours} horas`,
              events: rows,
            }, null, 2),
          }],
        }
      } catch (err: any) {
        return { content: [{ type: 'text', text: `Error: ${err.message}` }] }
      }
    }
  )

  // Tool 3: Leer archivo de log PHP si existe
  server.tool(
    'get_php_error_log',
    'Lee las últimas líneas del log de errores de PHP del servidor Moodle',
    {
      lines: z.number().min(10).max(100).default(30)
        .describe('Cuántas líneas del final del log leer'),
    },
    async ({ lines }) => {
      const possiblePaths = [
        path.join(config.MOODLE_ROOT_PATH, '..', 'logs', 'php_errors.log'),
        path.join(config.MOODLE_ROOT_PATH, '..', 'error.log'),
        path.join(config.MOODLE_ROOT_PATH, 'php_errors.log'),
      ]

      for (const logPath of possiblePaths) {
        if (fs.existsSync(logPath)) {
          const content = fs.readFileSync(logPath, 'utf-8')
          const allLines = content.split('\n').filter(Boolean)
          const lastLines = allLines.slice(-lines)
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                logFile: logPath,
                lines: lastLines,
              }, null, 2),
            }],
          }
        }
      }

      return {
        content: [{
          type: 'text',
          text: 'No se encontró archivo de log PHP en rutas conocidas. Los errores están en el log de Moodle (usa get_moodle_errors).',
        }],
      }
    }
  )
}