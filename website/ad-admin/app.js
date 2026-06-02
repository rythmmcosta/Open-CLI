/* ============================================================
   Open CLI — Admin Panel Vue 3 App
   ============================================================ */

const { createApp, ref, reactive, computed, onMounted, watch, nextTick } = Vue;

const API = '/ad-admin/api';

createApp({
  setup() {
    // ── Auth ────────────────────────────────────────────────
    const isAuthenticated = ref(false);
    const adminPassword   = ref('');
    const authError       = ref('');
    const authLoading     = ref(false);
    const view            = ref('stats');

    const navItems = [
      { id: 'stats',         icon: '📊', label: 'Dashboard' },
      { id: 'users',         icon: '👥', label: 'Users' },
      { id: 'files',         icon: '📁', label: 'Files' },
      { id: 'chat',          icon: '💬', label: 'Chat History' },
      { id: 'announcements', icon: '📢', label: 'Announcements' },
      { id: 'security',      icon: '🛡️', label: 'Security' },
    ];

    async function checkAuth() {
      try {
        const r = await fetch(`${API}/auth.php`);
        const d = await r.json();
        isAuthenticated.value = d.authenticated === true;
        if (isAuthenticated.value) loadStats();
      } catch {
        isAuthenticated.value = false;
      }
    }

    async function doLogin() {
      if (!adminPassword.value) return;
      authLoading.value = true;
      authError.value   = '';
      try {
        const r = await fetch(`${API}/auth.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: adminPassword.value }),
        });
        const d = await r.json();
        if (d.success) {
          isAuthenticated.value = true;
          adminPassword.value   = '';
          loadStats();
        } else {
          authError.value = d.error || 'Invalid password';
        }
      } catch {
        authError.value = 'Network error. Please try again.';
      } finally {
        authLoading.value = false;
      }
    }

    async function doLogout() {
      await fetch(`${API}/auth.php`, { method: 'DELETE' });
      isAuthenticated.value = false;
      view.value = 'stats';
    }

    // ── Stats ───────────────────────────────────────────────
    const stats        = ref(null);
    const statsLoading = ref(false);
    const statsError   = ref('');

    async function loadStats() {
      statsLoading.value = true;
      statsError.value   = '';
      try {
        const r = await fetch(`${API}/stats.php`);
        if (!r.ok) throw new Error('Failed to load stats');
        stats.value = await r.json();
      } catch (e) {
        statsError.value = e.message;
      } finally {
        statsLoading.value = false;
      }
    }

    // ── Users ───────────────────────────────────────────────
    const users        = ref([]);
    const usersTotal   = ref(0);
    const userSearch   = ref('');
    const userPage     = ref(1);
    const usersLoading = ref(false);
    const selectedUser = ref(null);
    const editingUser  = reactive({ id: null, name: '', email: '', is_verified: 0, quota_bytes: 0 });
    const showEditUser = ref(false);

    async function loadUsers() {
      usersLoading.value = true;
      try {
        const url = `${API}/users.php?page=${userPage.value}&q=${encodeURIComponent(userSearch.value)}`;
        const r   = await fetch(url);
        const d   = await r.json();
        users.value      = d.users || [];
        usersTotal.value = d.total || 0;
      } finally {
        usersLoading.value = false;
      }
    }

    async function loadUserDetail(id) {
      const r = await fetch(`${API}/users.php?id=${id}`);
      selectedUser.value = await r.json();
    }

    function openEditUser(user) {
      editingUser.id           = user.id;
      editingUser.name         = user.name;
      editingUser.email        = user.email;
      editingUser.is_verified  = user.is_verified;
      editingUser.quota_bytes  = user.quota_bytes;
      showEditUser.value       = true;
    }

    async function saveEditUser() {
      await fetch(`${API}/users.php?id=${editingUser.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name:         editingUser.name,
          email:        editingUser.email,
          is_verified:  editingUser.is_verified,
          quota_bytes:  editingUser.quota_bytes,
        }),
      });
      showEditUser.value = false;
      loadUsers();
    }

    async function deleteUser(id) {
      if (!confirm('Delete this user and ALL their data? This cannot be undone.')) return;
      await fetch(`${API}/users.php?id=${id}`, { method: 'DELETE' });
      loadUsers();
      if (selectedUser.value?.id === id) selectedUser.value = null;
    }

    async function toggleVerified(user) {
      await fetch(`${API}/users.php?id=${user.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ is_verified: user.is_verified ? 0 : 1 }),
      });
      loadUsers();
    }

    let userSearchTimer = null;
    function onUserSearch() {
      clearTimeout(userSearchTimer);
      userSearchTimer = setTimeout(() => { userPage.value = 1; loadUsers(); }, 300);
    }

    function usersTotalPages() {
      return Math.max(1, Math.ceil(usersTotal.value / 20));
    }

    // ── Files ───────────────────────────────────────────────
    const files           = ref([]);
    const filesLoading    = ref(false);
    const fileUserFilter  = ref('');
    const scanResult      = ref(null);
    const scanningId      = ref(null);
    const showScanPanel   = ref(false);

    async function loadFiles() {
      filesLoading.value = true;
      try {
        const url = fileUserFilter.value
          ? `${API}/files.php?user_id=${encodeURIComponent(fileUserFilter.value)}`
          : `${API}/files.php`;
        const r = await fetch(url);
        files.value = await r.json();
      } finally {
        filesLoading.value = false;
      }
    }

    async function deleteFile(id) {
      if (!confirm('Delete this archived project? This cannot be undone.')) return;
      await fetch(`${API}/files.php?id=${id}`, { method: 'DELETE' });
      loadFiles();
    }

    async function scanFile(id) {
      scanningId.value  = id;
      scanResult.value  = { loading: true };
      showScanPanel.value = true;
      try {
        const r = await fetch(`${API}/scan.php`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ sync_package_id: id }),
        });
        scanResult.value = await r.json();
      } catch (e) {
        scanResult.value = { error: e.message };
      } finally {
        scanningId.value = null;
      }
    }

    // ── Chat ────────────────────────────────────────────────
    const chatSessions     = ref([]);
    const chatMessages     = ref([]);
    const chatLoading      = ref(false);
    const chatMsgLoading   = ref(false);
    const chatUserFilter   = ref('');
    const selectedSession  = ref(null);

    async function loadChatSessions() {
      chatLoading.value = true;
      try {
        const url = chatUserFilter.value
          ? `${API}/chat.php?user_id=${encodeURIComponent(chatUserFilter.value)}`
          : `${API}/chat.php`;
        chatSessions.value = await (await fetch(url)).json();
      } finally {
        chatLoading.value = false;
      }
    }

    async function loadMessages(sessionId) {
      if (selectedSession.value === sessionId) {
        selectedSession.value = null;
        chatMessages.value    = [];
        return;
      }
      selectedSession.value = sessionId;
      chatMsgLoading.value  = true;
      try {
        chatMessages.value = await (await fetch(`${API}/chat.php?session_id=${sessionId}`)).json();
      } finally {
        chatMsgLoading.value = false;
      }
    }

    async function deleteSession(sessionId) {
      if (!confirm('Delete this chat session and all its messages?')) return;
      await fetch(`${API}/chat.php?session_id=${sessionId}`, { method: 'DELETE' });
      if (selectedSession.value === sessionId) {
        selectedSession.value = null;
        chatMessages.value    = [];
      }
      loadChatSessions();
    }

    async function deleteMessage(messageId) {
      if (!confirm('Delete this message?')) return;
      await fetch(`${API}/chat.php?message_id=${messageId}`, { method: 'DELETE' });
      chatMessages.value = chatMessages.value.filter(m => m.id !== messageId);
    }

    let chatSearchTimer = null;
    function onChatSearch() {
      clearTimeout(chatSearchTimer);
      chatSearchTimer = setTimeout(() => loadChatSessions(), 350);
    }

    // ── Announcements ────────────────────────────────────────
    const announcements  = ref([]);
    const annLoading     = ref(false);
    const newAnn         = reactive({ title: '', message: '', level: 'info', expires_at: '' });
    const showNewAnn     = ref(false);

    async function loadAnnouncements() {
      annLoading.value = true;
      try {
        announcements.value = await (await fetch(`${API}/announcements.php`)).json();
      } finally {
        annLoading.value = false;
      }
    }

    async function createAnnouncement() {
      if (!newAnn.message) return;
      const payload = { ...newAnn };
      if (!payload.expires_at) delete payload.expires_at;
      await fetch(`${API}/announcements.php`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      newAnn.title = ''; newAnn.message = ''; newAnn.expires_at = ''; newAnn.level = 'info';
      showNewAnn.value = false;
      loadAnnouncements();
    }

    async function toggleAnnouncement(ann) {
      await fetch(`${API}/announcements.php?id=${ann.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ is_active: ann.is_active ? 0 : 1 }),
      });
      loadAnnouncements();
    }

    async function deleteAnnouncement(id) {
      if (!confirm('Delete this announcement?')) return;
      await fetch(`${API}/announcements.php?id=${id}`, { method: 'DELETE' });
      loadAnnouncements();
    }

    // ── View side effects ────────────────────────────────────
    watch(view, (v) => {
      if (v === 'stats')         loadStats();
      if (v === 'users')         { userPage.value = 1; loadUsers(); }
      if (v === 'files')         loadFiles();
      if (v === 'chat')          loadChatSessions();
      if (v === 'announcements') loadAnnouncements();
    });

    // ── Helpers ──────────────────────────────────────────────
    function formatBytes(b) {
      if (!b || b === 0) return '0 B';
      const units = ['B', 'KB', 'MB', 'GB', 'TB'];
      let i = 0;
      let n = Number(b);
      while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
      return n.toFixed(i === 0 ? 0 : 1) + ' ' + units[i];
    }

    function formatDate(d) {
      if (!d) return '—';
      return new Date(d).toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    }

    function quotaPct(used, quota) {
      if (!quota) return 0;
      return Math.min(100, Math.round((used / quota) * 100));
    }

    function quotaClass(pct) {
      if (pct >= 90) return 'danger';
      if (pct >= 70) return 'warn';
      return '';
    }

    onMounted(checkAuth);

    return {
      // Auth
      isAuthenticated, adminPassword, authError, authLoading, view, navItems,
      checkAuth, doLogin, doLogout,
      // Stats
      stats, statsLoading, statsError, loadStats,
      // Users
      users, usersTotal, userSearch, userPage, usersLoading, selectedUser,
      editingUser, showEditUser,
      loadUsers, loadUserDetail, openEditUser, saveEditUser, deleteUser,
      toggleVerified, onUserSearch, usersTotalPages,
      // Files
      files, filesLoading, fileUserFilter, scanResult, scanningId, showScanPanel,
      loadFiles, deleteFile, scanFile,
      // Chat
      chatSessions, chatMessages, chatLoading, chatMsgLoading,
      chatUserFilter, selectedSession,
      loadChatSessions, loadMessages, deleteSession, deleteMessage, onChatSearch,
      // Announcements
      announcements, annLoading, newAnn, showNewAnn,
      loadAnnouncements, createAnnouncement, toggleAnnouncement, deleteAnnouncement,
      // Helpers
      formatBytes, formatDate, quotaPct, quotaClass,
    };
  },
}).mount('#app');
