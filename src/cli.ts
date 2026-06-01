#!/usr/bin/env node
import { Command } from 'commander';
import * as fs from 'fs';
import { getConfig, setConfigValue, applyProfile } from './config';
import { runAgent } from './core/agent';
import { ConversationContext } from './core/context';
import { startRepl } from './ui/repl';
import { showMini, showBanner } from './ui/banner';
import { showError, showInfo, showUsageStats, C } from './ui/display';
import { runAuth } from './auth';
import { listSkills, getSkill } from './skills';

const program = new Command();

program
  .name('opencli')
  .description('Open CLI — Multi-model AI terminal for developers')
  .version('1.0.0')
  .argument('[prompt]', 'Prompt to run in one-shot mode')
  .option('-m, --model <name>', 'AI model to use (claude-opus-4-5, gpt-4o, gemini-2.0-flash, ollama:llama3.2)')
  .option('-s, --skill <name>', 'Built-in skill (vuejs, gsap, php, javascript, html-css, react, nodejs, git, vibe-coding)')
  .option('-y, --yes', 'Auto-approve low-risk commands')
  .option('--dry-run', 'Preview commands without executing anything')
  .option('-p, --profile <name>', 'Use a named profile from config')
  .option('--show-cost', 'Display token usage and estimated cost')
  .option('--no-color', 'Disable terminal colors')
  .option('-v, --verbose', 'Show raw tool calls and responses')
  .option('-c, --context <file>', 'Inject a file into the initial context');

program
  .command('auth')
  .description('Manage API keys and provider authentication')
  .action(async () => {
    await runAuth();
    process.exit(0);
  });

program
  .command('skills')
  .description('List all available built-in skills')
  .action(() => {
    const { showSkillsTable } = require('./ui/display');
    showSkillsTable(listSkills());
    process.exit(0);
  });

program
  .command('config')
  .description('Show current configuration')
  .action(() => {
    const config = getConfig();
    console.log('\n' + C.blue.bold('  Current Configuration') + '\n');
    console.log('  ' + C.dim('model:       ') + C.green(config.defaultModel));
    console.log('  ' + C.dim('skill:       ') + C.green(config.activeSkill));
    console.log('  ' + C.dim('auto-approve:') + ' ' + (config.autoApprove ? C.green('yes') : C.dim('no')));
    console.log('  ' + C.dim('dry-run:     ') + ' ' + (config.dryRun ? C.yellow('yes') : C.dim('no')));
    console.log('  ' + C.dim('show-usage:  ') + ' ' + (config.showUsage ? C.green('yes') : C.dim('no')));
    console.log('\n  ' + C.dim('Providers:'));
    if (config.providers.anthropic?.apiKey) console.log('    ' + C.green('● Anthropic (Claude)'));
    else console.log('    ' + C.dim('○ Anthropic — not configured'));
    if (config.providers.openai?.apiKey) console.log('    ' + C.green('● OpenAI (GPT)'));
    else console.log('    ' + C.dim('○ OpenAI — not configured'));
    if (config.providers.gemini?.apiKey) console.log('    ' + C.green('● Google (Gemini)'));
    else console.log('    ' + C.dim('○ Google — not configured'));
    if (config.providers.ollama?.baseUrl) console.log('    ' + C.green(`● Ollama — ${config.providers.ollama.baseUrl}`));
    else console.log('    ' + C.dim('○ Ollama — not configured'));
    console.log();
    process.exit(0);
  });

program.action(async (prompt: string | undefined, opts: Record<string, unknown>) => {
  // Apply color setting
  if (opts.color === false) {
    process.env.NO_COLOR = '1';
  }

  // Apply profile if specified
  if (opts.profile) {
    applyProfile(opts.profile as string);
  }

  // Build config overrides
  if (opts.model) setConfigValue('defaultModel', opts.model as string);
  if (opts.skill) setConfigValue('activeSkill', opts.skill as string);
  if (opts.yes) setConfigValue('autoApprove', true);
  if (opts.dryRun) setConfigValue('dryRun', true);
  if (opts.showCost) setConfigValue('showUsage', true);

  // Read piped stdin
  let pipeInput: string | undefined;
  if (!process.stdin.isTTY) {
    pipeInput = fs.readFileSync('/dev/stdin', 'utf-8').trim();
  }

  // Read context file if specified
  if (opts.context) {
    try {
      const contextContent = fs.readFileSync(opts.context as string, 'utf-8');
      pipeInput = (pipeInput ? pipeInput + '\n\n' : '') +
        `Context from file (${opts.context}):\n\`\`\`\n${contextContent}\n\`\`\``;
    } catch (err) {
      showError(`Cannot read context file: ${(err as Error).message}`);
      process.exit(1);
    }
  }

  // One-shot mode
  if (prompt || pipeInput) {
    const config = getConfig();
    showMini();

    if (!hasAnyProvider(config)) {
      showError('No AI provider configured. Run: opencli auth');
      process.exit(1);
    }

    const context = new ConversationContext(config.contextWindow);
    const query = prompt || (pipeInput ? 'Process the piped input as instructed' : '');

    try {
      await runAgent(query, context, config, {
        verbose: opts.verbose as boolean,
        pipeInput: pipeInput && prompt ? pipeInput : undefined,
      });

      if (config.showUsage) {
        const s = context.stats;
        showUsageStats(s, s.totalInputTokens, s.totalOutputTokens);
      }
    } catch (err: unknown) {
      const message = (err as Error).message;
      showError(message);
      if (message.includes('API key not set') || message.includes('not configured')) {
        showInfo('Run: opencli auth');
      }
      process.exit(1);
    }
    process.exit(0);
  }

  // Interactive REPL mode
  await startRepl({
    model: opts.model as string | undefined,
    skill: opts.skill as string | undefined,
    autoApprove: opts.yes as boolean | undefined,
    dryRun: opts.dryRun as boolean | undefined,
    showCost: opts.showCost as boolean | undefined,
    verbose: opts.verbose as boolean | undefined,
    noColor: opts.color === false,
  });
});

function hasAnyProvider(config: ReturnType<typeof getConfig>): boolean {
  return !!(
    config.providers.anthropic?.apiKey ||
    config.providers.openai?.apiKey ||
    config.providers.gemini?.apiKey ||
    config.providers.ollama?.baseUrl
  );
}

program.parseAsync(process.argv).catch(err => {
  showError(err.message);
  process.exit(1);
});
