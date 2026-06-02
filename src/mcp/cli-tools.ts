'use strict';
import { execSync } from 'child_process';
import { ToolDef } from '../types';

export const cliToolsTools: ToolDef[] = [
  {
    name: 'copilot_suggest',
    description: 'Use GitHub Copilot CLI to suggest a shell command for a given task',
    inputSchema: {
      type: 'object',
      properties: {
        task: { type: 'string', description: 'Natural-language description of what you want to do' },
        target: { type: 'string', description: 'Target shell type: shell, git, gh (optional)' },
      },
      required: ['task'],
    },
  },
  {
    name: 'copilot_explain',
    description: 'Use GitHub Copilot CLI to explain what a shell command does',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Shell command to explain' },
      },
      required: ['command'],
    },
  },
  {
    name: 'openai_codex',
    description: 'Information about the OpenAI Codex API status and alternatives',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Code generation prompt (informational only)' },
        language: { type: 'string', description: 'Target programming language (informational only)' },
      },
      required: ['prompt'],
    },
  },
];

export async function executeCliTool(
  name: string,
  input: Record<string, unknown>
): Promise<{ output: string; isError: boolean }> {
  try {
    switch (name) {
      case 'copilot_suggest': {
        const task = input.task as string;
        const target = input.target as string | undefined;
        const targetFlag = target ? ` -t ${target}` : '';
        try {
          const stdout = execSync(`gh copilot suggest "${task}"${targetFlag}`, {
            encoding: 'utf8',
            timeout: 30000,
          });
          return { output: stdout || '(no output)', isError: false };
        } catch (err: unknown) {
          const e = err as NodeJS.ErrnoException & { stdout?: string; stderr?: string; status?: number };
          if (
            e.code === 'ENOENT' ||
            (e.message && (e.message.includes('not found') || e.message.includes('command not found')))
          ) {
            return {
              output:
                'GitHub Copilot CLI not installed. Run: gh extension install github/gh-copilot',
              isError: true,
            };
          }
          // Non-zero exit from gh itself
          const out = e.stdout || e.stderr || e.message || String(err);
          if (out.includes('not installed') || out.includes('extension')) {
            return {
              output:
                'GitHub Copilot CLI not installed. Run: gh extension install github/gh-copilot',
              isError: true,
            };
          }
          return { output: out, isError: true };
        }
      }

      case 'copilot_explain': {
        const command = input.command as string;
        try {
          const stdout = execSync(`gh copilot explain "${command}"`, {
            encoding: 'utf8',
            timeout: 30000,
          });
          return { output: stdout || '(no output)', isError: false };
        } catch (err: unknown) {
          const e = err as NodeJS.ErrnoException & { stdout?: string; stderr?: string };
          if (
            e.code === 'ENOENT' ||
            (e.message && (e.message.includes('not found') || e.message.includes('command not found')))
          ) {
            return {
              output:
                'GitHub Copilot CLI not installed. Run: gh extension install github/gh-copilot',
              isError: true,
            };
          }
          const out = e.stdout || e.stderr || e.message || String(err);
          return { output: out, isError: true };
        }
      }

      case 'openai_codex': {
        return {
          output:
            'OpenAI Codex API is no longer publicly available. Use opencli --codex or opencli --skill vibe-coding for code-only generation with any configured model.',
          isError: false,
        };
      }

      default:
        return { output: `Unknown CLI tool: ${name}`, isError: true };
    }
  } catch (err: unknown) {
    return { output: (err as Error).message, isError: true };
  }
}
