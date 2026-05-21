import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const webFetchTool = createTool({
  id: 'web-fetch',
  description: 'Fetches the text content of a web page given its URL',
  inputSchema: z.object({
    url: z.string().url().describe('URL of the page to fetch'),
  }),
  outputSchema: z.object({
    content: z.string().describe('Text content extracted from the page'),
    title: z.string().describe('Page title'),
  }),
  execute: async ({ url }) => {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MastraBot/1.0)' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
    const html = await res.text();

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : url;

    // Strip scripts, styles and HTML tags, collapse whitespace
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, 12000); // keep context window manageable

    return { content: text, title };
  },
});
