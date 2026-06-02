import * as fs from 'fs';
import * as path from 'path';
import { ToolDef } from '../types';

export const videoGenTools: ToolDef[] = [
  {
    name: 'generate_video',
    description: 'Generate a video from a text prompt. Saves to ./generated/ directory. Free with HuggingFace API key.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Text description of the video to generate' },
        provider: { type: 'string', description: 'Provider: huggingface (free/default), replicate, luma, runway' },
        model: { type: 'string', description: 'Model name (provider-specific)' },
        duration: { type: 'number', description: 'Video duration in seconds (provider-dependent, default: 3-5s)' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'list_generated_videos',
    description: 'List all generated videos in the ./generated/ directory.',
    inputSchema: { type: 'object', properties: {} },
  },
];

export async function executeVideoGenTool(
  name: string,
  input: Record<string, unknown>,
  config?: import('../types').AppConfig,
): Promise<{ output: string; isError: boolean }> {
  try {
    if (name === 'list_generated_videos') {
      const dir = path.join(process.cwd(), 'generated');
      if (!fs.existsSync(dir)) return { output: 'No generated videos yet. Use generate_video first.', isError: false };
      const files = fs.readdirSync(dir).filter(f => /\.(mp4|webm|gif|mov)$/i.test(f));
      if (files.length === 0) return { output: 'No videos in ./generated/', isError: false };
      return { output: files.map(f => path.join(dir, f)).join('\n'), isError: false };
    }

    if (name === 'generate_video') {
      const prompt = input.prompt as string;
      const providerName = input.provider as string | undefined;
      const opts = {
        model: input.model as string | undefined,
        duration: input.duration as number | undefined,
      };

      if (!config) throw new Error('Config required for video generation');
      const { getVideoProvider } = await import('../providers/video-router');
      const provider = getVideoProvider(providerName, config);

      const result = await provider.generate(prompt, opts);

      if (result.status === 'processing') {
        return {
          output: `Video generation in progress\nProvider: ${result.provider}\nJob ID: ${result.jobId || 'N/A'}\nCheck back in a few minutes — video models can take 1-5 minutes.`,
          isError: false,
        };
      }

      return {
        output: `Video generated!\nProvider: ${result.provider} (${result.model})\nSaved to: ${result.filePath}${result.url ? '\nURL: ' + result.url : ''}`,
        isError: false,
      };
    }

    return { output: `Unknown video tool: ${name}`, isError: true };
  } catch (err) {
    return { output: (err as Error).message, isError: true };
  }
}
