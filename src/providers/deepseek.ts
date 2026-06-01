import { OpenAICompatibleProvider } from './openai-compatible';

export class DeepSeekProvider extends OpenAICompatibleProvider {
  constructor(apiKey: string) {
    super(apiKey, 'https://api.deepseek.com/v1', 'deepseek');
  }
}

export const DEEPSEEK_MODELS = [
  'deepseek-chat',
  'deepseek-reasoner',
];
