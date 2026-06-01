# Built-in Skills

Skills specialize the AI for specific domains. Each skill has a deep system prompt tuned for that technology.

```bash
/skill <name>          # Switch skill in REPL
opencli --skill <name> # Use skill for one command
/skills                # List all skills
opencli skills         # CLI list
```

## All 20 Skills

### ⚡ `default` — General Purpose
The default assistant for any developer task. Balanced expertise across all areas.

---

### 🔥 `vibe-coding` — Vibe Coding
Creative AI-first development. Bias toward action, modern stacks, shadcn/ui, Tailwind, rapid iteration.

**Best for:** Rapid prototyping, greenfield projects, aesthetic UI work

---

### 💚 `vuejs` — Vue.js 3
Vue 3 Composition API with `<script setup>`, Pinia, Vue Router 4, VueUse, Nuxt 3.

**Best for:** Vue 3 components, Pinia stores, Vue Router guards

---

### ⚛ `react` — React 18+
React 18 + Next.js 14 App Router, Server Components, Zustand, TanStack Query.

**Best for:** React hooks, Next.js pages, server/client components

---

### 🟨 `javascript` — JavaScript
Vanilla JS ES2024+, Web APIs, DOM manipulation, async patterns, Node.js.

**Best for:** Pure JS features, browser APIs, no-framework work

---

### 🎨 `html-css` — HTML & CSS
Semantic HTML5, CSS Grid/Flexbox, custom properties, container queries, scroll animations.

**Best for:** Layouts, animations, accessibility, responsive design

---

### ✨ `gsap` — GSAP Animations
GSAP 3, ScrollTrigger, SplitText, MorphSVG, timeline orchestration.

**Best for:** Complex animations, scroll-driven effects, SVG animation

---

### 🐘 `php` — PHP
PHP 8.2+, Laravel (latest), Pest testing, Eloquent ORM, Livewire, Inertia.js.

**Best for:** Laravel APIs, Eloquent models, WordPress development

---

### 🟢 `nodejs` — Node.js
Node.js, Express, Fastify, GraphQL, Prisma, Redis, JWT, WebSockets.

**Best for:** REST/GraphQL APIs, backend services, real-time features

---

### 🌿 `git` — Git & GitHub
Git workflows, GitHub Actions, branch strategies, commit conventions, GitOps.

**Best for:** CI/CD pipelines, git history cleanup, GitHub Actions

---

### 📘 `typescript` — TypeScript 5.x
Advanced TypeScript: generics, conditional types, mapped types, template literals, decorators.

**Best for:** Complex type definitions, type-safe utilities, strict TypeScript

---

### 🐍 `python` — Python 3.12+
Python with FastAPI, async SQLAlchemy, Pydantic, Pytest, Polars, uv.

**Best for:** FastAPI services, data processing, CLI tools in Python

---

### 🦀 `rust` — Rust
Rust ownership model, Tokio async, Axum web framework, Serde, Rayon.

**Best for:** Systems programming, performance-critical code, CLI tools in Rust

---

### 🐳 `docker` — Docker & DevOps
Docker, docker-compose, Kubernetes, Terraform, GitHub Actions, CI/CD.

**Best for:** Dockerfiles, compose stacks, Kubernetes manifests, pipelines

---

### 🗄️ `database` — Database
PostgreSQL, MySQL, MongoDB, Redis, Prisma, Drizzle, query optimization.

**Best for:** Schema design, query optimization, migrations, aggregations

---

### 🧪 `testing` — Testing
Playwright E2E, Vitest, Jest, React Testing Library, test strategies.

**Best for:** Writing tests, mocking, E2E flows, coverage improvement

---

### 🎨 `tailwind` — Tailwind CSS 4.x
Tailwind 4, dark mode, animations, shadcn/ui, cva, responsive design.

**Best for:** Tailwind components, dark mode, design systems

---

### 🔐 `security` — Security
OWASP Top 10, secure coding, JWT, cryptography, rate limiting, input validation.

**Best for:** Security audits, auth flows, hardening existing code

---

### 👁️ `browser-automation` — Browser Automation
Open CLI browser tools: navigate, screenshot, verify, extract with Playwright.

**Best for:** Web scraping, E2E testing, UI verification, site monitoring

---

## Switching Skills

```bash
# In REPL
/skill vuejs
/skill default

# One-shot
opencli --skill gsap "create a scroll animation for hero section"

# With model
opencli --skill python --model gpt-4o "write a FastAPI endpoint"
```

## Skill + Profile

Save a skill to a profile for quick access:

```bash
# ~/.config/opencli/config.json
{
  "profiles": {
    "frontend": {
      "model": "claude-opus-4-5",
      "skill": "vuejs"
    },
    "backend": {
      "model": "gpt-4o",
      "skill": "nodejs"
    }
  }
}
```

Then: `/profile frontend` or `opencli --profile frontend`
