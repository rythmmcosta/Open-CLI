# Installation Guide

## Prerequisites

| Tool | Required | Check |
|------|----------|-------|
| Node.js | 18+ | `node --version` |
| npm | 8+ | `npm --version` |
| Git | any | `git --version` |

```bash
# Install Node.js with nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install 20
nvm use 20
```

## Install

```bash
# 1. Clone
git clone https://github.com/rythmmcosta/open-cli.git
cd open-cli

# 2. Install dependencies
npm install

# 3. Build TypeScript
npm run build

# 4. Link globally (makes 'opencli' available everywhere)
npm link

# 5. Verify
opencli --version
```

## Configure Providers

```bash
opencli auth
```

Follow the interactive prompts to add API keys for:
- **Anthropic Claude** — [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
- **OpenAI GPT** — [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- **Google Gemini** — [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
- **Ollama** — Free, local: `ollama serve`

## Optional: Browser Automation

Required for `opencli browser` and browser tools in agent mode:

```bash
opencli browser install
# or
npx playwright install chromium
```

## Optional: Notifications

```bash
opencli notify setup
# Configure Telegram bot and/or Discord webhook
```

See [NOTIFICATIONS.md](NOTIFICATIONS.md) for full setup.

## First Run

```bash
opencli "list all TypeScript files in the current directory"
opencli             # Start interactive REPL
opencli --skill vuejs "create a todo component"
```

## Updating

```bash
cd open-cli
git pull
npm install
npm run build
```
