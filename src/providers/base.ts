import { ChatRequest, ChatResponse } from '../types';

export interface Provider {
  readonly name: string;
  chat(request: ChatRequest): Promise<ChatResponse>;
  listModels?(): Promise<string[]>;
}
