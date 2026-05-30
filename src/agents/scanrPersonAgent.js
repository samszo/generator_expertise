import { callAlbert } from '../tools/albertTool.js';
import { scanrPersonTool } from '../tools/scanrPersonTool.js';

const INSTRUCTIONS = `You are an expert in French academic research. Given raw scanR data for an author, extract and summarize their academic profile.

Your output must be a JSON object with the following fields:
- "id": the scanR identifier (e.g. "idref/123456")
- "fullName": the author's full name
- "affiliations": array of institution names they are or have been affiliated with
- "mainDiscipline": their primary academic field or domain
- "researchAreas": array of 3–6 specific research topics
- "publicationCount": estimated total number of publications (integer or null if unknown)
- "awards": array of awards or distinctions (empty array if none)
- "websites": array of known web profile URLs (ORCID, HAL, IdRef, personal page…)
- "summary": a short paragraph (3–5 sentences) describing the author's academic profile and contributions

Always respond with valid JSON only, no markdown fences.`;

export const scanrPersonAgent = {
  name: 'scanrPersonAgent',
  async generate(authorName) {
    const scanrData = await scanrPersonTool.execute({ name: authorName, limit: 3 });

    if (!scanrData.found) {
      return {
        result: null,
        source: scanrData,
        prompt: { system: INSTRUCTIONS, user: `Author: ${authorName}` },
        error: `No scanR record found for "${authorName}"`,
      };
    }

    // Use the best match (first result)
    const person = scanrData.persons[0];
    const dataStr = JSON.stringify(person.data ?? {}, null, 2);
    const userMessage = `scanR record for "${person.fullName}" (id: ${person.id}):\n\n${dataStr}`;

    const raw = await callAlbert(INSTRUCTIONS, userMessage);
    const result = JSON.parse(cleanJson(raw));

    return {
      result,
      source: scanrData,
      prompt: { system: INSTRUCTIONS, user: userMessage },
    };
  },
};

function cleanJson(text) {
  return text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
}
