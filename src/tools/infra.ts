import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import fs from 'fs'
import path from 'path'
import type { MoodleConfig } from '../config.js'

interface Microservice {
  name: string
  description: string
  type: 'rest' | 'rabbitmq' | 'grpc' | 'other'
  endpoint?: string
  queue?: string
  events?: string[]
  notes?: string
}

export async function registerInfraTools(server: McpServer, config: MoodleConfig) {

  server.tool(
    'get_infra_context',
    'Infraestructura completa de esta instancia: RabbitMQ, servicios externos, URLs y puertos',
    {},
    async () => {
      let microservices: Microservice[] = []
      const msPath = path.resolve(config.MICROSERVICES_CONFIG)
      if (fs.existsSync(msPath)) {
        try {
          microservices = JSON.parse(fs.readFileSync(msPath, 'utf-8'))
        } catch {
          microservices = []
        }
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            moodle: config.MOODLE_NAME,
            version: config.MOODLE_VERSION,
            url: config.MOODLE_URL,
            rabbitmq: {
              host: config.RABBITMQ_HOST,
              amqpPort: config.RABBITMQ_PORT,
              managementUrl: `http://${config.RABBITMQ_HOST}:${config.RABBITMQ_MANAGEMENT_PORT}`,
              user: config.RABBITMQ_USER,
            },
            microservices,
          }, null, 2),
        }],
      }
    }
  )

  // Tool: Estado de RabbitMQ via management API
  server.tool(
    'get_rabbitmq_status',
    'Estado actual de RabbitMQ: queues activas, mensajes pendientes y consumers conectados',
    {},
    async () => {
      try {
        const auth = Buffer.from(
          `${config.RABBITMQ_USER}:${config.RABBITMQ_PASSWORD}`
        ).toString('base64')

        const baseUrl = `http://${config.RABBITMQ_HOST}:${config.RABBITMQ_MANAGEMENT_PORT}/api`

        const fetchJson = async (endpoint: string) => {
          const res = await fetch(`${baseUrl}${endpoint}`, {
            headers: { Authorization: `Basic ${auth}` },
          })
          if (!res.ok) throw new Error(`HTTP ${res.status} en ${endpoint}`)
          return res.json()
        }

        const [overview, queues] = await Promise.all([
          fetchJson('/overview'),
          fetchJson('/queues'),
        ])

        const queueSummary = (queues as any[]).map((q: any) => ({
          name: q.name,
          vhost: q.vhost,
          messages: q.messages ?? 0,
          messages_ready: q.messages_ready ?? 0,
          messages_unacked: q.messages_unacknowledged ?? 0,
          consumers: q.consumers ?? 0,
          state: q.state,
        }))

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              moodle: config.MOODLE_NAME,
              rabbitmq: {
                version: (overview as any).rabbitmq_version,
                node: (overview as any).node,
                totalMessages: (overview as any).queue_totals?.messages ?? 0,
                connections: (overview as any).object_totals?.connections ?? 0,
              },
              queues: queueSummary,
            }, null, 2),
          }],
        }
      } catch (err: any) {
        return {
          content: [{
            type: 'text',
            text: `No se pudo conectar a RabbitMQ management: ${err.message}\nVerifica que el container esté corriendo en puerto ${config.RABBITMQ_MANAGEMENT_PORT}`,
          }],
        }
      }
    }
  )
}