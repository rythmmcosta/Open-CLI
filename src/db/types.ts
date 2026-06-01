export interface ProjectRow {
  id: string;
  name: string;
  path: string;
  description: string | null;
  tech_stack: string | null;  // JSON string: string[]
  github_url: string | null;
  branch: string | null;
  default_model: string | null;
  default_skill: string | null;
  created_at: number;
  last_accessed: number;
  metadata: string | null;  // JSON
}

export interface SessionRow {
  id: string;
  project_id: string | null;
  model: string;
  skill: string;
  started_at: number;
  ended_at: number | null;
  msg_count: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

export interface MessageRow {
  id: number;
  session_id: string | null;
  project_id: string | null;
  role: string;
  content: string;
  tool_calls: string | null;  // JSON
  tokens: number | null;
  created_at: number;
}

export interface ToolCallLogRow {
  id: number;
  session_id: string | null;
  project_id: string | null;
  tool_name: string;
  input: string;   // JSON
  output: string;
  is_error: number;  // 0 or 1
  duration_ms: number | null;
  created_at: number;
}

export interface FileHistoryRow {
  id: number;
  project_id: string | null;
  session_id: string | null;
  file_path: string;
  content_before: string | null;
  content_after: string | null;
  created_at: number;
}

export interface GithubConnectionRow {
  id: string;
  project_id: string;
  owner: string;
  repo: string;
  url: string;
  branch: string;
  auto_push: number;  // 0 or 1
  created_at: number;
}

export interface UsageStatRow {
  id: number;
  project_id: string | null;
  model: string;
  provider: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  date: string;  // YYYY-MM-DD
}

export interface RecipeRow {
  id: string;
  name: string;
  description: string | null;
  steps: string;  // JSON: RecipeStep[]
  created_at: number;
  last_run: number | null;
  run_count: number;
}

export interface RecipeRunRow {
  id: string;
  recipe_id: string;
  started_at: number;
  completed_at: number | null;
  status: string;  // 'running'|'done'|'error'
  output: string | null;
  error: string | null;
}

export interface RecipeStep {
  order: number;
  prompt: string;
  skill?: string;
  model?: string;
}
