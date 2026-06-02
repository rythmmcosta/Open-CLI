import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';

export interface VideoGenOptions {
  model?: string;
  duration?: number;
}

export interface VideoResult {
  filePath: string;
  provider: string;
  model: string;
  status: 'complete' | 'processing';
  jobId?: string;
  url?: string;
}

const DEFAULT_MODEL = 'damo-vilab/text-to-video-ms-1.7b';

export class HuggingFaceVideoProvider {
  readonly name = 'huggingface';

  constructor(private readonly apiKey: string) {}

  async generate(prompt: string, opts: VideoGenOptions = {}): Promise<VideoResult> {
    const model = opts.model || DEFAULT_MODEL;
    const url = `https://api-inference.huggingface.co/models/${model}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: prompt }),
    });

    if (!res.ok) {
      const text = await res.text();
      // 503 = model loading, suggest retry
      if (res.status === 503) throw new Error(`Model is loading (${model}). Try again in 30s or use a different model.`);
      throw new Error(`HuggingFace video error ${res.status}: ${text}`);
    }

    const contentType = res.headers.get('content-type') || '';

    const dir = path.join(process.cwd(), 'generated');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filename = `video-${Date.now()}.mp4`;
    const filePath = path.join(dir, filename);

    if (contentType.includes('video') || contentType.includes('octet-stream')) {
      const buffer = await res.buffer();
      fs.writeFileSync(filePath, buffer);
      return { filePath, provider: 'huggingface', model, status: 'complete' };
    }

    // Some models return JSON with a URL
    const data = await res.json() as unknown;
    if (Array.isArray(data) && typeof (data[0] as Record<string, unknown>).blob === 'string') {
      const blob = (data[0] as Record<string, unknown>).blob as string;
      fs.writeFileSync(filePath, Buffer.from(blob, 'base64'));
      return { filePath, provider: 'huggingface', model, status: 'complete' };
    }

    return { filePath: '', provider: 'huggingface', model, status: 'processing', jobId: JSON.stringify(data) };
  }
}

export const HF_VIDEO_MODELS = [
  'damo-vilab/text-to-video-ms-1.7b',
  'ali-vilab/text-to-video-ms-1.7b',
];
