# ⚡ Open CLI

> **opencli.myowncloud.tech** — A frictionless, multi-model AI terminal for developers

```bash
opencli "find all TypeScript files modified today"
opencli --model gpt-4o "explain this codebase"
opencli --skill vuejs "create a reactive todo list with Pinia"
opencli --notify "run the test suite and report results"
cat error.log | opencli "what caused this crash?"
opencli browser screenshot https://myapp.com
opencli agent create   # set up a background coding agent
```

## Quick Start

```bash
git clone https://github.com/rythmmcosta/open-cli.git
cd open-cli
npm install && npm run build && npm link

opencli auth        # Add API keys
opencli             # Start interactive REPL
```

## Features

| Feature | Description |
|---------|-------------|
| **Multi-model** | Claude, GPT-4o, Gemini, Ollama (local/free) |
| **20 Skills** | vue, react, gsap, php, python, rust, docker, testing, and more |
| **Browser Eyes** | Playwright automation: navigate, screenshot, verify, extract |
| **Agent System** | 9 agent types running in background with notifications |
| **8 MCP Servers** | filesystem, shell, git, browser, http, database, docker, search |
| **Notifications** | Telegram + Discord for remote monitoring |
| **Safety Sandbox** | 3-tier risk scoring on every command |
| **Pipe mode** | `cat file | opencli "analyze this"` |

## Documentation

| Doc | Description |
|-----|-------------|
| [Installation](docs/INSTALLATION.md) | Full setup guide |
| [Skills](docs/SKILLS.md) | All 20 built-in skills |
| [MCP Servers](docs/MCP-SERVERS.md) | Built-in MCP servers reference |
| [Browser Automation](docs/BROWSER-AUTOMATION.md) | Playwright integration guide |
| [Agent System](docs/AGENT-SYSTEM.md) | Background agents setup |
| [Notifications](docs/NOTIFICATIONS.md) | Telegram & Discord setup |
| [Configuration](docs/CONFIGURATION.md) | Config file reference |
| [CLI Flags](docs/CLI-FLAGS.md) | All command-line options |
| [Security](docs/SECURITY.md) | Safety sandbox details |

## Providers

```bash
opencli auth   # Interactive provider setup
```

| Provider | Models | Config |
|----------|--------|--------|
| **Anthropic** | claude-opus-4-5, claude-sonnet-4-5 | API key |
| **OpenAI** | gpt-4o, gpt-4o-mini, o1-preview | API key |
| **Gemini** | gemini-2.0-flash, gemini-1.5-pro | API key |
| **Ollama** | llama3.2, codellama, mistral | Local server |

## CLI Flags

```
opencli [prompt] [options]

  -m, --model <name>    AI model
  -s, --skill <name>    Built-in skill
  -y, --yes             Auto-approve low-risk commands
  --dry-run             Preview without executing
  -p, --profile <name>  Named config profile
  --show-cost           Show token usage
  --browser             Enable browser tools
  --notify              Send notification when done
  -v, --verbose         Show tool calls
  -c, --context <file>  Inject file into context
```

## REPL Commands

```
/auth           Manage providers
/model <name>   Switch model
/skill <name>   Activate skill
/skills         List all skills
/mcp list       List MCP servers
/browser        Browser commands
/agent          Agent management
/notify         Notification setup
/history        Conversation history
/cost           Token usage
/reset          Clear history
/help           Full command reference
/exit           Exit
```

## License

MIT · [opencli.myowncloud.tech](https://opencli.myowncloud.tech)
