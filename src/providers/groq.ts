import { OpenAICompatibleProvider } from './openai-compatible';

export class GroqProvider extends OpenAICompatibleProvider {
  constructor(apiKey: string) {
    super(apiKey, 'https://api.groq.com/openai/v1', 'groq');
  }
}

export const GROQ_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'mixtral-8x7b-32768',
  'gemma2-9b-it',
];
