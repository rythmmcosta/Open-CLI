/**
 * CohereProvider
 *
 * Uses the Cohere v2 Chat API directly via node-fetch (no Cohere SDK required).
 * Endpoint: POST https://api.cohere.com/v2/chat
 *
 * Supports:
 *  - Non-streaming responses
 *  - Streaming via SSE (when request.onText is provided)
 *  - Tool/function calling
 */

import fetch from 'node-fetch';
import { Provider } from './base';
import {
  ChatRequest,
  ChatResponse,
  Message,
  MessageContent,
  ToolDef,
} from '../types';

// ---------------------------------------------------------------------------
// API shape types (internal)
// ---------------------------------------------------------------------------

interface CohereMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | CohereContentBlock[];
  tool_call_id?: string;
  tool_calls?: CohereFunctionToolCall[];
}

interface CohereContentBlock {
  type: 'text';
  text: string;
}

interface CohereFunctionToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    /** JSON-encoded arguments string */
    arguments: string;
  };
}

interface CohereToolDef {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: unknown;
  };
}

interface CohereNonStreamResponse {
  message: {
    content?: Array<{ type: string; text?: string }>;
    tool_calls?: CohereFunctionToolCall[];
  };
  usage?: {
    billed_units?: { input_tokens?: number; output_tokens?: number };
    tokens?: { input_tokens?: number; output_tokens?: number };
  };
  finish_reason?: string;
}

// SSE event data shapes
interface CohereStreamTextDelta {
  type: 'content-delta';
  delta?: { message?: { content?: { text?: string } } };
}

interface CohereStreamMessageEnd {
  type: 'message-end';
  delta?: {
    finish_reason?: string;
    usage?: {
      billed_units?: { input_tokens?: number; output_tokens?: number };
      tokens?: { input_tokens?: number; output_tokens?: number };
    };
  };
}

interface CohereStreamToolCallDelta {
  type: 'tool-call-start' | 'tool-call-delta';
  index?: number;
  delta?: {
    message?: {
      tool_calls?: {
        id?: string;
        type?: string;
        function?: { name?: string; arguments?: string };
      };
    };
  };
}

type CohereSSEEvent =
  | CohereStreamTextDelta
  | CohereStreamMessageEnd
  | CohereStreamToolCallDelta
  | { type: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function convertCohereTool(tool: ToolDef): CohereToolDef {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  };
}

/**
 * Convert our Message type to Cohere's message format.
 * Tool results are emitted as role:'tool' messages.
 */
