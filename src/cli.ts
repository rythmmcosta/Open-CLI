#!/usr/bin/env node
import { Command } from 'commander';
import * as fs from 'fs';
import { getConfig, setConfigValue, applyProfile, autoSelectProvider } from './config';
import { runAgent } from './core/agent';
import { ConversationContext } from './core/context';
import { startRepl } from './ui/repl';
import { showMini } from './ui/banner';
import { showError, showInfo, showUsageStats, C } from './ui/display';
import { runAuth } from './auth';
import { listSkills } from './skills';
import { runNotifySetup, } from './notifications/setup';
import { sendNotification } from './notifications';
import { createAgent, listAgents, getAgent, deleteAgent } from './agents/manager';
import { runAgentOnce, spawnAgentBackground } from './agents/runner';
import { BUILTIN_MCP_SERVERS } from './mcp/registry';
import { BUILTIN_AGENT_TYPES } from './agents/types';

const program = new Command();

program
  .name('opencli')
  .description('Open CLI — opencli.myowncloud.tech — Multi-model AI terminal for developers')
  .version('1.0.0')
  .argument('[prompt]', 'Prompt to run in one-shot mode')
  .option('-m, --model <name>', 'AI model (claude-opus-4-5, gpt-4o, gemini-2.0-flash, ollama:llama3.2)')
  .option('-s, --skill <name>', 'Built-in skill')
  .option('-y, --yes', 'Auto-approve low-risk commands')
  .option('--dry-run', 'Preview commands without executing')
  .option('-p, --profile <name>', 'Use a named profile from config')
  .option('--show-cost', 'Display token usage and cost after each response')
  .option('--no-color', 'Disable terminal colors')
  .option('-v, --verbose', 'Show raw tool calls and responses')
  .option('-c, --context <file>', 'Inject a file into the initial context')
  .option('--browser', 'Enable browser automation tools for this session')
  .option('--notify', 'Send Telegram/Discord notification when done')
  .option('--ensemble', 'Query all configured AI providers simultaneously and synthesize the best answer')
  .option('--ensemble-free', 'Use only free-tier AI providers for ensemble mode')
  .option('--top <n>', 'Limit ensemble to top N providers (default: all)')
  .option('--image', 'Generate an image from the prompt (uses Pollinations — free, no key required)')
  .option('--image-provider <name>', 'Image provider: pollinations, huggingface, dalle, stability, ideogram, fal')
  .option('--video', 'Generate a video from the prompt (requires HuggingFace key or other video provider)')
  .option('--video-provider <name>', 'Video provider: huggingface, replicate, luma, runway')
  .option('--codex', 'Pure code-only mode — no explanations, production code output')
  .option('--size <WxH>', 'Image/video dimensions, e.g. 1024x1024');

// ── auth ──────────────────────────────────────────────────────────────
program
  .command('auth')
  .description('Manage API keys and provider authentication')
  .action(async () => { await runAuth(); process.exit(0); });

// ── skills ────────────────────────────────────────────────────────────
program
  .command('skills')
  .description('List all built-in skills')
  .action(() => {
    const { showSkillsTable } = require('./ui/display');
    showSkillsTable(listSkills());
    process.exit(0);
  });

// ── mcp ───────────────────────────────────────────────────────────────
program
  .command('mcp')
  .description('List built-in MCP servers')
  .action(() => {
    console.log('\n' + C.blue.bold('  ⚡ Built-in MCP Servers') + C.dim('  — no downloads required\n'));
    for (const s of BUILTIN_MCP_SERVERS) {
      const setup = s.requiresSetup ? C.yellow(' ⚠ requires setup') : C.green(' ✓ ready');
      console.log(`  ${C.green(s.id.padEnd(18))} ${C.dim(s.description)}${setup}`);
      console.log(`  ${' '.repeat(18)} ${C.dim('tools: ' + s.tools.map(t => t.name).join(', '))}`);
      console.log();
    }
    if (BUILTIN_MCP_SERVERS.some(s => s.requiresSetup)) {
      showInfo('Browser MCP requires: npx playwright install chromium');
      console.log();
    }
    process.exit(0);
  });

