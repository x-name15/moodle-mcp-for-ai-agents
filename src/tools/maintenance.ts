import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { exec } from 'child_process'
import path from 'path'
import type { MoodleConfig } from '../config.js'

/**
 * Ejecuta un comando PHP CLI de Moodle de forma segura
 */
function runMoodleCli(rootPath: string, script: string): Promise<string> {
    const fullPath = path.join(rootPath, 'admin', 'cli', script)
    return new Promise((resolve, reject) => {
        // Usamos 'php' asumiendo que está en el PATH, o podrías añadir PHP_PATH al .env si fuera necesario
        exec(`php ${fullPath}`, (error, stdout, stderr) => {
            if (error) {
                reject(`Error ejecutando ${script}: ${stderr || error.message}`)
                return
            }
            resolve(stdout || 'Comando ejecutado con éxito (sin salida).')
        })
    })
}

export async function registerMaintenanceTools(server: McpServer, config: MoodleConfig) {

    // ── TOOL: Purgar Caches ──────────────────────────────────────────────────
    server.tool(
        'purge_moodle_caches',
        'Limpia todos los caches de Moodle (equivalente a admin/cli/purge_caches.php)',
        {},
        async () => {
            try {
                console.error(`[MCP] Purgando caches en ${config.MOODLE_NAME}...`)
                const output = await runMoodleCli(config.MOODLE_ROOT_PATH, 'purge_caches.php')
                return {
                    content: [{ type: 'text', text: `Caches purgados con éxito:\n${output}` }]
                }
            } catch (err) {
                return {
                    content: [{ type: 'text', text: `Error al purgar caches: ${err}` }],
                    isError: true
                }
            }
        }
    )

    // ── TOOL: Ejecutar Cron ──────────────────────────────────────────────────
    server.tool(
        'run_moodle_cron',
        'Ejecuta el cron de Moodle manualmente (equivalente a admin/cli/cron.php)',
        {},
        async () => {
            try {
                console.error(`[MCP] Ejecutando cron en ${config.MOODLE_NAME}...`)
                const output = await runMoodleCli(config.MOODLE_ROOT_PATH, 'cron.php')
                return {
                    content: [{ type: 'text', text: `Cron finalizado:\n${output}` }]
                }
            } catch (err) {
                return {
                    content: [{ type: 'text', text: `Error al ejecutar cron: ${err}` }],
                    isError: true
                }
            }
        }
    )
}
