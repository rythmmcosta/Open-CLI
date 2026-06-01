/**
 * OpenAICompatibleProvider
 *
 * A base class for any provider that speaks the OpenAI Chat Completions API.
 * Subclasses only need to supply the base URL, API key and a display name.
 *
 * Supports:
 *  - Streaming (when request.onText is provided)
 *  - Non-streaming
 *  - Tool/function calling (maps ToolDef → OpenAI function tool)
 *  - Mixed assistant messages (text + tool_use blocks)
 *  - Tool-result messages (mapped to role:'tool')
 *  - listModels() via GET {baseUrl}/models
 */

import OpenAI from 'openai';
import fetch from 'node-fetch';
import { Provider } from './base';
import { ChatRequest, ChatResponse, Message, ToolDef, MessageContent } from '../types';

// ---------------------------------------------------------------------------
// Module-level helpers — exported so subclasses / tests can reuse them
// ---------------------------------------------------------------------------

/**
 * Convert a Message (which may contain mixed content blocks) into one or more
 * OpenAI message params.
 *
 * Rules:
 *  - Plain string content → single message with that role & string content.
 *  - Assistant messages with tool_use blocks → role:'assistant' with tool_calls.
 *  - User messages with tool_result blocks → one role:'tool' message per block,
 *    followed by a role:'user' message for any text blocks.
 */
export function convertOAIMessage(msg: Message): OpenAI.Chat.ChatCompletionMessageParam[] {
  // Simple string content – fast path
  if (typeof msg.content === 'string') {
    return [{ role: msg.role, content: msg.content }];
  }

  const textBlocks = msg.content.filter(b => b.type === 'text');
  const toolUseBlocks = msg.content.filter(b => b.type === 'tool_use');
  const toolResultBlocks = msg.content.filter(b => b.type === 'tool_result');

  const results: OpenAI.Chat.ChatCompletionMessageParam[] = [];

  if (msg.role === 'assistant') {
    // Build the assistant turn: optional text + optional tool_calls list
    const text = textBlocks
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('');

    const toolCalls: OpenAI.Chat.ChatCompletionMessageToolCall[] = toolUseBlocks.map(b => {
      const tb = b as { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> };
      return {
        id: tb.id,
        type: 'function' as const,
        function: {
          name: tb.name,
          arguments: JSON.stringify(tb.input),
        },
      };
    });

    results.push({
      role: 'assistant',
      // OpenAI accepts null when tool_calls are present and there is no text
      content: text || null,
      ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
    });
  } else {
    // User turn: tool results come first (each as a separate role:'tool' message),
    // then any plain text.
    for (const block of toolResultBlocks) {
      const trb = block as { type: 'tool_result'; toolUseId: string; content: string };
      results.push({
        role: 'tool',
        tool_call_id: trb.toolUseId,
        content: trb.content,
      });
    }

    if (textBlocks.length > 0) {
      const text = textBlocks.map(b => (b as { type: 'text'; text: string }).text).join('');
      results.push({ role: 'user', content: text });
    }
  }

  return results;
}

/**
 * Convert a ToolDef to the OpenAI function-tool format.
 */
export function convertOAITool(tool: ToolDef): OpenAI.Chat.ChatCompletionTool {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema as OpenAI.FunctionParameters,
    },
  };
}

// ---------------------------------------------------------------------------
// Base class
// ---------------------------------------------------------------------------

export class OpenAICompatibleProvider implements Provider {
  readonly name: string;
  protected readonly client: OpenAI;
  protected readonly baseUrl: string;

  constructor(apiKey: string, baseUrl: string, providerName: string) {
    this.name = providerName;
    this.baseUrl = baseUrl;
    this.client = new OpenAI({
      apiKey,
      baseURL: baseUrl,
    });
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const { model, messages, system, tools, maxTokens = 4096, onText } = request;

    // Build the messages array: optional system message first, then all turns
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

    // ------------------------------------------------------------------
    // Streaming path — used when an onText callback is supplied
    // ------------------------------------------------------------------
    if (onText) {
      const stream = await this.client.chat.completions.create({
        model,
        max_tokens: maxTokens,
        messages: openaiMessages,
        ...toolsParam,
        stream: true,
      });

      let fullText = '';
      // Accumulate streamed tool-call fragments keyed by their index
      const toolCallsMap: Record<number, { id: string; name: string; argsStr: string }> = {};

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;

        // Null/undefined delta can happen on the final chunk
        if (!delta) continue;

        if (delta.content) {
          fullText += delta.content;
          onText(delta.content);
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index;
            if (!toolCallsMap[idx]) {
              // First fragment for this tool call carries the id and name
              toolCallsMap[idx] = {
                id: tc.id ?? '',
                name: tc.function?.name ?? '',
                argsStr: '',
              };
            } else {
              // Later fragments may still carry the id/name — fill in if missing
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

      const rawContent: MessageContent[] = [];
      if (fullText) rawContent.push({ type: 'text', text: fullText });
      for (const tc of toolCalls) {
        rawContent.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.input });
      }

      return {
        text: fullText,
        toolCalls,
        stopReason: toolCalls.length > 0 ? 'tool_use' : 'end_turn',
        rawContent,
      };
    }

    // ------------------------------------------------------------------
    // Non-streaming path
    // ------------------------------------------------------------------
    const response = await this.client.chat.completions.create({
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

    const rawContent: MessageContent[] = [];
    if (text) rawContent.push({ type: 'text', text });
    for (const tc of toolCalls) {
      rawContent.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.input });
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

  /**
   * Fetch the model list from {baseUrl}/models.
   * Returns an empty array on any error so that providers that don't expose
   * this endpoint don't crash the application.
   */
  async listModels(): Promise<string[]> {
    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${this.client.apiKey}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) return [];
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
      return [];
    } catch {
      return [];
    }
  }
}

// ---------------------------------------------------------------------------
// Internal utility
// ---------------------------------------------------------------------------

/** Safely parse a JSON string; returns {} on failure. */
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
