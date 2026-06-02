import fetch from 'node-fetch';
import { ToolDef } from '../types';

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export const dropboxTools: ToolDef[] = [
  {
    name: 'dropbox_list',
    description: 'List files and folders in a Dropbox directory.',
    inputSchema: {
      type: 'object',
      properties: {
        path:         { type: 'string', description: 'Dropbox path to list (default: root "")' },
        access_token: { type: 'string', description: 'Dropbox OAuth2 access token' },
      },
      required: ['access_token'],
    },
  },
  {
    name: 'dropbox_upload',
    description: 'Upload text content as a file to Dropbox.',
    inputSchema: {
      type: 'object',
      properties: {
        path:         { type: 'string', description: 'Dropbox destination path (e.g. /docs/file.txt)' },
        content:      { type: 'string', description: 'Text content to upload' },
        access_token: { type: 'string', description: 'Dropbox OAuth2 access token' },
      },
      required: ['path', 'content', 'access_token'],
    },
  },
  {
    name: 'dropbox_download',
    description: 'Download a file from Dropbox and return its text content.',
    inputSchema: {
      type: 'object',
      properties: {
        path:         { type: 'string', description: 'Dropbox file path (e.g. /docs/file.txt)' },
        access_token: { type: 'string', description: 'Dropbox OAuth2 access token' },
      },
      required: ['path', 'access_token'],
    },
  },
  {
    name: 'dropbox_share',
    description: 'Create a shared link for a Dropbox file.',
    inputSchema: {
      type: 'object',
      properties: {
        path:         { type: 'string', description: 'Dropbox file path' },
        access_token: { type: 'string', description: 'Dropbox OAuth2 access token' },
      },
      required: ['path', 'access_token'],
    },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const API_BASE     = 'https://api.dropboxapi.com/2';
const CONTENT_BASE = 'https://content.dropboxapi.com/2';

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function dbxApi(endpoint: string, token: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Dropbox API ${res.status}: ${text}`);
  return JSON.parse(text);
}

// ---------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------

export async function executeDropboxTool(
  name: string,
  input: Record<string, unknown>
): Promise<{ output: string; isError: boolean }> {
  try {
    const token = input.access_token as string;

    // -----------------------------------------------------------------------
    if (name === 'dropbox_list') {
      const path = (input.path as string | undefined) || '';
      const data = await dbxApi('/files/list_folder', token, { path }) as {
        entries: Array<{ '.tag': string; name: string; size?: number; client_modified?: string; path_display: string }>;
        has_more: boolean;
      };
      if (!data.entries.length) return { output: 'Directory is empty.', isError: false };
      const lines = data.entries.map(e => {
        const tag  = e['.tag'] === 'folder' ? 'd' : '-';
        const size = e.size != null ? String(e.size).padStart(12) : '           -';
        const date = (e.client_modified || '').slice(0, 10);
        return `${tag}  ${size}  ${date}  ${e.name}`;
      });
      return { output: `Contents (${data.entries.length})${data.has_more ? ' [more available]' : ''}:\n\n${lines.join('\n')}`, isError: false };
    }

    // -----------------------------------------------------------------------
    if (name === 'dropbox_upload') {
      const path    = input.path    as string;
      const content = input.content as string;
      const res = await fetch(`${CONTENT_BASE}/files/upload`, {
        method: 'POST',
        headers: {
          Authorization:       `Bearer ${token}`,
          'Content-Type':      'application/octet-stream',
          'Dropbox-API-Arg':   JSON.stringify({ path, mode: 'overwrite', autorename: false }),
        },
        body: content,
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`Dropbox upload ${res.status}: ${text}`);
      const data = JSON.parse(text) as { name: string; id: string; size: number };
      return { output: `Uploaded: ${data.name} (${data.size} bytes)\nID: ${data.id}`, isError: false };
    }

    // -----------------------------------------------------------------------
    if (name === 'dropbox_download') {
      const path = input.path as string;
      const res = await fetch(`${CONTENT_BASE}/files/download`, {
        method: 'POST',
        headers: {
          Authorization:     `Bearer ${token}`,
          'Dropbox-API-Arg': JSON.stringify({ path }),
        },
      });
      if (!res.ok) throw new Error(`Dropbox download ${res.status}: ${await res.text()}`);
      return { output: await res.text(), isError: false };
    }

    // -----------------------------------------------------------------------
    if (name === 'dropbox_share') {
      const path = input.path as string;
      // Try to create; if already exists get existing
      let data: { url: string; id: string } | undefined;
      try {
        data = await dbxApi('/sharing/create_shared_link_with_settings', token, { path }) as { url: string; id: string };
      } catch (err) {
        // If link already exists the API returns error with existing metadata
        const msg = (err as Error).message;
        const match = msg.match(/"url":"([^"]+)"/);
        if (match) {
          return { output: `Shared link: ${match[1]}`, isError: false };
        }
        throw err;
      }
      return { output: `Shared link: ${data.url}\nID: ${data.id}`, isError: false };
    }

    return { output: `Unknown Dropbox tool: ${name}`, isError: true };
  } catch (err: unknown) {
    return { output: (err as Error).message, isError: true };
  }
}
