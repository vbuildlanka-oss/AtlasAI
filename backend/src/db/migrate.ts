import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { pool } from './pool.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Applies db/schema.sql. Idempotent: every statement uses IF NOT EXISTS.
 * Run with `npm run migrate` after Postgres (pgvector) is up.
 */
export async function migrate(): Promise<void> {
  const schemaPath = resolve(__dirname, '../../../db/schema.sql');
  const sql = await readFile(schemaPath, 'utf8');
  await pool.query(sql);
  console.log('[migrate] schema applied from', schemaPath);
}

// Allow running directly: `tsx src/db/migrate.ts`
if (import.meta.url === `file://${process.argv[1]}`) {
  migrate()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[migrate] failed:', err);
      process.exit(1);
    });
}
