import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

export interface BrowserOptions {
  headless?: boolean;
  slowMo?: number;
  timeout?: number;
}

export interface ElementInfo {
  selector: string;
  tag: string;
  text: string;
  visible: boolean;
  enabled: boolean;
  type?: string;
  value?: string;
  href?: string;
}

export interface PageInfo {
  url: string;
  title: string;
  content: string;
  links: string[];
  forms: FormInfo[];
  images: string[];
}

export interface FormInfo {
  action: string;
  method: string;
  fields: Array<{ name: string; type: string; required: boolean }>;
}

export interface VerificationResult {
  passed: boolean;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
  screenshot?: string;
  errors: string[];
}

let _playwrightAvailable: boolean | null = null;

export async function checkPlaywrightAvailable(): Promise<boolean> {
  if (_playwrightAvailable !== null) return _playwrightAvailable;
  try {
    require.resolve('playwright');
    _playwrightAvailable = true;
  } catch {
    _playwrightAvailable = false;
  }
  return _playwrightAvailable;
}

export async function ensurePlaywright(): Promise<void> {
  if (!(await checkPlaywrightAvailable())) {
    throw new Error(
      'Playwright not installed. Run: npx playwright install chromium'
    );
  }
}

export class BrowserAgent {
  private browser: unknown = null;
  private page: unknown = null;
  private options: BrowserOptions;
  private screenshotDir: string;

  constructor(options: BrowserOptions = {}) {
    this.options = { headless: true, timeout: 30000, ...options };
    this.screenshotDir = path.join(os.homedir(), '.config', 'opencli', 'screenshots');
    fs.mkdirSync(this.screenshotDir, { recursive: true });
  }

