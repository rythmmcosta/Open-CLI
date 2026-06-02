const { createApp, ref, computed, onMounted, watch } = Vue;

const API = '../api';
const token = () => localStorage.getItem('opencli_token');
const authHeaders = () => ({ 'Authorization': 'Bearer ' + token(), 'Content-Type': 'application/json' });

async function api(path, opts = {}) {
  const res = await fetch(API + path, { headers: authHeaders(), ...opts });
  if (res.status === 401) { localStorage.removeItem('opencli_token'); location.reload(); }
  return res.json().catch(() => ({}));
}

const SKILLS = [
  { id: 'vibe', name: 'Vibe Coding', icon: '🔥', category: 'Frontend', description: 'Creative AI-first development', tags: ['creative','rapid'] },
  { id: 'vue', name: 'Vue.js 3', icon: '💚', category: 'Frontend', description: 'Vue 3 Composition API, Pinia, Router', tags: ['vue','frontend'] },
  { id: 'react', name: 'React 18+', icon: '⚛', category: 'Frontend', description: 'Hooks, Next.js 14, Server Components', tags: ['react','nextjs'] },
  { id: 'nextjs', name: 'Next.js 15', icon: '▲', category: 'Frontend', description: 'App Router, Server Actions, Turbopack', tags: ['nextjs','typescript'] },
  { id: 'svelte', name: 'Svelte 5', icon: '🔸', category: 'Frontend', description: 'Svelte 5 runes, SvelteKit 2', tags: ['svelte','frontend'] },
  { id: 'javascript', name: 'JavaScript', icon: '🟨', category: 'Frontend', description: 'Vanilla JS, ES2024+, DOM, Web APIs', tags: ['js','dom'] },
  { id: 'html-css', name: 'HTML & CSS', icon: '🎨', category: 'Frontend', description: 'Semantic HTML5, modern CSS, responsive', tags: ['html','css'] },
  { id: 'gsap', name: 'GSAP Animations', icon: '✨', category: 'Frontend', description: 'GSAP 3, ScrollTrigger, timelines', tags: ['gsap','animation'] },
  { id: 'tailwind', name: 'Tailwind CSS 4', icon: '🎯', category: 'Frontend', description: 'Utility-first CSS, dark mode, animations', tags: ['tailwind','css'] },
  { id: 'threejs', name: 'Three.js / 3D', icon: '🎮', category: 'Frontend', description: 'WebGL, R3F, shaders, 3D scenes', tags: ['threejs','webgl'] },
  { id: 'nodejs', name: 'Node.js', icon: '🟢', category: 'Backend', description: 'Express, Fastify, REST & GraphQL APIs', tags: ['nodejs','backend'] },
  { id: 'python', name: 'Python 3.12+', icon: '🐍', category: 'Backend', description: 'FastAPI, async, data science, ML', tags: ['python','fastapi'] },
  { id: 'php', name: 'PHP 8.2+', icon: '🐘', category: 'Backend', description: 'Laravel, WordPress, Composer, OOP', tags: ['php','laravel'] },
  { id: 'go', name: 'Go (Golang)', icon: '🐹', category: 'Backend', description: 'Goroutines, Gin/Echo/Fiber, testing', tags: ['go','backend'] },
  { id: 'java', name: 'Java 21', icon: '☕', category: 'Backend', description: 'Spring Boot 3.x, virtual threads, JUnit 5', tags: ['java','spring'] },
  { id: 'csharp', name: 'C# / .NET 8', icon: '🔷', category: 'Backend', description: 'ASP.NET Core, EF Core 8, xUnit', tags: ['csharp','dotnet'] },
  { id: 'rust', name: 'Rust', icon: '🦀', category: 'Backend', description: 'Ownership, lifetimes, Tokio, WASM', tags: ['rust','systems'] },
  { id: 'graphql', name: 'GraphQL', icon: '🔮', category: 'Backend', description: 'Apollo 4, DataLoader, subscriptions', tags: ['graphql','api'] },
  { id: 'elixir', name: 'Elixir / Phoenix', icon: '💧', category: 'Backend', description: 'OTP, LiveView, Ecto, real-time', tags: ['elixir','otp'] },
  { id: 'react-native', name: 'React Native', icon: '📱', category: 'Mobile', description: 'Expo SDK 51, Expo Router, Reanimated', tags: ['rn','expo'] },
  { id: 'flutter', name: 'Flutter', icon: '🦋', category: 'Mobile', description: 'Dart 3, Riverpod 2, GoRouter', tags: ['flutter','dart'] },
  { id: 'swift', name: 'Swift / iOS', icon: '🍎', category: 'Mobile', description: 'SwiftUI, UIKit, Combine, Core Data', tags: ['swift','ios'] },
  { id: 'kotlin', name: 'Kotlin / Android', icon: '🤖', category: 'Mobile', description: 'Jetpack Compose, Coroutines, Room', tags: ['kotlin','android'] },
  { id: 'docker', name: 'Docker & DevOps', icon: '🐳', category: 'DevOps', description: 'Docker, compose, K8s, CI/CD', tags: ['docker','devops'] },
  { id: 'kubernetes', name: 'Kubernetes', icon: '🎡', category: 'DevOps', description: 'Helm 3, ArgoCD, RBAC, HPA', tags: ['k8s','helm'] },
  { id: 'aws', name: 'AWS', icon: '☁', category: 'DevOps', description: 'CDK v2, Lambda, API Gateway, DynamoDB', tags: ['aws','serverless'] },
  { id: 'terraform', name: 'Terraform / IaC', icon: '🏗', category: 'DevOps', description: 'AWS/GCP/Azure, modules, state', tags: ['terraform','iac'] },
  { id: 'cicd', name: 'CI/CD Pipelines', icon: '🔄', category: 'DevOps', description: 'GitHub Actions, GitLab CI, Jenkins', tags: ['github-actions','cicd'] },
  { id: 'nginx', name: 'Nginx', icon: '🟩', category: 'DevOps', description: 'Server blocks, reverse proxy, SSL/TLS', tags: ['nginx','ssl'] },
  { id: 'git', name: 'Git & GitHub', icon: '🌿', category: 'DevOps', description: 'Git workflows, branching, CI/CD', tags: ['git','github'] },
  { id: 'bash', name: 'Shell Scripting', icon: '🖥', category: 'DevOps', description: 'Bash 5, getopts, awk, sed, jq', tags: ['bash','linux'] },
  { id: 'ml', name: 'Machine Learning', icon: '🤖', category: 'AI/ML', description: 'PyTorch 2.x, scikit-learn, HuggingFace', tags: ['pytorch','sklearn'] },
  { id: 'codex', name: 'Codex / Code-Only', icon: '⚙', category: 'AI/ML', description: 'Pure code output, no explanations', tags: ['codex','code-only'] },
  { id: 'browser', name: 'Browser Automation', icon: '👁', category: 'AI/ML', description: 'Playwright: navigate, screenshot, extract', tags: ['playwright','automation'] },
  { id: 'typescript', name: 'TypeScript 5.x', icon: '📘', category: 'Languages', description: 'Generics, decorators, strict mode', tags: ['typescript','types'] },
  { id: 'cpp', name: 'C++', icon: '⚙', category: 'Languages', description: 'STL, memory, RAII, templates, CUDA', tags: ['cpp','systems'] },
  { id: 'r-lang', name: 'R / Data Science', icon: '📊', category: 'Languages', description: 'Tidyverse, ggplot2, Shiny, ML', tags: ['r','statistics'] },
  { id: 'regex', name: 'Regex', icon: '🔤', category: 'Languages', description: 'PCRE patterns in JS, Python, Go', tags: ['regex','patterns'] },
  { id: 'wasm', name: 'WebAssembly', icon: '🕸', category: 'Languages', description: 'Rust→WASM, AssemblyScript, WASI', tags: ['wasm','rust'] },
  { id: 'database', name: 'Databases', icon: '🗄', category: 'Data', description: 'PostgreSQL, MySQL, MongoDB, Redis', tags: ['postgresql','mongodb'] },
  { id: 'prisma', name: 'Prisma ORM', icon: '🔺', category: 'Data', description: 'Prisma 5.x, migrations, Client', tags: ['prisma','orm'] },
  { id: 'testing', name: 'Testing', icon: '🧪', category: 'DevOps', description: 'Playwright E2E, Vitest, Jest, TDD', tags: ['playwright','vitest'] },
  { id: 'security', name: 'Security', icon: '🔐', category: 'DevOps', description: 'OWASP Top 10, auth, JWT, XSS, SQLi', tags: ['security','owasp'] },
  { id: 'solidity', name: 'Solidity / Web3', icon: '⟠', category: 'Web3', description: 'ERC-20/721, Hardhat, Foundry, DeFi', tags: ['solidity','ethereum'] },
  { id: 'wordpress', name: 'WordPress', icon: '🌐', category: 'WordPress', description: 'Themes, plugins, WooCommerce, ACF, WP-CLI', tags: ['wordpress','woocommerce'] },
  { id: 'general', name: 'General Purpose', icon: '⚡', category: 'General', description: 'No skill restriction — any developer task', tags: ['general'] },
];

