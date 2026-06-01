import { SafetyLevel, SafetyAssessment, ToolCall } from '../types';

const HIGH_RISK_PATTERNS = [
  /rm\s+-rf?\s+[/~]/i,
  /rm\s+-rf?\s+\*/i,
  /dd\s+if=/i,
  /mkfs/i,
  /fdisk/i,
  /format\s+[a-z]:/i,
  /DROP\s+(TABLE|DATABASE|SCHEMA)/i,
  /TRUNCATE\s+TABLE/i,
  /DELETE\s+FROM\s+\w+\s*;/i,
  />(\/dev\/sda|\/dev\/nvme)/i,
  /shred\s+/i,
  /wipefs/i,
  /:(){ :|:& };:/,  // fork bomb
  /chmod\s+[0-7]{3,4}\s+\/(?!tmp|var\/tmp)/i,
  /chown\s+-R\s+.*\s+\//i,
  /sudo\s+rm\s+-rf\s*\//i,
];

const MEDIUM_RISK_PATTERNS = [
  /sudo\s+/i,
  /curl\s+.*\|\s*(ba)?sh/i,
  /wget\s+.*\|\s*(ba)?sh/i,
  /npm\s+install\s+-g/i,
  /pip\s+install/i,
  /apt(-get)?\s+install/i,
  /brew\s+install/i,
  /ssh\s+/i,
  /scp\s+/i,
  /rsync\s+/i,
  /git\s+push\s+.*--force/i,
  /git\s+reset\s+--hard/i,
  /rm\s+-rf?\s+node_modules/i,
  /rm\s+-rf?\s+\.git/i,
  /pkill|killall|kill\s+-9/i,
  /crontab\s+-/i,
  /systemctl\s+(start|stop|restart|enable|disable)/i,
  /service\s+\w+\s+(start|stop|restart)/i,
];

const LOW_RISK_PATTERNS = [
  /^(ls|dir|pwd|echo|cat|head|tail|grep|find|wc|sort|uniq|cut|awk|sed|tr)/,
  /^git\s+(status|log|diff|branch|show|describe)/,
  /^npm\s+(list|run|start|test|build)/,
  /^node\s+/,
  /^which\s+/,
  /^whereis\s+/,
  /^type\s+/,
  /^env(\s|$)/,
  /^printenv/,
  /^uname/,
  /^hostname/,
  /^whoami/,
  /^id(\s|$)/,
  /^date(\s|$)/,
];

export function assessSafety(tool: ToolCall): SafetyAssessment {
  if (tool.name === 'bash') {
    const command = (tool.input.command as string) || '';
    return assessCommand(command);
  }

  if (tool.name === 'write_file') {
    const path = (tool.input.path as string) || '';
    if (path.startsWith('/etc/') || path.startsWith('/sys/') || path.startsWith('/boot/')) {
      return { level: 'high', reason: 'Writing to system directory' };
    }
    if (path.startsWith('/usr/') || path.startsWith('/bin/') || path.startsWith('/sbin/')) {
      return { level: 'high', reason: 'Writing to system binary directory' };
    }
    return { level: 'low', reason: 'File write' };
  }

  if (tool.name === 'read_file' || tool.name === 'list_files' || tool.name === 'search_files') {
    const path = (tool.input.path as string) || '';
    if (path.includes('/.ssh/') || path.includes('/.gnupg/') || path.endsWith('.pem') || path.endsWith('.key')) {
      return { level: 'medium', reason: 'Reading sensitive credentials file' };
    }
    return { level: 'low', reason: 'Read-only operation' };
  }

  if (tool.name === 'git_command') {
    const args = (tool.input.args as string) || '';
    if (/push.*--force|reset.*--hard/.test(args)) {
      return { level: 'medium', reason: 'Destructive git operation' };
    }
    return { level: 'low', reason: 'Git operation' };
  }

  return { level: 'low', reason: 'Read/inspect operation' };
}

function assessCommand(command: string): SafetyAssessment {
  for (const pattern of HIGH_RISK_PATTERNS) {
    if (pattern.test(command)) {
      return { level: 'high', reason: 'Potentially destructive or irreversible command' };
    }
  }
  for (const pattern of MEDIUM_RISK_PATTERNS) {
    if (pattern.test(command)) {
      return { level: 'medium', reason: 'Requires elevated privileges or network access' };
    }
  }
  return { level: 'low', reason: 'Safe read-only or local operation' };
}

export function getRiskColor(level: SafetyLevel): string {
  const colors: Record<SafetyLevel, string> = {
    low: '#00ff9d',
    medium: '#ffb300',
    high: '#ff6b6b',
  };
  return colors[level];
}

export function getRiskLabel(level: SafetyLevel): string {
  const labels: Record<SafetyLevel, string> = {
    low: '✓ LOW RISK',
    medium: '⚠  MEDIUM RISK',
    high: '✕ HIGH RISK',
  };
  return labels[level];
}
