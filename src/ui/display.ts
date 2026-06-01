import chalk from 'chalk';
import boxen from 'boxen';
import Table from 'cli-table3';
import { marked } from 'marked';
import TerminalRenderer from 'marked-terminal';
import { SafetyLevel, ToolCall, SessionStats } from '../types';

// Colour tokens
export const C = {
  green:  chalk.hex('#00ff9d'),
  blue:   chalk.hex('#00c9ff'),
  purple: chalk.hex('#b36aff'),
  yellow: chalk.hex('#ffb300'),
  red:    chalk.hex('#ff6b6b'),
  dim:    chalk.hex('#555555'),
  dim2:   chalk.hex('#333333'),
  white:  chalk.white,
  bold:   chalk.bold,
};

// Configure marked
marked.setOptions({
  // @ts-ignore
  renderer: new TerminalRenderer({
    code: chalk.hex('#c9d1d9'),
    blockquote: chalk.hex('#555555').italic,
    heading: chalk.hex('#00ff9d').bold,
    firstHeading: chalk.hex('#00ff9d').bold,
    strong: chalk.bold,
    em: chalk.italic,
    link: chalk.hex('#00c9ff').underline,
    codespan: chalk.hex('#79c0ff'),
    paragraph: (text: string) => text + '\n',
    listitem: (text: string) => `  ${C.dim('▸')} ${text}\n`,
  }),
});

export function renderMarkdown(text: string): string {
  try {
    return marked(text) as string;
  } catch {
    return text;
  }
}

export function showToolCall(tool: ToolCall, dryRun: boolean): void {
  const icons: Record<string, string> = {
    bash: '⚡',
    read_file: '📖',
    write_file: '📝',
    list_files: '📁',
    search_files: '🔍',
    git_command: '🌿',
  };
  const icon = icons[tool.name] || '⚙';
  const label = dryRun ? C.yellow('[DRY RUN] ') : '';

  const args = tool.input as Record<string, string>;
  let detail = '';
  if (tool.name === 'bash' && args.command) {
    detail = C.dim('$ ') + chalk.hex('#c9d1d9')(args.command);
  } else if ((tool.name === 'write_file' || tool.name === 'read_file') && args.path) {
    detail = C.dim('path: ') + chalk.hex('#c9d1d9')(args.path);
  } else if (tool.name === 'git_command' && args.args) {
    detail = C.dim('git ') + chalk.hex('#c9d1d9')(args.args);
  } else {
    detail = C.dim(JSON.stringify(tool.input));
  }

  console.log(
    '\n  ' + label + chalk.hex('#00c9ff').bold(`${icon} ${tool.name.toUpperCase()}`) +
    '\n  ' + detail
  );
}

export function showSafetyWarning(level: SafetyLevel, reason: string): void {
  const colors: Record<SafetyLevel, string> = {
    low:    '#00ff9d',
    medium: '#ffb300',
    high:   '#ff6b6b',
  };
  const labels: Record<SafetyLevel, string> = {
    low:    '✓ LOW RISK',
    medium: '⚠  MEDIUM RISK',
    high:   '✕ HIGH RISK',
  };
  const color = colors[level];
  console.log(
    '  ' + chalk.hex(color).bold(labels[level]) +
    C.dim(' · ') + chalk.hex(color)(reason)
  );
}

export function showToolResult(output: string, isError: boolean): void {
  if (!output.trim()) return;
  const lines = output.trim().split('\n').slice(0, 20);
  const prefix = isError ? C.red('✕') : C.green('✓');
  const border = isError ? '#ff6b6b' : '#1a1a1a';

  const content = lines
    .map(l => '  ' + C.dim('│') + ' ' + chalk.hex('#8b949e')(l))
    .join('\n');

  console.log('\n  ' + prefix + ' Output:');
  console.log(content);
  if (output.trim().split('\n').length > 20) {
    console.log('  ' + C.dim(`  … (${output.trim().split('\n').length - 20} more lines)`));
  }
}

export function showSuccess(msg: string): void {
  console.log('  ' + C.green('✓') + ' ' + chalk.hex('#8b949e')(msg));
}

export function showError(msg: string): void {
  console.log('\n  ' + C.red('✕ Error: ') + chalk.hex('#ff6b6b')(msg) + '\n');
}

export function showInfo(msg: string): void {
  console.log('  ' + C.blue('ℹ') + ' ' + C.dim(msg));
}

export function showWarning(msg: string): void {
  console.log('  ' + C.yellow('⚠') + ' ' + chalk.hex('#ffb300')(msg));
}

