import * as net from 'net';
import * as path from 'path';
import * as fs from 'fs';
import { IPCMessage, WindowInfo } from './types';

// Socket path: /tmp/opencli-<hash-of-project-path>.sock
// Called with: node coordinator.js <projectPath>

const projectPath = process.argv[2] || process.cwd();
const projectHash = require('crypto').createHash('md5').update(projectPath).digest('hex').slice(0, 8);
const SOCKET_PATH = `/tmp/opencli-${projectHash}.sock`;
const IDLE_TIMEOUT = 60000; // exit 60s after last disconnect

const windows = new Map<string, { info: WindowInfo; socket: net.Socket }>();
const fileLocks = new Map<string, string>(); // filePath → windowId
let idleTimer: NodeJS.Timeout | null = null;

// Clean up socket on exit
process.on('exit', () => { try { fs.unlinkSync(SOCKET_PATH); } catch {} });
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));

// Remove stale socket
try { fs.unlinkSync(SOCKET_PATH); } catch {}

const server = net.createServer((socket) => {
  let windowId = '';
  let buffer = '';

  socket.on('data', (data) => {
    buffer += data.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg: IPCMessage = JSON.parse(line);
        handleMessage(msg, socket);
      } catch {}
    }
  });

  socket.on('close', () => {
    if (windowId) {
      windows.delete(windowId);
      // Release all locks held by this window
      for (const [fp, wid] of fileLocks.entries()) {
        if (wid === windowId) fileLocks.delete(fp);
      }
      broadcastAll({ type: 'broadcast', windowId: 'coordinator', message: `Window ${windowId} disconnected` }, windowId);
    }
    if (windows.size === 0) {
      idleTimer = setTimeout(() => process.exit(0), IDLE_TIMEOUT);
    }
  });

  function handleMessage(msg: IPCMessage, sock: net.Socket) {
    if (msg.type === 'register') {
      windowId = msg.windowId;
      if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
      windows.set(windowId, { info: { ...msg, connectedAt: Date.now() }, socket: sock });
      send(sock, { type: 'registered', windowId, activeWindows: Array.from(windows.values()).map(w => w.info) });
      broadcastAll({ type: 'broadcast', windowId: 'coordinator', message: `Window ${windowId} joined` }, windowId);
    } else if (msg.type === 'file_lock') {
      const held = fileLocks.get(msg.filePath);
      if (!held || held === msg.windowId) {
        fileLocks.set(msg.filePath, msg.windowId);
        send(sock, { type: 'file_lock_ack', windowId: msg.windowId, filePath: msg.filePath, granted: true });
        // Update window's currentFile
        const w = windows.get(msg.windowId);
        if (w) w.info.currentFile = msg.filePath;
      } else {
        send(sock, { type: 'file_lock_ack', windowId: msg.windowId, filePath: msg.filePath, granted: false, heldBy: held });
      }
    } else if (msg.type === 'file_unlock') {
      if (fileLocks.get(msg.filePath) === msg.windowId) fileLocks.delete(msg.filePath);
    } else if (msg.type === 'file_written') {
      broadcastAll({ type: 'broadcast', windowId: msg.windowId, message: `${msg.windowId} wrote ${msg.filePath}: ${msg.summary}` }, msg.windowId);
      const w = windows.get(msg.windowId);
      if (w) w.info.lastAction = `wrote ${path.basename(msg.filePath)}`;
    } else if (msg.type === 'query_context') {
      send(sock, { type: 'context_response', activeWindows: Array.from(windows.values()).map(w => w.info), recentActions: [] });
    } else if (msg.type === 'ping') {
      send(sock, { type: 'pong' });
    } else if (msg.type === 'deregister') {
      windows.delete(msg.windowId);
    }
  }
});

function send(sock: net.Socket, msg: object) {
  try { sock.write(JSON.stringify(msg) + '\n'); } catch {}
}

function broadcastAll(msg: object, excludeWindowId?: string) {
  for (const [wid, { socket }] of windows.entries()) {
    if (wid !== excludeWindowId) send(socket, msg);
  }
}

server.listen(SOCKET_PATH, () => {
  // Write socket path to stderr so parent can confirm startup
  process.stderr.write(`coordinator:ready:${SOCKET_PATH}\n`);
});
