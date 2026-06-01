import { getDb } from './index';
import { ProjectRow } from './types';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';

export function detectTechStack(projectPath: string): string[] {
  const stack: string[] = [];

  if (fs.existsSync(path.join(projectPath, 'go.mod'))) {
    stack.push('Go');
  }

  if (fs.existsSync(path.join(projectPath, 'Cargo.toml'))) {
    stack.push('Rust');
  }

  if (fs.existsSync(path.join(projectPath, 'requirements.txt')) ||
      fs.existsSync(path.join(projectPath, 'pyproject.toml')) ||
      fs.existsSync(path.join(projectPath, 'setup.py'))) {
    stack.push('Python');
  }

  if (fs.existsSync(path.join(projectPath, 'composer.json'))) {
    stack.push('PHP');
  }

  if (fs.existsSync(path.join(projectPath, 'Gemfile'))) {
    stack.push('Ruby');
  }

  if (fs.existsSync(path.join(projectPath, 'pom.xml')) ||
      fs.existsSync(path.join(projectPath, 'build.gradle'))) {
    stack.push('Java');
  }

  if (fs.existsSync(path.join(projectPath, 'Package.swift'))) {
    stack.push('Swift');
  }

  const pkgJsonPath = path.join(projectPath, 'package.json');
  if (fs.existsSync(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };

      if ('typescript' in allDeps) {
        stack.push('TypeScript');
      } else {
        stack.push('JavaScript');
      }

      if ('react' in allDeps || 'react-dom' in allDeps) stack.push('React');
      if ('vue' in allDeps) stack.push('Vue');
      if ('svelte' in allDeps) stack.push('@sveltejs/kit' in allDeps ? 'SvelteKit' : 'Svelte');
      if ('next' in allDeps) stack.push('Next.js');
      if ('nuxt' in allDeps) stack.push('Nuxt');
      if ('express' in allDeps) stack.push('Express');
      if ('fastify' in allDeps) stack.push('Fastify');
      if ('electron' in allDeps) stack.push('Electron');
      if ('tailwindcss' in allDeps) stack.push('Tailwind');
    } catch {
      stack.push('Node.js');
    }
  }

  return [...new Set(stack)];
}

export function upsertProject(projectPath: string): ProjectRow {
  const db = getDb();
  const now = Date.now();
  const absPath = path.resolve(projectPath);
  const name = path.basename(absPath);

  const existing = db
    .prepare('SELECT * FROM projects WHERE path = ?')
    .get(absPath) as ProjectRow | undefined;

  if (existing) {
    db.prepare('UPDATE projects SET last_accessed = ? WHERE id = ?').run(now, existing.id);
    return { ...existing, last_accessed: now };
  }

  const techStack = detectTechStack(absPath);
  const id = uuidv4();

  const row: ProjectRow = {
    id,
    name,
    path: absPath,
    description: null,
    tech_stack: techStack.length > 0 ? JSON.stringify(techStack) : null,
    github_url: null,
    branch: null,
    default_model: null,
    default_skill: null,
    created_at: now,
    last_accessed: now,
    metadata: null,
  };

  db.prepare(`
    INSERT INTO projects (id, name, path, description, tech_stack, github_url, branch,
      default_model, default_skill, created_at, last_accessed, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    row.id, row.name, row.path, row.description, row.tech_stack,
    row.github_url, row.branch, row.default_model, row.default_skill,
    row.created_at, row.last_accessed, row.metadata
  );

  return row;
}

export function getProject(id: string): ProjectRow | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow | undefined;
  return row ?? null;
}

export function getProjectByPath(projectPath: string): ProjectRow | null {
  const db = getDb();
  const absPath = path.resolve(projectPath);
  const row = db
    .prepare('SELECT * FROM projects WHERE path = ?')
    .get(absPath) as ProjectRow | undefined;
  return row ?? null;
}

export function listProjects(): ProjectRow[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM projects ORDER BY last_accessed DESC')
    .all() as ProjectRow[];
}

export function updateProject(id: string, updates: Partial<ProjectRow>): void {
  const db = getDb();
  const fields = Object.keys(updates) as (keyof ProjectRow)[];
  if (fields.length === 0) return;

  const setClauses = fields.map((f) => `${f} = ?`).join(', ');
  const values = fields.map((f) => updates[f]);

  db.prepare(`UPDATE projects SET ${setClauses} WHERE id = ?`).run(...values, id);
}

export function deleteProject(id: string): void {
  const db = getDb();
  db.prepare('DELETE FROM projects WHERE id = ?').run(id);
}

export function getCurrentProject(): ProjectRow | null {
  const cwd = process.cwd();
  return upsertProject(cwd);
}
