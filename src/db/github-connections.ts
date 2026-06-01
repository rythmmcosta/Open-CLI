import { getDb } from './index';
import { GithubConnectionRow } from './types';
import { v4 as uuidv4 } from 'uuid';

export function saveGithubConnection(params: {
  projectId: string;
  owner: string;
  repo: string;
  url: string;
  branch?: string;
  autoPush?: boolean;
}): string {
  const db = getDb();
  const id = uuidv4();
  const now = Date.now();

  // Remove any existing connection for this project first
  db.prepare('DELETE FROM github_connections WHERE project_id = ?').run(params.projectId);

  db.prepare(`
    INSERT INTO github_connections (id, project_id, owner, repo, url, branch, auto_push, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    params.projectId,
    params.owner,
    params.repo,
    params.url,
    params.branch ?? 'main',
    params.autoPush ? 1 : 0,
    now
  );

  return id;
}

export function getGithubConnection(projectId: string): GithubConnectionRow | null {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM github_connections WHERE project_id = ?')
    .get(projectId) as GithubConnectionRow | undefined;
  return row ?? null;
}

export function updateGithubConnection(
  id: string,
  updates: Partial<GithubConnectionRow>
): void {
  const db = getDb();
  const fields = Object.keys(updates) as (keyof GithubConnectionRow)[];
  if (fields.length === 0) return;

  const setClauses = fields.map((f) => `${f} = ?`).join(', ');
  const values = fields.map((f) => updates[f]);

  db.prepare(`UPDATE github_connections SET ${setClauses} WHERE id = ?`).run(...values, id);
}

export function deleteGithubConnection(id: string): void {
  const db = getDb();
  db.prepare('DELETE FROM github_connections WHERE id = ?').run(id);
}