// ── browser ───────────────────────────────────────────────────────────
program
  .command('browser')
  .description('Browser automation commands')
  .argument('<action>', 'Action: install, screenshot <url>, verify <url>')
  .argument('[url]', 'URL for screenshot/verify')
  .option('--all', 'Install all browsers (not just chromium)')
  .action(async (action: string, url: string | undefined, opts: Record<string, unknown>) => {
    if (action === 'install') {
      showInfo('Installing Playwright browsers...');
      const { executeBash } = await import('./tools/shell');
      const browsers = opts.all ? 'all' : 'chromium';
      const result = await executeBash({ command: `npx playwright install ${browsers}` });
      if (!result.isError) {
        console.log('\n' + result.output);
        console.log(C.green('\n  ✓ Browser(s) installed. Open CLI browser automation ready!\n'));
      } else {
        showError(result.output);
      }
    } else if (action === 'screenshot' && url) {
      const config = getConfig();
      showMini();
      const context = new ConversationContext(10);
      await runAgent(
        `Navigate to ${url}, take a full-page screenshot, and describe what you see on the page.`,
        context, config, {}
      );
    } else if (action === 'verify' && url) {
      const config = getConfig();
      showMini();
      const context = new ConversationContext(10);
      await runAgent(
        `Navigate to ${url}. Verify the page loads correctly, check all main navigation links exist and are visible, verify no JavaScript console errors, check all forms have proper labels, and take a screenshot. Report pass/fail for each check.`,
        context, config, {}
      );
    } else {
      console.log('\n  Usage:');
      console.log('  ' + C.green('opencli browser install') + C.dim('            — Install Playwright browsers'));
      console.log('  ' + C.green('opencli browser screenshot <url>') + C.dim('   — Screenshot a page'));
      console.log('  ' + C.green('opencli browser verify <url>') + C.dim('       — Verify page integrity'));
      console.log();
    }
    process.exit(0);
  });

// ── agent ─────────────────────────────────────────────────────────────
const agentCmd = program.command('agent').description('Manage background agents');

agentCmd
  .command('list')
  .description('List all agents')
  .action(() => {
    const agents = listAgents();
    if (agents.length === 0) {
      showInfo('No agents. Create with: opencli agent create');
      console.log('  Types: ' + C.dim(Object.keys(BUILTIN_AGENT_TYPES).join(', ')));
    } else {
      console.log('\n' + C.purple.bold('  Agents') + '\n');
      for (const a of agents) {
        const status = a.enabled ? C.green('● on') : C.dim('○ off');
        console.log(`  ${C.purple(a.name.padEnd(20))} ${status}  ${C.dim(a.type)}  ${C.dim('trigger:' + a.trigger)}`);
      }
    }
    console.log();
    process.exit(0);
  });

agentCmd
  .command('types')
  .description('List agent types')
  .action(() => {
    console.log('\n' + C.purple.bold('  Agent Types') + '\n');
    for (const [id, info] of Object.entries(BUILTIN_AGENT_TYPES)) {
      console.log(`  ${C.purple(id.padEnd(24))} ${C.dim(info.description)}`);
    }
    console.log();
    process.exit(0);
  });

agentCmd
  .command('run <name>')
  .description('Run an agent immediately')
  .action(async (name: string) => {
    const agent = getAgent(name);
    if (!agent) { showError(`Agent "${name}" not found`); process.exit(1); }
    showMini();
    showInfo(`Running agent "${agent.name}"...`);
    const run = await runAgentOnce(agent.id);
    console.log('\n' + C.green('  ✓') + ` Agent "${agent.name}" completed. Status: ${run.status}\n`);
    process.exit(0);
  });

agentCmd
  .command('background <name>')
  .description('Run an agent as a background process')
  .action(async (name: string) => {
    const agent = getAgent(name);
    if (!agent) { showError(`Agent "${name}" not found`); process.exit(1); }
    const pid = spawnAgentBackground(agent.id);
    showInfo(`Agent "${agent.name}" started in background (PID: ${pid})`);
    process.exit(0);
  });

