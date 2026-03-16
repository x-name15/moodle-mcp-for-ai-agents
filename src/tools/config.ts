import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import fs from 'fs'
import path from 'path'
import type { MoodleConfig } from '../config.js'

function parseMoodleConfig(rootPath: string): Record<string, string> {
  const configPath = path.join(rootPath, 'config.php')
  if (!fs.existsSync(configPath)) return {}

  const content = fs.readFileSync(configPath, 'utf-8')
  const result: Record<string, string> = {}

  // Extrae $CFG->key = 'value' o $CFG->key = value
  const matches = content.matchAll(/\$CFG->(\w+)\s*=\s*['"]?([^'"\n;]+)['"]?\s*;/g)
  for (const [, key, value] of matches) {
    result[key] = value.trim()
  }

  return result
}

export async function registerConfigTools(server: McpServer, config: MoodleConfig) {

  server.tool(
    'get_moodle_config',
    'Lee el config.php de Moodle y devuelve la configuración del sitio: URL, dataroot, caché, DB, etc.',
    {},
    async () => {
      const cfg = parseMoodleConfig(config.MOODLE_ROOT_PATH)

      if (Object.keys(cfg).length === 0) {
        return {
          content: [{
            type: 'text',
            text: `No se pudo leer config.php en ${config.MOODLE_ROOT_PATH}`,
          }],
        }
      }

      // Ocultar password de BD por seguridad
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