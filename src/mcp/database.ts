import * as path from 'path';
import { ToolDef } from '../types';

export const dbQueryTool: ToolDef = {
  name: 'db_query',
  description: 'Execute a SQL query on a SQLite database file and return results',
  inputSchema: {
    type: 'object',
    properties: {
      db_path: { type: 'string', description: 'Path to the SQLite database file' },
      query: { type: 'string', description: 'SQL query to execute' },
      params: { type: 'array', description: 'Query parameters for prepared statements', items: { type: 'string' } },
    },
    required: ['db_path', 'query'],
  },
};

export const dbSchemaTool: ToolDef = {
  name: 'db_schema',
  description: 'Get the schema (tables, columns, types) of a SQLite database',
  inputSchema: {
    type: 'object',
    properties: {
      db_path: { type: 'string', description: 'Path to the SQLite database file' },
    },
    required: ['db_path'],
  },
};

export const databaseTools: ToolDef[] = [dbQueryTool, dbSchemaTool];

export async function executeDatabaseTool(
  name: string,
  input: Record<string, unknown>
): Promise<{ output: string; isError: boolean }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Database = require('better-sqlite3') as typeof import('better-sqlite3');
    const dbPath = path.resolve(input.db_path as string);
    const db = new Database(dbPath, { readonly: name === 'db_query' && (input.query as string).trim().toUpperCase().startsWith('SELECT') });

    if (name === 'db_schema') {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as Array<{ name: string }>;
      const schema: string[] = [];
      for (const table of tables) {
        const cols = db.prepare(`PRAGMA table_info(${table.name})`).all() as Array<{ name: string; type: string; notnull: number; dflt_value: unknown; pk: number }>;
        schema.push(`TABLE ${table.name}:`);
        for (const col of cols) {
          const flags = [
            col.pk ? 'PRIMARY KEY' : '',
            col.notnull ? 'NOT NULL' : '',
            col.dflt_value != null ? `DEFAULT ${col.dflt_value}` : '',
          ].filter(Boolean).join(' ');
          schema.push(`  ${col.name} ${col.type}${flags ? ' ' + flags : ''}`);
        }
        const count = (db.prepare(`SELECT COUNT(*) as c FROM "${table.name}"`).get() as { c: number }).c;
        schema.push(`  -- ${count} rows`);
        schema.push('');
      }
      db.close();
      return { output: schema.join('\n') || '(empty database)', isError: false };
    }

    if (name === 'db_query') {
      const params = (input.params as unknown[]) || [];
      const stmt = db.prepare(input.query as string);
      const query = (input.query as string).trim().toUpperCase();

      let result: string;
      if (query.startsWith('SELECT') || query.startsWith('WITH') || query.startsWith('PRAGMA')) {
        const rows = stmt.all(...params) as Record<string, unknown>[];
        if (rows.length === 0) {
          result = '(0 rows returned)';
        } else {
          const cols = Object.keys(rows[0]);
          const header = cols.join('\t');
          const sep = cols.map(() => '---').join('\t');
          const data = rows.slice(0, 100).map(r => cols.map(c => String(r[c] ?? 'NULL')).join('\t'));
          result = [header, sep, ...data].join('\n');
          if (rows.length > 100) result += `\n... (${rows.length - 100} more rows)`;
        }
      } else {
        const info = stmt.run(...params);
        result = `OK — ${info.changes} row(s) affected. Last ID: ${info.lastInsertRowid}`;
      }
      db.close();
      return { output: result, isError: false };
    }

    db.close();
    return { output: `Unknown database tool: ${name}`, isError: true };
  } catch (err: unknown) {
    return { output: (err as Error).message, isError: true };
  }
}
