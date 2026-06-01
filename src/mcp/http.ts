import nodeFetch from 'node-fetch';
import { ToolDef } from '../types';

export const httpRequestTool: ToolDef = {
  name: 'http_request',
  description: 'Make an HTTP request to any URL. Supports GET, POST, PUT, DELETE, PATCH with headers, body, and auth.',
  inputSchema: {
    type: 'object',
    properties: {
      method: { type: 'string', description: 'HTTP method: GET, POST, PUT, DELETE, PATCH (default: GET)' },
      url: { type: 'string', description: 'Full URL to request' },
      headers: { type: 'object', description: 'Request headers as key-value pairs' },
      body: { type: 'string', description: 'Request body (for POST/PUT/PATCH). Will be sent as JSON if object.' },
      body_json: { type: 'object', description: 'JSON body (auto-sets Content-Type: application/json)' },
      timeout: { type: 'number', description: 'Timeout in milliseconds (default: 30000)' },
    },
    required: ['url'],
  },
};

export const httpTools: ToolDef[] = [httpRequestTool];

export async function executeHttpRequest(input: Record<string, unknown>): Promise<{ output: string; isError: boolean }> {
  const method = ((input.method as string) || 'GET').toUpperCase();
  const url = input.url as string;
  const headers: Record<string, string> = (input.headers as Record<string, string>) || {};
  const timeout = (input.timeout as number) || 30000;

  let body: string | undefined;
  if (input.body_json) {
    body = JSON.stringify(input.body_json);
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  } else if (input.body) {
    body = input.body as string;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const response = await nodeFetch(url, {
      method,
      headers,
      body: body || undefined,
      signal: controller.signal as unknown as AbortSignal,
    });

    clearTimeout(timer);

    const contentType = response.headers.get('content-type') || '';
    let responseBody: string;

    if (contentType.includes('application/json')) {
      const json = await response.json();
      responseBody = JSON.stringify(json, null, 2);
    } else {
      responseBody = await response.text();
      if (responseBody.length > 10000) {
        responseBody = responseBody.slice(0, 10000) + '\n... (truncated)';
      }
    }

    const result = [
      `Status: ${response.status} ${response.statusText}`,
      `Content-Type: ${contentType}`,
      '---',
      responseBody,
    ].join('\n');

    return { output: result, isError: !response.ok };
  } catch (err: unknown) {
    const e = err as Error;
    if (e.name === 'AbortError') {
      return { output: `Request timed out after ${timeout}ms`, isError: true };
    }
    return { output: e.message, isError: true };
  }
}
