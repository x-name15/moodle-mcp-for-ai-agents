import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import fs from 'fs'
import path from 'path'
import { XMLParser } from 'fast-xml-parser'
import type { MoodleConfig } from '../config.js'

interface PluginInfo {
  name: string
  type: string
  fullname: string
  version: string
  requires: string
  maturity: string
  dependencies: Record<string, string>
  tables: TableInfo[]
  hooks: string[]
  observers: ObserverInfo[]
  webservices: string[]
  hasExternalLib: boolean
  path: string
}

interface TableInfo {
  name: string
  fields: { name: string; type: string; length?: number; notnull?: boolean }[]
  indexes: { name: string; fields: string[] }[]
}

interface ObserverInfo {
  eventname: string
  callback: string
  includefile?: string
}

function parseVersionPhp(filePath: string): Partial<PluginInfo> {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const get = (key: string) =>
      content.match(new RegExp(`\\$plugin->${key}\\s*=\\s*['"]?([^'";]+)['"]?`))?.[1]?.trim() ?? ''

    const depsMatch = content.match(/\$plugin->dependencies\s*=\s*\[([^\]]+)\]/s)
    const dependencies: Record<string, string> = {}
    if (depsMatch) {
      const pairs = depsMatch[1].matchAll(/['"]([^'"]+)['"]\s*=>\s*['"]?(\w+)['"]?/g)
      for (const [, name, ver] of pairs) {
        dependencies[name] = ver
      }
    }

    return {
      version: get('version'),
      requires: get('requires'),
      maturity: get('maturity'),
      dependencies,
    }
  } catch {
    return {}
  }
}

function parseInstallXml(dbDir: string): TableInfo[] {
  const xmlPath = path.join(dbDir, 'install.xml')
  if (!fs.existsSync(xmlPath)) return []

  try {
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' })
    const xml = parser.parse(fs.readFileSync(xmlPath, 'utf-8'))
    const tables = xml?.XMLDB?.TABLES?.TABLE ?? []
    const tableArray = Array.isArray(tables) ? tables : [tables]

    return tableArray.map((t: any) => {
      const fields = (Array.isArray(t.FIELDS?.FIELD) ? t.FIELDS.FIELD : [t.FIELDS?.FIELD ?? []])
        .filter(Boolean)
        .map((f: any) => ({
          name: f['@_NAME'],
          type: f['@_TYPE'],
          length: f['@_LENGTH'] ? Number(f['@_LENGTH']) : undefined,
          notnull: f['@_NOTNULL'] === 'true',
        }))

      const indexes = (Array.isArray(t.INDEXES?.INDEX) ? t.INDEXES.INDEX : [t.INDEXES?.INDEX ?? []])
        .filter(Boolean)
        .map((i: any) => ({
          name: i['@_NAME'],
          fields: (i['@_FIELDS'] ?? '').split(',').map((s: string) => s.trim()),
        }))

      return { name: t['@_NAME'], fields, indexes }
    })
  } catch {
    return []
  }
}

function detectHooks(dbDir: string): string[] {
  const hooks: string[] = []

  const hooksFile = path.join(dbDir, 'hooks.php')
  if (fs.existsSync(hooksFile)) {
    const content = fs.readFileSync(hooksFile, 'utf-8')
    const matches = content.matchAll(/\\([a-zA-Z0-9_\\]+hook[a-zA-Z0-9_]*)/gi)
    for (const [, hook] of matches) hooks.push(hook)
  }

  const eventsFile = path.join(dbDir, 'events.php')
  if (fs.existsSync(eventsFile)) {
    const content = fs.readFileSync(eventsFile, 'utf-8')
    const matches = content.matchAll(/'eventname'\s*=>\s*'([^']+)'/g)
    for (const [, event] of matches) hooks.push(event)
  }

  return [...new Set(hooks)]
}

// Nuevo — lee db/observers.php y extrae el mapa completo de observers
function detectObservers(dbDir: string): ObserverInfo[] {
  const file = path.join(dbDir, 'observers.php')
  if (!fs.existsSync(file)) return []

  try {
    const content = fs.readFileSync(file, 'utf-8')
    const observers: ObserverInfo[] = []

    // Extrae bloques de arrays dentro de $observers = [...]
    const eventMatches = content.matchAll(
      /'eventname'\s*=>\s*'([^']+)'[\s\S]*?'callback'\s*=>\s*'([^']+)'(?:[\s\S]*?'includefile'\s*=>\s*'([^']+)')?/g
    )
    for (const [, eventname, callback, includefile] of eventMatches) {
      observers.push({ eventname, callback, includefile })
    }

    return observers
  } catch {
    return []
  }
}

