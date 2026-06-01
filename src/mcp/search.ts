import nodeFetch from 'node-fetch';
import { ToolDef } from '../types';

export const webSearchTool: ToolDef = {
  name: 'web_search',
  description: 'Search the web using DuckDuckGo and return top results with titles, URLs, and snippets',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      max_results: { type: 'number', description: 'Maximum results to return (default: 5, max: 20)' },
    },
    required: ['query'],
  },
};

export const fetchPageTool: ToolDef = {
  name: 'fetch_page',
  description: 'Fetch and extract readable text content from a web page URL',
  inputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL to fetch' },
      max_length: { type: 'number', description: 'Maximum content length to return (default: 5000)' },
    },
    required: ['url'],
  },
};

export const searchTools: ToolDef[] = [webSearchTool, fetchPageTool];

export async function executeSearchTool(
  name: string,
  input: Record<string, unknown>
): Promise<{ output: string; isError: boolean }> {
  try {
    if (name === 'web_search') {
      const query = input.query as string;
      const maxResults = Math.min((input.max_results as number) || 5, 20);

      const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
      const res = await nodeFetch(ddgUrl, {
        headers: { 'User-Agent': 'OpenCLI/1.0' },
      });
      const data = await res.json() as {
        AbstractText?: string;
        AbstractURL?: string;
        RelatedTopics?: Array<{ Text?: string; FirstURL?: string; Topics?: Array<{ Text?: string; FirstURL?: string }> }>;
        Answer?: string;
      };

      const results: string[] = [];

      if (data.Answer) {
        results.push(`📌 INSTANT ANSWER: ${data.Answer}`);
        results.push('');
      }

      if (data.AbstractText) {
        results.push(`📖 ${data.AbstractText}`);
        results.push(`   Source: ${data.AbstractURL}`);
        results.push('');
      }

      const topics = data.RelatedTopics || [];
      let count = 0;
      for (const topic of topics) {
        if (count >= maxResults) break;
        if (topic.Topics) {
          for (const subtopic of topic.Topics) {
            if (count >= maxResults) break;
            if (subtopic.Text && subtopic.FirstURL) {
              results.push(`${count + 1}. ${subtopic.Text.slice(0, 200)}`);
              results.push(`   ${subtopic.FirstURL}`);
              count++;
            }
          }
        } else if (topic.Text && topic.FirstURL) {
          results.push(`${count + 1}. ${topic.Text.slice(0, 200)}`);
          results.push(`   ${topic.FirstURL}`);
          count++;
        }
      }

      if (results.length === 0) {
        results.push(`No results found for: "${query}"`);
        results.push(`Try a different query or use fetch_page with a specific URL.`);
      }

      return { output: results.join('\n'), isError: false };
    }

    if (name === 'fetch_page') {
      const url = input.url as string;
      const maxLength = (input.max_length as number) || 5000;

      const res = await nodeFetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; OpenCLI/1.0)',
          'Accept': 'text/html,application/xhtml+xml',
        },
      });

      if (!res.ok) {
        return { output: `HTTP ${res.status}: ${res.statusText}`, isError: true };
      }

      const html = await res.text();
      const text = extractText(html).slice(0, maxLength);
      return { output: text, isError: false };
    }

    return { output: `Unknown search tool: ${name}`, isError: true };
  } catch (err: unknown) {
    return { output: (err as Error).message, isError: true };
  }
}

function extractText(html: string): string {
  // Remove scripts, styles, and comments
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
  return text;
}