const PROVIDERS = [
  { name: 'Claude', icon: '🟣', status: 'setup', docsUrl: 'https://console.anthropic.com/' },
  { name: 'OpenAI GPT', icon: '🟢', status: 'setup', docsUrl: 'https://platform.openai.com/' },
  { name: 'Google Gemini', icon: '🔵', status: 'free', docsUrl: 'https://aistudio.google.com/' },
  { name: 'Groq', icon: '⚡', status: 'free', docsUrl: 'https://console.groq.com/' },
  { name: 'DeepSeek', icon: '🐋', status: 'free', docsUrl: 'https://platform.deepseek.com/' },
  { name: 'Mistral', icon: '🌊', status: 'free', docsUrl: 'https://console.mistral.ai/' },
  { name: 'Cohere', icon: '🪸', status: 'free', docsUrl: 'https://dashboard.cohere.com/' },
  { name: 'Perplexity', icon: '🔍', status: 'setup', docsUrl: 'https://www.perplexity.ai/settings/api' },
  { name: 'xAI Grok', icon: '❎', status: 'setup', docsUrl: 'https://x.ai/' },
  { name: 'Kimi', icon: '🌙', status: 'setup', docsUrl: 'https://platform.moonshot.cn/' },
  { name: 'Together AI', icon: '🔗', status: 'setup', docsUrl: 'https://api.together.xyz/' },
  { name: 'Cerebras', icon: '🧠', status: 'free', docsUrl: 'https://inference.cerebras.ai/' },
  { name: 'HuggingFace', icon: '🤗', status: 'free', docsUrl: 'https://huggingface.co/settings/tokens' },
  { name: 'Azure OpenAI', icon: '☁', status: 'setup', docsUrl: 'https://azure.microsoft.com/en-us/products/ai-services/openai-service' },
  { name: 'AWS Bedrock', icon: '🛡', status: 'setup', docsUrl: 'https://aws.amazon.com/bedrock/' },
  { name: 'Ollama', icon: '🏠', status: 'free', docsUrl: 'https://ollama.com/' },
  { name: 'OpenRouter', icon: '🔓', status: 'free', docsUrl: 'https://openrouter.ai/' },
];

