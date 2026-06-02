# ⚡ Open CLI — One CLI. Every AI. Zero Limits.

[![npm version](https://img.shields.io/npm/v/open-cli?color=00cc7e&label=npm)](https://www.npmjs.com/package/open-cli)
[![License](https://img.shields.io/badge/license-MIT-00cc7e.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6.svg)](https://typescriptlang.org)
[![AI Providers](https://img.shields.io/badge/AI%20Providers-17-9b5fe8.svg)](#-ai-providers-17-providers)
[![Skills](https://img.shields.io/badge/Skills-45%2B-00cc7e.svg)](#-skills-45-built-in-skills)
[![MCP Servers](https://img.shields.io/badge/MCP%20Servers-26-00b4d8.svg)](#-mcp-servers-26-built-in-servers)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

> **The AI terminal that thinks with you, builds with you, and ships with you.**
>
> [opencli.myowncloud.tech](https://opencli.myowncloud.tech) — Built by [Rythmm Costa](https://github.com/rythmmcosta)

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚡ Open CLI v2.0.0                              opencli.myowncloud.tech  │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  $ opencli "analyze project"                                      │
│  ⠋ Scanning 47 files...                                           │
│    TypeScript 5.x · Node.js · 18 modules                         │
│  ✓ Analysis complete (2.3s)                                       │
│                                                                   │
│  $ opencli --skill python "add REST API endpoint"                 │
│  ✓ Written to src/routes/users.py                                 │
│                                                                   │
│  $ opencli --ensemble "review this PR"                            │
│  ⠋ Querying Claude, GPT-4o, Gemini simultaneously...             │
│  ✓ 3 AI perspectives ready                                        │
│                                                                   │
│  $ opencli --free "explain this algorithm"                        │
│  ⠋ Using Groq llama-3.3-70b (free tier)...                       │
│  ✓ Explanation ready                                              │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## ✨ What is Open CLI?

Open CLI is a **professional AI terminal** that unifies 17 AI providers — Claude, GPT-4o, Gemini, Groq, DeepSeek, Mistral, and more — behind a single, consistent command-line interface. Instead of juggling multiple web UIs, API clients, and workflows, you get one tool that integrates directly into your development environment.

At its core, Open CLI is a **task execution engine**: it reads your code, runs shell commands, manages files, automates browsers, queries databases, calls APIs, and interacts with GitHub — all under AI supervision. With 45+ domain-specific skills (Vue, React, Rust, Python, Docker, Kubernetes, ML, and more), it brings expert-level AI assistance precisely to the task at hand.

Open CLI also introduces **Ensemble Mode**, which queries multiple AI providers simultaneously and synthesizes their responses, giving you a broader and more reliable perspective on any problem. Combined with **multi-window IPC**, **cross-device sync**, and a **free tier** powered by Groq, Gemini Flash, and OpenRouter, Open CLI is the AI terminal designed for teams and developers who ship every day.

---

## Installation

### Option A — From GitHub (recommended)
```bash
git clone https://github.com/rythmmcosta/open-cli.git
cd open-cli
npm install && npm run build && npm link
```

### Option B — NPM shortcut (Node.js 18+ required)
```bash
npm install -g github:rythmmcosta/open-cli
```

### Windows
Use WSL2 for the best experience:
```powershell
# In PowerShell as Administrator:
wsl --install
# After restart, in WSL2 terminal:
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git
git clone https://github.com/rythmmcosta/open-cli.git
cd open-cli && npm install && npm run build && npm link
```

### Android (Termux)
```bash
pkg update && pkg install nodejs git
git clone https://github.com/rythmmcosta/open-cli.git
cd open-cli && npm install && npm run build && npm link
```

## 🚀 Quick Start

```bash
# Run interactive setup (adds API keys)
opencli auth

# Start coding with AI
opencli "explain the architecture of this codebase"

# Use a domain skill
opencli --skill react "create a data table component with sorting"

# Use only free AI tiers
opencli --free "write unit tests for this module"

# Query all AIs at once
opencli --ensemble "what's the best approach for this architecture?"
```

**First-time setup takes about 2 minutes.** You only need one API key to get started — or use the free tier with no key at all.

---

## 🧠 AI Providers (17 providers)

Configure providers interactively with `opencli auth` or by editing `~/.config/opencli/config.json`.

| Provider | Key Models | Free Tier | Setup |
|----------|-----------|-----------|-------|
| **Anthropic (Claude)** | claude-opus-4-5, claude-sonnet-4-5, claude-haiku-3-5 | No | API key |
| **OpenAI (GPT)** | gpt-4o, gpt-4o-mini, o1-preview, o3-mini | No | API key |
| **Google (Gemini)** | gemini-2.0-flash, gemini-1.5-pro, gemini-1.5-flash | Yes (Flash) | API key |
| **Groq** | llama-3.3-70b, mixtral-8x7b, gemma2-9b | Yes (generous) | API key |
| **DeepSeek** | deepseek-chat, deepseek-reasoner | Yes (limited) | API key |
| **Mistral AI** | mistral-large-2, mistral-small, codestral | No | API key |
| **Cohere** | command-r-plus, command-r, command-light | Yes (trial) | API key |
| **Perplexity** | llama-3.1-sonar-large, sonar-pro | No | API key |
| **xAI (Grok)** | grok-2, grok-2-mini | No | API key |
| **Kimi / Moonshot** | moonshot-v1-8k, moonshot-v1-32k | No | API key |
| **Together AI** | llama-3.2-90b, qwen-2.5-72b | Yes (credits) | API key |
| **Cerebras** | llama3.1-70b, llama3.1-8b | Yes (fast free) | API key |
| **HuggingFace** | meta-llama/Llama-3.3-70B-Instruct, Qwen/Qwen2.5 | Yes | API token |
| **Azure OpenAI** | gpt-4o, gpt-4o-mini (your deployment) | No | Endpoint + key |
| **AWS Bedrock** | claude-3.5-sonnet, llama3, titan-text | No | AWS credentials |
| **Ollama** | llama3.2, codellama, mistral, phi3 (local) | Free (local) | Local server |
| **OpenRouter** | 200+ models including free tier | Yes (free models) | API key |

> **Tip:** Use `opencli --free` to automatically select from the free-tier providers. See [docs/FREE-TIER.md](docs/FREE-TIER.md) for a complete guide.

---

## 🛠 Skills (45+ built-in skills)

Skills are deep, domain-specific AI personas that know the latest best practices, libraries, and patterns for their technology. Activate with `opencli --skill <id>` or `/skill <id>` inside the REPL.

### Web Frontend

| Skill ID | Name | Description |
|----------|------|-------------|
| `javascript` | JavaScript | ES2024+, DOM, Web APIs, Node.js |
| `typescript` | TypeScript | Advanced types, generics, decorators, strict mode |
| `react` | React | React 18+, hooks, Next.js 14, Server Components |
| `nextjs` | Next.js 15 | App Router, Server Actions, React 19, Turbopack |
| `vuejs` | Vue.js | Vue 3 Composition API, Pinia, Vue Router, Vite |
| `svelte` | Svelte 5 + SvelteKit | Runes reactivity, form actions, SSR |
| `html-css` | HTML & CSS | Semantic HTML5, modern CSS, container queries, animations |
| `tailwind` | Tailwind CSS | Tailwind 4.x, shadcn/ui, dark mode, design systems |
| `gsap` | GSAP | GSAP 3, ScrollTrigger, timelines, SVG animation |
| `threejs` | Three.js | WebGL, 3D scenes, shaders, react-three-fiber |
| `wasm` | WebAssembly | Wasm modules, Rust/C++ to Wasm, WASI |

### Backend

| Skill ID | Name | Description |
|----------|------|-------------|
| `nodejs` | Node.js | Express, Fastify, REST & GraphQL APIs, TypeScript |
| `python` | Python | Python 3.12+, FastAPI, async, data science |
| `php` | PHP | PHP 8.2+, Laravel, WordPress, Composer |
| `golang` | Go | Go 1.22+, goroutines, Gin/Echo/Fiber, table-driven tests |
| `rust` | Rust | Ownership, lifetimes, async, Tokio, axum |
| `java` | Java 21 | Spring Boot 3.x, virtual threads, records, JUnit 5 |
| `csharp` | C# / .NET | .NET 8+, ASP.NET Core Minimal APIs, EF Core 8 |
| `kotlin` | Kotlin | Kotlin 2.x, coroutines, Ktor, Spring Boot |
| `swift` | Swift | Swift 5.9+, SwiftUI, async/await, Combine |
| `elixir` | Elixir | Phoenix, LiveView, OTP, pattern matching |
| `cpp` | C++ | C++23, RAII, templates, performance optimization |

### Mobile

| Skill ID | Name | Description |
|----------|------|-------------|
| `mobile` | React Native | React Native 0.74+, Expo SDK 51, Expo Router v3 |
| `flutter` | Flutter | Flutter 3.x, Dart 3, Riverpod 2, GoRouter, Material 3 |

### Data & ML

| Skill ID | Name | Description |
|----------|------|-------------|
| `database` | Database | PostgreSQL, MySQL, MongoDB, Redis, SQL optimization |
| `sql` | SQL | Advanced SQL, window functions, query optimization |
| `ml` | Machine Learning | PyTorch 2.x, scikit-learn, HuggingFace Transformers |
| `r-lang` | R | Data analysis, ggplot2, tidyverse, statistical modeling |
| `graphql` | GraphQL | Schema design, Apollo Server 4, DataLoader, subscriptions |
| `prisma` | Prisma ORM | Schema, relations, migrations, Client queries |

### DevOps & Infrastructure

| Skill ID | Name | Description |
|----------|------|-------------|
| `docker` | Docker & DevOps | Multi-stage builds, Compose, CI/CD pipelines |
| `kubernetes` | Kubernetes | K8s 1.29+, Helm 3, ArgoCD GitOps, RBAC |
| `terraform` | Terraform | HCL, providers, modules, state, workspaces |
| `aws` | AWS | CDK v2 (TypeScript), Lambda, DynamoDB, S3 |
| `cicd` | CI/CD | GitHub Actions, GitLab CI, ArgoCD, release automation |
| `nginx` | Nginx | Reverse proxy, SSL/TLS, rate limiting, caching |
| `bash` | Shell Scripting | Bash 5, POSIX sh, awk, sed, jq, parallel |
| `git` | Git | Workflows, branching strategies, GitHub, CI/CD |

### Security & Systems

| Skill ID | Name | Description |
|----------|------|-------------|
| `security` | Security | OWASP Top 10, secure coding, cryptography |

### Automation & AI

| Skill ID | Name | Description |
|----------|------|-------------|
| `browser-automation` | Browser Automation | Playwright: navigate, screenshot, verify, extract |
| `vibe-coding` | Vibe Coding | Creative AI-first development, rapid iteration |

### Web3 & CMS

| Skill ID | Name | Description |
|----------|------|-------------|
| `solidity` | Solidity / Web3 | EVM smart contracts, Hardhat, ethers.js, OpenZeppelin |
| `wordpress` | WordPress | Gutenberg blocks, WP REST API, ACF, WooCommerce |

### Other

| Skill ID | Name | Description |
|----------|------|-------------|
| `regex` | Regex | Regular expressions in JS, Python, Go, PCRE |
| `testing` | Testing | Playwright E2E, Vitest, Jest, Testing Library |

---

## 🔌 MCP Servers (26 built-in servers)

Open CLI ships with 26 built-in MCP (Model Context Protocol) servers. No external downloads required for core servers. Configure with `opencli auth` or `/mcp list` in the REPL.

### Developer Tools

| Server | Description | Setup Required |
|--------|-------------|----------------|
| `github` | Repos, issues, PRs, file contents via GitHub REST API v3 | GitHub PAT |
| `jira` | List/create/update issues, comments, transitions | Jira Cloud API token |
| `linear` | Issues, projects, cycles, team management | Linear API key |
| `slack` | Send messages, list channels, read channel history | Slack Bot token |
| `email` | Send emails via any SMTP server | SMTP URL |
| `clipboard` | Read/write system clipboard (macOS, Linux, Windows) | None |

### Data & Databases

| Server | Description | Setup Required |
|--------|-------------|----------------|
| `database` | SQLite: SELECT, INSERT, CREATE TABLE, migrations | None |
| `postgres` | PostgreSQL: query, schema inspection, migrations | Connection URL |
| `mongodb` | MongoDB: CRUD, aggregate, collections | MongoDB URI |
| `redis` | Redis: get/set/del, list, hash, pub-sub | Redis URL |
| `csv` | Parse, filter, aggregate, transform CSV files | None |
| `pdf` | Create PDFs, extract text from PDF files | None |
| `supabase` | Supabase database + auth + storage via REST API | Supabase URL + key |

### Cloud & Storage

| Server | Description | Setup Required |
|--------|-------------|----------------|
| `s3` | AWS S3: upload, download, list, delete objects | AWS credentials |
| `google-drive` | Google Drive: list, upload, download, share | OAuth credentials |
| `ftp` | FTP/SFTP: connect, list, upload, download | Host + credentials |
| `dropbox` | Dropbox: list, upload, download files | Dropbox API token |

### Integrations

| Server | Description | Setup Required |
|--------|-------------|----------------|
| `stripe` | Stripe: customers, payments, subscriptions, webhooks | Stripe secret key |
| `notion` | Notion: pages, databases, blocks, search | Notion integration token |
| `wordpress` | WordPress: posts, pages, media, users via REST API | WP URL + credentials |
| `image-gen` | Image generation: DALL-E, Stable Diffusion, Flux | Provider API key |
| `cli-tools` | Wrap any CLI tool as an MCP server | None |

### Core

| Server | Description | Setup Required |
|--------|-------------|----------------|
| `filesystem` | Read, write, list, and search files/directories | None |
| `shell` | Execute shell commands with safety scoring | None |
| `git` | Full git workflow: status, commit, push, diff, branches | None |
| `browser` | Playwright browser: navigate, click, screenshot, verify | `npx playwright install chromium` |
| `http` | HTTP/REST requests: GET, POST, PUT, DELETE | None |
| `search` | Web search via DuckDuckGo | None |

---

## 💻 CLI Reference

### Commands

```bash
opencli [prompt]                Chat mode with default model
opencli --skill <id>            Activate a domain skill
opencli --model <name>          Use a specific model
opencli --ensemble              Query all AIs simultaneously
opencli --free                  Use only free AI tiers
opencli --codex                 Coding-focused mode
opencli --image "prompt"        Generate an image
opencli --video "prompt"        Generate a video
opencli auth                    Manage AI providers (interactive)
opencli project                 Project management (init, list, switch)
opencli github                  GitHub operations (PR, issues, review)
opencli sync                    Cross-device sync (push, pull, status)
opencli workspace               Multi-window workspace status
opencli benchmark               Benchmark and compare models
opencli recipe                  Run/manage automation recipes
opencli timeline                File change history
opencli search                  Search conversation history
opencli costs                   Usage and cost dashboard
```

### Flags

| Flag | Short | Description |
|------|-------|-------------|
| `--model <name>` | `-m` | Use specific AI model |
| `--skill <id>` | `-s` | Activate domain skill |
| `--ensemble` | | Query all AI providers simultaneously |
| `--free` | | Use only free AI tiers |
| `--codex` | | Coding-focused mode with extra tools |
| `--image <prompt>` | | Generate image from text |
| `--video <prompt>` | | Generate video from text |
| `--dry-run` | | Preview actions without executing |
| `--yes` | `-y` | Auto-approve low-risk commands |
| `--profile <name>` | `-p` | Use named config profile |
| `--show-cost` | | Show token usage and cost |
| `--verbose` | `-v` | Show all tool calls |
| `--context <file>` | `-c` | Inject file into context |
| `--notify` | | Send notification when done |
| `--browser` | | Enable browser tools |
| `--no-mcp` | | Disable all MCP servers |
| `--help` | `-h` | Show help |
| `--version` | | Show version |

### REPL Commands

Inside the interactive REPL, use `/` commands:

```
/auth              Manage AI providers
/model <name>      Switch model mid-conversation
/skill <name>      Activate a skill
/skills            List all available skills
/ensemble          Toggle ensemble mode
/free              Toggle free-tier mode
/mcp list          List active MCP servers
/mcp enable <id>   Enable an MCP server
/mcp disable <id>  Disable an MCP server
/browser           Browser automation commands
/image <prompt>    Generate an image
/sync              Sync conversation across devices
/workspace         Show multi-window workspace
/history           Conversation history
/search <query>    Search past conversations
/timeline          File change timeline
/recipe <name>     Run a saved recipe
/cost              Token usage and cost report
/costs             Full cost dashboard
/benchmark         Run model benchmark
/github            GitHub operations
/project           Project context management
/reset             Clear conversation history
/config            Edit configuration
/help              Full command reference
/exit              Exit
```

---

## 🎯 AI Ensemble Mode

Ensemble Mode queries **multiple AI providers simultaneously** and presents their responses together — giving you diverse perspectives, consensus answers, and the ability to spot where models disagree.

```bash
# Query all configured AIs at once
opencli --ensemble "what's the best database for this use case?"

# Ensemble with only free providers
opencli --ensemble --free "review this code for bugs"

# Inside REPL
/ensemble on
> explain the trade-offs of microservices vs monolith
```

**Why use Ensemble Mode?**
- Architecture decisions benefit from multiple expert perspectives
- Code reviews catch issues that a single model might miss
- Comparing models on your specific use case helps you choose the best one
- Free ensemble mode costs nothing — all from free-tier providers

See [docs/ENSEMBLE.md](docs/ENSEMBLE.md) for the complete guide.

---

## 🪟 Multi-Window Workspace

Open CLI supports **multiple terminal windows** working on the same project simultaneously. Windows share context through a lightweight IPC (inter-process communication) layer with file locking to prevent conflicts.

```bash
# Check workspace status
opencli workspace

# In Window 1: long-running task
opencli "refactor the authentication module"

# In Window 2: parallel work continues safely
opencli --skill testing "write tests for the auth module"

# Windows automatically coordinate file access
# Conflicts are surfaced as warnings, not silent failures
```

**Features:**
- File-level locking prevents concurrent write conflicts
- Shared conversation context across windows (optional)
- Workspace status shows which files each window is editing
- Graceful handoff when a window exits

See [docs/IPC-MULTIWINDOW.md](docs/IPC-MULTIWINDOW.md) for the complete guide.

---

## ☁️ Cross-Device Sync

Sync your Open CLI conversations, recipes, and settings across devices using your Open CLI account.

```bash
# Register or log in
opencli auth --account

# Push current session to cloud
opencli sync push

# Pull latest from cloud on another device
opencli sync pull

# Check sync status
opencli sync status

# Enable auto-sync
opencli sync enable --auto
```

**What syncs:**
- Conversation history
- Custom recipes
- Skill configurations
- Model preferences
- Cost tracking data

**Privacy:** All sync data is encrypted at rest. Your API keys are never synced — they stay on each device.

See [docs/SYNC.md](docs/SYNC.md) for full details, quota limits, and account management.

---

## 🆓 Free AI Tier

Open CLI works **100% free** using these providers:

| Provider | Free Tier | Speed | Best For |
|----------|-----------|-------|----------|
| **Groq** | Generous daily limit | Ultra-fast | General coding, Q&A |
| **Gemini Flash** | 1M tokens/day | Fast | Long context, analysis |
| **Cerebras** | Daily limit | Ultra-fast | Quick completions |
| **HuggingFace** | Rate-limited | Variable | Specialized models |
| **OpenRouter** | Free model tier | Fast | Model variety |
| **Ollama** | Unlimited (local) | Local speed | Privacy, offline |
| **DeepSeek** | Limited daily | Fast | Reasoning tasks |

```bash
# Use free providers automatically
opencli --free "explain this error"

# Ensemble across free providers only
opencli --free --ensemble "architecture review"

# Set free mode as default
opencli config set defaultFree true
```

See [docs/FREE-TIER.md](docs/FREE-TIER.md) for setup guides and daily limits.

---

## 🖼 Image & Video Generation

Generate images and videos directly from the terminal:

```bash
# Generate an image
opencli --image "a futuristic terminal interface, dark theme, neon green"

# Generate a video (short clip)
opencli --video "code flowing through a neural network, cinematic"

# Inside REPL
/image dark fantasy landscape with glowing runes
```

**Supported providers:**
- DALL-E 3 (OpenAI) — photorealistic and artistic
- Stable Diffusion via Replicate — fine-grained control
- Flux via fal.ai — high-quality, fast
- Imagine via HuggingFace — free tier available

Images are saved to `~/.opencli/images/` and the path is printed to the terminal. In supported terminals (iTerm2, Kitty), images render inline.

---

## ⚙️ Configuration

Config file location: `~/.config/opencli/config.json`

```json
{
  "defaultModel": "claude-sonnet-4-5",
  "defaultSkill": "default",
  "defaultFree": false,
  "theme": "dark",
  "autoApprove": false,
  "autoApproveLevel": "low",
  "showCost": true,
  "showTokens": false,
  "maxTokens": 8192,
  "temperature": 0.7,
  "contextFiles": [],
  "profiles": {
    "work": { "defaultModel": "gpt-4o", "defaultSkill": "typescript" },
    "personal": { "defaultModel": "gemini-2.0-flash", "defaultFree": true }
  },
  "mcpServers": {
    "enabled": ["filesystem", "shell", "git", "browser", "http", "search"],
    "github": { "token": "" },
    "postgres": { "url": "" },
    "redis": { "url": "" },
    "slack": { "token": "" }
  },
  "notifications": {
    "telegram": { "enabled": false, "token": "", "chatId": "" },
    "discord": { "enabled": false, "webhookUrl": "" }
  },
  "sync": {
    "enabled": false,
    "autoSync": false
  }
}
```

Edit interactively:
```bash
opencli config          # Open config in $EDITOR
opencli config get      # Print current config
opencli config set defaultModel gpt-4o
opencli config set theme light
```

---

## 📖 Documentation

| Document | Description |
|----------|-------------|
| [docs/INSTALLATION.md](docs/INSTALLATION.md) | Full setup guide, Node.js requirements |
| [docs/PROVIDERS.md](docs/PROVIDERS.md) | All 17 AI providers: API keys, free tiers, models |
| [docs/FREE-TIER.md](docs/FREE-TIER.md) | Use Open CLI 100% free |
| [docs/ENSEMBLE.md](docs/ENSEMBLE.md) | AI Ensemble Mode guide |
| [docs/IPC-MULTIWINDOW.md](docs/IPC-MULTIWINDOW.md) | Multi-window workspace guide |
| [docs/SYNC.md](docs/SYNC.md) | Cross-device sync setup |
| [docs/SKILLS.md](docs/SKILLS.md) | All built-in skills reference |
| [docs/MCP-SERVERS.md](docs/MCP-SERVERS.md) | MCP servers reference |
| [docs/BROWSER-AUTOMATION.md](docs/BROWSER-AUTOMATION.md) | Playwright browser integration |
| [docs/AGENT-SYSTEM.md](docs/AGENT-SYSTEM.md) | Background agents setup |
| [docs/NOTIFICATIONS.md](docs/NOTIFICATIONS.md) | Telegram & Discord setup |
| [docs/CONFIGURATION.md](docs/CONFIGURATION.md) | Full config file reference |
| [docs/CLI-FLAGS.md](docs/CLI-FLAGS.md) | All flags and commands |
| [docs/SECURITY.md](docs/SECURITY.md) | Safety sandbox and security details |

---

## 🤝 Contributing

Contributions are welcome! Open CLI is built with TypeScript 5.x and Node.js 20+.

```bash
# Clone and set up
git clone https://github.com/rythmmcosta/open-cli.git
cd open-cli
npm install
npm run build

# Link for local testing
npm link
opencli "test my local build"

# Run in development mode (watch)
npm run dev
```

**How to contribute:**

1. **New Skill** — Add a new `Skill` object in `src/skills/definitions.ts`. Each skill needs an `id`, `name`, `description`, `systemPrompt`, and `examples`.
2. **New MCP Server** — Add an `MCPServer` in `src/mcp/registry.ts` and implement tools in `src/mcp/<name>.ts`.
3. **New AI Provider** — Add provider config in `src/providers/` and register in the provider registry.
4. **Bug Fix / Enhancement** — Open an issue first for significant changes. For small fixes, a PR is fine directly.

**Code style:** TypeScript strict mode, ESLint + Prettier. Run `npm run lint` before submitting.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full contributing guide.

---

## 📄 License

MIT — [Rythmm Costa](https://github.com/rythmmcosta) — [opencli.myowncloud.tech](https://opencli.myowncloud.tech)

---

<div align="center">

**⚡ Open CLI — One CLI. Every AI. Zero Limits.**

[Website](https://opencli.myowncloud.tech) · [npm](https://www.npmjs.com/package/open-cli) · [Issues](https://github.com/rythmmcosta/open-cli/issues) · [Discussions](https://github.com/rythmmcosta/open-cli/discussions)

</div>
