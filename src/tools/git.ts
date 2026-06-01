import execa from 'execa';
import { ToolDef } from '../types';

export const gitToolDef: ToolDef = {
  name: 'git_command',
  description: 'Run a git command. Provide the arguments after "git", e.g. "status", "log --oneline -10", "diff HEAD~1".',
  inputSchema: {
    type: 'object',
    properties: {
      args: {
        type: 'string',
        description: 'Git command arguments (everything after "git"), e.g. "status", "log --oneline -10"',
      },
      cwd: {
        type: 'string',
        description: 'Working directory (default: current directory)',
      },
    },
    required: ['args'],
  },
};

export async function executeGit(input: Record<string, unknown>): Promise<{ output: string; isError: boolean }> {
  const args = (input.args as string).trim().split(/\s+/);
  const cwd = (input.cwd as string) || process.cwd();

  try {
    const result = await execa('git', args, {
      cwd,
      all: true,
      reject: false,
    });

    const output = result.all || result.stdout || '';
    const isError = result.exitCode !== 0;
    return { output: output || '(no output)', isError };
  } catch (err: unknown) {
    return { output: (err as Error).message, isError: true };
  }
}
