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
    'Complete infrastructure of this instance: RabbitMQ, external services, URLs and ports',
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
              managementUrl: `http://\${config.RABBITMQ_HOST}:\${config.RABBITMQ_MANAGEMENT_PORT}`,
              user: config.RABBITMQ_USER,
            },
            microservices,
          }, null, 2),
        }],
      }
    }
  )

  // Tool: RabbitMQ Status via management API
  server.tool(
    'get_rabbitmq_status',
    'Current RabbitMQ status: active queues, pending messages and connected consumers',
    {},
    async () => {
      try {
        const auth = Buffer.from(
          `\${config.RABBITMQ_USER}:\${config.RABBITMQ_PASSWORD}`
        ).toString('base64')

        const baseUrl = `http://\${config.RABBITMQ_HOST}:\${config.RABBITMQ_MANAGEMENT_PORT}/api`

        const fetchJson = async (endpoint: string) => {
          const res = await fetch(`\${baseUrl}\${endpoint}`, {
            headers: { Authorization: `Basic \${auth}` },
          })
          if (!res.ok) throw new Error(`HTTP \${res.status} at \${endpoint}`)
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
            text: `Could not connect to RabbitMQ management: \${err.message}\nVerify that the container is running on port \${config.RABBITMQ_MANAGEMENT_PORT}`,
          }],
        }
      }
    }
  )
}