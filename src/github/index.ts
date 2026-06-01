import fetch from 'node-fetch';
import { getConfig } from '../config';
import { getCurrentProject } from '../db/projects';
import { getGithubConnection, saveGithubConnection } from '../db/github-connections';
import { C, showSuccess, showError, showInfo } from '../ui/display';
import { executeBash } from '../tools/shell';

// Get stored GitHub token from provider config
function getToken(): string | undefined {
  const config = getConfig();
  return (config.providers as Record<string, { token?: string } | undefined>).github?.token;
}

interface GithubApiOptions {
  token?: string;
  method?: string;
  body?: unknown;
}

async function githubApi(path: string, opts: GithubApiOptions = {}): Promise<unknown> {
  const token = opts.token || getToken() || process.env.GITHUB_TOKEN;
  const url = path.startsWith('http') ? path : `https://api.github.com${path}`;
  const res = await fetch(url, {
    method: opts.method || 'GET',
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'open-cli/1.0.0',
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

// ──────────────────────────────────────────────────────────────────────────────
// CLI command handler
// ──────────────────────────────────────────────────────────────────────────────
export async function runGithubCommand(args: string[]): Promise<void> {
  const sub = args[0];

  if (!sub || sub === 'status') {
    await githubStatus();
    return;
  }
  if (sub === 'connect') { await githubConnect(args.slice(1)); return; }
  if (sub === 'push')    { await githubPush(args.slice(1)); return; }
  if (sub === 'pull')    { await githubPull(args.slice(1)); return; }
  if (sub === 'clone')   { await githubClone(args.slice(1)); return; }
  if (sub === 'pr')      { await githubPR(args.slice(1)); return; }
  if (sub === 'issues')  { await githubIssues(args.slice(1)); return; }
  if (sub === 'repos')   { await githubListRepos(); return; }

  showInfo('GitHub commands: status, connect <owner/repo>, push, pull, clone <url>, pr [list|create], issues, repos');
}

async function githubStatus(): Promise<void> {
  const project = getCurrentProject();
  if (!project) {
    showInfo('No project in current directory. Run /project init first.');
    return;
  }
  const conn = getGithubConnection(project.id);
  console.log('\n  ' + C.blue.bold('GitHub Status') + '\n');
  console.log(`  ${C.dim('Project:')} ${project.name}`);
  if (conn) {
    console.log(`  ${C.dim('Repo:')}    ${C.green(conn.owner + '/' + conn.repo)}`);
    console.log(`  ${C.dim('Branch:')} ${conn.branch}`);
    console.log(`  ${C.dim('Auto-push:')} ${conn.auto_push ? C.green('on') : C.dim('off')}`);
  } else {
    console.log(`  ${C.dim('No GitHub repo connected. Run: /github connect <owner/repo>')}`);
  }

  // git status
  const { output, isError } = await executeBash({ command: 'git status --short 2>&1' });
  if (!isError) {
    const lines = output.trim().split('\n').filter(Boolean);
    console.log(`\n  ${C.dim('Working tree:')} ${lines.length === 0 ? C.green('clean') : C.yellow(lines.length + ' changed files')}`);
    if (lines.length > 0) lines.slice(0, 5).forEach(l => console.log(`    ${l}`));
  }
  console.log();
}

async function githubConnect(args: string[]): Promise<void> {
  const repoArg = args[0]; // owner/repo
  if (!repoArg || !repoArg.includes('/')) {
    showError('Usage: /github connect <owner/repo> [branch]');
    return;
  }
  const [owner, repo] = repoArg.split('/');
  const branch = args[1] || 'main';
  const project = getCurrentProject();
  if (!project) {
    showError('No project detected. Run /project init first.');
    return;
  }

  try {
    await githubApi(`/repos/${owner}/${repo}`);
    saveGithubConnection({ projectId: project.id, owner, repo, url: `https://github.com/${owner}/${repo}`, branch });
    showSuccess(`Connected to ${owner}/${repo} (branch: ${branch})`);
  } catch (err: unknown) {
    showError(`Cannot access repo: ${(err as Error).message}`);
  }
}

async function githubPush(args: string[]): Promise<void> {
  const message = args.join(' ') || 'Update from Open CLI';
  const { output, isError } = await executeBash({
    command: `git add -A && git commit -m "${message.replace(/"/g, '\\"')}" && git push 2>&1`,
  });
  if (isError) {
    showError(output);
  } else {
    showSuccess('Pushed to GitHub');
    console.log(C.dim(output.slice(0, 300)));
  }
}

async function githubPull(args: string[]): Promise<void> {
  const branch = args[0] || '';
  const cmd = branch ? `git pull origin ${branch} 2>&1` : 'git pull 2>&1';
  const { output, isError } = await executeBash({ command: cmd });
  if (isError) showError(output);
  else { showSuccess('Pulled latest changes'); console.log(C.dim(output.slice(0, 300))); }
}

async function githubClone(args: string[]): Promise<void> {
  const url = args[0];
  if (!url) { showError('Usage: /github clone <url>'); return; }
  const { output, isError } = await executeBash({ command: `git clone ${url} 2>&1` });
  if (isError) showError(output);
  else showSuccess(`Cloned ${url}`);
}

async function githubPR(args: string[]): Promise<void> {
  const sub = args[0] || 'list';
  const project = getCurrentProject();
  const conn = project ? getGithubConnection(project.id) : null;

  if (sub === 'list') {
    if (!conn) { showError('No GitHub repo connected. Run /github connect first.'); return; }
    try {
      const prs = await githubApi(`/repos/${conn.owner}/${conn.repo}/pulls?state=open&per_page=10`) as Array<{
        number: number; title: string; user: { login: string }; created_at: string;
      }>;
      if (prs.length === 0) { showInfo('No open pull requests.'); return; }
      console.log('\n  ' + C.blue.bold('Open Pull Requests') + '\n');
      for (const pr of prs) {
        console.log(`  ${C.green('#' + pr.number)}  ${pr.title}`);
        console.log(`  ${' '.repeat(5)}${C.dim('by ' + pr.user.login + ' on ' + pr.created_at.slice(0, 10))}`);
      }
      console.log();
    } catch (err: unknown) {
      showError((err as Error).message);
    }
    return;
  }

  if (sub === 'create') {
    if (!conn) { showError('No GitHub repo connected. Run /github connect first.'); return; }
    const title = args.slice(1).join(' ') || 'Pull request from Open CLI';

    // Get current branch
    const { output: branchOut } = await executeBash({ command: 'git branch --show-current' });
    const head = branchOut.trim();

    try {
      const pr = await githubApi(`/repos/${conn.owner}/${conn.repo}/pulls`, {
        method: 'POST',
        body: { title, head, base: conn.branch },
      }) as { html_url: string; number: number };
      showSuccess(`PR #${pr.number} created: ${pr.html_url}`);
    } catch (err: unknown) {
      showError((err as Error).message);
    }
    return;
  }

  showInfo('Usage: /github pr [list|create <title>]');
}

async function githubIssues(args: string[]): Promise<void> {
  const project = getCurrentProject();
  const conn = project ? getGithubConnection(project.id) : null;
  if (!conn) { showError('No GitHub repo connected. Run /github connect first.'); return; }

  try {
    const issues = await githubApi(`/repos/${conn.owner}/${conn.repo}/issues?state=open&per_page=10`) as Array<{
      number: number; title: string; user: { login: string }; labels: Array<{ name: string }>; created_at: string;
    }>;
    if (issues.length === 0) { showInfo('No open issues.'); return; }
    console.log('\n  ' + C.blue.bold('Open Issues') + '\n');
    for (const issue of issues) {
      const labels = issue.labels.map(l => C.dim(`[${l.name}]`)).join(' ');
      console.log(`  ${C.green('#' + issue.number)}  ${issue.title} ${labels}`);
    }
    console.log();
  } catch (err: unknown) {
    showError((err as Error).message);
  }
}

async function githubListRepos(): Promise<void> {
  try {
    const repos = await githubApi('/user/repos?sort=updated&per_page=15') as Array<{
      full_name: string; private: boolean; stargazers_count: number; language: string; description: string;
    }>;
    if (repos.length === 0) { showInfo('No repos found.'); return; }
    console.log('\n  ' + C.blue.bold('Your Repositories') + '\n');
    for (const repo of repos) {
      const priv = repo.private ? C.yellow(' [private]') : '';
      const lang = repo.language ? C.dim(` ${repo.language}`) : '';
      console.log(`  ${C.green(repo.full_name)}${priv}${lang}  ${C.dim('⭐ ' + repo.stargazers_count)}`);
      if (repo.description) console.log(`  ${' '.repeat(4)}${C.dim(repo.description.slice(0, 70))}`);
    }
    console.log();
  } catch (err: unknown) {
    showError((err as Error).message);
  }
}