agentCmd
  .command('delete <name>')
  .description('Delete an agent')
  .action((name: string) => {
    if (deleteAgent(name)) showInfo(`Agent "${name}" deleted`);
    else showError(`Agent "${name}" not found`);
    process.exit(0);
  });

// ── notify ────────────────────────────────────────────────────────────
const notifyCmd = program.command('notify').description('Configure and send notifications');

notifyCmd
  .command('setup')
  .description('Configure Telegram/Discord notifications')
  .action(async () => { await runNotifySetup(); process.exit(0); });

notifyCmd
  .command('test')
  .description('Send a test notification')
  .action(async () => {
    showInfo('Sending test notification...');
    const results = await sendNotification('Test notification from Open CLI', {
      title: '🧪 Test',
      level: 'info',
      metadata: { time: new Date().toLocaleString(), source: 'opencli.myowncloud.tech' },
    });
    if (results.telegram) showInfo('Telegram: ✓ sent');
    if (results.discord) showInfo('Discord: ✓ sent');
    if (!results.telegram && !results.discord) showInfo('No notifications sent. Run: opencli notify setup');
    process.exit(0);
  });

notifyCmd
  .command('send <message>')
  .description('Send a custom notification')
  .option('-l, --level <level>', 'Level: info, success, warning, error', 'info')
  .option('-t, --title <title>', 'Notification title')
  .action(async (message: string, opts: Record<string, string>) => {
    const results = await sendNotification(message, {
      title: opts.title,
      level: opts.level as 'info' | 'success' | 'warning' | 'error',
    });
    showInfo(`Sent: telegram=${results.telegram} discord=${results.discord}`);
    process.exit(0);
  });

// ── github ────────────────────────────────────────────────────────────
program
  .command('github [subcommand] [args...]')
  .description('GitHub integration: status, connect, push, pull, clone, pr, issues, repos')
  .action(async (subcommand: string | undefined, args: string[]) => {
    showMini();
    const { runGithubCommand } = await import('./github');
    const fullArgs = subcommand ? [subcommand, ...args] : args;
    await runGithubCommand(fullArgs);
    process.exit(0);
  });

// ── project ───────────────────────────────────────────────────────────
program
  .command('project [subcommand] [args...]')
  .description('Project management: status, init, list, note, delete')
  .action(async (subcommand: string | undefined, args: string[]) => {
    const { runProjectCommand } = await import('./commands/project');
    const fullArgs = subcommand ? [subcommand, ...args] : args;
    runProjectCommand(fullArgs);
    process.exit(0);
  });

// ── benchmark ─────────────────────────────────────────────────────────
program
  .command('benchmark <prompt>')
  .description('Benchmark a prompt across multiple AI models')
  .option('-m, --models <list>', 'Comma-separated list of models to compare')
  .action(async (prompt: string, opts: Record<string, string>) => {
    showMini();
    const { runBenchmark } = await import('./commands/benchmark');
    const config = getConfig();
    const models = opts.models
      ? opts.models.split(',').map(s => s.trim())
      : [config.defaultModel, 'gpt-4o-mini', 'gemini-2.0-flash'].filter(Boolean);
    await runBenchmark(prompt, models, config);
    process.exit(0);
  });

// ── recipe ────────────────────────────────────────────────────────────
const recipeCmd = program.command('recipe').description('CLI recipe system: save and run AI workflows');

recipeCmd
  .command('list')
  .description('List all saved recipes')
  .action(async () => {
    const { listRecipesCmd } = await import('./commands/recipe');
    await listRecipesCmd();
    process.exit(0);
  });

recipeCmd
  .command('create')
  .description('Create a new recipe interactively')
  .action(async () => {
    showMini();
    const { createRecipeInteractive } = await import('./commands/recipe');
    await createRecipeInteractive();
    process.exit(0);
  });

recipeCmd
  .command('run <name>')
  .description('Run a saved recipe')
  .action(async (name: string) => {
    showMini();
    const { runRecipe } = await import('./commands/recipe');
    const config = getConfig();
    await runRecipe(name, config);
    process.exit(0);
  });

