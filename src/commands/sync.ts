import inquirer from 'inquirer';
import fetch from 'node-fetch';
import Conf from 'conf';
import { C } from '../ui/display';
import { getDb } from '../db/index';

const BASE_URL = 'https://opencli.myowncloud.tech/api';

// Token is considered stale after 23 days (in ms)
const TOKEN_STALE_MS = 23 * 24 * 60 * 60 * 1000;

interface SyncConfig {
  token?: string;
  email?: string;
  tokenSavedAt?: number;
}

interface SyncStore {
  sync: SyncConfig;
}

let _syncStore: Conf<SyncStore> | null = null;

function getSyncStore(): Conf<SyncStore> {
  if (!_syncStore) {
    _syncStore = new Conf<SyncStore>({
      projectName: 'opencli',
      configName: 'sync',
      defaults: { sync: {} },
    });
  }
  return _syncStore;
}

function getSyncConfig(): SyncConfig {
  return getSyncStore().get('sync') ?? {};
}

function saveSyncConfig(sync: SyncConfig): void {
  getSyncStore().set('sync', sync);
}

async function apiPost(endpoint: string, body: Record<string, unknown>, token?: string): Promise<{ status: number; data: unknown }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}/${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function apiGet(endpoint: string, token?: string): Promise<{ status: number; data: unknown }> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}/${endpoint}`, { headers });
  const data = await res.json();
  return { status: res.status, data };
}

async function tryRefreshToken(): Promise<string | null> {
  const sync = getSyncConfig();
  if (!sync.token) return null;
  try {
    const result = await apiPost('refresh-token.php', {}, sync.token);
    const data = result.data as Record<string, unknown>;
    if (data.token && typeof data.token === 'string') {
      saveSyncConfig({ ...sync, token: data.token, tokenSavedAt: Date.now() });
      return data.token;
    }
  } catch {
    // silently fail
  }
  return null;
}

async function ensureFreshToken(): Promise<string | null> {
  const sync = getSyncConfig();
  if (!sync.token) return null;
  const savedAt = sync.tokenSavedAt ?? 0;
  if (Date.now() - savedAt > TOKEN_STALE_MS) {
    const refreshed = await tryRefreshToken();
    return refreshed ?? sync.token;
  }
  return sync.token;
}

async function handleUnauthorized(): Promise<string | null> {
  console.log(C.yellow('\n  Session expired. Enter your password to continue:'));
  const sync = getSyncConfig();
  try {
    const answers = await inquirer.prompt([
      { type: 'password', name: 'password', message: '  Password:', mask: '*' },
    ]);
    const result = await apiPost('login.php', {
      email: sync.email ?? '',
      password: answers.password as string,
    });
    const data = result.data as Record<string, unknown>;
    if (data.token && typeof data.token === 'string') {
      saveSyncConfig({ ...sync, token: data.token, tokenSavedAt: Date.now() });
      console.log(C.green('  Re-authenticated successfully.\n'));
      return data.token;
    }
  } catch {
    // fall through
  }
  console.log(C.red('  Re-authentication failed. Run: opencli sync login\n'));
  return null;
}

interface ChatSession {
  id: string;
  project_hash: string | null;
  project_name: string | null;
  model: string | null;
  skill: string | null;
  msg_count: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  started_at: string | null;
  ended_at: string | null;
}

interface ChatMessage {
  id: string;
  session_id: string;
  role: string;
  content: string;
  tool_calls: unknown;
  tokens: number;
  created_at: string;
}

async function pushChatHistory(token: string): Promise<void> {
  try {
    const db = getDb();

    // Fetch last 50 sessions
    const rawSessions = db
      .prepare('SELECT * FROM sessions ORDER BY started_at DESC LIMIT 50')
      .all() as Array<{
        id: string;
        project_id: string | null;
        model: string;
        skill: string;
        started_at: number;
        ended_at: number | null;
        msg_count: number;
        input_tokens: number;
        output_tokens: number;
        cost_usd: number;
      }>;

    if (rawSessions.length === 0) {
      console.log(C.dim('  No chat sessions to sync.'));
      return;
    }

    console.log(C.dim(`  📤 Syncing chat history... (${rawSessions.length} sessions)`));

    const sessionIds = rawSessions.map(s => s.id);

    // Fetch messages for those sessions
    const placeholders = sessionIds.map(() => '?').join(',');
    const rawMessages = db
      .prepare(`SELECT * FROM messages WHERE session_id IN (${placeholders}) ORDER BY created_at ASC`)
      .all(...sessionIds) as Array<{
        id: number;
        session_id: string | null;
        role: string;
        content: string;
        tool_calls: string | null;
        tokens: number | null;
        created_at: number;
      }>;

    const sessions: ChatSession[] = rawSessions.map(s => ({
      id: s.id,
      project_hash: s.project_id ?? null,
      project_name: null,
      model: s.model ?? null,
      skill: s.skill ?? null,
      msg_count: s.msg_count,
      input_tokens: s.input_tokens,
      output_tokens: s.output_tokens,
      cost_usd: s.cost_usd,
      started_at: s.started_at ? new Date(s.started_at).toISOString() : null,
      ended_at: s.ended_at ? new Date(s.ended_at).toISOString() : null,
    }));

    const messages: ChatMessage[] = rawMessages.map(m => ({
      id: String(m.id),
      session_id: m.session_id ?? '',
      role: m.role,
      content: m.content,
      tool_calls: m.tool_calls ? JSON.parse(m.tool_calls) : null,
      tokens: m.tokens ?? 0,
      created_at: new Date(m.created_at).toISOString(),
    }));

    const result = await apiPost('chat-push.php', { sessions, messages }, token);

    if (result.status === 401) {
      const newToken = await handleUnauthorized();
      if (newToken) {
        await pushChatHistory(newToken);
      }
      return;
    }

    const data = result.data as Record<string, unknown>;
    if (data.success || result.status === 200) {
      console.log(C.green(`  ✓ Chat history synced (${sessions.length} sessions, ${messages.length} messages)`));
    } else {
      const msg = typeof data.message === 'string' ? data.message : 'Server error';
      console.log(C.yellow(`  ⚠ Chat history sync: ${msg}`));
    }
  } catch (err) {
    console.log(C.yellow(`  ⚠ Chat history sync skipped: ${(err as Error).message}`));
  }
}

async function loginCmd(): Promise<void> {
  console.log('\n' + C.blue.bold('  Open CLI — Login') + '\n');

  const answers = await inquirer.prompt([
    { type: 'input', name: 'email', message: 'Email:' },
    { type: 'password', name: 'password', message: 'Password:', mask: '*' },
  ]);

  console.log(C.dim('  Logging in...'));

  try {
    const result = await apiPost('login.php', {
      email: answers.email as string,
      password: answers.password as string,
    }) as Record<string, unknown>;

    const data = result.data as Record<string, unknown>;
    if (data.token && typeof data.token === 'string') {
      saveSyncConfig({ token: data.token, email: answers.email as string, tokenSavedAt: Date.now() });
      console.log(C.green('\n  Logged in successfully!\n'));
    } else {
      const message = typeof data.message === 'string' ? data.message : 'Login failed';
      console.log(C.red(`\n  Error: ${message}\n`));
    }
  } catch (err) {
    console.log(C.red(`\n  Connection error: ${(err as Error).message}\n`));
  }
}

async function registerCmd(): Promise<void> {
  console.log('\n' + C.blue.bold('  Open CLI — Register') + '\n');

  const answers = await inquirer.prompt([
    { type: 'input', name: 'email', message: 'Email:' },
    { type: 'input', name: 'name', message: 'Name:' },
    { type: 'password', name: 'password', message: 'Password:', mask: '*' },
  ]);

  console.log(C.dim('  Registering...'));

  try {
    const result = await apiPost('register.php', {
      email: answers.email as string,
      name: answers.name as string,
      password: answers.password as string,
    });
    const data = result.data as Record<string, unknown>;

    if (data.success || data.message === 'OTP sent') {
      console.log(C.green('  Registration successful! Please enter the OTP sent to your email.'));

      const otpAnswer = await inquirer.prompt([
        { type: 'input', name: 'otp', message: 'OTP code:' },
      ]);

      const verifyResult = await apiPost('verify.php', {
        email: answers.email as string,
        otp: otpAnswer.otp as string,
      });
      const verifyData = verifyResult.data as Record<string, unknown>;

      if (verifyData.token && typeof verifyData.token === 'string') {
        saveSyncConfig({ token: verifyData.token, email: answers.email as string, tokenSavedAt: Date.now() });
        console.log(C.green('\n  Account verified and logged in!\n'));
      } else {
        const msg = typeof verifyData.message === 'string' ? verifyData.message : 'Verification failed';
        console.log(C.red(`\n  Error: ${msg}\n`));
      }
    } else {
      const message = typeof data.message === 'string' ? data.message : 'Registration failed';
      console.log(C.red(`\n  Error: ${message}\n`));
    }
  } catch (err) {
    console.log(C.red(`\n  Connection error: ${(err as Error).message}\n`));
  }
}

function logoutCmd(): void {
  saveSyncConfig({});
  console.log(C.green('\n  Logged out.\n'));
}

async function statusCmd(): Promise<void> {
  const sync = getSyncConfig();
  if (!sync.token) {
    console.log(C.yellow('\n  Not logged in. Run: opencli sync login\n'));
    return;
  }

  console.log('\n' + C.blue.bold('  Sync Status') + '\n');

  try {
    const [meResult, quotaResult] = await Promise.all([
      apiGet('me.php', sync.token),
      apiGet('quota.php', sync.token),
    ]);

    if (meResult.status === 401) {
      const newToken = await handleUnauthorized();
      if (newToken) await statusCmd();
      return;
    }

    const meData = meResult.data as Record<string, unknown>;
    const quotaData = quotaResult.data as Record<string, unknown>;

    if (meData.name) console.log(`  Name:  ${C.green(String(meData.name))}`);
    if (meData.email) console.log(`  Email: ${C.green(String(meData.email))}`);

    if (quotaData.used !== undefined && quotaData.total !== undefined) {
      const used = Number(quotaData.used);
      const total = Number(quotaData.total);
      const pct = total > 0 ? Math.round((used / total) * 100) : 0;
      const barLen = 20;
      const filled = Math.round((pct / 100) * barLen);
      const bar = C.blue('█'.repeat(filled)) + C.dim('░'.repeat(barLen - filled));
      console.log(`\n  Quota: [${bar}] ${pct}% (${used} / ${total} MB)`);
    }

    if (meData.lastSync) {
      console.log(`\n  Last sync: ${C.dim(String(meData.lastSync))}`);
    }

    console.log();
  } catch (err) {
    console.log(C.red(`\n  Error fetching status: ${(err as Error).message}\n`));
  }
}

async function listCmd(): Promise<void> {
  const sync = getSyncConfig();
  if (!sync.token) {
    console.log(C.yellow('\n  Not logged in. Run: opencli sync login\n'));
    return;
  }

  try {
    const listResult = await apiGet('sync/list.php', sync.token);
    if (listResult.status === 401) {
      const newToken = await handleUnauthorized();
      if (newToken) await listCmd();
      return;
    }
    const result = listResult.data as Record<string, unknown>;
    const projects = result.projects;

    if (Array.isArray(projects) && projects.length > 0) {
      console.log('\n' + C.blue.bold('  Synced Projects') + '\n');
      for (const p of projects) {
        const proj = p as Record<string, unknown>;
        console.log(`  ${C.green(String(proj.name || proj.id))}  ${C.dim(String(proj.path || ''))}`);
        if (proj.lastSync) {
          console.log(`    ${C.dim('last sync: ' + String(proj.lastSync))}`);
        }
      }
      console.log();
    } else {
      console.log(C.dim('\n  No synced projects.\n'));
    }
  } catch (err) {
    console.log(C.red(`\n  Error: ${(err as Error).message}\n`));
  }
}

async function pushCmd(): Promise<void> {
  const sync = getSyncConfig();
  if (!sync.token) {
    console.log(C.yellow('\n  Not logged in. Run: opencli sync login\n'));
    return;
  }

  const token = await ensureFreshToken();
  if (!token) {
    console.log(C.yellow('\n  No valid token. Run: opencli sync login\n'));
    return;
  }

  console.log(C.dim('\n  Sync push: file archive coming soon'));
  await pushChatHistory(token);
  console.log();
}

async function messagesCmd(): Promise<void> {
  const sync = getSyncConfig();
  if (!sync.token) {
    console.log(C.yellow('\n  Not logged in. Run: opencli sync login\n'));
    return;
  }

  const token = await ensureFreshToken();
  if (!token) {
    console.log(C.yellow('\n  No valid token. Run: opencli sync login\n'));
    return;
  }

  console.log();
  await pushChatHistory(token);
  console.log();
}

export async function runSync(subcommand: string | undefined, _args: string[]): Promise<void> {
  switch (subcommand) {
    case 'login':
      await loginCmd();
      break;
    case 'register':
      await registerCmd();
      break;
    case 'logout':
      logoutCmd();
      break;
    case 'status':
      await statusCmd();
      break;
    case 'push':
      await pushCmd();
      break;
    case 'pull':
      console.log(C.dim('\n  Sync pull: coming soon\n'));
      break;
    case 'list':
      await listCmd();
      break;
    case 'messages':
      await messagesCmd();
      break;
    default:
      console.log('\n' + C.blue.bold('  Open CLI Sync') + '\n');
      console.log('  ' + C.green('opencli sync login') + C.dim('      — Log in to your account'));
      console.log('  ' + C.green('opencli sync register') + C.dim('   — Create a new account'));
      console.log('  ' + C.green('opencli sync logout') + C.dim('     — Log out'));
      console.log('  ' + C.green('opencli sync status') + C.dim('     — Show account and quota'));
      console.log('  ' + C.green('opencli sync push') + C.dim('       — Push project files + chat history'));
      console.log('  ' + C.green('opencli sync messages') + C.dim('   — Sync chat history to your account'));
      console.log('  ' + C.green('opencli sync pull') + C.dim('       — Pull project (coming soon)'));
      console.log('  ' + C.green('opencli sync list') + C.dim('       — List synced projects'));
      console.log();
  }
}
