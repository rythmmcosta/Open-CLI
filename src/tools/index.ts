import { ToolDef } from '../types';
import { shellToolDef, executeBash } from './shell';
import { readFileTool, writeFileTool, listFilesTool, searchFilesTool, readFile, writeFile, listFiles, searchFiles } from './filesystem';
import { gitToolDef, executeGit } from './git';

export const ALL_TOOLS: ToolDef[] = [
  shellToolDef,
  readFileTool,
  writeFileTool,
  listFilesTool,
  searchFilesTool,
  gitToolDef,
];

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  dryRun = false
): Promise<{ output: string; isError: boolean; diffPreview?: string }> {
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
