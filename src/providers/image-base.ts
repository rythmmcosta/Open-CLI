export interface ImageGenOptions {
  width?: number;
  height?: number;
  model?: string;
  steps?: number;
  negativePrompt?: string;
}

export interface ImageResult {
  filePath: string;
  url?: string;
  provider: string;
  model: string;
}

export interface ImageProvider {
  readonly name: string;
  generate(prompt: string, opts?: ImageGenOptions): Promise<ImageResult>;
}
