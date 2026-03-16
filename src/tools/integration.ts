import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import fs from 'fs'
import path from 'path'
import type { MoodleConfig } from '../config.js'

// Lee todos los hooks/eventos que dispara un plugin (como emisor)
function getEmittedEvents(pluginPath: string): string[] {
  const events: string[] = []
  
  const scanDir = (dir: string) => {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (['node_modules', '.git', 'vendor'].includes(entry.name)) continue
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          scanDir(full)
        } else if (entry.name.endsWith('.php')) {
          try {
            const content = fs.readFileSync(full, 'utf-8')
            // Eventos disparados con ::trigger() o trigger_event()
            const triggerMatches = content.matchAll(
              /\\([a-zA-Z0-9_\\]+)::create\s*\(|trigger_event\s*\(\s*['"]([^'"]+)['"]/g
            )
            for (const m of triggerMatches) {
              const event = m[1] ?? m[2]
              if (event) events.push(event)
            }
          } catch { }
        }
      }
    } catch { }
  }

  scanDir(pluginPath)
  return [...new Set(events)]
}

// Lee los observers.php de todos los plugins para construir mapa global
function buildObserverMap(rootPath: string): Map<string, string[]> {
  const map = new Map<string, string[]>()

  const scanObserversFile = (pluginName: string, observersPath: string) => {
    if (!fs.existsSync(observersPath)) return
    try {
      const content = fs.readFileSync(observersPath, 'utf-8')
      const matches = content.matchAll(/'eventname'\s*=>\s*'([^']+)'/g)
      for (const [, eventname] of matches) {
        const current = map.get(eventname) ?? []
        current.push(pluginName)
        map.set(eventname, current)
      }
    } catch { }
  }

  // Escanear todos los tipos de plugin
  const pluginTypeDirs = ['mod', 'blocks', 'local', 'auth', 'enrol', 'report', 'admin']
  for (const typeDir of pluginTypeDirs) {
    const typePath = path.join(rootPath, typeDir)
    if (!fs.existsSync(typePath)) continue
    try {
      const entries = fs.readdirSync(typePath, { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const fullname = `${typeDir}_${entry.name}`
        const observersPath = path.join(typePath, entry.name, 'db', 'observers.php')
        scanObserversFile(fullname, observersPath)
      }
    } catch { }
  }

  return map
}

export async function registerIntegrationTools(server: McpServer, config: MoodleConfig) {

  server.tool(
    'suggest_hook_integration',
    'Sugiere cómo integrar dos plugins usando el sistema de hooks y eventos de Moodle. Analiza qué eventos dispara A que B podría escuchar, y viceversa.',
    {
      pluginA: z.string().describe('Plugin emisor o que quieres conectar, ej: mod_assign'),
      pluginB: z.string().describe('Plugin receptor o que reaccionará, ej: local_messagebroker'),
    },
    async ({ pluginA, pluginB }) => {
      // Rutas de los plugins
      const findPluginPath = (fullname: string): string | null => {
        const parts = fullname.split('_')
        if (parts.length < 2) return null
        // El typeDir puede ser multi-parte: local_my_plugin → typeDir=local, name=my_plugin
        const typeDir = parts[0]
        const name = parts.slice(1).join('_')
        const candidate = path.join(config.MOODLE_ROOT_PATH, typeDir, name)
        return fs.existsSync(candidate) ? candidate : null
      }

      const pathA = findPluginPath(pluginA)
      const pathB = findPluginPath(pluginB)

      if (!pathA) return { content: [{ type: 'text', text: `No se encontró el path de "${pluginA}"` }] }
      if (!pathB) return { content: [{ type: 'text', text: `No se encontró el path de "${pluginB}"` }] }

      console.error(`[MCP] Analizando hooks entre ${pluginA} y ${pluginB}...`)

      // Eventos que cada plugin dispara
      const eventsFromA = getEmittedEvents(pathA)
      const eventsFromB = getEmittedEvents(pathB)

      // Observers actuales de cada plugin
      const observersA = fs.existsSync(path.join(pathA, 'db', 'observers.php'))
        ? fs.readFileSync(path.join(pathA, 'db', 'observers.php'), 'utf-8')
        : null
      const observersB = fs.existsSync(path.join(pathB, 'db', 'observers.php'))
        ? fs.readFileSync(path.join(pathB, 'db', 'observers.php'), 'utf-8')
        : null

      // Ya está B escuchando a A?
      const bAlreadyListensA = observersB
        ? eventsFromA.some(e => observersB.includes(e))
        : false

      // Ya está A escuchando a B?
      const aAlreadyListensB = observersA
        ? eventsFromB.some(e => observersA.includes(e))
        : false

      // Mapa global de observers para ver quién más escucha los mismos eventos
      const globalMap = buildObserverMap(config.MOODLE_ROOT_PATH)
      const otherListenersOfA = eventsFromA.flatMap(e =>
        (globalMap.get(e) ?? []).filter(p => p !== pluginA && p !== pluginB)
          .map(p => ({ event: e, plugin: p }))
      )

      // Generar sugerencias concretas
      const suggestions: string[] = []

      if (eventsFromA.length > 0 && !bAlreadyListensA) {
        suggestions.push(
          `"${pluginB}" puede escuchar estos eventos de "${pluginA}" añadiendo en db/observers.php:\n` +
          eventsFromA.slice(0, 3).map(e =>
            `  [\n    'eventname' => '${e}',\n    'callback'  => '\\${pluginB.replace('_', '\\')}\\observer::on_${e.split('\\').pop()?.toLowerCase() ?? 'event'}',\n  ]`
          ).join(',\n')
        )
      }

      if (eventsFromB.length > 0 && !aAlreadyListensB) {
        suggestions.push(
          `"${pluginA}" puede escuchar estos eventos de "${pluginB}" añadiendo en db/observers.php:\n` +
          eventsFromB.slice(0, 3).map(e =>
            `  [\n    'eventname' => '${e}',\n    'callback'  => '\\${pluginA.replace('_', '\\')}\\observer::on_${e.split('\\').pop()?.toLowerCase() ?? 'event'}',\n  ]`
          ).join(',\n')
        )
      }

      if (eventsFromA.length === 0 && eventsFromB.length === 0) {
        suggestions.push(
          `Ninguno de los dos plugins dispara eventos detectables automáticamente. ` +
          `Considera usar get_hook_usage para buscar clases de eventos manualmente, ` +
          `o integrarlos via Web Service directo con get_plugin_api.`
        )
      }

      if (bAlreadyListensA) {
        suggestions.push(`"${pluginB}" ya está escuchando eventos de "${pluginA}" en su observers.php actual.`)
      }

      if (aAlreadyListensB) {
        suggestions.push(`"${pluginA}" ya está escuchando eventos de "${pluginB}" en su observers.php actual.`)
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            pluginA,
            pluginB,
            eventsDispatchedByA: eventsFromA,
            eventsDispatchedByB: eventsFromB,
            currentRelation: {
              bListensToA: bAlreadyListensA,
              aListensToB: aAlreadyListensB,
            },
            otherPluginsListeningToA: otherListenersOfA,
            suggestions,
            nextSteps: [
              'Usa get_plugin_api para ver los WS disponibles de cada plugin',
              'Usa find_integration_points para ver tablas y hooks en común',
              'Usa get_hook_usage para buscar clases de eventos específicas en el código',
            ],
          }, null, 2),
        }],
      }
    }
  )
}