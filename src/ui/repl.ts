import * as readline from 'readline';
import chalk from 'chalk';
import { getConfig, setConfigValue, applyProfile } from '../config';
import { runAgent } from '../core/agent';
import { ConversationContext } from '../core/context';
import { KNOWN_MODELS } from '../core/router';
import { runAuth } from '../auth';
import { listSkills, getSkill } from '../skills';
import {
  showBanner,
  getPromptString,
} from './banner';
import {
  showHelpTable,
  showSkillsTable,
  showError,
  showSuccess,
  showInfo,
  showWarning,
  showDivider,
  showUsageStats,
  C,
} from './display';

export interface ReplOptions {
  model?: string;
  skill?: string;
  autoApprove?: boolean;
  dryRun?: boolean;
  showCost?: boolean;
  verbose?: boolean;
  noColor?: boolean;
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

    if (!input) {
      updatePrompt();
      rl.prompt();
      return;
    }

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
    console.log('\n\n  ' + C.dim('(Ctrl+C to exit, or type /exit)'));
    updatePrompt();
    rl.prompt();
  });

  rl.prompt();
}

async function handleCommand(
  input: string,
  context: ConversationContext,
  options: ReplOptions
): Promise<void> {
  const parts = input.slice(1).trim().split(/\s+/);
  const cmd = parts[0]?.toLowerCase();
  const args = parts.slice(1);

  switch (cmd) {
    case 'auth':
      await runAuth();
      break;

    case 'help':
    case 'h':
      showHelpTable();
      break;

    case 'exit':
    case 'quit':
    case 'q':
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
      if (history.length === 0) {
        showInfo('No conversation history yet.');
        break;
      }
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
        const newModel = args[0];
        setConfigValue('defaultModel', newModel);
        showSuccess(`Model switched to ${newModel}`);
      }
      break;
    }

    case 'skill': {
      if (args.length === 0) {
        const cfg = getConfig();
        showInfo(`Current skill: ${cfg.activeSkill}`);
        showInfo('Use /skills to list all available skills');
        break;
      }
      const skillId = args[0];
      const skill = getSkill(skillId);
      if (skill.id === skillId || skillId === 'default') {
        setConfigValue('activeSkill', skillId);
        showSuccess(`Skill activated: ${chalk.hex(skill.color)(skill.icon + ' ' + skill.name)}`);
        showInfo(skill.description);
      } else {
        showWarning(`Unknown skill: ${skillId}. Run /skills to see available options.`);
      }
      break;
    }

    case 'skills': {
      const skills = listSkills();
      showSkillsTable(skills);
      break;
    }

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
        const profileName = args[0];
        const result = applyProfile(profileName);
        if (result) {
          showSuccess(`Profile "${profileName}" applied — model: ${result.defaultModel}`);
        } else {
          showWarning(`Profile "${profileName}" not found`);
        }
      }
      break;
    }

    case 'dry-run':
    case 'dryrun': {
      const cfg = getConfig();
      const newVal = !cfg.dryRun;
      setConfigValue('dryRun', newVal);
      showSuccess(`Dry-run mode ${newVal ? 'enabled' : 'disabled'}`);
      break;
    }

    case 'autoapprove':
    case 'auto': {
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
