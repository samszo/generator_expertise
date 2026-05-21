import { callAlbert } from '../tools/albertTool.js';
import { scholarTool } from '../tools/scholarTool.js';

const INSTRUCTIONS = `You are an academic bibliometrics expert. Given an author name and a list of their publications found on Google Scholar, you build a detailed author profile.

Your output must be a JSON object with the following fields:
- "name": the author's full name
- "mainDiscipline": their primary academic field
- "researchAreas": array of 3–6 specific research topics they work on
- "writingStyle": description of their typical academic writing style (formal, narrative-driven, data-heavy, etc.)
- "argumentativeApproach": how they typically structure arguments (empirical, theoretical, comparative, etc.)
- "notablePublications": array of their top 3 publications as { "title": "...", "year": "..." }
- "academicVoice": a short paragraph describing their intellectual personality and voice

Always respond with valid JSON only, no markdown fences.`;

export const authorAgent = {
  name: 'authorAgent',
  async generate(authorName) {
    const { authorName: resolvedName, paperCount, citationCount, publications } = await scholarTool.execute({
      author: authorName, maxResults: 10,
    });

    const header = `Author: ${resolvedName} — ${paperCount} papers, ${citationCount} total citations (Semantic Scholar)`;
    const pubList = publications.length
      ? publications.map(p => `- ${p.title} (${p.year})${p.journal ? `, ${p.journal}` : ''}, cited ${p.citations} times`).join('\n')
      : '(no publications found — infer from the author name)';

    const raw = await callAlbert(
      INSTRUCTIONS,
      `${header}\n\nTop publications:\n${pubList}`
    );
    return JSON.parse(cleanJson(raw));
  },
};

function cleanJson(text) {
  return text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
}
