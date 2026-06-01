# Built-in MCP Servers

Open CLI bundles 8 MCP-compatible tool servers. No external downloads or daemon processes required.

```bash
opencli mcp          # List all servers
/mcp list            # In REPL
```

## Servers

### 1. Filesystem MCP
**ID:** `filesystem` | **Status:** Ready

Tools for reading, writing, and searching files.

| Tool | Description |
|------|-------------|
| `read_file` | Read file content (supports line ranges) |
| `write_file` | Write/create files (creates parent dirs) |
| `list_files` | List directory contents (recursive option) |
| `search_files` | Search file contents with regex |

```
# AI uses these automatically:
"read the main.ts file"
"write a new component to src/Button.vue"
"find all usages of 'useState' in the codebase"
```

---

### 2. Shell MCP
**ID:** `shell` | **Status:** Ready

Execute shell commands with integrated safety scoring.

| Tool | Description |
|------|-------------|
| `bash` | Execute any shell command |

Every `bash` call goes through the 3-tier safety sandbox:
- LOW → auto-approve (with `-y` flag)
- MEDIUM → confirm `[Y/n]`
- HIGH → must type `"yes"`

---

### 3. Git MCP
**ID:** `git` | **Status:** Ready

Full git workflow operations.

| Tool | Description |
|------|-------------|
| `git_command` | Run any git command by passing args |

```
# AI uses automatically:
"show me the git log for the last 10 commits"
"create a new branch called feature/auth"
"what files changed in the last commit?"
```

---

### 4. Browser MCP
**ID:** `browser` | **Status:** Requires setup

Playwright-powered browser automation.

```bash
# One-time setup:
opencli browser install
# or: npx playwright install chromium
```

| Tool | Description |
|------|-------------|
| `browser_navigate` | Go to URL, returns page info |
| `browser_screenshot` | Full-page or element screenshot |
| `browser_click` | Click by CSS selector |
| `browser_type` | Type into form fields |
| `browser_scroll` | Scroll the page |
| `browser_verify` | Multi-check UI verification |
| `browser_extract` | Extract text/attributes |
| `browser_execute` | Run JavaScript in page |
| `browser_close` | Close browser session |

See [BROWSER-AUTOMATION.md](BROWSER-AUTOMATION.md) for full guide.

---

### 5. HTTP MCP
**ID:** `http` | **Status:** Ready

Make HTTP requests to any API.

| Tool | Description |
|------|-------------|
| `http_request` | GET/POST/PUT/DELETE with headers/body |

```
# AI uses automatically:
"fetch the GitHub API for my repos"
"POST to localhost:3000/api/users with this data"
"call the weather API and format the response"
```

---

### 6. Database MCP
**ID:** `database` | **Status:** Ready (requires SQLite file)

Query and manage SQLite databases.

| Tool | Description |
|------|-------------|
| `db_query` | Execute SQL queries |
| `db_schema` | Get database schema |

```
# AI uses automatically:
"show me the schema of ./data.db"
"query all users from the database where created_at > last week"
"create a new table for storing session tokens"
```

---

### 7. Docker MCP
**ID:** `docker` | **Status:** Ready (requires Docker)

Manage Docker containers and compose stacks.

| Tool | Description |
|------|-------------|
| `docker_list` | List running containers |
| `docker_logs` | Get container logs |
| `docker_exec` | Execute command in container |
| `docker_compose` | Run docker compose operations |

```
# AI uses automatically:
"show me all running containers"
"get the last 100 lines of logs from the api container"
"restart the docker-compose stack"
```

---

### 8. Search MCP
**ID:** `search` | **Status:** Ready

Web search and page fetching.

| Tool | Description |
|------|-------------|
| `web_search` | DuckDuckGo search, returns snippets |
| `fetch_page` | Fetch and extract text from any URL |

```
# AI uses automatically:
"search for the latest Tailwind CSS 4 documentation"
"fetch the content from the MDN page about CSS Grid"
```

## Adding Custom MCP Servers

Custom MCP servers can be added by implementing the `MCPServer` interface:

```typescript
// src/mcp/my-server.ts
import { ToolDef } from '../types';

export const myCustomTool: ToolDef = {
  name: 'my_tool',
  description: 'What this tool does',
  inputSchema: {
    type: 'object',
    properties: {
      input: { type: 'string', description: 'Tool input' },
    },
    required: ['input'],
  },
};
```

Then register it in `src/mcp/registry.ts` and `src/tools/index.ts`.

## MCP Protocol Compatibility

These servers implement MCP-compatible tool schemas. They expose the same JSON Schema-based input format used by the official MCP specification, making them compatible with any MCP-aware AI client.
