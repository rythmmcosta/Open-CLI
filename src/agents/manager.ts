import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { AgentConfig, AgentRun, AgentState, AgentType, AgentTrigger, BUILTIN_AGENT_TYPES } from './types';

const STATE_DIR = path.join(os.homedir(), '.config', 'opencli', 'agents');
const STATE_FILE = path.join(STATE_DIR, 'state.json');
const LOGS_DIR = path.join(STATE_DIR, 'logs');

function ensureDirs(): void {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

export function loadState(): AgentState {
  ensureDirs();
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  } catch {
    return { agents: [], runs: [] };
  }
}

export function saveState(state: AgentState): void {
  ensureDirs();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

export function createAgent(
  name: string,
  type: AgentType,
  task: string,
  options: Partial<AgentConfig> = {}
): AgentConfig {
  const builtin = BUILTIN_AGENT_TYPES[type];
  const agent: AgentConfig = {
    id: uuidv4(),
    name,
    description: options.description || builtin.description,
    type,
    trigger: options.trigger || builtin.defaultTrigger,
    triggerConfig: options.triggerConfig,
    model: options.model || 'claude-opus-4-5',
    skill: options.skill || builtin.defaultSkill,
    systemPrompt: options.systemPrompt,
    task,
    tools: options.tools || builtin.defaultTools,
    notifications: options.notifications !== false,
    notifyOn: options.notifyOn || ['complete', 'error'],
    maxIterations: options.maxIterations || 10,
    enabled: true,
    createdAt: new Date().toISOString(),
  };

  const state = loadState();
  state.agents.push(agent);
  saveState(state);
  return agent;
}

export function listAgents(): AgentConfig[] {
  return loadState().agents;
}

export function getAgent(id: string): AgentConfig | undefined {
  return loadState().agents.find(a => a.id === id || a.name === id);
}

export function updateAgent(id: string, updates: Partial<AgentConfig>): boolean {
  const state = loadState();
  const idx = state.agents.findIndex(a => a.id === id);
  if (idx === -1) return false;
  state.agents[idx] = { ...state.agents[idx], ...updates };
  saveState(state);
  return true;
}

export function deleteAgent(id: string): boolean {
  const state = loadState();
  const len = state.agents.length;
  state.agents = state.agents.filter(a => a.id !== id && a.name !== id);
  saveState(state);
  return state.agents.length < len;
}

export function startRun(agentId: string): AgentRun {
  const run: AgentRun = {
    id: uuidv4(),
    agentId,
    startTime: new Date().toISOString(),
    status: 'running',
    output: [],
  };
  const state = loadState();
  state.runs.push(run);
  // Keep only last 50 runs
  if (state.runs.length > 50) state.runs = state.runs.slice(-50);
  saveState(state);
  return run;
}

export function updateRun(runId: string, updates: Partial<AgentRun>): void {
  const state = loadState();
  const idx = state.runs.findIndex(r => r.id === runId);
  if (idx !== -1) {
    state.runs[idx] = { ...state.runs[idx], ...updates };
    saveState(state);
  }
}

export function appendRunOutput(runId: string, line: string): void {
  const state = loadState();
  const run = state.runs.find(r => r.id === runId);
  if (run) {
    run.output.push(line);
    if (run.output.length > 500) run.output = run.output.slice(-500);
    saveState(state);
  }
  // Also write to log file
  const logFile = path.join(LOGS_DIR, `${runId}.log`);
  fs.appendFileSync(logFile, line + '\n');
}

export function getRecentRuns(agentId?: string, limit = 10): AgentRun[] {
  const state = loadState();
  const runs = agentId
    ? state.runs.filter(r => r.agentId === agentId)
    : state.runs;
  return runs.slice(-limit).reverse();
}

export function getLogPath(runId: string): string {
  return path.join(LOGS_DIR, `${runId}.log`);
}
