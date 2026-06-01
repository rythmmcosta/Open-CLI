import Conf from 'conf';
import { AppConfig, ProfileConfig } from './types';

const DEFAULT_CONFIG: AppConfig = {
  defaultModel: 'claude-opus-4-5',
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

export function setApiKey(provider: 'anthropic' | 'openai' | 'gemini', apiKey: string): void {
  const store = getStore();
  const providers = store.get('providers') || {};
  providers[provider] = { apiKey };
  store.set('providers', providers);
}

export function setOllamaUrl(baseUrl: string): void {
  const store = getStore();
  const providers = store.get('providers') || {};
  providers.ollama = { baseUrl };
  store.set('providers', providers);
}

export function removeProvider(provider: 'anthropic' | 'openai' | 'gemini' | 'ollama'): void {
  const store = getStore();
  const providers = store.get('providers') || {};
  delete providers[provider];
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
