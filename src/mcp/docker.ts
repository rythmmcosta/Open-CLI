import execa from 'execa';
import { ToolDef } from '../types';

export const dockerListTool: ToolDef = {
  name: 'docker_list',
  description: 'List Docker containers (running or all)',
  inputSchema: {
    type: 'object',
    properties: {
      all: { type: 'boolean', description: 'Show all containers including stopped (default: false)' },
    },
    required: [],
  },
};

export const dockerLogsTool: ToolDef = {
  name: 'docker_logs',
  description: 'Get logs from a Docker container',
  inputSchema: {
    type: 'object',
    properties: {
      container: { type: 'string', description: 'Container name or ID' },
      lines: { type: 'number', description: 'Number of log lines to show (default: 50)' },
    },
    required: ['container'],
  },
};

export const dockerExecTool: ToolDef = {
  name: 'docker_exec',
  description: 'Execute a command inside a running Docker container',
  inputSchema: {
    type: 'object',
    properties: {
      container: { type: 'string', description: 'Container name or ID' },
      command: { type: 'string', description: 'Command to execute inside the container' },
    },
    required: ['container', 'command'],
  },
};

export const dockerComposeTool: ToolDef = {
  name: 'docker_compose',
  description: 'Run docker compose commands (up, down, ps, logs, restart)',
  inputSchema: {
    type: 'object',
    properties: {
      action: { type: 'string', description: 'Action: up, down, ps, logs, restart, pull, build' },
      service: { type: 'string', description: 'Optional specific service name' },
      flags: { type: 'string', description: 'Additional flags like --detach, --build' },
      cwd: { type: 'string', description: 'Directory containing docker-compose.yml' },
    },
    required: ['action'],
  },
};

export const dockerTools: ToolDef[] = [dockerListTool, dockerLogsTool, dockerExecTool, dockerComposeTool];

export async function executeDockerTool(
  name: string,
  input: Record<string, unknown>
): Promise<{ output: string; isError: boolean }> {
  try {
    const run = async (cmd: string, args: string[], cwd?: string) => {
      const result = await execa(cmd, args, { cwd, all: true, reject: false });
      return {
        output: (result.all || result.stdout || result.stderr || '(no output)'),
        isError: result.exitCode !== 0,
      };
    };

    switch (name) {
      case 'docker_list': {
        const args = ['ps', '--format', 'table {{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Ports}}'];
        if (input.all) args.splice(1, 0, '-a');
        return run('docker', args);
      }

      case 'docker_logs': {
        const lines = (input.lines as number) || 50;
        return run('docker', ['logs', '--tail', String(lines), input.container as string]);
      }

      case 'docker_exec': {
        const cmdParts = (input.command as string).split(' ');
        return run('docker', ['exec', input.container as string, ...cmdParts]);
      }

      case 'docker_compose': {
        const action = input.action as string;
        const args = ['compose', action];
        if (input.service) args.push(input.service as string);
        if (input.flags) args.push(...(input.flags as string).split(' '));
        return run('docker', args, (input.cwd as string) || process.cwd());
      }

      default:
        return { output: `Unknown docker tool: ${name}`, isError: true };
    }
  } catch (err: unknown) {
    return { output: (err as Error).message, isError: true };
  }
}
