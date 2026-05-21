import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { contextAgent } from '../agents/contextAgent.js';
import { authorAgent } from '../agents/authorAgent.js';
import { writerAgent } from '../agents/writerAgent.js';

// ── Schemas ───────────────────────────────────────────────────────────────────

const SemanticContextSchema = z.object({
  mainTopic: z.string(),
  keyConcepts: z.array(z.object({ term: z.string(), definition: z.string() })),
  summary: z.string(),
  themes: z.array(z.string()),
  targetAudience: z.string(),
  tone: z.string(),
  language: z.string(),
});

const AuthorProfileSchema = z.object({
  name: z.string(),
  mainDiscipline: z.string(),
  researchAreas: z.array(z.string()),
  writingStyle: z.string(),
  argumentativeApproach: z.string(),
  notablePublications: z.array(z.object({ title: z.string(), year: z.string() })),
  academicVoice: z.string(),
});

const GeneratedTextSchema = z.object({
  title: z.string(),
  text: z.string(),
  authorVoiceNotes: z.string(),
});

// ── Step 1: contextAgent + authorAgent en parallèle ───────────────────────────

const coordinatorStep = createStep({
  id: 'coordinator',
  description: 'Runs contextAgent and authorAgent in parallel',
  inputSchema: z.object({
    url: z.string().url(),
    authorName: z.string(),
  }),
  outputSchema: z.object({
    semanticContext: SemanticContextSchema,
    authorProfile: AuthorProfileSchema,
  }),
  execute: async ({ inputData }) => {
    const { url, authorName } = inputData;
    const [semanticContext, authorProfile] = await Promise.all([
      contextAgent.generate(url),
      authorAgent.generate(authorName),
    ]);
    return { semanticContext, authorProfile };
  },
});

// ── Step 2: writerAgent génère le texte final ─────────────────────────────────

const generateTextStep = createStep({
  id: 'generate-text',
  description: 'Generates an original text on the topic in the voice of the author',
  inputSchema: z.object({
    semanticContext: SemanticContextSchema,
    authorProfile: AuthorProfileSchema,
  }),
  outputSchema: GeneratedTextSchema,
  execute: async ({ inputData }) => {
    return writerAgent.generate(inputData.semanticContext, inputData.authorProfile);
  },
});

// ── Workflow ──────────────────────────────────────────────────────────────────

export const textGenerationWorkflow = createWorkflow({
  id: 'text-generation',
  description: 'Generates an original text on a web page topic in the style of a given scholar',
  inputSchema: z.object({
    url: z.string().url().describe('Source web page URL'),
    authorName: z.string().describe('Name of the scholar whose style to emulate'),
  }),
  outputSchema: GeneratedTextSchema,
})
  .then(coordinatorStep)
  .then(generateTextStep)
  .commit();
