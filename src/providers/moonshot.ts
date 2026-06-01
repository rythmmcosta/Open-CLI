import { OpenAICompatibleProvider } from './openai-compatible';

/** Moonshot AI (Kimi) */
export class MoonshotProvider extends OpenAICompatibleProvider {
  constructor(apiKey: string) {
    super(apiKey, 'https://api.moonshot.cn/v1', 'moonshot');
  }
}

export const MOONSHOT_MODELS = [
  'moonshot-v1-8k',
  'moonshot-v1-32k',
  'moonshot-v1-128k',
];
