import chalk from 'chalk';
import Table from 'cli-table3';
import { marked } from 'marked';
import TerminalRenderer from 'marked-terminal';
import { SafetyLevel, ToolCall, SessionStats } from '../types';

export const C = {
  green:  chalk.hex('#00ff9d'),
  blue:   chalk.hex('#00c9ff'),
  purple: chalk.hex('#b36aff'),
  yellow: chalk.hex('#ffb300'),
  red:    chalk.hex('#ff6b6b'),
  dim:    chalk.hex('#555555'),
  dim2:   chalk.hex('#2a2a2a'),
  white:  chalk.white,
  bold:   chalk.bold,
};

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
  }),
});

export function renderMarkdown(text: string): string {
  try { return marked(text) as string; }
  catch { return text; }
}

export function showToolCall(tool: ToolCall, dryRun: boolean): void {
  const icons: Record<string, string> = {
    bash: '⚡', read_file: '📖', write_file: '📝', list_files: '📁',
    search_files: '🔍', git_command: '🌿', http_request: '🌐',
    db_query: '🗄️', db_schema: '🗄️',
    docker_list: '🐳', docker_logs: '🐳', docker_exec: '🐳', docker_compose: '🐳',
    web_search: '🔎', fetch_page: '📄',
    browser_navigate: '🌐', browser_screenshot: '📸', browser_click: '👆',
    browser_type: '⌨️', browser_scroll: '↕️', browser_verify: '✅',
    browser_extract: '🔬', browser_execute: '⚙️', browser_close: '🔒',
  };
  const icon = icons[tool.name] || '⚙';
  const label = dryRun ? C.yellow('[DRY RUN] ') : '';

  const args = tool.input as Record<string, string>;
  let detail = '';
  if (tool.name === 'bash' && args.command) detail = C.dim('$ ') + chalk.hex('#c9d1d9')(args.command);
  else if ((tool.name === 'write_file' || tool.name === 'read_file') && args.path) detail = C.dim('path: ') + chalk.hex('#c9d1d9')(args.path);
  else if (tool.name === 'git_command' && args.args) detail = C.dim('git ') + chalk.hex('#c9d1d9')(args.args);
  else if (tool.name === 'http_request') detail = C.dim((args.method || 'GET') + ' ') + chalk.hex('#00c9ff')(args.url);
  else if (tool.name === 'browser_navigate') detail = C.dim('→ ') + chalk.hex('#00c9ff')(args.url);
  else if (tool.name === 'web_search') detail = C.dim('🔎 ') + chalk.hex('#c9d1d9')(args.query);
  else detail = C.dim(JSON.stringify(tool.input).slice(0, 80));

  console.log('\n  ' + label + chalk.hex('#00c9ff').bold(`${icon} ${tool.name.toUpperCase()}`));
  if (detail) console.log('  ' + detail);
}

export function showSafetyWarning(level: SafetyLevel, reason: string): void {
  const colors: Record<SafetyLevel, string> = { low: '#00ff9d', medium: '#ffb300', high: '#ff6b6b' };
  const labels: Record<SafetyLevel, string> = {
    low: '✓ LOW RISK', medium: '⚠  MEDIUM RISK', high: '✕ HIGH RISK',
  };
  const color = colors[level];
  console.log('  ' + chalk.hex(color).bold(labels[level]) + C.dim(' · ') + chalk.hex(color)(reason));
}

export function showToolResult(output: string, isError: boolean): void {
  if (!output.trim()) return;
  const lines = output.trim().split('\n').slice(0, 30);
  const prefix = isError ? C.red('✕') : C.green('✓');
  console.log('\n  ' + prefix + ' Output:');
  lines.forEach(l => console.log('  ' + C.dim('│') + ' ' + chalk.hex('#8b949e')(l)));
  const total = output.trim().split('\n').length;
  if (total > 30) console.log('  ' + C.dim(`  … (${total - 30} more lines)`));
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
  console.log('\n  ' + C.dim('─'.repeat(60)) + '\n');
}

