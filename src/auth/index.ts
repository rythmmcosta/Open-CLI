import inquirer from 'inquirer';
import chalk from 'chalk';
import {
  getConfig,
  setApiKey,
  setOllamaUrl,
  removeProvider,
  getConfigPath,
} from '../config';
import { C, showSuccess, showInfo, showError } from '../ui/display';

const PROVIDERS = [
  { value: 'anthropic', name: 'Claude (Anthropic)', color: '#00ff9d', models: 'claude-opus-4-5, claude-sonnet-4-5, ...' },
  { value: 'openai', name: 'GPT (OpenAI)', color: '#00c9ff', models: 'gpt-4o, gpt-4o-mini, o1, ...' },
  { value: 'gemini', name: 'Gemini (Google)', color: '#b36aff', models: 'gemini-2.0-flash, gemini-1.5-pro, ...' },
  { value: 'ollama', name: 'Ollama (Local / Free)', color: '#ffb300', models: 'llama3.2, codellama, mistral, ...' },
];

export async function runAuth(): Promise<void> {
  console.log('\n' + C.blue.bold('  ⚡ Provider Authentication') + '\n');
  showProviderStatus();
  console.log();

  const { action } = await inquirer.prompt([{
    type: 'list',
    name: 'action',
    message: 'What would you like to do?',
    choices: [
      { name: `${C.green('Add / Update')} API key for a provider`, value: 'add' },
      { name: `${C.yellow('Remove')} a provider`, value: 'remove' },
      { name: `${C.blue('Test')} connection to a provider`, value: 'test' },
      { name: `${C.dim('View')} config file location`, value: 'path' },
      new inquirer.Separator(),
      { name: chalk.hex('#555555')('Back'), value: 'back' },
    ],
  }]);

  if (action === 'back') return;

  if (action === 'add') await addProvider();
  else if (action === 'remove') await removeProviderInteractive();
  else if (action === 'test') await testProvider();
  else if (action === 'path') {
    console.log('\n  Config file: ' + C.green(getConfigPath()) + '\n');
  }
}

async function addProvider(): Promise<void> {
  const { provider } = await inquirer.prompt([{
    type: 'list',
    name: 'provider',
    message: 'Select provider:',
    choices: PROVIDERS.map(p => ({
      name: chalk.hex(p.color)(`${p.name}`) + C.dim(` — ${p.models}`),
      value: p.value,
      short: p.name,
    })),
  }]);

  if (provider === 'ollama') {
    await addOllama();
  } else {
    await addApiKey(provider as 'anthropic' | 'openai' | 'gemini');
  }
}

async function addApiKey(provider: 'anthropic' | 'openai' | 'gemini'): Promise<void> {
  const hints: Record<string, string> = {
    anthropic: 'starts with sk-ant-',
    openai: 'starts with sk-',
    gemini: 'starts with AIza',
  };
  const urls: Record<string, string> = {
    anthropic: 'https://console.anthropic.com/settings/keys',
    openai: 'https://platform.openai.com/api-keys',
    gemini: 'https://aistudio.google.com/app/apikey',
  };

  console.log(
    '\n  ' + C.dim('Get your API key at:') + ' ' + C.blue(urls[provider])
  );

  const { apiKey } = await inquirer.prompt([{
    type: 'password',
    name: 'apiKey',
    message: `Enter ${provider} API key (${hints[provider]}):`,
    mask: '●',
    validate: (input: string) => {
      if (!input.trim()) return 'API key cannot be empty';
      return true;
    },
  }]);

  setApiKey(provider, apiKey.trim());
  showSuccess(`${provider} API key saved successfully`);
  console.log('  ' + C.dim('Model: ') + C.green(
    provider === 'anthropic' ? 'claude-opus-4-5' :
    provider === 'openai' ? 'gpt-4o' : 'gemini-2.0-flash'
  ));
  console.log();
}

async function addOllama(): Promise<void> {
  const { baseUrl } = await inquirer.prompt([{
    type: 'input',
    name: 'baseUrl',
    message: 'Ollama base URL:',
    default: 'http://localhost:11434',
    validate: (input: string) => {
      try { new URL(input); return true; }
      catch { return 'Invalid URL'; }
    },
  }]);

  setOllamaUrl(baseUrl.trim());
  showSuccess('Ollama configured');
  showInfo('Make sure Ollama is running: ollama serve');
  showInfo('Pull a model: ollama pull llama3.2');
  console.log();
}

