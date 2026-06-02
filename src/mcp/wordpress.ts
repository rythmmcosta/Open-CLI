'use strict';
import fetch from 'node-fetch';
import { execSync } from 'child_process';
import { ToolDef } from '../types';

// WordPress REST API tools (auth via Application Password)
// WP-CLI wrapper tool (requires wp-cli installed locally)

export const wordpressTools: ToolDef[] = [
  {
    name: 'wp_get_posts',
    description: 'Fetch posts from a WordPress site via the REST API',
    inputSchema: {
      type: 'object',
      properties: {
        site_url: { type: 'string', description: 'Base URL of the WordPress site (e.g. https://example.com)' },
        app_password_b64: { type: 'string', description: 'Base64-encoded "user:app_password" for Basic auth' },
        per_page: { type: 'number', description: 'Number of posts to return (default: 10)' },
        status: { type: 'string', description: 'Post status filter (default: publish)' },
      },
      required: ['site_url', 'app_password_b64'],
    },
  },
  {
    name: 'wp_create_post',
    description: 'Create a new post on a WordPress site via the REST API',
    inputSchema: {
      type: 'object',
      properties: {
        site_url: { type: 'string', description: 'Base URL of the WordPress site' },
        app_password_b64: { type: 'string', description: 'Base64-encoded "user:app_password" for Basic auth' },
        title: { type: 'string', description: 'Post title' },
        content: { type: 'string', description: 'Post content (HTML or plain text)' },
        status: { type: 'string', description: 'Post status: draft, publish, private (default: draft)' },
      },
      required: ['site_url', 'app_password_b64', 'title', 'content'],
    },
  },
  {
    name: 'wp_update_post',
    description: 'Update an existing post on a WordPress site via the REST API',
    inputSchema: {
      type: 'object',
      properties: {
        site_url: { type: 'string', description: 'Base URL of the WordPress site' },
        app_password_b64: { type: 'string', description: 'Base64-encoded "user:app_password" for Basic auth' },
        post_id: { type: 'number', description: 'ID of the post to update' },
        title: { type: 'string', description: 'New post title (optional)' },
        content: { type: 'string', description: 'New post content (optional)' },
        status: { type: 'string', description: 'New post status (optional)' },
      },
      required: ['site_url', 'app_password_b64', 'post_id'],
    },
  },
  {
    name: 'wp_get_pages',
    description: 'Fetch pages from a WordPress site via the REST API',
    inputSchema: {
      type: 'object',
      properties: {
        site_url: { type: 'string', description: 'Base URL of the WordPress site' },
        app_password_b64: { type: 'string', description: 'Base64-encoded "user:app_password" for Basic auth' },
      },
      required: ['site_url', 'app_password_b64'],
    },
  },
  {
    name: 'wp_get_plugins',
    description: 'Fetch installed plugins from a WordPress site via the REST API (requires WP 5.5+)',
    inputSchema: {
      type: 'object',
      properties: {
        site_url: { type: 'string', description: 'Base URL of the WordPress site' },
        app_password_b64: { type: 'string', description: 'Base64-encoded "user:app_password" for Basic auth' },
      },
      required: ['site_url', 'app_password_b64'],
    },
  },
  {
    name: 'wp_get_themes',
    description: 'Fetch installed themes from a WordPress site via the REST API',
    inputSchema: {
      type: 'object',
      properties: {
        site_url: { type: 'string', description: 'Base URL of the WordPress site' },
        app_password_b64: { type: 'string', description: 'Base64-encoded "user:app_password" for Basic auth' },
      },
      required: ['site_url', 'app_password_b64'],
    },
  },
  {
    name: 'wp_get_options',
    description: 'Fetch WordPress site settings/options via the REST API',
    inputSchema: {
      type: 'object',
      properties: {
        site_url: { type: 'string', description: 'Base URL of the WordPress site' },
        app_password_b64: { type: 'string', description: 'Base64-encoded "user:app_password" for Basic auth' },
        option_names: { type: 'string', description: 'Comma-separated list of option names to retrieve (e.g. title,description,url)' },
      },
      required: ['site_url', 'app_password_b64', 'option_names'],
    },
  },
  {
    name: 'wp_get_media',
    description: 'Fetch media library items from a WordPress site via the REST API',
    inputSchema: {
      type: 'object',
      properties: {
        site_url: { type: 'string', description: 'Base URL of the WordPress site' },
        app_password_b64: { type: 'string', description: 'Base64-encoded "user:app_password" for Basic auth' },
        per_page: { type: 'number', description: 'Number of media items to return (default: 10)' },
      },
      required: ['site_url', 'app_password_b64'],
    },
  },
  {
    name: 'wp_cli',
    description: 'Run a WP-CLI command on the local WordPress installation (requires wp-cli in PATH)',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'WP-CLI command arguments (without the leading "wp"), e.g. "post list --status=publish"' },
      },
      required: ['command'],
    },
  },
];

