import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';
import { ImageProvider, ImageGenOptions, ImageResult } from './image-base';

export class IdeogramProvider implements ImageProvider {
  readonly name = 'ideogram';

  constructor(private readonly apiKey: string) {}

  async generate(prompt: string, opts: ImageGenOptions = {}): Promise<ImageResult> {
    const res = await fetch('https://api.ideogram.ai/generate', {
      method: 'POST',
      headers: { 'Api-Key': this.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_request: {
          prompt,
          model: opts.model || 'V_2',
          aspect_ratio: 'ASPECT_1_1',
          magic_prompt_option: 'AUTO',
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Ideogram error ${res.status}: ${text}`);
    }

    const data = await res.json() as { data: Array<{ url: string }> };
    const imageUrl = data.data[0].url;

    const imgRes = await fetch(imageUrl);
    const dir = path.join(process.cwd(), 'generated');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filename = `img-${Date.now()}.png`;
    const filePath = path.join(dir, filename);
    const buffer = await imgRes.buffer();
    fs.writeFileSync(filePath, buffer);

    return { filePath, url: imageUrl, provider: 'ideogram', model: opts.model || 'V_2' };
  }
}
