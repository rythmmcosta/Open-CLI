import { ToolDef } from '../types';
import { shellToolDef, executeBash } from './shell';
import { readFileTool, writeFileTool, listFilesTool, searchFilesTool, readFile, writeFile, listFiles, searchFiles } from './filesystem';
import { gitToolDef, executeGit } from './git';
import { ALL_BROWSER_TOOLS, executeBrowserTool } from '../browser/tools';
import { httpTools, executeHttpRequest } from '../mcp/http';
import { databaseTools, executeDatabaseTool } from '../mcp/database';
import { dockerTools, executeDockerTool } from '../mcp/docker';
import { searchTools, executeSearchTool } from '../mcp/search';

export const ALL_TOOLS: ToolDef[] = [
  shellToolDef,
  readFileTool,
  writeFileTool,
  listFilesTool,
  searchFilesTool,
  gitToolDef,
  ...httpTools,
  ...databaseTools,
  ...dockerTools,
  ...searchTools,
];

export const BROWSER_ENABLED_TOOLS: ToolDef[] = [
  ...ALL_TOOLS,
  ...ALL_BROWSER_TOOLS,
];

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  dryRun = false
): Promise<{ output: string; isError: boolean; diffPreview?: string }> {
  // Browser tools
  if (name.startsWith('browser_')) {
    return executeBrowserTool(name, input);
  }

  // HTTP tools
  if (name === 'http_request') {
    return executeHttpRequest(input);
  }

  // Database tools
  if (name.startsWith('db_')) {
    return executeDatabaseTool(name, input);
  }

  // Docker tools
  if (name.startsWith('docker_')) {
    return executeDockerTool(name, input);
  }

  // Search tools
  if (name === 'web_search' || name === 'fetch_page') {
    return executeSearchTool(name, input);
  }

  switch (name) {
    case 'bash':
      if (dryRun) return { output: `[DRY RUN] Would execute: ${input.command}`, isError: false };
      return executeBash(input);

    case 'read_file':
      return readFile(input);

    case 'write_file':
      return writeFile(input, dryRun);

    case 'list_files':
      return listFiles(input);

    case 'search_files':
      return searchFiles(input);

    case 'git_command':
      if (dryRun) return { output: `[DRY RUN] Would run: git ${input.args}`, isError: false };
      return executeGit(input);

    default:
      return { output: `Unknown tool: ${name}`, isError: true };
  }
}
