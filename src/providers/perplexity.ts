import { OpenAICompatibleProvider } from './openai-compatible';

export class PerplexityProvider extends OpenAICompatibleProvider {
  constructor(apiKey: string) {
    super(apiKey, 'https://api.perplexity.ai', 'perplexity');
  }
}

export const PERPLEXITY_MODELS = [
  'sonar-pro',
  'sonar',
  'sonar-reasoning',
];
