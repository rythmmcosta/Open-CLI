# Open CLI on Termux (Android)

> Full Open CLI works on Termux **except** browser automation (Playwright requires a desktop OS).

## Step 1 — Install Termux

Get Termux from **F-Droid** (not Play Store — the Play Store version is outdated):
- [f-droid.org/packages/com.termux](https://f-droid.org/packages/com.termux/)

## Step 2 — Install Required Packages

Open Termux and run:

```bash
# Update package list
pkg update && pkg upgrade -y

# Node.js (includes npm)
pkg install nodejs

# Git
pkg install git

# Build tools (needed for better-sqlite3 native module)
pkg install python make clang

# Optional but useful
pkg install openssh curl
```

Verify:
```bash
node --version   # v22.x or 20.x
npm --version    # 10.x
```

## Step 3 — Clone & Install

```bash
# Clone the repo
git clone https://github.com/rythmmcosta/open-cli.git
cd open-cli

# Install dependencies (better-sqlite3 will compile natively — takes ~2 min)
npm install

# Build TypeScript
npm run build

# Make available globally
npm link
```

## Step 4 — Configure API Keys

```bash
opencli auth
```

Select a provider and paste your API key. Recommended for Termux (no cost):
- **Ollama** — If you run Ollama on your home PC, point to its IP:
  `http://YOUR_PC_IP:11434`
- **Anthropic / OpenAI / Gemini** — Works with API keys normally

## Step 5 — First Run

```bash
opencli "list all files in current directory"
opencli          # interactive REPL
```

## What Works on Termux

| Feature | Status | Notes |
|---------|--------|-------|
| All AI providers (Claude, GPT, Gemini) | ✅ Full | API keys work |
| Ollama (local AI) | ✅ Full | Point to PC IP |
| All 20 skills | ✅ Full | `/skill python`, `/skill vuejs`, etc. |
| File tools (read/write/search) | ✅ Full | |
| Shell execution | ✅ Full | Safety sandbox included |
| Git tools | ✅ Full | |
| HTTP requests | ✅ Full | |
| SQLite database tools | ✅ Full | Native build required |
| Docker tools | ✅ Full | If Docker is accessible |
| Web search + fetch | ✅ Full | |
| Agent system | ✅ Full | Background processes work |
| Telegram/Discord notifications | ✅ Full | |
| Interactive REPL | ✅ Full | |
| Pipe mode | ✅ Full | `cat file \| opencli "..."` |
| **Browser automation (Playwright)** | ❌ N/A | No Chromium on Android ARM |

## Ollama on Your Home PC

If you run Ollama on your home computer and want to use it from your phone:

**On your PC:**
```bash
# Start Ollama listening on all interfaces
OLLAMA_HOST=0.0.0.0:11434 ollama serve
```

**In Termux:**
```bash
opencli auth
# Select Ollama
# URL: http://YOUR_PC_LOCAL_IP:11434
# e.g. http://192.168.1.100:11434
```

Then use it:
```bash
opencli --model ollama:llama3.2 "explain this code"
```

## Notifications from Termux

This is a great use case — run a long task and get notified on the same phone:

```bash
# Set up Telegram bot
opencli notify setup

# Run with notification
opencli --notify "run all tests and fix any failures"
# → You get a Telegram message when it's done
```

## Storage Permission (if needed)

If you want to access your phone's storage from scripts:

```bash
termux-setup-storage
# Tap "Allow" in the popup
# Your phone storage is now at ~/storage/
```

## Troubleshooting

### `better-sqlite3` build fails
```bash
# Make sure build tools are installed
pkg install python make clang

# Try rebuilding
cd open-cli
npm rebuild better-sqlite3
```

### `node` not found after install
```bash
pkg install nodejs-lts
```

### Permission denied on `npm link`
```bash
# Termux npm global bin is writable, this shouldn't happen
# If it does:
export PREFIX=$HOME/.npm-global
mkdir -p $PREFIX
npm config set prefix $PREFIX
echo 'export PATH=$HOME/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

### `figlet` ASCII art looks wrong
Some Termux fonts don't render the ANSI Shadow font well. Use a monospace font:
- In Termux: Long press → **More** → **Style** → choose a Nerd Font or monospace

### Out of memory during npm install
```bash
# Limit Node.js memory
node --max-old-space-size=512 $(which npm) install
```

## Config Location on Android

Open CLI config is stored at:
```
/data/data/com.termux/files/home/.config/opencli/config.json
```

Which in Termux is just:
```
~/.config/opencli/config.json
```

## Update Open CLI

```bash
cd open-cli
git pull
npm install
npm run build
```
