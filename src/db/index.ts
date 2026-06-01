import Database from 'better-sqlite3';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

const DB_DIR = path.join(os.homedir(), '.config', 'opencli');
const DB_PATH = path.join(DB_DIR, 'projects.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    fs.mkdirSync(DB_DIR, { recursive: true });
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    initSchema(_db);
  }
  return _db;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      path         TEXT NOT NULL UNIQUE,
      description  TEXT,
      tech_stack   TEXT,
      github_url   TEXT,
      branch       TEXT,
      default_model TEXT,
      default_skill TEXT,
      created_at   INTEGER NOT NULL,
      last_accessed INTEGER NOT NULL,
      metadata     TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id            TEXT PRIMARY KEY,
      project_id    TEXT REFERENCES projects(id),
      model         TEXT NOT NULL,
      skill         TEXT NOT NULL,
      started_at    INTEGER NOT NULL,
      ended_at      INTEGER,
      msg_count     INTEGER NOT NULL DEFAULT 0,
      input_tokens  INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      cost_usd      REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS messages (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id  TEXT,
      project_id  TEXT,
      role        TEXT NOT NULL,
      content     TEXT NOT NULL,
      tool_calls  TEXT,
      tokens      INTEGER,
      created_at  INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tool_calls_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id  TEXT,
      project_id  TEXT,
      tool_name   TEXT NOT NULL,
      input       TEXT NOT NULL,
      output      TEXT NOT NULL,
      is_error    INTEGER NOT NULL,
      duration_ms INTEGER,
      created_at  INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS file_history (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id     TEXT,
      session_id     TEXT,
      file_path      TEXT NOT NULL,
      content_before TEXT,
      content_after  TEXT,
      created_at     INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS github_connections (
      id         TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      owner      TEXT NOT NULL,
      repo       TEXT NOT NULL,
      url        TEXT NOT NULL,
      branch     TEXT NOT NULL DEFAULT 'main',
      auto_push  INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS usage_stats (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id    TEXT,
      model         TEXT NOT NULL,
      provider      TEXT NOT NULL,
      input_tokens  INTEGER NOT NULL,
      output_tokens INTEGER NOT NULL,
      cost_usd      REAL NOT NULL,
      date          TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recipes (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL UNIQUE,
      description TEXT,
      steps       TEXT NOT NULL,
      created_at  INTEGER NOT NULL,
      last_run    INTEGER,
      run_count   INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS recipe_runs (
      id           TEXT PRIMARY KEY,
      recipe_id    TEXT NOT NULL REFERENCES recipes(id),
      started_at   INTEGER NOT NULL,
      completed_at INTEGER,
      status       TEXT NOT NULL,
      output       TEXT,
      error        TEXT
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS fts_messages USING fts5(
      content,
      project_id UNINDEXED,
      content='messages',
      content_rowid='id'
    );

    CREATE INDEX IF NOT EXISTS idx_projects_path       ON projects(path);
    CREATE INDEX IF NOT EXISTS idx_sessions_project_id ON sessions(project_id);
    CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_messages_project_id ON messages(project_id);
    CREATE INDEX IF NOT EXISTS idx_file_history_project_id ON file_history(project_id);
    CREATE INDEX IF NOT EXISTS idx_file_history_file_path  ON file_history(file_path);
  `);

  // Triggers to keep FTS index in sync with messages table
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
      INSERT INTO fts_messages(rowid, content, project_id)
      VALUES (new.id, new.content, new.project_id);
    END;

    CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
      INSERT INTO fts_messages(fts_messages, rowid, content, project_id)
      VALUES ('delete', old.id, old.content, old.project_id);
    END;

    CREATE TRIGGER IF NOT EXISTS messages_au AFTER UPDATE ON messages BEGIN
      INSERT INTO fts_messages(fts_messages, rowid, content, project_id)
      VALUES ('delete', old.id, old.content, old.project_id);
      INSERT INTO fts_messages(rowid, content, project_id)
      VALUES (new.id, new.content, new.project_id);
    END;
  `);
}
