# Agent System

Open CLI includes a powerful background agent system. Agents are AI-powered processes that run tasks automatically — triggered by schedules, file changes, or manually — and send notifications when done.

## Agent Types

| Type | Description | Default Trigger |
|------|-------------|-----------------|
| `monitor` | Watch files/URLs for changes and alert | file_change |
| `code-reviewer` | Auto-review git diffs and report issues | file_change |
| `test-runner` | Run tests on code changes and fix failures | file_change |
| `deploy` | Automated deployment pipeline | manual |
| `scraper` | Scrape websites on a schedule | cron |
| `build-watcher` | Watch for build failures and auto-fix | file_change |
| `security-scanner` | Scan for vulnerabilities on a schedule | cron |
| `performance-monitor` | Monitor app performance metrics | cron |
| `git-guardian` | Enforce commit conventions and branch rules | file_change |
| `custom` | User-defined agent with any task | manual |

## Creating an Agent

### Interactive (recommended)

```bash
# In REPL
/agent create

# Or CLI
opencli agent types   # see available types first
```

Follow the prompts:
1. Agent name
2. Agent type
3. Task description
4. Trigger (manual/cron/file_change/continuous)
5. Notification settings

### Example: Code Review Agent

```
Name: code-watcher
Type: code-reviewer
Task: Review the latest git diff for bugs, security issues, and best 
      practice violations. Create a markdown report in .opencli/reviews/
Trigger: file_change (watches: ./src/)
Notifications: ✓ (on complete and error)
```

## Running Agents

```bash
# Run immediately (blocks terminal)
/agent run code-watcher
opencli agent run code-watcher

# Run in background (returns immediately)
/agent background code-watcher
opencli agent background code-watcher

# List all agents
/agent list
opencli agent list

# Enable/disable
/agent enable code-watcher
/agent disable code-watcher

# Delete
/agent delete code-watcher
```

## Trigger Types

### `manual`
Only runs when explicitly called with `/agent run` or `opencli agent run`.

### `cron`
Runs on a schedule. Examples:
```
"* * * * *"     — every minute
"0 * * * *"     — every hour
"0 9 * * 1-5"   — 9am weekdays
"0 0 * * *"     — midnight daily
"0 0 * * 0"     — weekly on Sunday
```

### `file_change`
Runs when files in the watched path change (uses chokidar).

### `continuous`
Runs in a loop with a delay between iterations.

## Notification Integration

Agents can send Telegram/Discord notifications:
- `start` — When agent begins running
- `complete` — When agent finishes
- `error` — When agent encounters an error
- `output` — For each AI response during execution

```bash
# Set up notifications first
opencli notify setup

# Then create an agent with notifications enabled
/agent create  # answer "yes" to notifications
```

## Example Agents

### Nightly Security Scanner

```
Type: security-scanner
Task: Scan for hardcoded secrets (grep for "password", "secret", "api_key"),
      run npm audit, check for outdated packages with known CVEs.
      Create a report at .opencli/security-{date}.md
Trigger: cron "0 2 * * *" (2am daily)
Notifications: error, complete
```

### Continuous Monitor

```
Type: monitor
Task: Check if the web server at http://localhost:3000 is responding.
      If it returns a non-200 status, try restarting it with 'npm start'.
      Log all checks to .opencli/uptime.log
Trigger: continuous (every 5 minutes)
Notifications: error (only when site is down)
```

### Build Watcher

```
Type: build-watcher
Task: Run 'npm run build'. If it fails, read the error output and try to
      fix the TypeScript errors. If you can fix them, do so and rebuild.
      Report success or failure.
Trigger: file_change (watches: src/)
Notifications: complete, error
```

## Agent State

Agent configurations and run history are stored in:
```
~/.config/opencli/agents/
├── state.json        ← agent configs + run history
└── logs/
    └── {run-id}.log  ← per-run output logs
```

## Agent Tools

Each agent has access to a subset of tools based on its type:

| Agent Type | Available Tools |
|------------|-----------------|
| monitor | bash, read_file, list_files |
| code-reviewer | git_command, read_file, search_files, bash |
| test-runner | bash, read_file, write_file |
| deploy | bash, git_command |
| scraper | browser_navigate, browser_extract, write_file |
| build-watcher | bash, read_file, write_file, search_files |
| security-scanner | bash, search_files, read_file |
| performance-monitor | bash, browser_navigate |
| git-guardian | git_command, bash |
| custom | all tools |
