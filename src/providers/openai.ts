import OpenAI from 'openai';
import { Provider } from './base';
import { ChatRequest, ChatResponse, Message, ToolDef, MessageContent } from '../types';

export class OpenAIProvider implements Provider {
  readonly name = 'openai';
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const { model, messages, system, tools, maxTokens = 4096, onText } = request;

    const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (system) {
      openaiMessages.push({ role: 'system', content: system });
    }
    for (const msg of messages) {
      openaiMessages.push(...convertMessage(msg));
    }

    const openaiTools = tools?.map(convertTool);

    if (onText) {
      const stream = await this.client.chat.completions.create({
        model,
        max_tokens: maxTokens,
        messages: openaiMessages,
        ...(openaiTools && openaiTools.length > 0 ? { tools: openaiTools } : {}),
        stream: true,
      });

      let fullText = '';
      const toolCallsMap: Record<number, { id: string; name: string; argsStr: string }> = {};

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (delta?.content) {
          fullText += delta.content;
          onText(delta.content);
        }
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            if (!toolCallsMap[tc.index]) {
              toolCallsMap[tc.index] = { id: tc.id || '', name: tc.function?.name || '', argsStr: '' };
            }
            if (tc.function?.arguments) {
              toolCallsMap[tc.index].argsStr += tc.function.arguments;
            }
          }
        }
      }

      const toolCalls = Object.values(toolCallsMap).map(tc => ({
        id: tc.id,
        name: tc.name,
        input: (() => { try { return JSON.parse(tc.argsStr); } catch { return {}; } })(),
      }));

      return {
        text: fullText,
        toolCalls,
        stopReason: toolCalls.length > 0 ? 'tool_use' : 'end_turn',
        rawContent: [{ type: 'text', text: fullText }],
      };
    } else {
      const response = await this.client.chat.completions.create({
        model,
        max_tokens: maxTokens,
        messages: openaiMessages,
        ...(openaiTools && openaiTools.length > 0 ? { tools: openaiTools } : {}),
      });

      const choice = response.choices[0];
      const text = choice.message.content || '';
      const toolCalls = (choice.message.tool_calls || []).map(tc => ({
        id: tc.id,
        name: tc.function.name,
        input: (() => { try { return JSON.parse(tc.function.arguments); } catch { return {}; } })(),
      }));

      const rawContent: MessageContent[] = [];
      if (text) rawContent.push({ type: 'text', text });
      for (const tc of toolCalls) {
        rawContent.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.input });
      }

      return {
        text,
        toolCalls,
        stopReason: choice.finish_reason === 'tool_calls' ? 'tool_use' : 'end_turn',
        usage: response.usage ? {
          inputTokens: response.usage.prompt_tokens,
          outputTokens: response.usage.completion_tokens,
        } : undefined,
        rawContent,
      };
    }
  }
}

function convertMessage(msg: Message): OpenAI.Chat.ChatCompletionMessageParam[] {
  if (typeof msg.content === 'string') {
    return [{ role: msg.role, content: msg.content }];
  }

  const textBlocks = msg.content.filter(b => b.type === 'text');
  const toolUseBlocks = msg.content.filter(b => b.type === 'tool_use');
  const toolResultBlocks = msg.content.filter(b => b.type === 'tool_result');

  const results: OpenAI.Chat.ChatCompletionMessageParam[] = [];

  if (msg.role === 'assistant') {
    const text = textBlocks.map(b => (b as { type: 'text'; text: string }).text).join('');
    const toolCalls: OpenAI.Chat.ChatCompletionMessageToolCall[] = toolUseBlocks.map(b => {
      const tb = b as { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> };
      return {
        id: tb.id,
        type: 'function' as const,
        function: { name: tb.name, arguments: JSON.stringify(tb.input) },
      };
    });
    results.push({
      role: 'assistant',
      content: text || null,
      ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
    });
  } else {
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

function convertTool(tool: ToolDef): OpenAI.Chat.ChatCompletionTool {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema as OpenAI.FunctionParameters,
    },
  };
}
