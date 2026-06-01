import Anthropic from '@anthropic-ai/sdk';
import { Provider } from './base';
import { ChatRequest, ChatResponse, Message, MessageContent, ToolDef } from '../types';

export class AnthropicProvider implements Provider {
  readonly name = 'anthropic';
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const { model, messages, system, tools, maxTokens = 8096, onText } = request;

    const anthropicMessages = messages.map(convertMessage);
    const anthropicTools = tools?.map(convertTool);

    let fullText = '';
    let rawContent: MessageContent[] = [];

    if (onText) {
      const stream = this.client.messages.stream({
        model,
        max_tokens: maxTokens,
        system: system || '',
        messages: anthropicMessages,
        ...(anthropicTools && anthropicTools.length > 0 ? { tools: anthropicTools } : {}),
      });

      stream.on('text', (text) => {
        fullText += text;
        onText(text);
      });

      const message = await stream.finalMessage();
      rawContent = convertContentToNormalized(message.content);

      return {
        text: fullText,
        toolCalls: extractToolCalls(message.content),
        stopReason: convertStopReason(message.stop_reason),
        usage: {
          inputTokens: message.usage.input_tokens,
          outputTokens: message.usage.output_tokens,
        },
        rawContent,
      };
    } else {
      const message = await this.client.messages.create({
        model,
        max_tokens: maxTokens,
        system: system || '',
        messages: anthropicMessages,
        ...(anthropicTools && anthropicTools.length > 0 ? { tools: anthropicTools } : {}),
      });

      rawContent = convertContentToNormalized(message.content);
      fullText = message.content
        .filter(b => b.type === 'text')
        .map(b => (b as Anthropic.TextBlock).text)
        .join('');

      return {
        text: fullText,
        toolCalls: extractToolCalls(message.content),
        stopReason: convertStopReason(message.stop_reason),
        usage: {
          inputTokens: message.usage.input_tokens,
          outputTokens: message.usage.output_tokens,
        },
        rawContent,
      };
    }
  }
}

function convertMessage(msg: Message): Anthropic.MessageParam {
  if (typeof msg.content === 'string') {
    return { role: msg.role, content: msg.content };
  }

  type Block = Anthropic.TextBlockParam | Anthropic.ToolUseBlockParam | Anthropic.ToolResultBlockParam;
  const content: Block[] = [];
  for (const block of msg.content) {
    if (block.type === 'text') {
      content.push({ type: 'text', text: block.text } as Anthropic.TextBlockParam);
    } else if (block.type === 'tool_use') {
      content.push({
        type: 'tool_use',
        id: block.id,
        name: block.name,
        input: block.input,
      } as Anthropic.ToolUseBlockParam);
    } else if (block.type === 'tool_result') {
      content.push({
        type: 'tool_result',
        tool_use_id: block.toolUseId,
        content: block.content,
        ...(block.isError ? { is_error: true } : {}),
      } as Anthropic.ToolResultBlockParam);
    }
  }
  return { role: msg.role, content };
}

function convertTool(tool: ToolDef): Anthropic.Tool {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema as Anthropic.Tool['input_schema'],
  };
}

function extractToolCalls(content: Anthropic.ContentBlock[]) {
  return content
    .filter(b => b.type === 'tool_use')
    .map(b => {
      const tb = b as Anthropic.ToolUseBlock;
      return { id: tb.id, name: tb.name, input: tb.input as Record<string, unknown> };
    });
}

function convertStopReason(reason: string | null): 'end_turn' | 'tool_use' | 'max_tokens' {
  if (reason === 'tool_use') return 'tool_use';
  if (reason === 'max_tokens') return 'max_tokens';
  return 'end_turn';
}

function convertContentToNormalized(content: Anthropic.ContentBlock[]): MessageContent[] {
  return content.map(b => {
    if (b.type === 'text') {
      return { type: 'text' as const, text: b.text };
    } else {
      const tb = b as Anthropic.ToolUseBlock;
      return {
        type: 'tool_use' as const,
        id: tb.id,
        name: tb.name,
        input: tb.input as Record<string, unknown>,
      };
    }
  });
}
