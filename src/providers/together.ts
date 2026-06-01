import { OpenAICompatibleProvider } from './openai-compatible';

export class TogetherProvider extends OpenAICompatibleProvider {
  constructor(apiKey: string) {
    super(apiKey, 'https://api.together.ai/v1', 'together');
  }
}

export const TOGETHER_MODELS = [
  'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
  'Qwen/Qwen2.5-72B-Instruct-Turbo',
  'mistralai/Mixtral-8x7B-Instruct-v0.1',
];
