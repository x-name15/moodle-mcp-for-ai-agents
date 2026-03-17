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

    const depsMatch = content.match(/\\$plugin->dependencies\\s*=\\s*\\[([^\\]]+)\\]/s)
    const dependencies: Record<string, string> = {}
    if (depsMatch) {
      const pairs = depsMatch[1].matchAll(/['"]([^'"]+)['"]\\s*=>\\s*['"]?(\\w+)['"]?/g)
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
    const matches = content.matchAll(/\\\\([a-zA-Z0-9_\\\\]+hook[a-zA-Z0-9_]*)/gi)
    for (const [, hook] of matches) hooks.push(hook)
  }

  const eventsFile = path.join(dbDir, 'events.php')
  if (fs.existsSync(eventsFile)) {
    const content = fs.readFileSync(eventsFile, 'utf-8')
    const matches = content.matchAll(/'eventname'\\s*=>\\s*'([^']+)'/g)
    for (const [, event] of matches) hooks.push(event)
  }

  return [...new Set(hooks)]
}

// Reads db/observers.php and extracts the entire observers map
function detectObservers(dbDir: string): ObserverInfo[] {
  const file = path.join(dbDir, 'observers.php')
  if (!fs.existsSync(file)) return []

  try {
    const content = fs.readFileSync(file, 'utf-8')
    const observers: ObserverInfo[] = []

    // Extracts arrays blocks inside $observers = [...]
    const eventMatches = content.matchAll(
      /'eventname'\\s*=>\\s*'([^']+)'[\\s\\S]*?'callback'\\s*=>\\s*'([^']+)'(?:[\\s\\S]*?'includefile'\\s*=>\\s*'([^']+)')?/g
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
  const matches = content.matchAll(/'classname'\\s*=>\\s*'([^']+)'/g)
  return [...new Set([...matches].map(m => m[1]))]
}

// Searches in the plugin's PHP files which hooks/events it uses
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
    fullname: `\${typeDir}_\${entryName}`,
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

  console.error(`[MCP] Scanning in: \${rootPath}`)

  if (!fs.existsSync(rootPath)) {
    console.error(`[MCP] ERROR: Path does not exist: \${rootPath}`)
    return pluginMap
  }

  for (const [typeDir, typeName] of Object.entries(PLUGIN_TYPES)) {
    const typePath = path.join(rootPath, typeDir)
    if (!fs.existsSync(typePath)) continue

    console.error(`[MCP] Found type: \${typeDir}`)

    const entries = fs.readdirSync(typePath, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const pluginPath = path.join(typePath, entry.name)
      if (!fs.existsSync(path.join(pluginPath, 'version.php'))) continue

      const plugin = scanSinglePlugin(typeDir, typeName, pluginPath, entry.name)
      pluginMap.set(plugin.fullname, plugin)
    }
  }

  console.error(`[MCP] Total found: \${pluginMap.size}`)
  return pluginMap
}

