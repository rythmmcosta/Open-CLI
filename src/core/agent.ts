import chalk from 'chalk';
import inquirer from 'inquirer';
import { getProvider } from './router';
import { assessSafety } from './safety';
import { ConversationContext } from './context';
import { executeTool, ALL_TOOLS } from '../tools';
import { getSkill } from '../skills';
import {
  showToolCall,
  showSafetyWarning,
  showToolResult,
  showError,
  animateThinking,
  stopThinking,
  printResponsePrefix,
  printResponseSuffix,
  streamWrite,
  renderMarkdown,
  C,
} from '../ui/display';
import { AppConfig, MessageContent } from '../types';

// DB persistence — lazy-loaded, fails gracefully if SQLite unavailable
let dbEnabled = true;
function tryDb<T>(fn: () => T): T | null {
  if (!dbEnabled) return null;
  try { return fn(); }
  catch { dbEnabled = false; return null; }
}

const MAX_TOOL_ITERATIONS = 15;

export interface AgentOptions {
  verbose?: boolean;
  pipeInput?: string;
}

export async function runAgent(
  query: string,
  context: ConversationContext,
  config: AppConfig,
  options: AgentOptions = {}
): Promise<void> {
  const { verbose = false, pipeInput } = options;
  const model = config.defaultModel;
  const skill = getSkill(config.activeSkill);

  let systemPrompt = skill.systemPrompt;
  if (pipeInput) {
    systemPrompt += `\n\nThe user has piped the following input:\n\`\`\`\n${pipeInput}\n\`\`\``;
  }

  const provider = getProvider(model, config);

  // ── DB: init project + session ────────────────────────────────────────────
  let sessionId: string | null = null;
  let projectId: string | null = null;
  tryDb(() => {
    const { upsertProject } = require('../db/projects');
    const { createSession } = require('../db/sessions');
    const project = upsertProject(process.cwd());
    projectId = project.id;
    sessionId = createSession(project.id, model, config.activeSkill);
  });

  context.addUserMessage(query);

  // ── DB: save user message ─────────────────────────────────────────────────
  tryDb(() => {
    const { saveMessage } = require('../db/messages');
    saveMessage({ sessionId, projectId, role: 'user', content: query });
  });

  let messages = context.getMessages();
  let iteration = 0;

  while (iteration < MAX_TOOL_ITERATIONS) {
    iteration++;

    const thinkTimer = animateThinking();
    let firstToken = true;
    let responseText = '';

    const response = await provider.chat({
      model,
      messages,
      system: systemPrompt,
      tools: ALL_TOOLS,
      maxTokens: 8096,
      onText: (text: string) => {
        if (firstToken) {
          stopThinking(thinkTimer);
          printResponsePrefix();
          firstToken = false;
        }
        streamWrite(text);
        responseText += text;
      },
    });

    if (firstToken) {
      stopThinking(thinkTimer);
    }

    if (response.usage) {
      context.updateUsage(response.usage.inputTokens, response.usage.outputTokens);

      // ── DB: record usage stats ──────────────────────────────────────────
      tryDb(() => {
        const { recordUsage, estimateCost } = require('../db/usage');
        const cost = estimateCost(model, response.usage!.inputTokens, response.usage!.outputTokens);
        recordUsage({
          projectId,
          model,
          provider: model.split('-')[0],
          inputTokens: response.usage!.inputTokens,
          outputTokens: response.usage!.outputTokens,
          costUsd: cost,
        });
      });
    }

    if (response.text && !firstToken) {
      printResponseSuffix();
    } else if (response.text) {
      printResponsePrefix();
      process.stdout.write('\n  ' + C.green('│') + ' ');
      const rendered = renderMarkdown(response.text);
      const lines = rendered.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (i > 0) process.stdout.write('\n  ' + C.green('│') + ' ');
        process.stdout.write(lines[i]);
      }
      printResponseSuffix();
    }

    // ── DB: save assistant message ────────────────────────────────────────
    if (response.text) {
      tryDb(() => {
        const { saveMessage } = require('../db/messages');
        saveMessage({ sessionId, projectId, role: 'assistant', content: response.text });
      });
    }

    const rawContent = response.rawContent || (
      response.text
        ? [{ type: 'text' as const, text: response.text }]
        : []
    );
    context.addAssistantMessage(rawContent as MessageContent[]);

    if (response.stopReason !== 'tool_use' || response.toolCalls.length === 0) {
      break;
    }

    const toolResults: Array<{ toolUseId: string; content: string; isError?: boolean }> = [];

    for (const toolCall of response.toolCalls) {
      showToolCall(toolCall, config.dryRun);

      const safety = assessSafety(toolCall);

      const shouldPrompt = (
        !config.autoApprove ||
        safety.level === 'high' ||
        safety.level === 'medium'
      ) && !(config.dryRun && safety.level === 'low');

      if (shouldPrompt) {
        showSafetyWarning(safety.level, safety.reason);

        if (safety.level === 'high') {
          const { confirm } = await inquirer.prompt([{
            type: 'input',
            name: 'confirm',
            message: chalk.hex('#ff6b6b').bold('HIGH RISK: Type "yes" to confirm or press Enter to skip:'),
          }]);
          if (confirm.toLowerCase() !== 'yes') {
            toolResults.push({ toolUseId: toolCall.id, content: 'User rejected this action.', isError: false });
            continue;
          }
        } else {
          const { approved } = await inquirer.prompt([{
            type: 'confirm',
            name: 'approved',
            message: chalk.hex('#ffb300')('Execute this command?'),
            default: true,
          }]);
          if (!approved) {
            toolResults.push({ toolUseId: toolCall.id, content: 'User rejected this action.', isError: false });
            continue;
          }
        }
      }

      if (verbose) {
        console.log(C.dim(`  [Tool input]: ${JSON.stringify(toolCall.input)}`));
      }

      const startMs = Date.now();
      const result = await executeTool(toolCall.name, toolCall.input, config.dryRun);
      const durationMs = Date.now() - startMs;

      showToolResult(result.output, result.isError);

      // ── DB: log tool call ───────────────────────────────────────────────
      tryDb(() => {
        const { logToolCall } = require('../db/tool-log');
        logToolCall({
          sessionId,
          projectId,
          toolName: toolCall.name,
          input: toolCall.input,
          output: result.output.slice(0, 2000),
          isError: result.isError,
          durationMs,
        });
      });

      toolResults.push({
        toolUseId: toolCall.id,
        content: result.output,
        isError: result.isError,
      });
    }

    context.addToolResults(toolResults);
    messages = context.getMessages();
  }

  if (iteration >= MAX_TOOL_ITERATIONS) {
    showError('Reached maximum tool iterations. Stopping agent loop.');
  }

  // ── DB: close session ─────────────────────────────────────────────────────
  tryDb(() => {
    if (!sessionId) return;
    const { closeSession } = require('../db/sessions');
    closeSession(sessionId, {
      inputTokens: context.stats.totalInputTokens,
      outputTokens: context.stats.totalOutputTokens,
      costUsd: 0,
    });
  });
}
