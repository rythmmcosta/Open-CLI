/* ===== TERMINAL TYPING ANIMATION ===== */

class TerminalPlayer {
  constructor(bodyEl, sequences) {
    this.body = bodyEl;
    this.sequences = sequences;
    this.lineIndex = 0;
    this.tl = null;
  }

  _makeEl(tag, cls, text = '') {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text) el.textContent = text;
    return el;
  }

  _appendLine(lineEl) {
    this.body.appendChild(lineEl);
    this.body.scrollTop = this.body.scrollHeight;
  }

  _typeLine(text, el, duration) {
    return new Promise(resolve => {
      let i = 0;
      const total = text.length;
      const step = duration / total;
      const timer = setInterval(() => {
        el.textContent = text.slice(0, ++i);
        if (i >= total) { clearInterval(timer); resolve(); }
      }, step * 1000);
    });
  }

  async _runLine(seq) {
    const { type, text, delay = 0 } = seq;
    await new Promise(r => setTimeout(r, delay * 1000));

    if (type === 'command') {
      const line = this._makeEl('div', 't-line');
      const prompt = this._makeEl('span', 't-prompt', '❯');
      const cmd = this._makeEl('span', 't-cmd', '');
      line.appendChild(prompt);
      line.appendChild(cmd);
      this._appendLine(line);
      await this._typeLine(text, cmd, 0.04 * text.length);

    } else if (type === 'output') {
      const el = this._makeEl('div', 't-output', text);
      el.style.opacity = '0';
      this._appendLine(el);
      gsap.to(el, { opacity: 1, duration: 0.25, ease: 'power1.out' });

    } else if (type === 'success') {
      const el = this._makeEl('div', 't-success', text);
      el.style.opacity = '0';
      this._appendLine(el);
      gsap.to(el, { opacity: 1, duration: 0.3 });

    } else if (type === 'info') {
      const el = this._makeEl('div', 't-info', text);
      el.style.opacity = '0';
      this._appendLine(el);
      gsap.to(el, { opacity: 1, duration: 0.3 });

    } else if (type === 'warn') {
      const el = this._makeEl('div', 't-warn', text);
      el.style.opacity = '0';
      this._appendLine(el);
      gsap.to(el, { opacity: 1, duration: 0.3 });

    } else if (type === 'blank') {
      this._appendLine(this._makeEl('div', '', ''));
    }
  }

  async play() {
    for (const seq of this.sequences) {
      await this._runLine(seq);
    }
    // blinking cursor at end
    const cursor = this._makeEl('div', 't-line');
    const prompt = this._makeEl('span', 't-prompt', '❯');
    const cur = this._makeEl('span', 'cursor', '');
    cursor.appendChild(prompt);
    cursor.appendChild(cur);
    this._appendLine(cursor);
  }

  reset() {
    this.body.innerHTML = '';
  }

  playLoop(delayBetween = 3000) {
    const run = async () => {
      this.reset();
      await this.play();
      setTimeout(run, delayBetween);
    };
    run();
  }
}

// ─── HERO TERMINAL SEQUENCE ───
const heroSequences = [
  { type: 'command', text: 'opencli "analyze this TypeScript project"',   delay: 0.5 },
  { type: 'blank',   text: '',                                             delay: 0 },
  { type: 'info',    text: '⠋ Scanning project structure...',              delay: 0.3 },
  { type: 'output',  text: '  Found 47 files across 12 directories',       delay: 0.4 },
  { type: 'output',  text: '  Detected: TypeScript 5.x, Node.js backend',  delay: 0.3 },
  { type: 'blank',   text: '',                                             delay: 0 },
  { type: 'success', text: '✓ Analysis complete in 2.3s',                  delay: 0.2 },
  { type: 'blank',   text: '',                                             delay: 0 },
  { type: 'output',  text: '  Your project uses a layered architecture',   delay: 0.3 },
  { type: 'output',  text: '  with 3 services and a shared utils layer.',  delay: 0.2 },
  { type: 'blank',   text: '',                                             delay: 0.5 },
  { type: 'command', text: 'opencli --skill python "add FastAPI endpoint"', delay: 0.8 },
  { type: 'blank',   text: '',                                             delay: 0 },
  { type: 'info',    text: '⠋ Using skill: python 🐍',                    delay: 0.3 },
  { type: 'output',  text: '  Generating POST /api/users endpoint...',     delay: 0.4 },
  { type: 'success', text: '✓ Written to src/routes/users.py',             delay: 0.5 },
  { type: 'blank',   text: '',                                             delay: 0.3 },
  { type: 'command', text: 'opencli --notify "run all tests"',             delay: 0.8 },
  { type: 'info',    text: '⠋ Running test suite...',                      delay: 0.3 },
  { type: 'output',  text: '  47 tests passed • 0 failed',                 delay: 0.5 },
  { type: 'success', text: '✓ Telegram notification sent',                 delay: 0.4 },
];

// ─── INSTALL TERMINAL SEQUENCE ───
const installSequences = [
  { type: 'command', text: 'npm install -g open-cli',       delay: 0.3 },
  { type: 'info',    text: '⠋ Installing...',               delay: 0.5 },
  { type: 'success', text: '✓ Installed v1.0.0 globally',   delay: 0.8 },
  { type: 'blank',   text: '',                              delay: 0 },
  { type: 'command', text: 'opencli auth',                  delay: 0.5 },
  { type: 'info',    text: '? Select AI provider',          delay: 0.3 },
  { type: 'output',  text: '  ❯ Anthropic (Claude)',        delay: 0.2 },
  { type: 'output',  text: '    OpenAI (GPT-4o)',           delay: 0.1 },
  { type: 'output',  text: '    Google Gemini',             delay: 0.1 },
  { type: 'output',  text: '    Ollama (local)',            delay: 0.1 },
  { type: 'blank',   text: '',                              delay: 0.3 },
  { type: 'success', text: '✓ Anthropic connected',         delay: 0.6 },
  { type: 'blank',   text: '',                              delay: 0 },
  { type: 'command', text: 'opencli "hello world"',         delay: 0.5 },
  { type: 'success', text: '✓ Hello! Ready to help.',       delay: 0.6 },
];

// ─── INIT ON PAGE ───
document.addEventListener('DOMContentLoaded', () => {
  const heroTermBody = document.getElementById('hero-term-body');
  if (heroTermBody) {
    const player = new TerminalPlayer(heroTermBody, heroSequences);
    // Start when in view
    ScrollTrigger.create({
      trigger: heroTermBody,
      start: 'top 90%',
      once: true,
      onEnter: () => player.play(),
    });
    // Also play on load (hero is visible)
    setTimeout(() => player.play(), 800);
  }

  const installTermBody = document.getElementById('install-term-body');
  if (installTermBody) {
    const player = new TerminalPlayer(installTermBody, installSequences);
    ScrollTrigger.create({
      trigger: installTermBody,
      start: 'top 80%',
      once: true,
      onEnter: () => player.play(),
    });
  }
});
