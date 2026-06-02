import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';
import { ImageProvider, ImageGenOptions, ImageResult } from './image-base';

const DEFAULT_MODEL = 'black-forest-labs/FLUX.1-schnell';

export class HuggingFaceImageProvider implements ImageProvider {
  readonly name = 'huggingface';

  constructor(private readonly apiKey: string) {}

  async generate(prompt: string, opts: ImageGenOptions = {}): Promise<ImageResult> {
    const model = opts.model || DEFAULT_MODEL;
    const url = `https://api-inference.huggingface.co/models/${model}`;

    const body: Record<string, unknown> = { inputs: prompt };
    if (opts.negativePrompt) body.negative_prompt = opts.negativePrompt;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HuggingFace image error ${res.status}: ${text}`);
    }

    const dir = path.join(process.cwd(), 'generated');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filename = `img-${Date.now()}.png`;
    const filePath = path.join(dir, filename);

    const buffer = await res.buffer();
    fs.writeFileSync(filePath, buffer);

    return { filePath, provider: 'huggingface', model };
  }
}

export const HF_IMAGE_MODELS = [
  'black-forest-labs/FLUX.1-schnell',
  'black-forest-labs/FLUX.1-dev',
  'stabilityai/stable-diffusion-xl-base-1.0',
  'stabilityai/stable-diffusion-3.5-large',
];
