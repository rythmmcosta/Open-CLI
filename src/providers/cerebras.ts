import { OpenAICompatibleProvider } from './openai-compatible';

export class CerebrasProvider extends OpenAICompatibleProvider {
  constructor(apiKey: string) {
    super(apiKey, 'https://api.cerebras.ai/v1', 'cerebras');
  }
}

export const CEREBRAS_MODELS = [
  'llama3.3-70b',
  'llama3.1-8b',
];
