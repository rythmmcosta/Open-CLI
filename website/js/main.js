/* ===== OPEN CLI WEBSITE — MAIN JS ===== */

gsap.registerPlugin(ScrollTrigger);

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ─── THEME ───────────────────────────────────────────────
function updateToggleIcon(theme) {
  // icon-sun shown in light mode, icon-moon in dark — handled by CSS [data-theme="light"]
  const meta = document.getElementById('theme-color-meta');
  if (meta) meta.content = theme === 'light' ? '#f5f6f8' : '#070b14';
}

function initTheme() {
  const saved = localStorage.getItem('opencli-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  updateToggleIcon(saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('opencli-theme', next);
  updateToggleIcon(next);
}

// ─── NAV ─────────────────────────────────────────────────
function initNav() {
  // theme toggle click
  const toggle = document.getElementById('theme-toggle');
  if (toggle) toggle.addEventListener('click', toggleTheme);

  // mobile menu
  const hamburger = document.querySelector('.hamburger');
  const mobileMenu = document.querySelector('.mobile-menu');
  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => {
      mobileMenu.classList.toggle('open');
      const spans = hamburger.querySelectorAll('span');
      if (mobileMenu.classList.contains('open')) {
        gsap.to(spans[0], { rotate: 45, y: 7, duration: 0.22 });
        gsap.to(spans[1], { opacity: 0, duration: 0.12 });
        gsap.to(spans[2], { rotate: -45, y: -7, duration: 0.22 });
      } else {
        gsap.to(spans, { rotate: 0, y: 0, opacity: 1, duration: 0.22 });
      }
    });
    // close menu on link click
    mobileMenu.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        mobileMenu.classList.remove('open');
        const spans = hamburger.querySelectorAll('span');
        gsap.to(spans, { rotate: 0, y: 0, opacity: 1, duration: 0.22 });
      });
    });
  }

  // active link
  document.querySelectorAll('.nav-links a, .mobile-menu a').forEach(link => {
    const href = link.getAttribute('href');
    if (href && !href.startsWith('#') && window.location.pathname.endsWith(href)) {
      link.classList.add('active');
    }
    if (href && !href.startsWith('#')) {
      const file = href.split('/').pop();
      if (window.location.pathname.endsWith(file)) link.classList.add('active');
    }
  });
}

// ─── SCROLL ANIMATIONS ───────────────────────────────────
function initScrollAnimations() {
  if (reducedMotion) return;

  // fade-up: set initial state via JS (not CSS) so content visible without JS
  gsap.utils.toArray('.fade-up').forEach(el => {
    gsap.set(el, { opacity: 0, y: 28 });
    gsap.to(el, {
      opacity: 1, y: 0,
      duration: 0.75,
      ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 90%', once: true }
    });
  });

  gsap.utils.toArray('.fade-in').forEach(el => {
    gsap.set(el, { opacity: 0 });
    gsap.to(el, {
      opacity: 1,
      duration: 0.65,
      ease: 'power1.out',
      scrollTrigger: { trigger: el, start: 'top 90%', once: true }
    });
  });

  gsap.utils.toArray('.slide-left').forEach(el => {
    gsap.set(el, { opacity: 0, x: -28 });
    gsap.to(el, {
      opacity: 1, x: 0,
      duration: 0.75,
      ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true }
    });
  });

  gsap.utils.toArray('.slide-right').forEach(el => {
    gsap.set(el, { opacity: 0, x: 28 });
    gsap.to(el, {
      opacity: 1, x: 0,
      duration: 0.75,
      ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true }
    });
  });

  // stagger cards
  gsap.utils.toArray('.cards-grid').forEach(grid => {
    const cards = grid.querySelectorAll('.card');
    gsap.set(cards, { opacity: 0, y: 24 });
    gsap.to(cards, {
      opacity: 1, y: 0,
      duration: 0.6,
      stagger: 0.08,
      ease: 'power2.out',
      scrollTrigger: { trigger: grid, start: 'top 88%', once: true }
    });
  });

  // stagger skill cards (skills.html)
  gsap.utils.toArray('.skills-grid').forEach(grid => {
    const cards = grid.querySelectorAll('.skill-card-full');
    gsap.set(cards, { opacity: 0, x: -16 });
    gsap.to(cards, {
      opacity: 1, x: 0,
      duration: 0.45,
      stagger: 0.05,
      ease: 'power2.out',
      scrollTrigger: { trigger: grid, start: 'top 88%', once: true }
    });
  });
}

