import { OpenAICompatibleProvider } from './openai-compatible';

/** xAI (Grok) */
export class XAIProvider extends OpenAICompatibleProvider {
  constructor(apiKey: string) {
    super(apiKey, 'https://api.x.ai/v1', 'xai');
  }
}

export const XAI_MODELS = [
  'grok-3',
  'grok-3-mini',
  'grok-2',
];
