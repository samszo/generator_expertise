import 'dotenv/config';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { contextAgent } from './agents/contextAgent.js';
import { authorAgent } from './agents/authorAgent.js';
import { scanrPersonAgent } from './agents/scanrPersonAgent.js';
import { writerAgent } from './agents/writerAgent.js';
import { quartoAgent } from './agents/quartoAgent.js';
import { scholarTool } from './tools/scholarTool.js';
import { scanrPersonTool } from './tools/scanrPersonTool.js';
import { webFetchTool } from './tools/webFetchTool.js';

const app = new Hono();

app.use('/public/*', serveStatic({ root: './' }));
app.get('/', serveStatic({ path: './public/index.html' }));

// ── Recherche des auteurs (Semantic Scholar + scanR) ──────────────────────────
app.post('/api/search', async (c) => {
  let body;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }

  const { url, authorName } = body;
  if (!url || !authorName) return c.json({ error: 'Les champs url et authorName sont requis' }, 400);

  const [webData, scholarData, scanrData] = await Promise.allSettled([
    webFetchTool.execute({ url }),
    scholarTool.execute({ author: authorName, maxResults: 5 }),
    scanrPersonTool.execute({ name: authorName, limit: 5 }),
  ]);

  return c.json({
    web: webData.status === 'fulfilled'
      ? { url, title: webData.value.title }
      : { url, title: url, error: webData.reason?.message },
    semanticScholar: scholarData.status === 'fulfilled'
      ? (scholarData.value.authorId
          ? [{ id: scholarData.value.authorId, name: scholarData.value.authorName,
               paperCount: scholarData.value.paperCount, citationCount: scholarData.value.citationCount,
               publications: scholarData.value.publications }]
          : [])
      : [],
    scanr: scanrData.status === 'fulfilled' ? scanrData.value.persons : [],
    errors: {
      semanticScholar: scholarData.status === 'rejected' ? scholarData.reason?.message : null,
      scanr: scanrData.status === 'rejected' ? scanrData.reason?.message : null,
    },
  });
});

// ── Génération d'expertise ────────────────────────────────────────────────────
app.post('/api/generate', async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { url, authorName, authorSource } = body;
  if (!url || !authorName) {
    return c.json({ error: 'Les champs url et authorName sont requis' }, 400);
  }

  // Étape 1 : contextAgent + authorAgent en parallèle (agent choisi selon la source)
  const pickAuthorAgent = authorSource === 'scanr' ? scanrPersonAgent : authorAgent;
  const [contextData, authorData] = await Promise.all([
    contextAgent.generate(url),
    pickAuthorAgent.generate(authorName),
  ]);

  // Étape 2 : writerAgent + quartoAgent (mermaid + bibtex) en parallèle
  // writerAgent génère le texte ; quartoAgent a besoin du texte pour le mermaid
  // → on lance writerAgent d'abord, puis quartoAgent en parallèle sur ses deux sous-tâches
  const writerData = await writerAgent.generate(contextData.result, authorData.result);

  const quartoData = await quartoAgent.generate({
    title: writerData.result.title,
    text: writerData.result.text,
    authorVoiceNotes: writerData.result.authorVoiceNotes,
    semanticContext: contextData.result,
    authorProfile: authorData.result,
    scholarData: authorData.source,
    webSource: contextData.source,
  });

  return c.json({
    ...writerData.result,
    quarto: quartoData,
    trace: {
      contextAgent: {
        source: contextData.source,
        prompt: contextData.prompt,
        result: contextData.result,
      },
      authorAgent: {
        source: authorData.source,
        prompt: authorData.prompt,
        result: authorData.result,
      },
      writerAgent: {
        prompt: writerData.prompt,
      },
    },
  });
});

const port = Number(process.env.PORT ?? 3000);
console.log(`Serveur démarré → http://localhost:${port}`);
serve({ fetch: app.fetch, port });