// ─── HERO ENTRANCE ───────────────────────────────────────
function initHeroAnimation() {
  if (reducedMotion) return;

  const tl = gsap.timeline({ delay: 0.05 });
  const tag      = document.querySelector('.hero-tag');
  const title    = document.querySelector('.hero-title');
  const subtitle = document.querySelector('.hero-subtitle');
  const actions  = document.querySelector('.hero-actions');
  const stats    = document.querySelector('.hero-stats');
  const terminal = document.querySelector('.hero-terminal');

  if (tag)      tl.from(tag,      { opacity: 0, y: -14, duration: 0.4, ease: 'power2.out' });
  if (title)    tl.from(title,    { opacity: 0, y: 24,  duration: 0.6, ease: 'power2.out' }, '-=0.2');
  if (subtitle) tl.from(subtitle, { opacity: 0, y: 16,  duration: 0.5, ease: 'power2.out' }, '-=0.35');
  if (actions)  tl.from(actions,  { opacity: 0, y: 14,  duration: 0.45,ease: 'power2.out' }, '-=0.3');
  if (stats)    tl.from(stats,    { opacity: 0, y: 10,  duration: 0.4, ease: 'power2.out' }, '-=0.25');
  if (terminal) tl.from(terminal, { opacity: 0, x: 32,  duration: 0.7, ease: 'power2.out' }, '-=0.5');
}

// ─── COPY BUTTONS ────────────────────────────────────────
function initCopyButtons() {
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const block = btn.closest('.code-block');
      if (!block) return;
      const clone = block.cloneNode(true);
      clone.querySelector('.copy-btn')?.remove();
      const text = clone.innerText.trim();
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = 'Copied!';
        btn.style.color = 'var(--green)';
        setTimeout(() => { btn.textContent = 'Copy'; btn.style.color = ''; }, 2000);
      } catch (_) {}
    });
  });
}

// ─── TABS ────────────────────────────────────────────────
function initTabs() {
  document.querySelectorAll('.tabs').forEach(tabs => {
    const buttons = tabs.querySelectorAll('.tab-btn');
    const container = tabs.nextElementSibling;
    if (!container) return;
    const panels = container.querySelectorAll ? container.querySelectorAll('.tab-panel') : [];

    buttons.forEach((btn, i) => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        if (panels[i]) panels[i].classList.add('active');
      });
    });
  });
}

// ─── MOUSE PARALLAX (hero orbs) ──────────────────────────
function initParallax() {
  if (reducedMotion) return;
  const orbs = document.querySelectorAll('.hero-orb');
  if (!orbs.length) return;

  let raf;
  document.addEventListener('mousemove', e => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const dx = (e.clientX - cx) / cx;
      const dy = (e.clientY - cy) / cy;
      orbs.forEach((orb, i) => {
        const f = (i + 1) * 12;
        gsap.to(orb, { x: dx * f, y: dy * f, duration: 1.4, ease: 'power1.out' });
      });
    });
  });
}

// ─── DOCS SIDEBAR ACTIVE ─────────────────────────────────
function initDocsSidebar() {
  const sections = document.querySelectorAll('.docs-section[id]');
  const links = document.querySelectorAll('.sidebar-nav a');
  if (!sections.length) return;

  function setActive(id) {
    links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + id));
  }

  sections.forEach(s => {
    ScrollTrigger.create({
      trigger: s,
      start: 'top 40%',
      end: 'bottom 40%',
      onEnter: () => setActive(s.id),
      onEnterBack: () => setActive(s.id),
    });
  });
}

// ─── BOOT ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initNav();
  initHeroAnimation();
  initScrollAnimations();
  initCopyButtons();
  initTabs();
  initParallax();
  initDocsSidebar();
});
