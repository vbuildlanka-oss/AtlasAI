import pg from 'pg';
import { config } from '../config.js';

const { Pool } = pg;

export const pool = new Pool({ connectionString: config.databaseUrl });

pool.on('error', (err) => {
  // A backend that keeps running even if an idle client errors out.
  console.error('[db] unexpected idle client error', err);
});

/** Format a JS number[] as a pgvector literal: "[0.1,0.2,...]". */
export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

export async function healthcheck(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}