recipeCmd
  .command('delete <name>')
  .description('Delete a recipe')
  .action(async (name: string) => {
    const { deleteRecipeCmd } = await import('./commands/recipe');
    await deleteRecipeCmd(name);
    process.exit(0);
  });

// ── timeline ──────────────────────────────────────────────────────────
program
  .command('timeline [file]')
  .description('Show file change history and rollback')
  .option('-r, --rollback <id>', 'Rollback to a specific history entry')
  .action(async (file: string | undefined, opts: Record<string, string>) => {
    const { showTimeline, doRollback } = await import('./commands/timeline');
    if (opts.rollback) {
      await doRollback(parseInt(opts.rollback, 10));
    } else {
      await showTimeline(file);
    }
    process.exit(0);
  });

// ── search ────────────────────────────────────────────────────────────
program
  .command('search <query>')
  .description('Full-text search across all project message history')
  .action((query: string) => {
    const { runProjectSearchCommand } = require('./commands/project-search');
    runProjectSearchCommand([query]);
    process.exit(0);
  });

// ── costs ─────────────────────────────────────────────────────────────
program
  .command('costs [days]')
  .description('AI cost dashboard — show token usage and estimated costs')
  .action((days: string | undefined) => {
    const { runCostsCommand } = require('./commands/costs');
    runCostsCommand(days ? [days] : []);
    process.exit(0);
  });

// ── config ────────────────────────────────────────────────────────────
program
  .command('config')
  .description('Show current configuration')
  .action(() => {
    const config = getConfig();
    console.log('\n' + C.blue.bold('  Configuration') + C.dim('  — opencli.myowncloud.tech') + '\n');
    console.log('  ' + C.dim('model:        ') + C.green(config.defaultModel));
    console.log('  ' + C.dim('skill:        ') + C.green(config.activeSkill));
    console.log('  ' + C.dim('auto-approve: ') + (config.autoApprove ? C.green('yes') : C.dim('no')));
    console.log('  ' + C.dim('dry-run:      ') + (config.dryRun ? C.yellow('yes') : C.dim('no')));
    console.log();
    console.log('  ' + C.dim('Providers:'));
    if (config.providers.anthropic?.apiKey) console.log('    ' + C.green('● Anthropic Claude'));
    else console.log('    ' + C.dim('○ Anthropic — run: opencli auth'));
    if (config.providers.openai?.apiKey) console.log('    ' + C.green('● OpenAI GPT'));
    else console.log('    ' + C.dim('○ OpenAI — run: opencli auth'));
    if (config.providers.gemini?.apiKey) console.log('    ' + C.green('● Google Gemini'));
    else console.log('    ' + C.dim('○ Google — run: opencli auth'));
    if (config.providers.ollama?.baseUrl) console.log('    ' + C.green(`● Ollama — ${config.providers.ollama.baseUrl}`));
    else console.log('    ' + C.dim('○ Ollama — run: opencli auth'));
    console.log();
    process.exit(0);
  });

// ── workspace ─────────────────────────────────────────────────────────
program
  .command('workspace')
  .description('Show all active Open CLI windows for this project')
  .action(async () => {
    const { IPCClient } = await import('./ipc/client');
    const client = new IPCClient(process.cwd());
    try {
      await client.connect();
      const ctx = await client.getContext();
      console.log('\n' + C.blue.bold('  ⚡ Active Workspace Windows'));
      if (ctx.activeWindows.length === 0) {
        console.log(C.dim('  No other windows connected\n'));
      } else {
        for (const w of ctx.activeWindows) {
          console.log(`  ${C.green(w.windowId)} ${C.dim('pid:' + w.pid)} ${w.currentFile ? C.yellow('→ ' + w.currentFile) : ''}`);
          if (w.lastAction) console.log(`  ${' '.repeat(2)}${C.dim(w.lastAction)}`);
        }
      }
      if (ctx.recentActions.length) {
        console.log('\n' + C.dim('  Recent actions:'));
        ctx.recentActions.forEach(a => console.log('  ' + C.dim('• ' + a)));
      }
      console.log();
    } catch {
      console.log(C.dim('\n  No coordinator running (open multiple windows in the same project to enable)\n'));
    }
    client.disconnect();
    process.exit(0);
  });

