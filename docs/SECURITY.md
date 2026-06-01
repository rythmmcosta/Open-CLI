# Safety Sandbox

Every tool call is assessed for risk before execution.

## Risk Levels

### ✓ LOW RISK — Auto-executed

Read-only and clearly safe operations:
- `ls`, `cat`, `head`, `tail`, `grep`, `find`, `wc`
- `git status`, `git log`, `git diff`, `git show`
- `npm run`, `npm list`, `npm test`
- `echo`, `pwd`, `whoami`, `date`, `env`
- File reads, directory listings

**With `-y` flag:** All LOW risk commands run automatically without prompting.

### ⚠ MEDIUM RISK — Prompts [Y/n]

Commands requiring care or elevated access:
- `sudo` commands
- `curl | bash`, `wget | bash` (pipe-to-shell)
- `npm install -g` (global installs)
- `apt install`, `brew install`, `pip install`
- `ssh`, `scp`, `rsync` (network file ops)
- `git push --force`, `git reset --hard`
- `pkill`, `killall`, `kill -9`
- `systemctl start/stop/restart`

**Even with `-y` flag:** MEDIUM risk always prompts.

### ✕ HIGH RISK — Must type "yes"

Destructive or irreversible operations:
- `rm -rf /` or `rm -rf ~`
- `dd if=/dev/zero` (disk operations)
- `mkfs` (format drives)
- `DROP TABLE`, `TRUNCATE TABLE` (destructive SQL)
- Fork bombs
- Writing to `/etc/`, `/sys/`, `/boot/`
- `wipefs`, `shred`

**Even with `-y` flag:** HIGH risk requires typing `"yes"` in full.

## Dry Run Mode

Preview every tool call without executing:

```bash
opencli --dry-run "delete all .log files older than 30 days"
# → [DRY RUN] Would execute: find . -name "*.log" -mtime +30 -delete

opencli --dry-run "rename all console.log to logger.debug in src/"
# → [DRY RUN] Would write to src/index.ts
```

Dry run is stored per-session. Toggle in REPL with `/dry-run`.

## File Write Protection

Before writing a file that already exists, the AI shows a diff preview:

```diff
--- existing
+++ new
@@ -1,3 +1,3 @@
 const foo = 'bar';
-console.log(foo);
+logger.debug(foo);
```

## Sensitive Path Detection

Reading these paths automatically upgrades to MEDIUM risk:
- `~/.ssh/*`
- `~/.gnupg/*`
- `*.pem`, `*.key`, `*.p12`
- `.env`, `.env.local`

## Audit Log

All tool executions are logged (coming in a future version):
```
~/.config/opencli/audit.jsonl
```

## Security Best Practices

1. **Never auto-approve unknown projects** — Use `-y` only in trusted environments
2. **Review before writing** — The diff preview shows exactly what changes
3. **Use dry-run first** — Especially for cleanup and delete operations
4. **Keep API keys in config, not environment** — Config is stored with 0600 permissions
5. **Avoid sharing your config** — It contains your API keys
