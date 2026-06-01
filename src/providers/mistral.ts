import { OpenAICompatibleProvider } from './openai-compatible';

export class MistralProvider extends OpenAICompatibleProvider {
  constructor(apiKey: string) {
    super(apiKey, 'https://api.mistral.ai/v1', 'mistral');
  }
}

export const MISTRAL_MODELS = [
  'mistral-large-latest',
  'mistral-small-latest',
  'codestral-latest',
  'open-mistral-nemo',
];