function convertCohereMessage(msg: Message): CohereMessage[] {
  if (typeof msg.content === 'string') {
    return [{ role: msg.role, content: msg.content }];
  }

  const textBlocks = msg.content.filter(b => b.type === 'text');
  const toolUseBlocks = msg.content.filter(b => b.type === 'tool_use');
  const toolResultBlocks = msg.content.filter(b => b.type === 'tool_result');

  const results: CohereMessage[] = [];

  if (msg.role === 'assistant') {
    const text = textBlocks
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('');

    const toolCalls: CohereFunctionToolCall[] = toolUseBlocks.map(b => {
      const tb = b as { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> };
      return {
        id: tb.id,
        type: 'function' as const,
        function: { name: tb.name, arguments: JSON.stringify(tb.input) },
      };
    });

    const cohereMsg: CohereMessage = {
      role: 'assistant',
      content: text,
    };
    if (toolCalls.length > 0) {
      cohereMsg.tool_calls = toolCalls;
    }
    results.push(cohereMsg);
  } else {
    // User turn: tool results first, then text
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

function safeParseJSON(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Provider class
// ---------------------------------------------------------------------------

export class CohereProvider implements Provider {
  readonly name = 'cohere';
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.cohere.com/v2';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const { model, messages, system, tools, maxTokens = 4096, onText } = request;

    // Build message list
    const cohereMessages: CohereMessage[] = [];
    if (system) {
      cohereMessages.push({ role: 'system', content: system });
    }
    for (const msg of messages) {
      cohereMessages.push(...convertCohereMessage(msg));
    }

    const cohereTools = tools && tools.length > 0 ? tools.map(convertCohereTool) : undefined;

    const body: Record<string, unknown> = {
      model,
      messages: cohereMessages,
      max_tokens: maxTokens,
      stream: !!onText,
    };
    if (cohereTools) body['tools'] = cohereTools;

    const headers = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (onText) {
      return this.chatStreaming(body, headers, onText);
    }
    return this.chatNonStreaming(body, headers);
  }

  private async chatNonStreaming(
    body: Record<string, unknown>,
    headers: Record<string, string>,
  ): Promise<ChatResponse> {
    const res = await fetch(`${this.baseUrl}/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Cohere API error ${res.status}: ${errText}`);
    }

    const data = (await res.json()) as CohereNonStreamResponse;
    const msg = data.message;

    const text =
      msg.content
        ?.filter(c => c.type === 'text' && typeof c.text === 'string')
        .map(c => c.text ?? '')
        .join('') ?? '';

    const toolCalls = (msg.tool_calls ?? []).map(tc => ({
      id: tc.id,
      name: tc.function.name,
      input: safeParseJSON(tc.function.arguments),
    }));

    const rawContent: MessageContent[] = [];
    if (text) rawContent.push({ type: 'text', text });
    for (const tc of toolCalls) {
      rawContent.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.input });
    }

    const finishReason = data.finish_reason ?? '';
    let stopReason: ChatResponse['stopReason'] = 'end_turn';
    if (toolCalls.length > 0 || finishReason === 'TOOL_CALL') stopReason = 'tool_use';
    else if (finishReason === 'MAX_TOKENS') stopReason = 'max_tokens';

    const usageTokens =
      data.usage?.billed_units ?? data.usage?.tokens;
    const usage = usageTokens
      ? {
          inputTokens: usageTokens.input_tokens ?? 0,
          outputTokens: usageTokens.output_tokens ?? 0,
        }
      : undefined;

    return { text, toolCalls, stopReason, usage, rawContent };
  }

  private async chatStreaming(
    body: Record<string, unknown>,
    headers: Record<string, string>,
    onText: (text: string) => void,
  ): Promise<ChatResponse> {
    const res = await fetch(`${this.baseUrl}/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Cohere API error ${res.status}: ${errText}`);
    }

    if (!res.body) {
      throw new Error('Cohere streaming: no response body');
    }

    let fullText = '';
    let stopReason: ChatResponse['stopReason'] = 'end_turn';
    let usage: ChatResponse['usage'] | undefined;

    // Accumulate tool call fragments keyed by index
    const toolCallsMap: Record<number, { id: string; name: string; argsStr: string }> = {};

    // node-fetch v2 body is a Node.js Readable stream
    let buffer = '';
    for await (const rawChunk of res.body) {
      // rawChunk may be Buffer or string
      buffer += typeof rawChunk === 'string' ? rawChunk : rawChunk.toString('utf8');

      // Process complete SSE lines
      const lines = buffer.split('\n');
      // Keep the last (potentially incomplete) line in the buffer
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;

        const jsonStr = trimmed.slice(5).trim();
        if (!jsonStr || jsonStr === '[DONE]') continue;

        let event: CohereSSEEvent;
        try {
          event = JSON.parse(jsonStr) as CohereSSEEvent;
        } catch {
          continue;
        }

        switch (event.type) {
          case 'content-delta': {
            const e = event as CohereStreamTextDelta;
            const chunk = e.delta?.message?.content?.text;
            if (chunk) {
              fullText += chunk;
              onText(chunk);
            }
            break;
          }

          case 'tool-call-start':
          case 'tool-call-delta': {
            const e = event as CohereStreamToolCallDelta;
            const idx = e.index ?? 0;
            const tcDelta = e.delta?.message?.tool_calls;
            if (!tcDelta) break;

            if (!toolCallsMap[idx]) {
              toolCallsMap[idx] = { id: '', name: '', argsStr: '' };
            }
            if (tcDelta.id && !toolCallsMap[idx].id) toolCallsMap[idx].id = tcDelta.id;
            if (tcDelta.function?.name && !toolCallsMap[idx].name) {
              toolCallsMap[idx].name = tcDelta.function.name;
            }
            if (tcDelta.function?.arguments) {
              toolCallsMap[idx].argsStr += tcDelta.function.arguments;
            }
            break;
          }

          case 'message-end': {
            const e = event as CohereStreamMessageEnd;
            const fr = e.delta?.finish_reason ?? '';
            if (fr === 'TOOL_CALL' || Object.keys(toolCallsMap).length > 0) {
              stopReason = 'tool_use';
            } else if (fr === 'MAX_TOKENS') {
              stopReason = 'max_tokens';
            }
            const usageTokens =
              e.delta?.usage?.billed_units ?? e.delta?.usage?.tokens;
            if (usageTokens) {
              usage = {
                inputTokens: usageTokens.input_tokens ?? 0,
                outputTokens: usageTokens.output_tokens ?? 0,
              };
            }
            break;
          }

          default:
            break;
        }
      }
    }

    const toolCalls = Object.values(toolCallsMap).map(tc => ({
      id: tc.id,
      name: tc.name,
      input: safeParseJSON(tc.argsStr),
    }));

    if (toolCalls.length > 0) stopReason = 'tool_use';

    const rawContent: MessageContent[] = [];
    if (fullText) rawContent.push({ type: 'text', text: fullText });
    for (const tc of toolCalls) {
      rawContent.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.input });
    }

    return { text: fullText, toolCalls, stopReason, usage, rawContent };
  }

  async listModels(): Promise<string[]> {
    return COHERE_MODELS;
  }
}

export const COHERE_MODELS = [
  'command-r-plus-08-2024',
  'command-r-08-2024',
  'command-r7b-12-2024',
];
