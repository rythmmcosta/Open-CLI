import { getDb } from './index';
import { RecipeRow, RecipeRunRow, RecipeStep } from './types';
import { v4 as uuidv4 } from 'uuid';

export function createRecipe(
  name: string,
  description: string | null,
  steps: RecipeStep[]
): string {
  const db = getDb();
  const id = uuidv4();
  const now = Date.now();

  db.prepare(`
    INSERT INTO recipes (id, name, description, steps, created_at, last_run, run_count)
    VALUES (?, ?, ?, ?, ?, NULL, 0)
  `).run(id, name, description, JSON.stringify(steps), now);

  return id;
}

export function getRecipe(nameOrId: string): RecipeRow | null {
  const db = getDb();

  // Try by id first, then by name
  const byId = db
    .prepare('SELECT * FROM recipes WHERE id = ?')
    .get(nameOrId) as RecipeRow | undefined;
  if (byId) return byId;

  const byName = db
    .prepare('SELECT * FROM recipes WHERE name = ?')
    .get(nameOrId) as RecipeRow | undefined;
  return byName ?? null;
}

export function listRecipes(): RecipeRow[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM recipes ORDER BY last_run DESC, created_at DESC')
    .all() as RecipeRow[];
}

export function deleteRecipe(nameOrId: string): void {
  const db = getDb();
  // Try id match first, then name
  const result = db.prepare('DELETE FROM recipes WHERE id = ?').run(nameOrId);
  if (result.changes === 0) {
    db.prepare('DELETE FROM recipes WHERE name = ?').run(nameOrId);
  }
}

export function updateRecipe(id: string, updates: Partial<RecipeRow>): void {
  const db = getDb();
  const fields = Object.keys(updates) as (keyof RecipeRow)[];
  if (fields.length === 0) return;

  const setClauses = fields.map((f) => `${f} = ?`).join(', ');
  const values = fields.map((f) => updates[f]);

  db.prepare(`UPDATE recipes SET ${setClauses} WHERE id = ?`).run(...values, id);
}

export function recordRecipeRun(
  recipeId: string,
  status: string,
  output?: string,
  error?: string
): string {
  const db = getDb();
  const id = uuidv4();
  const now = Date.now();

  db.prepare(`
    INSERT INTO recipe_runs (id, recipe_id, started_at, completed_at, status, output, error)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    recipeId,
    now,
    status === 'running' ? null : now,
    status,
    output ?? null,
    error ?? null
  );

  if (status !== 'running') {
    db.prepare(`
      UPDATE recipes
      SET last_run  = ?,
          run_count = run_count + 1
      WHERE id = ?
    `).run(now, recipeId);
  }

  return id;
}

export function getRecipeRuns(recipeId: string, limit = 10): RecipeRunRow[] {
  const db = getDb();
  return db
    .prepare(
      'SELECT * FROM recipe_runs WHERE recipe_id = ? ORDER BY started_at DESC LIMIT ?'
    )
    .all(recipeId, limit) as RecipeRunRow[];
}
