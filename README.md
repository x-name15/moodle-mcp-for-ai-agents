# moodle-mcp-for-copilot

Servidor MCP (Model Context Protocol) que conecta GitHub Copilot con una o varias instancias de Moodle, dándole acceso directo a la base de datos, el filesystem de plugins, los logs, los web services, RabbitMQ y la infraestructura de microservicios.

> **¿Qué es MCP?** Es el protocolo estándar para que herramientas de IA (Copilot, Claude, etc.) puedan llamar a funciones externas de forma segura y estructurada.

---

## Herramientas disponibles

### Plugins y código
| Tool | Descripción |
|------|-------------|
| `list_plugins` | Lista todos los plugins instalados con tipo, versión y dependencias |
| `get_plugin_detail` | Detalle completo de un plugin: tablas DB, hooks, web services |
| `get_plugin_dependencies` | Árbol de dependencias de un plugin |
| `find_plugins_by_table` | Qué plugins usan una tabla específica |
| `refresh_plugin_cache` | Re-escanea el filesystem de plugins |

### Base de datos
| Tool | Descripción |
|------|-------------|
| `list_db_tables` | Todas las tablas con tamaño y filas estimadas |
| `describe_table` | Estructura de una tabla: columnas, tipos, índices |
| `count_plugin_records` | Filas reales en cada tabla de un plugin |
| `find_column` | En qué tablas existe una columna |
| `sample_table` | Muestra hasta 10 filas reales de una tabla |
| `db_overview` | Resumen general: tamaño total, tablas más grandes |

### Configuración del sitio
| Tool | Descripción |
|------|-------------|
| `get_moodle_config` | Lee `config.php` y devuelve la configuración real del sitio |

### Web Services
| Tool | Descripción |
|------|-------------|
| `list_webservices` | Servicios habilitados y tokens de acceso activos |
| `get_service_functions` | Funciones PHP registradas en un servicio |

### Usuarios y roles
| Tool | Descripción |
|------|-------------|
| `get_users_overview` | Totales, distribución por rol, admins, últimos logins |
| `find_user` | Busca un usuario y muestra sus roles y cursos |

### Logs y errores
| Tool | Descripción |
|------|-------------|
| `get_moodle_errors` | Errores recientes del log de Moodle (filtrable por horas) |
| `get_recent_activity` | Actividad reciente: logins, accesos, eventos |
| `get_php_error_log` | Últimas líneas del log de errores PHP |

### Infraestructura
| Tool | Descripción |
|------|-------------|
| `get_infra_context` | Infraestructura completa: RabbitMQ, microservicios, URLs |
| `get_rabbitmq_status` | Estado en vivo de RabbitMQ: queues, mensajes, consumers |

---

## Requisitos

- **Node.js** 20+
- Acceso de red a la **base de datos MariaDB/MySQL** de Moodle
- Acceso de red a **RabbitMQ Management API** (puerto 15672) — opcional
- Acceso al **filesystem de Moodle** (local, NFS o ruta WSL) — necesario para los tools de plugins y config

---

## Instalación

```bash
git clone <repo>
cd moodle-mcp
npm install
npm run build
```

---

## Configuración

Cada instancia de Moodle necesita su propio archivo `.env.<nombre>`.

### 1. Crear el archivo de entorno

Copia la plantilla y edítala:

```bash
cp .env.example .env.moodle41
```

Contenido del archivo:

```dotenv
MOODLE_NAME="Moodle 4.1 — Mi Instancia"
MOODLE_VERSION="4.1"

# Ruta al directorio raíz de Moodle
# En WSL desde Windows: \\wsl.localhost\Ubuntu-24.04\home\user\moodle
# En Linux/Mac: /var/www/moodle
MOODLE_ROOT_PATH="/ruta/a/moodle"

MOODLE_URL="http://localhost:8080"

DB_HOST="localhost"
DB_PORT="3306"
DB_NAME="moodle"
DB_USER="root"
DB_PASSWORD="tu_password"

RABBITMQ_HOST="localhost"
RABBITMQ_PORT="5672"
RABBITMQ_MANAGEMENT_PORT="15672"
RABBITMQ_USER="guest"
RABBITMQ_PASSWORD="guest"

MICROSERVICES_CONFIG="./data/microservices.miinstancia.json"
```

### 2. Registrar la instancia (automático)