createApp({
  setup() {
    // Auth state
    const isLoggedIn = ref(!!localStorage.getItem('opencli_token'));
    const authView = ref('login');
    const authError = ref('');
    const authLoading = ref(false);
    const loginForm = ref({ email: '', password: '' });
    const registerForm = ref({ name: '', email: '', password: '' });
    const otpCode = ref('');
    const otpCooldown = ref(0);

    // Dashboard state
    const user = ref({ name: 'User', email: '', avatar: null });
    const currentView = ref('home');
    const sidebarCollapsed = ref(false);
    const profileMenuOpen = ref(false);
    const notifOpen = ref(false);
    const globalSearch = ref('');

    // Data
    const quota = ref({ used: 0, total: 536870912 });
    const projects = ref([]);
    const devices = ref([]);
    const apiKeys = ref([]);
    const activity = ref([]);
    const sessions = ref([]);
    const snippets = ref([]);
    const webhooks = ref([]);
    const notifications = ref([]);
    const unreadNotifs = ref(0);

    // Modals
    const showNewKeyModal = ref(false);
    const newKeyName = ref('');
    const generatedKey = ref(null);
    const showNewSnippet = ref(false);
    const newSnippet = ref({ name: '', command: '', tags: '' });
    const showNewWebhook = ref(false);
    const newWebhook = ref({ url: '', event: 'sync' });

    // Skills
    const skillSearch = ref('');
    const selectedSkill = ref(null);

    // Profile/security
    const profileForm = ref({ name: '' });
    const profileMsg = ref('');
    const pwForm = ref({ current: '', newPw: '', confirm: '' });
    const pwMsg = ref('');
    const deleteConfirmEmail = ref('');

    // Image gen
    const imagePrompt = ref('');
    const imageProvider = ref('');
    const imageSize = ref('1024x1024');
    const generatedImages = ref([]);

    // Filters
    const fileSearch = ref('');
    const actFilter = ref('all');

    // Settings
    const theme = ref(localStorage.getItem('opencli-theme') || 'dark');
    const accentColor = ref('green');
    const accentColors = [
      { name: 'green', hex: '#00cc7e' }, { name: 'blue', hex: '#00b4d8' },
      { name: 'purple', hex: '#9b5fe8' }, { name: 'red', hex: '#ef4444' },
      { name: 'orange', hex: '#f59e0b' },
    ];

    // Notification prefs
    const notifPrefs = ref([
      { key: 'sync_fail', label: 'Sync Failures', desc: 'Notify when a sync fails', enabled: true },
      { key: 'quota_warn', label: 'Quota Warning', desc: 'Notify at 80% storage', enabled: true },
      { key: 'new_device', label: 'New Device Login', desc: 'Notify on new device', enabled: true },
      { key: 'weekly', label: 'Weekly Digest', desc: 'Weekly usage summary email', enabled: false },
    ]);

    // FAQ
    const faq = ref([
      { q: 'Is Open CLI free?', a: 'Yes, completely free and open source (MIT). Works with free AI tiers from Groq, Gemini, HuggingFace, and more.', open: false },
      { q: 'How do I configure AI providers?', a: 'Run "opencli auth" in your terminal. Select a provider and enter your API key. Groq, Gemini, and HuggingFace have free tiers.', open: false },
      { q: 'What is the sync feature?', a: 'Cross-device sync saves your projects to the cloud so you can access them from any device. 512MB free quota.', open: false },
      { q: 'Can I use it on Windows?', a: 'Yes! Use WSL2 for the best experience, or install Node.js natively. See the Install page for detailed steps.', open: false },
      { q: 'What is Ensemble Mode?', a: 'Ensemble mode queries all your configured AI providers simultaneously and synthesizes the best answer. Use "opencli --ensemble".', open: false },
    ]);

    const feedbackMsg = ref('');
    const feedbackSent = ref(false);

    const navItems = [
      { id: 'home', icon: '🏠', label: 'Dashboard' },
      { id: 'files', icon: '📁', label: 'Files' },
      { id: 'sync', icon: '🔄', label: 'Sync' },
      { id: 'devices', icon: '💻', label: 'Devices' },
      { id: 'api-keys', icon: '🔑', label: 'API Keys' },
      { id: 'analytics', icon: '📊', label: 'Analytics' },
      { id: 'skills', icon: '⚡', label: 'Skills' },
      { id: 'generate-image', icon: '🖼', label: 'Image Gen' },
      { id: 'activity', icon: '📋', label: 'Activity Log' },
      { id: 'snippets', icon: '💾', label: 'Snippets' },
      { id: 'webhooks', icon: '🔗', label: 'Webhooks' },
      { id: 'providers', icon: '🤖', label: 'Providers' },
      { id: 'quota', icon: '💿', label: 'Quota' },
      { id: 'settings-profile', icon: '👤', label: 'Profile' },
      { id: 'settings-security', icon: '🔐', label: 'Security' },
      { id: 'settings-appearance', icon: '🎨', label: 'Appearance' },
      { id: 'settings-notifications', icon: '🔔', label: 'Notifications' },
      { id: 'help', icon: '❓', label: 'Help' },
      { id: 'danger', icon: '⚠️', label: 'Danger Zone' },
    ];

    const providerStatus = ref(PROVIDERS);

    // Computed
    const quotaPct = computed(() => quota.value.total > 0 ? (quota.value.used / quota.value.total) * 100 : 0);
    const userAvatar = computed(() => user.value.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.value.name)}&background=00cc7e&color=000&size=128`);
    const currentViewLabel = computed(() => navItems.find(n => n.id === currentView.value)?.label || '');
    const filteredProjects = computed(() => projects.value.filter(p => !fileSearch.value || p.project_name.toLowerCase().includes(fileSearch.value.toLowerCase())));
    const filteredSkills = computed(() => {
      const q = skillSearch.value.toLowerCase();
      return SKILLS.filter(s => !q || s.name.toLowerCase().includes(q) || s.tags.some(t => t.includes(q)));
    });
    const filteredActivity = computed(() => {
      if (actFilter.value === 'all') return activity.value;
      return activity.value.filter(a => a.type === actFilter.value);
    });

    // Auth functions
    async function doLogin() {
      authError.value = '';
      authLoading.value = true;
      try {
        const res = await fetch(API + '/login.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(loginForm.value),
        });
        const data = await res.json();
        if (data.token) {
          localStorage.setItem('opencli_token', data.token);
          isLoggedIn.value = true;
          await loadDashboard();
        } else {
          authError.value = data.error || 'Login failed';
        }
      } catch (e) {
        authError.value = 'Network error';
      }
      authLoading.value = false;
    }

    async function doRegister() {
      authError.value = '';
      authLoading.value = true;
      try {
        const res = await fetch(API + '/register.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(registerForm.value),
        });
        const data = await res.json();
        if (data.success) {
          authView.value = 'otp';
        } else {
          authError.value = data.error || 'Registration failed';
        }
      } catch (e) {
        authError.value = 'Network error';
      }
      authLoading.value = false;
    }

    async function doVerify() {
      authError.value = '';
      authLoading.value = true;
      try {
        const res = await fetch(API + '/verify.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: registerForm.value.email, otp: otpCode.value }),
        });
        const data = await res.json();
        if (data.token) {
          localStorage.setItem('opencli_token', data.token);
          isLoggedIn.value = true;
          await loadDashboard();
        } else {
          authError.value = data.error || 'Verification failed';
        }
      } catch (e) {
        authError.value = 'Network error';
      }
      authLoading.value = false;
    }

    function resendOtp() {
      otpCooldown.value = 60;
      const t = setInterval(() => { if (--otpCooldown.value <= 0) clearInterval(t); }, 1000);
      fetch(API + '/register.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: registerForm.value.email, resend: true }),
      });
    }

    function oauthGoogle() {
      window.open(`${API}/oauth-google.php?redirect=${encodeURIComponent(location.href)}`, '_self');
    }
    function oauthFacebook() {
      window.open(`${API}/oauth-facebook.php?redirect=${encodeURIComponent(location.href)}`, '_self');
    }
    function oauthGithub() {
      window.open(`${API}/oauth-github.php`, '_self');
    }
    function doLogout() {
      localStorage.removeItem('opencli_token');
      isLoggedIn.value = false;
      authView.value = 'login';
    }

    // Dashboard load
    async function loadDashboard() {
      try {
        const [me, q, proj, devs] = await Promise.all([
          api('/me.php'), api('/quota.php'), api('/sync-list.php'), api('/devices.php').catch(() => ({ devices: [] })),
        ]);
        if (me.user) { user.value = me.user; profileForm.value.name = me.user.name; }
        if (q.used !== undefined) quota.value = { used: q.used, total: q.total };
        if (proj.projects) projects.value = proj.projects;
        if (devs.devices) devices.value = devs.devices;
      } catch (e) { console.warn('Load failed', e); }

      // Load sample activity for demo
      activity.value = [
        { id: 1, icon: '🔄', message: 'Project synced from desktop', time: 'Just now', device: 'Desktop', type: 'sync' },
        { id: 2, icon: '🔐', message: 'Login from new device', time: '2 hours ago', device: 'Mobile', type: 'login' },
        { id: 3, icon: '🔑', message: 'API key generated', time: '1 day ago', device: 'Desktop', type: 'api' },
      ];
      notifications.value = [
        { id: 1, icon: '💾', message: 'Storage at 45% capacity', time: '1 hour ago', read: false },
        { id: 2, icon: '✅', message: 'Sync completed successfully', time: '2 hours ago', read: true },
      ];
      unreadNotifs.value = notifications.value.filter(n => !n.read).length;
    }

    // Navigation
    function navigate(view) {
      currentView.value = view;
      profileMenuOpen.value = false;
      notifOpen.value = false;
      if (view === 'analytics') setTimeout(initCharts, 100);
    }

    function doSearch() {}

    // Utility
    function formatBytes(b) {
      if (!b) return '0 B';
      const u = ['B','KB','MB','GB'];
      let i = 0; let n = Number(b);
      while (n >= 1024 && i < 3) { n /= 1024; i++; }
      return n.toFixed(1) + ' ' + u[i];
    }
    function formatDate(d) {
      if (!d) return '—';
      return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
    function copyText(t) {
      navigator.clipboard.writeText(t).then(() => {}).catch(() => {});
    }
    function copyInstall() { copyText('npm install -g github:rythmmcosta/open-cli'); }
    function copyImageCmd() { copyText('opencli --image "' + (imagePrompt.value || 'your prompt') + '"' + (imageProvider.value ? ' --provider ' + imageProvider.value : '')); }
    function avatarError(e) { e.target.src = 'https://ui-avatars.com/api/?name=User&background=00cc7e&color=000&size=128'; }
    function markAllRead() {
      notifications.value.forEach(n => n.read = true);
      unreadNotifs.value = 0;
    }

    // API keys
    async function generateKey() {
      const data = await api('/apikeys.php', { method: 'POST', body: JSON.stringify({ name: newKeyName.value }) });
      if (data.key) { generatedKey.value = data.key; showNewKeyModal.value = false; newKeyName.value = ''; }
    }
    async function revokeKey(k) {
      if (!confirm('Revoke this key?')) return;
      await api('/apikeys.php', { method: 'DELETE', body: JSON.stringify({ id: k.id }) });
      apiKeys.value = apiKeys.value.filter(x => x.id !== k.id);
    }
    function copyKey(k) { copyText(k.masked); }

    // Profile
    async function saveProfile() {
      const data = await api('/me.php', { method: 'POST', body: JSON.stringify({ name: profileForm.value.name }) });
      if (data.success) { user.value.name = profileForm.value.name; profileMsg.value = '✓ Saved'; setTimeout(() => profileMsg.value = '', 3000); }
    }
    async function uploadAvatar(e) {
      const file = e.target.files[0];
      if (!file) return;
      const fd = new FormData(); fd.append('avatar', file);
      const res = await fetch(API + '/avatar.php', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token() }, body: fd });
      const data = await res.json();
      if (data.url) user.value.avatar = data.url;
    }

    // Password
    async function changePassword() {
      if (pwForm.value.newPw !== pwForm.value.confirm) { pwMsg.value = 'Passwords do not match'; return; }
      const data = await api('/me.php', { method: 'POST', body: JSON.stringify({ change_password: true, current: pwForm.value.current, new_password: pwForm.value.newPw }) });
      pwMsg.value = data.success ? '✓ Password updated' : (data.error || 'Failed');
    }

    // Devices
    async function revokeDevice(d) {
      if (!confirm('Revoke this device?')) return;
      await api('/devices.php', { method: 'DELETE', body: JSON.stringify({ id: d.id }) });
      devices.value = devices.value.filter(x => x.id !== d.id);
    }

    // Projects
    async function downloadProject(p) { window.open(API + '/sync-pull.php?project=' + p.project_hash); }
    async function deleteProject(p) {
      if (!confirm('Delete ' + p.project_name + '?')) return;
      await api('/sync-list.php', { method: 'DELETE', body: JSON.stringify({ id: p.id }) });
      projects.value = projects.value.filter(x => x.id !== p.id);
    }

    // Snippets
    async function saveSnippet() {
      const data = await api('/snippets.php', { method: 'POST', body: JSON.stringify(newSnippet.value) });
      if (data.snippet) { snippets.value.push(data.snippet); showNewSnippet.value = false; newSnippet.value = { name: '', command: '', tags: '' }; }
    }
    async function deleteSnippet(s) {
      await api('/snippets.php', { method: 'DELETE', body: JSON.stringify({ id: s.id }) });
      snippets.value = snippets.value.filter(x => x.id !== s.id);
    }

    // Webhooks
    async function saveWebhook() {
      const data = await api('/webhooks.php', { method: 'POST', body: JSON.stringify(newWebhook.value) });
      if (data.webhook) { webhooks.value.push(data.webhook); showNewWebhook.value = false; newWebhook.value = { url: '', event: 'sync' }; }
    }
    async function deleteWebhook(w) {
      await api('/webhooks.php', { method: 'DELETE', body: JSON.stringify({ id: w.id }) });
      webhooks.value = webhooks.value.filter(x => x.id !== w.id);
    }
    async function testWebhook(w) {
      await api('/webhooks.php', { method: 'PUT', body: JSON.stringify({ id: w.id, test: true }) });
      alert('Test webhook sent!');
    }

    // Sessions
    async function revokeSession(s) {
      await api('/sessions.php', { method: 'DELETE', body: JSON.stringify({ id: s.id }) });
      sessions.value = sessions.value.filter(x => x.id !== s.id);
    }

    // Theme & accent
    function setTheme(t) {
      theme.value = t;
      document.documentElement.setAttribute('data-theme', t === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : t);
      localStorage.setItem('opencli-theme', t);
    }
    function setAccent(name, hex) {
      accentColor.value = name;
      document.documentElement.style.setProperty('--green', hex);
    }

    // Notifications prefs
    function saveNotifPrefs() {}

    // Danger zone
    async function exportData() {
      window.open(API + '/export.php', '_blank');
    }
    async function confirmDeleteAll() {
      if (!confirm('Delete ALL synced projects? This cannot be undone.')) return;
      for (const p of projects.value) { await api('/sync-list.php', { method: 'DELETE', body: JSON.stringify({ id: p.id }) }); }
      projects.value = [];
    }
    async function confirmDeleteAccount() {
      if (!confirm('FINAL WARNING: Delete your account permanently?')) return;
      await api('/delete-account.php', { method: 'DELETE' });
      doLogout();
    }

    // Feedback
    async function submitFeedback() {
      await api('/feedback.php', { method: 'POST', body: JSON.stringify({ message: feedbackMsg.value, email: user.value.email }) });
      feedbackSent.value = true;
      feedbackMsg.value = '';
    }

    // Charts
    function initCharts() {
      const ctx1 = document.getElementById('storageChart');
      const ctx2 = document.getElementById('syncChart');
      if (ctx1) {
        new Chart(ctx1, {
          type: 'doughnut',
          data: { labels: ['Used', 'Free'], datasets: [{ data: [quota.value.used, quota.value.total - quota.value.used], backgroundColor: ['#00cc7e', 'rgba(255,255,255,0.1)'], borderWidth: 0 }] },
          options: { plugins: { legend: { labels: { color: '#94a3b8' } } } }
        });
      }
      if (ctx2) {
        new Chart(ctx2, {
          type: 'bar',
          data: { labels: Array.from({length: 7}, (_, i) => { const d = new Date(); d.setDate(d.getDate()-6+i); return d.toLocaleDateString('en',{weekday:'short'}); }), datasets: [{ label: 'Syncs', data: [0,2,1,3,0,2,1], backgroundColor: '#00cc7e88', borderRadius: 4 }] },
          options: { plugins: { legend: { labels: { color: '#94a3b8' } } }, scales: { x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }, y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } } } }
        });
      }
    }

    onMounted(async () => {
      if (isLoggedIn.value) await loadDashboard();
      // Check for OAuth token in URL
      const urlToken = new URLSearchParams(location.search).get('token');
      if (urlToken) {
        localStorage.setItem('opencli_token', urlToken);
        isLoggedIn.value = true;
        history.replaceState({}, '', location.pathname);
        await loadDashboard();
      }
    });

    return {
      isLoggedIn, authView, authError, authLoading, loginForm, registerForm, otpCode, otpCooldown,
      user, currentView, sidebarCollapsed, profileMenuOpen, notifOpen, globalSearch,
      quota, projects, devices, apiKeys, activity, sessions, snippets, webhooks, notifications, unreadNotifs,
      showNewKeyModal, newKeyName, generatedKey, showNewSnippet, newSnippet, showNewWebhook, newWebhook,
      skillSearch, selectedSkill, profileForm, profileMsg, pwForm, pwMsg, deleteConfirmEmail,
      imagePrompt, imageProvider, imageSize, generatedImages,
      fileSearch, actFilter, theme, accentColor, accentColors, notifPrefs, faq, feedbackMsg, feedbackSent,
      navItems, providerStatus,
      quotaPct, userAvatar, currentViewLabel, filteredProjects, filteredSkills, filteredActivity,
      doLogin, doRegister, doVerify, resendOtp, oauthGoogle, oauthFacebook, oauthGithub, doLogout,
      navigate, doSearch, formatBytes, formatDate, copyText, copyInstall, copyImageCmd, avatarError, markAllRead,
      generateKey, revokeKey, copyKey, saveProfile, uploadAvatar, changePassword, revokeDevice,
      downloadProject, deleteProject, saveSnippet, deleteSnippet, saveWebhook, deleteWebhook, testWebhook,
      revokeSession, setTheme, setAccent, saveNotifPrefs, exportData, confirmDeleteAll, confirmDeleteAccount,
      submitFeedback,
    };
  }
}).mount('#app');