function detectWebServices(dbDir: string): string[] {
  const file = path.join(dbDir, 'services.php')
  if (!fs.existsSync(file)) return []

  const content = fs.readFileSync(file, 'utf-8')
  const matches = content.matchAll(/'classname'\s*=>\s*'([^']+)'/g)
  return [...new Set([...matches].map(m => m[1]))]
}

// Nuevo — busca en archivos PHP del plugin qué hooks/eventos usa
function findHookUsageInCode(pluginPath: string, hookName: string): string[] {
  const files: string[] = []

  const scanDir = (dir: string) => {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          scanDir(full)
        } else if (entry.name.endsWith('.php')) {
          try {
            const content = fs.readFileSync(full, 'utf-8')
            if (content.includes(hookName)) {
              files.push(full)
            }
          } catch {
            // skip unreadable files
          }
        }
      }
    } catch {
      // skip unreadable dirs
    }
  }

  scanDir(pluginPath)
  return files
}

const PLUGIN_TYPES: Record<string, string> = {
  mod:          'Activity module',
  blocks:       'Block',
  local:        'Local plugin',
  auth:         'Authentication',
  enrol:        'Enrolment',
  theme:        'Theme',
  report:       'Report',
  admin:        'Admin tool',
  filter:       'Filter',
  course:       'Course format',
  grade:        'Grade',
  plagiarism:   'Plagiarism',
  portfolio:    'Portfolio',
  repository:   'Repository',
  question:     'Question type',
  qbank:        'Question bank',
  availability: 'Availability condition',
  calendartype: 'Calendar type',
  contenttype:  'Content type',
  customfield:  'Custom field',
  dataformat:   'Data format',
  media:        'Media player',
  payment:      'Payment gateway',
  search:       'Search engine',
  tool:         'Admin tool (tool)',
}

function scanSinglePlugin(typeDir: string, typeName: string, pluginPath: string, entryName: string): PluginInfo {
  const versionData = parseVersionPhp(path.join(pluginPath, 'version.php'))
  const dbDir = path.join(pluginPath, 'db')

  return {
    name: entryName,
    type: typeName,
    fullname: `${typeDir}_${entryName}`,
    version: versionData.version ?? 'unknown',
    requires: versionData.requires ?? 'unknown',
    maturity: versionData.maturity ?? 'unknown',
    dependencies: versionData.dependencies ?? {},
    tables: parseInstallXml(dbDir),
    hooks: detectHooks(dbDir),
    observers: detectObservers(dbDir),
    webservices: detectWebServices(dbDir),
    hasExternalLib: fs.existsSync(path.join(pluginPath, 'externallib.php')),
    path: pluginPath,
  }
}

function scanPlugins(rootPath: string): Map<string, PluginInfo> {
  const pluginMap = new Map<string, PluginInfo>()

  console.error(`[MCP] Escaneando en: ${rootPath}`)

  if (!fs.existsSync(rootPath)) {
    console.error(`[MCP] ERROR: La ruta no existe: ${rootPath}`)
    return pluginMap
  }

  for (const [typeDir, typeName] of Object.entries(PLUGIN_TYPES)) {
    const typePath = path.join(rootPath, typeDir)
    if (!fs.existsSync(typePath)) continue

    console.error(`[MCP] Encontrado tipo: ${typeDir}`)

    const entries = fs.readdirSync(typePath, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const pluginPath = path.join(typePath, entry.name)
      if (!fs.existsSync(path.join(pluginPath, 'version.php'))) continue

      const plugin = scanSinglePlugin(typeDir, typeName, pluginPath, entry.name)
      pluginMap.set(plugin.fullname, plugin)
    }
  }

  console.error(`[MCP] Total encontrados: ${pluginMap.size}`)
  return pluginMap
}

