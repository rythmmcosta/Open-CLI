import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';
import { VideoGenOptions, VideoResult } from './huggingface-video';

export class RunwayProvider {
  readonly name = 'runway';

  constructor(private readonly apiKey: string) {}

  async generate(prompt: string, opts: VideoGenOptions = {}): Promise<VideoResult> {
    const duration = opts.duration || 5;

    const res = await fetch('https://api.dev.runwayml.com/v1/image_to_video', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'X-Runway-Version': '2024-11-06',
      },
      body: JSON.stringify({
        promptText: prompt,
        model: 'gen3a_turbo',
        duration,
        ratio: '1280:768',
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Runway error ${res.status}: ${text}`);
    }

    const task = await res.json() as { id: string };

    // Poll for completion
    const startTime = Date.now();
    while (Date.now() - startTime < 300000) {
      await new Promise(r => setTimeout(r, 10000));
      const pollRes = await fetch(`https://api.dev.runwayml.com/v1/tasks/${task.id}`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}`, 'X-Runway-Version': '2024-11-06' },
      });
      const poll = await pollRes.json() as { status: string; output?: string[]; error?: string };

      if (poll.status === 'SUCCEEDED' && poll.output?.[0]) {
        const vidRes = await fetch(poll.output[0]);
        const dir = path.join(process.cwd(), 'generated');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const filename = `video-${Date.now()}.mp4`;
        const filePath = path.join(dir, filename);
        const buffer = await vidRes.buffer();
        fs.writeFileSync(filePath, buffer);
        return { filePath, url: poll.output[0], provider: 'runway', model: 'gen3a_turbo', status: 'complete' };
      }
      if (poll.status === 'FAILED') throw new Error(`Runway task failed: ${poll.error}`);
    }

    return { filePath: '', provider: 'runway', model: 'gen3a_turbo', status: 'processing', jobId: task.id };
  }
}
