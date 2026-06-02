import fetch from 'node-fetch';
import { ToolDef } from '../types';

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export const notionTools: ToolDef[] = [
  {
    name: 'notion_list_pages',
    description: 'List pages accessible via the Notion integration.',
    inputSchema: {
      type: 'object',
      properties: {
        api_key: { type: 'string', description: 'Notion integration API key (Bearer token)' },
      },
      required: ['api_key'],
    },
  },
  {
    name: 'notion_get_page',
    description: 'Get details of a specific Notion page by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        page_id: { type: 'string', description: 'Notion page ID' },
        api_key: { type: 'string', description: 'Notion integration API key' },
      },
      required: ['page_id', 'api_key'],
    },
  },
  {
    name: 'notion_create_page',
    description: 'Create a new Notion page with a title and optional text content.',
    inputSchema: {
      type: 'object',
      properties: {
        parent_id: { type: 'string', description: 'Parent page or database ID' },
        title:     { type: 'string', description: 'Page title' },
        content:   { type: 'string', description: 'Page body text (becomes paragraph blocks)' },
        api_key:   { type: 'string', description: 'Notion integration API key' },
      },
      required: ['parent_id', 'title', 'api_key'],
    },
  },
  {
    name: 'notion_append_block',
    description: 'Append a paragraph block to a Notion page or block.',
    inputSchema: {
      type: 'object',
      properties: {
        block_id: { type: 'string', description: 'Page or block ID to append to' },
        content:  { type: 'string', description: 'Text content for the paragraph block' },
        api_key:  { type: 'string', description: 'Notion integration API key' },
      },
      required: ['block_id', 'content', 'api_key'],
    },
  },
  {
    name: 'notion_search',
    description: 'Search the Notion workspace for pages and databases.',
    inputSchema: {
      type: 'object',
      properties: {
        query:   { type: 'string', description: 'Search query' },
        api_key: { type: 'string', description: 'Notion integration API key' },
      },
      required: ['query', 'api_key'],
    },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE    = 'https://api.notion.com/v1';
const VERSION = '2022-06-28';

function notionHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization:    `Bearer ${apiKey}`,
    'Content-Type':   'application/json',
    'Notion-Version': VERSION,
  };
}

async function notionFetch(path: string, apiKey: string, opts: { method?: string; body?: unknown } = {}): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    method:  opts.method || 'GET',
    headers: notionHeaders(apiKey),
    body:    opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Notion API ${res.status}: ${text}`);
  return JSON.parse(text);
}

function extractTitle(page: Record<string, unknown>): string {
  const props = page.properties as Record<string, unknown> | undefined;
  if (!props) return (page.id as string) || 'Untitled';
  for (const val of Object.values(props)) {
    const p = val as { type?: string; title?: Array<{ plain_text: string }> };
    if (p.type === 'title' && p.title && p.title.length) {
      return p.title.map(t => t.plain_text).join('');
    }
  }
  return 'Untitled';
}

function paragraphBlock(text: string) {
  return {
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [{ type: 'text', text: { content: text } }],
    },
  };
}

// ---------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------

export async function executeNotionTool(
  name: string,
  input: Record<string, unknown>
): Promise<{ output: string; isError: boolean }> {
  try {
    const apiKey = input.api_key as string;

    // -----------------------------------------------------------------------
    if (name === 'notion_list_pages') {
      const data = await notionFetch('/search', apiKey, {
        method: 'POST',
        body:   { filter: { value: 'page', property: 'object' }, page_size: 50 },
      }) as { results: Array<Record<string, unknown>> };
      if (!data.results.length) return { output: 'No pages found.', isError: false };
      const lines = data.results.map(p => `${p.id}  ${extractTitle(p)}`);
      return { output: `Pages (${data.results.length}):\n\n${lines.join('\n')}`, isError: false };
    }

    // -----------------------------------------------------------------------
    if (name === 'notion_get_page') {
      const pageId = input.page_id as string;
      const page   = await notionFetch(`/pages/${pageId}`, apiKey) as Record<string, unknown>;
      const title  = extractTitle(page);
      const url    = (page.url as string) || '';
      const created = (page.created_time as string || '').slice(0, 10);
      const edited  = (page.last_edited_time as string || '').slice(0, 10);
      return {
        output: `Page: ${title}\nID: ${page.id}\nCreated: ${created}  Last edited: ${edited}\nURL: ${url}`,
        isError: false,
      };
    }

    // -----------------------------------------------------------------------
    if (name === 'notion_create_page') {
      const parentId = input.parent_id as string;
      const title    = input.title    as string;
      const content  = (input.content as string | undefined) || '';
      const children = content
        ? content.split('\n').filter(Boolean).map(line => paragraphBlock(line))
        : [];
      const page = await notionFetch('/pages', apiKey, {
        method: 'POST',
        body: {
          parent: { page_id: parentId },
          properties: {
            title: { title: [{ type: 'text', text: { content: title } }] },
          },
          children,
        },
      }) as Record<string, unknown>;
      return { output: `Page created: ${title}\nID: ${page.id}\nURL: ${page.url}`, isError: false };
    }

    // -----------------------------------------------------------------------
    if (name === 'notion_append_block') {
      const blockId = input.block_id as string;
      const content = input.content  as string;
      const data = await notionFetch(`/blocks/${blockId}/children`, apiKey, {
        method: 'PATCH',
        body:   { children: [paragraphBlock(content)] },
      }) as { results: unknown[] };
      return { output: `Appended paragraph block (${data.results.length} block(s) now)`, isError: false };
    }

    // -----------------------------------------------------------------------
    if (name === 'notion_search') {
      const query = input.query as string;
      const data  = await notionFetch('/search', apiKey, {
        method: 'POST',
        body:   { query, page_size: 20 },
      }) as { results: Array<Record<string, unknown>> };
      if (!data.results.length) return { output: 'No results.', isError: false };
      const lines = data.results.map(r => `${r.object}  ${r.id}  ${extractTitle(r)}`);
      return { output: `Search results for "${query}" (${data.results.length}):\n\n${lines.join('\n')}`, isError: false };
    }

    return { output: `Unknown Notion tool: ${name}`, isError: true };
  } catch (err: unknown) {
    return { output: (err as Error).message, isError: true };
  }
}
