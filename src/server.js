import 'dotenv/config';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { Mastra } from '@mastra/core';
import { textGenerationWorkflow } from './workflows/textGenerationWorkflow.js';

const mastra = new Mastra({ workflows: { textGenerationWorkflow } });

const app = new Hono();

app.use('/public/*', serveStatic({ root: './' }));

app.get('/', serveStatic({ path: './public/index.html' }));

app.post('/api/generate', async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { url, authorName } = body;
  if (!url || !authorName) {
    return c.json({ error: 'Les champs url et authorName sont requis' }, 400);
  }

  const workflow = mastra.getWorkflow('textGenerationWorkflow');
  const run = await workflow.createRun();
  const result = await run.start({ inputData: { url, authorName } });

  if (result.status === 'success') {
    return c.json(result.result);
  }

  const stepErrors = Object.entries(result.steps ?? {})
    .filter(([, s]) => s.status !== 'success')
    .map(([id, s]) => ({ step: id, error: s.error }));

  return c.json({ error: 'Workflow échoué', status: result.status, steps: stepErrors }, 500);
});

const port = Number(process.env.PORT ?? 3000);
console.log(`Serveur démarré → http://localhost:${port}`);
serve({ fetch: app.fetch, port });
