import * as child_process from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { AgentConfig, AgentRun } from './types';
import { loadState, updateAgent, startRun, updateRun, appendRunOutput, getAgent } from './manager';
import { getConfig } from '../config';
import { getSkill } from '../skills';
import { getProvider } from '../core/router';
import { ConversationContext } from '../core/context';
import { ALL_TOOLS } from '../tools';
import { ALL_BROWSER_TOOLS } from '../browser/tools';
import { executeTool } from '../tools';
import { executeBrowserTool } from '../browser/tools';
import { sendNotification } from '../notifications';
import { ToolDef } from '../types';

const DAEMON_PID_FILE = path.join(os.homedir(), '.config', 'opencli', 'agents', 'daemon.pid');

export async function runAgentOnce(agentId: string): Promise<AgentRun> {
  const agent = getAgent(agentId);
  if (!agent) throw new Error(`Agent "${agentId}" not found`);

  const run = startRun(agent.id);

  const log = (msg: string) => {
    appendRunOutput(run.id, `[${new Date().toISOString()}] ${msg}`);
  };

  log(`Starting agent: ${agent.name}`);
  updateAgent(agent.id, { lastRun: new Date().toISOString() });

  if (agent.notifications && agent.notifyOn?.includes('start')) {
    await sendNotification(`Agent "${agent.name}" started`, {
      title: 'Agent Started',
      level: 'info',
      metadata: { 'Agent': agent.name, 'Type': agent.type, 'Model': agent.model },
    });
  }

  try {
    const config = getConfig();
    config.defaultModel = agent.model;
    if (agent.skill) config.activeSkill = agent.skill;

    const skill = getSkill(agent.skill || 'default');
    let systemPrompt = agent.systemPrompt || skill.systemPrompt;
    systemPrompt += '\n\nYou are running as an automated background agent. Be concise and action-oriented.';

    const provider = getProvider(agent.model, config);
    const context = new ConversationContext(20);
    context.addUserMessage(agent.task);

    const agentTools: ToolDef[] = [
      ...ALL_TOOLS,
      ...ALL_BROWSER_TOOLS,
    ].filter(t => agent.tools.includes(t.name));

    let iteration = 0;
    const maxIter = agent.maxIterations || 10;
    let messages = context.getMessages();

    while (iteration < maxIter) {
      iteration++;
      log(`Iteration ${iteration}/${maxIter}`);

      const response = await provider.chat({
        model: agent.model,
        messages,
        system: systemPrompt,
        tools: agentTools,
        maxTokens: 4096,
      });

      if (response.text) {
        log(`Response: ${response.text.slice(0, 500)}`);
        if (agent.notifications && agent.notifyOn?.includes('output') && response.text.trim()) {
          await sendNotification(response.text.slice(0, 1000), {
            title: `Agent "${agent.name}" output`,
            level: 'info',
            metadata: { iteration: String(iteration) },
          });
        }
      }

      const rawContent = response.rawContent || (response.text ? [{ type: 'text' as const, text: response.text }] : []);
      context.addAssistantMessage(rawContent);

      if (response.stopReason !== 'tool_use' || response.toolCalls.length === 0) break;

      const toolResults = [];
      for (const toolCall of response.toolCalls) {
        log(`Tool: ${toolCall.name}(${JSON.stringify(toolCall.input).slice(0, 100)})`);
        let result: { output: string; isError: boolean };
        if (toolCall.name.startsWith('browser_')) {
          result = await executeBrowserTool(toolCall.name, toolCall.input);
        } else {
          result = await executeTool(toolCall.name, toolCall.input, false);
        }
        log(`Result: ${result.output.slice(0, 200)}`);
        toolResults.push({ toolUseId: toolCall.id, content: result.output, isError: result.isError });
      }

      context.addToolResults(toolResults);
      messages = context.getMessages();
    }

    const finalOutput = run.output.join('\n');
    updateRun(run.id, {
      status: 'completed',
      endTime: new Date().toISOString(),
      tokensUsed: context.stats.totalInputTokens + context.stats.totalOutputTokens,
    });
    log('Agent completed successfully');

    if (agent.notifications && agent.notifyOn?.includes('complete')) {
      await sendNotification(`Agent "${agent.name}" completed`, {
        title: '✅ Agent Completed',
        level: 'success',
        metadata: {
          'Agent': agent.name,
          'Duration': calculateDuration(run.startTime),
          'Tokens': String(context.stats.totalInputTokens + context.stats.totalOutputTokens),
        },
      });
    }

  } catch (err: unknown) {
    const msg = (err as Error).message;
    log(`ERROR: ${msg}`);
    updateRun(run.id, { status: 'error', endTime: new Date().toISOString(), error: msg });

    if (agent.notifications && agent.notifyOn?.includes('error')) {
      await sendNotification(`Agent "${agent.name}" failed: ${msg}`, {
        title: '❌ Agent Error',
        level: 'error',
        metadata: { 'Agent': agent.name, 'Error': msg.slice(0, 200) },
      });
    }
  }

  return { ...run, status: 'completed' };
}

export function spawnAgentBackground(agentId: string): number {
  const script = `
    const { runAgentOnce } = require(${JSON.stringify(path.join(__dirname, 'runner'))});
    runAgentOnce(${JSON.stringify(agentId)}).catch(console.error).finally(() => process.exit(0));
  `;
  const tmpFile = path.join(os.tmpdir(), `opencli-agent-${agentId}-${Date.now()}.js`);
  fs.writeFileSync(tmpFile, script);

  const child = child_process.spawn(process.execPath, [tmpFile], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env },
  });
  child.unref();
  fs.unlinkSync(tmpFile);
  return child.pid || 0;
}

function calculateDuration(startTime: string): string {
  const ms = Date.now() - new Date(startTime).getTime();
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}
