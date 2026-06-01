import { Provider } from '../providers/base';
import { AnthropicProvider } from '../providers/anthropic';
import { OpenAIProvider } from '../providers/openai';
import { GeminiProvider } from '../providers/gemini';
import { OllamaProvider } from '../providers/ollama';
import { AppConfig } from '../types';

export function getProvider(model: string, config: AppConfig): Provider {
  const providerName = getProviderName(model);

  switch (providerName) {
    case 'anthropic': {
      const key = config.providers.anthropic?.apiKey;
      if (!key) throw new Error('Anthropic API key not set. Run /auth to configure.');
      return new AnthropicProvider(key);
    }
    case 'openai': {
      const key = config.providers.openai?.apiKey;
      if (!key) throw new Error('OpenAI API key not set. Run /auth to configure.');
      return new OpenAIProvider(key);
    }
    case 'gemini': {
      const key = config.providers.gemini?.apiKey;
      if (!key) throw new Error('Gemini API key not set. Run /auth to configure.');
      return new GeminiProvider(key);
    }
    case 'ollama': {
      const baseUrl = config.providers.ollama?.baseUrl || 'http://localhost:11434';
      return new OllamaProvider(baseUrl);
    }
    default:
      throw new Error(`Unknown provider for model: ${model}`);
  }
}

export function getProviderName(model: string): 'anthropic' | 'openai' | 'gemini' | 'ollama' {
  if (model.startsWith('claude')) return 'anthropic';
  if (model.startsWith('gpt') || model.startsWith('o1') || model.startsWith('o3') || model.startsWith('o4')) return 'openai';
  if (model.startsWith('gemini')) return 'gemini';
  if (model.startsWith('ollama:')) return 'ollama';
  return 'anthropic';
}

export const KNOWN_MODELS = {
  anthropic: [
    'claude-opus-4-5',
    'claude-sonnet-4-5',
    'claude-haiku-4-5',
    'claude-opus-4-8',
    'claude-sonnet-4-6',
  ],
  openai: [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'o1-preview',
    'o1-mini',
    'o3-mini',
  ],
  gemini: [
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-1.5-pro',
    'gemini-1.5-flash',
  ],
  ollama: ['ollama:llama3.2', 'ollama:codellama', 'ollama:mistral', 'ollama:gemma2'],
};

export function isValidModel(model: string): boolean {
  const allModels = Object.values(KNOWN_MODELS).flat();
  return allModels.includes(model) || model.startsWith('ollama:');
}
