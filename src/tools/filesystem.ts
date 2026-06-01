import * as fs from 'fs';
import * as path from 'path';
import * as diff from 'diff';
import { ToolDef } from '../types';

export const readFileTool: ToolDef = {
  name: 'read_file',
  description: 'Read the contents of a file. Returns the file content as a string.',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path to read (absolute or relative)' },
      start_line: { type: 'number', description: 'Start line number (1-based, optional)' },
      end_line: { type: 'number', description: 'End line number (1-based, optional)' },
    },
    required: ['path'],
  },
};

export const writeFileTool: ToolDef = {
  name: 'write_file',
  description: 'Write content to a file. Creates the file if it does not exist, overwrites if it does. Creates parent directories as needed.',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path to write' },
      content: { type: 'string', description: 'Content to write to the file' },
    },
    required: ['path', 'content'],
  },
};

export const listFilesTool: ToolDef = {
  name: 'list_files',
  description: 'List files and directories at a given path.',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Directory path to list (default: current directory)' },
      recursive: { type: 'boolean', description: 'List recursively (default: false)' },
      pattern: { type: 'string', description: 'Glob pattern filter (e.g. "*.ts")' },
    },
    required: [],
  },
};

export const searchFilesTool: ToolDef = {
  name: 'search_files',
  description: 'Search for text patterns across files using grep-like functionality.',
  inputSchema: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Search pattern (regex supported)' },
      path: { type: 'string', description: 'Directory to search in (default: current directory)' },
      file_pattern: { type: 'string', description: 'File name pattern to search within (e.g. "*.ts")' },
      case_sensitive: { type: 'boolean', description: 'Case sensitive search (default: false)' },
    },
    required: ['pattern'],
  },
};

export async function readFile(input: Record<string, unknown>): Promise<{ output: string; isError: boolean }> {
  const filePath = input.path as string;
  const startLine = input.start_line as number | undefined;
  const endLine = input.end_line as number | undefined;

  try {
    const absPath = path.resolve(filePath);
    const content = fs.readFileSync(absPath, 'utf-8');
    let result = content;

    if (startLine !== undefined || endLine !== undefined) {
      const lines = content.split('\n');
      const start = (startLine || 1) - 1;
      const end = endLine || lines.length;
      result = lines
        .slice(start, end)
        .map((line, i) => `${start + i + 1}: ${line}`)
        .join('\n');
    }

    return { output: result, isError: false };
  } catch (err: unknown) {
    return { output: (err as Error).message, isError: true };
  }
}

export async function writeFile(
  input: Record<string, unknown>,
  dryRun = false
): Promise<{ output: string; isError: boolean; diffPreview?: string }> {
  const filePath = input.path as string;
  const content = input.content as string;

  try {
    const absPath = path.resolve(filePath);

    let diffPreview: string | undefined;
    if (fs.existsSync(absPath)) {
      const existing = fs.readFileSync(absPath, 'utf-8');
      const patch = diff.createPatch(filePath, existing, content, 'existing', 'new');
      diffPreview = patch;
    }

    if (!dryRun) {
      const dir = path.dirname(absPath);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(absPath, content, 'utf-8');
      const lines = content.split('\n').length;
      const action = diffPreview ? 'Updated' : 'Created';
      return { output: `${action} ${filePath} (${lines} lines)`, isError: false, diffPreview };
    } else {
      return { output: `[DRY RUN] Would write to ${filePath}`, isError: false, diffPreview };
    }
  } catch (err: unknown) {
    return { output: (err as Error).message, isError: true };
  }
}

export async function listFiles(input: Record<string, unknown>): Promise<{ output: string; isError: boolean }> {
  const dirPath = (input.path as string) || '.';
  const recursive = (input.recursive as boolean) || false;

  try {
    const absPath = path.resolve(dirPath);
    const entries = recursive ? listRecursive(absPath, absPath) : listFlat(absPath);
    return { output: entries.join('\n') || '(empty directory)', isError: false };
  } catch (err: unknown) {
    return { output: (err as Error).message, isError: true };
  }
}

export async function searchFiles(input: Record<string, unknown>): Promise<{ output: string; isError: boolean }> {
  const pattern = input.pattern as string;
  const dirPath = (input.path as string) || '.';
  const filePattern = input.file_pattern as string | undefined;
  const caseSensitive = (input.case_sensitive as boolean) || false;

  try {
    const absPath = path.resolve(dirPath);
    const flags = caseSensitive ? 'g' : 'gi';
    const regex = new RegExp(pattern, flags);
    const results: string[] = [];

    function searchDir(dir: string): void {
      const entries = fs.readdirSync(dir);
      for (const entry of entries) {
        if (entry.startsWith('.') || entry === 'node_modules' || entry === 'dist') continue;
        const fullPath = path.join(dir, entry);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          searchDir(fullPath);
        } else if (!filePattern || entry.match(filePattern.replace('*', '.*'))) {
          try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            const lines = content.split('\n');
            lines.forEach((line, idx) => {
              if (regex.test(line)) {
                const rel = path.relative(absPath, fullPath);
                results.push(`${rel}:${idx + 1}: ${line.trim()}`);
              }
            });
          } catch { /* skip binary files */ }
        }
      }
    }

    searchDir(absPath);
    return { output: results.slice(0, 200).join('\n') || '(no matches found)', isError: false };
  } catch (err: unknown) {
    return { output: (err as Error).message, isError: true };
  }
}

function listFlat(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.map(e => {
    const prefix = e.isDirectory() ? '📁' : '📄';
    return `${prefix} ${e.name}${e.isDirectory() ? '/' : ''}`;
  });
}

function listRecursive(dir: string, root: string, prefix = ''): string[] {
  const results: string[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    entries.forEach((e, i) => {
      if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'dist') return;
      const isLast = i === entries.length - 1;
      const connector = isLast ? '└── ' : '├── ';
      results.push(prefix + connector + e.name + (e.isDirectory() ? '/' : ''));
      if (e.isDirectory()) {
        const childPrefix = prefix + (isLast ? '    ' : '│   ');
        results.push(...listRecursive(path.join(dir, e.name), root, childPrefix));
      }
    });
  } catch { /* skip permission errors */ }
  return results;
}
