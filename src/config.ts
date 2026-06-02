import Conf from 'conf';
import { AppConfig, ProfileConfig } from './types';

const DEFAULT_CONFIG: AppConfig = {
  defaultModel: '',
  activeSkill: 'default',
  autoApprove: false,
  dryRun: false,
  contextWindow: 20,
  showUsage: false,
  providers: {},
  profiles: {
    work: {
      model: 'gpt-4o',
      autoApprove: true,
      system: 'You are a senior backend engineer. Be concise.',
    },
    local: {
      model: 'ollama:llama3.2',
      autoApprove: false,
      system: 'You are a helpful terminal assistant.',
    },
    review: {
      model: 'claude-opus-4-5',
      autoApprove: false,
      system: 'You are a strict code reviewer. Point out every issue.',
    },
  },
};

let _store: Conf<AppConfig> | null = null;

function getStore(): Conf<AppConfig> {
  if (!_store) {
    _store = new Conf<AppConfig>({
      projectName: 'opencli',
      defaults: DEFAULT_CONFIG,
    });
  }
  return _store;
}

export function getConfig(): AppConfig {
  const store = getStore();
  return {
    defaultModel: store.get('defaultModel'),
    activeSkill: store.get('activeSkill'),
    autoApprove: store.get('autoApprove'),
    dryRun: store.get('dryRun'),
    contextWindow: store.get('contextWindow'),
    showUsage: store.get('showUsage'),
    providers: store.get('providers'),
    profiles: store.get('profiles'),
    activeProfile: store.get('activeProfile'),
  };
}

export function setConfigValue<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
  getStore().set(key, value);
}

export function getConfigPath(): string {
  return getStore().path;
}

export type SimpleProviderKey =
  | 'anthropic' | 'openai' | 'gemini'
  | 'mistral' | 'groq' | 'moonshot' | 'xai' | 'deepseek'
  | 'together' | 'perplexity' | 'cerebras' | 'huggingface' | 'cohere'
  | 'stability' | 'ideogram' | 'fal' | 'runway' | 'luma';

export function setApiKey(provider: SimpleProviderKey, apiKey: string): void {
  const store = getStore();
  const providers = store.get('providers') || {};
  (providers as Record<string, { apiKey: string }>)[provider] = { apiKey };
  store.set('providers', providers);
}

export function setOllamaUrl(baseUrl: string): void {
  const store = getStore();
  const providers = store.get('providers') || {};
  providers.ollama = { baseUrl };
  store.set('providers', providers);
}

export function setAzureConfig(apiKey: string, endpoint: string, deploymentName: string, apiVersion?: string): void {
  const store = getStore();
  const providers = store.get('providers') || {};
  providers.azure = { apiKey, endpoint, deploymentName, apiVersion: apiVersion || '2024-02-01' };
  store.set('providers', providers);
}

export function setBedrockConfig(accessKeyId: string, secretAccessKey: string, region: string, sessionToken?: string): void {
  const store = getStore();
  const providers = store.get('providers') || {};
  providers.bedrock = { accessKeyId, secretAccessKey, region, sessionToken };
  store.set('providers', providers);
}

export function setGithubToken(token: string): void {
  const store = getStore();
  const providers = store.get('providers') || {};
  providers.github = { token };
  store.set('providers', providers);
}

export function setReplicateToken(apiToken: string): void {
  const store = getStore();
  const providers = store.get('providers') || {};
  (providers as Record<string, unknown>).replicate = { apiToken };
  store.set('providers', providers);
}

export function removeProvider(provider: keyof import('./types').ProviderConfig): void {
  const store = getStore();
  const providers = store.get('providers') || {};
  delete (providers as Record<string, unknown>)[provider];
  store.set('providers', providers);
}

export function setProfile(name: string, profile: ProfileConfig): void {
  const store = getStore();
  const profiles = store.get('profiles') || {};
  profiles[name] = profile;
  store.set('profiles', profiles);
}

export function applyProfile(profileName: string): AppConfig | null {
  const config = getConfig();
  const profile = config.profiles[profileName];
  if (!profile) return null;
  setConfigValue('defaultModel', profile.model);
  if (profile.autoApprove !== undefined) setConfigValue('autoApprove', profile.autoApprove);
  if (profile.skill) setConfigValue('activeSkill', profile.skill);
  setConfigValue('activeProfile', profileName);
  return getConfig();
}

export function resolveModel(modelFlag?: string): string {
  if (modelFlag) return modelFlag;
  const config = getConfig();
  return config.defaultModel || 'claude-opus-4-5';
}

export function getProviderForModel(model: string): 'anthropic' | 'openai' | 'gemini' | 'ollama' {
  if (model.startsWith('claude')) return 'anthropic';
  if (model.startsWith('gpt') || model.startsWith('o1') || model.startsWith('o3')) return 'openai';
  if (model.startsWith('gemini')) return 'gemini';
  if (model.startsWith('ollama:')) return 'ollama';
  return 'anthropic';
}

function hasAnyProvider(config: AppConfig): boolean {
  const p = config.providers || {};
  return !!(p.anthropic?.apiKey || p.openai?.apiKey || p.groq?.apiKey ||
            p.gemini?.apiKey || p.ollama || p.openrouter?.apiKey ||
            p.mistral?.apiKey || p.cohere?.apiKey || p.deepseek?.apiKey);
}

export async function autoSelectProvider(config: AppConfig): Promise<void> {
  // If already configured, do nothing
  if (config.defaultModel && hasAnyProvider(config)) return;

  // Check for owner-injected fallback key (env var, not hardcoded)
  const fallbackKey = process.env.OPENCLI_FALLBACK_KEY;
  if (fallbackKey) {
    if (!config.providers) (config as AppConfig & { providers: Record<string, unknown> }).providers = {};
    if (!(config.providers as Record<string, unknown>).groq) {
      (config.providers as Record<string, unknown>).groq = {};
    }
    (config.providers as Record<string, { apiKey: string }>).groq = { apiKey: fallbackKey };
    setConfigValue('defaultModel', 'groq:llama-3.3-70b-versatile');
    return;
  }

  // Try Ollama
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 800);
    const res = await fetch('http://localhost:11434/api/tags', { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json() as { models?: Array<{name: string}> };
      const models = data.models || [];
      const preferred = ['llama3.2', 'llama3.1', 'llama3', 'mistral', 'phi3'];
      let chosen = models[0]?.name;
      for (const p of preferred) {
        const found = models.find((m: {name: string}) => m.name.startsWith(p));
        if (found) { chosen = found.name; break; }
      }
      if (chosen) {
        setConfigValue('defaultModel', `ollama:${chosen}`);
        return;
      }
    }
  } catch { /* Ollama not running */ }

  // Fall back to Pollinations (free, no key)
  setConfigValue('defaultModel', 'pollinations-text:openai');
}