export async function registerPluginTools(server: McpServer, config: MoodleConfig) {
  // Cache como Map — permite invalidación por plugin individual
  let pluginCache: Map<string, PluginInfo> | null = null

  const getPlugins = (): Map<string, PluginInfo> => {
    if (!pluginCache) {
      console.error('[MCP] Escaneando plugins...')
      pluginCache = scanPlugins(config.MOODLE_ROOT_PATH)
      console.error(`[MCP] ${pluginCache.size} plugins en cache`)
    }
    return pluginCache
  }

  const getPluginsArray = (): PluginInfo[] => [...getPlugins().values()]

  // ── TOOL 1: Lista todos los plugins ──────────────────────────────────────
  server.tool(
    'list_plugins',
    'Lista todos los plugins instalados con tipo, versión y dependencias',
    {},
    async () => {
      const plugins = getPluginsArray()
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            moodle: config.MOODLE_NAME,
            version: config.MOODLE_VERSION,
            totalPlugins: plugins.length,
            plugins: plugins.map(p => ({
              fullname: p.fullname,
              type: p.type,
              version: p.version,
              dependencyCount: Object.keys(p.dependencies).length,
              tableCount: p.tables.length,
              hasWebServices: p.webservices.length > 0,
              hasHooks: p.hooks.length > 0,
              hasObservers: p.observers.length > 0,
            })),
          }, null, 2),
        }],
      }
    }
  )

  // ── TOOL 2: Detalle de un plugin ──────────────────────────────────────────
  server.tool(
    'get_plugin_detail',
    'Detalle completo de un plugin: tablas DB, hooks, observers, web services y dependencias',
    { pluginName: z.string().describe('Nombre del plugin, ej: mod_forum o local_messagebroker') },
    async ({ pluginName }) => {
      const plugins = getPlugins()
      const plugin = plugins.get(pluginName)
        ?? [...plugins.values()].find(p => p.name === pluginName)

      if (!plugin) {
        return {
          content: [{
            type: 'text',
            text: `Plugin "${pluginName}" no encontrado. Usa list_plugins para ver los disponibles.`,
          }],
        }
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(plugin, null, 2) }],
      }
    }
  )

  // ── TOOL 3: Árbol de dependencias ─────────────────────────────────────────
  server.tool(
    'get_plugin_dependencies',
    'Árbol de dependencias: qué plugins requiere y cuáles dependen de él',
    { pluginName: z.string().describe('Nombre completo del plugin, ej: mod_forum') },
    async ({ pluginName }) => {
      const plugins = getPlugins()
      const plugin = plugins.get(pluginName)
        ?? [...plugins.values()].find(p => p.name === pluginName)

      if (!plugin) {
        return { content: [{ type: 'text', text: `Plugin "${pluginName}" no encontrado` }] }
      }

      const dependents = [...plugins.values()].filter(p =>
        Object.keys(p.dependencies).includes(plugin.fullname)
      )

      const resolvedDeps = Object.entries(plugin.dependencies).map(([name, requiredVersion]) => {
        const installed = plugins.get(name)
        return {
          name,
          requiredVersion,
          installed: !!installed,
          installedVersion: installed?.version ?? null,
        }
      })

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            plugin: plugin.fullname,
            requires: resolvedDeps,
            requiredBy: dependents.map(d => ({ plugin: d.fullname, version: d.version })),
          }, null, 2),
        }],
      }
    }
  )

  // ── TOOL 4: Buscar por tabla ──────────────────────────────────────────────
  server.tool(
    'find_plugins_by_table',
    'Qué plugins usan una tabla específica de la base de datos',
    { tableName: z.string().describe('Nombre de la tabla, ej: assign_submission') },
    async ({ tableName }) => {
      const matches = getPluginsArray().filter(p =>
        p.tables.some(t => t.name.includes(tableName))
      )

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            searchedTable: tableName,
            foundIn: matches.map(p => ({
              plugin: p.fullname,
              matchingTables: p.tables
                .filter(t => t.name.includes(tableName))
                .map(t => ({ name: t.name, fields: t.fields })),
            })),
          }, null, 2),
        }],
      }
    }
  )

  // ── TOOL 5: Buscar por hook ───────────────────────────────────────────────
  server.tool(
    'find_plugins_by_hook',
    'Qué plugins implementan o escuchan un hook o evento específico',
    { hookName: z.string().describe('Nombre del hook o evento, ej: user_loggedin o after_config') },
    async ({ hookName }) => {
      const plugins = getPluginsArray()

      const implementors = plugins.filter(p =>
        p.hooks.some(h => h.includes(hookName)) ||
        p.observers.some(o => o.eventname.includes(hookName))
      )

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            hook: hookName,
            implementedBy: implementors.map(p => ({
              plugin: p.fullname,
              matchingHooks: p.hooks.filter(h => h.includes(hookName)),
              matchingObservers: p.observers.filter(o => o.eventname.includes(hookName)),
            })),
            total: implementors.length,
          }, null, 2),
        }],
      }
    }
  )

  // ── TOOL 6: Uso de hook en código PHP ─────────────────────────────────────
  server.tool(
    'get_hook_usage',
    'En qué archivos PHP de un plugin aparece un hook o clase específica',
    {
      pluginName: z.string().describe('Nombre del plugin, ej: local_messagebroker'),
      hookName: z.string().describe('Hook, clase o string a buscar en el código PHP'),
    },
    async ({ pluginName, hookName }) => {
      const plugins = getPlugins()
      const plugin = plugins.get(pluginName)
        ?? [...plugins.values()].find(p => p.name === pluginName)

      if (!plugin) {
        return { content: [{ type: 'text', text: `Plugin "${pluginName}" no encontrado` }] }
      }

      console.error(`[MCP] Buscando "${hookName}" en ${plugin.path}...`)
      const files = findHookUsageInCode(plugin.path, hookName)

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            plugin: plugin.fullname,
            searchedFor: hookName,
            foundInFiles: files.map(f => f.replace(plugin.path, '').replace(/\\/g, '/')),
            totalFiles: files.length,
          }, null, 2),
        }],
      }
    }
  )

  // ── TOOL 7: Puntos de integración entre dos plugins ───────────────────────
  server.tool(
    'find_integration_points',
    'Analiza dos plugins y encuentra cómo pueden integrarse: hooks en común, tablas compartidas, dependencias y observers',
    {
      pluginA: z.string().describe('Primer plugin, ej: local_messagebroker'),
      pluginB: z.string().describe('Segundo plugin, ej: mod_assign'),
    },
    async ({ pluginA, pluginB }) => {
      const plugins = getPlugins()
      const pA = plugins.get(pluginA) ?? [...plugins.values()].find(p => p.name === pluginA)
      const pB = plugins.get(pluginB) ?? [...plugins.values()].find(p => p.name === pluginB)

      if (!pA) return { content: [{ type: 'text', text: `Plugin "${pluginA}" no encontrado` }] }
      if (!pB) return { content: [{ type: 'text', text: `Plugin "${pluginB}" no encontrado` }] }

      // Hooks en común
      const sharedHooks = pA.hooks.filter(h => pB.hooks.includes(h))

      // Tablas compartidas (mismo nombre)
      const tablesA = new Set(pA.tables.map(t => t.name))
      const tablesB = new Set(pB.tables.map(t => t.name))
      const sharedTables = [...tablesA].filter(t => tablesB.has(t))

      // A observa eventos de B o viceversa
      const aObservesB = pA.observers.filter(o =>
        o.callback.includes(pB.name) || o.eventname.includes(pB.name)
      )
      const bObservesA = pB.observers.filter(o =>
        o.callback.includes(pA.name) || o.eventname.includes(pA.name)
      )

      // Dependencias directas
      const aRequiresB = Object.keys(pA.dependencies).includes(pB.fullname)
      const bRequiresA = Object.keys(pB.dependencies).includes(pA.fullname)

      // Web services que podría usar uno del otro
      const wsA = pA.webservices
      const wsB = pB.webservices

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            pluginA: pA.fullname,
            pluginB: pB.fullname,
            directDependency: {
              aRequiresB,
              bRequiresA,
            },
            sharedHooks,
            sharedTables,
            observerRelations: {
              aObservesB,
              bObservesA,
            },
            availableWebServices: {
              fromA: wsA,
              fromB: wsB,
            },
            integrationSuggestions: [
              sharedHooks.length > 0
                ? `Ambos plugins usan los hooks: ${sharedHooks.join(', ')} — puedes coordinar comportamiento aquí`
                : null,
              aObservesB.length > 0
                ? `${pA.fullname} ya observa eventos de ${pB.fullname}`
                : null,
              bObservesA.length > 0
                ? `${pB.fullname} ya observa eventos de ${pA.fullname}`
                : null,
              wsA.length > 0
                ? `${pA.fullname} expone ${wsA.length} web service(s) que ${pB.fullname} podría consumir`
                : null,
              wsB.length > 0
                ? `${pB.fullname} expone ${wsB.length} web service(s) que ${pA.fullname} podría consumir`
                : null,
              !aRequiresB && !bRequiresA
                ? `No hay dependencia declarada — si necesitas que ${pA.name} use ${pB.name}, añade en version.php: $plugin->dependencies = ['${pB.fullname}' => ANY_VERSION]`
                : null,
            ].filter(Boolean),
          }, null, 2),
        }],
      }
    }
  )

  // ── TOOL 8: API pública de un plugin ──────────────────────────────────────
  server.tool(
    'get_plugin_api',
    'Lista las funciones públicas disponibles de un plugin: external lib, clases en classes/external/, y web services declarados',
    { pluginName: z.string().describe('Nombre del plugin, ej: local_messagebroker') },
    async ({ pluginName }) => {
      const plugins = getPlugins()
      const plugin = plugins.get(pluginName)
        ?? [...plugins.values()].find(p => p.name === pluginName)

      if (!plugin) {
        return { content: [{ type: 'text', text: `Plugin "${pluginName}" no encontrado` }] }
      }

      const api: {
        externalLib: string[]
        externalClasses: string[]
        webservices: string[]
        servicesPhp: string | null
      } = {
        externalLib: [],
        externalClasses: [],
        webservices: plugin.webservices,
        servicesPhp: null,
      }

      // externallib.php — funciones públicas estáticas
      const extLib = path.join(plugin.path, 'externallib.php')
      if (fs.existsSync(extLib)) {
        const content = fs.readFileSync(extLib, 'utf-8')
        const matches = content.matchAll(/public\s+static\s+function\s+(\w+)/g)
        api.externalLib = [...matches].map(m => m[1])
      }

      // classes/external/*.php
      const externalDir = path.join(plugin.path, 'classes', 'external')
      if (fs.existsSync(externalDir)) {
        const files = fs.readdirSync(externalDir).filter(f => f.endsWith('.php'))
        for (const file of files) {
          const content = fs.readFileSync(path.join(externalDir, file), 'utf-8')
          const matches = content.matchAll(/public\s+static\s+function\s+(\w+)/g)
          const fns = [...matches].map(m => m[1])
          if (fns.length > 0) {
            api.externalClasses.push(`${file}: ${fns.join(', ')}`)
          }
        }
      }

      // Contenido de db/services.php para contexto
      const servicesFile = path.join(plugin.path, 'db', 'services.php')
      if (fs.existsSync(servicesFile)) {
        api.servicesPhp = fs.readFileSync(servicesFile, 'utf-8')
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            plugin: plugin.fullname,
            hasExternalLib: plugin.hasExternalLib,
            api,
          }, null, 2),
        }],
      }
    }
  )

  // ── TOOL 9: Invalidar cache de un plugin individual ───────────────────────
  server.tool(
    'invalidate_plugin_cache',
    'Re-escanea un plugin específico sin tocar el resto del cache',
    { pluginName: z.string().describe('Nombre completo del plugin, ej: local_messagebroker') },
    async ({ pluginName }) => {
      const plugins = getPlugins()
      const plugin = plugins.get(pluginName)
        ?? [...plugins.values()].find(p => p.name === pluginName)

      if (!plugin) {
        return { content: [{ type: 'text', text: `Plugin "${pluginName}" no encontrado en cache` }] }
      }

      // Determinar typeDir desde el fullname
      const typeDir = plugin.fullname.split('_')[0] === 'mod' ? 'mod'
        : plugin.fullname.substring(0, plugin.fullname.lastIndexOf('_' + plugin.name))

      const updated = scanSinglePlugin(typeDir, plugin.type, plugin.path, plugin.name)
      pluginCache!.set(updated.fullname, updated)

      return {
        content: [{
          type: 'text',
          text: `Plugin ${updated.fullname} actualizado en cache. Tablas: ${updated.tables.length}, Hooks: ${updated.hooks.length}, Observers: ${updated.observers.length}`,
        }],
      }
    }
  )

  // ── TOOL 10: Refresh completo ─────────────────────────────────────────────
  server.tool(
    'refresh_plugin_cache',
    'Re-escanea todos los plugins desde el filesystem',
    {},
    async () => {
      pluginCache = null
      const plugins = getPlugins()
      return {
        content: [{
          type: 'text',
          text: `Cache actualizado. ${plugins.size} plugins encontrados en ${config.MOODLE_NAME}.`,
        }],
      }
    }
  )
}