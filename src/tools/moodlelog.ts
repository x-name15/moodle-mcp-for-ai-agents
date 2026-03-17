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

  // Tool 1: Recent errors from Moodle log
  server.tool(
    'get_moodle_errors',
    'Shows recent critical errors and events from the Moodle log',
    {
      hours: z.number().min(1).max(168).default(24)
        .describe('How many hours back to search, maximum 168 (7 days)'),
      limit: z.number().min(1).max(50).default(20)
        .describe('Maximum number of errors to return'),
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
              period: `last \${hours} hours`,
              errors: rows,
              total: (rows as any[]).length,
            }, null, 2),
          }],
        }
      } catch (err: any) {
        return { content: [{ type: 'text', text: `Error: \${err.message}` }] }
      }
    }
  )

  // Tool 2: General recent activity
  server.tool(
    'get_recent_activity',
    'Shows recent activity in Moodle: logins, accesses, important events',
    {
      hours: z.number().min(1).max(48).default(1)
        .describe('How many hours back'),
      limit: z.number().min(1).max(50).default(20)
        .describe('Maximum number of events'),
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
              period: `last \${hours} hours`,
              events: rows,
            }, null, 2),
          }],
        }
      } catch (err: any) {
        return { content: [{ type: 'text', text: `Error: \${err.message}` }] }
      }
    }
  )

  // Tool 3: Read PHP log file if it exists
  server.tool(
    'get_php_error_log',
    'Reads the last lines of the PHP error log from the Moodle server',
    {
      lines: z.number().min(10).max(100).default(30)
        .describe('How many lines from the end of the log to read'),
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
          const allLines = content.split('\\n').filter(Boolean)
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
          text: 'Could not find PHP log file in known paths. Errors are in the Moodle log (use get_moodle_errors).',
        }],
      }
    }
  )
}