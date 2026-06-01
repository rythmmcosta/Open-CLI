import { Provider } from './base';
import { ChatRequest, ChatResponse, Message, MessageContent } from '../types';

interface OllamaMessage {
  role: string;
  content: string;
}

interface OllamaResponse {
  message: { role: string; content: string };
  done: boolean;
  prompt_eval_count?: number;
  eval_count?: number;
}

export class OllamaProvider implements Provider {
  readonly name = 'ollama';
  private baseUrl: string;

  constructor(baseUrl = 'http://localhost:11434') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const { model, messages, system, maxTokens = 4096, onText } = request;
    const actualModel = model.replace('ollama:', '');

    const ollamaMessages: OllamaMessage[] = [];
    if (system) {
      ollamaMessages.push({ role: 'system', content: system });
    }
    for (const msg of messages) {
      ollamaMessages.push(convertMessage(msg));
    }

    const body = JSON.stringify({
      model: actualModel,
      messages: ollamaMessages,
      stream: !!onText,
      options: { num_predict: maxTokens },
    });

    if (onText) {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      if (!response.ok) {
        throw new Error(`Ollama error: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      let fullText = '';
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split('\n')) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line) as OllamaResponse;
            if (data.message?.content) {
              fullText += data.message.content;
              onText(data.message.content);
            }
          } catch { /* ignore parse errors */ }
        }
      }

      return {
        text: fullText,
        toolCalls: [],
        stopReason: 'end_turn',
        rawContent: [{ type: 'text', text: fullText }],
      };
    } else {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      if (!response.ok) {
        throw new Error(`Ollama error: ${response.statusText}`);
      }

      const data = await response.json() as OllamaResponse;
      const text = data.message?.content || '';

      return {
        text,
        toolCalls: [],
        stopReason: 'end_turn',
        usage: {
          inputTokens: data.prompt_eval_count || 0,
          outputTokens: data.eval_count || 0,
        },
        rawContent: [{ type: 'text', text }],
      };
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      const data = await response.json() as { models: Array<{ name: string }> };
      return data.models.map(m => `ollama:${m.name}`);
    } catch {
      return [];
    }
  }
}

function convertMessage(msg: Message): OllamaMessage {
  if (typeof msg.content === 'string') {
    return { role: msg.role, content: msg.content };
  }
  const text = msg.content
    .filter(b => b.type === 'text' || b.type === 'tool_result')
    .map(b => {
      if (b.type === 'text') return b.text;
      if (b.type === 'tool_result') return `[Tool result]: ${b.content}`;
      return '';
    })
    .join('\n');
  return { role: msg.role, content: text };
}
