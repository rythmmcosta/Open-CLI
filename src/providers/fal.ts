import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';
import { ImageProvider, ImageGenOptions, ImageResult } from './image-base';

export class FalProvider implements ImageProvider {
  readonly name = 'fal';

  constructor(private readonly apiKey: string) {}

  async generate(prompt: string, opts: ImageGenOptions = {}): Promise<ImageResult> {
    const model = opts.model || 'fal-ai/flux/schnell';

    const res = await fetch(`https://fal.run/${model}`, {
      method: 'POST',
      headers: { 'Authorization': `Key ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        image_size: { width: opts.width || 1024, height: opts.height || 1024 },
        num_inference_steps: opts.steps || 4,
        num_images: 1,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`fal.ai error ${res.status}: ${text}`);
    }

    const data = await res.json() as { images: Array<{ url: string }> };
    const imageUrl = data.images[0].url;

    const imgRes = await fetch(imageUrl);
    const dir = path.join(process.cwd(), 'generated');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filename = `img-${Date.now()}.png`;
    const filePath = path.join(dir, filename);
    const buffer = await imgRes.buffer();
    fs.writeFileSync(filePath, buffer);

    return { filePath, url: imageUrl, provider: 'fal', model };
  }
}

export const FAL_MODELS = ['fal-ai/flux/schnell', 'fal-ai/flux/dev', 'fal-ai/flux-realism', 'fal-ai/stable-diffusion-v3-medium'];
