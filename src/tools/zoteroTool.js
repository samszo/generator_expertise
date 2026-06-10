import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

//const ZOTERO_BASE = 'https://api.zotero.org';
const ZOTERO_BASE = 'http://127.0.0.1:23119/api';

/**
 * Build Zotero API headers (API key optional for public libraries).
 */
function zoteroHeaders() {
  const headers = { 'Zotero-API-Version': '3' };
  if (process.env.ZOTERO_API_KEY) headers['Authorization'] = `Bearer ${process.env.ZOTERO_API_KEY}`;
  return headers;
}

/**
 * Return the base path for the configured Zotero library.
 * Priority : group > user.
 */
function libraryPath() {
  if (process.env.ZOTERO_GROUP_ID) return `/groups/${process.env.ZOTERO_GROUP_ID}`;
  if (process.env.ZOTERO_USER_ID)  return `/users/${process.env.ZOTERO_USER_ID}`;
  throw new Error('Set ZOTERO_USER_ID or ZOTERO_GROUP_ID in your .env');
}

/** Fetch all pages of a Zotero endpoint (follows Link: rel=next headers). */
async function fetchAllPages(url, headers, maxItems = 100) {
  const items = [];
  let nextUrl = url;
  while (nextUrl && items.length < maxItems) {
    const res = await fetch(nextUrl, { headers });
    if (!res.ok) throw new Error(`Zotero API error ${res.status}: ${nextUrl}`);
    const page = await res.json();
    items.push(...page);
    // Parse Link header for next page
    const link = res.headers.get('Link') ?? '';
    const match = link.match(/<([^>]+)>;\s*rel="next"/);
    nextUrl = match ? match[1] : null;
  }
  return items.slice(0, maxItems);
}

/** Extract child notes for a list of item keys. */
async function fetchNotes(base, headers, itemKeys) {
  const notes = [];
  for (const key of itemKeys.slice(0, 20)) { // limit requests
    const res = await fetch(`${base}/items/${key}/children?itemType=note`, { headers });
    if (!res.ok) continue;
    const children = await res.json();
    for (const c of children) {
      const noteText = c.data?.note ?? '';
      // Strip basic HTML tags from Zotero note HTML
      const plain = noteText.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/\s{2,}/g, ' ').trim();
      if (plain) notes.push({ itemKey: key, text: plain });
    }
  }
  return notes;
}

export const zoteroTool = createTool({
  id: 'zotero-author-search',
  description:
    'Searches a Zotero library for items related to an author (by creator name or tag) and returns their tags and notes.',
  inputSchema: z.object({
    authorName: z.string().describe('Full name of the author to search in Zotero'),
    maxItems: z.number().int().min(1).max(100).default(50)
      .describe('Maximum number of items to retrieve'),
    searchMode: z.enum(['creator', 'tag', 'both']).default('both')
      .describe('Search by creator name, by tag, or both'),
  }),
  outputSchema: z.object({
    found: z.boolean(),
    itemCount: z.number(),
    tags: z.array(z.object({ tag: z.string(), count: z.number() })),
    notes: z.array(z.object({ itemKey: z.string(), text: z.string() })),
    items: z.array(z.object({
      key: z.string(),
      title: z.string(),
      year: z.string(),
      itemType: z.string(),
      tags: z.array(z.string()),
      creators: z.array(z.string()),
    })),
  }),
  execute: async ({ authorName, maxItems, searchMode }) => {
    const base = `${ZOTERO_BASE}${libraryPath()}`;
    const headers = zoteroHeaders();

    // ── Collect items ─────────────────────────────────────────────────────────
    const seen = new Map(); // key → item data

    const addItems = (list) => {
      for (const item of list) {
        if (item.data?.itemType === 'attachment' || item.data?.itemType === 'note') continue;
        seen.set(item.key, item);
      }
    };

    // Search by creator (q= searches title + creator fields)
    if (searchMode === 'creator' || searchMode === 'both') {
      const creatorItems = await fetchAllPages(
        `${base}/items?q=${encodeURIComponent(authorName)}&qmode=everything&limit=100`,
        headers, maxItems
      );
      addItems(creatorItems);
    }

    // Search by tag (exact tag matching)
    if (searchMode === 'tag' || searchMode === 'both') {
      const tagItems = await fetchAllPages(
        `${base}/items?tag=${encodeURIComponent(authorName)}&limit=100`,
        headers, maxItems
      );
      addItems(tagItems);
    }

    const allItems = [...seen.values()].slice(0, maxItems);

    if (!allItems.length) {
      return { found: false, itemCount: 0, tags: [], notes: [], items: [] };
    }

    // ── Aggregate tags ────────────────────────────────────────────────────────
    const tagCount = new Map();
    for (const item of allItems) {
      for (const t of item.data?.tags ?? []) {
        const name = t.tag?.trim();
        if (name) tagCount.set(name, (tagCount.get(name) ?? 0) + 1);
      }
    }
    const tags = [...tagCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([tag, count]) => ({ tag, count }));

    // ── Fetch notes ───────────────────────────────────────────────────────────
    const itemKeys = allItems.map(i => i.key);
    const notes = await fetchNotes(base, headers, itemKeys);

    // ── Shape item list ───────────────────────────────────────────────────────
    const items = allItems.map(item => {
      const d = item.data ?? {};
      const creators = (d.creators ?? []).map(c =>
        [c.firstName, c.lastName].filter(Boolean).join(' ') || c.name || ''
      ).filter(Boolean);
      return {
        key: item.key,
        title: d.title ?? '',
        year: String(d.date ?? d.year ?? '').slice(0, 4),
        itemType: d.itemType ?? '',
        tags: (d.tags ?? []).map(t => t.tag).filter(Boolean),
        creators,
      };
    });

    return { found: true, itemCount: items.length, tags, notes, items };
  },
});
