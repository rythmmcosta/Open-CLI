import { getDb } from './index';
import { ToolCallLogRow } from './types';

export function logToolCall(params: {
  sessionId: string | null;
  projectId: string | null;
  toolName: string;
  input: unknown;
  output: string;
  isError: boolean;
  durationMs?: number;
}): void {
  const db = getDb();
  const now = Date.now();

  db.prepare(`
    INSERT INTO tool_calls_log
      (session_id, project_id, tool_name, input, output, is_error, duration_ms, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    params.sessionId,
    params.projectId,
    params.toolName,
    JSON.stringify(params.input),
    params.output,
    params.isError ? 1 : 0,
    params.durationMs ?? null,
    now
  );
}

export function getSessionToolCalls(sessionId: string): ToolCallLogRow[] {
  const db = getDb();
  return db
    .prepare(
      'SELECT * FROM tool_calls_log WHERE session_id = ? ORDER BY created_at ASC'
    )
    .all(sessionId) as ToolCallLogRow[];
}