export function showDivider(): void {
  console.log('\n  ' + C.dim2('─'.repeat(58)) + '\n');
}

export function showUsageStats(stats: SessionStats, inputTokens: number, outputTokens: number): void {
  const elapsed = Math.round((Date.now() - stats.startTime.getTime()) / 1000);
  const estimatedCost = ((inputTokens * 0.000003) + (outputTokens * 0.000015)).toFixed(4);
  console.log(
    '\n  ' + C.dim('tokens:') + ' ' + C.blue(`${inputTokens}↑ ${outputTokens}↓`) +
    C.dim('  cost:') + ' ' + C.yellow(`~$${estimatedCost}`) +
    C.dim('  time:') + ' ' + C.dim(`${elapsed}s`)
  );
}

export function showHelpTable(): void {
  console.log('\n' + C.green.bold('  OPEN CLI — Command Reference') + '\n');

  const sections: Array<{ title: string; items: Array<[string, string]> }> = [
    {
      title: 'REPL Commands',
      items: [
        ['/auth', 'Manage API keys and providers'],
        ['/model <name>', 'Switch AI model (claude-opus-4-5, gpt-4o, gemini-2.0-flash)'],
        ['/skill <name>', 'Activate a built-in skill (vuejs, gsap, php, etc.)'],
        ['/skills', 'List all available skills'],
        ['/profile <name>', 'Apply a saved profile'],
        ['/clear', 'Clear the terminal screen'],
        ['/history', 'Show conversation history'],
        ['/cost', 'Show session token usage & cost'],
        ['/reset', 'Clear conversation history'],
        ['/help', 'Show this help'],
        ['/exit', 'Exit Open CLI'],
      ],
    },
    {
      title: 'CLI Flags',
      items: [
        ['--model <name>', 'Override model for this session'],
        ['--skill <name>', 'Activate a skill for this session'],
        ['--yes / -y', 'Auto-approve low-risk commands'],
        ['--dry-run', 'Preview commands without executing'],
        ['--profile <name>', 'Use a named profile'],
        ['--show-cost', 'Display token usage after each response'],
        ['--no-color', 'Disable terminal colors'],
        ['--verbose', 'Show raw tool calls and responses'],
      ],
    },
  ];

  for (const section of sections) {
    console.log('  ' + C.blue.bold(section.title));
    const table = new Table({
      chars: {
        top: '', 'top-mid': '', 'top-left': '', 'top-right': '',
        bottom: '', 'bottom-mid': '', 'bottom-left': '', 'bottom-right': '',
        left: '', 'left-mid': '', mid: '', 'mid-mid': '',
        right: '', 'right-mid': '', middle: '  ',
      },
      style: { 'padding-left': 4, 'padding-right': 2, border: [] },
    });
    for (const [cmd, desc] of section.items) {
      table.push([C.green(cmd), C.dim(desc)]);
    }
    console.log(table.toString());
    console.log();
  }
}

export function showSkillsTable(skills: Array<{ id: string; name: string; description: string; icon: string; color: string }>): void {
  console.log('\n' + C.purple.bold('  Available Skills') + '\n');
  for (const skill of skills) {
    const active = skill.id === 'default';
    console.log(
      '  ' + chalk.hex(skill.color)(`${skill.icon} ${skill.name.padEnd(16)}`) +
      C.dim(skill.description)
    );
  }
  console.log();
  console.log('  ' + C.dim('Switch with: /skill <name>'));
  console.log();
}

export function animateThinking(): NodeJS.Timeout {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  process.stdout.write('\n  ');
  const timer = setInterval(() => {
    process.stdout.write(`\r  ${C.green(frames[i % frames.length])} ${C.dim('Thinking...')}`);
    i++;
  }, 80);
  return timer;
}

export function stopThinking(timer: NodeJS.Timeout): void {
  clearInterval(timer);
  process.stdout.write('\r' + ' '.repeat(30) + '\r');
}

export function printResponsePrefix(): void {
  process.stdout.write('\n  ' + C.green('╭') + C.dim('─ Response ') + C.dim('─'.repeat(48)) + '\n');
  process.stdout.write('  ' + C.green('│') + '\n');
}

export function printResponseSuffix(): void {
  process.stdout.write('\n  ' + C.green('╰') + C.dim('─'.repeat(58)) + '\n\n');
}

export function streamWrite(text: string): void {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) process.stdout.write('\n  ' + C.green('│') + ' ');
    process.stdout.write(lines[i]);
  }
}
