import chalk from 'chalk';
import ora from 'ora';
import { getConfig } from '../config';
import { AppConfig } from '../types';
import { getProvider } from './router';
import { Message } from '../types';

interface EnsembleOptions {
  onlyFree?: boolean;
  topN?: number;
  timeout?: number;
  verbose?: boolean;
}

// FREE_PROVIDERS: list of provider names that have free tiers
const FREE_PROVIDERS = ['groq', 'gemini', 'huggingface', 'cohere', 'openrouter', 'ollama'];

// Default model per provider to use in ensemble
const PROVIDER_DEFAULT_MODELS: Record<string, string> = {
  anthropic: 'claude-haiku-4-5',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.0-flash',
  groq: 'llama-3.3-70b-versatile',
  mistral: 'mistral-small-latest',
  deepseek: 'deepseek-chat',
  cohere: 'command-r-08-2024',
  huggingface: 'meta-llama/Meta-Llama-3.1-8B-Instruct',
  openrouter: 'meta-llama/llama-3.1-8b-instruct:free',
  ollama: 'ollama:llama3.2',
  perplexity: 'sonar',
  cerebras: 'llama3.1-8b',
  together: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
  xai: 'grok-3-mini',
  moonshot: 'moonshot-v1-8k',
};

// FAST_SYNTHESIZERS: ordered list of preferred synthesizer models (fastest first)
const FAST_SYNTHESIZERS = [
  'llama-3.3-70b-versatile',   // Groq
  'gemini-2.0-flash',          // Gemini
  'mistral-small-latest',      // Mistral
];

