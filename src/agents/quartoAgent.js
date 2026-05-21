import { callAlbert } from '../tools/albertTool.js';

// ── Prompts ───────────────────────────────────────────────────────────────────

const MERMAID_INSTRUCTIONS = `You are an expert at analyzing academic texts and visualizing their argumentative structure.

Given a text and its semantic context, produce a Mermaid flowchart (graph LR) that shows:
- The central thesis or main claim (root node)
- Key arguments and sub-claims (intermediate nodes)
- Supporting concepts or evidence (leaf nodes)
- Logical connections between them

Rules:
- Start with exactly "graph LR" on the first line
- Keep node labels to 3–6 words; wrap in double quotes if they contain spaces or special characters
- Use --> for logical flow, -.-> for supporting connections, ==> for strong conclusions
- Between 6 and 12 nodes total
- Use simple alphanumeric IDs (A, B, C1, arg1, concl, etc.)
- Do NOT wrap in markdown fences — return raw Mermaid code only`;

const BIBTEX_INSTRUCTIONS = `You are a bibliographic expert. Generate valid BibTeX entries from the given sources.

Rules:
- Choose the right entry type: @article for journal papers, @inproceedings for conferences, @book for books, @misc for web pages
- Build cite keys as: FirstAuthorLastNameYear (e.g., LeCun2015). Use AuthorShortTitleYear if multiple entries share the same year
- Include all available fields: author, title, year, journal or booktitle, url, note
- For web sources use @misc with howpublished = {\\url{...}} and a note field with the access date
- Omit fields that are genuinely unknown — never write "Unknown" or "N/A"
- Return ONLY raw BibTeX, no explanation, no markdown fences`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function cleanMermaid(raw) {
  return raw
    .replace(/^```(?:mermaid)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
}

function cleanBibtex(raw) {
  return raw
    .replace(/^```(?:bibtex)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
}

function langCode(language = '') {
  const l = language.toLowerCase();
  if (l.startsWith('fr') || l === 'french') return 'fr';
  if (l.startsWith('de') || l === 'german')  return 'de';
  if (l.startsWith('es') || l === 'spanish') return 'es';
  return 'en';
}

function today() {
  return new Date().toISOString().split('T')[0];
}

// ── Agent ─────────────────────────────────────────────────────────────────────

export const quartoAgent = {
  name: 'quartoAgent',

  async generate({ title, text, authorVoiceNotes, semanticContext, authorProfile, scholarData, webSource }) {
    // Mermaid (needs generated text) + BibTeX (only needs scholar data) — in parallel
    const [mermaidCode, bibContent] = await Promise.all([
      this._generateMermaid(text, semanticContext),
      this._generateBibtex(scholarData, webSource, authorProfile),
    ]);

    const qmd = this._assembleQuarto({
      title, text, authorVoiceNotes, semanticContext, authorProfile,
      mermaidCode,
    });

    return { qmd, bib: bibContent, mermaid: mermaidCode };
  },

  // ── Mermaid ───────────────────────────────────────────────────────────────

  async _generateMermaid(text, semanticContext) {
    const userMessage = [
      `Text to analyze:\n\n${text}`,
      `\nSemantic context:`,
      `- Main topic: ${semanticContext.mainTopic}`,
      `- Themes: ${semanticContext.themes.join(', ')}`,
      `- Tone: ${semanticContext.tone}`,
      `- Key concepts: ${semanticContext.keyConcepts.slice(0, 5).map(c => c.term).join(', ')}`,
    ].join('\n');

    const raw = await callAlbert(MERMAID_INSTRUCTIONS, userMessage);
    return cleanMermaid(raw);
  },

  // ── BibTeX ────────────────────────────────────────────────────────────────

  async _generateBibtex(scholarData, webSource, authorProfile) {
    const pubLines = (scholarData.publications ?? []).map((p, i) => {
      const parts = [
        `[${i + 1}] "${p.title}"`,
        p.year       ? `Year: ${p.year}`        : '',
        p.journal    ? `Venue: ${p.journal}`     : '',
        p.citations  ? `Citations: ${p.citations}` : '',
        p.url        ? `URL: ${p.url}`           : '',
      ].filter(Boolean);
      return parts.join(' | ');
    });

    const userMessage = [
      `Author: ${authorProfile.name}`,
      '',
      `Web source:`,
      `  Title: "${webSource.title}"`,
      `  URL: ${webSource.url}`,
      `  Accessed: ${today()}`,
      '',
      `Publications by the author (from Semantic Scholar):`,
      pubLines.join('\n'),
    ].join('\n');

    const raw = await callAlbert(BIBTEX_INSTRUCTIONS, userMessage);
    return cleanBibtex(raw);
  },

  // ── Quarto assembly ───────────────────────────────────────────────────────

  _assembleQuarto({ title, text, authorVoiceNotes, semanticContext, authorProfile, mermaidCode }) {
    const safeTitle = title.replace(/"/g, '\\"');
    const lang = langCode(semanticContext.language);

    const conceptLines = semanticContext.keyConcepts
      .slice(0, 8)
      .map(c => `- **${c.term}** : ${c.definition}`)
      .join('\n');

    const themeLines = semanticContext.themes.map(t => `  - ${t}`).join('\n');

    return `---
title: "${safeTitle}"
author: "${authorProfile.name}"
date: "${today()}"
lang: "${lang}"
format:
  html:
    toc: true
    toc-depth: 3
    theme: cosmo
    code-fold: true
  pdf:
    toc: true
bibliography: references.bib
nocite: "@*"
---

## Contexte sémantique

> *${semanticContext.summary}*

| Champ | Valeur |
|---|---|
| Sujet principal | ${semanticContext.mainTopic} |
| Audience | ${semanticContext.targetAudience} |
| Registre | ${semanticContext.tone} |
| Langue source | ${semanticContext.language} |

### Thèmes

${themeLines}

### Concepts clés

${conceptLines}

---

## ${title}

${text}

---

## Flux argumentatif

\`\`\`{mermaid}
${mermaidCode}
\`\`\`

---

## Notes sur le style de l'auteur

*${authorVoiceNotes}*

**Profil académique de ${authorProfile.name}**

| Champ | Valeur |
|---|---|
| Discipline | ${authorProfile.mainDiscipline} |
| Style d'écriture | ${authorProfile.writingStyle} |
| Approche argumentative | ${authorProfile.argumentativeApproach} |

---

## Bibliographie

::: {#refs}
:::
`;
  },
};
