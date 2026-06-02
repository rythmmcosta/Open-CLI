import { ToolDef } from '../types';
import * as ftp from 'basic-ftp';
import { Readable } from 'stream';

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export const ftpTools: ToolDef[] = [
  {
    name: 'ftp_list',
    description: 'List files and directories in an FTP directory.',
    inputSchema: {
      type: 'object',
      properties: {
        host:     { type: 'string', description: 'FTP host' },
        port:     { type: 'number', description: 'FTP port (default: 21)' },
        user:     { type: 'string', description: 'FTP username' },
        password: { type: 'string', description: 'FTP password' },
        path:     { type: 'string', description: 'Remote directory path (default: /)' },
      },
      required: ['host', 'user', 'password'],
    },
  },
  {
    name: 'ftp_upload',
    description: 'Upload text content as a file to an FTP server.',
    inputSchema: {
      type: 'object',
      properties: {
        host:        { type: 'string', description: 'FTP host' },
        port:        { type: 'number', description: 'FTP port (default: 21)' },
        user:        { type: 'string', description: 'FTP username' },
        password:    { type: 'string', description: 'FTP password' },
        remote_path: { type: 'string', description: 'Remote file path (e.g. /uploads/file.txt)' },
        content:     { type: 'string', description: 'Text content to upload' },
      },
      required: ['host', 'user', 'password', 'remote_path', 'content'],
    },
  },
  {
    name: 'ftp_download',
    description: 'Download a file from an FTP server and return its text content.',
    inputSchema: {
      type: 'object',
      properties: {
        host:        { type: 'string', description: 'FTP host' },
        port:        { type: 'number', description: 'FTP port (default: 21)' },
        user:        { type: 'string', description: 'FTP username' },
        password:    { type: 'string', description: 'FTP password' },
        remote_path: { type: 'string', description: 'Remote file path to download' },
      },
      required: ['host', 'user', 'password', 'remote_path'],
    },
  },
  {
    name: 'ftp_delete',
    description: 'Delete a file on an FTP server.',
    inputSchema: {
      type: 'object',
      properties: {
        host:        { type: 'string', description: 'FTP host' },
        port:        { type: 'number', description: 'FTP port (default: 21)' },
        user:        { type: 'string', description: 'FTP username' },
        password:    { type: 'string', description: 'FTP password' },
        remote_path: { type: 'string', description: 'Remote file path to delete' },
      },
      required: ['host', 'user', 'password', 'remote_path'],
    },
  },
  {
    name: 'ftp_mkdir',
    description: 'Create a directory on an FTP server.',
    inputSchema: {
      type: 'object',
      properties: {
        host:     { type: 'string', description: 'FTP host' },
        port:     { type: 'number', description: 'FTP port (default: 21)' },
        user:     { type: 'string', description: 'FTP username' },
        password: { type: 'string', description: 'FTP password' },
        dir_path: { type: 'string', description: 'Directory path to create' },
      },
      required: ['host', 'user', 'password', 'dir_path'],
    },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function withFtp<T>(
  host: string,
  port: number,
  user: string,
  password: string,
  action: (client: ftp.Client) => Promise<T>
): Promise<T> {
  const client = new ftp.Client();
  client.ftp.verbose = false;
  try {
    await client.access({ host, port, user, password, secure: false });
    return await action(client);
  } finally {
    client.close();
  }
}

// ---------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------

export async function executeFtpTool(
  name: string,
  input: Record<string, unknown>
): Promise<{ output: string; isError: boolean }> {
  try {
    const host     = input.host     as string;
    const port     = (input.port    as number | undefined) || 21;
    const user     = input.user     as string;
    const password = input.password as string;

    // -----------------------------------------------------------------------
    if (name === 'ftp_list') {
      const path = (input.path as string | undefined) || '/';
      const items = await withFtp(host, port, user, password, async client => {
        await client.cd(path);
        return client.list();
      });
      if (!items.length) return { output: `Directory ${path} is empty.`, isError: false };
      const lines = items.map((it: ftp.FileInfo) => {
        const type = it.type === ftp.FileType.Directory ? 'd' : '-';
        const size = it.size != null ? String(it.size).padStart(12) : '           -';
        const date = it.modifiedAt ? it.modifiedAt.toISOString().slice(0, 10) : '          ';
        return `${type}  ${size}  ${date}  ${it.name}`;
      });
      return { output: `Contents of ${path} (${items.length} items):\n\n${lines.join('\n')}`, isError: false };
    }

    // -----------------------------------------------------------------------
    if (name === 'ftp_upload') {
      const remotePath = input.remote_path as string;
      const content    = input.content    as string;
      const buf = Buffer.from(content, 'utf-8');
      const stream = new Readable({ read() { this.push(buf); this.push(null); } });
      await withFtp(host, port, user, password, async client => {
        await client.uploadFrom(stream, remotePath);
      });
      return { output: `Uploaded ${buf.length} bytes to ${remotePath}`, isError: false };
    }

    // -----------------------------------------------------------------------
    if (name === 'ftp_download') {
      const remotePath = input.remote_path as string;
      const chunks: Buffer[] = [];
      await withFtp(host, port, user, password, async client => {
        const writable = new (require('stream').Writable)({
          write(chunk: Buffer, _enc: string, cb: () => void) { chunks.push(chunk); cb(); },
        });
        await client.downloadTo(writable, remotePath);
      });
      return { output: Buffer.concat(chunks).toString('utf-8'), isError: false };
    }

    // -----------------------------------------------------------------------
    if (name === 'ftp_delete') {
      const remotePath = input.remote_path as string;
      await withFtp(host, port, user, password, async client => {
        await client.remove(remotePath);
      });
      return { output: `Deleted ${remotePath}`, isError: false };
    }

    // -----------------------------------------------------------------------
    if (name === 'ftp_mkdir') {
      const dirPath = input.dir_path as string;
      await withFtp(host, port, user, password, async client => {
        await client.ensureDir(dirPath);
      });
      return { output: `Directory created: ${dirPath}`, isError: false };
    }

    return { output: `Unknown FTP tool: ${name}`, isError: true };
  } catch (err: unknown) {
    return { output: (err as Error).message, isError: true };
  }
}
