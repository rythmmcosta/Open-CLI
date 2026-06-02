export type SafetyLevel = 'low' | 'medium' | 'high';

export interface TextContent {
  type: 'text';
  text: string;
}

export interface ToolUseContent {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultContent {
  type: 'tool_result';
  toolUseId: string;
  content: string;
  isError?: boolean;
}

export type MessageContent = TextContent | ToolUseContent | ToolResultContent;

export interface Message {
  role: 'user' | 'assistant';
  content: string | MessageContent[];
}

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface SafetyAssessment {
  level: SafetyLevel;
  reason: string;
}

export interface ChatRequest {
  model: string;
  messages: Message[];
  system?: string;
  tools?: ToolDef[];
  maxTokens?: number;
  onText?: (text: string) => void;
}

export interface ChatResponse {
  text: string;
  toolCalls: ToolCall[];
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens';
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  rawContent?: MessageContent[];
}

export interface ProviderConfig {
  anthropic?: { apiKey: string };
  openai?: { apiKey: string };
  gemini?: { apiKey: string };
  ollama?: { baseUrl: string };
  mistral?: { apiKey: string };
  groq?: { apiKey: string };
  moonshot?: { apiKey: string };
  xai?: { apiKey: string };
  deepseek?: { apiKey: string };
  together?: { apiKey: string };
  perplexity?: { apiKey: string };
  cerebras?: { apiKey: string };
  huggingface?: { apiKey: string };
  cohere?: { apiKey: string };
  openrouter?: { apiKey: string };
  azure?: { apiKey: string; endpoint: string; deploymentName: string; apiVersion?: string };
  bedrock?: { accessKeyId: string; secretAccessKey: string; region: string; sessionToken?: string };
  github?: { token: string };
  stability?: { apiKey: string };
  ideogram?: { apiKey: string };
  fal?: { apiKey: string };
  runway?: { apiKey: string };
  luma?: { apiKey: string };
  replicate?: { apiToken: string };
}

export interface ProfileConfig {
  model: string;
  autoApprove?: boolean;
  system?: string;
  skill?: string;
}

export interface AppConfig {
  defaultModel: string;
  activeSkill: string;
  autoApprove: boolean;
  dryRun: boolean;
  contextWindow: number;
  showUsage: boolean;
  providers: ProviderConfig;
  profiles: Record<string, ProfileConfig>;
  activeProfile?: string;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  systemPrompt: string;
  tags: string[];
  examples: string[];
}

export interface SessionStats {
  totalInputTokens: number;
  totalOutputTokens: number;
  messageCount: number;
  startTime: Date;
}
