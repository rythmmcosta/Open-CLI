import inquirer from 'inquirer';
import chalk from 'chalk';
import {
  getConfig,
  setApiKey,
  setOllamaUrl,
  setAzureConfig,
  setBedrockConfig,
  setGithubToken,
  removeProvider,
  getConfigPath,
  SimpleProviderKey,
} from '../config';
import { C, showSuccess, showInfo, showError } from '../ui/display';

const PROVIDERS = [
  // ── Free / Local ──────────────────────────────────────────
  { value: 'ollama',      name: 'Ollama (Local / Free)',    color: '#ffb300', models: 'llama3.2, codellama, mistral, gemma2, ...' },
  // ── Major commercial ──────────────────────────────────────
  { value: 'anthropic',  name: 'Claude (Anthropic)',        color: '#00ff9d', models: 'claude-opus-4-8, claude-sonnet-4-6, ...' },
  { value: 'openai',     name: 'GPT (OpenAI)',              color: '#00c9ff', models: 'gpt-4o, gpt-4o-mini, o3-mini, ...' },
  { value: 'gemini',     name: 'Gemini (Google)',           color: '#b36aff', models: 'gemini-2.0-flash, gemini-1.5-pro, ...' },
  // ── Fast / Cheap inference ────────────────────────────────
  { value: 'groq',       name: 'Groq (Ultra-fast LLM)',     color: '#ff6b35', models: 'llama-3.3-70b-versatile, mixtral-8x7b, ...' },
  { value: 'deepseek',   name: 'DeepSeek',                  color: '#4a9eff', models: 'deepseek-chat, deepseek-reasoner' },
  { value: 'mistral',    name: 'Mistral AI',                color: '#ff6b6b', models: 'mistral-large-latest, codestral-latest, ...' },
  { value: 'cohere',     name: 'Cohere',                    color: '#39d353', models: 'command-r-plus-08-2024, command-r-08-2024, ...' },
  // ── Specialist ────────────────────────────────────────────
  { value: 'perplexity', name: 'Perplexity (Search AI)',    color: '#20d5f2', models: 'sonar-pro, sonar, sonar-reasoning' },
  { value: 'xai',        name: 'xAI Grok',                  color: '#ffffff', models: 'grok-3, grok-3-mini, grok-2' },
  { value: 'together',   name: 'Together AI',               color: '#e74c3c', models: 'Llama-3.1-70B-Turbo, Qwen2.5-72B, ...' },
  { value: 'cerebras',   name: 'Cerebras (Fast inference)',  color: '#9b59b6', models: 'llama3.3-70b, llama3.1-8b' },
  { value: 'moonshot',   name: 'Moonshot / Kimi',           color: '#ffd700', models: 'moonshot-v1-8k, moonshot-v1-32k, ...' },
  { value: 'huggingface',name: 'HuggingFace Inference API', color: '#ff9500', models: 'Meta-Llama-3.1-70B, Qwen2.5-72B, ...' },
  // ── Cloud / Enterprise ────────────────────────────────────
  { value: 'azure',      name: 'Azure OpenAI',              color: '#0078d4', models: 'gpt-4o, gpt-4-turbo (via deployment)' },
  { value: 'bedrock',    name: 'AWS Bedrock',               color: '#ff9900', models: 'Claude, Llama, Titan (via AWS)' },
  // ── GitHub ────────────────────────────────────────────────
  { value: 'github',     name: 'GitHub (PAT for /github commands)', color: '#ffffff', models: 'n/a (API token)' },
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

  if (provider === 'ollama') { await addOllama(); return; }
  if (provider === 'azure') { await addAzure(); return; }
  if (provider === 'bedrock') { await addBedrock(); return; }
  if (provider === 'github') { await addGithub(); return; }
  await addApiKey(provider as SimpleProviderKey);
}

async function addApiKey(provider: SimpleProviderKey): Promise<void> {
  const hints: Record<string, string> = {
    anthropic: 'starts with sk-ant-',
    openai: 'starts with sk-',
    gemini: 'starts with AIza',
    mistral: 'starts with ...',
    groq: 'starts with gsk_',
    moonshot: 'your Moonshot API key',
    xai: 'your xAI API key',
    deepseek: 'your DeepSeek API key',
    together: 'your Together AI API key',
    perplexity: 'starts with pplx-',
    cerebras: 'your Cerebras API key',
    huggingface: 'starts with hf_',
    cohere: 'your Cohere API key',
  };
  const urls: Record<string, string> = {
    anthropic: 'https://console.anthropic.com/settings/keys',
    openai: 'https://platform.openai.com/api-keys',
    gemini: 'https://aistudio.google.com/app/apikey',
    mistral: 'https://console.mistral.ai/api-keys/',
    groq: 'https://console.groq.com/keys',
    moonshot: 'https://platform.moonshot.cn/console/api-keys',
    xai: 'https://console.x.ai/api-keys',
    deepseek: 'https://platform.deepseek.com/api_keys',
    together: 'https://api.together.ai/settings/api-keys',
    perplexity: 'https://www.perplexity.ai/settings/api',
    cerebras: 'https://cloud.cerebras.ai/platform',
    huggingface: 'https://huggingface.co/settings/tokens',
    cohere: 'https://dashboard.cohere.com/api-keys',
  };

  if (urls[provider]) {
    console.log('\n  ' + C.dim('Get your API key at:') + ' ' + C.blue(urls[provider]));
  }

  const { apiKey } = await inquirer.prompt([{
    type: 'password',
    name: 'apiKey',
    message: `Enter ${provider} API key (${hints[provider] || 'your API key'}):`,
    mask: '●',
    validate: (input: string) => (!input.trim() ? 'API key cannot be empty' : true),
  }]);

  setApiKey(provider, apiKey.trim());
  showSuccess(`${provider} API key saved`);
  console.log();
}

