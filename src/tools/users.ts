import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import mysql from 'mysql2/promise'
import type { MoodleConfig } from '../config.js'

export async function registerUserTools(server: McpServer, config: MoodleConfig) {
  const pool = mysql.createPool({
    host: config.DB_HOST,
    port: config.DB_PORT,
    database: config.DB_NAME,
    user: config.DB_USER,
    password: config.DB_PASSWORD,
    connectionLimit: 3,
  })

  // Tool 1: Resumen de usuarios y roles
  server.tool(
    'get_users_overview',
    'Resumen de usuarios del sistema: total, activos, por rol, admins y últimos logins',
    {},
    async () => {
      try {
        const [total] = await pool.execute<any[]>(`
          SELECT
            COUNT(*) as total,
            SUM(CASE WHEN deleted = 0 AND suspended = 0 THEN 1 ELSE 0 END) as active,
            SUM(CASE WHEN deleted = 1 THEN 1 ELSE 0 END) as deleted,
            SUM(CASE WHEN suspended = 1 THEN 1 ELSE 0 END) as suspended
          FROM mdl_user
          WHERE id > 1
        `)

        const [byRole] = await pool.execute<any[]>(`
          SELECT r.shortname as role, r.name, COUNT(ra.id) as assignments
          FROM mdl_role r
          LEFT JOIN mdl_role_assignments ra ON ra.roleid = r.id
          GROUP BY r.id
          ORDER BY assignments DESC
        `)

        const [recentLogins] = await pool.execute<any[]>(`
          SELECT username, email, firstname, lastname,
                 FROM_UNIXTIME(lastlogin) as last_login,
                 FROM_UNIXTIME(timecreated) as created
          FROM mdl_user
          WHERE deleted = 0 AND suspended = 0
            AND lastlogin > 0 AND id > 1
          ORDER BY lastlogin DESC
          LIMIT 10
        `)

        const [admins] = await pool.execute<any[]>(`
          SELECT u.username, u.email, u.firstname, u.lastname
          FROM mdl_user u
          JOIN mdl_role_assignments ra ON ra.userid = u.id
          JOIN mdl_role r ON r.id = ra.roleid
          WHERE r.shortname = 'admin' AND u.deleted = 0
        `)

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              moodle: config.MOODLE_NAME,
              summary: (total as any[])[0],
              byRole,
              admins,
              recentLogins,
            }, null, 2),
          }],
        }
      } catch (err: any) {
        return { content: [{ type: 'text', text: `Error: ${err.message}` }] }
      }
    }
  )

  // Tool 2: Buscar usuario específico
  server.tool(
    'find_user',
    'Busca un usuario por username, email o nombre y muestra sus roles y cursos',
    { query: z.string().describe('Username, email o nombre del usuario') },
    async ({ query }) => {
      try {
        const [users] = await pool.execute<any[]>(`
          SELECT u.id, u.username, u.email,
                 u.firstname, u.lastname,
                 u.suspended, u.deleted,
                 FROM_UNIXTIME(u.lastlogin) as last_login,
                 FROM_UNIXTIME(u.timecreated) as created
          FROM mdl_user u
          WHERE (u.username LIKE ? OR u.email LIKE ?
                 OR u.firstname LIKE ? OR u.lastname LIKE ?)
            AND u.id > 1
          LIMIT 5
        `, [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`])

        if ((users as any[]).length === 0) {
          return {
            content: [{ type: 'text', text: `No se encontró usuario con "${query}"` }],
          }
        }

        const user = (users as any[])[0]

        const [roles] = await pool.execute<any[]>(`
          SELECT r.shortname, r.name, ctx.contextlevel,
                 ctx.instanceid
          FROM mdl_role_assignments ra
          JOIN mdl_role r ON r.id = ra.roleid
          JOIN mdl_context ctx ON ctx.id = ra.contextid
          WHERE ra.userid = ?
        `, [user.id])

        const [enrolments] = await pool.execute<any[]>(`
          SELECT c.fullname, c.shortname, c.visible,
                 FROM_UNIXTIME(ue.timecreated) as enrolled_since
          FROM mdl_user_enrolments ue
          JOIN mdl_enrol e ON e.id = ue.enrolid
          JOIN mdl_course c ON c.id = e.courseid
          WHERE ue.userid = ?
          ORDER BY ue.timecreated DESC
          LIMIT 10
        `, [user.id])

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              user,
              roles,
              recentEnrolments: enrolments,
            }, null, 2),
          }],
        }
      } catch (err: any) {
        return { content: [{ type: 'text', text: `Error: ${err.message}` }] }
      }
    }
  )
}