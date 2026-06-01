import * as readline from 'readline';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { getConfig, setConfigValue, applyProfile } from '../config';
import { runAgent } from '../core/agent';
import { ConversationContext } from '../core/context';
import { KNOWN_MODELS } from '../core/router';
import { runAuth } from '../auth';
import { listSkills, getSkill } from '../skills';
import { runNotifySetup, } from '../notifications/setup';
import { sendNotification } from '../notifications';
import { showBanner, getPromptString } from './banner';
import {
  showHelpTable, showSkillsTable, showError, showSuccess,
  showInfo, showWarning, showDivider, showUsageStats, C,
} from './display';
import { createAgent, listAgents, getAgent, deleteAgent, updateAgent } from '../agents/manager';
import { runAgentOnce, spawnAgentBackground } from '../agents/runner';
import { BUILTIN_AGENT_TYPES } from '../agents/types';
import { BUILTIN_MCP_SERVERS } from '../mcp/registry';

export interface ReplOptions {
  model?: string;
  skill?: string;
  autoApprove?: boolean;
  dryRun?: boolean;
  showCost?: boolean;
  verbose?: boolean;
  noColor?: boolean;
  browserMode?: boolean;
}

export async function startRepl(options: ReplOptions = {}): Promise<void> {
  const config = getConfig();
  if (options.model) setConfigValue('defaultModel', options.model);
  if (options.skill) setConfigValue('activeSkill', options.skill);
  if (options.autoApprove !== undefined) setConfigValue('autoApprove', options.autoApprove);
  if (options.dryRun !== undefined) setConfigValue('dryRun', options.dryRun);

  showBanner();

  const context = new ConversationContext(config.contextWindow);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    historySize: 200,
    terminal: true,
    removeHistoryDuplicates: true,
  });

  function updatePrompt(): void {
    const cfg = getConfig();
    rl.setPrompt('\n' + getPromptString(cfg.defaultModel, cfg.activeSkill));
  }

  updatePrompt();

  rl.on('line', async (line: string) => {
    const input = line.trim();
    if (!input) { updatePrompt(); rl.prompt(); return; }
    rl.pause();

    try {
      if (input.startsWith('/')) {
        await handleCommand(input, context, options);
      } else {
        const cfg = getConfig();
        await runAgent(input, context, cfg, { verbose: options.verbose });
        if (options.showCost || cfg.showUsage) {
          const s = context.stats;
          showUsageStats(s, s.totalInputTokens, s.totalOutputTokens);
        }
      }
    } catch (err: unknown) {
      const message = (err as Error).message;
      showError(message);
      if (message.includes('API key not set') || message.includes('not configured')) {
        showInfo('Run /auth to set up your API keys');
      }
    }

    updatePrompt();
    rl.resume();
    rl.prompt();
  });

  rl.on('close', () => {
    console.log('\n\n  ' + C.green('✓') + ' ' + C.dim('Goodbye! Session ended.') + '\n');
    process.exit(0);
  });

  rl.on('SIGINT', () => {
    console.log('\n\n  ' + C.dim('(Press Ctrl+C again or type /exit to quit)'));
    updatePrompt();
    rl.prompt();
  });

  rl.prompt();
}