export async function runEnsemble(
  query: string,
  messages: Message[],
  config: AppConfig,
  options: EnsembleOptions = {}
): Promise<void> {
  const { onlyFree = false, topN, timeout = 30000, verbose = false } = options;

  // 1. Collect available providers (those with configured credentials)
  const providers = config.providers;
  type ProviderEntry = { name: string; model: string };
  const available: ProviderEntry[] = [];

  const checkProvider = (name: string): void => {
    const prov = (providers as Record<string, unknown>)[name];
    if (!prov) return;
    const model = PROVIDER_DEFAULT_MODELS[name];
    if (model) available.push({ name, model });
  };

  // Collect all configured providers
  ['anthropic', 'openai', 'gemini', 'groq', 'mistral', 'deepseek',
   'cohere', 'huggingface', 'openrouter', 'perplexity', 'cerebras',
   'together', 'xai', 'moonshot'].forEach(checkProvider);

  // Ollama is always available if configured
  if (providers.ollama?.baseUrl) {
    available.push({ name: 'ollama', model: 'ollama:llama3.2' });
  }

  // 2. Filter to free-only if requested
  const filtered = onlyFree
    ? available.filter(p => FREE_PROVIDERS.includes(p.name))
    : available;

  // 3. Limit to topN if specified
  const candidates = topN ? filtered.slice(0, topN) : filtered;

  if (candidates.length === 0) {
    console.log(chalk.yellow('\n  No providers available for ensemble. Run: opencli auth\n'));
    return;
  }

  // 4. If only 1 model, run normally (no synthesis needed)
  if (candidates.length === 1) {
    const { runAgent } = await import('./agent');
    const { ConversationContext } = await import('./context');
    const ctx = new ConversationContext(config.contextWindow);
    await runAgent(query, ctx, { ...config, defaultModel: candidates[0].model }, { verbose });
    return;
  }

  console.log(
    chalk.blue.bold('\n  Ensemble Mode') +
    chalk.dim(` — querying ${candidates.length} AI${candidates.length > 1 ? 's' : ''} in parallel\n`)
  );

  const startTime = Date.now();

  // Status tracking
  const statuses: Record<string, 'pending' | 'ok' | 'err'> = {};
  for (const c of candidates) {
    statuses[c.name] = 'pending';
  }

  function renderStatus(): string {
    return candidates
      .map(c => {
        const s = statuses[c.name];
        if (s === 'ok') return chalk.green(`[${c.name} ✓]`);
        if (s === 'err') return chalk.red(`[${c.name} ✗]`);
        return chalk.yellow(`[${c.name} ⏳]`);
      })
      .join(' ');
  }

  const spinner = ora({
    text: renderStatus(),
    spinner: 'dots',
  }).start();

  // 5. Run all in parallel with Promise.allSettled + per-provider timeout
  const responses = await Promise.allSettled(
    candidates.map(async ({ name, model }) => {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`${name} timed out`)), timeout)
      );

      const callPromise = (async () => {
        const provider = getProvider(model, config);
        const response = await provider.chat({
          model,
          messages,
          maxTokens: 2048,
        });
        return { name, model, text: response.text };
      })();

      try {
        const result = await Promise.race([callPromise, timeoutPromise]);
        statuses[name] = 'ok';
        spinner.text = renderStatus();
        return result;
      } catch (err) {
        statuses[name] = 'err';
        spinner.text = renderStatus();
        throw err;
      }
    })
  );

  spinner.stop();

  // 6. Collect successful responses
  const successes: Array<{ name: string; text: string }> = [];
  const failures: string[] = [];

  for (let i = 0; i < responses.length; i++) {
    const r = responses[i];
    const name = candidates[i].name;
    if (r.status === 'fulfilled') {
      successes.push({ name, text: r.value.text });
    } else {
      failures.push(name);
      if (verbose) {
        console.log(chalk.dim(`  [${name}] Error: ${(r.reason as Error).message}`));
      }
    }
  }

  console.log(renderStatus() + '\n');

  if (successes.length === 0) {
    console.log(chalk.red('  All providers failed. Check your API keys.\n'));
    return;
  }

  // 7. Synthesize with fastest available model
  let synthModel: string | undefined;
  let synthProviderName: string | undefined;

  for (const model of FAST_SYNTHESIZERS) {
    try {
      getProvider(model, config);
      synthModel = model;
      // Determine which provider this model belongs to
      if (model.startsWith('llama')) synthProviderName = 'groq';
      else if (model.startsWith('gemini')) synthProviderName = 'gemini';
      else if (model.startsWith('mistral')) synthProviderName = 'mistral';
      break;
    } catch {
      // Provider not configured, try next
    }
  }

  if (!synthModel) {
    // Fall back to the first successful provider's model
    synthModel = candidates[0].model;
    synthProviderName = candidates[0].name;
  }

  const responsesList = successes
    .map((s, i) => `Response ${i + 1}:\n${s.text}`)
    .join('\n\n---\n\n');

  const synthPrompt = `You received ${successes.length} AI responses to the same query. Synthesize the best parts into ONE definitive, well-structured answer. Do not mention which AI said what — just give the best unified response.\n\nQuery: ${query}\n\nResponses:\n${responsesList}`;

  const synthSpinner = ora(
    chalk.dim(`Synthesizing with ${synthProviderName || synthModel}...`)
  ).start();

  try {
    const synthProvider = getProvider(synthModel, config);
    const synthResponse = await synthProvider.chat({
      model: synthModel,
      messages: [{ role: 'user', content: synthPrompt }],
      maxTokens: 4096,
      onText: (text: string) => {
        if (!synthSpinner.isSpinning) return;
        synthSpinner.stop();
        process.stdout.write(text);
      },
    });

    if (synthSpinner.isSpinning) {
      synthSpinner.stop();
      process.stdout.write(synthResponse.text);
    }
  } catch (err) {
    synthSpinner.stop();
    // If synthesis fails, just print all responses
    console.log(chalk.yellow('\n  Synthesis failed, showing individual responses:\n'));
    for (const s of successes) {
      console.log(chalk.blue.bold(`\n  [${s.name}]`));
      console.log(s.text);
    }
  }

  const elapsed = Date.now() - startTime;
  const failNote = failures.length > 0 ? chalk.dim(` (${failures.join(', ')} failed)`) : '';

  // 8. Print attribution footer
  console.log(
    '\n\n' +
    chalk.dim(`Synthesized from ${successes.length}/${candidates.length} models • ${elapsed}ms`) +
    failNote +
    '\n'
  );
}

// Re-export AppConfig type for use in other modules
export type { AppConfig };
