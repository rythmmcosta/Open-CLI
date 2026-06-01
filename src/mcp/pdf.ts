import * as fs from 'fs';
import * as path from 'path';
import { ToolDef } from '../types';

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export const pdfTools: ToolDef[] = [
  {
    name: 'pdf_create',
    description:
      'Create a printable document from text/markdown content. ' +
      'Generates a self-contained HTML file (outputPath with .html extension) styled for ' +
      'PDF printing — open it in a browser and use File → Print → Save as PDF.',
    inputSchema: {
      type: 'object',
      properties: {
        title:      { type: 'string', description: 'Document title' },
        content:    { type: 'string', description: 'Document body (plain text or simple markdown)' },
        outputPath: { type: 'string', description: 'Desired output path (e.g. /tmp/report.pdf or /tmp/report.html)' },
      },
      required: ['title', 'content', 'outputPath'],
    },
  },
  {
    name: 'pdf_extract_text',
    description:
      'Extract text from a file. Works directly for plain-text and HTML files. ' +
      'For binary PDFs, dynamically requires the pdf-parse npm package — installs instructions returned if missing.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Absolute or relative path to the file' },
      },
      required: ['filePath'],
    },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Very small markdown → HTML converter for headings, bold, italic, code, lists, hr. */
function markdownToHtml(md: string): string {
  const lines = md.split('\n');
  const out: string[] = [];
  let inCode  = false;
  let inUl    = false;

  for (const raw of lines) {
    const line = raw;

    // Fenced code blocks
    if (line.startsWith('```')) {
      if (!inCode) { if (inUl) { out.push('</ul>'); inUl = false; } out.push('<pre><code>'); inCode = true; }
      else         { out.push('</code></pre>'); inCode = false; }
      continue;
    }
    if (inCode) { out.push(escHtml(line)); continue; }

    // Headings
    const hm = line.match(/^(#{1,6})\s+(.*)/);
    if (hm) {
      if (inUl) { out.push('</ul>'); inUl = false; }
      const lvl = hm[1].length;
      out.push(`<h${lvl}>${inlineMarkdown(hm[2])}</h${lvl}>`);
      continue;
    }

    // Horizontal rule
    if (/^(\s*[-*_]){3,}\s*$/.test(line)) {
      if (inUl) { out.push('</ul>'); inUl = false; }
      out.push('<hr>');
      continue;
    }

    // Unordered list
    const ulm = line.match(/^[\s]*[-*+]\s+(.*)/);
    if (ulm) {
      if (!inUl) { out.push('<ul>'); inUl = true; }
      out.push(`<li>${inlineMarkdown(ulm[1])}</li>`);
      continue;
    }
    if (inUl && line.trim() === '') { out.push('</ul>'); inUl = false; }

    // Paragraph / blank line
    if (line.trim() === '') {
      out.push('');
    } else {
      out.push(`<p>${inlineMarkdown(line)}</p>`);
    }
  }
  if (inUl) out.push('</ul>');
  return out.join('\n');
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inlineMarkdown(s: string): string {
  return escHtml(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
}

function buildHtml(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(title)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 12pt;
      line-height: 1.6;
      color: #111;
      max-width: 780px;
      margin: 0 auto;
      padding: 40px 48px;
    }
    h1 { font-size: 2em;   border-bottom: 2px solid #333; padding-bottom: 0.2em; }
    h2 { font-size: 1.5em; border-bottom: 1px solid #ccc; padding-bottom: 0.15em; }
    h3 { font-size: 1.2em; }
    pre { background: #f5f5f5; padding: 12px 16px; border-radius: 4px; overflow-x: auto; }
    code { font-family: 'Courier New', monospace; font-size: 0.9em; background: #f0f0f0; padding: 0 3px; }
    pre code { background: none; padding: 0; }
    hr { border: none; border-top: 1px solid #ccc; margin: 1.5em 0; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    th, td { border: 1px solid #ccc; padding: 6px 12px; text-align: left; }
    th { background: #f0f0f0; }
    a { color: #0070f3; }
    @media print {
      body { padding: 0; max-width: 100%; }
      pre { break-inside: avoid; }
      h1, h2, h3 { break-after: avoid; }
    }
  </style>
</head>
<body>
  <h1>${escHtml(title)}</h1>
${bodyHtml}
</body>
</html>`;
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------

export async function executePdfTool(
  name: string,
  input: Record<string, unknown>
): Promise<{ output: string; isError: boolean }> {
  try {
    // -----------------------------------------------------------------------
    if (name === 'pdf_create') {
      const title      = input.title      as string;
      const content    = input.content    as string;
      const outputPath = input.outputPath as string;

      // Always write an HTML file (replace .pdf extension if given)
      const htmlPath = outputPath.replace(/\.pdf$/i, '.html');
      const bodyHtml = markdownToHtml(content);
      const html     = buildHtml(title, bodyHtml);

      fs.mkdirSync(path.dirname(path.resolve(htmlPath)), { recursive: true });
      fs.writeFileSync(htmlPath, html, 'utf8');

      return {
        output: [
          `Created printable HTML file: ${htmlPath}`,
          '',
          'To save as PDF:',
          '  1. Open the file in Chrome / Firefox / Safari',
          '  2. Press Ctrl+P (or Cmd+P on macOS)',
          '  3. Set Destination to "Save as PDF"',
          '  4. Click Save',
          '',
          `  File size: ${fs.statSync(htmlPath).size} bytes`,
        ].join('\n'),
        isError: false,
      };
    }

    // -----------------------------------------------------------------------
    if (name === 'pdf_extract_text') {
      const filePath = path.resolve(input.filePath as string);

      if (!fs.existsSync(filePath)) {
        return { output: `File not found: ${filePath}`, isError: true };
      }

      const ext = path.extname(filePath).toLowerCase();

      // Plain text or HTML — no deps needed
      if (['.txt', '.md', '.rst', '.csv', '.log', '.json', '.xml', '.yaml', '.yml'].includes(ext)) {
        const text = fs.readFileSync(filePath, 'utf8');
        return {
          output: `Text content of ${path.basename(filePath)} (${text.length} chars):\n${'─'.repeat(40)}\n${text.slice(0, 8000)}${text.length > 8000 ? '\n… (truncated)' : ''}`,
          isError: false,
        };
      }

      if (ext === '.html' || ext === '.htm') {
        const raw  = fs.readFileSync(filePath, 'utf8');
        const text = stripHtmlTags(raw);
        return {
          output: `Extracted text from ${path.basename(filePath)} (${text.length} chars):\n${'─'.repeat(40)}\n${text.slice(0, 8000)}${text.length > 8000 ? '\n… (truncated)' : ''}`,
          isError: false,
        };
      }

      // PDF — try pdf-parse
      if (ext === '.pdf') {
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string; numpages: number; info: Record<string, unknown> }>;
          const buf    = fs.readFileSync(filePath);
          const result = await pdfParse(buf);
          const text   = result.text.trim();
          return {
            output: [
              `Extracted text from ${path.basename(filePath)}`,
              `  Pages  : ${result.numpages}`,
              `  Chars  : ${text.length}`,
              `  Title  : ${String(result.info?.Title || 'unknown')}`,
              `  Author : ${String(result.info?.Author || 'unknown')}`,
              `${'─'.repeat(40)}`,
              text.slice(0, 8000) + (text.length > 8000 ? '\n… (truncated)' : ''),
            ].join('\n'),
            isError: false,
          };
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          if (msg.includes('Cannot find module')) {
            return {
              output: [
                `Cannot extract text from binary PDF without pdf-parse.`,
                `Install it with:  npm install pdf-parse`,
                `Then retry this command.`,
              ].join('\n'),
              isError: true,
            };
          }
          throw e;
        }
      }

      // Unknown binary — try reading as text anyway
      try {
        const text = fs.readFileSync(filePath, 'utf8');
        return {
          output: `File content (${path.basename(filePath)}, ${text.length} chars):\n${'─'.repeat(40)}\n${text.slice(0, 4000)}`,
          isError: false,
        };
      } catch {
        return {
          output: `Cannot read "${path.basename(filePath)}" as text. For binary PDFs run: npm install pdf-parse`,
          isError: true,
        };
      }
    }

    return { output: `Unknown PDF tool: ${name}`, isError: true };
  } catch (err: unknown) {
    return { output: (err as Error).message, isError: true };
  }
}
