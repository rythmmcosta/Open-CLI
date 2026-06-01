import { ToolDef } from '../types';

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export const postgresTools: ToolDef[] = [
  {
    name: 'pg_query',
    description: 'Execute a SQL query on a PostgreSQL database and return results.',
    inputSchema: {
      type: 'object',
      properties: {
        connectionString: { type: 'string', description: 'PostgreSQL connection string, e.g. postgres://user:pass@localhost:5432/mydb' },
        query:            { type: 'string', description: 'SQL query to execute' },
        params:           { type: 'array',  description: 'Parameterized query values ($1, $2, …)', items: { type: 'string' } },
      },
      required: ['connectionString', 'query'],
    },
  },
  {
    name: 'pg_schema',
    description: 'Describe the columns of a PostgreSQL table from information_schema.',
    inputSchema: {
      type: 'object',
      properties: {
        connectionString: { type: 'string', description: 'PostgreSQL connection string' },
        tableName:        { type: 'string', description: 'Table name to inspect' },
      },
      required: ['connectionString', 'tableName'],
    },
  },
  {
    name: 'pg_tables',
    description: 'List all tables in the public schema of a PostgreSQL database.',
    inputSchema: {
      type: 'object',
      properties: {
        connectionString: { type: 'string', description: 'PostgreSQL connection string' },
      },
      required: ['connectionString'],
    },
  },
  {
    name: 'pg_insert',
    description: 'Insert a row into a PostgreSQL table and return the inserted record.',
    inputSchema: {
      type: 'object',
      properties: {
        connectionString: { type: 'string', description: 'PostgreSQL connection string' },
        table:            { type: 'string', description: 'Table name' },
        row:              { type: 'object', description: 'Object whose keys are column names and values are the data to insert' },
      },
      required: ['connectionString', 'table', 'row'],
    },
  },
  {
    name: 'pg_update',
    description: 'Update rows in a PostgreSQL table that match a WHERE clause.',
    inputSchema: {
      type: 'object',
      properties: {
        connectionString: { type: 'string', description: 'PostgreSQL connection string' },
        table:            { type: 'string', description: 'Table name' },
        where:            { type: 'object', description: 'Column/value pairs used in the WHERE clause (AND-ed together)' },
        updates:          { type: 'object', description: 'Column/value pairs to SET' },
      },
      required: ['connectionString', 'table', 'where', 'updates'],
    },
  },
];

// ---------------------------------------------------------------------------
// Helper — dynamic pg require
// ---------------------------------------------------------------------------

interface PGClient {
  connect(): Promise<void>;
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
  end(): Promise<void>;
}

async function getClient(connString: string): Promise<PGClient> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Client } = require('pg') as { Client: new (opts: { connectionString: string }) => PGClient };
    const client = new Client({ connectionString: connString });
    await client.connect();
    return client;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('Cannot find module')) throw new Error('pg not installed. Run: npm install pg');
    throw e;
  }
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

function formatRows(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '(0 rows)';
  const cols = Object.keys(rows[0]);
  const widths = cols.map(c => Math.max(c.length, ...rows.map(r => String(r[c] ?? 'NULL').length)));
  const header = cols.map((c, i) => pad(c, widths[i])).join('  |  ');
  const sep    = widths.map(w => '─'.repeat(w)).join('──┼──');
  const body   = rows.slice(0, 200).map(r =>
    cols.map((c, i) => pad(String(r[c] ?? 'NULL'), widths[i])).join('  |  ')
  );
  const trailer = rows.length > 200 ? [`\n… (${rows.length - 200} more rows)`] : [];
  return [header, sep, ...body, ...trailer].join('\n');
}

// ---------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------

