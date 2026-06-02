import inquirer from 'inquirer';
import fetch from 'node-fetch';
import Conf from 'conf';
import { C } from '../ui/display';

const BASE_URL = 'https://opencli.myowncloud.tech/api';

interface SyncConfig {
  token?: string;
  email?: string;
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

async function apiPost(endpoint: string, body: Record<string, string>, token?: string): Promise<unknown> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}/${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return res.json();
}

async function apiGet(endpoint: string, token?: string): Promise<unknown> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}/${endpoint}`, { headers });
  return res.json();
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

    if (result.token && typeof result.token === 'string') {
      saveSyncConfig({ token: result.token, email: answers.email as string });
      console.log(C.green('\n  Logged in successfully!\n'));
    } else {
      const message = typeof result.message === 'string' ? result.message : 'Login failed';
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
    }) as Record<string, unknown>;

    if (result.success || result.message === 'OTP sent') {
      console.log(C.green('  Registration successful! Please enter the OTP sent to your email.'));

      const otpAnswer = await inquirer.prompt([
        { type: 'input', name: 'otp', message: 'OTP code:' },
      ]);

      const verifyResult = await apiPost('verify.php', {
        email: answers.email as string,
        otp: otpAnswer.otp as string,
      }) as Record<string, unknown>;

      if (verifyResult.token && typeof verifyResult.token === 'string') {
        saveSyncConfig({ token: verifyResult.token, email: answers.email as string });
        console.log(C.green('\n  Account verified and logged in!\n'));
      } else {
        const msg = typeof verifyResult.message === 'string' ? verifyResult.message : 'Verification failed';
        console.log(C.red(`\n  Error: ${msg}\n`));
      }
    } else {
      const message = typeof result.message === 'string' ? result.message : 'Registration failed';
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
    const [me, quota] = await Promise.all([
      apiGet('me.php', sync.token) as Promise<Record<string, unknown>>,
      apiGet('quota.php', sync.token) as Promise<Record<string, unknown>>,
    ]);

    const meData = me as Record<string, unknown>;
    const quotaData = quota as Record<string, unknown>;

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
    const result = await apiGet('sync/list.php', sync.token) as Record<string, unknown>;
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
      console.log(C.dim('\n  Sync push: coming soon (requires PHP API on server)\n'));
      break;
    case 'pull':
      console.log(C.dim('\n  Sync pull: coming soon\n'));
      break;
    case 'list':
      await listCmd();
      break;
    default:
      console.log('\n' + C.blue.bold('  Open CLI Sync') + '\n');
      console.log('  ' + C.green('opencli sync login') + C.dim('     — Log in to your account'));
      console.log('  ' + C.green('opencli sync register') + C.dim('  — Create a new account'));
      console.log('  ' + C.green('opencli sync logout') + C.dim('    — Log out'));
      console.log('  ' + C.green('opencli sync status') + C.dim('    — Show account and quota'));
      console.log('  ' + C.green('opencli sync push') + C.dim('      — Push project (coming soon)'));
      console.log('  ' + C.green('opencli sync pull') + C.dim('      — Pull project (coming soon)'));
      console.log('  ' + C.green('opencli sync list') + C.dim('      — List synced projects'));
      console.log();
  }
}
