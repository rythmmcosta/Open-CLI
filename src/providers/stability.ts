import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';
import { ImageProvider, ImageGenOptions, ImageResult } from './image-base';

export class StabilityProvider implements ImageProvider {
  readonly name = 'stability';

  constructor(private readonly apiKey: string) {}

  async generate(prompt: string, opts: ImageGenOptions = {}): Promise<ImageResult> {
    const model = opts.model || 'stable-diffusion-xl-1024-v1-0';
    const width = opts.width || 1024;
    const height = opts.height || 1024;
    const steps = opts.steps || 30;

    const res = await fetch(`https://api.stability.ai/v1/generation/${model}/text-to-image`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        text_prompts: [
          { text: prompt, weight: 1 },
          ...(opts.negativePrompt ? [{ text: opts.negativePrompt, weight: -1 }] : []),
        ],
        cfg_scale: 7,
        height,
        width,
        steps,
        samples: 1,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Stability AI error ${res.status}: ${text}`);
    }

    const data = await res.json() as { artifacts: Array<{ base64: string }> };
    const base64 = data.artifacts[0].base64;

    const dir = path.join(process.cwd(), 'generated');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filename = `img-${Date.now()}.png`;
    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));

    return { filePath, provider: 'stability', model };
  }
}

export const STABILITY_MODELS = [
  'stable-diffusion-xl-1024-v1-0',
  'stable-diffusion-v1-6',
  'stable-diffusion-512-v2-1',
];
