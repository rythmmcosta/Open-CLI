/* ===== OPEN CLI WEBSITE — MAIN JS ===== */

// ─── GSAP SETUP ───
gsap.registerPlugin(ScrollTrigger);

// ─── NAV: scroll-aware ───
function initNav() {
  const nav = document.querySelector('.nav');
  if (!nav) return;

  ScrollTrigger.create({
    start: 'top -60',
    onEnter: () => nav.classList.add('scrolled'),
    onLeaveBack: () => nav.classList.remove('scrolled'),
  });

  // mobile menu
  const hamburger = document.querySelector('.hamburger');
  const mobileMenu = document.querySelector('.mobile-menu');
  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => {
      mobileMenu.classList.toggle('open');
      const spans = hamburger.querySelectorAll('span');
      if (mobileMenu.classList.contains('open')) {
        gsap.to(spans[0], { rotate: 45, y: 7, duration: 0.25 });
        gsap.to(spans[1], { opacity: 0, duration: 0.15 });
        gsap.to(spans[2], { rotate: -45, y: -7, duration: 0.25 });
      } else {
        gsap.to(spans, { rotate: 0, y: 0, opacity: 1, duration: 0.25 });
      }
    });
  }

  // active link
  const links = document.querySelectorAll('.nav-links a, .mobile-menu a');
  links.forEach(link => {
    if (link.href === window.location.href) link.classList.add('active');
  });
}

// ─── SCROLL REVEALS ───
function initScrollAnimations() {
  // batch fade-up
  gsap.utils.toArray('.fade-up').forEach(el => {
    gsap.to(el, {
      opacity: 1,
      y: 0,
      duration: 0.8,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: el,
        start: 'top 88%',
        once: true,
      }
    });
  });

  // batch fade-in
  gsap.utils.toArray('.fade-in').forEach(el => {
    gsap.to(el, {
      opacity: 1,
      duration: 0.7,
      ease: 'power1.out',
      scrollTrigger: {
        trigger: el,
        start: 'top 88%',
        once: true,
      }
    });
  });

  // slide left/right
  gsap.utils.toArray('.slide-left').forEach(el => {
    gsap.to(el, {
      opacity: 1,
      x: 0,
      duration: 0.8,
      ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true }
    });
  });

  gsap.utils.toArray('.slide-right').forEach(el => {
    gsap.to(el, {
      opacity: 1,
      x: 0,
      duration: 0.8,
      ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true }
    });
  });

  // stagger cards
  gsap.utils.toArray('.cards-grid').forEach(grid => {
    const cards = grid.querySelectorAll('.card');
    gsap.from(cards, {
      opacity: 0,
      y: 40,
      duration: 0.7,
      stagger: 0.1,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: grid,
        start: 'top 85%',
        once: true,
      }
    });
  });

  // stagger skill cards
  gsap.utils.toArray('.skills-grid').forEach(grid => {
    const cards = grid.querySelectorAll('.skill-card');
    gsap.from(cards, {
      opacity: 0,
      x: -20,
      duration: 0.5,
      stagger: 0.06,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: grid,
        start: 'top 85%',
        once: true,
      }
    });
  });
}

// ─── HERO ENTRANCE ───
function initHeroAnimation() {
  const tl = gsap.timeline({ delay: 0.1 });

  const tag = document.querySelector('.hero-tag');
  const title = document.querySelector('.hero-title');
  const subtitle = document.querySelector('.hero-subtitle');
  const actions = document.querySelector('.hero-actions');
  const stats = document.querySelector('.hero-stats');
  const terminal = document.querySelector('.hero-terminal');

  if (tag)      tl.from(tag,      { opacity: 0, y: -20, duration: 0.5, ease: 'power2.out' });
  if (title)    tl.from(title,    { opacity: 0, y: 30,  duration: 0.7, ease: 'power2.out' }, '-=0.2');
  if (subtitle) tl.from(subtitle, { opacity: 0, y: 20,  duration: 0.6, ease: 'power2.out' }, '-=0.4');
  if (actions)  tl.from(actions,  { opacity: 0, y: 20,  duration: 0.5, ease: 'power2.out' }, '-=0.3');
  if (stats)    tl.from(stats,    { opacity: 0, y: 20,  duration: 0.5, ease: 'power2.out' }, '-=0.3');
  if (terminal) tl.from(terminal, { opacity: 0, x: 40,  duration: 0.8, ease: 'power2.out' }, '-=0.6');
}

// ─── COPY BUTTONS ───
function initCopyButtons() {
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const block = btn.closest('.code-block');
      const text = block ? block.innerText.replace('Copy', '').trim() : '';
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = 'Copied!';
        btn.style.color = 'var(--green)';
        setTimeout(() => {
          btn.textContent = 'Copy';
          btn.style.color = '';
        }, 2000);
      } catch (_) {}
    });
  });
}

// ─── TABS ───
function initTabs() {
  document.querySelectorAll('.tabs').forEach(tabs => {
    const buttons = tabs.querySelectorAll('.tab-btn');
    const container = tabs.nextElementSibling;
    if (!container) return;
    const panels = container.querySelectorAll('.tab-panel');

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

// ─── FLOATING ORBS PARALLAX ───
function initParallax() {
  const orbs = document.querySelectorAll('.hero-orb');
  if (!orbs.length) return;

  document.addEventListener('mousemove', e => {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const dx = (e.clientX - cx) / cx;
    const dy = (e.clientY - cy) / cy;

    orbs.forEach((orb, i) => {
      const factor = (i + 1) * 15;
      gsap.to(orb, {
        x: dx * factor,
        y: dy * factor,
        duration: 1.2,
        ease: 'power1.out'
      });
    });
  });
}

// ─── SECTION ENTRANCE NAV HIGHLIGHT ───
function initSectionHighlight() {
  const sections = document.querySelectorAll('section[id]');
  if (!sections.length) return;

  sections.forEach(section => {
    ScrollTrigger.create({
      trigger: section,
      start: 'top 50%',
      end: 'bottom 50%',
      onEnter: () => setActiveLink(section.id),
      onEnterBack: () => setActiveLink(section.id),
    });
  });
}

function setActiveLink(id) {
  document.querySelectorAll('.nav-links a').forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === `#${id}`);
  });
}

// ─── BOOT ───
document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initHeroAnimation();
  initScrollAnimations();
  initCopyButtons();
  initTabs();
  initParallax();
  initSectionHighlight();
});
