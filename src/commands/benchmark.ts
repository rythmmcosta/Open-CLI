// Run the same prompt against multiple models simultaneously, compare responses
import chalk from 'chalk';
import Table from 'cli-table3';
import { getProvider } from '../core/router';
import { AppConfig } from '../types';

interface BenchmarkResult {
  model: string;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  preview: string;
  error?: string;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatCost(usd: number): string {
  if (usd === 0) return chalk.dim('—');
  if (usd < 0.001) return `$${usd.toFixed(6)}`;
  return `$${usd.toFixed(4)}`;
}

function estimateBenchmarkCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing: Record<string, { inputPer1M: number; outputPer1M: number }> = {
    'claude-opus':   { inputPer1M: 15.0, outputPer1M: 75.0 },
    'claude-sonnet': { inputPer1M: 3.0,  outputPer1M: 15.0 },
    'claude-haiku':  { inputPer1M: 0.25, outputPer1M: 1.25 },
    'gpt-4o':        { inputPer1M: 5.0,  outputPer1M: 15.0 },
    'gpt-4o-mini':   { inputPer1M: 0.15, outputPer1M: 0.6  },
    'gpt-4-turbo':   { inputPer1M: 10.0, outputPer1M: 30.0 },
    'groq':          { inputPer1M: 0.07, outputPer1M: 0.08 },
    'gemini':        { inputPer1M: 0.35, outputPer1M: 1.05 },
  };

  const lower = model.toLowerCase();
  let rates = { inputPer1M: 0, outputPer1M: 0 };

  for (const [key, val] of Object.entries(pricing)) {
    if (lower.includes(key)) {
      rates = val;
      break;
    }
  }

  return ((inputTokens * rates.inputPer1M) + (outputTokens * rates.outputPer1M)) / 1_000_000;
}

async function runSingleModel(
  model: string,
  prompt: string,
  config: AppConfig
): Promise<BenchmarkResult> {
  const startTime = Date.now();

  try {
    const provider = getProvider(model, config);

    const response = await provider.chat({
      model,
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 1024,
      // No onText streaming — we want the full response for comparison
    });

    const durationMs = Date.now() - startTime;
    const inputTokens = response.usage?.inputTokens ?? 0;
    const outputTokens = response.usage?.outputTokens ?? 0;
    const costUsd = estimateBenchmarkCost(model, inputTokens, outputTokens);
    const preview = response.text.slice(0, 200).replace(/\n/g, ' ');

    return { model, durationMs, inputTokens, outputTokens, costUsd, preview };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const error = err instanceof Error ? err.message : String(err);
    return {
      model,
      durationMs,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      preview: '',
      error,
    };
  }
}

export async function runBenchmark(
  prompt: string,
  models: string[],
  config: AppConfig
): Promise<void> {
  if (models.length === 0) {
    console.log(chalk.yellow('No models specified for benchmark.'));
    return;
  }

  console.log(chalk.bold('\n  Benchmark'));
  console.log(chalk.dim(`  Prompt: "${prompt.slice(0, 80)}${prompt.length > 80 ? '...' : ''}"`));
  console.log(chalk.dim(`  Models: ${models.join(', ')}`));
  console.log(chalk.dim(`  Running ${models.length} model(s) in parallel...\n`));

  const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let spinnerIdx = 0;
  const spinnerTimer = setInterval(() => {
    process.stdout.write(`\r  ${chalk.cyan(spinnerFrames[spinnerIdx++ % spinnerFrames.length])} Waiting for responses...`);
  }, 80);

  const results = await Promise.all(
    models.map((model) => runSingleModel(model, prompt, config))
  );

  clearInterval(spinnerTimer);
  process.stdout.write('\r' + ' '.repeat(50) + '\r');

  const table = new Table({
    head: [
      chalk.bold('Model'),
      chalk.bold('Time'),
      chalk.bold('Input Tkns'),
      chalk.bold('Output Tkns'),
      chalk.bold('Cost'),
      chalk.bold('Response Preview'),
    ],
    colWidths: [30, 10, 12, 13, 12, 42],
    style: { head: [], border: ['dim'] },
    wordWrap: true,
  });

  // Sort by duration ascending (fastest first)
  results.sort((a, b) => {
    if (a.error && !b.error) return 1;
    if (!a.error && b.error) return -1;
    return a.durationMs - b.durationMs;
  });

  for (const r of results) {
    if (r.error) {
      table.push([
        chalk.red(r.model),
        chalk.dim(formatDuration(r.durationMs)),
        chalk.dim('—'),
        chalk.dim('—'),
        chalk.dim('—'),
        chalk.red(`Error: ${r.error.slice(0, 38)}`),
      ]);
    } else {
      const isFirst = results.indexOf(r) === 0;
      const modelLabel = isFirst ? chalk.green(`${r.model} ⚡`) : r.model;
      table.push([
        modelLabel,
        isFirst ? chalk.green(formatDuration(r.durationMs)) : formatDuration(r.durationMs),
        r.inputTokens.toLocaleString(),
        r.outputTokens.toLocaleString(),
        formatCost(r.costUsd),
        chalk.dim(r.preview || '(empty response)'),
      ]);
    }
  }

  console.log(table.toString());

  const successful = results.filter((r) => !r.error);
  if (successful.length > 1) {
    const fastest = successful[0];
    const slowest = successful[successful.length - 1];
    const speedup = (slowest.durationMs / fastest.durationMs).toFixed(1);
    console.log(
      chalk.dim(`\n  Fastest: ${chalk.green(fastest.model)} `) +
      chalk.dim(`(${speedup}x faster than ${slowest.model})`)
    );

    const totalCost = successful.reduce((sum, r) => sum + r.costUsd, 0);
    if (totalCost > 0) {
      console.log(chalk.dim(`  Total cost this benchmark: ${formatCost(totalCost)}`));
    }
  }

  console.log();
}
