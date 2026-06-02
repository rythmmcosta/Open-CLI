import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';
import { ToolDef } from '../types';

export const imageGenTools: ToolDef[] = [
  {
    name: 'generate_image',
    description: 'Generate an image from a text prompt. Saves to ./generated/ directory. Default provider is Pollinations (FREE, no API key needed).',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Text description of the image to generate' },
        provider: { type: 'string', description: 'Provider: pollinations (free/default), huggingface, dalle, stability, ideogram, fal' },
        model: { type: 'string', description: 'Model name (provider-specific)' },
        width: { type: 'number', description: 'Image width in pixels (default: 1024)' },
        height: { type: 'number', description: 'Image height in pixels (default: 1024)' },
        negative_prompt: { type: 'string', description: 'What to avoid in the image' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'list_generated_images',
    description: 'List all generated images in the ./generated/ directory.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'open_image',
    description: 'Open a generated image with the system image viewer.',
    inputSchema: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'Path to the image file' },
      },
      required: ['file_path'],
    },
  },
];

export async function executeImageGenTool(
  name: string,
  input: Record<string, unknown>,
  config?: import('../types').AppConfig,
): Promise<{ output: string; isError: boolean }> {
  try {
    if (name === 'list_generated_images') {
      const dir = path.join(process.cwd(), 'generated');
      if (!fs.existsSync(dir)) return { output: 'No generated images yet. Use generate_image first.', isError: false };
      const files = fs.readdirSync(dir).filter(f => /\.(png|jpg|jpeg|webp|gif)$/i.test(f));
      if (files.length === 0) return { output: 'No images in ./generated/', isError: false };
      return { output: files.map(f => path.join(dir, f)).join('\n'), isError: false };
    }

    if (name === 'open_image') {
      const filePath = input.file_path as string;
      if (!fs.existsSync(filePath)) return { output: `File not found: ${filePath}`, isError: true };
      const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
      child_process.execSync(`${cmd} "${filePath}"`, { timeout: 5000 });
      return { output: `Opened: ${filePath}`, isError: false };
    }

    if (name === 'generate_image') {
      const prompt = input.prompt as string;
      const providerName = input.provider as string | undefined;
      const opts = {
        width: input.width as number | undefined,
        height: input.height as number | undefined,
        model: input.model as string | undefined,
        negativePrompt: input.negative_prompt as string | undefined,
      };

      // Dynamic import to avoid circular deps
      const { getImageProvider } = await import('../providers/image-router');
      if (!config) throw new Error('Config required for image generation');
      const provider = getImageProvider(providerName, config);

      const result = await provider.generate(prompt, opts);
      return {
        output: `Image generated!\nProvider: ${result.provider}${result.model ? ` (${result.model})` : ''}\nSaved to: ${result.filePath}${result.url ? '\nURL: ' + result.url : ''}`,
        isError: false,
      };
    }

    return { output: `Unknown image tool: ${name}`, isError: true };
  } catch (err) {
    return { output: (err as Error).message, isError: true };
  }
}
