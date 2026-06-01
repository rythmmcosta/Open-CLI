/**
 * Built-in MCP (Model Context Protocol) Server Registry
 * Open CLI — opencli.myowncloud.tech — Author: Rythmm Costa
 *
 * 18 built-in MCP servers — no external downloads required.
 */

import { ToolDef } from '../types';
import { ALL_TOOLS } from '../tools';
import { ALL_BROWSER_TOOLS } from '../browser/tools';

export interface MCPServer {
  id: string;
  name: string;
  description: string;
  version: string;
  tools: ToolDef[];
  category: MCPCategory;
  requiresSetup?: boolean;
  setupInstructions?: string;
}

export type MCPCategory =
  | 'filesystem'
  | 'shell'
  | 'browser'
  | 'git'
  | 'database'
  | 'network'
  | 'notifications'
  | 'devtools'
  | 'ai'
  | 'integrations'
  | 'data'
  | 'cloud';

import { httpTools } from './http';
import { databaseTools } from './database';
import { dockerTools } from './docker';
import { searchTools } from './search';
import { githubTools } from './github';
import { emailTools } from './email';
import { redisTools } from './redis-mcp';
import { postgresTools } from './postgres';
import { mongoTools } from './mongodb';
import { slackTools } from './slack';
import { clipboardTools } from './clipboard';
import { pdfTools } from './pdf';
import { csvTools } from './csv-tools';
import { jiraTools } from './jira';

export const BUILTIN_MCP_SERVERS: MCPServer[] = [
  // ── Core 8 ──────────────────────────────────────────────────────────────
  {
    id: 'filesystem',
    name: 'File System',
    description: 'Read, write, list, and search files and directories',
    version: '1.0.0',
    category: 'filesystem',
    tools: ALL_TOOLS.filter(t => ['read_file', 'write_file', 'list_files', 'search_files'].includes(t.name)),
  },
  {
    id: 'shell',
    name: 'Shell Executor',
    description: 'Execute shell commands and scripts with safety scoring',
    version: '1.0.0',
    category: 'shell',
    tools: ALL_TOOLS.filter(t => t.name === 'bash'),
  },
  {
    id: 'git',
    name: 'Git Operations',
    description: 'Full git workflow: status, commit, push, diff, branch management',
    version: '1.0.0',
    category: 'git',
    tools: ALL_TOOLS.filter(t => t.name === 'git_command'),
  },
  {
    id: 'browser',
    name: 'Browser Automation',
    description: 'Playwright-powered browser: navigate, click, type, screenshot, verify UI',
    version: '1.0.0',
    category: 'browser',
    requiresSetup: true,
    setupInstructions: 'Run: npx playwright install chromium',
    tools: ALL_BROWSER_TOOLS,
  },
  {
    id: 'http',
    name: 'HTTP Client',
    description: 'Make HTTP/REST API requests: GET, POST, PUT, DELETE with headers and auth',
    version: '1.0.0',
    category: 'network',
    tools: httpTools,
  },
  {
    id: 'database',
    name: 'SQLite Database',
    description: 'Query and manage SQLite databases: SELECT, INSERT, CREATE TABLE, migrations',
    version: '1.0.0',
    category: 'database',
    tools: databaseTools,
  },
  {
    id: 'docker',
    name: 'Docker Manager',
    description: 'Docker operations: list containers, start/stop, logs, build images, compose',
    version: '1.0.0',
    category: 'devtools',
    tools: dockerTools,
  },
  {
    id: 'search',
    name: 'Web Search',
    description: 'Search the web using DuckDuckGo API and scrape results',
    version: '1.0.0',
    category: 'network',
    tools: searchTools,
  },

  // ── New 10 ──────────────────────────────────────────────────────────────
  {
    id: 'github',
    name: 'GitHub Integration',
    description: 'GitHub repos, issues, PRs, file contents via REST API v3',
    version: '1.0.0',
    category: 'integrations',
    requiresSetup: true,
    setupInstructions: 'Run: opencli auth — select GitHub and enter your Personal Access Token',
    tools: githubTools,
  },
  {
    id: 'email',
    name: 'Email (SMTP)',
    description: 'Send emails via any SMTP server using a connection URL',
    version: '1.0.0',
    category: 'integrations',
    requiresSetup: true,
    setupInstructions: 'Provide SMTP URL: smtp://user:pass@smtp.gmail.com:587',
    tools: emailTools,
  },
  {
    id: 'redis',
    name: 'Redis Cache',
    description: 'Redis get/set/del/list/hash/pub-sub operations',
    version: '1.0.0',
    category: 'database',
    requiresSetup: true,
    setupInstructions: 'Install: npm install -g ioredis  |  Provide redis:// URL',
    tools: redisTools,
  },
  {
    id: 'postgres',
    name: 'PostgreSQL',
    description: 'Query PostgreSQL: SELECT, INSERT, schema inspection, migrations',
    version: '1.0.0',
    category: 'database',
    requiresSetup: true,
    setupInstructions: 'Install: npm install -g pg  |  Provide PostgreSQL connection URL',
    tools: postgresTools,
  },
  {
    id: 'mongodb',
    name: 'MongoDB',
    description: 'MongoDB CRUD: find, insert, update, delete, aggregate, collections',
    version: '1.0.0',
    category: 'database',
    requiresSetup: true,
    setupInstructions: 'Install: npm install -g mongodb  |  Provide mongodb:// URI',
    tools: mongoTools,
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Send messages, list channels, read channel history via Slack API',
    version: '1.0.0',
    category: 'integrations',
    requiresSetup: true,
    setupInstructions: 'Get a Slack Bot token or Incoming Webhook URL from api.slack.com',
    tools: slackTools,
  },
  {
    id: 'clipboard',
    name: 'Clipboard',
    description: 'Read from and write to the system clipboard (macOS, Linux, Windows)',
    version: '1.0.0',
    category: 'devtools',
    tools: clipboardTools,
  },
  {
    id: 'pdf',
    name: 'PDF Tools',
    description: 'Create print-ready PDFs and extract text from PDF files',
    version: '1.0.0',
    category: 'data',
    tools: pdfTools,
  },
  {
    id: 'csv',
    name: 'CSV Tools',
    description: 'Parse, filter, aggregate, and transform CSV files — zero dependencies',
    version: '1.0.0',
    category: 'data',
    tools: csvTools,
  },
  {
    id: 'jira',
    name: 'Jira',
    description: 'Jira Cloud: list issues, create/update issues, add comments, manage transitions',
    version: '1.0.0',
    category: 'integrations',
    requiresSetup: true,
    setupInstructions: 'Provide Jira host (e.g. company.atlassian.net), account email, and API token',
    tools: jiraTools,
  },
];

export function getServerById(id: string): MCPServer | undefined {
  return BUILTIN_MCP_SERVERS.find(s => s.id === id);
}

export function getAllMCPTools(enabledServers?: string[]): ToolDef[] {
  const servers = enabledServers
    ? BUILTIN_MCP_SERVERS.filter(s => enabledServers.includes(s.id))
    : BUILTIN_MCP_SERVERS;
  return servers.flatMap(s => s.tools);
}

export function listServers(): MCPServer[] {
  return BUILTIN_MCP_SERVERS;
}
