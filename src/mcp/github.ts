import fetch from 'node-fetch';
import { ToolDef } from '../types';

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export const githubTools: ToolDef[] = [
  {
    name: 'github_list_repos',
    description: 'List your GitHub repositories, sorted by most recently updated (up to 30).',
    inputSchema: {
      type: 'object',
      properties: {
        token: { type: 'string', description: 'GitHub personal access token (falls back to GITHUB_TOKEN env var)' },
      },
    },
  },
  {
    name: 'github_get_repo',
    description: 'Get details about a specific GitHub repository.',
    inputSchema: {
      type: 'object',
      properties: {
        token: { type: 'string', description: 'GitHub personal access token' },
        owner: { type: 'string', description: 'Repository owner (user or org)' },
        repo:  { type: 'string', description: 'Repository name' },
      },
      required: ['owner', 'repo'],
    },
  },
  {
    name: 'github_list_issues',
    description: 'List open issues for a GitHub repository (up to 20).',
    inputSchema: {
      type: 'object',
      properties: {
        token: { type: 'string', description: 'GitHub personal access token' },
        owner: { type: 'string', description: 'Repository owner' },
        repo:  { type: 'string', description: 'Repository name' },
      },
      required: ['owner', 'repo'],
    },
  },
  {
    name: 'github_create_issue',
    description: 'Create a new issue in a GitHub repository.',
    inputSchema: {
      type: 'object',
      properties: {
        token:  { type: 'string',  description: 'GitHub personal access token' },
        owner:  { type: 'string',  description: 'Repository owner' },
        repo:   { type: 'string',  description: 'Repository name' },
        title:  { type: 'string',  description: 'Issue title' },
        body:   { type: 'string',  description: 'Issue body / description' },
        labels: { type: 'array',   description: 'Labels to apply', items: { type: 'string' } },
      },
      required: ['owner', 'repo', 'title'],
    },
  },
  {
    name: 'github_list_prs',
    description: 'List open pull requests for a GitHub repository (up to 20).',
    inputSchema: {
      type: 'object',
      properties: {
        token: { type: 'string', description: 'GitHub personal access token' },
        owner: { type: 'string', description: 'Repository owner' },
        repo:  { type: 'string', description: 'Repository name' },
      },
      required: ['owner', 'repo'],
    },
  },
  {
    name: 'github_get_pr',
    description: 'Get details about a specific pull request.',
    inputSchema: {
      type: 'object',
      properties: {
        token:  { type: 'string',  description: 'GitHub personal access token' },
        owner:  { type: 'string',  description: 'Repository owner' },
        repo:   { type: 'string',  description: 'Repository name' },
        number: { type: 'number',  description: 'Pull request number' },
      },
      required: ['owner', 'repo', 'number'],
    },
  },
  {
    name: 'github_create_pr',
    description: 'Create a new pull request in a GitHub repository.',
    inputSchema: {
      type: 'object',
      properties: {
        token: { type: 'string', description: 'GitHub personal access token' },
        owner: { type: 'string', description: 'Repository owner' },
        repo:  { type: 'string', description: 'Repository name' },
        title: { type: 'string', description: 'PR title' },
        head:  { type: 'string', description: 'Branch to merge from (e.g. feature-branch)' },
        base:  { type: 'string', description: 'Branch to merge into (e.g. main)' },
        body:  { type: 'string', description: 'PR description body' },
      },
      required: ['owner', 'repo', 'title', 'head', 'base'],
    },
  },
  {
    name: 'github_list_commits',
    description: 'List recent commits on the default branch of a repository (up to 20).',
    inputSchema: {
      type: 'object',
      properties: {
        token: { type: 'string', description: 'GitHub personal access token' },
        owner: { type: 'string', description: 'Repository owner' },
        repo:  { type: 'string', description: 'Repository name' },
      },
      required: ['owner', 'repo'],
    },
  },
  {
    name: 'github_get_file',
    description: 'Get the contents of a file from a GitHub repository.',
    inputSchema: {
      type: 'object',
      properties: {
        token: { type: 'string', description: 'GitHub personal access token' },
        owner: { type: 'string', description: 'Repository owner' },
        repo:  { type: 'string', description: 'Repository name' },
        path:  { type: 'string', description: 'File path within the repository (e.g. src/index.ts)' },
        ref:   { type: 'string', description: 'Branch, tag, or commit SHA (default: default branch)' },
      },
      required: ['owner', 'repo', 'path'],
    },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getToken(input: Record<string, unknown>): string {
  const t = (input.token as string | undefined) || process.env.GITHUB_TOKEN || '';
  return t;
}

function ghHeaders(token: string): Record<string, string> {
  const h: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'open-cli/1.0',
  };
  if (token) h['Authorization'] = `token ${token}`;
  return h;
}

async function ghFetch(url: string, token: string, opts?: Parameters<typeof fetch>[1]): Promise<unknown> {
  const res = await fetch(url, {
    ...opts,
    headers: {
      ...ghHeaders(token),
      ...(opts?.headers as Record<string, string> | undefined),
    },
  });
  const body = await res.json() as unknown;
  if (!res.ok) {
    const msg = (body as { message?: string }).message || res.statusText;
    throw new Error(`GitHub API error ${res.status}: ${msg}`);
  }
  return body;
}

type GHRepo = {
  full_name: string; description: string | null; language: string | null;
  stargazers_count: number; forks_count: number; open_issues_count: number;
  default_branch: string; private: boolean; html_url: string;
  pushed_at: string; created_at: string; updated_at: string;
  size: number; topics?: string[];
};

type GHIssue = {
  number: number; title: string; state: string; body: string | null;
  user: { login: string }; html_url: string;
  created_at: string; updated_at: string;
  labels: Array<{ name: string }>;
  comments: number;
};

type GHPr = GHIssue & {
  head: { ref: string; sha: string };
  base: { ref: string };
  merged: boolean; draft: boolean;
  additions?: number; deletions?: number; changed_files?: number;
};

type GHCommit = {
  sha: string;
  commit: { message: string; author: { name: string; date: string } };
  author: { login: string } | null;
  html_url: string;
};

type GHFile = {
  name: string; path: string; size: number; type: string;
  content?: string; encoding?: string; html_url: string;
};

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

function formatRepo(r: GHRepo): string {
  const lines: string[] = [];
  lines.push(`${r.full_name}${r.private ? ' [private]' : ''}`);
  lines.push(`  ${r.description || '(no description)'}`);
  lines.push(`  Language : ${r.language || 'N/A'}`);
  lines.push(`  Stars    : ${r.stargazers_count}  Forks: ${r.forks_count}  Open Issues: ${r.open_issues_count}`);
  lines.push(`  Branch   : ${r.default_branch}  Size: ${r.size} KB`);
  lines.push(`  URL      : ${r.html_url}`);
  lines.push(`  Updated  : ${r.updated_at}`);
  if (r.topics && r.topics.length) lines.push(`  Topics   : ${r.topics.join(', ')}`);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------

export async function executeGithubTool(
  name: string,
  input: Record<string, unknown>
): Promise<{ output: string; isError: boolean }> {
  try {
    const token = getToken(input);
    const base = 'https://api.github.com';
    const owner = input.owner as string | undefined;
    const repo  = input.repo  as string | undefined;

    // -----------------------------------------------------------------------
    if (name === 'github_list_repos') {
      const repos = await ghFetch(`${base}/user/repos?sort=updated&per_page=30`, token) as GHRepo[];
      if (!repos.length) return { output: 'No repositories found.', isError: false };
      const lines = repos.map((r, i) => {
        const stars = String(r.stargazers_count).padStart(5);
        return `${String(i + 1).padStart(2)}. ${stars}★  ${pad(r.language || '—', 12)}  ${r.full_name}`;
      });
      return { output: `Your repositories (${repos.length}):\n\n${lines.join('\n')}`, isError: false };
    }

    // -----------------------------------------------------------------------
    if (name === 'github_get_repo') {
      const r = await ghFetch(`${base}/repos/${owner}/${repo}`, token) as GHRepo;
      return { output: formatRepo(r), isError: false };
    }

    // -----------------------------------------------------------------------
    if (name === 'github_list_issues') {
      const issues = await ghFetch(`${base}/repos/${owner}/${repo}/issues?state=open&per_page=20`, token) as GHIssue[];
      if (!issues.length) return { output: 'No open issues.', isError: false };
      const lines = issues.map(i => {
        const labels = i.labels.map(l => l.name).join(', ');
        return [
          `#${String(i.number).padEnd(6)} ${i.title}`,
          `         Author: ${i.user.login}  Comments: ${i.comments}  Labels: ${labels || 'none'}`,
          `         ${i.html_url}`,
        ].join('\n');
      });
      return { output: `Open issues for ${owner}/${repo} (${issues.length}):\n\n${lines.join('\n\n')}`, isError: false };
    }

    // -----------------------------------------------------------------------
    if (name === 'github_create_issue') {
      const title  = input.title as string;
      const body   = (input.body  as string | undefined) || '';
      const labels = (input.labels as string[] | undefined) || [];
      const issue = await ghFetch(`${base}/repos/${owner}/${repo}/issues`, token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body, labels }),
      }) as GHIssue;
      return {
        output: `Issue created: #${issue.number} — ${issue.title}\n${issue.html_url}`,
        isError: false,
      };
    }

    // -----------------------------------------------------------------------
    if (name === 'github_list_prs') {
      const prs = await ghFetch(`${base}/repos/${owner}/${repo}/pulls?state=open&per_page=20`, token) as GHPr[];
      if (!prs.length) return { output: 'No open pull requests.', isError: false };
      const lines = prs.map(p => [
        `#${String(p.number).padEnd(6)} ${p.title}${p.draft ? ' [DRAFT]' : ''}`,
        `         ${p.head.ref} → ${p.base.ref}  |  Author: ${p.user.login}`,
        `         ${p.html_url}`,
      ].join('\n'));
      return { output: `Open PRs for ${owner}/${repo} (${prs.length}):\n\n${lines.join('\n\n')}`, isError: false };
    }

    // -----------------------------------------------------------------------
    if (name === 'github_get_pr') {
      const num = input.number as number;
      const p = await ghFetch(`${base}/repos/${owner}/${repo}/pulls/${num}`, token) as GHPr;
      const lines = [
        `PR #${p.number}: ${p.title}${p.draft ? ' [DRAFT]' : ''}`,
        `  State   : ${p.state}${p.merged ? ' (merged)' : ''}`,
        `  Author  : ${p.user.login}`,
        `  Branch  : ${p.head.ref} → ${p.base.ref}`,
        `  URL     : ${p.html_url}`,
        `  Created : ${p.created_at}`,
        `  Updated : ${p.updated_at}`,
      ];
      if (p.additions !== undefined) {
        lines.push(`  Changes : +${p.additions} -${p.deletions} in ${p.changed_files} files`);
      }
      if (p.body) lines.push(`\n${p.body}`);
      return { output: lines.join('\n'), isError: false };
    }

    // -----------------------------------------------------------------------
    if (name === 'github_create_pr') {
      const pr = await ghFetch(`${base}/repos/${owner}/${repo}/pulls`, token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: input.title,
          head:  input.head,
          base:  input.base,
          body:  input.body || '',
        }),
      }) as GHPr;
      return {
        output: `PR created: #${pr.number} — ${pr.title}\n${pr.html_url}`,
        isError: false,
      };
    }

    // -----------------------------------------------------------------------
    if (name === 'github_list_commits') {
      const commits = await ghFetch(`${base}/repos/${owner}/${repo}/commits?per_page=20`, token) as GHCommit[];
      if (!commits.length) return { output: 'No commits found.', isError: false };
      const lines = commits.map((c, i) => {
        const sha   = c.sha.slice(0, 7);
        const msg   = c.commit.message.split('\n')[0].slice(0, 72);
        const author = c.author?.login || c.commit.author.name;
        const date   = c.commit.author.date.slice(0, 10);
        return `${String(i + 1).padStart(2)}. ${sha}  ${date}  ${pad(author, 16)}  ${msg}`;
      });
      return { output: `Commits for ${owner}/${repo}:\n\n${lines.join('\n')}`, isError: false };
    }

    // -----------------------------------------------------------------------
    if (name === 'github_get_file') {
      const filePath = input.path as string;
      const ref      = input.ref  as string | undefined;
      const url      = `${base}/repos/${owner}/${repo}/contents/${filePath}${ref ? `?ref=${ref}` : ''}`;
      const file = await ghFetch(url, token) as GHFile;
      if (file.type !== 'file') {
        return { output: `${filePath} is a ${file.type}, not a file.`, isError: true };
      }
      if (!file.content || file.encoding !== 'base64') {
        return { output: `Cannot decode file content (encoding: ${file.encoding}).`, isError: true };
      }
      const content = Buffer.from(file.content.replace(/\n/g, ''), 'base64').toString('utf-8');
      const header = `File: ${file.path}  (${file.size} bytes)  ${file.html_url}\n${'─'.repeat(60)}\n`;
      return { output: header + content, isError: false };
    }

    return { output: `Unknown GitHub tool: ${name}`, isError: true };
  } catch (err: unknown) {
    return { output: (err as Error).message, isError: true };
  }
}
