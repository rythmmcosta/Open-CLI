/**
 * Built-in MCP (Model Context Protocol) Server Registry
 *
 * These MCP-compatible tool servers are bundled with Open CLI.
 * No external downloads required.
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
  | 'ai';

import { httpTools } from './http';
import { databaseTools } from './database';
import { dockerTools } from './docker';
import { searchTools } from './search';

export const BUILTIN_MCP_SERVERS: MCPServer[] = [
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
