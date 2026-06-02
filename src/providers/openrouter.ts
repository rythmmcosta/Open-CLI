import OpenAI from 'openai';
import { OpenAICompatibleProvider } from './openai-compatible';
import { ChatRequest, ChatResponse } from '../types';
import { convertOAIMessage, convertOAITool } from './openai-compatible';

export const OPENROUTER_FREE_MODELS = [
  'deepseek/deepseek-r1:free',
  'meta-llama/llama-3.1-8b-instruct:free',
  'google/gemma-2-9b-it:free',
  'mistralai/mistral-7b-instruct:free',
  'nousresearch/hermes-3-llama-3.1-405b:free',
];

export class OpenRouterProvider extends OpenAICompatibleProvider {
  readonly name = 'openrouter';
  private readonly openRouterClient: OpenAI;

  constructor(apiKey: string) {
    super(apiKey, 'https://openrouter.ai/api/v1', OPENROUTER_FREE_MODELS[0]);
    // Create a second client with the OpenRouter-required extra headers
    this.openRouterClient = new OpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://opencli.myowncloud.tech',
        'X-Title': 'Open CLI',
      },
    });
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const { model, messages, system, tools, maxTokens = 4096, onText } = request;

    const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (system) {
      openaiMessages.push({ role: 'system', content: system });
    }
    for (const msg of messages) {
      openaiMessages.push(...convertOAIMessage(msg));
    }

    const openaiTools = tools?.map(convertOAITool);
    const toolsParam =
      openaiTools && openaiTools.length > 0 ? { tools: openaiTools } : {};

    if (onText) {
      const stream = await this.openRouterClient.chat.completions.create({
        model,
        max_tokens: maxTokens,
        messages: openaiMessages,
        ...toolsParam,
        stream: true,
      });

      let fullText = '';
      const toolCallsMap: Record<number, { id: string; name: string; argsStr: string }> = {};

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (!delta) continue;

        if (delta.content) {
          fullText += delta.content;
          onText(delta.content);
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index;
            if (!toolCallsMap[idx]) {
              toolCallsMap[idx] = {
                id: tc.id ?? '',
                name: tc.function?.name ?? '',
                argsStr: '',
              };
            } else {
              if (tc.id && !toolCallsMap[idx].id) toolCallsMap[idx].id = tc.id;
              if (tc.function?.name && !toolCallsMap[idx].name) {
                toolCallsMap[idx].name = tc.function.name;
              }
            }
            if (tc.function?.arguments) {
              toolCallsMap[idx].argsStr += tc.function.arguments;
            }
          }
        }
      }

      const toolCalls = Object.values(toolCallsMap).map(tc => ({
        id: tc.id,
        name: tc.name,
        input: safeParseJSON(tc.argsStr),
      }));

      const rawContent = [];
      if (fullText) rawContent.push({ type: 'text' as const, text: fullText });
      for (const tc of toolCalls) {
        rawContent.push({ type: 'tool_use' as const, id: tc.id, name: tc.name, input: tc.input });
      }

      return {
        text: fullText,
        toolCalls,
        stopReason: toolCalls.length > 0 ? 'tool_use' : 'end_turn',
        rawContent,
      };
    }

    const response = await this.openRouterClient.chat.completions.create({
      model,
      max_tokens: maxTokens,
      messages: openaiMessages,
      ...toolsParam,
    });

    const choice = response.choices[0];
    const text = choice.message.content ?? '';

    const toolCalls = (choice.message.tool_calls ?? []).map(tc => ({
      id: tc.id,
      name: tc.function.name,
      input: safeParseJSON(tc.function.arguments),
    }));

    const rawContent = [];
    if (text) rawContent.push({ type: 'text' as const, text });
    for (const tc of toolCalls) {
      rawContent.push({ type: 'tool_use' as const, id: tc.id, name: tc.name, input: tc.input });
    }

    let stopReason: ChatResponse['stopReason'] = 'end_turn';
    if (choice.finish_reason === 'tool_calls') stopReason = 'tool_use';
    else if (choice.finish_reason === 'length') stopReason = 'max_tokens';

    return {
      text,
      toolCalls,
      stopReason,
      usage: response.usage
        ? {
            inputTokens: response.usage.prompt_tokens,
            outputTokens: response.usage.completion_tokens,
          }
        : undefined,
      rawContent,
    };
  }

  async listModels(): Promise<string[]> {
    return OPENROUTER_FREE_MODELS;
  }
}

function safeParseJSON(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}
