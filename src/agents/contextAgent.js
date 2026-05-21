import { callAlbert } from '../tools/albertTool.js';
import { webFetchTool } from '../tools/webFetchTool.js';

const INSTRUCTIONS = `You are a semantic analysis expert. Given the raw text content of a web page, you extract and structure a rich semantic context.

Your output must be a JSON object with the following fields:
- "mainTopic": the central subject of the page (1 sentence)
- "keyConcepts": array of 5–10 key concepts or terms, each as { "term": "...", "definition": "..." }
- "summary": a 3–5 sentence synthesis of the content
- "themes": array of 3–5 overarching themes
- "targetAudience": who the content is aimed at
- "tone": the rhetorical tone (academic, journalistic, technical, etc.)
- "language": detected language of the source

Always respond with valid JSON only, no markdown fences.`;

export const contextAgent = {
  name: 'contextAgent',
  async generate(url) {
    const { content, title } = await webFetchTool.execute({ url });
    const userMessage = `Analyze the semantic context of this web page titled "${title}":\n\n${content}`;
    const raw = await callAlbert(INSTRUCTIONS, userMessage);
    const result = JSON.parse(cleanJson(raw));
    return {
      result,
      source: { url, title, contentSnippet: content.slice(0, 1500) },
      prompt: { system: INSTRUCTIONS, user: userMessage },
    };
  },
};

function cleanJson(text) {
  return text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
}
