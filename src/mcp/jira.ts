import fetch from 'node-fetch';
import { ToolDef } from '../types';

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export const jiraTools: ToolDef[] = [
  {
    name: 'jira_list_issues',
    description: 'List issues in a Jira project, optionally filtered with a JQL query.',
    inputSchema: {
      type: 'object',
      properties: {
        baseUrl:    { type: 'string', description: 'Jira instance URL, e.g. https://mycompany.atlassian.net (falls back to JIRA_BASE_URL env)' },
        email:      { type: 'string', description: 'Jira account email (falls back to JIRA_EMAIL env)' },
        apiToken:   { type: 'string', description: 'Jira API token (falls back to JIRA_API_TOKEN env)' },
        projectKey: { type: 'string', description: 'Jira project key, e.g. PROJ' },
        maxResults: { type: 'number', description: 'Maximum number of issues to return (default: 20)' },
        jql:        { type: 'string', description: 'Additional JQL filter appended to the project query, e.g. "status=Open"' },
      },
      required: ['projectKey'],
    },
  },
  {
    name: 'jira_create_issue',
    description: 'Create a new issue in a Jira project.',
    inputSchema: {
      type: 'object',
      properties: {
        baseUrl:     { type: 'string', description: 'Jira instance URL' },
        email:       { type: 'string', description: 'Jira account email' },
        apiToken:    { type: 'string', description: 'Jira API token' },
        projectKey:  { type: 'string', description: 'Project key' },
        summary:     { type: 'string', description: 'Issue summary (title)' },
        description: { type: 'string', description: 'Issue description (plain text)' },
        issueType:   { type: 'string', description: "Issue type name, e.g. 'Task', 'Bug', 'Story' (default: 'Task')" },
      },
      required: ['projectKey', 'summary'],
    },
  },
  {
    name: 'jira_update_issue',
    description: 'Update fields (summary, description) of an existing Jira issue.',
    inputSchema: {
      type: 'object',
      properties: {
        baseUrl:  { type: 'string', description: 'Jira instance URL' },
        email:    { type: 'string', description: 'Jira account email' },
        apiToken: { type: 'string', description: 'Jira API token' },
        issueKey: { type: 'string', description: 'Issue key, e.g. PROJ-123' },
        updates:  {
          type: 'object',
          description: 'Fields to update — supported: summary (string), description (string)',
        },
      },
      required: ['issueKey', 'updates'],
    },
  },
  {
    name: 'jira_add_comment',
    description: 'Add a comment to an existing Jira issue.',
    inputSchema: {
      type: 'object',
      properties: {
        baseUrl:  { type: 'string', description: 'Jira instance URL' },
        email:    { type: 'string', description: 'Jira account email' },
        apiToken: { type: 'string', description: 'Jira API token' },
        issueKey: { type: 'string', description: 'Issue key, e.g. PROJ-123' },
        comment:  { type: 'string', description: 'Comment body text' },
      },
      required: ['issueKey', 'comment'],
    },
  },
  {
    name: 'jira_get_issue',
    description: 'Get full details of a single Jira issue.',
    inputSchema: {
      type: 'object',
      properties: {
        baseUrl:  { type: 'string', description: 'Jira instance URL' },
        email:    { type: 'string', description: 'Jira account email' },
        apiToken: { type: 'string', description: 'Jira API token' },
        issueKey: { type: 'string', description: 'Issue key, e.g. PROJ-123' },
      },
      required: ['issueKey'],
    },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface JiraCredentials {
  baseUrl: string;
  authHeader: string;
}

function getCredentials(input: Record<string, unknown>): JiraCredentials {
  const baseUrl  = (input.baseUrl  as string | undefined) || process.env.JIRA_BASE_URL  || '';
  const email    = (input.email    as string | undefined) || process.env.JIRA_EMAIL     || '';
  const apiToken = (input.apiToken as string | undefined) || process.env.JIRA_API_TOKEN || '';

  if (!baseUrl)  throw new Error('Jira baseUrl is required (set JIRA_BASE_URL or pass baseUrl).');
  if (!email)    throw new Error('Jira email is required (set JIRA_EMAIL or pass email).');
  if (!apiToken) throw new Error('Jira apiToken is required (set JIRA_API_TOKEN or pass apiToken).');

  const authHeader = 'Basic ' + Buffer.from(`${email}:${apiToken}`).toString('base64');
  return { baseUrl: baseUrl.replace(/\/$/, ''), authHeader };
}

async function jiraRequest(
  method: string,
  creds: JiraCredentials,
  endpoint: string,
  body?: Record<string, unknown>
): Promise<unknown> {
  const url     = `${creds.baseUrl}/rest/api/3${endpoint}`;
  const headers: Record<string, string> = {
    Authorization: creds.authHeader,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  const res = await fetch(url, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (res.status === 204) return {};   // no content — success

  const data = await res.json() as unknown;
  if (!res.ok) {
    const errData = data as { errorMessages?: string[]; errors?: Record<string, string> };
    const msgs = [
      ...(errData.errorMessages || []),
      ...Object.values(errData.errors || {}),
    ];
    throw new Error(`Jira API ${res.status}: ${msgs.join('; ') || res.statusText}`);
  }
  return data;
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

/** Convert plain text to Jira's ADF (Atlassian Document Format) paragraph. */
function textToAdf(text: string): Record<string, unknown> {
  return {
    type: 'doc',
    version: 1,
    content: text.split('\n\n').map(para => ({
      type: 'paragraph',
      content: [{ type: 'text', text: para.replace(/\n/g, ' ') }],
    })),
  };
}

/** Extract plain text from an ADF document (best-effort). */
function adfToText(adf: unknown): string {
  if (!adf || typeof adf !== 'object') return String(adf ?? '');
  const node = adf as { type?: string; text?: string; content?: unknown[] };
  if (node.text) return node.text;
  if (!node.content) return '';
  return node.content.map(adfToText).join(node.type === 'paragraph' ? '\n' : '');
}

// ---------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------

type JiraIssue = {
  id: string; key: string;
  fields: {
    summary: string;
    status: { name: string };
    assignee: { displayName: string } | null;
    reporter: { displayName: string } | null;
    priority: { name: string } | null;
    issuetype: { name: string };
    created: string;
    updated: string;
    description: unknown;
    comment?: { comments: Array<{ author: { displayName: string }; created: string; body: unknown }> };
    labels?: string[];
  };
};

export async function executeJiraTool(
  name: string,
  input: Record<string, unknown>
): Promise<{ output: string; isError: boolean }> {
  try {
    const creds = getCredentials(input);

    // -----------------------------------------------------------------------
    if (name === 'jira_list_issues') {
      const projectKey = input.projectKey as string;
      const maxResults = (input.maxResults as number | undefined) ?? 20;
      const extra      = (input.jql        as string | undefined) || '';
      const jql        = extra
        ? `project = "${projectKey}" AND ${extra} ORDER BY updated DESC`
        : `project = "${projectKey}" ORDER BY updated DESC`;

      const data = await jiraRequest('GET', creds, `/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}&fields=summary,status,assignee,priority,issuetype,updated`) as {
        issues: JiraIssue[]; total: number;
      };

      if (!data.issues.length) return { output: `No issues found in project ${projectKey}.`, isError: false };

      const lines = data.issues.map((iss, i) => {
        const f       = iss.fields;
        const status  = f.status?.name    || '?';
        const type    = f.issuetype?.name || '?';
        const assign  = f.assignee?.displayName || 'Unassigned';
        const updated = (f.updated || '').slice(0, 10);
        return [
          `${String(i + 1).padStart(3)}. ${pad(iss.key, 14)} ${pad(type, 10)} ${pad(status, 16)} ${pad(assign, 22)} ${updated}`,
          `      ${f.summary}`,
        ].join('\n');
      });

      return {
        output: `Issues in ${projectKey} (showing ${data.issues.length} of ${data.total}):\n\n${lines.join('\n\n')}`,
        isError: false,
      };
    }

    // -----------------------------------------------------------------------
    if (name === 'jira_create_issue') {
      const projectKey  = input.projectKey  as string;
      const summary     = input.summary     as string;
      const description = (input.description as string | undefined) || '';
      const issueType   = (input.issueType   as string | undefined) || 'Task';

      const body: Record<string, unknown> = {
        fields: {
          project:   { key: projectKey },
          summary,
          issuetype: { name: issueType },
          ...(description ? { description: textToAdf(description) } : {}),
        },
      };

      const result = await jiraRequest('POST', creds, '/issue', body) as { id: string; key: string; self: string };
      return {
        output: [
          `Issue created: ${result.key}`,
          `  Type    : ${issueType}`,
          `  Summary : ${summary}`,
          `  URL     : ${creds.baseUrl}/browse/${result.key}`,
        ].join('\n'),
        isError: false,
      };
    }

    // -----------------------------------------------------------------------
    if (name === 'jira_update_issue') {
      const issueKey = input.issueKey as string;
      const updates  = input.updates  as { summary?: string; description?: string };

      const fields: Record<string, unknown> = {};
      if (updates.summary)     fields.summary     = updates.summary;
      if (updates.description) fields.description = textToAdf(updates.description);

      if (!Object.keys(fields).length) {
        return { output: 'No supported update fields provided (summary, description).', isError: true };
      }

      await jiraRequest('PUT', creds, `/issue/${issueKey}`, { fields });
      const changed = Object.keys(fields).join(', ');
      return {
        output: `Issue ${issueKey} updated.\n  Changed: ${changed}\n  URL: ${creds.baseUrl}/browse/${issueKey}`,
        isError: false,
      };
    }

    // -----------------------------------------------------------------------
    if (name === 'jira_add_comment') {
      const issueKey = input.issueKey as string;
      const comment  = input.comment  as string;

      const body = {
        body: textToAdf(comment),
      };

      const result = await jiraRequest('POST', creds, `/issue/${issueKey}/comment`, body) as { id: string };
      return {
        output: [
          `Comment added to ${issueKey}.`,
          `  Comment ID : ${result.id}`,
          `  URL        : ${creds.baseUrl}/browse/${issueKey}`,
          `  Preview    : ${comment.slice(0, 120)}${comment.length > 120 ? '…' : ''}`,
        ].join('\n'),
        isError: false,
      };
    }

    // -----------------------------------------------------------------------
    if (name === 'jira_get_issue') {
      const issueKey = input.issueKey as string;
      const issue    = await jiraRequest('GET', creds, `/issue/${issueKey}`) as JiraIssue;
      const f        = issue.fields;

      const descText = f.description ? adfToText(f.description).slice(0, 600) : '(no description)';
      const lines = [
        `${issue.key}: ${f.summary}`,
        `  Type      : ${f.issuetype?.name || '?'}`,
        `  Status    : ${f.status?.name || '?'}`,
        `  Priority  : ${f.priority?.name || 'None'}`,
        `  Assignee  : ${f.assignee?.displayName || 'Unassigned'}`,
        `  Reporter  : ${f.reporter?.displayName || 'Unknown'}`,
        `  Labels    : ${(f.labels || []).join(', ') || 'none'}`,
        `  Created   : ${(f.created || '').slice(0, 10)}`,
        `  Updated   : ${(f.updated || '').slice(0, 10)}`,
        `  URL       : ${creds.baseUrl}/browse/${issue.key}`,
        '',
        `Description:\n${descText}`,
      ];

      if (f.comment && f.comment.comments.length > 0) {
        lines.push('', `Comments (${f.comment.comments.length} total, latest 3):`);
        const latest = f.comment.comments.slice(-3);
        for (const c of latest) {
          const cText = adfToText(c.body).slice(0, 200);
          lines.push(`  [${c.created.slice(0, 10)}] ${c.author.displayName}: ${cText}`);
        }
      }

      return { output: lines.join('\n'), isError: false };
    }

    return { output: `Unknown Jira tool: ${name}`, isError: true };
  } catch (err: unknown) {
    return { output: (err as Error).message, isError: true };
  }
}
