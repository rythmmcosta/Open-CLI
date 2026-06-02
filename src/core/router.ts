import { Provider } from '../providers/base';
import { AnthropicProvider } from '../providers/anthropic';
import { OpenAIProvider } from '../providers/openai';
import { GeminiProvider } from '../providers/gemini';
import { OllamaProvider } from '../providers/ollama';
import { MistralProvider, MISTRAL_MODELS } from '../providers/mistral';
import { GroqProvider, GROQ_MODELS } from '../providers/groq';
import { MoonshotProvider, MOONSHOT_MODELS } from '../providers/moonshot';
import { XAIProvider, XAI_MODELS } from '../providers/xai';
import { DeepSeekProvider, DEEPSEEK_MODELS } from '../providers/deepseek';
import { TogetherProvider, TOGETHER_MODELS } from '../providers/together';
import { PerplexityProvider, PERPLEXITY_MODELS } from '../providers/perplexity';
import { CerebrasProvider, CEREBRAS_MODELS } from '../providers/cerebras';
import { HuggingFaceProvider, HF_MODELS } from '../providers/huggingface';
import { CohereProvider, COHERE_MODELS } from '../providers/cohere';
import { AzureProvider, AZURE_MODELS } from '../providers/azure';
import { BedrockProvider, BEDROCK_MODELS } from '../providers/bedrock';
import { OpenRouterProvider, OPENROUTER_FREE_MODELS } from '../providers/openrouter';
import { AppConfig } from '../types';

export type ProviderName =
  | 'anthropic' | 'openai' | 'gemini' | 'ollama'
  | 'mistral' | 'groq' | 'moonshot' | 'xai' | 'deepseek'
  | 'together' | 'perplexity' | 'cerebras' | 'huggingface'
  | 'cohere' | 'azure' | 'bedrock' | 'openrouter';

export function getProviderName(model: string): ProviderName {
  if (model.startsWith('claude'))                         return 'anthropic';
  if (model.startsWith('gpt') || model.startsWith('o1') || model.startsWith('o3') || model.startsWith('o4')) return 'openai';
  if (model.startsWith('gemini'))                         return 'gemini';
  if (model.startsWith('ollama:'))                        return 'ollama';
  if (model.startsWith('mistral') || model.startsWith('codestral') || model.startsWith('open-mistral')) return 'mistral';
  if (model.startsWith('llama-3') || model.startsWith('mixtral') || model.startsWith('gemma2-')) return 'groq';
  if (model.startsWith('moonshot'))                       return 'moonshot';
  if (model.startsWith('grok'))                           return 'xai';
  if (model.startsWith('deepseek'))                       return 'deepseek';
  if (model.startsWith('meta-llama') || model.startsWith('Qwen') || model.startsWith('togethercomputer')) return 'together';
  if (model.startsWith('sonar'))                          return 'perplexity';
  if (model.startsWith('llama3.') || model.startsWith('llama3_')) return 'cerebras';
  if (model.includes('/') && !model.startsWith('ollama')) return 'huggingface';
  if (model.startsWith('command-r'))                      return 'cohere';
  if (model.startsWith('azure:'))                         return 'azure';
  if (model.startsWith('bedrock:') || model.includes('anthropic.claude') || model.includes('amazon.titan')) return 'bedrock';
  return 'anthropic';
}

