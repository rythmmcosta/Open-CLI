# Configuration Reference

Open CLI stores all configuration in:
```
~/.config/opencli/config.json      ← main config
~/.config/opencli/notifications.json ← notification settings
~/.config/opencli/agents/state.json  ← agent definitions
~/.config/opencli/screenshots/       ← browser screenshots
```

View config path:
```bash
opencli config
```

## Main Config Fields

```json
{
  "defaultModel": "claude-opus-4-5",
  "activeSkill": "default",
  "autoApprove": false,
  "dryRun": false,
  "contextWindow": 20,
  "showUsage": false,
  "providers": {
    "anthropic": { "apiKey": "sk-ant-..." },
    "openai": { "apiKey": "sk-..." },
    "gemini": { "apiKey": "AIza..." },
    "ollama": { "baseUrl": "http://localhost:11434" }
  },
  "profiles": {
    "work": {
      "model": "gpt-4o",
      "autoApprove": true,
      "system": "You are a senior backend engineer. Be concise."
    },
    "local": {
      "model": "ollama:llama3.2",
      "autoApprove": false,
      "system": "You are a helpful terminal assistant."
    },
    "review": {
      "model": "claude-opus-4-5",
      "autoApprove": false,
      "system": "You are a strict code reviewer. Point out every issue."
    }
  }
}
```

## Field Reference

| Field | Default | Description |
|-------|---------|-------------|
| `defaultModel` | `claude-opus-4-5` | AI model used when no `--model` flag |
| `activeSkill` | `default` | Active skill (domain specialization) |
| `autoApprove` | `false` | Skip [Y/n] prompts for low-risk commands |
| `dryRun` | `false` | Preview tools without executing |
| `contextWindow` | `20` | Max messages kept in conversation |
| `showUsage` | `false` | Show token usage after each response |

## Profiles

Profiles let you save and switch between sets of config:

```bash
# Apply a profile
/profile work
opencli --profile work "refactor the auth service"

# Create via config file
# Add to ~/.config/opencli/config.json under "profiles"
```

## Environment Variables

You can set API keys via environment variables instead of config:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
export OPENAI_API_KEY="sk-..."
export GEMINI_API_KEY="AIza..."
```

Add to `~/.zshrc` or `~/.bashrc` to persist.

## Runtime Overrides

```bash
# These apply for the current session only
opencli --model gpt-4o "..."    # override model
opencli --skill python "..."    # override skill
opencli --yes "..."             # override autoApprove
opencli --dry-run "..."         # override dryRun
opencli --show-cost "..."       # show usage this run
```

## Project-level Config

Create a `.opencli` file in your project directory:

```yaml
model: ollama:llama3.2
skill: vuejs
system: "You are working on a Vue 3 + TypeScript project. Always use Composition API."
autoApprove: true
```

*(Project config support coming in a future version)*