export async function executePostgresTool(
  name: string,
  input: Record<string, unknown>
): Promise<{ output: string; isError: boolean }> {
  const connStr = input.connectionString as string;
  let client: PGClient | undefined;

  try {
    // -----------------------------------------------------------------------
    if (name === 'pg_query') {
      client = await getClient(connStr);
      try {
        const params = (input.params as unknown[] | undefined) || [];
        const result = await client.query(input.query as string, params);
        const rowCount = result.rowCount ?? result.rows.length;
        const body = formatRows(result.rows);
        return { output: `${rowCount} row(s) returned:\n\n${body}`, isError: false };
      } finally { await client.end(); }
    }

    // -----------------------------------------------------------------------
    if (name === 'pg_schema') {
      client = await getClient(connStr);
      try {
        const sql = `
          SELECT column_name, data_type, character_maximum_length,
                 is_nullable, column_default
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1
          ORDER BY ordinal_position`;
        const result = await client.query(sql, [input.tableName as string]);
        if (!result.rows.length) {
          return { output: `Table "${input.tableName}" not found in public schema.`, isError: false };
        }
        const lines = result.rows.map(r => {
          const type    = r.character_maximum_length
            ? `${r.data_type}(${r.character_maximum_length})`
            : String(r.data_type);
          const nullable = r.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
          const def      = r.column_default ? ` DEFAULT ${r.column_default}` : '';
          return `  ${pad(String(r.column_name), 24)} ${pad(type, 20)} ${nullable}${def}`;
        });
        return {
          output: `Schema for table "${input.tableName}":\n\n${lines.join('\n')}`,
          isError: false,
        };
      } finally { await client.end(); }
    }

    // -----------------------------------------------------------------------
    if (name === 'pg_tables') {
      client = await getClient(connStr);
      try {
        const sql = `
          SELECT table_name,
                 (SELECT COUNT(*) FROM information_schema.columns c
                  WHERE c.table_schema='public' AND c.table_name=t.table_name) AS col_count
          FROM information_schema.tables t
          WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
          ORDER BY table_name`;
        const result = await client.query(sql);
        if (!result.rows.length) return { output: 'No tables found in public schema.', isError: false };
        const lines = result.rows.map((r, i) =>
          `${String(i + 1).padStart(3)}. ${pad(String(r.table_name), 36)} (${r.col_count} columns)`
        );
        return { output: `Tables in public schema (${result.rows.length}):\n\n${lines.join('\n')}`, isError: false };
      } finally { await client.end(); }
    }

    // -----------------------------------------------------------------------
    if (name === 'pg_insert') {
      client = await getClient(connStr);
      try {
        const table  = input.table as string;
        const row    = input.row   as Record<string, unknown>;
        const cols   = Object.keys(row);
        const vals   = Object.values(row);
        const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
        const sql = `INSERT INTO "${table}" (${cols.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders}) RETURNING *`;
        const result = await client.query(sql, vals);
        const inserted = result.rows[0];
        const lines = Object.entries(inserted).map(([k, v]) => `  ${pad(k, 20)} : ${String(v ?? 'NULL')}`);
        return { output: `Inserted 1 row into "${table}":\n\n${lines.join('\n')}`, isError: false };
      } finally { await client.end(); }
    }

    // -----------------------------------------------------------------------
    if (name === 'pg_update') {
      client = await getClient(connStr);
      try {
        const table   = input.table   as string;
        const where   = input.where   as Record<string, unknown>;
        const updates = input.updates as Record<string, unknown>;

        let idx = 1;
        const setClauses  = Object.keys(updates).map(k => { const ph = `$${idx++}`; return `"${k}" = ${ph}`; });
        const whereClauses = Object.keys(where).map(k  => { const ph = `$${idx++}`; return `"${k}" = ${ph}`; });
        const vals = [...Object.values(updates), ...Object.values(where)];
        const sql = `UPDATE "${table}" SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')}`;
        const result = await client.query(sql, vals);
        return {
          output: `Updated ${result.rowCount ?? 0} row(s) in "${table}".`,
          isError: false,
        };
      } finally { await client.end(); }
    }

    return { output: `Unknown postgres tool: ${name}`, isError: true };
  } catch (err: unknown) {
    if (client) { try { await client.end(); } catch { /* ignore */ } }
    return { output: (err as Error).message, isError: true };
  }
}
