import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import fs from 'fs'
import path from 'path'
import type { MoodleConfig } from '../config.js'

// ── Parsers ───────────────────────────────────────────────────────────────────

// Extrae bloques de versión de upgrade.php
// Busca patrones como: if ($oldversion < 2023010100) { ... }
function parseUpgradePhp(content: string): UpgradeStep[] {
  const steps: UpgradeStep[] = []

  const blockMatches = content.matchAll(
    /if\s*\(\s*\$oldversion\s*<\s*(\d+)\s*\)\s*\{([\s\S]*?)(?=if\s*\(\s*\$oldversion|return true)/g
  )

  for (const [, version, body] of blockMatches) {
    const changes: string[] = []

    // Tablas añadidas
    const addTable = body.matchAll(/install_one_main_table\s*\(\s*['"]([^'"]+)['"]/g)
    for (const [, t] of addTable) changes.push(`ADD TABLE: ${t}`)

    const createTable = body.matchAll(/create_table\s*\(\s*\$table\s*\)[\s\S]{0,200}NAME\s*=\s*['"]([^'"]+)['"]/g)
    for (const [, t] of createTable) changes.push(`CREATE TABLE: ${t}`)

    // Tablas eliminadas
    const dropTable = body.matchAll(/drop_table[\s\S]{0,100}NAME\s*=\s*['"]([^'"]+)['"]/g)
    for (const [, t] of dropTable) changes.push(`DROP TABLE: ${t}`)

    // Campos añadidos
    const addField = body.matchAll(/add_field[\s\S]{0,200}NAME\s*=\s*['"]([^'"]+)['"]/g)
    for (const [, f] of addField) changes.push(`ADD FIELD: ${f}`)

    // Campos eliminados
    const dropField = body.matchAll(/drop_field[\s\S]{0,200}NAME\s*=\s*['"]([^'"]+)['"]/g)
    for (const [, f] of dropField) changes.push(`DROP FIELD: ${f}`)

    // Campos modificados
    const changeField = body.matchAll(/change_field[\s\S]{0,200}NAME\s*=\s*['"]([^'"]+)['"]/g)
    for (const [, f] of changeField) changes.push(`MODIFY FIELD: ${f}`)

    // Índices
    const addIndex = body.matchAll(/add_index[\s\S]{0,200}NAME\s*=\s*['"]([^'"]+)['"]/g)
    for (const [, i] of addIndex) changes.push(`ADD INDEX: ${i}`)

    const dropIndex = body.matchAll(/drop_index[\s\S]{0,200}NAME\s*=\s*['"]([^'"]+)['"]/g)
    for (const [, i] of dropIndex) changes.push(`DROP INDEX: ${i}`)

    // Savepoint (confirma que el bloque es real)
    const hasSavepoint = body.includes('savepoint')

    if (changes.length > 0 || hasSavepoint) {
      steps.push({
        version: parseInt(version),
        dbChanges: changes,
        rawSnippet: body.trim().slice(0, 300),
      })
    }
  }

  return steps.sort((a, b) => a.version - b.version)
}

// Extrae entradas de CHANGES.md / CHANGELOG.md
function parseChangelog(content: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = []

  // Formato común: ## [1.2.0] - 2023-01-15  o  ## Version 1.2.0
  const sectionMatches = content.matchAll(
    /^#{1,3}\s+(?:Version\s+)?v?(\d+[\d.]+)(?:\s*[-–]\s*(\d{4}-\d{2}-\d{2}))?([\s\S]*?)(?=^#{1,3}\s+(?:Version\s+)?v?\d|\s*$)/gm
  )

  for (const [, version, date, body] of sectionMatches) {
    const breaking: string[] = []
    const added: string[] = []
    const changed: string[] = []
    const fixed: string[] = []

    const lines = body.split('\n').map(l => l.trim()).filter(Boolean)
    let currentSection = 'changed'

    for (const line of lines) {
      const lower = line.toLowerCase()
      if (lower.includes('breaking') || lower.includes('⚠')) currentSection = 'breaking'
      else if (lower.startsWith('### added') || lower === '**added**') currentSection = 'added'
      else if (lower.startsWith('### changed') || lower === '**changed**') currentSection = 'changed'
      else if (lower.startsWith('### fixed') || lower === '**fixed**') currentSection = 'fixed'
      else if (line.startsWith('-') || line.startsWith('*')) {
        const text = line.replace(/^[-*]\s*/, '')
        if (currentSection === 'breaking') breaking.push(text)
        else if (currentSection === 'added') added.push(text)
        else if (currentSection === 'fixed') fixed.push(text)
        else changed.push(text)
      }
    }

    if (breaking.length + added.length + changed.length + fixed.length > 0) {
      entries.push({ version, date: date ?? null, breaking, added, changed, fixed })
    }
  }

  return entries
}

// Detecta breaking changes en upgrade.php analizando el impacto
function detectBreakingChanges(steps: UpgradeStep[], pluginFullname: string): BreakingChange[] {
  const breaking: BreakingChange[] = []

  for (const step of steps) {
    for (const change of step.dbChanges) {
      // DROP es siempre breaking
      if (change.startsWith('DROP TABLE') || change.startsWith('DROP FIELD')) {
        breaking.push({
          version: step.version,
          type: 'db_removal',
          description: change,
          impact: `Cualquier plugin que consulte esta tabla/campo directamente se romperá`,
          severity: 'high',
        })
      }
      // MODIFY FIELD puede ser breaking
      if (change.startsWith('MODIFY FIELD')) {
        breaking.push({
          version: step.version,
          type: 'db_modification',
          description: change,
          impact: `Queries que asuman el tipo o tamaño original pueden fallar`,
          severity: 'medium',
        })
      }
    }
  }

  return breaking
}

// ── Interfaces ────────────────────────────────────────────────────────────────

interface UpgradeStep {
  version: number
  dbChanges: string[]
  rawSnippet: string
}

interface ChangelogEntry {
  version: string
  date: string | null
  breaking: string[]
  added: string[]
  changed: string[]
  fixed: string[]
}

interface BreakingChange {
  version: number
  type: string
  description: string
  impact: string
  severity: 'high' | 'medium' | 'low'
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function findPluginPath(rootPath: string, pluginName: string): string | null {
  const parts = pluginName.split('_')
  if (parts.length < 2) return null
  const typeDir = parts[0]
  const name = parts.slice(1).join('_')

  // blocks puede estar como "blocks" o "block"
  const candidates = [
    path.join(rootPath, typeDir, name),
    path.join(rootPath, typeDir === 'block' ? 'blocks' : typeDir, name),
  ]
  return candidates.find(c => fs.existsSync(c)) ?? null
}

function readIfExists(filePath: string): string | null {
  try {
    return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : null
  } catch {
    return null
  }
}

// ── Registro de tools ─────────────────────────────────────────────────────────

export async function registerChangelogTools(server: McpServer, config: MoodleConfig) {

  // ── Tool 1: Historial completo de un plugin ───────────────────────────────
  server.tool(
    'get_plugin_history',
    'Muestra el historial completo de cambios de un plugin: upgrade.php, CHANGELOG.md y CHANGES.md',
    {
      pluginName: z.string().describe('Nombre completo del plugin, ej: local_messagebroker'),
    },
    async ({ pluginName }) => {
      const pluginPath = findPluginPath(config.MOODLE_ROOT_PATH, pluginName)
      if (!pluginPath) {
        return { content: [{ type: 'text', text: `Plugin "${pluginName}" no encontrado` }] }
      }

      // Leer todos los archivos de historial disponibles
      const upgradeContent  = readIfExists(path.join(pluginPath, 'db', 'upgrade.php'))
      const changelogContent = readIfExists(path.join(pluginPath, 'CHANGELOG.md'))
        ?? readIfExists(path.join(pluginPath, 'CHANGES.md'))
        ?? readIfExists(path.join(pluginPath, 'changelog.md'))
        ?? readIfExists(path.join(pluginPath, 'changes.md'))
      const versionContent  = readIfExists(path.join(pluginPath, 'version.php'))

      // Versión actual desde version.php
      const currentVersion = versionContent
        ?.match(/\$plugin->version\s*=\s*(\d+)/)?.[1] ?? 'unknown'
      const releaseVersion = versionContent
        ?.match(/\$plugin->release\s*=\s*['"]([^'"]+)['"]/)?.[1] ?? 'unknown'

      const upgradeSteps = upgradeContent ? parseUpgradePhp(upgradeContent) : []
      const changelogEntries = changelogContent ? parseChangelog(changelogContent) : []
      const breakingChanges = detectBreakingChanges(upgradeSteps, pluginName)

      const availableFiles: string[] = []
      if (upgradeContent) availableFiles.push('db/upgrade.php')
      if (changelogContent) availableFiles.push('CHANGELOG.md / CHANGES.md')

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            plugin: pluginName,
            moodle: config.MOODLE_NAME,
            currentVersion,
            releaseVersion,
            availableHistoryFiles: availableFiles,
            totalUpgradeSteps: upgradeSteps.length,
            upgradeHistory: upgradeSteps,
            changelog: changelogEntries,
            breakingChanges,
            summary: {
              hasUpgradeHistory: upgradeSteps.length > 0,
              hasChangelog: changelogEntries.length > 0,
              hasBreakingChanges: breakingChanges.length > 0,
              highSeverityCount: breakingChanges.filter(b => b.severity === 'high').length,
            },
          }, null, 2),
        }],
      }
    }
  )

  // ── Tool 2: Cambios de DB entre versiones ─────────────────────────────────
  server.tool(
    'get_db_upgrade_steps',
    'Muestra exactamente qué cambios de base de datos hizo un plugin en upgrade.php, filtrable por versión',
    {
      pluginName: z.string().describe('Nombre completo del plugin, ej: local_messagebroker'),
      fromVersion: z.number().optional().describe('Versión desde la que filtrar, ej: 2022010100'),
    },
    async ({ pluginName, fromVersion }) => {
      const pluginPath = findPluginPath(config.MOODLE_ROOT_PATH, pluginName)
      if (!pluginPath) {
        return { content: [{ type: 'text', text: `Plugin "${pluginName}" no encontrado` }] }
      }

      const upgradeContent = readIfExists(path.join(pluginPath, 'db', 'upgrade.php'))
      if (!upgradeContent) {
        return {
          content: [{
            type: 'text',
            text: `El plugin "${pluginName}" no tiene db/upgrade.php — no ha tenido migraciones de BD`,
          }],
        }
      }

      let steps = parseUpgradePhp(upgradeContent)
      if (fromVersion) {
        steps = steps.filter(s => s.version > fromVersion)
      }

      const allChanges = steps.flatMap(s =>
        s.dbChanges.map(c => ({ version: s.version, change: c }))
      )

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            plugin: pluginName,
            moodle: config.MOODLE_NAME,
            filteredFrom: fromVersion ?? 'beginning',
            totalSteps: steps.length,
            totalDbChanges: allChanges.length,
            changesByVersion: steps.map(s => ({
              version: s.version,
              changes: s.dbChanges,
            })),
            allChangesFlat: allChanges,
          }, null, 2),
        }],
      }
    }
  )

  // ── Tool 3: Breaking changes que afectan a otros plugins ──────────────────
  server.tool(
    'get_breaking_changes',
    'Detecta si un plugin tiene breaking changes en su historial que puedan afectar a otros plugins que dependen de él',
    {
      pluginName: z.string().describe('Plugin a analizar, ej: local_messagebroker'),
    },
    async ({ pluginName }) => {
      const pluginPath = findPluginPath(config.MOODLE_ROOT_PATH, pluginName)
      if (!pluginPath) {
        return { content: [{ type: 'text', text: `Plugin "${pluginName}" no encontrado` }] }
      }

      const upgradeContent  = readIfExists(path.join(pluginPath, 'db', 'upgrade.php'))
      const changelogContent = readIfExists(path.join(pluginPath, 'CHANGELOG.md'))
        ?? readIfExists(path.join(pluginPath, 'CHANGES.md'))

      const steps = upgradeContent ? parseUpgradePhp(upgradeContent) : []
      const breaking = detectBreakingChanges(steps, pluginName)
      const changelogEntries = changelogContent ? parseChangelog(changelogContent) : []
      const changelogBreaking = changelogEntries.flatMap(e =>
        e.breaking.map(b => ({
          version: e.version,
          date: e.date,
          description: b,
          source: 'CHANGELOG',
        }))
      )

      // Buscar qué otros plugins dependen de este
      // (reutilizamos la lógica de scaneo básico)
      const dependents: string[] = []
      const pluginTypeDirs = ['mod', 'blocks', 'local', 'auth', 'enrol', 'report']
      for (const typeDir of pluginTypeDirs) {
        const typePath = path.join(config.MOODLE_ROOT_PATH, typeDir)
        if (!fs.existsSync(typePath)) continue
        try {
          const entries = fs.readdirSync(typePath, { withFileTypes: true })
          for (const entry of entries) {
            if (!entry.isDirectory()) continue
            const versionFile = path.join(typePath, entry.name, 'version.php')
            const content = readIfExists(versionFile)
            if (content?.includes(pluginName)) {
              dependents.push(`${typeDir}_${entry.name}`)
            }
          }
        } catch { }
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            plugin: pluginName,
            moodle: config.MOODLE_NAME,
            breakingChangesFromUpgrade: breaking,
            breakingChangesFromChangelog: changelogBreaking,
            pluginsThatDependOnThis: dependents,
            riskAssessment: {
              hasHighRisk: breaking.some(b => b.severity === 'high'),
              affectedDependents: dependents.length,
              recommendation: breaking.length > 0 && dependents.length > 0
                ? `⚠ Este plugin tiene ${breaking.length} breaking change(s) y ${dependents.length} plugin(s) dependen de él. Revisa ${dependents.join(', ')} antes de actualizar.`
                : breaking.length > 0
                  ? `Este plugin tiene breaking changes pero ningún plugin declarado depende de él directamente.`
                  : `No se detectaron breaking changes en el historial de este plugin.`,
            },
          }, null, 2),
        }],
      }
    }
  )

  // ── Tool 4: Escaneo de todos los plugins con upgrade.php ──────────────────
  server.tool(
    'scan_all_upgrade_histories',
    'Escanea todos los plugins que tienen db/upgrade.php y devuelve un resumen de cuáles tienen breaking changes',
    {},
    async () => {
      const results: {
        plugin: string
        hasUpgrade: boolean
        upgradeSteps: number
        breakingChanges: number
        highSeverity: number
      }[] = []

      const pluginTypeDirs = ['mod', 'blocks', 'local', 'auth', 'enrol', 'report', 'admin']

      for (const typeDir of pluginTypeDirs) {
        const typePath = path.join(config.MOODLE_ROOT_PATH, typeDir)
        if (!fs.existsSync(typePath)) continue

        try {
          const entries = fs.readdirSync(typePath, { withFileTypes: true })
          for (const entry of entries) {
            if (!entry.isDirectory()) continue

            const fullname = `${typeDir}_${entry.name}`
            const upgradePath = path.join(typePath, entry.name, 'db', 'upgrade.php')
            const upgradeContent = readIfExists(upgradePath)

            if (!upgradeContent) continue

            const steps = parseUpgradePhp(upgradeContent)
            const breaking = detectBreakingChanges(steps, fullname)

            results.push({
              plugin: fullname,
              hasUpgrade: true,
              upgradeSteps: steps.length,
              breakingChanges: breaking.length,
              highSeverity: breaking.filter(b => b.severity === 'high').length,
            })
          }
        } catch { }
      }

      const withBreaking = results.filter(r => r.breakingChanges > 0)
      const highRisk = results.filter(r => r.highSeverity > 0)

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            moodle: config.MOODLE_NAME,
            totalPluginsWithUpgrade: results.length,
            pluginsWithBreakingChanges: withBreaking.length,
            pluginsWithHighRisk: highRisk.length,
            highRiskPlugins: highRisk.map(r => ({
              plugin: r.plugin,
              highSeverityCount: r.highSeverity,
            })),
            allResults: results.sort((a, b) => b.breakingChanges - a.breakingChanges),
          }, null, 2),
        }],
      }
    }
  )
}