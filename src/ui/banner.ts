import chalk from 'chalk';
import figlet from 'figlet';
import gradient from 'gradient-string';
import boxen from 'boxen';
import { getConfig, getConfigPath } from '../config';

const NEON_GRADIENT = gradient(['#00ff9d', '#00c9ff', '#b36aff']);
const CYAN = chalk.hex('#00c9ff');
const GREEN = chalk.hex('#00ff9d');
const PURPLE = chalk.hex('#b36aff');
const DIM = chalk.hex('#555555');
const WHITE = chalk.white;

export function showBanner(): void {
  console.clear();

  const art = figlet.textSync('OPEN  CLI', {
    font: 'ANSI Shadow',
    horizontalLayout: 'default',
  });

  console.log(NEON_GRADIENT(art));
  console.log();

  const config = getConfig();
  const providers = config.providers;

  const providerStatus = [
    { name: 'Claude', key: 'anthropic' as const, color: '#00ff9d' },
    { name: 'GPT-4', key: 'openai' as const, color: '#00c9ff' },
    { name: 'Gemini', key: 'gemini' as const, color: '#b36aff' },
    { name: 'Ollama', key: 'ollama' as const, color: '#ffb300' },
  ];

  const statusParts = providerStatus.map(p => {
    const connected = p.key === 'ollama'
      ? !!(providers.ollama?.baseUrl)
      : !!(providers[p.key as 'anthropic' | 'openai' | 'gemini']?.apiKey);
    const dot = connected ? chalk.hex(p.color)('●') : chalk.hex('#333333')('○');
    const label = connected ? chalk.hex(p.color)(p.name) : chalk.hex('#444444')(p.name);
    return `${dot} ${label}`;
  });

  const skillName = config.activeSkill === 'default' ? 'general' : config.activeSkill;
  const modelShort = config.defaultModel.replace('claude-', '').replace('-', ' ');

  const infoLine = [
    DIM('model:') + ' ' + GREEN(config.defaultModel),
    DIM('skill:') + ' ' + PURPLE('[' + skillName + ']'),
    DIM('config:') + ' ' + DIM(getConfigPath()),
  ].join('  ' + DIM('·') + '  ');

  const header = boxen(
    [
      WHITE.bold('  The intelligent terminal for developers  '),
      '',
      '  ' + statusParts.join('   '),
      '',
      '  ' + infoLine,
    ].join('\n'),
    {
      padding: { top: 0, bottom: 0, left: 1, right: 1 },
      borderStyle: 'round',
      borderColor: '#1a1a1a',
      dimBorder: true,
    }
  );

  console.log(header);
  console.log();
  console.log(
    '  ' + DIM('Type a prompt to start, or use') + ' ' +
    GREEN('/help') + ' ' + DIM('for commands,') + ' ' +
    CYAN('/auth') + ' ' + DIM('to connect providers.')
  );
  console.log();
}

export function showMini(): void {
  const config = getConfig();
  const skillName = config.activeSkill === 'default' ? 'general' : config.activeSkill;
  process.stdout.write(
    GREEN.bold('⚡ opencli') + ' ' +
    DIM('v1.0.0') + ' · ' +
    DIM('model:') + ' ' + CYAN(config.defaultModel) + ' · ' +
    DIM('skill:') + ' ' + PURPLE('[' + skillName + ']') + '\n\n'
  );
}

export function getPromptString(model: string, skill: string): string {
  const skillLabel = skill === 'default' ? '' : chalk.hex('#b36aff')(` [${skill}]`);
  return (
    chalk.hex('#00ff9d').bold('opencli') +
    skillLabel +
    chalk.hex('#555555')(' ❯ ')
  );
}
