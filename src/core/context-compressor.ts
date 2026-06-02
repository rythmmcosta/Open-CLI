import { Message, AppConfig } from '../types';
import { getProvider } from './router';

const DEFAULT_THRESHOLD = 30; // compress when messages exceed this count
const COMPRESS_COUNT = 20;    // oldest N messages to compress

export async function compressContext(
  messages: Message[],
  config: AppConfig,
  threshold = DEFAULT_THRESHOLD,
): Promise<Message[]> {
  if (messages.length < threshold) return messages;

  const toCompress = messages.slice(0, COMPRESS_COUNT);
  const keep = messages.slice(COMPRESS_COUNT);

  // Build a text summary of the messages
  const conversationText = toCompress
    .map(m => `${m.role}: ${typeof m.content === 'string' ? m.content : '[tool interaction]'}`)
    .join('\n');

  // Use the cheapest available provider
  const summarizerModel = pickCheapestModel(config);
  if (!summarizerModel) return messages; // no provider available, skip compression

  try {
    const provider = getProvider(summarizerModel, config);
    let summary = '';
    await provider.chat({
      model: summarizerModel,
      messages: [{ role: 'user', content: `Summarize this conversation in 3-5 sentences, focusing on decisions made, files modified, and current goals:\n\n${conversationText}` }],
      maxTokens: 300,
      onText: (t: string) => { summary += t; },
    });

    if (!summary) return messages;

    const summaryMessage: Message = {
      role: 'user',
      content: `[CONTEXT SUMMARY — ${COMPRESS_COUNT} messages compressed]\n${summary}`,
    };

    return [summaryMessage, ...keep];
  } catch {
    return messages; // compression failed, return original
  }
}

function pickCheapestModel(config: AppConfig): string | null {
  // Priority: groq (free) → gemini flash (free) → huggingface (free) → whatever else
  const p = config.providers;
  if (p.groq?.apiKey) return 'llama-3.3-70b-versatile';
  if (p.gemini?.apiKey) return 'gemini-2.0-flash';
  if (p.huggingface?.apiKey) return 'meta-llama/Meta-Llama-3.1-8B-Instruct';
  if (p.openai?.apiKey) return 'gpt-4o-mini';
  if (p.anthropic?.apiKey) return 'claude-haiku-4-5';
  if (p.mistral?.apiKey) return 'mistral-small-latest';
  return null;
}
