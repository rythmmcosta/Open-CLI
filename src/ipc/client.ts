import * as net from 'net';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { fork } from 'child_process';
import { IPCMessage, WindowInfo } from './types';

export class IPCClient {
  private socket: net.Socket | null = null;
  private readonly windowId: string;
  private readonly socketPath: string;
  private connected = false;
  private pendingCallbacks = new Map<string, (msg: IPCMessage) => void>();
  private buffer = '';

  constructor(projectPath: string) {
    const hash = crypto.createHash('md5').update(projectPath).digest('hex').slice(0, 8);
    this.socketPath = `/tmp/opencli-${hash}.sock`;
    this.windowId = `window-${process.pid}-${Date.now()}`;
  }

  async connect(): Promise<void> {
    // Spawn coordinator if socket does not exist yet
    if (!fs.existsSync(this.socketPath)) {
      const child = fork(require.resolve('./coordinator'), [process.cwd()], {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();

      // Wait up to 3 seconds for the socket to appear
      const deadline = Date.now() + 3000;
      await new Promise<void>((resolve, reject) => {
        const poll = () => {
          if (fs.existsSync(this.socketPath)) return resolve();
          if (Date.now() >= deadline) return reject(new Error('Coordinator did not start in time'));
          setTimeout(poll, 50);
        };
        poll();
      });
    }

    // Connect to socket and register
    await new Promise<void>((resolve, reject) => {
      const sock = net.createConnection(this.socketPath, () => {
        this.socket = sock;
        this.connected = true;

        // Send register message
        this.send({
          type: 'register',
          windowId: this.windowId,
          pid: process.pid,
          projectPath: process.cwd(),
        });
      });

      sock.on('data', (data) => {
        this.buffer += data.toString();
        const lines = this.buffer.split('\n');
        this.buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const msg: IPCMessage = JSON.parse(line);
            this.handleMessage(msg, resolve);
          } catch {
            // ignore malformed messages
          }
        }
      });

      sock.on('error', (err) => {
        this.connected = false;
        reject(err);
      });

      sock.on('close', () => {
        this.connected = false;
      });
    });
  }

  private handleMessage(msg: IPCMessage, onRegistered?: () => void): void {
    if (msg.type === 'registered' && onRegistered) {
      onRegistered();
      return;
    }

    // Dispatch to pending callbacks keyed by filePath for lock acks
    if (msg.type === 'file_lock_ack') {
      const cb = this.pendingCallbacks.get(`lock:${msg.filePath}`);
      if (cb) {
        this.pendingCallbacks.delete(`lock:${msg.filePath}`);
        cb(msg);
      }
      return;
    }

    if (msg.type === 'context_response') {
      const cb = this.pendingCallbacks.get('context');
      if (cb) {
        this.pendingCallbacks.delete('context');
        cb(msg);
      }
      return;
    }
  }

  send(msg: IPCMessage): void {
    if (!this.socket || !this.connected) return;
    try {
      this.socket.write(JSON.stringify(msg) + '\n');
    } catch {
      // ignore write errors
    }
  }

  async lockFile(filePath: string): Promise<boolean> {
    if (!this.socket || !this.connected) return false;
    return new Promise<boolean>((resolve) => {
      const key = `lock:${filePath}`;
      // Timeout after 5 seconds
      const timer = setTimeout(() => {
        this.pendingCallbacks.delete(key);
        resolve(false);
      }, 5000);

      this.pendingCallbacks.set(key, (msg) => {
        clearTimeout(timer);
        if (msg.type === 'file_lock_ack') {
          resolve(msg.granted);
        } else {
          resolve(false);
        }
      });

      this.send({ type: 'file_lock', windowId: this.windowId, filePath });
    });
  }

  unlockFile(filePath: string): void {
    this.send({ type: 'file_unlock', windowId: this.windowId, filePath });
  }

  notifyFileWritten(filePath: string, summary: string): void {
    this.send({ type: 'file_written', windowId: this.windowId, filePath, summary });
  }

  broadcast(message: string): void {
    this.send({ type: 'broadcast', windowId: this.windowId, message });
  }

  async getContext(): Promise<{ activeWindows: WindowInfo[]; recentActions: string[] }> {
    if (!this.socket || !this.connected) {
      return { activeWindows: [], recentActions: [] };
    }

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pendingCallbacks.delete('context');
        resolve({ activeWindows: [], recentActions: [] });
      }, 5000);

      this.pendingCallbacks.set('context', (msg) => {
        clearTimeout(timer);
        if (msg.type === 'context_response') {
          resolve({ activeWindows: msg.activeWindows, recentActions: msg.recentActions });
        } else {
          resolve({ activeWindows: [], recentActions: [] });
        }
      });

      this.send({ type: 'query_context', windowId: this.windowId });
    });
  }

  disconnect(): void {
    if (this.socket) {
      try {
        this.send({ type: 'deregister', windowId: this.windowId });
        this.socket.end();
      } catch {
        // ignore
      }
      this.socket = null;
    }
    this.connected = false;
    this.pendingCallbacks.clear();
  }

  get id(): string {
    return this.windowId;
  }

  get isConnected(): boolean {
    return this.connected;
  }
}
