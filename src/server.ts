import { select } from '@inquirer/prompts'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { loadConfig, discoverInstances } from './config.js'
import { registerPluginTools } from './tools/plugins.js'
import { registerDbTools } from './tools/db.js'
import { registerWebServiceTools } from './tools/webservices.js'
import { registerInfraTools } from './tools/infra.js'
import { registerLogTools } from './tools/moodlelog.js'
import { registerConfigTools } from './tools/config.js'
import { registerUserTools } from './tools/users.js'
import { registerPrompts } from './prompts/templates.js'
import { registerIntegrationTools } from './tools/integration.js'

async function main() {
    const instances = discoverInstances()
    let envFile: string

    if (process.stdin.isTTY) {
        console.clear()
        console.log('┌─────────────────────────────────┐')
        console.log('│        Moodle MCP Server        │')
        console.log('└─────────────────────────────────┘')
        console.log()

    envFile = await select({
        message: '¿Con qué Moodle trabajas hoy?',
        choices: instances.map(instance => ({
        name: instance.label,
        value: instance.value,
        })),
        })
    } else {
        const instanceEnvVar = process.env.MOODLE_INSTANCE
        const instance = instances.find(item => item.envVar === instanceEnvVar)
        ?? instances[0]
        envFile = instance.value
    }

    const config = loadConfig(envFile)

    console.error(`[MCP] Instancia : ${config.MOODLE_NAME}`)
    console.error(`[MCP] Versión   : ${config.MOODLE_VERSION}`)
    console.error(`[MCP] DB        : ${config.DB_HOST}:${config.DB_PORT}/${config.DB_NAME}`)

    const server = new McpServer({
        name: 'moodle-mcp',
        version: '0.1.0',
    })

    await registerPluginTools(server, config)
    await registerDbTools(server, config)
    await registerWebServiceTools(server, config)
    await registerInfraTools(server, config)
    await registerLogTools(server, config)
    await registerConfigTools(server, config)
    await registerUserTools(server, config)
    await registerPrompts(server, config)
    await registerIntegrationTools(server, config)

    const transport = new StdioServerTransport()
    await server.connect(transport)

    console.error('[MCP] Listo. Escuchando llamadas de Copilot...')

  // Mantener el proceso vivo — MCP necesita que el proceso no termine
    await new Promise<void>((resolve) => {
        process.on('SIGINT', resolve)
        process.on('SIGTERM', resolve)
    // Si stdin se cierra (VS Code cerró la conexión), terminar limpiamente
        process.stdin.on('close', resolve)
    })
}

main().catch(err => {
    console.error('[MCP] Error fatal:', err)
    process.exit(1)
})