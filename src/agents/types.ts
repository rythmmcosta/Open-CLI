export type AgentStatus = 'idle' | 'running' | 'paused' | 'error' | 'completed';
export type AgentTrigger = 'manual' | 'cron' | 'file_change' | 'http' | 'continuous';

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  type: AgentType;
  trigger: AgentTrigger;
  triggerConfig?: TriggerConfig;
  model: string;
  skill?: string;
  systemPrompt?: string;
  task: string;
  tools: string[];
  notifications: boolean;
  notifyOn?: Array<'start' | 'complete' | 'error' | 'output'>;
  maxIterations?: number;
  enabled: boolean;
  createdAt: string;
  lastRun?: string;
  nextRun?: string;
}

export type AgentType =
  | 'monitor'
  | 'code-reviewer'
  | 'test-runner'
  | 'deploy'
  | 'scraper'
  | 'build-watcher'
  | 'security-scanner'
  | 'performance-monitor'
  | 'git-guardian'
  | 'custom';

export interface TriggerConfig {
  cron?: string;
  watchPath?: string;
  watchPattern?: string;
  httpPort?: number;
  intervalSeconds?: number;
}

export interface AgentRun {
  id: string;
  agentId: string;
  startTime: string;
  endTime?: string;
  status: AgentStatus;
  output: string[];
  error?: string;
  tokensUsed?: number;
}

export interface AgentState {
  agents: AgentConfig[];
  runs: AgentRun[];
  daemonPid?: number;
}

export const BUILTIN_AGENT_TYPES: Record<AgentType, {
  name: string;
  description: string;
  defaultTask: string;
  defaultTools: string[];
  defaultSkill?: string;
  defaultTrigger: AgentTrigger;
}> = {
  monitor: {
    name: 'Monitor Agent',
    description: 'Watches files/URLs/processes and alerts on changes',
    defaultTask: 'Monitor the specified path for changes and report anything unusual or important.',
    defaultTools: ['bash', 'read_file', 'list_files'],
    defaultTrigger: 'file_change',
  },
  'code-reviewer': {
    name: 'Code Review Agent',
    description: 'Automatically reviews code changes and creates reports',
    defaultTask: 'Review the latest git diff for bugs, security issues, and code quality. Post a detailed review.',
    defaultTools: ['git_command', 'read_file', 'search_files', 'bash'],
    defaultSkill: 'git',
    defaultTrigger: 'file_change',
  },
  'test-runner': {
    name: 'Test Runner Agent',
    description: 'Runs tests automatically on code changes',
    defaultTask: 'Run the project test suite and report results. Fix obvious test failures if possible.',
    defaultTools: ['bash', 'read_file', 'write_file'],
    defaultTrigger: 'file_change',
  },
  deploy: {
    name: 'Deploy Agent',
    description: 'Automates deployment pipeline on git events',
    defaultTask: 'Check if the project is ready to deploy (tests pass, build succeeds) and deploy if so.',
    defaultTools: ['bash', 'git_command'],
    defaultSkill: 'git',
    defaultTrigger: 'manual',
  },
  scraper: {
    name: 'Web Scraper Agent',
    description: 'Scrapes websites on a schedule and extracts structured data',
    defaultTask: 'Scrape the target URL and extract relevant data. Save results to a JSON file.',
    defaultTools: ['browser_navigate', 'browser_extract', 'write_file'],
    defaultTrigger: 'cron',
  },
  'build-watcher': {
    name: 'Build Watcher Agent',
    description: 'Watches for build failures and notifies or auto-fixes',
    defaultTask: 'Run the build process and report any errors. Attempt to fix TypeScript/lint errors automatically.',
    defaultTools: ['bash', 'read_file', 'write_file', 'search_files'],
    defaultTrigger: 'file_change',
  },
  'security-scanner': {
    name: 'Security Scanner Agent',
    description: 'Scans code for security vulnerabilities on a schedule',
    defaultTask: 'Scan the codebase for security vulnerabilities: hardcoded secrets, SQL injection, XSS, outdated deps.',
    defaultTools: ['bash', 'search_files', 'read_file'],
    defaultSkill: 'git',
    defaultTrigger: 'cron',
  },
  'performance-monitor': {
    name: 'Performance Monitor',
    description: 'Monitors application performance metrics and alerts on regressions',
    defaultTask: 'Check application performance: response times, memory usage, CPU. Alert if thresholds exceeded.',
    defaultTools: ['bash', 'browser_navigate'],
    defaultTrigger: 'cron',
  },
  'git-guardian': {
    name: 'Git Guardian Agent',
    description: 'Protects branches, enforces commit conventions, auto-labels PRs',
    defaultTask: 'Check recent commits for convention compliance and the repo for protection rule violations.',
    defaultTools: ['git_command', 'bash'],
    defaultSkill: 'git',
    defaultTrigger: 'file_change',
  },
  custom: {
    name: 'Custom Agent',
    description: 'User-defined agent with custom task and triggers',
    defaultTask: 'Complete the assigned task using available tools.',
    defaultTools: ['bash', 'read_file', 'write_file', 'git_command'],
    defaultTrigger: 'manual',
  },
};
