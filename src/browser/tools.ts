import { ToolDef } from '../types';
import { getBrowser, closeBrowser, VerifyCheck, checkPlaywrightAvailable } from './index';
import * as fs from 'fs';

export const browserNavigateTool: ToolDef = {
  name: 'browser_navigate',
  description: 'Navigate to a URL in the headless browser and return page info (title, content, links, forms)',
  inputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL to navigate to' },
      wait_for: { type: 'string', description: 'Optional CSS selector to wait for before returning' },
    },
    required: ['url'],
  },
};

export const browserScreenshotTool: ToolDef = {
  name: 'browser_screenshot',
  description: 'Take a full-page screenshot of the current browser page. Returns the file path of the saved screenshot.',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Optional filename for the screenshot (e.g. "homepage.png")' },
      selector: { type: 'string', description: 'Optional: screenshot a specific element by CSS selector' },
    },
    required: [],
  },
};

export const browserClickTool: ToolDef = {
  name: 'browser_click',
  description: 'Click an element on the current page by CSS selector',
  inputSchema: {
    type: 'object',
    properties: {
      selector: { type: 'string', description: 'CSS selector of element to click' },
    },
    required: ['selector'],
  },
};

export const browserTypeTool: ToolDef = {
  name: 'browser_type',
  description: 'Type text into a form field on the current page',
  inputSchema: {
    type: 'object',
    properties: {
      selector: { type: 'string', description: 'CSS selector of input field' },
      text: { type: 'string', description: 'Text to type' },
      clear: { type: 'boolean', description: 'Clear existing text first (default: true)' },
    },
    required: ['selector', 'text'],
  },
};

export const browserScrollTool: ToolDef = {
  name: 'browser_scroll',
  description: 'Scroll the current page',
  inputSchema: {
    type: 'object',
    properties: {
      direction: { type: 'string', description: 'Direction: up, down, top, bottom' },
      amount: { type: 'number', description: 'Pixels to scroll (default 300)' },
    },
    required: ['direction'],
  },
};

export const browserVerifyTool: ToolDef = {
  name: 'browser_verify',
  description: 'Verify multiple UI conditions on the current page (elements exist, are visible, contain text, etc.). Takes a screenshot and returns pass/fail for each check.',
  inputSchema: {
    type: 'object',
    properties: {
      checks: {
        type: 'array',
        description: 'Array of checks to perform',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', description: 'Check type: exists, visible, text, url, title, no_errors, clickable' },
            selector: { type: 'string', description: 'CSS selector (for exists/visible/text/clickable checks)' },
            expected: { type: 'string', description: 'Expected value (for text/url/title checks)' },
            name: { type: 'string', description: 'Human-readable check name' },
          },
          required: ['type'],
        },
      },
    },
    required: ['checks'],
  },
};

export const browserExtractTool: ToolDef = {
  name: 'browser_extract',
  description: 'Extract data from page elements matching a CSS selector',
  inputSchema: {
    type: 'object',
    properties: {
      selector: { type: 'string', description: 'CSS selector to match elements' },
      attribute: { type: 'string', description: 'Optional: extract specific attribute (e.g. "href", "src") instead of text' },
    },
    required: ['selector'],
  },
};

export const browserExecuteTool: ToolDef = {
  name: 'browser_execute',
  description: 'Execute JavaScript in the browser page context and return the result',
  inputSchema: {
    type: 'object',
    properties: {
      script: { type: 'string', description: 'JavaScript expression to evaluate in the page' },
    },
    required: ['script'],
  },
};

export const browserCloseTool: ToolDef = {
  name: 'browser_close',
  description: 'Close the browser session',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export const ALL_BROWSER_TOOLS: ToolDef[] = [
  browserNavigateTool,
  browserScreenshotTool,
  browserClickTool,
  browserTypeTool,
  browserScrollTool,
  browserVerifyTool,
  browserExtractTool,
  browserExecuteTool,
  browserCloseTool,
];

export async function executeBrowserTool(
  name: string,
  input: Record<string, unknown>
): Promise<{ output: string; isError: boolean; imagePath?: string }> {
  if (!(await checkPlaywrightAvailable())) {
    return {
      output: 'Browser tools require Playwright. Install it: npx playwright install chromium\nThen run: opencli browser install',
      isError: true,
    };
  }

  try {
    switch (name) {
      case 'browser_navigate': {
        const browser = await getBrowser();
        const info = await browser.navigate(input.url as string);
        if (input.wait_for) {
          await browser.waitFor(input.wait_for as string, 10000);
        }
        return {
          output: JSON.stringify({
            url: info.url,
            title: info.title,
            contentPreview: info.content.slice(0, 1000),
            links: info.links.slice(0, 10),
            forms: info.forms.slice(0, 5),
            imageCount: info.images.length,
          }, null, 2),
          isError: false,
        };
      }

      case 'browser_screenshot': {
        const browser = await getBrowser();
        let filepath: string;
        if (input.selector) {
          filepath = await browser.screenshotElement(input.selector as string);
        } else {
          filepath = await browser.screenshot(input.name as string | undefined);
        }
        return { output: `Screenshot saved: ${filepath}`, isError: false, imagePath: filepath };
      }

      case 'browser_click': {
        const browser = await getBrowser();
        await browser.click(input.selector as string);
        return { output: `Clicked: ${input.selector}`, isError: false };
      }

      case 'browser_type': {
        const browser = await getBrowser();
        await browser.type(
          input.selector as string,
          input.text as string,
          input.clear !== false
        );
        return { output: `Typed "${input.text}" into ${input.selector}`, isError: false };
      }

      case 'browser_scroll': {
        const browser = await getBrowser();
        await browser.scroll(
          input.direction as 'up' | 'down' | 'top' | 'bottom',
          (input.amount as number) || 300
        );
        return { output: `Scrolled ${input.direction}`, isError: false };
      }

      case 'browser_verify': {
        const browser = await getBrowser();
        const result = await browser.verify(input.checks as VerifyCheck[]);
        const lines = [
          result.passed ? '✅ ALL CHECKS PASSED' : '❌ SOME CHECKS FAILED',
          '',
          ...result.checks.map(c =>
            `${c.passed ? '✓' : '✗'} ${c.name}: ${c.detail}`
          ),
        ];
        if (result.errors.length > 0) {
          lines.push('', 'Errors:', ...result.errors);
        }
        if (result.screenshot) {
          lines.push('', `Screenshot: ${result.screenshot}`);
        }
        return {
          output: lines.join('\n'),
          isError: !result.passed,
          imagePath: result.screenshot,
        };
      }

      case 'browser_extract': {
        const browser = await getBrowser();
        const data = await browser.extractData(
          input.selector as string,
          input.attribute as string | undefined
        );
        return { output: data.join('\n') || '(no data found)', isError: false };
      }

      case 'browser_execute': {
        const browser = await getBrowser();
        const result = await browser.executeScript(input.script as string);
        return { output: JSON.stringify(result, null, 2), isError: false };
      }

      case 'browser_close': {
        await closeBrowser();
        return { output: 'Browser session closed', isError: false };
      }

      default:
        return { output: `Unknown browser tool: ${name}`, isError: true };
    }
  } catch (err: unknown) {
    return { output: (err as Error).message, isError: true };
  }
}
