import { getDb } from './index';
import { UsageStatRow } from './types';

interface ModelPricing {
  inputPer1M: number;
  outputPer1M: number;
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  // Anthropic Claude
  'claude-opus':    { inputPer1M: 15.0,  outputPer1M: 75.0  },
  'claude-sonnet':  { inputPer1M: 3.0,   outputPer1M: 15.0  },
  'claude-haiku':   { inputPer1M: 0.25,  outputPer1M: 1.25  },
  // OpenAI
  'gpt-4o':         { inputPer1M: 5.0,   outputPer1M: 15.0  },
  'gpt-4o-mini':    { inputPer1M: 0.15,  outputPer1M: 0.6   },
  'gpt-4-turbo':    { inputPer1M: 10.0,  outputPer1M: 30.0  },
  'gpt-3.5-turbo':  { inputPer1M: 0.5,   outputPer1M: 1.5   },
  // Groq
  'groq':           { inputPer1M: 0.07,  outputPer1M: 0.08  },
  // Mistral
  'mistral-large':  { inputPer1M: 2.0,   outputPer1M: 6.0   },
  'mistral-small':  { inputPer1M: 0.2,   outputPer1M: 0.6   },
  // DeepSeek
  'deepseek':       { inputPer1M: 0.14,  outputPer1M: 0.28  },
};

function getPricing(model: string): ModelPricing {
  // Exact match first
  if (MODEL_PRICING[model]) return MODEL_PRICING[model];

  // Partial/prefix match for versioned model names (e.g. "claude-opus-4-5")
  for (const key of Object.keys(MODEL_PRICING)) {
    if (model.toLowerCase().includes(key.toLowerCase())) {
      return MODEL_PRICING[key];
    }
  }

  // Unknown model — return zero cost
  return { inputPer1M: 0, outputPer1M: 0 };
}

export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = getPricing(model);
  const inputCost = inputTokens * pricing.inputPer1M;
  const outputCost = outputTokens * pricing.outputPer1M;
  return (inputCost + outputCost) / 1_000_000;
}

export function recordUsage(params: {
  projectId: string | null;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}): void {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const existing = db
    .prepare(`
      SELECT id FROM usage_stats
      WHERE model = ?
        AND provider = ?
        AND date = ?
        AND (project_id IS ? OR (project_id IS NOT NULL AND project_id = ?))
    `)
    .get(
      params.model,
      params.provider,
      today,
      params.projectId,
      params.projectId
    ) as { id: number } | undefined;

  if (existing) {
    db.prepare(`
      UPDATE usage_stats
      SET input_tokens  = input_tokens  + ?,
          output_tokens = output_tokens + ?,
          cost_usd      = cost_usd      + ?
      WHERE id = ?
    `).run(params.inputTokens, params.outputTokens, params.costUsd, existing.id);
  } else {
    db.prepare(`
      INSERT INTO usage_stats
        (project_id, model, provider, input_tokens, output_tokens, cost_usd, date)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      params.projectId,
      params.model,
      params.provider,
      params.inputTokens,
      params.outputTokens,
      params.costUsd,
      today
    );
  }
}

export function getProjectUsage(projectId: string, days = 30): UsageStatRow[] {
  const db = getDb();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  return db
    .prepare(
      'SELECT * FROM usage_stats WHERE project_id = ? AND date >= ? ORDER BY date DESC'
    )
    .all(projectId, cutoff) as UsageStatRow[];
}

export function getAllUsage(days = 30): UsageStatRow[] {
  const db = getDb();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  return db
    .prepare('SELECT * FROM usage_stats WHERE date >= ? ORDER BY date DESC')
    .all(cutoff) as UsageStatRow[];
}