// ── wordpress ─────────────────────────────────────────────────────────
program
  .command('wordpress')
  .description('WordPress tools: status, export, new-theme <name>, new-plugin <name>')
  .argument('[subcommand]', 'status <url> | export <url> | new-theme <name> | new-plugin <name>')
  .argument('[args...]', 'Arguments for the subcommand')
  .action(async (sub: string | undefined, args: string[]) => {
    const { runWordpressCommand } = await import('./commands/wordpress');
    await runWordpressCommand(sub, args);
    process.exit(0);
  });

// ── sync ──────────────────────────────────────────────────────────────
program
  .command('sync')
  .description('Cross-device project sync (account required)')
  .argument('[subcommand]', 'login, register, logout, push, pull, list, status')
  .action(async (sub: string | undefined) => {
    const { runSync } = await import('./commands/sync');
    await runSync(sub, []);
    process.exit(0);
  });

// ── main action ───────────────────────────────────────────────────────
program.action(async (prompt: string | undefined, opts: Record<string, unknown>) => {
  if (opts.color === false) process.env.NO_COLOR = '1';
  if (opts.profile) applyProfile(opts.profile as string);

  if (opts.model) setConfigValue('defaultModel', opts.model as string);
  if (opts.skill) setConfigValue('activeSkill', opts.skill as string);
  if (opts.yes) setConfigValue('autoApprove', true);
  if (opts.dryRun) setConfigValue('dryRun', true);
  if (opts.showCost) setConfigValue('showUsage', true);

  let pipeInput: string | undefined;
  if (!process.stdin.isTTY) {
    pipeInput = fs.readFileSync('/dev/stdin', 'utf-8').trim();
  }

  if (opts.context) {
    try {
      const ctxContent = fs.readFileSync(opts.context as string, 'utf-8');
      pipeInput = (pipeInput ? pipeInput + '\n\n' : '') +
        `Context from file (${opts.context}):\n\`\`\`\n${ctxContent}\n\`\`\``;
    } catch (err) {
      showError(`Cannot read context file: ${(err as Error).message}`);
      process.exit(1);
    }
  }

  if (prompt || pipeInput) {
    const config = getConfig();
    showMini();

    if (!hasAnyProvider(config)) {
      showError('No AI provider configured. Run: opencli auth');
      process.exit(1);
    }

    const query = prompt || 'Process the piped input as instructed';

    // ── Ensemble mode ────────────────────────────────────────────────
    if (opts.ensemble || opts.ensembleFree) {
      const { runEnsemble } = await import('./core/ensemble');
      await runEnsemble(query, [], config, {
        onlyFree: !!opts.ensembleFree,
        topN: opts.top ? parseInt(opts.top as string) : undefined,
        verbose: !!opts.verbose,
      });
      process.exit(0);
    }

    // ── Image generation mode ─────────────────────────────────────────
    if (opts.image) {
      const { getImageProvider } = await import('./providers/image-router');
      const sizeStr = opts.size as string | undefined;
      const [w, h] = sizeStr ? sizeStr.split('x').map(Number) : [1024, 1024];
      const provider = getImageProvider(opts.imageProvider as string | undefined, config);
      console.log(C.dim(`  Generating image with ${provider.name}...`));
      try {
        const result = await provider.generate(query, { width: w, height: h });
        console.log(C.green(`\n  ✓ Image saved: ${result.filePath}`));
        if (result.url) console.log(C.dim(`  URL: ${result.url}`));
      } catch (err) { showError((err as Error).message); process.exit(1); }
      process.exit(0);
    }

    // ── Video generation mode ─────────────────────────────────────────
    if (opts.video) {
      const { getVideoProvider } = await import('./providers/video-router');
      const provider = getVideoProvider(opts.videoProvider as string | undefined, config);
      console.log(C.dim(`  Generating video with ${provider.name} (this may take 1-5 minutes)...`));
      try {
        const result = await provider.generate(query);
        if (result.status === 'complete') {
          console.log(C.green(`\n  ✓ Video saved: ${result.filePath}`));
        } else {
          console.log(C.yellow(`\n  ⏳ Video processing. Job ID: ${result.jobId || 'N/A'}`));
          console.log(C.dim('  Check provider dashboard or try again in a few minutes.'));
        }
      } catch (err) { showError((err as Error).message); process.exit(1); }
      process.exit(0);
    }

    // ── Codex mode — force code-only skill ───────────────────────────
    if (opts.codex) setConfigValue('activeSkill', 'codex');

    const context = new ConversationContext(config.contextWindow);

    try {
      await runAgent(query, context, config, {
        verbose: opts.verbose as boolean,
        pipeInput: pipeInput && prompt ? pipeInput : undefined,
      });

      if (config.showUsage) {
        showUsageStats(context.stats, context.stats.totalInputTokens, context.stats.totalOutputTokens);
      }

      if (opts.notify) {
        await sendNotification(`Task completed: ${query.slice(0, 100)}`, {
          title: 'Task Done',
          level: 'success',
          metadata: { model: config.defaultModel },
        });
      }
    } catch (err: unknown) {
      const message = (err as Error).message;
      showError(message);
      if (message.includes('API key not set')) showInfo('Run: opencli auth');

      if (opts.notify) {
        await sendNotification(`Task failed: ${message}`, { level: 'error', title: 'Task Failed' });
      }
      process.exit(1);
    }
    process.exit(0);
  }

  const replConfig = getConfig();
  await autoSelectProvider(replConfig);

  // Check for system announcements if user is logged in
  try {
    const syncConf = new (require('conf'))({ projectName: 'opencli-sync' });
    const token = syncConf.get('token') as string | undefined;
    if (token) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2000);
      const res = await fetch('https://opencli.myowncloud.tech/api/announcements.php', { signal: ctrl.signal });
      clearTimeout(t);
      if (res.ok) {
        const anns = await res.json() as Array<{title: string; message: string; level: string}>;
        const critical = anns.filter((a: {level: string}) => a.level === 'critical');
        for (const ann of critical) {
          console.log(C.yellow(`\n  ⚠ ${ann.title}: ${ann.message}\n`));
        }
      }
    }
  } catch { /* silently skip — never block startup */ }

  const isFreeModeActive = replConfig.defaultModel?.startsWith('pollinations-text');
  if (isFreeModeActive) {
    console.log(C.dim('  ⚡ Free mode — Pollinations AI (no API key needed)'));
    console.log(C.dim('  Run ' + C.green('opencli auth') + ' to configure Claude, GPT-4o, Groq, or 14 other providers\n'));
  }

  await startRepl({
    model: opts.model as string | undefined,
    skill: opts.skill as string | undefined,
    autoApprove: opts.yes as boolean | undefined,
    dryRun: opts.dryRun as boolean | undefined,
    showCost: opts.showCost as boolean | undefined,
    verbose: opts.verbose as boolean | undefined,
    noColor: opts.color === false,
    browserMode: opts.browser as boolean | undefined,
  });
});

function hasAnyProvider(config: ReturnType<typeof getConfig>): boolean {
  const p = config.providers;
  return !!(
    p.anthropic?.apiKey || p.openai?.apiKey || p.gemini?.apiKey || p.ollama?.baseUrl ||
    p.mistral?.apiKey || p.groq?.apiKey || p.moonshot?.apiKey || p.xai?.apiKey ||
    p.deepseek?.apiKey || p.together?.apiKey || p.perplexity?.apiKey || p.cerebras?.apiKey ||
    p.huggingface?.apiKey || p.cohere?.apiKey || p.azure?.apiKey || p.bedrock?.accessKeyId
  );
}

program.parseAsync(process.argv).catch(err => {
  showError(err.message);
  process.exit(1);
});
