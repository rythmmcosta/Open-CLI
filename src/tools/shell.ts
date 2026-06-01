import execa from 'execa';
import { ToolDef } from '../types';

export const shellToolDef: ToolDef = {
  name: 'bash',
  description: 'Execute a shell command and return its output. Use for running scripts, installing packages, checking system state, or any terminal operation.',
  inputSchema: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'The shell command to execute',
      },
      cwd: {
        type: 'string',
        description: 'Working directory for the command (default: current directory)',
      },
      timeout: {
        type: 'number',
        description: 'Timeout in milliseconds (default: 30000)',
      },
    },
    required: ['command'],
  },
};

export async function executeBash(input: Record<string, unknown>): Promise<{ output: string; isError: boolean }> {
  const command = input.command as string;
  const cwd = (input.cwd as string) || process.cwd();
  const timeout = (input.timeout as number) || 30000;

  try {
    const result = await execa('bash', ['-c', command], {
      cwd,
      timeout,
      all: true,
      reject: false,
    });

    const output = result.all || result.stdout || '';
    const stderr = result.stderr || '';
    const isError = result.exitCode !== 0;

    let combined = output;
    if (stderr && stderr !== output && isError) {
      combined = output ? `${output}\n${stderr}` : stderr;
    }

    return { output: combined || '(no output)', isError };
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message.includes('ETIMEDOUT')) {
      return { output: `Command timed out after ${timeout}ms`, isError: true };
    }
    return { output: error.message, isError: true };
  }
}
