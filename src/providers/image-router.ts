import { ImageProvider } from './image-base';
import { PollinationsProvider } from './pollinations';
import { HuggingFaceImageProvider } from './huggingface-image';
import { DalleProvider } from './dalle';
import { StabilityProvider } from './stability';
import { IdeogramProvider } from './ideogram';
import { FalProvider } from './fal';
import { AppConfig } from '../types';

export function getImageProvider(providerName: string | undefined, config: AppConfig): ImageProvider {
  const p = config.providers;

  switch (providerName) {
    case 'pollinations': return new PollinationsProvider();
    case 'huggingface':
      if (!p.huggingface?.apiKey) throw new Error('HuggingFace API key not set. Run: opencli auth');
      return new HuggingFaceImageProvider(p.huggingface.apiKey);
    case 'dalle':
    case 'openai':
      if (!p.openai?.apiKey) throw new Error('OpenAI API key not set. Run: opencli auth');
      return new DalleProvider(p.openai.apiKey);
    case 'stability':
      if (!(p as Record<string, unknown>).stability) throw new Error('Stability AI key not set. Run: opencli auth');
      return new StabilityProvider(((p as Record<string, { apiKey: string }>).stability).apiKey);
    case 'ideogram':
      if (!(p as Record<string, unknown>).ideogram) throw new Error('Ideogram key not set. Run: opencli auth');
      return new IdeogramProvider(((p as Record<string, { apiKey: string }>).ideogram).apiKey);
    case 'fal':
      if (!(p as Record<string, unknown>).fal) throw new Error('fal.ai key not set. Run: opencli auth');
      return new FalProvider(((p as Record<string, { apiKey: string }>).fal).apiKey);
    default:
      // Auto-select: Pollinations is always free, no key needed
      return new PollinationsProvider();
  }
}
