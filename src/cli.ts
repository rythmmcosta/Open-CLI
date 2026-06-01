#!/usr/bin/env node
import { Command } from 'commander';
import * as fs from 'fs';
import { getConfig, setConfigValue, applyProfile } from './config';
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
  .option('--notify', 'Send Telegram/Discord notification when done');

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

    const context = new ConversationContext(config.contextWindow);
    const query = prompt || 'Process the piped input as instructed';

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