export function showUsageStats(stats: SessionStats, inputTokens: number, outputTokens: number): void {
  const elapsed = Math.round((Date.now() - stats.startTime.getTime()) / 1000);
  const cost = ((inputTokens * 0.000003) + (outputTokens * 0.000015)).toFixed(4);
  console.log(
    '\n  ' + C.dim('tokens:') + ' ' + C.blue(`${inputTokens}↑ ${outputTokens}↓`) +
    C.dim('  cost:') + ' ' + C.yellow(`~$${cost}`) +
    C.dim('  time:') + ' ' + C.dim(`${elapsed}s`)
  );
}

export function showHelpTable(): void {
  console.log('\n' + C.green.bold('  ⚡ OPEN CLI') + C.dim('  ·  opencli.myowncloud.tech') + '\n');

  const sections = [
    {
      title: 'Core',
      items: [
        ['/auth', 'Manage API keys and providers (Claude, GPT, Gemini, Ollama)'],
        ['/model <name>', 'Switch AI model'],
        ['/skill <name>', 'Activate a built-in skill'],
        ['/skills', 'List all 20 built-in skills'],
        ['/profile <name>', 'Apply a saved config profile'],
        ['/clear', 'Clear terminal screen'],
        ['/history', 'Show conversation history'],
        ['/cost', 'Show session token usage and cost'],
        ['/reset', 'Clear conversation history'],
        ['/help', 'Show this help'],
        ['/exit', 'Exit Open CLI'],
      ],
    },
    {
      title: 'Browser Automation (Playwright Eyes)',
      items: [
        ['/browser install', 'Install Playwright browsers (one-time setup)'],
        ['/browser screenshot <url>', 'Screenshot a URL'],
        ['/skill browser-automation', 'Enable AI browser assistant mode'],
      ],
    },
    {
      title: 'Agent System',
      items: [
        ['/agent list', 'List all configured agents'],
        ['/agent types', 'Show all agent types'],
        ['/agent create', 'Create a new agent interactively'],
        ['/agent run <name>', 'Run an agent now (foreground)'],
        ['/agent background <name>', 'Run agent as background process'],
        ['/agent enable/disable <n>', 'Toggle agent on/off'],
        ['/agent delete <name>', 'Delete an agent'],
      ],
    },
    {
      title: 'Notifications',
      items: [
        ['/notify setup', 'Configure Telegram and/or Discord'],
        ['/notify test', 'Send a test notification'],
        ['/notify send <msg>', 'Send a custom notification'],
      ],
    },
    {
      title: 'MCP Servers',
      items: [
        ['/mcp list', 'List all built-in MCP servers'],
      ],
    },
  ];

  for (const section of sections) {
    console.log('  ' + C.blue.bold(section.title));
    const table = new Table({
      chars: { top: '', 'top-mid': '', 'top-left': '', 'top-right': '', bottom: '', 'bottom-mid': '', 'bottom-left': '', 'bottom-right': '', left: '', 'left-mid': '', mid: '', 'mid-mid': '', right: '', 'right-mid': '', middle: '  ' },
      style: { 'padding-left': 4, 'padding-right': 2, border: [] },
    });
    for (const [cmd, desc] of section.items) table.push([C.green(cmd), C.dim(desc)]);
    console.log(table.toString());
    console.log();
  }
}

export function showSkillsTable(skills: Array<{ id: string; name: string; description: string; icon: string; color: string }>): void {
  console.log('\n' + C.purple.bold('  🎯 Built-in Skills') + C.dim('  — /skill <name> to activate') + '\n');
  for (const skill of skills) {
    console.log(
      '  ' + chalk.hex(skill.color)(`${skill.icon} ${skill.name.padEnd(20)}`) +
      C.dim(skill.description)
    );
  }
  console.log();
}

export function animateThinking(): NodeJS.Timeout {
  const frames = ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏'];
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
  process.stdout.write('\n  ' + C.green('╭') + C.dim('─ Response ') + C.dim('─'.repeat(46)) + '\n');
  process.stdout.write('  ' + C.green('│') + '\n');
}

export function printResponseSuffix(): void {
  process.stdout.write('\n  ' + C.green('╰') + C.dim('─'.repeat(57)) + '\n\n');
}

export function streamWrite(text: string): void {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) process.stdout.write('\n  ' + C.green('│') + ' ');
    process.stdout.write(lines[i]);
  }
}
