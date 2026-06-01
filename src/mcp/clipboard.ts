import { execSync } from 'child_process';
import { ToolDef } from '../types';

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export const clipboardTools: ToolDef[] = [
  {
    name: 'clipboard_read',
    description: 'Read the current contents of the system clipboard.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'clipboard_write',
    description: 'Write text to the system clipboard.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to write to the clipboard' },
      },
      required: ['text'],
    },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readClipboard(): string {
  const platform = process.platform;

  if (platform === 'darwin') {
    return execSync('pbpaste', { encoding: 'utf8' });
  }

  if (platform === 'linux') {
    const cmds = [
      'xclip -selection clipboard -o',
      'xsel --clipboard --output',
      'wl-paste',
    ];
    for (const cmd of cmds) {
      try {
        return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
      } catch {
        // try next
      }
    }
    throw new Error(
      'No clipboard utility found on Linux.\n' +
      'Install one of: xclip (apt install xclip), xsel (apt install xsel), or wl-clipboard (for Wayland).'
    );
  }

  if (platform === 'win32') {
    return execSync('powershell -command "Get-Clipboard"', { encoding: 'utf8' });
  }

  throw new Error(`Unsupported platform: ${platform}`);
}

function writeClipboard(text: string): void {
  const platform = process.platform;

  if (platform === 'darwin') {
    execSync('pbcopy', { input: text, encoding: 'utf8' });
    return;
  }

  if (platform === 'linux') {
    const cmds = [
      { cmd: 'xclip -selection clipboard', useStdin: true  },
      { cmd: 'xsel --clipboard --input',   useStdin: true  },
      { cmd: 'wl-copy',                    useStdin: true  },
    ];
    for (const { cmd, useStdin } of cmds) {
      try {
        if (useStdin) {
          execSync(cmd, { input: text, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
        } else {
          execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
        }
        return;
      } catch {
        // try next
      }
    }
    throw new Error(
      'No clipboard utility found on Linux.\n' +
      'Install one of: xclip (apt install xclip), xsel (apt install xsel), or wl-clipboard (for Wayland).'
    );
  }

  if (platform === 'win32') {
    // PowerShell Set-Clipboard — pass text via stdin to avoid shell escaping issues
    execSync('powershell -command "$input | Set-Clipboard"', {
      input: text,
      encoding: 'utf8',
    });
    return;
  }

  throw new Error(`Unsupported platform: ${platform}`);
}

// ---------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------

export async function executeClipboardTool(
  name: string,
  input: Record<string, unknown>
): Promise<{ output: string; isError: boolean }> {
  try {
    // -----------------------------------------------------------------------
    if (name === 'clipboard_read') {
      const content = readClipboard();
      if (!content.trim()) return { output: '(Clipboard is empty)', isError: false };
      const byteLen = Buffer.byteLength(content, 'utf8');
      const preview = content.slice(0, 2000);
      const truncated = content.length > 2000 ? `\n… (${content.length - 2000} more characters)` : '';
      return {
        output: `Clipboard contents (${byteLen} bytes):\n${'─'.repeat(40)}\n${preview}${truncated}`,
        isError: false,
      };
    }

    // -----------------------------------------------------------------------
    if (name === 'clipboard_write') {
      const text = input.text as string;
      writeClipboard(text);
      const byteLen = Buffer.byteLength(text, 'utf8');
      return {
        output: `Clipboard updated (${byteLen} bytes written).\n  Preview: ${text.slice(0, 80)}${text.length > 80 ? '…' : ''}`,
        isError: false,
      };
    }

    return { output: `Unknown clipboard tool: ${name}`, isError: true };
  } catch (err: unknown) {
    return { output: (err as Error).message, isError: true };
  }
}
