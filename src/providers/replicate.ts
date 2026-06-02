import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';
import { VideoGenOptions, VideoResult } from './huggingface-video';

export class ReplicateProvider {
  readonly name = 'replicate';

  constructor(private readonly apiToken: string) {}

  async generate(prompt: string, opts: VideoGenOptions = {}): Promise<VideoResult> {
    const model = opts.model || 'anotherjesse/zeroscope-v2-xl:9f747673945c62801b13b84701c783929c0ee784e4748ec062204894dda1a351';

    // Submit prediction
    const res = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ version: model.includes(':') ? model.split(':')[1] : model, input: { prompt } }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Replicate error ${res.status}: ${text}`);
    }

    const prediction = await res.json() as { id: string; status: string; urls: { get: string } };

    // Poll for completion (max 120s)
    const startTime = Date.now();
    while (Date.now() - startTime < 120000) {
      await new Promise(r => setTimeout(r, 5000));
      const pollRes = await fetch(prediction.urls.get, {
        headers: { 'Authorization': `Token ${this.apiToken}` },
      });
      const poll = await pollRes.json() as { status: string; output?: string[]; error?: string };

      if (poll.status === 'succeeded' && poll.output && poll.output[0]) {
        // Download video
        const vidRes = await fetch(poll.output[0]);
        const dir = path.join(process.cwd(), 'generated');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const filename = `video-${Date.now()}.mp4`;
        const filePath = path.join(dir, filename);
        const buffer = await vidRes.buffer();
        fs.writeFileSync(filePath, buffer);
        return { filePath, provider: 'replicate', model, status: 'complete' };
      }
      if (poll.status === 'failed') throw new Error(`Replicate prediction failed: ${poll.error}`);
    }

    return { filePath: '', provider: 'replicate', model, status: 'processing', jobId: prediction.id };
  }
}
