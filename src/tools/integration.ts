import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import fs from 'fs'
import path from 'path'
import type { MoodleConfig } from '../config.js'

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
            const triggerMatches = content.matchAll(
              /\\\\([a-zA-Z0-9_\\\\]+)::create\\s*\\(|trigger_event\\s*\\(\\s*['"]([^'"]+)['"]/g
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

function buildObserverMap(rootPath: string): Map<string, string[]> {
  const map = new Map<string, string[]>()

  const scanObserversFile = (pluginName: string, observersPath: string) => {
    if (!fs.existsSync(observersPath)) return
    try {
      const content = fs.readFileSync(observersPath, 'utf-8')
      const matches = content.matchAll(/'eventname'\\s*=>\\s*'([^']+)'/g)
      for (const [, eventname] of matches) {
        const current = map.get(eventname) ?? []
        current.push(pluginName)
        map.set(eventname, current)
      }
    } catch { }
  }

  const pluginTypeDirs = ['mod', 'blocks', 'local', 'auth', 'enrol', 'report', 'admin']
  for (const typeDir of pluginTypeDirs) {
    const typePath = path.join(rootPath, typeDir)
    if (!fs.existsSync(typePath)) continue
    try {
      const entries = fs.readdirSync(typePath, { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const fullname = `\${typeDir}_\${entry.name}`
        const observersPath = path.join(typePath, entry.name, 'db', 'observers.php')
        scanObserversFile(fullname, observersPath)
      }
    } catch { }
  }

  return map
}

export async function registerIntegrationTools(server: McpServer, config: MoodleConfig) {

  // ── suggest_hook_integration ──────────────────────────────────────────────
  server.tool(
    'suggest_hook_integration',
    'Suggests how to integrate two plugins using Moodle hooks and events. Analyzes which events A dispatches that B could listen to, and vice versa.',
    {
      pluginA: z.string().describe('Emitting plugin, ex: mod_assign'),
      pluginB: z.string().describe('Receiving plugin, ex: local_messagebroker'),
    },
    async ({ pluginA, pluginB }) => {
      const findPluginPath = (fullname: string): string | null => {
        const parts = fullname.split('_')
        if (parts.length < 2) return null
        const typeDir = parts[0]
        const name = parts.slice(1).join('_')
        const candidate = path.join(config.MOODLE_ROOT_PATH, typeDir, name)
        return fs.existsSync(candidate) ? candidate : null
      }

      const pathA = findPluginPath(pluginA)
      const pathB = findPluginPath(pluginB)

      if (!pathA) return { content: [{ type: 'text', text: `Could not find path for "\${pluginA}"` }] }
      if (!pathB) return { content: [{ type: 'text', text: `Could not find path for "\${pluginB}"` }] }

      console.error(`[MCP] Analyzing hooks between \${pluginA} and \${pluginB}...`)

      const eventsFromA = getEmittedEvents(pathA)
      const eventsFromB = getEmittedEvents(pathB)

      const observersA = fs.existsSync(path.join(pathA, 'db', 'observers.php'))
        ? fs.readFileSync(path.join(pathA, 'db', 'observers.php'), 'utf-8')
        : null
      const observersB = fs.existsSync(path.join(pathB, 'db', 'observers.php'))
        ? fs.readFileSync(path.join(pathB, 'db', 'observers.php'), 'utf-8')
        : null

      const bAlreadyListensA = observersB ? eventsFromA.some(e => observersB.includes(e)) : false
      const aAlreadyListensB = observersA ? eventsFromB.some(e => observersA.includes(e)) : false

      const globalMap = buildObserverMap(config.MOODLE_ROOT_PATH)
      const otherListenersOfA = eventsFromA.flatMap(e =>
        (globalMap.get(e) ?? []).filter(p => p !== pluginA && p !== pluginB)
          .map(p => ({ event: e, plugin: p }))
      )

      const suggestions: string[] = []

      if (eventsFromA.length > 0 && !bAlreadyListensA) {
        suggestions.push(
          `"\${pluginB}" can listen to these events from "\${pluginA}" by adding to db/observers.php:\\n` +
          eventsFromA.slice(0, 3).map(e =>
            `  [\\n    'eventname' => '\${e}',\\n    'callback'  => '\\\\\${pluginB.replace('_', '\\\\')}\\\\observer::on_\${e.split('\\\\').pop()?.toLowerCase() ?? 'event'}',\\n  ]`
          ).join(',\\n')
        )
      }

      if (eventsFromB.length > 0 && !aAlreadyListensB) {
        suggestions.push(
          `"\${pluginA}" can listen to these events from "\${pluginB}" by adding to db/observers.php:\\n` +
          eventsFromB.slice(0, 3).map(e =>
            `  [\\n    'eventname' => '\${e}',\\n    'callback'  => '\\\\\${pluginA.replace('_', '\\\\')}\\\\observer::on_\${e.split('\\\\').pop()?.toLowerCase() ?? 'event'}',\\n  ]`
          ).join(',\\n')
        )
      }

      if (eventsFromA.length === 0 && eventsFromB.length === 0) {
        suggestions.push(
          `Neither dispatches automatically detectable events. ` +
          `Use get_hook_usage to search for event classes manually, ` +
          `or integrate them via Web Service with get_plugin_api.`
        )
      }

      if (bAlreadyListensA) suggestions.push(`"\${pluginB}" already listens to events from "\${pluginA}".`)
      if (aAlreadyListensB) suggestions.push(`"\${pluginA}" already listens to events from "\${pluginB}".`)

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            pluginA,
            pluginB,
            eventsDispatchedByA: eventsFromA,
            eventsDispatchedByB: eventsFromB,
            currentRelation: { bListensToA: bAlreadyListensA, aListensToB: aAlreadyListensB },
            otherPluginsListeningToA: otherListenersOfA,
            suggestions,
            nextSteps: [
              'Use get_plugin_api to see available WS for each plugin',
              'Use find_integration_points to see shared tables and hooks',
              'Use get_hook_usage to search for specific event classes in the code',
            ],
          }, null, 2),
        }],
      }
    }
  )

  // ── generate_plugin_scaffold ──────────────────────────────────────────────
  server.tool(
    'generate_plugin_scaffold',
    'Generates the complete file structure for a new Moodle plugin ready for development.',
    {
      pluginType: z.enum(['local', 'mod', 'block']).describe('Plugin type'),
      pluginName: z.string().describe('Short name without prefix, ex: mynotifications'),
      pluginPurpose: z.string().describe('What it is used for, ex: manages push notifications'),
      features: z.array(
        z.enum(['db', 'webservices', 'observers', 'cron', 'settings', 'capabilities'])
      ).describe('Features to include'),
    },
    async ({ pluginType, pluginName, features, pluginPurpose }) => {
      const fullname = `\${pluginType}_\${pluginName}`
      const now = new Date()
      const versionDate = `\${now.getFullYear()}\${String(now.getMonth() + 1).padStart(2, '0')}\${String(now.getDate()).padStart(2, '0')}00`

      const moodleVersionMap: Record<string, string> = {
        '4.1': '2022112800',
        '4.2': '2023042400',
        '4.3': '2023100900',
        '4.4': '2024042200',
        '4.5': '2024100700',
      }
      const requiresVersion = moodleVersionMap[config.MOODLE_VERSION] ?? '2022112800'

      const files: Record<string, string> = {}

      // ── version.php ───────────────────────────────────────────────────────
      files['version.php'] = `<?php
defined('MOODLE_INTERNAL') || die();

$plugin->component = '\${fullname}';
$plugin->version   = \${versionDate};
$plugin->requires  = \${requiresVersion};
$plugin->maturity  = MATURITY_ALPHA;
$plugin->release   = '1.0.0';
`
      // ── db/install.xml ────────────────────────────────────────────────────
      if (features.includes('db')) {
        files['db/install.xml'] = `<?xml version="1.0" encoding="UTF-8" ?>
<XMLDB PATH="\${pluginType}/\${pluginName}/db" VERSION="\${versionDate}"
    COMMENT="XMLDB file for Moodle \${pluginType}/\${pluginName}"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:noNamespaceSchemaLocation="../../../lib/xmldb/xmldb.xsd">
  <TABLES>
    <TABLE NAME="\${fullname}_items" COMMENT="Main table for \${fullname}">
      <FIELDS>
        <FIELD NAME="id"           TYPE="int"  LENGTH="10"  NOTNULL="true" SEQUENCE="true"/>
        <FIELD NAME="courseid"     TYPE="int"  LENGTH="10"  NOTNULL="true" DEFAULT="0"/>
        <FIELD NAME="userid"       TYPE="int"  LENGTH="10"  NOTNULL="true" DEFAULT="0"/>
        <FIELD NAME="name"         TYPE="char" LENGTH="255" NOTNULL="true" DEFAULT=""/>
        <FIELD NAME="status"       TYPE="int"  LENGTH="2"   NOTNULL="true" DEFAULT="0"/>
        <FIELD NAME="timecreated"  TYPE="int"  LENGTH="10"  NOTNULL="true" DEFAULT="0"/>
        <FIELD NAME="timemodified" TYPE="int"  LENGTH="10"  NOTNULL="true" DEFAULT="0"/>
      </FIELDS>
      <KEYS>
        <KEY NAME="primary"  TYPE="primary" FIELDS="id"/>
        <KEY NAME="courseid" TYPE="foreign" FIELDS="courseid" REFTABLE="course" REFFIELDS="id"/>
        <KEY NAME="userid"   TYPE="foreign" FIELDS="userid"   REFTABLE="user"   REFFIELDS="id"/>
      </KEYS>
      <INDEXES>
        <INDEX NAME="status"          UNIQUE="false" FIELDS="status"/>
        <INDEX NAME="courseid_userid" UNIQUE="false" FIELDS="courseid, userid"/>
      </INDEXES>
    </TABLE>
  </TABLES>
</XMLDB>
`
        files['db/upgrade.php'] = `<?php
defined('MOODLE_INTERNAL') || die();

function xmldb_\${fullname}_upgrade($oldversion) {
    global $DB;
    $dbman = $DB->get_manager();
    // Add upgrade steps here as the plugin evolves.
    return true;
}
`
      }

      // ── db/access.php ─────────────────────────────────────────────────────
      if (features.includes('capabilities')) {
        files['db/access.php'] = `<?php
defined('MOODLE_INTERNAL') || die();

$capabilities = [
    '\${fullname}:view' => [
        'riskbitmask'  => RISK_PERSONAL,
        'captype'      => 'read',
        'contextlevel' => CONTEXT_COURSE,
        'archetypes'   => [
            'student'        => CAP_ALLOW,
            'teacher'        => CAP_ALLOW,
            'editingteacher' => CAP_ALLOW,
            'manager'        => CAP_ALLOW,
        ],
    ],
    '\${fullname}:manage' => [
        'riskbitmask'  => RISK_CONFIG,
        'captype'      => 'write',
        'contextlevel' => CONTEXT_COURSE,
        'archetypes'   => [
            'editingteacher' => CAP_ALLOW,
            'manager'        => CAP_ALLOW,
        ],
    ],
];
`
      }

      // ── db/services.php + classes/external ────────────────────────────────
      if (features.includes('webservices')) {
        files['db/services.php'] = `<?php
defined('MOODLE_INTERNAL') || die();

$functions = [
    '\${fullname}_get_items' => [
        'classname'    => '\\\\\\\\\${fullname}\\\\\\\\external\\\\\\\\get_items',
        'description'  => 'Returns items for a given course',
        'type'         => 'read',
        'ajax'         => true,
        'capabilities' => '\${fullname}:view',
    ],
    '\${fullname}_create_item' => [
        'classname'    => '\\\\\\\\\${fullname}\\\\\\\\external\\\\\\\\create_item',
        'description'  => 'Creates a new item',
        'type'         => 'write',
        'ajax'         => true,
        'capabilities' => '\${fullname}:manage',
    ],
];

$services = [
    '\${fullname} service' => [
        'functions'       => ['\${fullname}_get_items', '\${fullname}_create_item'],
        'restrictedusers' => 0,
        'enabled'         => 1,
        'shortname'       => '\${fullname}_service',
    ],
];
`
        files['classes/external/get_items.php'] = `<?php
namespace \${fullname}\\external;

defined('MOODLE_INTERNAL') || die();
require_once($CFG->libdir . '/externallib.php');

class get_items extends \\external_api {

    public static function execute_parameters(): \\external_function_parameters {
        return new \\external_function_parameters([
            'courseid' => new \\external_value(PARAM_INT, 'Course ID'),
        ]);
    }

    public static function execute(int $courseid): array {
        global $DB;
        $params  = self::validate_parameters(self::execute_parameters(), ['courseid' => $courseid]);
        $context = \\context_course::instance($params['courseid']);
        self::validate_context($context);
        require_capability('\${fullname}:view', $context);

        return array_values($DB->get_records('\${fullname}_items', ['courseid' => $params['courseid']]));
    }

    public static function execute_returns(): \\external_multiple_structure {
        return new \\external_multiple_structure(
            new \\external_single_structure([
                'id'           => new \\external_value(PARAM_INT,  'Item ID'),
                'courseid'     => new \\external_value(PARAM_INT,  'Course ID'),
                'userid'       => new \\external_value(PARAM_INT,  'User ID'),
                'name'         => new \\external_value(PARAM_TEXT, 'Item name'),
                'status'       => new \\external_value(PARAM_INT,  'Status'),
                'timecreated'  => new \\external_value(PARAM_INT,  'Time created'),
                'timemodified' => new \\external_value(PARAM_INT,  'Time modified'),
            ])
        );
    }
}
`
        files['classes/external/create_item.php'] = `<?php
namespace \${fullname}\\external;

defined('MOODLE_INTERNAL') || die();
require_once($CFG->libdir . '/externallib.php');

class create_item extends \\external_api {

    public static function execute_parameters(): \\external_function_parameters {
        return new \\external_function_parameters([
            'courseid' => new \\external_value(PARAM_INT,  'Course ID'),
            'name'     => new \\external_value(PARAM_TEXT, 'Item name'),
        ]);
    }

    public static function execute(int $courseid, string $name): array {
        global $DB, $USER;
        $params  = self::validate_parameters(self::execute_parameters(), ['courseid' => $courseid, 'name' => $name]);
        $context = \\context_course::instance($params['courseid']);
        self::validate_context($context);
        require_capability('\${fullname}:manage', $context);

        $record = (object)[
            'courseid'     => $params['courseid'],
            'userid'       => $USER->id,
            'name'         => $params['name'],
            'status'       => 0,
            'timecreated'  => time(),
            'timemodified' => time(),
        ];
        $record->id = $DB->insert_record('\${fullname}_items', $record);
        return (array) $record;
    }

    public static function execute_returns(): \\external_single_structure {
        return new \\external_single_structure([
            'id'           => new \\external_value(PARAM_INT,  'Item ID'),
            'courseid'     => new \\external_value(PARAM_INT,  'Course ID'),
            'userid'       => new \\external_value(PARAM_INT,  'User ID'),
            'name'         => new \\external_value(PARAM_TEXT, 'Item name'),
            'status'       => new \\external_value(PARAM_INT,  'Status'),
            'timecreated'  => new \\external_value(PARAM_INT,  'Time created'),
            'timemodified' => new \\external_value(PARAM_INT,  'Time modified'),
        ]);
    }
}
`
      }

      // ── db/observers.php + classes/observer.php ───────────────────────────
      if (features.includes('observers')) {
        files['db/observers.php'] = `<?php
defined('MOODLE_INTERNAL') || die();

$observers = [
    [
        'eventname' => '\\\\\\\\core\\\\\\\\event\\\\\\\\course_completed',
        'callback'  => '\\\\\\\\\${fullname}\\\\\\\\observer::on_course_completed',
    ],
    [
        'eventname' => '\\\\\\\\mod_assign\\\\\\\\event\\\\\\\\assessable_submitted',
        'callback'  => '\\\\\\\\\${fullname}\\\\\\\\observer::on_assignment_submitted',
    ],
];
`
        files['classes/observer.php'] = `<?php
namespace \${fullname};

defined('MOODLE_INTERNAL') || die();

class observer {

    public static function on_course_completed(\\core\\event\\course_completed $event): void {
        global $DB;
        // $event->courseid, $event->userid, $event->relateduserid
    }

    public static function on_assignment_submitted(\\core\\event\\base $event): void {
        global $DB;
        $data = $event->get_data();
        // Add your logic here
    }
}
`
      }

      // ── db/tasks.php + classes/task/process_items.php ─────────────────────
      if (features.includes('cron')) {
        files['db/tasks.php'] = `<?php
defined('MOODLE_INTERNAL') || die();

$tasks = [
    [
        'classname' => '\\\\\\\\\${fullname}\\\\\\\\task\\\\\\\\process_items',
        'blocking'  => 0,
        'minute'    => '*/5',
        'hour'      => '*',
        'day'       => '*',
        'month'     => '*',
        'dayofweek' => '*',
        'disabled'  => 0,
    ],
];
`
        files['classes/task/process_items.php'] = `<?php
namespace \${fullname}\\task;

defined('MOODLE_INTERNAL') || die();

class process_items extends \\core\\task\\scheduled_task {

    public function get_name(): string {
        return get_string('task_process_items', '\${fullname}');
    }

    public function execute(): void {
        global $DB;
        $pending = $DB->get_records('\${fullname}_items', ['status' => 0], 'timecreated ASC', '*', 0, 100);

        foreach ($pending as $item) {
            try {
                $DB->set_field('\${fullname}_items', 'status',       1,      ['id' => $item->id]);
                $DB->set_field('\${fullname}_items', 'timemodified', time(), ['id' => $item->id]);
            } catch (\\Exception $e) {
                mtrace("Error processing item {$item->id}: " . $e->getMessage());
            }
        }
        mtrace('Processed ' . count($pending) . ' items for \${fullname}');
    }
}
`
      }

      // ── settings.php ──────────────────────────────────────────────────────
      if (features.includes('settings')) {
        files['settings.php'] = `<?php
defined('MOODLE_INTERNAL') || die();

if ($hassiteconfig) {
    $settings = new admin_settingpage('\${fullname}', get_string('pluginname', '\${fullname}'));
    $ADMIN->add('localplugins', $settings);

    $settings->add(new admin_setting_configtext(
        '\${fullname}/apiurl',
        get_string('setting_apiurl', '\${fullname}'),
        get_string('setting_apiurl_desc', '\${fullname}'),
        '',
        PARAM_URL
    ));

    $settings->add(new admin_setting_configcheckbox(
        '\${fullname}/enabled',
        get_string('setting_enabled', '\${fullname}'),
        get_string('setting_enabled_desc', '\${fullname}'),
        1
    ));
}
`
      }

      // ── lang/en/<fullname>.php ────────────────────────────────────────────
      const langStrings: string[] = [
        `$string['pluginname']      = '\${pluginName}';`,
        `$string['pluginname_desc'] = '\${pluginPurpose}';`,
      ]
      if (features.includes('capabilities')) {
        langStrings.push(`$string['\${fullname}:view']   = 'View \${pluginName} items';`)
        langStrings.push(`$string['\${fullname}:manage'] = 'Manage \${pluginName} items';`)
      }
      if (features.includes('cron')) {
        langStrings.push(`$string['task_process_items'] = 'Process pending \${pluginName} items';`)
      }
      if (features.includes('settings')) {
        langStrings.push(`$string['setting_apiurl']          = 'API URL';`)
        langStrings.push(`$string['setting_apiurl_desc']     = 'External API endpoint URL';`)
        langStrings.push(`$string['setting_enabled']         = 'Enable \${pluginName}';`)
        langStrings.push(`$string['setting_enabled_desc']    = 'Enable or disable \${pluginName} functionality';`)
      }

      files[`lang/en/\${fullname}.php`] = `<?php
defined('MOODLE_INTERNAL') || die();

\${langStrings.join('\\n')}
`

      // ── index.php (local y block) ─────────────────────────────────────────
      if (pluginType === 'local') {
        files['index.php'] = `<?php
require_once(__DIR__ . '/../../config.php');
require_login();

$context = context_system::instance();
\${features.includes('capabilities') ? `require_capability('\${fullname}:view', $context);` : ''}

$PAGE->set_url(new moodle_url('/local/\${pluginName}/index.php'));
$PAGE->set_context($context);
$PAGE->set_title(get_string('pluginname', '\${fullname}'));
$PAGE->set_heading(get_string('pluginname', '\${fullname}'));

echo $OUTPUT->header();
echo $OUTPUT->heading(get_string('pluginname', '\${fullname}'));
// Add your content here
echo $OUTPUT->footer();
`
      }

      if (pluginType === 'block') {
        files['block_' + pluginName + '.php'] = `<?php
defined('MOODLE_INTERNAL') || die();

class block_\${pluginName} extends block_base {

    public function init(): void {
        $this->title = get_string('pluginname', '\${fullname}');
    }

    public function get_content(): stdClass {
        if ($this->content !== null) {
            return $this->content;
        }
        $this->content = new stdClass();
        \${features.includes('capabilities') ? `
        $context = context_block::instance($this->instance->id);
        if (!has_capability('\${fullname}:view', $context)) {
            $this->content->text = '';
            return $this->content;
        }` : ''}
        $this->content->text   = ''; // Add your block content here
        $this->content->footer = '';
        return $this->content;
    }

    public function applicable_formats(): array {
        return ['all' => true];
    }
}
`
      }

      const fileList = Object.keys(files).sort()

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            plugin: fullname,
            moodle: config.MOODLE_NAME,
            version: config.MOODLE_VERSION,
            targetPath: `\${config.MOODLE_ROOT_PATH}/\${pluginType}/\${pluginName}/`,
            features,
            fileCount: fileList.length,
            structure: fileList.map(f => `\${pluginType}/\${pluginName}/\${f}`).join('\\n'),
            files,
            nextSteps: [
              `Copy the files to: \${config.MOODLE_ROOT_PATH}/\${pluginType}/\${pluginName}/`,
              `Go to Site Admin -> Notifications to install the plugin`,
              features.includes('webservices')
                ? `Activate the service in Site Admin -> Plugins -> Web services -> External services`
                : null,
              features.includes('cron')
                ? `Verify the task in Site Admin -> Server -> Scheduled tasks`
                : null,
              features.includes('capabilities')
                ? `Assign capabilities in Site Admin -> Users -> Permissions -> Define roles`
                : null,
            ].filter(Boolean),
          }, null, 2),
        }],
      }
    }
  )
}