/**
 * Full end-to-end integration test against a REAL pgvector engine (PGlite),
 * using the ACTUAL schema.sql and the ACTUAL ingest/retrieve SQL + code.
 *
 * Simulates exactly what the user did:
 *   1. run migrations (the real db/schema.sql)
 *   2. ingest the Atlas 3000 text (real chunker + real embedder + real INSERT)
 *   3. ask "how much water does the atlas 3000 pump?" (real retrieve query)
 *   4. run it through the real synthesizer
 *
 * Passes only if the answer is grounded + cited (not the "no sources" message).
 *
 * This test needs an in-process Postgres+pgvector engine that isn't a runtime
 * dependency of the app. Install it on demand, then run:
 *     npm i -D @electric-sql/pglite@0.2.17
 *     npx tsx scripts/integration-test.ts
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite/vector';
import { chunkText } from '../src/ingestion/chunker.js';
import { embed, embedOne } from '../src/llm/embeddings.js';
import { synthesize } from '../src/agents/synthesizer.js';
import type { RetrievedChunk } from '../src/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const USER_TEXT =
  'The Atlas 3000 is a solar-powered water pump. It can pump 500 liters per hour. ' +
  'It costs $1,200 and comes with a 5-year warranty.';
const USER_QUESTION = 'how much water does the atlas 3000 pump?';

function lit(v: number[]) {
  return `[${v.join(',')}]`;
}

/** Pull the cited claim portion out of the templated answer for readable logs. */
function firstClaim(answer: string): string {
  const m = answer.match(/indicates the following\.\s*(.*?)\s*Every statement/s);
  return (m ? m[1] : answer).trim();
}

let failures = 0;
function check(name: string, ok: boolean, extra?: unknown) {
  if (!ok) failures++;
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${name}${extra !== undefined ? ' -> ' + JSON.stringify(extra) : ''}`);
}

async function main() {
  console.log('\n=== Atlas end-to-end integration test (real schema + real code) ===\n');

  const db = new PGlite({ extensions: { vector } });

  // 1. Run the REAL migration file.
  const schema = await readFile(resolve(__dirname, '../../db/schema.sql'), 'utf8');
  await db.exec(schema);
  console.log('1) Ran real db/schema.sql (incl. HNSW index on empty table)');
  const idx = await db.query<{ indexname: string }>(
    "SELECT indexname FROM pg_indexes WHERE tablename = 'chunks'",
  );
  check('chunks HNSW index exists, no IVFFlat', idx.rows.some((r) => r.indexname.includes('hnsw')) && !idx.rows.some((r) => r.indexname === 'chunks_embedding_idx'), idx.rows.map((r) => r.indexname));

  // 2. Ingest exactly like ingest.ts.
  const chunks = chunkText(USER_TEXT);
  check('text produced >= 1 chunk', chunks.length >= 1, chunks.length);
  const doc = await db.query<{ id: string }>(
    `INSERT INTO documents (title, source_url, source_type, metadata)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    ['Pasted note', null, 'text', '{}'],
  );
  const documentId = doc.rows[0].id;
  const embeddings = await embed(chunks.map((c) => c.content));
  for (let i = 0; i < chunks.length; i++) {
    await db.query(
      `INSERT INTO chunks (document_id, content, embedding, position, token_count)
       VALUES ($1, $2, $3::vector, $4, $5)`,
      [documentId, chunks[i].content, lit(embeddings[i]), chunks[i].position, chunks[i].tokenCount],
    );
  }
  const count = await db.query<{ n: number }>('SELECT COUNT(*)::int AS n FROM chunks');
  console.log(`2) Ingested ${count.rows[0].n} chunk(s) with embeddings`);
  check('chunks stored with non-null embeddings', count.rows[0].n === chunks.length);

  // 3 + 4. For several questions: retrieve exactly like retrieve.ts, then synthesize.
  async function ask(question: string) {
    const qEmb = await embedOne(question);
    const res = await db.query<any>(
      `SELECT c.id, c.document_id, c.content, c.position,
              d.title AS document_title, d.source_url AS source_url,
              1 - (c.embedding <=> $1::vector) AS score
       FROM chunks c JOIN documents d ON d.id = c.document_id
       WHERE c.embedding IS NOT NULL
       ORDER BY c.embedding <=> $1::vector
       LIMIT $2`,
      [lit(qEmb), 6],
    );
    const evidence: RetrievedChunk[] = res.rows.map((r) => ({
      id: r.id,
      documentId: r.document_id,
      documentTitle: r.document_title,
      sourceUrl: r.source_url,
      content: r.content,
      position: r.position,
      score: Number(r.score),
    }));
    const out = await synthesize(question, evidence);
    return { hits: res.rows.length, ...out };
  }

  const main = await ask(USER_QUESTION);
  console.log(`3) Retrieval for "${USER_QUESTION}" returned ${main.hits} chunk(s)`);
  check('retrieval returned at least one chunk (THE bug we are fixing)', main.hits > 0, main.hits);
  console.log('\n4) Synthesized answer:\n   ' + main.answer.replace(/\n/g, '\n   ') + '\n');
  check('answer is NOT the "no sources" message', !/could not find any ingested sources/i.test(main.answer));
  check('answer has at least one citation', main.citations.length > 0, main.citations.length);
  check('offline answer surfaces the pump rate (500 liters)', /500 liters/i.test(main.answer));

  // 5. Generality check across question types (guards against overfitting).
  console.log('\n5) Offline answer quality across question types:');
  const cost = await ask('how much does the atlas 3000 cost?');
  console.log('   cost   -> ' + firstClaim(cost.answer));
  check('  "cost" question surfaces the price ($1,200)', /1,?200/.test(cost.answer));

  const what = await ask('what is the atlas 3000?');
  console.log('   what   -> ' + firstClaim(what.answer));
  check('  "what is" question surfaces the definition', /solar-powered water pump/i.test(what.answer));

  console.log(`\n=== ${failures === 0 ? 'ALL CHECKS PASSED — pipeline works end to end' : failures + ' CHECK(S) FAILED'} ===\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
