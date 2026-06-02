import { VideoGenOptions, VideoResult, HuggingFaceVideoProvider } from './huggingface-video';
import { ReplicateProvider } from './replicate';
import { LumaProvider } from './luma';
import { RunwayProvider } from './runway';
import { AppConfig } from '../types';

export interface VideoProvider {
  readonly name: string;
  generate(prompt: string, opts?: VideoGenOptions): Promise<VideoResult>;
}

export function getVideoProvider(providerName: string | undefined, config: AppConfig): VideoProvider {
  const p = config.providers as Record<string, { apiKey?: string; apiToken?: string } | undefined>;

  switch (providerName) {
    case 'huggingface':
      if (!config.providers.huggingface?.apiKey) throw new Error('HuggingFace API key not set. Run: opencli auth');
      return new HuggingFaceVideoProvider(config.providers.huggingface.apiKey);
    case 'replicate': {
      const apiToken = p.replicate?.apiToken;
      if (!apiToken) throw new Error('Replicate API token not set. Run: opencli auth');
      return new ReplicateProvider(apiToken);
    }
    case 'luma': {
      const apiKey = p.luma?.apiKey;
      if (!apiKey) throw new Error('Luma AI API key not set. Run: opencli auth');
      return new LumaProvider(apiKey);
    }
    case 'runway': {
      const apiKey = p.runway?.apiKey;
      if (!apiKey) throw new Error('Runway API key not set. Run: opencli auth');
      return new RunwayProvider(apiKey);
    }
    default:
      // Default: try HuggingFace (free with existing key)
      if (config.providers.huggingface?.apiKey) return new HuggingFaceVideoProvider(config.providers.huggingface.apiKey);
      throw new Error('No video provider configured. Set a HuggingFace key (free) or Replicate/Luma/Runway key. Run: opencli auth');
  }
}
