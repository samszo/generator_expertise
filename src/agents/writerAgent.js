import { callAlbert } from '../tools/albertTool.js';

const INSTRUCTIONS = `You are a ghost-writer capable of adopting any academic or intellectual voice.

You will receive:
1. A semantic context object describing the topic and themes of a source page
2. An author profile object describing a scholar's style and research areas

Your task is to write an original text that:
- Addresses the main topic and key themes from the context
- Adopts the writing style, argumentative approach, and intellectual voice of the given author
- Is between 400 and 600 words
- Follows the tone and audience described in the context
- Does NOT copy any sentences from the source — it is a new, original piece

Return your response as a JSON object with:
- "title": a fitting title for the text
- "text": the full generated text
- "authorVoiceNotes": 2–3 sentences explaining how you applied the author's voice

Always respond with valid JSON only, no markdown fences.`;

export const writerAgent = {
  name: 'writerAgent',
  async generate(semanticContext, authorProfile) {
    const userMessage = `Semantic context of the topic:\n${JSON.stringify(semanticContext, null, 2)}\n\nAuthor profile to emulate:\n${JSON.stringify(authorProfile, null, 2)}`;
    const raw = await callAlbert(INSTRUCTIONS, userMessage);
    const result = JSON.parse(cleanJson(raw));
    return {
      result,
      prompt: { system: INSTRUCTIONS, user: userMessage },
    };
  },
};

function cleanJson(text) {
  return text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
}
