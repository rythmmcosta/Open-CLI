import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';
import { VideoGenOptions, VideoResult } from './huggingface-video';

export class LumaProvider {
  readonly name = 'luma';

  constructor(private readonly apiKey: string) {}

  async generate(prompt: string, _opts: VideoGenOptions = {}): Promise<VideoResult> {
    // Submit generation
    const res = await fetch('https://api.lumalabs.ai/dream-machine/v1/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt, aspect_ratio: '16:9', loop: false }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Luma AI error ${res.status}: ${text}`);
    }

    const gen = await res.json() as { id: string; state: string };

    // Poll for completion
    const startTime = Date.now();
    while (Date.now() - startTime < 180000) {
      await new Promise(r => setTimeout(r, 8000));
      const pollRes = await fetch(`https://api.lumalabs.ai/dream-machine/v1/generations/${gen.id}`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
      });
      const poll = await pollRes.json() as { state: string; assets?: { video?: string }; failure_reason?: string };

      if (poll.state === 'completed' && poll.assets?.video) {
        const vidRes = await fetch(poll.assets.video);
        const dir = path.join(process.cwd(), 'generated');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const filename = `video-${Date.now()}.mp4`;
        const filePath = path.join(dir, filename);
        const buffer = await vidRes.buffer();
        fs.writeFileSync(filePath, buffer);
        return { filePath, url: poll.assets.video, provider: 'luma', model: 'dream-machine', status: 'complete' };
      }
      if (poll.state === 'failed') throw new Error(`Luma generation failed: ${poll.failure_reason}`);
    }

    return { filePath: '', provider: 'luma', model: 'dream-machine', status: 'processing', jobId: gen.id };
  }
}
