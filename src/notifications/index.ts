import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import nodeFetch from 'node-fetch';

export interface NotifyOptions {
  title?: string;
  level?: 'info' | 'success' | 'warning' | 'error';
  code?: string;
  imageFile?: string;
  metadata?: Record<string, string>;
}

export interface NotificationConfig {
  telegram?: { botToken: string; chatId: string; enabled: boolean };
  discord?: { webhookUrl: string; enabled: boolean };
}

const CONFIG_PATH = path.join(os.homedir(), '.config', 'opencli', 'notifications.json');

export function loadNotifyConfig(): NotificationConfig {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

export function saveNotifyConfig(cfg: NotificationConfig): void {
  const dir = path.dirname(CONFIG_PATH);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

export async function sendNotification(message: string, opts: NotifyOptions = {}): Promise<{ telegram: boolean; discord: boolean }> {
  const config = loadNotifyConfig();
  const results = { telegram: false, discord: false };

  if (config.telegram?.enabled && config.telegram.botToken && config.telegram.chatId) {
    results.telegram = await sendTelegram(message, opts, config.telegram.botToken, config.telegram.chatId);
  }

  if (config.discord?.enabled && config.discord.webhookUrl) {
    results.discord = await sendDiscord(message, opts, config.discord.webhookUrl);
  }

  return results;
}

// ---------- Telegram ----------

export async function sendTelegram(
  message: string,
  opts: NotifyOptions,
  botToken: string,
  chatId: string
): Promise<boolean> {
  const emoji = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '❌' }[opts.level || 'info'];
  const title = opts.title ? `*${escapeMarkdown(opts.title)}*\n` : '';

  let text = `${emoji} ${title}${escapeMarkdown(message)}`;

  if (opts.metadata) {
    const meta = Object.entries(opts.metadata)
      .map(([k, v]) => `• *${escapeMarkdown(k)}:* ${escapeMarkdown(v)}`)
      .join('\n');
    text += `\n\n${meta}`;
  }

  if (opts.code) {
    text += `\n\n\`\`\`\n${opts.code.slice(0, 3000)}\n\`\`\``;
  }

  text += `\n\n_via opencli.myowncloud.tech_`;

  try {
    if (opts.imageFile && fs.existsSync(opts.imageFile)) {
      // For image uploads, use a simple multipart approach
      // Fall through to text message with file path noted
      text += `\n\n📸 Screenshot: ${path.basename(opts.imageFile)}`;
    }

    const res = await nodeFetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'MarkdownV2' }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function getTelegramChatId(botToken: string): Promise<string | null> {
  try {
    const res = await nodeFetch(`https://api.telegram.org/bot${botToken}/getUpdates`);
    const data = await res.json() as { ok: boolean; result: Array<{ message?: { chat: { id: number } } }> };
    if (data.ok && data.result.length > 0) {
      const latest = data.result[data.result.length - 1];
      return String(latest.message?.chat.id);
    }
    return null;
  } catch {
    return null;
  }
}

// ---------- Discord ----------

export async function sendDiscord(
  message: string,
  opts: NotifyOptions,
  webhookUrl: string
): Promise<boolean> {
  const colors = { info: 0x00c9ff, success: 0x00ff9d, warning: 0xffb300, error: 0xff6b6b };
  const color = colors[opts.level || 'info'];

  const embed = {
    title: opts.title || 'Open CLI Notification',
    description: message.slice(0, 4096),
    color,
    timestamp: new Date().toISOString(),
    footer: { text: 'opencli.myowncloud.tech' },
    fields: [] as Array<{ name: string; value: string; inline?: boolean }>,
  };

  if (opts.metadata) {
    for (const [k, v] of Object.entries(opts.metadata)) {
      embed.fields.push({ name: k, value: v.slice(0, 1024), inline: true });
    }
  }

  if (opts.code) {
    embed.fields.push({ name: 'Output', value: `\`\`\`\n${opts.code.slice(0, 1000)}\n\`\`\`` });
  }

  try {
    const res = await nodeFetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Open CLI',
        avatar_url: 'https://opencli.myowncloud.tech/logo.png',
        embeds: [embed],
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, c => `\\${c}`);
}