export function getProvider(model: string, config: AppConfig): Provider {
  const providerName = getProviderName(model);

  switch (providerName) {
    case 'anthropic': {
      const key = config.providers.anthropic?.apiKey;
      if (!key) throw new Error('Anthropic API key not set. Run: opencli auth');
      return new AnthropicProvider(key);
    }
    case 'openai': {
      const key = config.providers.openai?.apiKey;
      if (!key) throw new Error('OpenAI API key not set. Run: opencli auth');
      return new OpenAIProvider(key);
    }
    case 'gemini': {
      const key = config.providers.gemini?.apiKey;
      if (!key) throw new Error('Gemini API key not set. Run: opencli auth');
      return new GeminiProvider(key);
    }
    case 'ollama': {
      const baseUrl = config.providers.ollama?.baseUrl || 'http://localhost:11434';
      return new OllamaProvider(baseUrl);
    }
    case 'mistral': {
      const key = config.providers.mistral?.apiKey;
      if (!key) throw new Error('Mistral API key not set. Run: opencli auth');
      return new MistralProvider(key);
    }
    case 'groq': {
      const key = config.providers.groq?.apiKey;
      if (!key) throw new Error('Groq API key not set. Run: opencli auth');
      return new GroqProvider(key);
    }
    case 'moonshot': {
      const key = config.providers.moonshot?.apiKey;
      if (!key) throw new Error('Moonshot (Kimi) API key not set. Run: opencli auth');
      return new MoonshotProvider(key);
    }
    case 'xai': {
      const key = config.providers.xai?.apiKey;
      if (!key) throw new Error('xAI (Grok) API key not set. Run: opencli auth');
      return new XAIProvider(key);
    }
    case 'deepseek': {
      const key = config.providers.deepseek?.apiKey;
      if (!key) throw new Error('DeepSeek API key not set. Run: opencli auth');
      return new DeepSeekProvider(key);
    }
    case 'together': {
      const key = config.providers.together?.apiKey;
      if (!key) throw new Error('Together AI API key not set. Run: opencli auth');
      return new TogetherProvider(key);
    }
    case 'perplexity': {
      const key = config.providers.perplexity?.apiKey;
      if (!key) throw new Error('Perplexity API key not set. Run: opencli auth');
      return new PerplexityProvider(key);
    }
    case 'cerebras': {
      const key = config.providers.cerebras?.apiKey;
      if (!key) throw new Error('Cerebras API key not set. Run: opencli auth');
      return new CerebrasProvider(key);
    }
    case 'huggingface': {
      const key = config.providers.huggingface?.apiKey;
      if (!key) throw new Error('HuggingFace API key not set. Run: opencli auth');
      return new HuggingFaceProvider(key);
    }
    case 'cohere': {
      const key = config.providers.cohere?.apiKey;
      if (!key) throw new Error('Cohere API key not set. Run: opencli auth');
      return new CohereProvider(key);
    }
    case 'azure': {
      const az = config.providers.azure;
      if (!az?.apiKey || !az.endpoint || !az.deploymentName) {
        throw new Error('Azure OpenAI not configured. Run: opencli auth');
      }
      return new AzureProvider(az.apiKey, az.endpoint, az.deploymentName, az.apiVersion);
    }
    case 'bedrock': {
      const bd = config.providers.bedrock;
      if (!bd?.accessKeyId || !bd.secretAccessKey) {
        throw new Error('AWS Bedrock credentials not set. Run: opencli auth');
      }
      return new BedrockProvider(bd.accessKeyId, bd.secretAccessKey, bd.region || 'us-east-1', bd.sessionToken);
    }
    default:
      throw new Error(`Unknown provider for model: ${model}`);
  }
}

export const KNOWN_MODELS = {
  anthropic: [
    'claude-opus-4-8',
    'claude-sonnet-4-6',
    'claude-haiku-4-5',
    'claude-opus-4-5',
    'claude-sonnet-4-5',
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
  mistral: MISTRAL_MODELS,
  groq: GROQ_MODELS,
  moonshot: MOONSHOT_MODELS,
  xai: XAI_MODELS,
  deepseek: DEEPSEEK_MODELS,
  together: TOGETHER_MODELS,
  perplexity: PERPLEXITY_MODELS,
  cerebras: CEREBRAS_MODELS,
  huggingface: HF_MODELS,
  cohere: COHERE_MODELS,
  azure: AZURE_MODELS,
  bedrock: BEDROCK_MODELS,
};

export function isValidModel(model: string): boolean {
  const allModels = Object.values(KNOWN_MODELS).flat();
  return allModels.includes(model) || model.startsWith('ollama:');
}
