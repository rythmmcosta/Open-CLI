import { OpenAICompatibleProvider } from './openai-compatible';

export class PollinationsTextProvider extends OpenAICompatibleProvider {
  constructor() {
    // Pollinations text endpoint base; chat completions at /openai (appended by OpenAI SDK)
    super('', 'https://text.pollinations.ai/openai', 'Pollinations (free)');
  }

  /**
   * Override listModels to skip Authorization header (no key needed).
   */
  async listModels(): Promise<string[]> {
    try {
      const nodeFetch = require('node-fetch');
      const res = await nodeFetch(`${this.baseUrl}/models`, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) return ['openai'];
      const data = (await res.json()) as unknown;
      if (
        data !== null &&
        typeof data === 'object' &&
        'data' in data &&
        Array.isArray((data as { data: unknown }).data)
      ) {
        return (data as { data: { id: string }[] }).data
          .map(m => m.id)
          .filter(id => typeof id === 'string');
      }
      return ['openai'];
    } catch {
      return ['openai'];
    }
  }
}
