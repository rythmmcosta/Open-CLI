import { getDb } from './index';
import { MessageRow } from './types';

export function saveMessage(params: {
  sessionId: string | null;
  projectId: string | null;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: unknown[];
  tokens?: number;
}): void {
  const db = getDb();
  const now = Date.now();
  const toolCallsJson =
    params.toolCalls && params.toolCalls.length > 0
      ? JSON.stringify(params.toolCalls)
      : null;

  db.prepare(`
    INSERT INTO messages (session_id, project_id, role, content, tool_calls, tokens, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    params.sessionId,
    params.projectId,
    params.role,
    params.content,
    toolCallsJson,
    params.tokens ?? null,
    now
  );
}

export function getSessionMessages(sessionId: string): MessageRow[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC')
    .all(sessionId) as MessageRow[];
}

export function getProjectHistory(projectId: string, limit = 50): MessageRow[] {
  const db = getDb();
  return db
    .prepare(
      'SELECT * FROM messages WHERE project_id = ? ORDER BY created_at DESC LIMIT ?'
    )
    .all(projectId, limit) as MessageRow[];
}

export function searchMessages(query: string, projectId?: string): MessageRow[] {
  const db = getDb();

  if (projectId) {
    return db
      .prepare(`
        SELECT m.*
        FROM fts_messages f
        JOIN messages m ON m.id = f.rowid
        WHERE fts_messages MATCH ?
          AND f.project_id = ?
        ORDER BY rank
      `)
      .all(query, projectId) as MessageRow[];
  }

  return db
    .prepare(`
      SELECT m.*
      FROM fts_messages f
      JOIN messages m ON m.id = f.rowid
      WHERE fts_messages MATCH ?
      ORDER BY rank
    `)
    .all(query) as MessageRow[];
}
