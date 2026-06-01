import chalk from 'chalk';
import figlet from 'figlet';
import gradient from 'gradient-string';
import boxen from 'boxen';
import { getConfig, getConfigPath } from '../config';

const NEON_GRADIENT = gradient(['#00ff9d', '#00c9ff', '#b36aff']);
const CYBER_GRADIENT = gradient(['#b36aff', '#00c9ff']);
export const C = {
  green:  chalk.hex('#00ff9d'),
  blue:   chalk.hex('#00c9ff'),
  purple: chalk.hex('#b36aff'),
  yellow: chalk.hex('#ffb300'),
  red:    chalk.hex('#ff6b6b'),
  dim:    chalk.hex('#555555'),
  dim2:   chalk.hex('#2a2a2a'),
  white:  chalk.white,
};

export function showBanner(): void {
  console.clear();

  const art = figlet.textSync('OPEN  CLI', { font: 'ANSI Shadow' });
  console.log(NEON_GRADIENT(art));

  console.log(
    '  ' + CYBER_GRADIENT('opencli.myowncloud.tech') +
    C.dim('  ·  v1.0.0  ·  Multi-model AI Terminal  ·  MIT')
  );
  console.log();

  const config = getConfig();
  const providers = config.providers;

  const providerStatus = [
    { name: 'Claude', key: 'anthropic' as const, color: '#00ff9d' },
    { name: 'GPT-4',  key: 'openai'    as const, color: '#00c9ff' },
    { name: 'Gemini', key: 'gemini'    as const, color: '#b36aff' },
    { name: 'Ollama', key: 'ollama'    as const, color: '#ffb300' },
  ];

  const statusParts = providerStatus.map(p => {
    const connected = p.key === 'ollama'
      ? !!(providers.ollama?.baseUrl)
      : !!(providers[p.key as 'anthropic' | 'openai' | 'gemini']?.apiKey);
    const dot = connected ? chalk.hex(p.color)('●') : chalk.hex('#2a2a2a')('○');
    const label = connected ? chalk.hex(p.color)(p.name) : chalk.hex('#444444')(p.name);
    return `${dot} ${label}`;
  });

  const skillName = config.activeSkill === 'default' ? 'general' : config.activeSkill;

  const boxContent = [
    '  ' + statusParts.join('   '),
    '',
    '  ' + C.dim('model:') + ' ' + C.green(config.defaultModel) +
    '  ' + C.dim('·') + '  ' + C.dim('skill:') + ' ' + C.purple('[' + skillName + ']') +
    '  ' + C.dim('·') + '  ' + C.dim('config:') + ' ' + C.dim(getConfigPath()),
  ].join('\n');

  const header = boxen(boxContent, {
    padding: { top: 0, bottom: 0, left: 1, right: 1 },
    borderStyle: 'round',
    borderColor: '#1e1e1e',
    dimBorder: true,
  });

  console.log(header);
  console.log();
  console.log(
    '  ' + C.dim('Type a prompt or use') + ' ' + C.green('/help') +
    C.dim('  ·  ') + C.blue('/auth') + C.dim(' providers  ·  ') +
    C.purple('/skill') + C.dim(' switch skill  ·  ') +
    chalk.hex('#ffb300')('/agent') + C.dim(' manage agents')
  );
  console.log();
}

export function showMini(): void {
  const config = getConfig();
  const skillName = config.activeSkill === 'default' ? 'general' : config.activeSkill;
  process.stdout.write(
    C.green.bold('⚡ opencli') + C.dim(' · ') +
    NEON_GRADIENT('opencli.myowncloud.tech') + C.dim(' · ') +
    C.dim('model:') + ' ' + C.blue(config.defaultModel) + C.dim(' · ') +
    C.dim('skill:') + ' ' + C.purple('[' + skillName + ']') + '\n\n'
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
