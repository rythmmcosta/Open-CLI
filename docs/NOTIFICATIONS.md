# Notifications — Telegram & Discord

Stay informed about your CLI tasks even when you're away from your computer.

## Overview

Open CLI can send rich notifications to **Telegram** and/or **Discord** for:
- Agent completions (build done, tests passed, deploy finished)
- Task results from one-shot commands (`opencli --notify "run tests"`)
- Error alerts from background processes
- Custom messages via `/notify send`

## Telegram Setup

### 1. Create a Bot

1. Open Telegram, search for **@BotFather**
2. Send `/newbot`
3. Choose a name and username
4. Copy the **bot token** (format: `1234567890:ABC-...`)

### 2. Get Your Chat ID

1. Message your new bot (send anything)
2. Run the setup — it auto-detects your chat ID:

```bash
opencli notify setup
# Select: "Set up Telegram"
# Paste your bot token
# Open CLI auto-fetches your chat ID
```

Or find it manually via [@userinfobot](https://t.me/userinfobot).

### 3. Test

```bash
opencli notify test
# You'll receive: "🧪 Test Notification"
```

## Discord Setup

### 1. Create a Webhook

1. Open your Discord server
2. Go to a channel → **Settings** → **Integrations** → **Webhooks**
3. Click **New Webhook**
4. Copy the **Webhook URL**

### 2. Configure

```bash
opencli notify setup
# Select: "Set up Discord Webhook"
# Paste the webhook URL
```

## Using Notifications

### One-shot with notification

```bash
opencli --notify "run npm test and report results"
# You'll receive a notification when the task completes
```

### Agent notifications

All agents support notifications. Configure when creating:
- `start` — When agent begins
- `complete` — When agent finishes successfully
- `error` — When agent fails
- `output` — Each AI response (verbose)

### Manual notifications from REPL

```bash
# In REPL
/notify send "Deploy to staging started"
/notify send "Build failed on main branch"
```

### CLI

```bash
opencli notify send "Custom message" --level warning
opencli notify send "Task done" --title "✅ Success" --level success
```

## Notification Format

### Telegram

```
✅ Agent "code-watcher" Completed
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Agent: code-watcher
• Duration: 45s
• Tokens: 2,840

via opencli.myowncloud.tech
```

### Discord

Rich embed with:
- Colored border (green=success, red=error, yellow=warning, blue=info)
- Title and description
- Metadata fields
- Timestamp
- Footer: `opencli.myowncloud.tech`

## Notification Levels

| Level | Color | Icon |
|-------|-------|------|
| `info` | Blue | ℹ️ |
| `success` | Green | ✅ |
| `warning` | Yellow | ⚠️ |
| `error` | Red | ❌ |

## Config File

Notification config is stored at:
```
~/.config/opencli/notifications.json
```

```json
{
  "telegram": {
    "botToken": "1234567890:ABC-...",
    "chatId": "987654321",
    "enabled": true
  },
  "discord": {
    "webhookUrl": "https://discord.com/api/webhooks/...",
    "enabled": true
  }
}
```

## Privacy

- Bot tokens are stored locally only
- Messages are sent directly to Telegram/Discord APIs
- No data passes through opencli.myowncloud.tech servers

## Toggle On/Off

```bash
opencli notify setup
# Select: "Toggle Telegram on/off"
# or "Toggle Discord on/off"
```

Or in REPL:
```
/notify setup → Toggle Telegram
```
