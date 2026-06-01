import { callAlbert } from '../tools/albertTool.js';
import { zoteroTool } from '../tools/zoteroTool.js';

const INSTRUCTIONS = `You are an expert academic analyst. You receive:
1. An existing author profile (JSON) built from bibliometric sources (Semantic Scholar or scanR).
2. Data extracted from a Zotero bibliography: a list of items referencing the author, their tags, and any annotated notes.

Your task is to ENRICH the author profile by integrating the Zotero insights. Return a single JSON object that MERGES and EXTENDS the original profile with the following additional fields:

- "zoteroInsights": object with:
    - "thematicTags": array of the most significant tags from Zotero (max 10), each as { "tag": "...", "frequency": N }
    - "readerAnnotations": array of key ideas or remarks extracted from the Zotero notes (max 8 bullet strings)
    - "referencedWorks": array of up to 5 notable works found in the Zotero library as { "title": "...", "year": "...", "type": "..." }
    - "perceivedImpact": a short paragraph (2–3 sentences) describing how this author is perceived and used by the readers of the Zotero library, based on tags and notes
    - "additionalResearchAreas": array of research topics found in Zotero tags that are NOT already listed in the original profile's researchAreas (may be empty)
- "enrichedResearchAreas": the original researchAreas merged with additionalResearchAreas (deduped)
- "enrichmentSource": "zotero"

Keep ALL original fields from the input profile intact. Only add or extend fields.
Always respond with valid JSON only, no markdown fences.`;

export const zoteroEnrichAgent = {
  name: 'zoteroEnrichAgent',

  /**
   * Enrich an author profile with Zotero bibliography data.
   * @param {object} authorProfile  - Structured profile from authorAgent or scanrPersonAgent
   * @param {string} authorName     - Name used to search Zotero (may differ from profile name)
   * @param {object} [options]
   * @param {'creator'|'tag'|'both'} [options.searchMode='both']
   * @param {number} [options.maxItems=50]
   */
  async generate(authorProfile, authorName, { searchMode = 'both', maxItems = 50 } = {}) {
    // 1. Fetch Zotero data
    const zoteroData = await zoteroTool.execute({ authorName, maxItems, searchMode });

    if (!zoteroData.found) {
      return {
        result: { ...authorProfile, zoteroInsights: null, enrichmentSource: 'zotero', enrichedResearchAreas: authorProfile.researchAreas ?? [] },
        source: zoteroData,
        prompt: null,
        warning: `No Zotero items found for "${authorName}"`,
      };
    }

    // 2. Build the LLM prompt
    const topTags = zoteroData.tags.slice(0, 30)
      .map(t => `${t.tag} (×${t.count})`).join(', ');

    const notesBlock = zoteroData.notes.length
      ? zoteroData.notes.slice(0, 10).map((n, i) => `Note ${i + 1}: ${n.text.slice(0, 400)}`).join('\n\n')
      : '(no notes found)';

    const itemsBlock = zoteroData.items.slice(0, 20).map(item =>
      `- [${item.year}] "${item.title}" (${item.itemType})${item.tags.length ? ` — tags: ${item.tags.slice(0, 5).join(', ')}` : ''}`
    ).join('\n');

    const userMessage = `## Existing author profile
${JSON.stringify(authorProfile, null, 2)}

## Zotero library data for "${authorName}"
${zoteroData.itemCount} items found.

### Top tags
${topTags}

### Annotated notes
${notesBlock}

### Items referencing this author
${itemsBlock}`;

    // 3. Call LLM
    const raw = await callAlbert(INSTRUCTIONS, userMessage);
    const result = JSON.parse(cleanJson(raw));

    return {
      result,
      source: zoteroData,
      prompt: { system: INSTRUCTIONS, user: userMessage },
    };
  },
};

function cleanJson(text) {
  return text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
}