async function handleCommand(input: string, context: ConversationContext, options: ReplOptions): Promise<void> {
  const parts = input.slice(1).trim().split(/\s+/);
  const cmd = parts[0]?.toLowerCase();
  const args = parts.slice(1);

  switch (cmd) {
    // ── Core ──────────────────────────────────────────────
    case 'auth':
      await runAuth();
      break;

    case 'help': case 'h':
      showHelpTable();
      break;

    case 'exit': case 'quit': case 'q':
      console.log('\n  ' + C.green('✓') + ' ' + C.dim('Goodbye!') + '\n');
      process.exit(0);
      break;

    case 'clear':
      console.clear();
      showBanner();
      break;

    case 'reset':
      context.reset();
      showSuccess('Conversation history cleared');
      break;

    case 'history': {
      const history = context.getHistory();
      if (history.length === 0) { showInfo('No history yet.'); break; }
      console.log('\n  ' + C.blue.bold('Conversation History') + '\n');
      history.forEach((msg, i) => {
        const icon = msg.role === 'user' ? C.green('you') : C.blue(' ai');
        console.log(`  ${C.dim(String(i + 1).padStart(2, ' '))} ${icon}  ${C.dim(msg.preview)}`);
      });
      console.log();
      break;
    }

    case 'cost': {
      const s = context.stats;
      showUsageStats(s, s.totalInputTokens, s.totalOutputTokens);
      break;
    }

    // ── Model ─────────────────────────────────────────────
    case 'model': {
      if (args.length === 0) {
        const cfg = getConfig();
        console.log('\n  Current model: ' + C.green(cfg.defaultModel));
        console.log('\n  ' + C.blue.bold('Available models:'));
        for (const [provider, models] of Object.entries(KNOWN_MODELS)) {
          console.log('  ' + C.dim(provider + ':'));
          models.forEach(m => console.log('    ' + C.green(m)));
        }
        console.log();
      } else {
        setConfigValue('defaultModel', args[0]);
        showSuccess(`Model switched to ${args[0]}`);
      }
      break;
    }

    // ── Skills ────────────────────────────────────────────
    case 'skill': {
      if (args.length === 0) {
        showInfo(`Current skill: ${getConfig().activeSkill}`);
        showInfo('Use /skills to list all');
        break;
      }
      const skill = getSkill(args[0]);
      setConfigValue('activeSkill', args[0]);
      showSuccess(`Skill: ${chalk.hex(skill.color)(skill.icon + ' ' + skill.name)}`);
      showInfo(skill.description);
      break;
    }

    case 'skills':
      showSkillsTable(listSkills());
      break;

    // ── Profile ───────────────────────────────────────────
    case 'profile': {
      if (args.length === 0) {
        const cfg = getConfig();
        console.log('\n  ' + C.blue.bold('Saved Profiles') + '\n');
        for (const [name, prof] of Object.entries(cfg.profiles)) {
          const active = name === cfg.activeProfile ? C.green(' (active)') : '';
          console.log(`  ${C.green(name.padEnd(12))}  ${C.dim('model:')} ${prof.model}${active}`);
        }
        console.log();
      } else {
        const result = applyProfile(args[0]);
        if (result) showSuccess(`Profile "${args[0]}" applied — model: ${result.defaultModel}`);
        else showWarning(`Profile "${args[0]}" not found`);
      }
      break;
    }

    // ── MCP Servers ───────────────────────────────────────
    case 'mcp': {
      const sub = args[0];
      if (!sub || sub === 'list') {
        console.log('\n  ' + C.blue.bold('⚡ Built-in MCP Servers') + '\n');
        for (const server of BUILTIN_MCP_SERVERS) {
          const setupNote = server.requiresSetup ? C.yellow(' (setup required)') : C.green(' (ready)');
          console.log(`  ${C.green(server.id.padEnd(18))} ${C.dim(server.description)}${setupNote}`);
          console.log(`  ${' '.repeat(18)} ${C.dim(server.tools.map(t => t.name).join(', '))}`);
          console.log();
        }
        showInfo('All MCP servers are built-in — no downloads required.');
        showInfo('Browser MCP requires: npx playwright install chromium');
        console.log();
      }
      break;
    }

    // ── Browser ───────────────────────────────────────────
    case 'browser': {
      const sub = args[0];
      if (sub === 'install') {
        showInfo('Installing Playwright browsers...');
        const { executeBash } = await import('../tools/shell');
        const result = await executeBash({ command: 'npx playwright install chromium' });
        if (!result.isError) showSuccess('Playwright browsers installed!');
        else showError(result.output);
      } else if (sub === 'screenshot') {
        const url = args[1];
        if (!url) { showWarning('Usage: /browser screenshot <url>'); break; }
        showInfo(`Taking screenshot of ${url}...`);
        const cfg = getConfig();
        await runAgent(
          `Navigate to ${url}, take a screenshot, and tell me what you see on the page.`,
          context, cfg, { verbose: options.verbose }
        );
      } else {
        console.log('\n  ' + C.blue.bold('Browser Commands') + '\n');
        console.log('  ' + C.green('/browser install') + C.dim('    — Install Playwright browsers (first-time setup)'));
        console.log('  ' + C.green('/browser screenshot <url>') + C.dim(' — Screenshot a URL'));
        console.log('\n  ' + C.dim('Or use /skill browser-automation for AI-driven browser tasks'));
        console.log();
      }
      break;
    }

    // ── Agents ────────────────────────────────────────────
    case 'agent': {
      const sub = args[0];

      if (!sub || sub === 'list') {
        const agents = listAgents();
        if (agents.length === 0) {
          showInfo('No agents configured. Use /agent create to add one.');
          console.log('  ' + C.dim('Agent types: ' + Object.keys(BUILTIN_AGENT_TYPES).join(', ')));
          break;
        }
        console.log('\n  ' + C.blue.bold('Configured Agents') + '\n');
        for (const a of agents) {
          const status = a.enabled ? C.green('● enabled') : C.dim('○ disabled');
          console.log(`  ${C.purple(a.name.padEnd(20))} ${status} ${C.dim('type:')} ${a.type} ${C.dim('trigger:')} ${a.trigger}`);
          if (a.lastRun) console.log(`  ${' '.repeat(20)} ${C.dim('last run: ' + new Date(a.lastRun).toLocaleString())}`);
        }
        console.log();
      } else if (sub === 'types') {
        console.log('\n  ' + C.blue.bold('Agent Types') + '\n');
        for (const [id, info] of Object.entries(BUILTIN_AGENT_TYPES)) {
          console.log(`  ${C.purple(id.padEnd(22))} ${C.dim(info.description)}`);
        }
        console.log();
        showInfo('Use /agent create to set up a new agent');
        console.log();
      } else if (sub === 'create') {
        await createAgentInteractive();
      } else if (sub === 'run') {
        const agentId = args[1];
        if (!agentId) { showWarning('Usage: /agent run <name-or-id>'); break; }
        const agent = getAgent(agentId);
        if (!agent) { showError(`Agent "${agentId}" not found`); break; }
        showInfo(`Running agent "${agent.name}"...`);
        const run = await runAgentOnce(agent.id);
        showSuccess(`Agent completed. Status: ${run.status}`);
      } else if (sub === 'background') {
        const agentId = args[1];
        if (!agentId) { showWarning('Usage: /agent background <name-or-id>'); break; }
        const agent = getAgent(agentId);
        if (!agent) { showError(`Agent "${agentId}" not found`); break; }
        const pid = spawnAgentBackground(agent.id);
        showSuccess(`Agent "${agent.name}" started in background (PID: ${pid})`);
      } else if (sub === 'delete') {
        const agentId = args[1];
        if (!agentId) { showWarning('Usage: /agent delete <name-or-id>'); break; }
        if (deleteAgent(agentId)) showSuccess(`Agent deleted`);
        else showError(`Agent "${agentId}" not found`);
      } else if (sub === 'enable' || sub === 'disable') {
        const agentId = args[1];
        if (!agentId) { showWarning(`Usage: /agent ${sub} <name-or-id>`); break; }
        const agent = getAgent(agentId);
        if (!agent) { showError(`Agent "${agentId}" not found`); break; }
        updateAgent(agent.id, { enabled: sub === 'enable' });
        showSuccess(`Agent "${agent.name}" ${sub}d`);
      } else {
        showAgentHelp();
      }
      break;
    }

    // ── Notifications ─────────────────────────────────────
    case 'notify': {
      const sub = args[0];
      if (!sub || sub === 'setup') {
        await runNotifySetup();
      } else if (sub === 'test') {
        showInfo('Sending test notification...');
        const results = await sendNotification('Test from Open CLI REPL', {
          title: '🧪 REPL Test',
          level: 'info',
          metadata: { time: new Date().toLocaleString() },
        });
        if (results.telegram) showSuccess('Telegram: sent');
        if (results.discord) showSuccess('Discord: sent');
        if (!results.telegram && !results.discord) {
          showWarning('No notifications sent. Run /notify setup first.');
        }
      } else if (sub === 'send') {
        const message = args.slice(1).join(' ');
        if (!message) { showWarning('Usage: /notify send <message>'); break; }
        const results = await sendNotification(message, { level: 'info' });
        showSuccess(`Sent: telegram=${results.telegram} discord=${results.discord}`);
      } else {
        console.log('\n  ' + C.blue.bold('Notification Commands') + '\n');
        console.log('  ' + C.green('/notify setup') + C.dim('         — Configure Telegram/Discord'));
        console.log('  ' + C.green('/notify test') + C.dim('          — Send a test notification'));
        console.log('  ' + C.green('/notify send <msg>') + C.dim('    — Send a custom message'));
        console.log();
      }
      break;
    }

    // ── Toggles ───────────────────────────────────────────
    case 'dry-run': case 'dryrun': {
      const cfg = getConfig();
      const newVal = !cfg.dryRun;
      setConfigValue('dryRun', newVal);
      showSuccess(`Dry-run mode ${newVal ? 'enabled' : 'disabled'}`);
      break;
    }

    case 'auto': case 'autoapprove': {
      const cfg = getConfig();
      const newVal = !cfg.autoApprove;
      setConfigValue('autoApprove', newVal);
      showSuccess(`Auto-approve ${newVal ? 'enabled' : 'disabled'}`);
      break;
    }

    case 'divider':
      showDivider();
      break;

    default:
      showWarning(`Unknown command: /${cmd}. Type /help for available commands.`);
  }
}

