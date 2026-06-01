import { GoogleGenerativeAI, GenerativeModel, Content, Part } from '@google/generative-ai';
import { Provider } from './base';
import { ChatRequest, ChatResponse, Message, MessageContent } from '../types';

export class GeminiProvider implements Provider {
  readonly name = 'gemini';
  private genAI: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const { model, messages, system, maxTokens = 4096, onText } = request;
    const modelName = model.replace('gemini-', 'gemini-');

    const genModel: GenerativeModel = this.genAI.getGenerativeModel({
      model: modelName,
      ...(system ? { systemInstruction: system } : {}),
      generationConfig: { maxOutputTokens: maxTokens },
    });

    const history: Content[] = [];
    const lastMessages = [...messages];
    const lastUserMsg = lastMessages.pop();

    for (const msg of lastMessages) {
      history.push(convertMessageToGemini(msg));
    }

    const chat = genModel.startChat({ history });
    const userParts = lastUserMsg ? extractUserParts(lastUserMsg) : [{ text: '' }];

    if (onText) {
      const result = await chat.sendMessageStream(userParts);
      let fullText = '';
      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          fullText += text;
          onText(text);
        }
      }
      return {
        text: fullText,
        toolCalls: [],
        stopReason: 'end_turn',
        rawContent: [{ type: 'text', text: fullText }],
      };
    } else {
      const result = await chat.sendMessage(userParts);
      const text = result.response.text();
      const usageMetadata = result.response.usageMetadata;
      return {
        text,
        toolCalls: [],
        stopReason: 'end_turn',
        usage: usageMetadata ? {
          inputTokens: usageMetadata.promptTokenCount || 0,
          outputTokens: usageMetadata.candidatesTokenCount || 0,
        } : undefined,
        rawContent: [{ type: 'text', text }],
      };
    }
  }
}

function convertMessageToGemini(msg: Message): Content {
  const role = msg.role === 'assistant' ? 'model' : 'user';
  const parts: Part[] = [];

  if (typeof msg.content === 'string') {
    parts.push({ text: msg.content });
  } else {
    for (const block of msg.content) {
      if (block.type === 'text') {
        parts.push({ text: block.text });
      } else if (block.type === 'tool_result') {
        parts.push({ text: `Tool result: ${block.content}` });
      }
    }
  }

  return { role, parts };
}

function extractUserParts(msg: Message): Part[] {
  if (typeof msg.content === 'string') {
    return [{ text: msg.content }];
  }
  return msg.content
    .filter(b => b.type === 'text' || b.type === 'tool_result')
    .map(b => {
      if (b.type === 'text') return { text: b.text };
      if (b.type === 'tool_result') return { text: b.content };
      return { text: '' };
    });
}
