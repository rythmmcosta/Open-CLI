import fetch from 'node-fetch';
import { ToolDef } from '../types';

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export const slackTools: ToolDef[] = [
  {
    name: 'slack_send_message',
    description: 'Send a message to Slack. Provide either a webhookUrl for Incoming Webhooks, or a token + channelId for the Web API.',
    inputSchema: {
      type: 'object',
      properties: {
        webhookUrl:  { type: 'string', description: 'Incoming Webhook URL (alternative to token+channelId)' },
        token:       { type: 'string', description: 'Slack Bot or User OAuth token (xoxb-… or xoxp-…)' },
        channelId:   { type: 'string', description: 'Channel ID to post to (used with token)' },
        text:        { type: 'string', description: 'Message text (supports mrkdwn)' },
        attachments: { type: 'array',  description: 'Optional Slack attachment objects', items: { type: 'object' } },
      },
      required: ['text'],
    },
  },
  {
    name: 'slack_list_channels',
    description: 'List all public channels in a Slack workspace (requires channels:read scope).',
    inputSchema: {
      type: 'object',
      properties: {
        token: { type: 'string', description: 'Slack Bot or User OAuth token' },
      },
      required: ['token'],
    },
  },
  {
    name: 'slack_get_channel_history',
    description: 'Retrieve recent messages from a Slack channel (requires channels:history or groups:history scope).',
    inputSchema: {
      type: 'object',
      properties: {
        token:     { type: 'string', description: 'Slack Bot or User OAuth token' },
        channelId: { type: 'string', description: 'Channel ID (e.g. C01ABC123)' },
        limit:     { type: 'number', description: 'Number of messages to return (default: 20, max: 200)' },
      },
      required: ['token', 'channelId'],
    },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface SlackApiResponse {
  ok: boolean;
  error?: string;
  [key: string]: unknown;
}

async function slackGet(token: string, endpoint: string, params: Record<string, string>): Promise<SlackApiResponse> {
  const url = new URL(`https://slack.com/api/${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res  = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  const body = await res.json() as SlackApiResponse;
  if (!body.ok) throw new Error(`Slack API error: ${body.error || 'unknown'}`);
  return body;
}

async function slackPost(token: string, endpoint: string, payload: Record<string, unknown>): Promise<SlackApiResponse> {
  const res  = await fetch(`https://slack.com/api/${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await res.json() as SlackApiResponse;
  if (!body.ok) throw new Error(`Slack API error: ${body.error || 'unknown'}`);
  return body;
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

// ---------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------

export async function executeSlackTool(
  name: string,
  input: Record<string, unknown>
): Promise<{ output: string; isError: boolean }> {
  try {
    // -----------------------------------------------------------------------
    if (name === 'slack_send_message') {
      const text        = input.text        as string;
      const webhookUrl  = input.webhookUrl  as string | undefined;
      const token       = input.token       as string | undefined;
      const channelId   = input.channelId   as string | undefined;
      const attachments = input.attachments as unknown[] | undefined;

      if (webhookUrl) {
        // Incoming Webhook path
        const payload: Record<string, unknown> = { text };
        if (attachments) payload.attachments = attachments;
        const res = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const body = await res.text();
        if (!res.ok || body !== 'ok') throw new Error(`Webhook error ${res.status}: ${body}`);
        return { output: `Message sent via webhook.\n  URL: ${webhookUrl}\n  Text: ${text}`, isError: false };
      }

      if (!token || !channelId) {
        return {
          output: 'Provide either webhookUrl, or both token and channelId.',
          isError: true,
        };
      }

      const payload: Record<string, unknown> = { channel: channelId, text };
      if (attachments) payload.attachments = attachments;
      const result = await slackPost(token, 'chat.postMessage', payload);
      const msg = result.message as Record<string, unknown> | undefined;
      return {
        output: [
          `Message posted to Slack.`,
          `  Channel  : ${channelId}`,
          `  Timestamp: ${String(msg?.ts ?? 'unknown')}`,
          `  Text     : ${text}`,
        ].join('\n'),
        isError: false,
      };
    }

    // -----------------------------------------------------------------------
    if (name === 'slack_list_channels') {
      const token = input.token as string;
      const data  = await slackGet(token, 'conversations.list', { limit: '200', types: 'public_channel' });
      const channels = data.channels as Array<{ id: string; name: string; num_members: number; topic: { value: string }; is_archived: boolean }>;
      if (!channels || !channels.length) return { output: 'No channels found.', isError: false };

      const active = channels.filter(c => !c.is_archived);
      const lines  = active.map((c, i) =>
        `${String(i + 1).padStart(3)}. ${pad(c.name, 32)}  members: ${String(c.num_members).padStart(5)}  ${c.topic?.value ? c.topic.value.slice(0, 50) : ''}`
      );
      return {
        output: `Slack channels (${active.length} public):\n\n${lines.join('\n')}`,
        isError: false,
      };
    }

    // -----------------------------------------------------------------------
    if (name === 'slack_get_channel_history') {
      const token     = input.token     as string;
      const channelId = input.channelId as string;
      const limit     = String(Math.min((input.limit as number | undefined) ?? 20, 200));

      const data     = await slackGet(token, 'conversations.history', { channel: channelId, limit });
      const messages = data.messages as Array<{ ts: string; user?: string; bot_id?: string; text: string; subtype?: string }>;

      if (!messages || !messages.length) return { output: 'No messages in this channel.', isError: false };

      const lines = messages.map((m, i) => {
        const ts   = new Date(parseFloat(m.ts) * 1000).toISOString().replace('T', ' ').slice(0, 19);
        const who  = m.user ? `@${m.user}` : m.bot_id ? `[bot:${m.bot_id}]` : '[system]';
        const text = m.text.replace(/\n/g, ' ').slice(0, 120);
        return `${String(i + 1).padStart(3)}. [${ts}] ${pad(who, 18)} ${text}`;
      });

      return {
        output: `Channel history for ${channelId} (${messages.length} messages):\n\n${lines.join('\n')}`,
        isError: false,
      };
    }

    return { output: `Unknown Slack tool: ${name}`, isError: true };
  } catch (err: unknown) {
    return { output: (err as Error).message, isError: true };
  }
}
