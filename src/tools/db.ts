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

  // Verificar conexión al arrancar
  try {
    const conn = await pool.getConnection()
    console.error(`[MCP] DB conectada: ${config.DB_HOST}:${config.DB_PORT}/${config.DB_NAME}`)
    conn.release()
  } catch (err: any) {
    console.error(`[MCP] ERROR DB: ${err.message}`)
  }

  // Tool 1: Lista tablas con tamaño y filas
  server.tool(
    'list_db_tables',
    'Lista todas las tablas de la base de datos de Moodle con número de filas y tamaño en KB',
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
        return { content: [{ type: 'text', text: `Error DB: ${err.message}` }] }
      }
    }
  )

  // Tool 2: Describe una tabla
  server.tool(
    'describe_table',
    'Muestra columnas, tipos e índices de una tabla. Usa el nombre con o sin prefijo mdl_',
    { tableName: z.string().describe('Nombre de la tabla, ej: user o mdl_user') },
    async ({ tableName }) => {
      const name = tableName.startsWith('mdl_') ? tableName : `mdl_${tableName}`
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
        return { content: [{ type: 'text', text: `Error: ${err.message}` }] }
      }
    }
  )

  // Tool 3: Contar registros de las tablas de un plugin
  server.tool(
    'count_plugin_records',
    'Cuenta cuántos registros hay en cada tabla de un plugin. Útil para ver si tiene datos reales.',
    { pluginPrefix: z.string().describe('Prefijo del plugin, ej: local_messagebroker o solo messagebroker') },
    async ({ pluginPrefix }) => {
      try {
        const prefix = pluginPrefix.replace('mdl_', '').replace('local_', 'local\\_')
        const searchPrefix = pluginPrefix.includes('_')
          ? `mdl_${pluginPrefix}%`
          : `mdl_%${pluginPrefix}%`

        const [tables] = await pool.execute<any[]>(`
          SELECT TABLE_NAME
          FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME LIKE ?
          ORDER BY TABLE_NAME
        `, [config.DB_NAME, searchPrefix])

        if ((tables as any[]).length === 0) {
          return {
            content: [{ type: 'text', text: `No se encontraron tablas para "${pluginPrefix}"` }],
          }
        }

        const counts = await Promise.all(
          (tables as any[]).map(async (t) => {
            const [rows] = await pool.execute<any[]>(
              `SELECT COUNT(*) as count FROM \`${t.TABLE_NAME}\``
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
        return { content: [{ type: 'text', text: `Error: ${err.message}` }] }
      }
    }
  )

  // Tool 4: Buscar en qué tablas existe una columna
  server.tool(
    'find_column',
    'Busca en qué tablas de Moodle existe una columna con ese nombre',
    { columnName: z.string().describe('Nombre o parte del nombre de la columna, ej: userid o courseid') },
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
        `, [config.DB_NAME, `%${columnName}%`])

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
        return { content: [{ type: 'text', text: `Error: ${err.message}` }] }
      }
    }
  )

  // Tool 5: Sample de datos de una tabla
  server.tool(
    'sample_table',
    'Muestra los primeros registros de una tabla para entender qué datos tiene. Máximo 10 filas.',
    {
      tableName: z.string().describe('Nombre de la tabla, ej: local_messagebroker_pub_log'),
      limit: z.number().min(1).max(10).default(5).describe('Cuántos registros mostrar, máximo 10'),
    },
    async ({ tableName, limit }) => {
      const name = tableName.startsWith('mdl_') ? tableName : `mdl_${tableName}`
      try {
        const [rows] = await pool.execute<any[]>(
          `SELECT * FROM \`${name}\` LIMIT ?`, [limit]
        )
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ table: name, sample: rows }, null, 2),
          }],
        }
      } catch (err: any) {
        return { content: [{ type: 'text', text: `Error: ${err.message}` }] }
      }
    }
  )

  // Tool 6: Estado general de la BD
  server.tool(
    'db_overview',
    'Resumen general de la base de datos: tamaño total, tablas más grandes y tablas con más registros',
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
        return { content: [{ type: 'text', text: `Error: ${err.message}` }] }
      }
    }
  )
}