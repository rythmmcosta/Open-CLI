## Description

A clear and concise description of what this PR does and why.

Closes #<!-- issue number, if applicable -->

## Type of Change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing behavior to change)
- [ ] New skill (adds a new domain skill to `src/skills/definitions.ts`)
- [ ] New MCP server (adds a new MCP server to `src/mcp/`)
- [ ] New AI provider (adds a new provider to `src/providers/`)
- [ ] Documentation update
- [ ] Refactor / code cleanup
- [ ] Performance improvement
- [ ] CI / tooling change

## Testing Done

Describe the testing you performed to verify your changes:

- [ ] Ran `npm run build` — no TypeScript errors
- [ ] Ran `npm run lint` — no lint errors
- [ ] Tested manually with `opencli <command>`
- [ ] Ran existing test suite — all tests pass
- [ ] Added new tests for the changed functionality

**Manual test steps:**

```bash
# Paste the commands you ran to verify this works
opencli ...
```

**Expected output:**

```
Paste what you saw
```

## Screenshots

If this PR changes any UI, terminal output, or visual behavior, include before/after screenshots.

| Before | After |
|--------|-------|
| | |

## Checklist

- [ ] My code follows the project's TypeScript strict mode style
- [ ] I have added or updated relevant documentation
- [ ] I have not included API keys, passwords, or credentials
- [ ] Dependency changes (if any) are reflected in `package.json` and `package-lock.json`
- [ ] For new skills: system prompt is comprehensive and includes examples
- [ ] For new MCP servers: tools are defined with proper JSON schemas