async function createAgentInteractive(): Promise<void> {
  console.log('\n  ' + C.purple.bold('Create New Agent') + '\n');

  const typeChoices = Object.entries(BUILTIN_AGENT_TYPES).map(([id, info]) => ({
    name: `${C.purple(id.padEnd(22))} ${C.dim(info.description)}`,
    value: id,
    short: id,
  }));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Agent name:',
      validate: (v: string) => v.trim().length > 0 || 'Name required',
    },
    {
      type: 'list',
      name: 'type',
      message: 'Agent type:',
      choices: typeChoices,
    },
    {
      type: 'input',
      name: 'task',
      message: 'Task description (what should this agent do?):',
      default: (answers: Record<string, string>) =>
        BUILTIN_AGENT_TYPES[answers.type as keyof typeof BUILTIN_AGENT_TYPES]?.defaultTask,
    },
    {
      type: 'list',
      name: 'trigger',
      message: 'When should this agent run?',
      choices: [
        { name: 'Manual (run with /agent run)', value: 'manual' },
        { name: 'Background (continuous loop)', value: 'continuous' },
        { name: 'Cron schedule', value: 'cron' },
        { name: 'File change watcher', value: 'file_change' },
      ],
    },
    {
      type: 'input',
      name: 'cron',
      message: 'Cron expression (e.g. "0 * * * *" for hourly):',
      when: (a: Record<string, string>) => a.trigger === 'cron',
    },
    {
      type: 'input',
      name: 'watchPath',
      message: 'Path to watch for changes:',
      default: '.',
      when: (a: Record<string, string>) => a.trigger === 'file_change',
    },
    {
      type: 'confirm',
      name: 'notifications',
      message: 'Enable notifications for this agent?',
      default: true,
    },
  ]);

  const builtin = BUILTIN_AGENT_TYPES[answers.type as keyof typeof BUILTIN_AGENT_TYPES];

  const agent = createAgent(
    answers.name,
    answers.type as keyof typeof BUILTIN_AGENT_TYPES,
    answers.task,
    {
      trigger: answers.trigger as 'manual' | 'cron' | 'file_change' | 'continuous',
      triggerConfig: answers.cron
        ? { cron: answers.cron }
        : answers.watchPath
        ? { watchPath: answers.watchPath }
        : undefined,
      notifications: String(answers.notifications) !== 'false',
      tools: builtin.defaultTools,
      skill: builtin.defaultSkill,
    }
  );

  showSuccess(`Agent "${agent.name}" created! ID: ${agent.id.slice(0, 8)}`);
  console.log('  ' + C.dim('Run now:') + ' ' + C.green(`/agent run ${agent.name}`));
  console.log('  ' + C.dim('Background:') + ' ' + C.green(`/agent background ${agent.name}`));
  console.log();
}

function showAgentHelp(): void {
  console.log('\n  ' + C.blue.bold('Agent Commands') + '\n');
  const cmds = [
    ['/agent list', 'List all configured agents'],
    ['/agent types', 'Show all available agent types'],
    ['/agent create', 'Create a new agent interactively'],
    ['/agent run <name>', 'Run an agent immediately (foreground)'],
    ['/agent background <name>', 'Run agent as background process'],
    ['/agent enable/disable <name>', 'Toggle agent on/off'],
    ['/agent delete <name>', 'Delete an agent'],
  ];
  for (const [cmd, desc] of cmds) {
    console.log('  ' + C.green(cmd.padEnd(32)) + C.dim(desc));
  }
  console.log();
}
