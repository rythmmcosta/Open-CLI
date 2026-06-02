import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';
import { ImageProvider, ImageGenOptions, ImageResult } from './image-base';

export class DalleProvider implements ImageProvider {
  readonly name = 'dalle';

  constructor(private readonly apiKey: string) {}

  async generate(prompt: string, opts: ImageGenOptions = {}): Promise<ImageResult> {
    const model = opts.model || 'dall-e-3';
    const size = opts.width && opts.height ? `${opts.width}x${opts.height}` : '1024x1024';

    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, n: 1, size }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`DALL-E error ${res.status}: ${text}`);
    }

    const data = await res.json() as { data: Array<{ url: string }> };
    const imageUrl = data.data[0].url;

    // Download the image
    const imgRes = await fetch(imageUrl);
    const dir = path.join(process.cwd(), 'generated');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filename = `img-${Date.now()}.png`;
    const filePath = path.join(dir, filename);
    const buffer = await imgRes.buffer();
    fs.writeFileSync(filePath, buffer);

    return { filePath, url: imageUrl, provider: 'dalle', model };
  }
}
