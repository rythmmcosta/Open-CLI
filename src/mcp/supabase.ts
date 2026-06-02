import fetch from 'node-fetch';
import { ToolDef } from '../types';

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export const supabaseTools: ToolDef[] = [
  {
    name: 'supabase_query',
    description: 'SELECT rows from a Supabase table using the REST API.',
    inputSchema: {
      type: 'object',
      properties: {
        url:      { type: 'string', description: 'Supabase project URL (e.g. https://xyz.supabase.co)' },
        anon_key: { type: 'string', description: 'Supabase anon/service key' },
        table:    { type: 'string', description: 'Table name' },
        select:   { type: 'string', description: 'Columns to select (default: *)' },
        filter:   { type: 'string', description: 'PostgREST filter string (e.g. id=eq.1&name=like.*foo*)' },
      },
      required: ['url', 'anon_key', 'table'],
    },
  },
  {
    name: 'supabase_insert',
    description: 'INSERT a row into a Supabase table.',
    inputSchema: {
      type: 'object',
      properties: {
        url:      { type: 'string', description: 'Supabase project URL' },
        anon_key: { type: 'string', description: 'Supabase anon/service key' },
        table:    { type: 'string', description: 'Table name' },
        data:     { type: 'string', description: 'JSON string of row data to insert (e.g. {"name":"Alice","age":30})' },
      },
      required: ['url', 'anon_key', 'table', 'data'],
    },
  },
  {
    name: 'supabase_update',
    description: 'UPDATE rows in a Supabase table matching a filter.',
    inputSchema: {
      type: 'object',
      properties: {
        url:      { type: 'string', description: 'Supabase project URL' },
        anon_key: { type: 'string', description: 'Supabase anon/service key' },
        table:    { type: 'string', description: 'Table name' },
        filter:   { type: 'string', description: 'PostgREST filter string (e.g. id=eq.1)' },
        data:     { type: 'string', description: 'JSON string of columns to update' },
      },
      required: ['url', 'anon_key', 'table', 'filter', 'data'],
    },
  },
  {
    name: 'supabase_delete',
    description: 'DELETE rows from a Supabase table matching a filter.',
    inputSchema: {
      type: 'object',
      properties: {
        url:      { type: 'string', description: 'Supabase project URL' },
        anon_key: { type: 'string', description: 'Supabase anon/service key' },
        table:    { type: 'string', description: 'Table name' },
        filter:   { type: 'string', description: 'PostgREST filter string (e.g. id=eq.1)' },
      },
      required: ['url', 'anon_key', 'table', 'filter'],
    },
  },
  {
    name: 'supabase_invoke_function',
    description: 'Invoke a Supabase Edge Function.',
    inputSchema: {
      type: 'object',
      properties: {
        url:           { type: 'string', description: 'Supabase project URL' },
        anon_key:      { type: 'string', description: 'Supabase anon/service key' },
        function_name: { type: 'string', description: 'Edge Function name' },
        body:          { type: 'string', description: 'JSON string body to send (optional)' },
      },
      required: ['url', 'anon_key', 'function_name'],
    },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sbHeaders(anonKey: string, extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey:          anonKey,
    Authorization:   `Bearer ${anonKey}`,
    'Content-Type':  'application/json',
    Prefer:          'return=representation',
    ...extra,
  };
}

async function sbFetch(url: string, anonKey: string, opts: { method?: string; body?: string; extra?: Record<string, string> } = {}): Promise<{ status: number; body: string }> {
  const res = await fetch(url, {
    method:  opts.method || 'GET',
    headers: sbHeaders(anonKey, opts.extra),
    body:    opts.body,
  });
  const body = await res.text();
  return { status: res.status, body };
}

function formatRows(rows: unknown[]): string {
  if (!rows.length) return 'No rows returned.';
  const keys = Object.keys(rows[0] as Record<string, unknown>);
  const widths = keys.map(k => Math.max(k.length, ...rows.map(r => String((r as Record<string, unknown>)[k] ?? '').length)));
  const header = keys.map((k, i) => k.padEnd(widths[i])).join('  ');
  const separator = widths.map(w => '-'.repeat(w)).join('  ');
  const lines = rows.map(r =>
    keys.map((k, i) => String((r as Record<string, unknown>)[k] ?? '').padEnd(widths[i])).join('  ')
  );
  return [header, separator, ...lines].join('\n');
}

// ---------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------

export async function executeSupabaseTool(
  name: string,
  input: Record<string, unknown>
): Promise<{ output: string; isError: boolean }> {
  try {
    const projectUrl = (input.url as string).replace(/\/$/, '');
    const anonKey    = input.anon_key as string;

    // -----------------------------------------------------------------------
    if (name === 'supabase_query') {
      const table  = input.table  as string;
      const select = (input.select as string | undefined) || '*';
      const filter = (input.filter as string | undefined) || '';
      let url = `${projectUrl}/rest/v1/${table}?select=${encodeURIComponent(select)}`;
      if (filter) url += `&${filter}`;
      const { status, body } = await sbFetch(url, anonKey);
      if (status >= 400) throw new Error(`Supabase ${status}: ${body}`);
      const rows = JSON.parse(body) as unknown[];
      return { output: formatRows(rows), isError: false };
    }

    // -----------------------------------------------------------------------
    if (name === 'supabase_insert') {
      const table = input.table as string;
      const data  = input.data  as string;
      const url   = `${projectUrl}/rest/v1/${table}`;
      const { status, body } = await sbFetch(url, anonKey, { method: 'POST', body: data });
      if (status >= 400) throw new Error(`Supabase ${status}: ${body}`);
      const rows = JSON.parse(body) as unknown[];
      return { output: `Inserted ${rows.length} row(s):\n\n${formatRows(rows)}`, isError: false };
    }

    // -----------------------------------------------------------------------
    if (name === 'supabase_update') {
      const table  = input.table  as string;
      const filter = input.filter as string;
      const data   = input.data   as string;
      const url    = `${projectUrl}/rest/v1/${table}?${filter}`;
      const { status, body } = await sbFetch(url, anonKey, { method: 'PATCH', body: data });
      if (status >= 400) throw new Error(`Supabase ${status}: ${body}`);
      const rows = JSON.parse(body) as unknown[];
      return { output: `Updated ${rows.length} row(s):\n\n${formatRows(rows)}`, isError: false };
    }

    // -----------------------------------------------------------------------
    if (name === 'supabase_delete') {
      const table  = input.table  as string;
      const filter = input.filter as string;
      const url    = `${projectUrl}/rest/v1/${table}?${filter}`;
      const { status, body } = await sbFetch(url, anonKey, { method: 'DELETE' });
      if (status >= 400) throw new Error(`Supabase ${status}: ${body}`);
      const rows = body ? JSON.parse(body) as unknown[] : [];
      return { output: `Deleted ${rows.length} row(s).`, isError: false };
    }

    // -----------------------------------------------------------------------
    if (name === 'supabase_invoke_function') {
      const functionName = input.function_name as string;
      const body         = (input.body as string | undefined) || '{}';
      const url          = `${projectUrl}/functions/v1/${functionName}`;
      const { status, body: resBody } = await sbFetch(url, anonKey, { method: 'POST', body });
      if (status >= 400) throw new Error(`Supabase function ${status}: ${resBody}`);
      return { output: resBody, isError: false };
    }

    return { output: `Unknown Supabase tool: ${name}`, isError: true };
  } catch (err: unknown) {
    return { output: (err as Error).message, isError: true };
  }
}
