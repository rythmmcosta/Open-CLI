import { getDb } from './index';
import { FileHistoryRow } from './types';

export function recordFileWrite(params: {
  projectId: string | null;
  sessionId: string | null;
  filePath: string;
  contentBefore: string | null;
  contentAfter: string;
}): number {
  const db = getDb();
  const now = Date.now();

  const result = db.prepare(`
    INSERT INTO file_history
      (project_id, session_id, file_path, content_before, content_after, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    params.projectId,
    params.sessionId,
    params.filePath,
    params.contentBefore,
    params.contentAfter,
    now
  );

  return result.lastInsertRowid as number;
}

export function getFileHistory(projectId: string, filePath?: string): FileHistoryRow[] {
  const db = getDb();

  if (filePath) {
    return db
      .prepare(
        'SELECT * FROM file_history WHERE project_id = ? AND file_path = ? ORDER BY created_at DESC'
      )
      .all(projectId, filePath) as FileHistoryRow[];
  }

  return db
    .prepare(
      'SELECT * FROM file_history WHERE project_id = ? ORDER BY created_at DESC'
    )
    .all(projectId) as FileHistoryRow[];
}

export function rollbackFile(historyId: number): { filePath: string; content: string } | null {
  const db = getDb();
  const row = db
    .prepare('SELECT file_path, content_before FROM file_history WHERE id = ?')
    .get(historyId) as { file_path: string; content_before: string | null } | undefined;

  if (!row || row.content_before === null) return null;

  return { filePath: row.file_path, content: row.content_before };
}

export function getTimeline(projectId: string, limit = 100): FileHistoryRow[] {
  const db = getDb();
  return db
    .prepare(
      'SELECT * FROM file_history WHERE project_id = ? ORDER BY created_at DESC LIMIT ?'
    )
    .all(projectId, limit) as FileHistoryRow[];
}
