import 'dotenv/config';
import { Mastra } from '@mastra/core';
import { textGenerationWorkflow } from './workflows/textGenerationWorkflow.js';

const mastra = new Mastra({
  workflows: { textGenerationWorkflow },
});

async function main() {
  const url = process.argv[2] || 'https://en.wikipedia.org/wiki/Semantic_web';
  const authorName = process.argv[3] || 'Tim Berners-Lee';

  console.log(`\n=== Text Generation Workflow ===`);
  console.log(`Source URL  : ${url}`);
  console.log(`Author      : ${authorName}`);
  console.log('================================\n');

  const workflow = mastra.getWorkflow('textGenerationWorkflow');
  const run = await workflow.createRun();

  const result = await run.start({
    inputData: { url, authorName },
  });

  if (result.status === 'success') {
    const { title, text, authorVoiceNotes } = result.result;
    console.log(`TITLE: ${title}\n`);
    console.log(`TEXT:\n${text}\n`);
    console.log(`AUTHOR VOICE NOTES:\n${authorVoiceNotes}\n`);
  } else {
    console.error('Workflow failed:', result.status);
    if (result.steps) {
      for (const [stepId, stepResult] of Object.entries(result.steps)) {
        if (stepResult.status !== 'success') {
          console.error(`  Step "${stepId}" failed:`, stepResult.error);
        }
      }
    }
  }
}

main().catch(console.error);
