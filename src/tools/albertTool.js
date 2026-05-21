import 'dotenv/config';
import OpenAI from 'openai';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const client = new OpenAI({
  baseURL: process.env.ALBERT_BASE_URL,
  apiKey: process.env.ALBERT_API_KEY,
});

/**
 * Direct helper used by agents to call the Albert AI service.
 * Returns the raw text response from the model.
 */
export async function callAlbert(systemPrompt, userMessage) {
  const completion = await client.chat.completions.create({
    model: process.env.ALBERT_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
  });
  return completion.choices[0]?.message?.content ?? '';
}

/**
 * Mastra tool wrapping the Albert AI service.
 * Can be registered in the Mastra instance or used inside workflow steps.
 */
export const albertTool = createTool({
  id: 'albert-ai',
  description: 'Calls the Albert AI service (Etalab) with a system prompt and a user message',
  inputSchema: z.object({
    systemPrompt: z.string().describe('System instructions given to the model'),
    userMessage: z.string().describe('User message or query'),
  }),
  outputSchema: z.object({
    response: z.string().describe('Raw text response from the model'),
  }),
  execute: async ({ systemPrompt, userMessage }) => {
    const response = await callAlbert(systemPrompt, userMessage);
    return { response };
  },
});
