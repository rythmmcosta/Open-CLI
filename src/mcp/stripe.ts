import fetch from 'node-fetch';
import { ToolDef } from '../types';

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export const stripeTools: ToolDef[] = [
  {
    name: 'stripe_list_customers',
    description: 'List customers from Stripe.',
    inputSchema: {
      type: 'object',
      properties: {
        api_key: { type: 'string', description: 'Stripe API key (test or live)' },
        limit:   { type: 'number', description: 'Number of customers to return (default: 20, max: 100)' },
      },
      required: ['api_key'],
    },
  },
  {
    name: 'stripe_list_products',
    description: 'List products from Stripe.',
    inputSchema: {
      type: 'object',
      properties: {
        api_key: { type: 'string', description: 'Stripe API key' },
        limit:   { type: 'number', description: 'Number of products to return (default: 20, max: 100)' },
      },
      required: ['api_key'],
    },
  },
  {
    name: 'stripe_list_charges',
    description: 'List recent charges from Stripe.',
    inputSchema: {
      type: 'object',
      properties: {
        api_key: { type: 'string', description: 'Stripe API key' },
        limit:   { type: 'number', description: 'Number of charges to return (default: 20, max: 100)' },
      },
      required: ['api_key'],
    },
  },
  {
    name: 'stripe_create_payment_link',
    description: 'Create a Stripe Payment Link for a price.',
    inputSchema: {
      type: 'object',
      properties: {
        api_key:  { type: 'string', description: 'Stripe API key' },
        price_id: { type: 'string', description: 'Stripe price ID (e.g. price_xxx)' },
        quantity: { type: 'number', description: 'Quantity (default: 1)' },
      },
      required: ['api_key', 'price_id'],
    },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE = 'https://api.stripe.com/v1';

function stripeHeaders(apiKey: string): Record<string, string> {
  const encoded = Buffer.from(`${apiKey}:`).toString('base64');
  return { Authorization: `Basic ${encoded}`, 'Content-Type': 'application/x-www-form-urlencoded' };
}

async function stripeFetch(path: string, apiKey: string, opts: { method?: string; body?: string } = {}): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    method:  opts.method || 'GET',
    headers: stripeHeaders(apiKey),
    body:    opts.body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Stripe API ${res.status}: ${text}`);
  return JSON.parse(text);
}

function fmtAmount(amount: number, currency: string): string {
  return `${(amount / 100).toFixed(2)} ${(currency || 'usd').toUpperCase()}`;
}

// ---------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------

export async function executeStripeTool(
  name: string,
  input: Record<string, unknown>
): Promise<{ output: string; isError: boolean }> {
  try {
    const apiKey = input.api_key as string;
    const limit  = Math.min((input.limit as number | undefined) || 20, 100);

    // -----------------------------------------------------------------------
    if (name === 'stripe_list_customers') {
      const data = await stripeFetch(`/customers?limit=${limit}`, apiKey) as {
        data: Array<{ id: string; email?: string; name?: string; created: number; currency?: string }>;
        has_more: boolean;
      };
      if (!data.data.length) return { output: 'No customers found.', isError: false };
      const lines = data.data.map(c =>
        `${c.id}  ${new Date(c.created * 1000).toISOString().slice(0, 10)}  ${c.email || '—'}  ${c.name || '—'}`
      );
      return { output: `Customers (${data.data.length}${data.has_more ? '+' : ''}):\n\n${lines.join('\n')}`, isError: false };
    }

    // -----------------------------------------------------------------------
    if (name === 'stripe_list_products') {
      const data = await stripeFetch(`/products?limit=${limit}`, apiKey) as {
        data: Array<{ id: string; name: string; active: boolean; created: number; description?: string }>;
        has_more: boolean;
      };
      if (!data.data.length) return { output: 'No products found.', isError: false };
      const lines = data.data.map(p =>
        `${p.id}  ${p.active ? 'active' : 'inactive'}  ${new Date(p.created * 1000).toISOString().slice(0, 10)}  ${p.name}`
      );
      return { output: `Products (${data.data.length}${data.has_more ? '+' : ''}):\n\n${lines.join('\n')}`, isError: false };
    }

    // -----------------------------------------------------------------------
    if (name === 'stripe_list_charges') {
      const data = await stripeFetch(`/charges?limit=${limit}`, apiKey) as {
        data: Array<{ id: string; amount: number; currency: string; status: string; created: number; description?: string; customer?: string }>;
        has_more: boolean;
      };
      if (!data.data.length) return { output: 'No charges found.', isError: false };
      const lines = data.data.map(c =>
        `${c.id}  ${fmtAmount(c.amount, c.currency)}  ${c.status}  ${new Date(c.created * 1000).toISOString().slice(0, 10)}  ${c.description || c.customer || '—'}`
      );
      return { output: `Charges (${data.data.length}${data.has_more ? '+' : ''}):\n\n${lines.join('\n')}`, isError: false };
    }

    // -----------------------------------------------------------------------
    if (name === 'stripe_create_payment_link') {
      const priceId  = input.price_id as string;
      const quantity = (input.quantity as number | undefined) || 1;
      const body = `line_items[0][price]=${encodeURIComponent(priceId)}&line_items[0][quantity]=${quantity}`;
      const data = await stripeFetch('/payment_links', apiKey, { method: 'POST', body }) as { id: string; url: string; active: boolean };
      return { output: `Payment link created:\nID: ${data.id}\nURL: ${data.url}\nActive: ${data.active}`, isError: false };
    }

    return { output: `Unknown Stripe tool: ${name}`, isError: true };
  } catch (err: unknown) {
    return { output: (err as Error).message, isError: true };
  }
}
