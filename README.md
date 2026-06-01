# ⚡ Open CLI

> A frictionless, multi-model AI CLI that translates natural language into terminal commands, file edits, and system operations.

```bash
opencli "find all TypeScript files modified today"
opencli --model gpt-4o "explain this codebase"
opencli --skill vuejs "create a reactive todo list with Pinia"
cat error.log | opencli "what caused this crash?"
```

## Quick Start

```bash
# 1. Install
git clone https://github.com/rythmmcosta/open-cli.git
cd open-cli
npm install && npm run build && npm link

# 2. Add API key
opencli auth

# 3. Start using
opencli "list all .ts files"
opencli  # interactive REPL mode
```

## Providers

| Provider | Models | Setup |
|----------|--------|-------|
| **Anthropic** | claude-opus-4-5, claude-sonnet-4-5 | `opencli auth` |
| **OpenAI** | gpt-4o, gpt-4o-mini, o1 | `opencli auth` |
| **Gemini** | gemini-2.0-flash, gemini-1.5-pro | `opencli auth` |
| **Ollama** | llama3.2, codellama, mistral | `ollama serve` |

## Built-in Skills

Switch skills with `/skill <name>` in the REPL or `--skill <name>` flag:

| Skill | Description |
|-------|-------------|
| `vibe-coding` | Creative AI-first development, rapid iteration |
| `vuejs` | Vue 3 + Composition API + Pinia + Vue Router |
| `react` | React 18 + Next.js 14 + Server Components |
| `javascript` | Vanilla JS, ES2024+, Web APIs |
| `html-css` | Semantic HTML5, modern CSS, animations |
| `gsap` | GSAP 3, ScrollTrigger, timelines |
| `php` | PHP 8.2+, Laravel, WordPress |
| `nodejs` | Node.js, Express, Fastify, APIs |
| `git` | Git workflows, GitHub, CI/CD |

## CLI Flags

```
--model, -m   AI model (claude-opus-4-5, gpt-4o, gemini-2.0-flash, ollama:llama3.2)
--skill, -s   Built-in skill
--yes, -y     Auto-approve low-risk commands
--dry-run     Preview commands without executing
--profile, -p Named profile from config
--show-cost   Display token usage and cost
--verbose     Show raw tool calls
--context, -c Inject a file into context
```

## REPL Commands

```
/auth          Manage API keys and providers
/model <name>  Switch AI model
/skill <name>  Activate a built-in skill
/skills        List all skills
/profile <n>   Apply a saved profile
/clear         Clear the screen
/history       Show conversation history
/cost          Show session token usage
/reset         Clear conversation history
/help          Show help
/exit          Exit
```

## Safety Sandbox

Every command is risk-scored before execution:

- **LOW RISK** — Auto-executed with `-y` flag (read-only, safe operations)
- **MEDIUM RISK** — Always prompts `[Y/n]` (sudo, network calls, global installs)
- **HIGH RISK** — Requires typing `"yes"` (destructive, irreversible operations)

## License

MIT