async function wpFetch(
  url: string,
  auth: string,
  options: RequestInit = {}
): Promise<{ output: string; isError: boolean }> {
  const headers: Record<string, string> = {
    'Authorization': `Basic ${auth}`,
    'Content-Type': 'application/json',
  };
  const res = await fetch(url, { ...options, headers } as Parameters<typeof fetch>[1]);
  const text = await res.text();
  if (!res.ok) {
    return { output: `HTTP ${res.status}: ${text}`, isError: true };
  }
  try {
    const data: unknown = JSON.parse(text);
    return { output: JSON.stringify(data, null, 2), isError: false };
  } catch {
    return { output: text, isError: false };
  }
}

export async function executeWordpressTool(
  name: string,
  input: Record<string, unknown>
): Promise<{ output: string; isError: boolean }> {
  try {
    switch (name) {
      case 'wp_get_posts': {
        const siteUrl = input.site_url as string;
        const auth = input.app_password_b64 as string;
        const perPage = (input.per_page as number | undefined) ?? 10;
        const status = (input.status as string | undefined) ?? 'publish';
        return wpFetch(
          `${siteUrl}/wp-json/wp/v2/posts?per_page=${perPage}&status=${status}`,
          auth
        );
      }

      case 'wp_create_post': {
        const siteUrl = input.site_url as string;
        const auth = input.app_password_b64 as string;
        const body = JSON.stringify({
          title: input.title as string,
          content: input.content as string,
          status: (input.status as string | undefined) ?? 'draft',
        });
        return wpFetch(`${siteUrl}/wp-json/wp/v2/posts`, auth, {
          method: 'POST',
          body,
        });
      }

      case 'wp_update_post': {
        const siteUrl = input.site_url as string;
        const auth = input.app_password_b64 as string;
        const postId = input.post_id as number;
        const body: Record<string, unknown> = {};
        if (input.title !== undefined) body.title = input.title;
        if (input.content !== undefined) body.content = input.content;
        if (input.status !== undefined) body.status = input.status;
        return wpFetch(`${siteUrl}/wp-json/wp/v2/posts/${postId}`, auth, {
          method: 'POST',
          body: JSON.stringify(body),
        });
      }

      case 'wp_get_pages': {
        const siteUrl = input.site_url as string;
        const auth = input.app_password_b64 as string;
        return wpFetch(`${siteUrl}/wp-json/wp/v2/pages`, auth);
      }

      case 'wp_get_plugins': {
        const siteUrl = input.site_url as string;
        const auth = input.app_password_b64 as string;
        return wpFetch(`${siteUrl}/wp-json/wp/v2/plugins`, auth);
      }

      case 'wp_get_themes': {
        const siteUrl = input.site_url as string;
        const auth = input.app_password_b64 as string;
        return wpFetch(`${siteUrl}/wp-json/wp/v2/themes`, auth);
      }

      case 'wp_get_options': {
        const siteUrl = input.site_url as string;
        const auth = input.app_password_b64 as string;
        const optionNames = (input.option_names as string).split(',').map(s => s.trim());
        const result = await wpFetch(`${siteUrl}/wp-json/wp/v2/settings`, auth);
        if (result.isError) return result;
        try {
          const all = JSON.parse(result.output) as Record<string, unknown>;
          const filtered: Record<string, unknown> = {};
          for (const key of optionNames) {
            if (Object.prototype.hasOwnProperty.call(all, key)) {
              filtered[key] = all[key];
            }
          }
          return { output: JSON.stringify(filtered, null, 2), isError: false };
        } catch {
          return result;
        }
      }

      case 'wp_get_media': {
        const siteUrl = input.site_url as string;
        const auth = input.app_password_b64 as string;
        const perPage = (input.per_page as number | undefined) ?? 10;
        return wpFetch(`${siteUrl}/wp-json/wp/v2/media?per_page=${perPage}`, auth);
      }

      case 'wp_cli': {
        const command = input.command as string;
        try {
          const stdout = execSync(`wp ${command}`, { encoding: 'utf8', timeout: 30000 });
          return { output: stdout || '(no output)', isError: false };
        } catch (err: unknown) {
          const e = err as NodeJS.ErrnoException & { stdout?: string; stderr?: string; code?: string };
          if (e.code === 'ENOENT' || (e.message && e.message.includes('not found'))) {
            return {
              output: 'WP-CLI (wp) binary not found in PATH. Install it from https://wp-cli.org/',
              isError: true,
            };
          }
          const out = e.stdout || e.stderr || e.message || String(err);
          return { output: out, isError: true };
        }
      }

      default:
        return { output: `Unknown WordPress tool: ${name}`, isError: true };
    }
  } catch (err: unknown) {
    return { output: (err as Error).message, isError: true };
  }
}
