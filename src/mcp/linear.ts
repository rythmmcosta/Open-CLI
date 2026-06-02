import fetch from 'node-fetch';
import { ToolDef } from '../types';

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export const linearTools: ToolDef[] = [
  {
    name: 'linear_list_issues',
    description: 'List issues from Linear, optionally filtered by team.',
    inputSchema: {
      type: 'object',
      properties: {
        api_key: { type: 'string', description: 'Linear API key' },
        team_id: { type: 'string', description: 'Team ID to filter by (optional)' },
      },
      required: ['api_key'],
    },
  },
  {
    name: 'linear_create_issue',
    description: 'Create a new issue in Linear.',
    inputSchema: {
      type: 'object',
      properties: {
        title:       { type: 'string', description: 'Issue title' },
        description: { type: 'string', description: 'Issue description (markdown supported)' },
        team_id:     { type: 'string', description: 'Team ID to create the issue in' },
        api_key:     { type: 'string', description: 'Linear API key' },
      },
      required: ['title', 'team_id', 'api_key'],
    },
  },
  {
    name: 'linear_update_issue',
    description: 'Update an existing Linear issue.',
    inputSchema: {
      type: 'object',
      properties: {
        issue_id:    { type: 'string', description: 'Issue ID to update' },
        title:       { type: 'string', description: 'New title (optional)' },
        description: { type: 'string', description: 'New description (optional)' },
        state_id:    { type: 'string', description: 'New state ID (optional)' },
        api_key:     { type: 'string', description: 'Linear API key' },
      },
      required: ['issue_id', 'api_key'],
    },
  },
  {
    name: 'linear_list_teams',
    description: 'List all teams in the Linear workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        api_key: { type: 'string', description: 'Linear API key' },
      },
      required: ['api_key'],
    },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GRAPHQL_URL = 'https://api.linear.app/graphql';

async function linearQuery(apiKey: string, query: string, variables?: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      Authorization:  apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Linear API ${res.status}: ${text}`);
  const data = JSON.parse(text) as { data?: unknown; errors?: Array<{ message: string }> };
  if (data.errors && data.errors.length) throw new Error(`Linear GraphQL error: ${data.errors.map(e => e.message).join(', ')}`);
  return data.data;
}

// ---------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------

export async function executeLinearTool(
  name: string,
  input: Record<string, unknown>
): Promise<{ output: string; isError: boolean }> {
  try {
    const apiKey = input.api_key as string;

    // -----------------------------------------------------------------------
    if (name === 'linear_list_issues') {
      const teamId = input.team_id as string | undefined;
      const filter = teamId ? `, filter: { team: { id: { eq: "${teamId}" } } }` : '';
      const data = await linearQuery(apiKey, `{
        issues(first: 50${filter}) {
          nodes { id title state { name } priority assignee { name } createdAt updatedAt }
        }
      }`) as { issues: { nodes: Array<{ id: string; title: string; state: { name: string }; priority: number; assignee?: { name: string }; createdAt: string }> } };
      const nodes = data.issues.nodes;
      if (!nodes.length) return { output: 'No issues found.', isError: false };
      const lines = nodes.map(i =>
        `${i.id}  [${i.state.name}]  P${i.priority}  ${i.assignee ? i.assignee.name : 'unassigned'}  ${i.title}`
      );
      return { output: `Issues (${nodes.length}):\n\n${lines.join('\n')}`, isError: false };
    }

    // -----------------------------------------------------------------------
    if (name === 'linear_create_issue') {
      const title       = input.title       as string;
      const description = (input.description as string | undefined) || '';
      const teamId      = input.team_id     as string;
      const data = await linearQuery(apiKey,
        `mutation($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id title url } } }`,
        { input: { title, description, teamId } }
      ) as { issueCreate: { success: boolean; issue: { id: string; title: string; url: string } } };
      const issue = data.issueCreate.issue;
      return { output: `Issue created: ${issue.title}\nID: ${issue.id}\nURL: ${issue.url}`, isError: false };
    }

    // -----------------------------------------------------------------------
    if (name === 'linear_update_issue') {
      const issueId     = input.issue_id    as string;
      const updateInput: Record<string, unknown> = {};
      if (input.title)       updateInput.title       = input.title;
      if (input.description) updateInput.description = input.description;
      if (input.state_id)    updateInput.stateId     = input.state_id;
      const data = await linearQuery(apiKey,
        `mutation($id: String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input) { success issue { id title url } } }`,
        { id: issueId, input: updateInput }
      ) as { issueUpdate: { success: boolean; issue: { id: string; title: string; url: string } } };
      const issue = data.issueUpdate.issue;
      return { output: `Issue updated: ${issue.title}\nID: ${issue.id}\nURL: ${issue.url}`, isError: false };
    }

    // -----------------------------------------------------------------------
    if (name === 'linear_list_teams') {
      const data = await linearQuery(apiKey, `{ teams { nodes { id name key description } } }`) as {
        teams: { nodes: Array<{ id: string; name: string; key: string; description?: string }> };
      };
      const teams = data.teams.nodes;
      if (!teams.length) return { output: 'No teams found.', isError: false };
      const lines = teams.map(t => `${t.id}  [${t.key}]  ${t.name}${t.description ? `  — ${t.description}` : ''}`);
      return { output: `Teams (${teams.length}):\n\n${lines.join('\n')}`, isError: false };
    }

    return { output: `Unknown Linear tool: ${name}`, isError: true };
  } catch (err: unknown) {
    return { output: (err as Error).message, isError: true };
  }
}