  async launch(): Promise<void> {
    await ensurePlaywright();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { chromium } = require('playwright') as typeof import('playwright');
    this.browser = await chromium.launch({
      headless: this.options.headless !== false,
      slowMo: this.options.slowMo,
    });
    const ctx = await (this.browser as import('playwright').Browser).newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'OpenCLI/1.0 (Developer Assistant)',
    });
    this.page = await ctx.newPage();
    (this.page as import('playwright').Page).setDefaultTimeout(this.options.timeout || 30000);
  }

  async navigate(url: string): Promise<PageInfo> {
    const pg = this.page as import('playwright').Page;
    await pg.goto(url, { waitUntil: 'networkidle' });

    const info: PageInfo = await pg.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href]'))
        .map(a => (a as HTMLAnchorElement).href)
        .filter(h => h.startsWith('http'))
        .slice(0, 30);

      const forms: FormInfo[] = Array.from(document.forms).map(form => ({
        action: form.action,
        method: form.method || 'GET',
        fields: Array.from(form.elements)
          .filter(e => e.tagName !== 'BUTTON')
          .map(e => ({
            name: (e as HTMLInputElement).name,
            type: (e as HTMLInputElement).type || e.tagName.toLowerCase(),
            required: (e as HTMLInputElement).required,
          })),
      }));

      const images = Array.from(document.images)
        .map(img => img.src)
        .filter(Boolean)
        .slice(0, 20);

      return {
        url: window.location.href,
        title: document.title,
        content: document.body.innerText.slice(0, 5000),
        links,
        forms,
        images,
      };
    });

    return info;
  }

  async screenshot(name?: string): Promise<string> {
    const pg = this.page as import('playwright').Page;
    const filename = name || `screenshot-${Date.now()}.png`;
    const filepath = path.join(this.screenshotDir, filename);
    await pg.screenshot({ path: filepath, fullPage: true });
    return filepath;
  }

  async screenshotElement(selector: string): Promise<string> {
    const pg = this.page as import('playwright').Page;
    const filename = `element-${Date.now()}.png`;
    const filepath = path.join(this.screenshotDir, filename);
    const el = await pg.$(selector);
    if (!el) throw new Error(`Element not found: ${selector}`);
    await el.screenshot({ path: filepath });
    return filepath;
  }

  async click(selector: string): Promise<void> {
    const pg = this.page as import('playwright').Page;
    await pg.waitForSelector(selector, { state: 'visible' });
    await pg.click(selector);
  }

  async type(selector: string, text: string, clear = true): Promise<void> {
    const pg = this.page as import('playwright').Page;
    await pg.waitForSelector(selector, { state: 'visible' });
    if (clear) await pg.fill(selector, '');
    await pg.type(selector, text, { delay: 20 });
  }

  async fillForm(fields: Record<string, string>): Promise<void> {
    const pg = this.page as import('playwright').Page;
    for (const [selector, value] of Object.entries(fields)) {
      await pg.waitForSelector(selector, { state: 'visible' });
      await pg.fill(selector, value);
    }
  }

  async scroll(direction: 'up' | 'down' | 'top' | 'bottom', amount = 300): Promise<void> {
    const pg = this.page as import('playwright').Page;
    if (direction === 'top') {
      await pg.evaluate(() => window.scrollTo(0, 0));
    } else if (direction === 'bottom') {
      await pg.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    } else {
      const delta = direction === 'down' ? amount : -amount;
      await pg.evaluate(d => window.scrollBy(0, d), delta);
    }
  }

  async getElement(selector: string): Promise<ElementInfo | null> {
    const pg = this.page as import('playwright').Page;
    const el = await pg.$(selector);
    if (!el) return null;

    return pg.evaluate(element => {
      const el = element as HTMLElement;
      return {
        selector: el.tagName.toLowerCase(),
        tag: el.tagName.toLowerCase(),
        text: el.innerText?.slice(0, 200) || '',
        visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length),
        enabled: !(el as HTMLInputElement).disabled,
        type: (el as HTMLInputElement).type,
        value: (el as HTMLInputElement).value,
        href: (el as HTMLAnchorElement).href,
      };
    }, el);
  }

  async verify(checks: VerifyCheck[]): Promise<VerificationResult> {
    const pg = this.page as import('playwright').Page;
    const results: Array<{ name: string; passed: boolean; detail: string }> = [];
    const errors: string[] = [];

    for (const check of checks) {
      try {
        let passed = false;
        let detail = '';

        if (check.type === 'exists') {
          const el = await pg.$(check.selector!);
          passed = !!el;
          detail = passed ? `Element ${check.selector} found` : `Element ${check.selector} NOT found`;
        } else if (check.type === 'visible') {
          const el = await pg.$(check.selector!);
          passed = el ? await el.isVisible() : false;
          detail = passed ? `Element ${check.selector} is visible` : `Element ${check.selector} NOT visible`;
        } else if (check.type === 'text') {
          const text = await pg.textContent(check.selector!);
          passed = !!(text && text.includes(check.expected!));
          detail = `Text "${check.expected}" ${passed ? 'found' : 'NOT found'} in ${check.selector}`;
        } else if (check.type === 'url') {
          const url = pg.url();
          passed = url.includes(check.expected!);
          detail = `URL ${passed ? 'matches' : 'does NOT match'}: ${check.expected}`;
        } else if (check.type === 'title') {
          const title = await pg.title();
          passed = title.includes(check.expected!);
          detail = `Title "${title}" ${passed ? 'contains' : 'does NOT contain'} "${check.expected}"`;
        } else if (check.type === 'no_errors') {
          const errors_found = await pg.evaluate(() => {
            return (window as unknown as { _opencli_errors?: string[] })._opencli_errors || [];
          });
          passed = errors_found.length === 0;
          detail = passed ? 'No JavaScript errors detected' : `JS errors: ${errors_found.join(', ')}`;
        } else if (check.type === 'clickable') {
          const el = await pg.$(check.selector!);
          if (el) {
            const box = await el.boundingBox();
            passed = !!box;
            detail = passed ? `Element ${check.selector} is clickable` : `Element ${check.selector} has no bounding box`;
          } else {
            passed = false;
            detail = `Element ${check.selector} not found`;
          }
        }

        results.push({ name: check.name || check.type, passed, detail });
      } catch (err) {
        const msg = (err as Error).message;
        errors.push(msg);
        results.push({ name: check.name || check.type, passed: false, detail: `Error: ${msg}` });
      }
    }

    let screenshotPath: string | undefined;
    try {
      screenshotPath = await this.screenshot(`verify-${Date.now()}.png`);
    } catch { /* screenshot is optional */ }

    return {
      passed: results.every(r => r.passed),
      checks: results,
      screenshot: screenshotPath,
      errors,
    };
  }

  async extractData(selector: string, attribute?: string): Promise<string[]> {
    const pg = this.page as import('playwright').Page;
    const elements = await pg.$$(selector);
    const data = await Promise.all(elements.map(async el => {
      if (attribute) {
        return (await el.getAttribute(attribute)) || '';
      }
      return (await el.textContent()) || '';
    }));
    return data.filter(Boolean);
  }

  async waitFor(selector: string, timeout = 10000): Promise<boolean> {
    const pg = this.page as import('playwright').Page;
    try {
      await pg.waitForSelector(selector, { timeout });
      return true;
    } catch {
      return false;
    }
  }

  async executeScript<T>(script: string): Promise<T> {
    const pg = this.page as import('playwright').Page;
    return pg.evaluate(script) as Promise<T>;
  }

  async getPageSource(): Promise<string> {
    const pg = this.page as import('playwright').Page;
    return pg.content();
  }

  async close(): Promise<void> {
    if (this.browser) {
      await (this.browser as import('playwright').Browser).close();
      this.browser = null;
      this.page = null;
    }
  }

  get isOpen(): boolean {
    return this.browser !== null;
  }
}

export interface VerifyCheck {
  type: 'exists' | 'visible' | 'text' | 'url' | 'title' | 'no_errors' | 'clickable';
  selector?: string;
  expected?: string;
  name?: string;
}

export let globalBrowser: BrowserAgent | null = null;

export async function getBrowser(options?: BrowserOptions): Promise<BrowserAgent> {
  if (!globalBrowser || !globalBrowser.isOpen) {
    globalBrowser = new BrowserAgent(options);
    await globalBrowser.launch();
  }
  return globalBrowser;
}

export async function closeBrowser(): Promise<void> {
  if (globalBrowser) {
    await globalBrowser.close();
    globalBrowser = null;
  }
}