async function removeProviderInteractive(): Promise<void> {
  const config = getConfig();
  const connected = PROVIDERS.filter(p => {
    if (p.value === 'ollama') return !!config.providers.ollama?.baseUrl;
    return !!(config.providers[p.value as 'anthropic' | 'openai' | 'gemini']?.apiKey);
  });

  if (connected.length === 0) {
    showInfo('No providers configured yet.');
    return;
  }

  const { provider } = await inquirer.prompt([{
    type: 'list',
    name: 'provider',
    message: 'Select provider to remove:',
    choices: connected.map(p => ({ name: p.name, value: p.value })),
  }]);

  const { confirm } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirm',
    message: `Remove ${provider} credentials?`,
    default: false,
  }]);

  if (confirm) {
    removeProvider(provider as 'anthropic' | 'openai' | 'gemini' | 'ollama');
    showSuccess(`${provider} credentials removed`);
  }
  console.log();
}

async function testProvider(): Promise<void> {
  const config = getConfig();

  const { provider } = await inquirer.prompt([{
    type: 'list',
    name: 'provider',
    message: 'Test which provider?',
    choices: PROVIDERS.map(p => {
      const isConfigured = p.value === 'ollama'
        ? !!config.providers.ollama?.baseUrl
        : !!(config.providers[p.value as 'anthropic' | 'openai' | 'gemini']?.apiKey);
      return {
        name: (isConfigured ? C.green('●') : C.dim('○')) + ' ' + p.name,
        value: p.value,
      };
    }),
  }]);

  process.stdout.write('\n  Testing connection to ' + C.blue(provider) + ' ...\n');

  try {
    if (provider === 'anthropic') {
      const { AnthropicProvider } = await import('../providers/anthropic');
      const key = config.providers.anthropic?.apiKey;
      if (!key) { showError('No API key configured for Anthropic'); return; }
      const p = new AnthropicProvider(key);
      const r = await p.chat({ model: 'claude-haiku-4-5', messages: [{ role: 'user', content: 'Say "ok"' }], maxTokens: 10 });
      showSuccess(`Connected! Response: "${r.text.trim()}"`);
    } else if (provider === 'openai') {
      const { OpenAIProvider } = await import('../providers/openai');
      const key = config.providers.openai?.apiKey;
      if (!key) { showError('No API key configured for OpenAI'); return; }
      const p = new OpenAIProvider(key);
      const r = await p.chat({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'Say "ok"' }], maxTokens: 10 });
      showSuccess(`Connected! Response: "${r.text.trim()}"`);
    } else if (provider === 'gemini') {
      const { GeminiProvider } = await import('../providers/gemini');
      const key = config.providers.gemini?.apiKey;
      if (!key) { showError('No API key configured for Gemini'); return; }
      const p = new GeminiProvider(key);
      const r = await p.chat({ model: 'gemini-1.5-flash', messages: [{ role: 'user', content: 'Say "ok"' }], maxTokens: 10 });
      showSuccess(`Connected! Response: "${r.text.trim()}"`);
    } else if (provider === 'ollama') {
      const { OllamaProvider } = await import('../providers/ollama');
      const baseUrl = config.providers.ollama?.baseUrl || 'http://localhost:11434';
      const p = new OllamaProvider(baseUrl);
      const models = await p.listModels();
      if (models.length > 0) {
        showSuccess(`Connected! Available models: ${models.slice(0, 3).join(', ')}`);
      } else {
        showError('Ollama is not running or no models installed. Run: ollama serve');
      }
    }
  } catch (err: unknown) {
    showError(`Connection failed: ${(err as Error).message}`);
  }
  console.log();
}

function showProviderStatus(): void {
  const config = getConfig();
  for (const p of PROVIDERS) {
    const connected = p.value === 'ollama'
      ? !!config.providers.ollama?.baseUrl
      : !!(config.providers[p.value as 'anthropic' | 'openai' | 'gemini']?.apiKey);
    const status = connected ? C.green('● connected') : C.dim('○ not configured');
    console.log('  ' + chalk.hex(p.color)(p.name.padEnd(22)) + status);
  }
}
