export type IPCMessage =
  | { type: 'register'; windowId: string; pid: number; projectPath: string }
  | { type: 'registered'; windowId: string; activeWindows: WindowInfo[] }
  | { type: 'file_lock'; windowId: string; filePath: string }
  | { type: 'file_lock_ack'; windowId: string; filePath: string; granted: boolean; heldBy?: string }
  | { type: 'file_unlock'; windowId: string; filePath: string }
  | { type: 'file_written'; windowId: string; filePath: string; summary: string }
  | { type: 'broadcast'; windowId: string; message: string }
  | { type: 'query_context'; windowId: string }
  | { type: 'context_response'; activeWindows: WindowInfo[]; recentActions: string[] }
  | { type: 'ping' }
  | { type: 'pong' }
  | { type: 'deregister'; windowId: string };

export interface WindowInfo {
  windowId: string;
  pid: number;
  projectPath: string;
  currentFile?: string;
  lastAction?: string;
  connectedAt: number;
}
