import fetch from 'node-fetch';
import { ToolDef } from '../types';

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export const gdriveTools: ToolDef[] = [
  {
    name: 'gdrive_list',
    description: 'List files in a Google Drive folder.',
    inputSchema: {
      type: 'object',
      properties: {
        folder_id:    { type: 'string', description: 'Folder ID to list (default: root)' },
        access_token: { type: 'string', description: 'Google OAuth2 access token' },
      },
      required: ['access_token'],
    },
  },
  {
    name: 'gdrive_upload',
    description: 'Upload text content as a file to Google Drive.',
    inputSchema: {
      type: 'object',
      properties: {
        name:             { type: 'string', description: 'File name' },
        content:          { type: 'string', description: 'Text content to upload' },
        parent_folder_id: { type: 'string', description: 'Parent folder ID (default: root)' },
        access_token:     { type: 'string', description: 'Google OAuth2 access token' },
      },
      required: ['name', 'content', 'access_token'],
    },
  },
  {
    name: 'gdrive_download',
    description: 'Download a file from Google Drive and return its text content.',
    inputSchema: {
      type: 'object',
      properties: {
        file_id:      { type: 'string', description: 'File ID to download' },
        access_token: { type: 'string', description: 'Google OAuth2 access token' },
      },
      required: ['file_id', 'access_token'],
    },
  },
  {
    name: 'gdrive_create_folder',
    description: 'Create a folder in Google Drive.',
    inputSchema: {
      type: 'object',
      properties: {
        name:             { type: 'string', description: 'Folder name' },
        parent_folder_id: { type: 'string', description: 'Parent folder ID (default: root)' },
        access_token:     { type: 'string', description: 'Google OAuth2 access token' },
      },
      required: ['name', 'access_token'],
    },
  },
  {
    name: 'gdrive_share',
    description: 'Share a Google Drive file with a user by email.',
    inputSchema: {
      type: 'object',
      properties: {
        file_id:      { type: 'string', description: 'File ID to share' },
        email:        { type: 'string', description: 'Email address to share with' },
        role:         { type: 'string', description: 'Role: reader, commenter, writer', enum: ['reader', 'commenter', 'writer'] },
        access_token: { type: 'string', description: 'Google OAuth2 access token' },
      },
      required: ['file_id', 'email', 'role', 'access_token'],
    },
  },
  {
    name: 'gdrive_search',
    description: 'Search for files in Google Drive using a full-text query.',
    inputSchema: {
      type: 'object',
      properties: {
        query:        { type: 'string', description: 'Search query (e.g. "report 2024")' },
        access_token: { type: 'string', description: 'Google OAuth2 access token' },
      },
      required: ['query', 'access_token'],
    },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE = 'https://www.googleapis.com';
const UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function driveApiFetch(url: string, token: string, opts: Parameters<typeof fetch>[1] = {}): Promise<unknown> {
  const res = await fetch(url, {
    ...opts,
    headers: { ...authHeaders(token), ...(opts.headers as Record<string, string> | undefined) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Drive API ${res.status}: ${text}`);
  try { return JSON.parse(text); } catch { return text; }
}

// ---------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------

export async function executeGdriveTool(
  name: string,
  input: Record<string, unknown>
): Promise<{ output: string; isError: boolean }> {
  try {
    const token = input.access_token as string;

    // -----------------------------------------------------------------------
    if (name === 'gdrive_list') {
      const folderId = (input.folder_id as string | undefined) || 'root';
      const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
      const url = `${BASE}/drive/v3/files?q=${q}&fields=files(id,name,mimeType,size,modifiedTime)&pageSize=50`;
      const data = await driveApiFetch(url, token) as { files: Array<{ id: string; name: string; mimeType: string; size?: string; modifiedTime: string }> };
      if (!data.files || data.files.length === 0) return { output: 'No files found.', isError: false };
      const lines = data.files.map(f =>
        `${f.id}  ${(f.size || '—').padStart(10)}  ${f.modifiedTime.slice(0, 10)}  ${f.mimeType.split('.').pop()}  ${f.name}`
      );
      return { output: `Files in folder (${data.files.length}):\n\n${lines.join('\n')}`, isError: false };
    }

    // -----------------------------------------------------------------------
    if (name === 'gdrive_upload') {
      const fileName = input.name as string;
      const content  = input.content as string;
      const parentId = (input.parent_folder_id as string | undefined) || 'root';

      const metadata = { name: fileName, parents: [parentId] };
      const boundary = 'open_cli_boundary';
      const multipart =
        `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(metadata)}\r\n` +
        `--${boundary}\r\nContent-Type: text/plain\r\n\r\n${content}\r\n` +
        `--${boundary}--`;

      const res = await fetch(`${UPLOAD_BASE}/files?uploadType=multipart&fields=id,name,webViewLink`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipart,
      });
      const data = await res.json() as { id: string; name: string; webViewLink: string };
      if (!res.ok) throw new Error(`Upload error ${res.status}: ${JSON.stringify(data)}`);
      return { output: `Uploaded: ${data.name}\nID: ${data.id}\nURL: ${data.webViewLink}`, isError: false };
    }

    // -----------------------------------------------------------------------
    if (name === 'gdrive_download') {
      const fileId = input.file_id as string;
      const res = await fetch(`${BASE}/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Download error ${res.status}: ${await res.text()}`);
      const content = await res.text();
      return { output: content, isError: false };
    }

    // -----------------------------------------------------------------------
    if (name === 'gdrive_create_folder') {
      const folderName = input.name as string;
      const parentId   = (input.parent_folder_id as string | undefined) || 'root';
      const data = await driveApiFetch(`${BASE}/drive/v3/files?fields=id,name`, token, {
        method: 'POST',
        body: JSON.stringify({ name: folderName, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
      }) as { id: string; name: string };
      return { output: `Folder created: ${data.name}\nID: ${data.id}`, isError: false };
    }

    // -----------------------------------------------------------------------
    if (name === 'gdrive_share') {
      const fileId = input.file_id as string;
      const email  = input.email as string;
      const role   = input.role as string;
      const data = await driveApiFetch(`${BASE}/drive/v3/files/${fileId}/permissions`, token, {
        method: 'POST',
        body: JSON.stringify({ type: 'user', role, emailAddress: email }),
      }) as { id: string };
      return { output: `Shared file ${fileId} with ${email} as ${role} (permission id: ${data.id})`, isError: false };
    }

    // -----------------------------------------------------------------------
    if (name === 'gdrive_search') {
      const query = input.query as string;
      const q = encodeURIComponent(`fullText contains '${query}' and trashed = false`);
      const url = `${BASE}/drive/v3/files?q=${q}&fields=files(id,name,mimeType,modifiedTime)&pageSize=20`;
      const data = await driveApiFetch(url, token) as { files: Array<{ id: string; name: string; mimeType: string; modifiedTime: string }> };
      if (!data.files || data.files.length === 0) return { output: 'No results found.', isError: false };
      const lines = data.files.map(f => `${f.id}  ${f.modifiedTime.slice(0, 10)}  ${f.name}`);
      return { output: `Search results for "${query}" (${data.files.length}):\n\n${lines.join('\n')}`, isError: false };
    }

    return { output: `Unknown Google Drive tool: ${name}`, isError: true };
  } catch (err: unknown) {
    return { output: (err as Error).message, isError: true };
  }
}
