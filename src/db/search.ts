import { getDb } from './index';
import { MessageRow } from './types';

export function searchAllHistory(
  query: string,
  limit = 20
): Array<MessageRow & { project_name?: string }> {
  const db = getDb();

  return db
    .prepare(`
      SELECT m.*,
             p.name AS project_name
      FROM fts_messages f
      JOIN messages m ON m.id = f.rowid
      LEFT JOIN projects p ON p.id = m.project_id
      WHERE fts_messages MATCH ?
      ORDER BY rank
      LIMIT ?
    `)
    .all(query, limit) as Array<MessageRow & { project_name?: string }>;
}
