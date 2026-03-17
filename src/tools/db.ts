import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import mysql from 'mysql2/promise'
import type { MoodleConfig } from '../config.js'

function createPool(config: MoodleConfig) {
  return mysql.createPool({
    host: config.DB_HOST,
    port: config.DB_PORT,
    database: config.DB_NAME,
    user: config.DB_USER,
    password: config.DB_PASSWORD,
    connectionLimit: 5,
    connectTimeout: 10000,
    multipleStatements: false,
  })
}

export async function registerDbTools(server: McpServer, config: MoodleConfig) {
  const pool = createPool(config)

  // Verify connection on startup
  try {
    const conn = await pool.getConnection()
    console.error(`[MCP] DB connected: \${config.DB_HOST}:\${config.DB_PORT}/\${config.DB_NAME}`)
    conn.release()
  } catch (err: any) {
    console.error(`[MCP] DB ERROR: \${err.message}`)
  }

  // Tool 1: List tables with size and row count
  server.tool(
    'list_db_tables',
    'Lists all Moodle database tables with row counts and size in KB',
    {},
    async () => {
      try {
        const [rows] = await pool.execute<any[]>(`
          SELECT
            TABLE_NAME        as name,
            TABLE_ROWS        as estimated_rows,
            ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024, 1) as size_kb
          FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = ?
          ORDER BY (DATA_LENGTH + INDEX_LENGTH) DESC
        `, [config.DB_NAME])

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              database: config.DB_NAME,
              tableCount: rows.length,
              tables: rows,
            }, null, 2),
          }],
        }
      } catch (err: any) {
        return { content: [{ type: 'text', text: `DB Error: \${err.message}` }] }
      }
    }
  )

  // Tool 2: Describe a table
  server.tool(
    'describe_table',
    'Shows columns, types, and indexes of a table. Use the name with or without the mdl_ prefix',
    { tableName: z.string().describe('Table name, ex: user or mdl_user') },
    async ({ tableName }) => {
      const name = tableName.startsWith('mdl_') ? tableName : `mdl_\${tableName}`
      try {
        const [columns] = await pool.execute<any[]>('DESCRIBE ??', [name])
        const [indexes] = await pool.execute<any[]>('SHOW INDEX FROM ??', [name])

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ table: name, columns, indexes }, null, 2),
          }],
        }
      } catch (err: any) {
        return { content: [{ type: 'text', text: `Error: \${err.message}` }] }
      }
    }
  )

  // Tool 3: Count records in a plugin's tables
  server.tool(
    'count_plugin_records',
    'Counts the number of records in each table of a plugin. Useful to see if it has real data.',
    { pluginPrefix: z.string().describe('Plugin prefix, ex: local_messagebroker or just messagebroker') },
    async ({ pluginPrefix }) => {
      try {
        const prefix = pluginPrefix.replace('mdl_', '').replace('local_', 'local\\\\_')
        const searchPrefix = pluginPrefix.includes('_')
          ? `mdl_\${pluginPrefix}%`
          : `mdl_%\${pluginPrefix}%`

        const [tables] = await pool.execute<any[]>(`
          SELECT TABLE_NAME
          FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME LIKE ?
          ORDER BY TABLE_NAME
        `, [config.DB_NAME, searchPrefix])

        if ((tables as any[]).length === 0) {
          return {
            content: [{ type: 'text', text: `No tables found for "\${pluginPrefix}"` }],
          }
        }

        const counts = await Promise.all(
          (tables as any[]).map(async (t) => {
            const [rows] = await pool.execute<any[]>(
              `SELECT COUNT(*) as count FROM \\\`\${t.TABLE_NAME}\\\``
            )
            return { table: t.TABLE_NAME, records: (rows[0] as any).count }
          })
        )

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ plugin: pluginPrefix, tables: counts }, null, 2),
          }],
        }
      } catch (err: any) {
        return { content: [{ type: 'text', text: `Error: \${err.message}` }] }
      }
    }
  )

  // Tool 4: Search which tables contain a specific column
  server.tool(
    'find_column',
    'Searches which Moodle tables contain a column with a specific name',
    { columnName: z.string().describe('Name or part of the name of the column, ex: userid or courseid') },
    async ({ columnName }) => {
      try {
        const [rows] = await pool.execute<any[]>(`
          SELECT
            TABLE_NAME    as table_name,
            COLUMN_NAME   as column_name,
            COLUMN_TYPE   as type,
            IS_NULLABLE   as nullable
          FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = ? AND COLUMN_NAME LIKE ?
          ORDER BY TABLE_NAME
        `, [config.DB_NAME, `%\${columnName}%`])

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              searchedColumn: columnName,
              foundIn: rows,
              totalTables: (rows as any[]).length,
            }, null, 2),
          }],
        }
      } catch (err: any) {
        return { content: [{ type: 'text', text: `Error: \${err.message}` }] }
      }
    }
  )

  // Tool 5: Table data sample
  server.tool(
    'sample_table',
    'Shows the first records of a table to understand what data it holds. Maximum 10 rows.',
    {
      tableName: z.string().describe('Table name, ex: local_messagebroker_pub_log'),
      limit: z.number().min(1).max(10).default(5).describe('How many records to show, max 10'),
    },
    async ({ tableName, limit }) => {
      const name = tableName.startsWith('mdl_') ? tableName : `mdl_\${tableName}`
      try {
        const [rows] = await pool.execute<any[]>(
          `SELECT * FROM \\\`\${name}\\\` LIMIT ?`, [limit]
        )
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ table: name, sample: rows }, null, 2),
          }],
        }
      } catch (err: any) {
        return { content: [{ type: 'text', text: `Error: \${err.message}` }] }
      }
    }
  )

  // Tool 6: General DB overview
  server.tool(
    'db_overview',
    'General database overview: total size, largest tables, and tables with the most records',
    {},
    async () => {
      try {
        const [sizeSummary] = await pool.execute<any[]>(`
          SELECT
            COUNT(*) as total_tables,
            ROUND(SUM(DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 2) as total_size_mb
          FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = ?
        `, [config.DB_NAME])

        const [biggest] = await pool.execute<any[]>(`
          SELECT TABLE_NAME as name,
                 TABLE_ROWS as estimated_rows,
                 ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024, 1) as size_kb
          FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = ?
          ORDER BY (DATA_LENGTH + INDEX_LENGTH) DESC
          LIMIT 10
        `, [config.DB_NAME])

        const [mostRows] = await pool.execute<any[]>(`
          SELECT TABLE_NAME as name, TABLE_ROWS as estimated_rows
          FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = ?
          ORDER BY TABLE_ROWS DESC
          LIMIT 10
        `, [config.DB_NAME])

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              moodle: config.MOODLE_NAME,
              database: config.DB_NAME,
              summary: (sizeSummary as any[])[0],
              largestBySize: biggest,
              largestByRows: mostRows,
            }, null, 2),
          }],
        }
      } catch (err: any) {
        return { content: [{ type: 'text', text: `Error: \${err.message}` }] }
      }
    }
  )
}