import { Message, MessageContent, SessionStats } from '../types';

export class ConversationContext {
  private messages: Message[] = [];
  readonly stats: SessionStats;
  private maxMessages: number;

  constructor(maxMessages = 40) {
    this.maxMessages = maxMessages;
    this.stats = {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      messageCount: 0,
      startTime: new Date(),
    };
  }

  addUserMessage(content: string): void {
    this.messages.push({ role: 'user', content });
    this.stats.messageCount++;
    this.prune();
  }

  addAssistantMessage(content: string | MessageContent[]): void {
    this.messages.push({ role: 'assistant', content });
  }

  addToolResults(results: Array<{ toolUseId: string; content: string; isError?: boolean }>): void {
    const toolResultContent: MessageContent[] = results.map(r => ({
      type: 'tool_result',
      toolUseId: r.toolUseId,
      content: r.content,
      isError: r.isError,
    }));
    this.messages.push({ role: 'user', content: toolResultContent });
  }

  getMessages(): Message[] {
    return [...this.messages];
  }

  updateUsage(inputTokens: number, outputTokens: number): void {
    this.stats.totalInputTokens += inputTokens;
    this.stats.totalOutputTokens += outputTokens;
  }

  reset(): void {
    this.messages = [];
    this.stats.totalInputTokens = 0;
    this.stats.totalOutputTokens = 0;
    this.stats.messageCount = 0;
    this.stats.startTime = new Date();
  }

  getHistory(): Array<{ role: string; preview: string }> {
    return this.messages.slice(-20).map((m, i) => ({
      role: m.role,
      preview: getPreview(m.content),
    }));
  }

  get length(): number {
    return this.messages.length;
  }

  private prune(): void {
    if (this.messages.length > this.maxMessages) {
      this.messages = this.messages.slice(-this.maxMessages);
    }
  }
}

function getPreview(content: string | MessageContent[]): string {
  if (typeof content === 'string') {
    return content.slice(0, 80) + (content.length > 80 ? '…' : '');
  }
  const text = content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join(' ');
  return text.slice(0, 80) + (text.length > 80 ? '…' : '');
}
