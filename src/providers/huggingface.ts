import { OpenAICompatibleProvider } from './openai-compatible';

export class HuggingFaceProvider extends OpenAICompatibleProvider {
  constructor(apiKey: string) {
    super(apiKey, 'https://api-inference.huggingface.co/v1', 'huggingface');
  }
}

export const HF_MODELS = [
  'meta-llama/Meta-Llama-3.1-70B-Instruct',
  'Qwen/Qwen2.5-72B-Instruct',
  'mistralai/Mistral-7B-Instruct-v0.3',
];