async function addOllama(): Promise<void> {
  const { baseUrl } = await inquirer.prompt([{
    type: 'input',
    name: 'baseUrl',
    message: 'Ollama base URL:',
    default: 'http://localhost:11434',
    validate: (input: string) => { try { new URL(input); return true; } catch { return 'Invalid URL'; } },
  }]);
  setOllamaUrl(baseUrl.trim());
  showSuccess('Ollama configured');
  showInfo('Make sure Ollama is running: ollama serve');
  showInfo('Pull a model: ollama pull llama3.2');
  console.log();
}

async function addAzure(): Promise<void> {
  console.log('\n  ' + C.dim('Azure OpenAI requires an endpoint, deployment name, and API key.'));
  const answers = await inquirer.prompt([
    { type: 'input',    name: 'endpoint',       message: 'Azure endpoint (e.g. https://myinstance.openai.azure.com):' },
    { type: 'input',    name: 'deploymentName', message: 'Deployment name (e.g. gpt-4o-prod):' },
    { type: 'password', name: 'apiKey',          message: 'API key:', mask: '●' },
    { type: 'input',    name: 'apiVersion',      message: 'API version:', default: '2024-02-01' },
  ]);
  setAzureConfig(answers.apiKey.trim(), answers.endpoint.trim(), answers.deploymentName.trim(), answers.apiVersion.trim());
  showSuccess('Azure OpenAI configured');
  console.log();
}

async function addBedrock(): Promise<void> {
  console.log('\n  ' + C.dim('AWS Bedrock uses IAM credentials. Make sure you have Bedrock model access enabled.'));
  const answers = await inquirer.prompt([
    { type: 'input',    name: 'accessKeyId',     message: 'AWS Access Key ID:' },
    { type: 'password', name: 'secretAccessKey', message: 'AWS Secret Access Key:', mask: '●' },
    { type: 'input',    name: 'region',           message: 'AWS Region:', default: 'us-east-1' },
    { type: 'password', name: 'sessionToken',     message: 'Session Token (optional, press Enter to skip):', mask: '●' },
  ]);
  setBedrockConfig(
    answers.accessKeyId.trim(),
    answers.secretAccessKey.trim(),
    answers.region.trim(),
    answers.sessionToken.trim() || undefined
  );
  showSuccess('AWS Bedrock configured');
  console.log();
}

async function addGithub(): Promise<void> {
  console.log('\n  ' + C.dim('Get a Personal Access Token at: https://github.com/settings/tokens'));
  console.log('  ' + C.dim('Required scopes: repo, read:user'));
  const { token } = await inquirer.prompt([{
    type: 'password',
    name: 'token',
    message: 'Enter GitHub Personal Access Token:',
    mask: '●',
    validate: (input: string) => (!input.trim() ? 'Token cannot be empty' : true),
  }]);
  setGithubToken(token.trim());
  showSuccess('GitHub token saved — use /github commands to interact with repos');
  console.log();
}

async function removeProviderInteractive(): Promise<void> {
  const config = getConfig();

  const connected = PROVIDERS.filter(p => {
    const prov = (config.providers as Record<string, unknown>)[p.value];
    return prov !== undefined && prov !== null;
  });

  if (connected.length === 0) { showInfo('No providers configured yet.'); return; }

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
    removeProvider(provider as keyof import('../types').ProviderConfig);
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
      const prov = (config.providers as Record<string, unknown>)[p.value];
      const isConfigured = prov !== undefined && prov !== null;
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
      if (models.length > 0) showSuccess(`Connected! Models: ${models.slice(0, 3).join(', ')}`);
      else showError('Ollama is not running or no models installed. Run: ollama serve');
    } else if (provider === 'groq') {
      const { GroqProvider } = await import('../providers/groq');
      const key = config.providers.groq?.apiKey;
      if (!key) { showError('No API key for Groq'); return; }
      const p = new GroqProvider(key);
      const r = await p.chat({ model: 'llama-3.1-8b-instant', messages: [{ role: 'user', content: 'Say "ok"' }], maxTokens: 10 });
      showSuccess(`Connected! Response: "${r.text.trim()}"`);
    } else if (provider === 'mistral') {
      const { MistralProvider } = await import('../providers/mistral');
      const key = config.providers.mistral?.apiKey;
      if (!key) { showError('No API key for Mistral'); return; }
      const p = new MistralProvider(key);
      const r = await p.chat({ model: 'mistral-small-latest', messages: [{ role: 'user', content: 'Say "ok"' }], maxTokens: 10 });
      showSuccess(`Connected! Response: "${r.text.trim()}"`);
    } else if (provider === 'deepseek') {
      const { DeepSeekProvider } = await import('../providers/deepseek');
      const key = config.providers.deepseek?.apiKey;
      if (!key) { showError('No API key for DeepSeek'); return; }
      const p = new DeepSeekProvider(key);
      const r = await p.chat({ model: 'deepseek-chat', messages: [{ role: 'user', content: 'Say "ok"' }], maxTokens: 10 });
      showSuccess(`Connected! Response: "${r.text.trim()}"`);
    } else {
      showInfo(`Connection test for ${provider} not implemented yet. Try adding an API key and running a prompt.`);
    }
  } catch (err: unknown) {
    showError(`Connection failed: ${(err as Error).message}`);
  }
  console.log();
}

function showProviderStatus(): void {
  const config = getConfig();
  for (const p of PROVIDERS) {
    const prov = (config.providers as Record<string, unknown>)[p.value];
    const connected = prov !== undefined && prov !== null;
    const status = connected ? C.green('● connected') : C.dim('○ not configured');
    console.log('  ' + chalk.hex(p.color)(p.name.padEnd(30)) + status);
  }
}
