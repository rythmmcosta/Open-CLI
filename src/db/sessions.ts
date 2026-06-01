import { getDb } from './index';
import { SessionRow } from './types';
import { v4 as uuidv4 } from 'uuid';

export function createSession(
  projectId: string | null,
  model: string,
  skill: string
): string {
  const db = getDb();
  const id = uuidv4();
  const now = Date.now();

  db.prepare(`
    INSERT INTO sessions (id, project_id, model, skill, started_at, ended_at,
      msg_count, input_tokens, output_tokens, cost_usd)
    VALUES (?, ?, ?, ?, ?, NULL, 0, 0, 0, 0)
  `).run(id, projectId, model, skill, now);

  return id;
}

export function closeSession(
  sessionId: string,
  usage?: { inputTokens: number; outputTokens: number; costUsd: number }
): void {
  const db = getDb();
  const now = Date.now();

  if (usage) {
    db.prepare(`
      UPDATE sessions
      SET ended_at = ?,
          input_tokens  = input_tokens  + ?,
          output_tokens = output_tokens + ?,
          cost_usd      = cost_usd      + ?
      WHERE id = ?
    `).run(now, usage.inputTokens, usage.outputTokens, usage.costUsd, sessionId);
  } else {
    db.prepare('UPDATE sessions SET ended_at = ? WHERE id = ?').run(now, sessionId);
  }
}

export function getSession(id: string): SessionRow | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as SessionRow | undefined;
  return row ?? null;
}

export function listSessions(projectId: string, limit = 20): SessionRow[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM sessions WHERE project_id = ? ORDER BY started_at DESC LIMIT ?')
    .all(projectId, limit) as SessionRow[];
}

export function updateSessionStats(
  sessionId: string,
  inputTokens: number,
  outputTokens: number
): void {
  const db = getDb();
  db.prepare(`
    UPDATE sessions
    SET input_tokens  = input_tokens  + ?,
        output_tokens = output_tokens + ?,
        msg_count     = msg_count     + 1
    WHERE id = ?
  `).run(inputTokens, outputTokens, sessionId);
}
