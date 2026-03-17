import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { exec } from 'child_process'
import path from 'path'
import type { MoodleConfig } from '../config.js'

/**
 * Executes a Moodle PHP CLI command safely
 */
function runMoodleCli(rootPath: string, script: string): Promise<string> {
    const fullPath = path.join(rootPath, 'admin', 'cli', script)
    return new Promise((resolve, reject) => {
        // Using 'php' assuming it is in the PATH, or you could add PHP_PATH to .env if necessary
        exec(`php \${fullPath}`, (error, stdout, stderr) => {
            if (error) {
                reject(`Error executing \${script}: \${stderr || error.message}`)
                return
            }
            resolve(stdout || 'Command executed successfully (no output).')
        })
    })
}

export async function registerMaintenanceTools(server: McpServer, config: MoodleConfig) {

    // ── TOOL: Purge Caches ──────────────────────────────────────────────────
    server.tool(
        'purge_moodle_caches',
        'Clears all Moodle caches (equivalent to admin/cli/purge_caches.php)',
        {},
        async () => {
            try {
                console.error(`[MCP] Purging caches on \${config.MOODLE_NAME}...`)
                const output = await runMoodleCli(config.MOODLE_ROOT_PATH, 'purge_caches.php')
                return {
                    content: [{ type: 'text', text: `Caches purged successfully:\\n\${output}` }]
                }
            } catch (err) {
                return {
                    content: [{ type: 'text', text: `Error purging caches: \${err}` }],
                    isError: true
                }
            }
        }
    )

    // ── TOOL: Execute Cron ──────────────────────────────────────────────────
    server.tool(
        'run_moodle_cron',
        'Executes the Moodle cron manually (equivalent to admin/cli/cron.php)',
        {},
        async () => {
            try {
                console.error(`[MCP] Executing cron on \${config.MOODLE_NAME}...`)
                const output = await runMoodleCli(config.MOODLE_ROOT_PATH, 'cron.php')
                return {
                    content: [{ type: 'text', text: `Cron finished:\\n\${output}` }]
                }
            } catch (err) {
                return {
                    content: [{ type: 'text', text: `Error executing cron: \${err}` }],
                    isError: true
                }
            }
        }
    )
}
