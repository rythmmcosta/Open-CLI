import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';
import { ImageProvider, ImageGenOptions, ImageResult } from './image-base';

export class PollinationsProvider implements ImageProvider {
  readonly name = 'pollinations';

  async generate(prompt: string, opts: ImageGenOptions = {}): Promise<ImageResult> {
    const { width = 1024, height = 1024, model = 'flux' } = opts;
    const encoded = encodeURIComponent(prompt);
    const url = `https://image.pollinations.ai/prompt/${encoded}?model=${model}&width=${width}&height=${height}&nologo=true`;

    // Fetch the image binary
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Pollinations error ${res.status}: ${res.statusText}`);

    // Save to ./generated/ directory
    const dir = path.join(process.cwd(), 'generated');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filename = `img-${Date.now()}.png`;
    const filePath = path.join(dir, filename);

    const buffer = await res.buffer();
    fs.writeFileSync(filePath, buffer);

    return { filePath, url, provider: 'pollinations', model };
  }
}

export const POLLINATIONS_MODELS = ['flux', 'turbo', 'dreamshaper', 'any-dark', 'flux-realism'];
