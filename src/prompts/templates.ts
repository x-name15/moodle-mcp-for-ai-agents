import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { MoodleConfig } from '../config.js'

export async function registerPrompts(server: McpServer, config: MoodleConfig) {

  // ── /moodle_capabilities ──────────────────────────────────────────────────
  server.registerPrompt(
    'moodle_capabilities',
    {
      description: 'Lists everything the MCP can do in this instance',
    },
    () => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `You are an expert Moodle assistant connected to "${config.MOODLE_NAME}" (v${config.MOODLE_VERSION}).

You have 26 MCP tools available:

## Plugins and code
- list_plugins — all plugins with type, version, dependencies
- get_plugin_detail — full details: tables, hooks, observers, WS
- get_plugin_dependencies — complete dependency tree
- find_plugins_by_table — which plugins interact with a table
- find_plugins_by_hook — which plugins implement a hook
- get_hook_usage — in which PHP files a hook appears
- get_plugin_api — public functions, externallib, classes/external
- find_integration_points — integration points between two plugins
- refresh_plugin_cache — re-scans the entire filesystem
- invalidate_plugin_cache — re-scans only a specific plugin

## Database
- list_db_tables — all tables with size and row counts
- describe_table — columns, types, and indexes
- count_plugin_records — actual records of a plugin
- find_column — in which tables a column exists
- sample_table — actual rows (max 10)
- db_overview — general overview

## Configuration
- get_moodle_config — reads the complete config.php

## Web services
- list_webservices — active services and tokens
- get_service_functions — functions of a service

## Users and roles
- get_users_overview — totals, per role, admins, logins
- find_user — finds user with roles and courses

## Logs and errors
- get_moodle_errors — recent errors grouped by hours
- get_recent_activity — recent activity
- get_php_error_log — last lines of the PHP log

## Infrastructure
- get_infra_context — RabbitMQ, microservices, URLs
- get_rabbitmq_status — live queues, messages, consumers

Instance: \${config.MOODLE_NAME} | DB: \${config.DB_HOST}:\${config.DB_PORT}/\${config.DB_NAME} | \${config.MOODLE_URL}`,
        },
      }],
    })
  )

  // ── /moodle_status ────────────────────────────────────────────────────────
  server.registerPrompt(
    'moodle_status',
    {
      description: 'Complete diagnostic of the current state of this Moodle before modifying anything',
    },
    () => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `I need a complete diagnostic of "${config.MOODLE_NAME}" before I start working.

Run these tools in order and provide a structured summary:

1. get_moodle_config — current site configuration
2. db_overview — database state
3. get_users_overview — summary of active users
4. list_webservices — active services and tokens
5. get_moodle_errors (hours=24) — errors from the last 24 hours
6. get_rabbitmq_status — queue states
7. get_infra_context — infrastructure and microservices

When finished, I want to know:
- Are there any active critical errors?
- Are there active WS tokens and who is using them?
- Does RabbitMQ have accumulated unprocessed messages?
- Is the site configuration as expected?

Instance: \${config.MOODLE_NAME} v\${config.MOODLE_VERSION}`,
        },
      }],
    })
  )

  // ── /understand_plugin ────────────────────────────────────────────────────
  server.registerPrompt(
    'understand_plugin',
    {
      description: 'In-depth analysis of a plugin you are unfamiliar with',
      argsSchema: {
        pluginName: z.string().describe('Plugin name, ex: local_messagebroker'),
      },
    },
    ({ pluginName }) => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `I need to fully understand the plugin "\${pluginName}" in "${config.MOODLE_NAME}".

Run these tools in order:

1. get_plugin_detail with "\${pluginName}"
2. get_plugin_dependencies with "\${pluginName}"
3. count_plugin_records with "\${pluginName}"
4. get_plugin_api with "\${pluginName}"
5. If it maps to any tables, describe_table on the main table
6. If it has observers, find_plugins_by_hook with the main event

With that information, explain:
- What this plugin is for
- What tables it uses and what data it stores
- Extent of dependencies on other plugins and why
- Which plugins depend on it (risk if modified)
- Exposed functions for others to consume
- How it integrates into the ecosystem of this Moodle`,
        },
      }],
    })
  )

  // ── /debug_error ──────────────────────────────────────────────────────────
  server.registerPrompt(
    'debug_error',
    {
      description: 'Investigate an error or issue in production',
      argsSchema: {
        errorDescription: z.string().describe('Describe the error, ex: users cannot authenticate'),
      },
    },
    ({ errorDescription }) => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `There is an issue in "${config.MOODLE_NAME}": \${errorDescription}

Investigate by running:

1. get_moodle_errors (hours=24)
2. get_recent_activity (hours=2)
3. get_php_error_log (lines=50)
4. get_rabbitmq_status — if there are blocked queues
5. If the error mentions a plugin: get_plugin_detail and count_plugin_records
6. If the error mentions a table: describe_table and sample_table

With that information:
- Identify the most likely cause
- Point out which plugin or table contains the issue
- Suggest concrete steps to resolve it
- Indicate if there is a risk of affecting other plugins

Moodle: \${config.MOODLE_NAME} v\${config.MOODLE_VERSION}`,
        },
      }],
    })
  )

  // ── /new_plugin ───────────────────────────────────────────────────────────
  server.registerPrompt(
    'new_plugin',
    {
      description: 'Full context to develop a new plugin from scratch',
      argsSchema: {
        pluginType: z.string().describe('Plugin type, ex: local, mod, block, auth'),
        pluginPurpose: z.string().describe('What it is for, ex: manage push notifications'),
      },
    },
    ({ pluginType, pluginPurpose }) => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `I am going to develop a new plugin of type "\${pluginType}" in "${config.MOODLE_NAME}" v${config.MOODLE_VERSION}.

Purpose: \${pluginPurpose}

Gather context:

1. list_plugins — existing "\${pluginType}" plugins to see conventions
2. get_moodle_config — exact site version and configuration
3. If it needs to interact with users or courses: describe_table "user" and "course"
4. find_plugins_by_hook with common hooks for "\${pluginType}" plugins

Provide me with:
- Minimal file and folder structure for Moodle \${config.MOODLE_VERSION}
- version.php with correct requires for this instance
- db/install.xml if it needs tables
- db/services.php and external class if it needs WS
- db/observers.php if it must react to events
- Naming conventions of other "\${pluginType}" plugins in this Moodle
- Which existing plugins might be needed as a dependency

Plugins path: \${config.MOODLE_ROOT_PATH}/\${pluginType}/`,
        },
      }],
    })
  )

  // ── /integrate_plugins ────────────────────────────────────────────────────
  server.registerPrompt(
    'integrate_plugins',
    {
      description: 'Plan the integration between two existing plugins',
      argsSchema: {
        pluginA: z.string().describe('Plugin that initiates or consumes, ex: local_messagebroker'),
        pluginB: z.string().describe('Plugin that provides or receives, ex: mod_assign'),
        integrationGoal: z.string().describe('What you want to achieve, ex: notify when an assignment is submitted'),
      },
    },
    ({ pluginA, pluginB, integrationGoal }) => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `I need to integrate "\${pluginA}" with "\${pluginB}" in "${config.MOODLE_NAME}".

Goal: \${integrationGoal}

Run:

1. find_integration_points pluginA="\${pluginA}" pluginB="\${pluginB}"
2. get_plugin_api with "\${pluginA}"
3. get_plugin_api with "\${pluginB}"
4. get_plugin_detail with "\${pluginA}"
5. get_plugin_detail with "\${pluginB}"
6. get_plugin_dependencies with "\${pluginA}"

Generate an integration plan:
- Recommended mechanism (observer, direct WS call, dependency + API)
- Necessary changes in version.php for \${pluginA}
- Code for the observer or integration call
- DB changes if needed
- Risks if I modify these plugins
- Minimal tests to verify the integration

Moodle: \${config.MOODLE_NAME} v\${config.MOODLE_VERSION}`,
        },
      }],
    })
  )

  // ── /webservice_context ───────────────────────────────────────────────────
  server.registerPrompt(
    'webservice_context',
    {
      description: 'Complete context to create or modify a Web Service',
      argsSchema: {
        pluginName: z.string().describe('Plugin where the WS lives, ex: local_myapi'),
        wsAction: z.string().describe('What the WS should do, ex: return user progress in a course'),
      },
    },
    ({ pluginName, wsAction }) => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `I need to create or modify a Web Service in "\${pluginName}" for "${config.MOODLE_NAME}".

Action: \${wsAction}

Gather context:

1. get_plugin_detail with "\${pluginName}"
2. get_plugin_api with "\${pluginName}" — existing WS to prevent duplication
3. list_webservices — active services and tokens
4. If it needs user or course data: describe_table "user", "course", "user_enrolments"

Provide me with:
- If the WS already exists: how to modify it without breaking current consumers
- If it is new:
  - Complete PHP class with execute(), execute_parameters(), execute_returns()
  - Entry in db/services.php
  - Capabilities in db/access.php
  - How to register it into the correct external service
- How to test it: \${config.MOODLE_URL}/webservice/rest/server.php
- Active tokens that might use it

Moodle: \${config.MOODLE_NAME} v\${config.MOODLE_VERSION}`,
        },
      }],
    })
  )
}