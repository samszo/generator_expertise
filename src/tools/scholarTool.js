import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const SS_BASE = 'https://api.semanticscholar.org/graph/v1';

/** Fetch with automatic retry on 429 / 5xx (exponential backoff). */
async function fetchWithRetry(url, options = {}, { retries = 4, baseDelayMs = 2000 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, options);
    if (res.ok) return res;

    const isRetryable = res.status === 429 || res.status >= 500;
    if (!isRetryable || attempt === retries) {
      throw new Error(`Semantic Scholar request failed: ${res.status} ${res.statusText}`);
    }

    // Honour Retry-After header when present, otherwise exponential backoff
    const retryAfter = res.headers.get('Retry-After');
    const delayMs = retryAfter
      ? Number(retryAfter) * 1000
      : baseDelayMs * 2 ** attempt + Math.random() * 500;

    console.warn(`[scholarTool] HTTP ${res.status} — retry ${attempt + 1}/${retries} in ${Math.round(delayMs)}ms`);
    await new Promise(r => setTimeout(r, delayMs));
  }
}

export const scholarTool = createTool({
  id: 'semantic-scholar-search',
  description: 'Searches Semantic Scholar for publications by a given author name and returns their profile and top papers',
  inputSchema: z.object({
    author: z.string().describe('Full name of the author to search'),
    maxResults: z.number().int().min(1).max(20).default(10).describe('Maximum number of papers to return'),
  }),
  outputSchema: z.object({
    authorId: z.string(),
    authorName: z.string(),
    paperCount: z.number(),
    citationCount: z.number(),
    publications: z.array(
      z.object({
        title: z.string(),
        year: z.string(),
        journal: z.string(),
        citations: z.string(),
        url: z.string(),
      })
    ),
  }),
  execute: async ({ author, maxResults }) => {

    // 1. Find the best matching author
    const searchRes = await fetchWithRetry(
      `${SS_BASE}/author/search?query=${encodeURIComponent(author)}&fields=name,paperCount,citationCount&limit=1`
    );
    const searchData = await searchRes.json();

    if (!searchData.data?.length) {
      return { authorId: '', authorName: author, paperCount: 0, citationCount: 0, publications: [] };
    }

    const { authorId, name: authorName, paperCount, citationCount } = searchData.data[0];

    // 2. Fetch their top papers sorted by citation count
    const papersRes = await fetchWithRetry(
      `${SS_BASE}/author/${authorId}/papers?fields=title,year,venue,citationCount,externalIds&limit=${maxResults}&sort=citationCount`
    );
    const papersData = await papersRes.json();

    const publications = (papersData.data ?? []).map(p => ({
      title: p.title ?? 'Unknown title',
      year: p.year ? String(p.year) : '',
      journal: p.venue ?? '',
      citations: String(p.citationCount ?? 0),
      url: p.externalIds?.DOI
        ? `https://doi.org/${p.externalIds.DOI}`
        : `https://www.semanticscholar.org/author/${authorId}`,
    }));

    return { authorId, authorName, paperCount: paperCount ?? 0, citationCount: citationCount ?? 0, publications };
  },
});