export async function registerPluginTools(server: McpServer, config: MoodleConfig) {
  // Map cache — allows invalidating a single plugin
  let pluginCache: Map<string, PluginInfo> | null = null

  const getPlugins = (): Map<string, PluginInfo> => {
    if (!pluginCache) {
      console.error('[MCP] Scanning plugins...')
      pluginCache = scanPlugins(config.MOODLE_ROOT_PATH)
      console.error(`[MCP] \${pluginCache.size} plugins in cache`)
    }
    return pluginCache
  }

  const getPluginsArray = (): PluginInfo[] => [...getPlugins().values()]

  // ── TOOL 1: List all plugins ──────────────────────────────────────
  server.tool(
    'list_plugins',
    'Lists all installed plugins with type, version and dependencies',
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

  // ── TOOL 2: Plugin details ──────────────────────────────────────────
  server.tool(
    'get_plugin_detail',
    'Complete details of a plugin: DB tables, hooks, observers, web services and dependencies',
    { pluginName: z.string().describe('Plugin name, ex: mod_forum or local_messagebroker') },
    async ({ pluginName }) => {
      const plugins = getPlugins()
      const plugin = plugins.get(pluginName)
        ?? [...plugins.values()].find(p => p.name === pluginName)

      if (!plugin) {
        return {
          content: [{
            type: 'text',
            text: `Plugin "\${pluginName}" not found. Use list_plugins to see available ones.`,
          }],
        }
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(plugin, null, 2) }],
      }
    }
  )

  // ── TOOL 3: Dependency tree ─────────────────────────────────────────
  server.tool(
    'get_plugin_dependencies',
    'Dependency tree: which plugins it requires and which depend on it',
    { pluginName: z.string().describe('Full plugin name, ex: mod_forum') },
    async ({ pluginName }) => {
      const plugins = getPlugins()
      const plugin = plugins.get(pluginName)
        ?? [...plugins.values()].find(p => p.name === pluginName)

      if (!plugin) {
        return { content: [{ type: 'text', text: `Plugin "\${pluginName}" not found` }] }
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

  // ── TOOL 4: Search by table ──────────────────────────────────────────────
  server.tool(
    'find_plugins_by_table',
    'Which plugins use a specific database table',
    { tableName: z.string().describe('Table name, ex: assign_submission') },
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

  // ── TOOL 5: Search by hook ───────────────────────────────────────────────
  server.tool(
    'find_plugins_by_hook',
    'Which plugins implement or listen to a specific hook or event',
    { hookName: z.string().describe('Name of the hook or event, ex: user_loggedin or after_config') },
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

  // ── TOOL 6: Hook usage in PHP code ─────────────────────────────────────
  server.tool(
    'get_hook_usage',
    'In which PHP files of a plugin a specific hook or class appears',
    {
      pluginName: z.string().describe('Plugin name, ex: local_messagebroker'),
      hookName: z.string().describe('Hook, class or string to search in the PHP code'),
    },
    async ({ pluginName, hookName }) => {
      const plugins = getPlugins()
      const plugin = plugins.get(pluginName)
        ?? [...plugins.values()].find(p => p.name === pluginName)

      if (!plugin) {
        return { content: [{ type: 'text', text: `Plugin "\${pluginName}" not found` }] }
      }

      console.error(`[MCP] Searching for "\${hookName}" in \${plugin.path}...`)
      const files = findHookUsageInCode(plugin.path, hookName)

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            plugin: plugin.fullname,
            searchedFor: hookName,
            foundInFiles: files.map(f => f.replace(plugin.path, '').replace(/\\\\/g, '/')),
            totalFiles: files.length,
          }, null, 2),
        }],
      }
    }
  )

  // ── TOOL 7: Integration points between two plugins ───────────────────────
  server.tool(
    'find_integration_points',
    'Analyzes two plugins and finds how they can integrate: common hooks, shared tables, dependencies and observers',
    {
      pluginA: z.string().describe('First plugin, ex: local_messagebroker'),
      pluginB: z.string().describe('Second plugin, ex: mod_assign'),
    },
    async ({ pluginA, pluginB }) => {
      const plugins = getPlugins()
      const pA = plugins.get(pluginA) ?? [...plugins.values()].find(p => p.name === pluginA)
      const pB = plugins.get(pluginB) ?? [...plugins.values()].find(p => p.name === pluginB)

      if (!pA) return { content: [{ type: 'text', text: `Plugin "\${pluginA}" not found` }] }
      if (!pB) return { content: [{ type: 'text', text: `Plugin "\${pluginB}" not found` }] }

      // Shared hooks
      const sharedHooks = pA.hooks.filter(h => pB.hooks.includes(h))

      // Shared tables (same name)
      const tablesA = new Set(pA.tables.map(t => t.name))
      const tablesB = new Set(pB.tables.map(t => t.name))
      const sharedTables = [...tablesA].filter(t => tablesB.has(t))

      // A observes events from B or vice versa
      const aObservesB = pA.observers.filter(o =>
        o.callback.includes(pB.name) || o.eventname.includes(pB.name)
      )
      const bObservesA = pB.observers.filter(o =>
        o.callback.includes(pA.name) || o.eventname.includes(pA.name)
      )

      // Direct dependencies
      const aRequiresB = Object.keys(pA.dependencies).includes(pB.fullname)
      const bRequiresA = Object.keys(pB.dependencies).includes(pA.fullname)

      // Web services one could use from another
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
                ? `Both plugins use the hooks: \${sharedHooks.join(', ')} — you can coordinate behavior here`
                : null,
              aObservesB.length > 0
                ? `\${pA.fullname} already observes events from \${pB.fullname}`
                : null,
              bObservesA.length > 0
                ? `\${pB.fullname} already observes events from \${pA.fullname}`
                : null,
              wsA.length > 0
                ? `\${pA.fullname} exposes \${wsA.length} web service(s) that \${pB.fullname} could consume`
                : null,
              wsB.length > 0
                ? `\${pB.fullname} exposes \${wsB.length} web service(s) that \${pA.fullname} could consume`
                : null,
              !aRequiresB && !bRequiresA
                ? `No declared dependency — if you need \${pA.name} to use \${pB.name}, add in version.php: \\$plugin->dependencies = ['\${pB.fullname}' => ANY_VERSION]`
                : null,
            ].filter(Boolean),
          }, null, 2),
        }],
      }
    }
  )

  // ── TOOL 8: Plugin's public API ──────────────────────────────────────
  server.tool(
    'get_plugin_api',
    'Lists the available public functions of a plugin: external lib, classes in classes/external/, and declared web services',
    { pluginName: z.string().describe('Plugin name, ex: local_messagebroker') },
    async ({ pluginName }) => {
      const plugins = getPlugins()
      const plugin = plugins.get(pluginName)
        ?? [...plugins.values()].find(p => p.name === pluginName)

      if (!plugin) {
        return { content: [{ type: 'text', text: `Plugin "\${pluginName}" not found` }] }
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

      // externallib.php — static public functions
      const extLib = path.join(plugin.path, 'externallib.php')
      if (fs.existsSync(extLib)) {
        const content = fs.readFileSync(extLib, 'utf-8')
        const matches = content.matchAll(/public\\s+static\\s+function\\s+(\\w+)/g)
        api.externalLib = [...matches].map(m => m[1])
      }

      // classes/external/*.php
      const externalDir = path.join(plugin.path, 'classes', 'external')
      if (fs.existsSync(externalDir)) {
        const files = fs.readdirSync(externalDir).filter(f => f.endsWith('.php'))
        for (const file of files) {
          const content = fs.readFileSync(path.join(externalDir, file), 'utf-8')
          const matches = content.matchAll(/public\\s+static\\s+function\\s+(\\w+)/g)
          const fns = [...matches].map(m => m[1])
          if (fns.length > 0) {
            api.externalClasses.push(`\${file}: \${fns.join(', ')}`)
          }
        }
      }

      // db/services.php content for context
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

  // ── TOOL 9: Invalidate a single plugin's cache ───────────────────────
  server.tool(
    'invalidate_plugin_cache',
    'Re-scans a specific plugin without touching the rest of the cache',
    { pluginName: z.string().describe('Full plugin name, ex: local_messagebroker') },
    async ({ pluginName }) => {
      const plugins = getPlugins()
      const plugin = plugins.get(pluginName)
        ?? [...plugins.values()].find(p => p.name === pluginName)

      if (!plugin) {
        return { content: [{ type: 'text', text: `Plugin "\${pluginName}" not found in cache` }] }
      }

      // Determine typeDir from the fullname
      const typeDir = plugin.fullname.split('_')[0] === 'mod' ? 'mod'
        : plugin.fullname.substring(0, plugin.fullname.lastIndexOf('_' + plugin.name))

      const updated = scanSinglePlugin(typeDir, plugin.type, plugin.path, plugin.name)
      pluginCache!.set(updated.fullname, updated)

      return {
        content: [{
          type: 'text',
          text: `Plugin \${updated.fullname} updated in cache. Tables: \${updated.tables.length}, Hooks: \${updated.hooks.length}, Observers: \${updated.observers.length}`,
        }],
      }
    }
  )

  // ── TOOL 10: Complete refresh ─────────────────────────────────────────────
  server.tool(
    'refresh_plugin_cache',
    'Re-scans all plugins from the filesystem',
    {},
    async () => {
      pluginCache = null
      const plugins = getPlugins()
      return {
        content: [{
          type: 'text',
          text: `Cache updated. \${plugins.size} plugins found in \${config.MOODLE_NAME}.`,
        }],
      }
    }
  )
}