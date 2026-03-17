import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import fs from 'fs'
import path from 'path'
import type { MoodleConfig } from '../config.js'

function parseMoodleConfig(rootPath: string): Record<string, string> {
  const configPath = path.join(rootPath, 'config.php')
  if (!fs.existsSync(configPath)) return {}

  const content = fs.readFileSync(configPath, 'utf-8')
  const result: Record<string, string> = {}

  // Extracts $CFG->key = 'value' or $CFG->key = value
  const matches = content.matchAll(/\\$CFG->(\\w+)\\s*=\\s*['"]?([^'"\\n;]+)['"]?\\s*;/g)
  for (const [, key, value] of matches) {
    result[key] = value.trim()
  }

  return result
}

export async function registerConfigTools(server: McpServer, config: MoodleConfig) {

  server.tool(
    'get_moodle_config',
    'Reads Moodle config.php and returns the site configuration: URL, dataroot, cache, DB, etc.',
    {},
    async () => {
      const cfg = parseMoodleConfig(config.MOODLE_ROOT_PATH)

      if (Object.keys(cfg).length === 0) {
        return {
          content: [{
            type: 'text',
            text: `Could not read config.php at \${config.MOODLE_ROOT_PATH}`,
          }],
        }
      }

      // Hide DB password for security
      const safe = { ...cfg }
      if (safe.dbpass) safe.dbpass = '***'

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            moodle: config.MOODLE_NAME,
            version: config.MOODLE_VERSION,
            config: safe,
          }, null, 2),
        }],
      }
    }
  )
}