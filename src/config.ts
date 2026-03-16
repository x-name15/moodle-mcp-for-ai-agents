import { z } from 'zod'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Raíz del proyecto portable (sirve en cualquier máquina)
// Opcionalmente se puede forzar con MOODLE_MCP_PROJECT_ROOT
export const PROJECT_ROOT = process.env.MOODLE_MCP_PROJECT_ROOT
    ? path.resolve(process.env.MOODLE_MCP_PROJECT_ROOT)
    : path.resolve(__dirname, '..')

const ConfigSchema = z.object({
    MOODLE_NAME:              z.string(),
    MOODLE_VERSION:           z.string(),
    MOODLE_ROOT_PATH:         z.string(),
    MOODLE_URL:               z.string().url(),
    DB_HOST:                  z.string(),
    DB_PORT:                  z.string().transform(Number),
    DB_NAME:                  z.string(),
    DB_USER:                  z.string(),
    DB_PASSWORD:              z.string(),
    RABBITMQ_HOST:            z.string(),
    RABBITMQ_PORT:            z.string().transform(Number),
    RABBITMQ_MANAGEMENT_PORT: z.string().transform(Number),
    RABBITMQ_USER:            z.string(),
    RABBITMQ_PASSWORD:        z.string(),
    MICROSERVICES_CONFIG:     z.string(),
})

export type MoodleConfig = z.infer<typeof ConfigSchema>

export function loadConfig(envFile: string): MoodleConfig {
    const keys = Object.keys(ConfigSchema.shape)
    keys.forEach(k => delete process.env[k])

  // Ruta absoluta siempre desde la raíz del proyecto
    const absolutePath = path.resolve(PROJECT_ROOT, envFile)
    console.error(`[MCP] Cargando config desde: ${absolutePath}`)

    const result = dotenv.config({ path: absolutePath, override: true })
    if (result.error) {
        throw new Error(`No se pudo cargar ${absolutePath}: ${result.error.message}`)
    }

    const parsed = ConfigSchema.safeParse(process.env)
    if (!parsed.success) {
        const missing = parsed.error.issues.map(i => i.path.join('.')).join(', ')
        throw new Error(`Faltan variables en ${absolutePath}: ${missing}`)
    }

    return parsed.data
}

export interface InstanceEntry {
    label: string
    value: string
    envVar: string
}

export function discoverInstances(): InstanceEntry[] {
    const files = fs.readdirSync(PROJECT_ROOT)
        .filter(file => /^\.env\.[^.]+$/.test(file) && file !== '.env.example')
        .sort()

    if (files.length === 0) {
        throw new Error(
            'No se encontró ningún archivo .env.<nombre> en la raíz del proyecto. ' +
            'Copia .env.example a .env.moodle41 (o similar) y configúralo.'
        )
    }

    return files.map((file) => {
        const envVar = file.replace('.env.', '')
        let label = envVar

        try {
            const content = fs.readFileSync(path.join(PROJECT_ROOT, file), 'utf-8')
            const moodleNameMatch = content.match(/^MOODLE_NAME\s*=\s*["']?([^"'\n]+)["']?/m)
            if (moodleNameMatch?.[1]) {
                label = moodleNameMatch[1].trim()
            }
        } catch {
            // fallback: usar el nombre del archivo
        }

        return {
            label,
            value: file,
            envVar,
        }
    })
}