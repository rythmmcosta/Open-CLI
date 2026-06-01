# CLI Flags Reference

## Usage

```bash
opencli [prompt] [options]
opencli <command> [options]
```

## Global Options

| Flag | Short | Description | Example |
|------|-------|-------------|---------|
| `--model <name>` | `-m` | AI model to use | `--model gpt-4o` |
| `--skill <name>` | `-s` | Built-in skill | `--skill vuejs` |
| `--yes` | `-y` | Auto-approve low-risk commands | `-y` |
| `--dry-run` | | Preview commands, don't execute | `--dry-run` |
| `--profile <name>` | `-p` | Apply saved config profile | `--profile work` |
| `--show-cost` | | Display token usage and cost | `--show-cost` |
| `--no-color` | | Disable terminal colors | `--no-color` |
| `--verbose` | `-v` | Show raw tool calls | `-v` |
| `--context <file>` | `-c` | Inject file into context | `-c README.md` |
| `--browser` | | Enable browser automation tools | `--browser` |
| `--notify` | | Send notification when done | `--notify` |
| `--version` | `-V` | Show version | |
| `--help` | `-h` | Show help | |

## Commands

### `opencli auth`
Interactive provider setup — add/remove API keys, test connections.

### `opencli skills`
List all 20 built-in skills.

### `opencli mcp`
List all 8 built-in MCP servers.

### `opencli config`
Show current configuration (model, skill, providers, etc.).

### `opencli browser <action> [url]`
```bash
opencli browser install            # Install Playwright browsers
opencli browser screenshot <url>   # Take a full-page screenshot
opencli browser verify <url>       # Verify page integrity
opencli browser install --all      # Install all browsers (not just Chromium)
```

### `opencli agent <subcommand>`
```bash
opencli agent list             # List all configured agents
opencli agent types            # Show all agent types
opencli agent run <name>       # Run agent immediately
opencli agent background <name> # Run as background process
opencli agent delete <name>    # Delete an agent
```

### `opencli notify <subcommand>`
```bash
opencli notify setup           # Configure Telegram/Discord
opencli notify test            # Send a test notification
opencli notify send <msg>      # Send a custom message
opencli notify send "Done" --level success --title "Build"
```

## One-shot Mode

```bash
# Run a single prompt and exit
opencli "list all .ts files modified today"
opencli --model ollama:llama3.2 "explain main.ts"
opencli --skill php "create a Laravel API route"
opencli --dry-run "delete all node_modules folders"
opencli --yes "show disk usage by directory"
opencli --show-cost "explain this architecture"
```

## Pipe Mode

```bash
# Pipe input to Open CLI
cat error.log | opencli "what caused this crash?"
git diff | opencli "write a commit message for this"
cat src/router.ts | opencli --skill typescript "review this for type safety"
npm test 2>&1 | opencli "which tests failed and why?"
```

## Context Injection

```bash
# Include a file in the prompt context
opencli -c README.md "based on this readme, write a getting started guide"
opencli -c package.json "update the dependencies to latest versions"
opencli -c .env.example "generate a docker-compose.yml for this config"
```

## Notification on Complete

```bash
# Configure notifications first
opencli notify setup

# Then use --notify flag
opencli --notify "run the test suite"
opencli --notify "deploy to production"
# → Sends Telegram/Discord message when done
```

## Model Names

```
Anthropic: claude-opus-4-5, claude-sonnet-4-5, claude-haiku-4-5
OpenAI:    gpt-4o, gpt-4o-mini, o1-preview, o1-mini
Gemini:    gemini-2.0-flash, gemini-2.0-flash-lite, gemini-1.5-pro
Ollama:    ollama:llama3.2, ollama:codellama, ollama:mistral
```