No necesitas editar `src/config.ts`.

El servidor detecta instancias automáticamente escaneando archivos con formato `.env.<nombre>` en la raíz del proyecto. Ejemplos válidos:

- `.env.moodle41`
- `.env.moodle45`
- `.env.staging`

El valor de `MOODLE_INSTANCE` en `mcp.json` debe coincidir con `<nombre>` del archivo (`moodle41`, `moodle45`, `staging`, etc.).

Luego reconstruye: `npm run build`.

### 3. Archivo de microservicios (opcional)

El tool `get_infra_context` puede incluir microservicios externos. Crea un JSON en `data/`:

```json
[
  {
    "name": "Servicio de notificaciones",
    "description": "Envía notificaciones push via RabbitMQ",
    "type": "rabbitmq",
    "queue": "moodle.notifications",
    "events": ["course_completed", "assignment_submitted"],
    "notes": "Consumer en Node.js desplegado en el cluster"
  }
]
```

---

## Configuración en VS Code / GitHub Copilot

Crea o edita `.vscode/mcp.json` en tu workspace:

```json
{
  "servers": {
    "moodle41": {
      "type": "stdio",
      "command": "node",
      "args": ["C:/ruta/a/moodle-mcp/dist/server.js"],
      "env": {
        "MOODLE_INSTANCE": "moodle41"
      }
    },
    "moodle45": {
      "type": "stdio",
      "command": "node",
      "args": ["C:/ruta/a/moodle-mcp/dist/server.js"],
      "env": {
        "MOODLE_INSTANCE": "moodle45"
      }
    }
  }
}
```

La variable `MOODLE_INSTANCE` debe coincidir con el sufijo del archivo `.env.<nombre>`.

> Si no se define `MOODLE_INSTANCE`, el servidor usará la primera instancia detectada en orden alfabético.

---

## Ejecución

### Modo desarrollo (interactivo con selector)

```bash
npm run dev
```

Si la terminal es TTY (interactiva), mostrará un selector para elegir instancia. Útil para pruebas con `@mcp` en el chat de Copilot en una terminal separada.

### Modo producción (para MCP desde VS Code)

```bash
npm run build
node dist/server.js
```

Cuando VS Code lanza el servidor MCP, la entrada estándar no es TTY, por lo que se usará automáticamente la instancia indicada en `MOODLE_INSTANCE`.

---

## Uso en Copilot

Una vez configurado el MCP en VS Code, abre el panel de Copilot Chat y usa `@moodle41` (o el nombre del servidor) para invocar las tools. También puedes invocar los prompts predefinidos:

- **`moodle_capabilities`** — muestra todas las tools disponibles
- **`moodle_context`** — inyecta el contexto base del entorno para una conversación de desarrollo

Ejemplos de preguntas:

```
¿Qué plugins tiene este Moodle instalados?
Muéstrame la estructura de la tabla mdl_assign
¿Hay errores en el log de las últimas 2 horas?
¿Qué queues tiene RabbitMQ activas ahora mismo?
Explícame las dependencias del plugin local_messagebroker
```

---

## Estructura del proyecto

```
moodle-mcp/
├── src/
│   ├── server.ts          # Punto de entrada, selección de instancia
│   ├── config.ts          # Carga y validación del .env con Zod
│   ├── prompts/
│   │   └── templates.ts   # Prompts MCP predefinidos
│   └── tools/
│       ├── plugins.ts     # Escaneo del filesystem de plugins
│       ├── db.ts          # Herramientas de base de datos
│       ├── webservices.ts # Web services y tokens
│       ├── users.ts       # Usuarios y roles
│       ├── moodlelog.ts   # Logs y actividad reciente
│       ├── infra.ts       # Infraestructura y RabbitMQ
│       └── config.ts      # Lectura de config.php
├── data/
│   └── microservices.*.json  # Definición de microservicios por instancia
├── .env.example           # Plantilla de configuración
├── .env.moodle41          # Config instancia 4.1 (no commitear)
└── dist/                  # Build de producción
```

---

## Seguridad

- Los archivos `.env.*` están en `.gitignore` — **nunca los commitees**.
- El tool `get_moodle_config` enmascara automáticamente la contraseña de DB (`***`).
- Las queries a la DB usan **prepared statements** en todos los casos.
- La conexión MySQL tiene `multipleStatements: false` para evitar inyección SQL.
