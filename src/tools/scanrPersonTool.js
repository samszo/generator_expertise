import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import mysql from 'mysql2/promise';

function getConnection() {
  return mysql.createConnection({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME ?? 'scanr',
  });
}

export const scanrPersonTool = createTool({
  id: 'scanr-person-search',
  description:
    'Searches the scanr_person table for an author by full name (fulltext or partial match) and returns their raw JSON data from scanR.',
  inputSchema: z.object({
    name: z.string().describe('Full or partial name of the author to search in scanR'),
    limit: z.number().int().min(1).max(20).default(5).describe('Maximum number of results to return'),
  }),
  outputSchema: z.object({
    found: z.boolean(),
    persons: z.array(
      z.object({
        id: z.string(),
        fullName: z.string().nullable(),
        data: z.record(z.any()).nullable(),
        imported_at: z.string().nullable(),
      })
    ),
  }),
  execute: async ({ name, limit }) => {
    const conn = await getConnection();
    try {
      // Fulltext search first, fall back to LIKE if no results
      const [ftRows] = await conn.execute(
        `SELECT id, fullName, data, imported_at
         FROM scanr_person
         WHERE MATCH(fullName) AGAINST (? IN BOOLEAN MODE)
         LIMIT ?`,
        [name, limit]
      );

      let rows = ftRows;
      if (!rows.length) {
        const [likeRows] = await conn.execute(
          `SELECT id, fullName, data, imported_at
           FROM scanr_person
           WHERE fullName LIKE ?
           LIMIT ?`,
          [`%${name}%`, limit]
        );
        rows = likeRows;
      }

      const persons = rows.map(r => ({
        id: r.id,
        fullName: r.fullName ?? null,
        data: r.data ? JSON.parse(r.data) : null,
        imported_at: r.imported_at ? String(r.imported_at) : null,
      }));

      return { found: persons.length > 0, persons };
    } finally {
      await conn.end();
    }
  },
});
