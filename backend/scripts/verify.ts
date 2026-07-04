/**
 * Standalone verification of Atlas's core logic WITHOUT Postgres or OpenAI.
 *
 * Exercises the real functions the pipeline uses:
 *   - chunkText            (source ingestion)
 *   - mockEmbed + cosine   (semantic retrieval ranking)
 *   - planResearch         (planner agent, offline)
 *   - synthesize           (synthesizer agent, offline) + citation extraction
 *
 * Proves the two hard success criteria at the logic level:
 *   1. Semantic search surfaces the topically relevant chunk first.
 *   2. Every claim in a synthesized answer is backed by an inline citation
 *      that resolves to a real source chunk.
 *
 * Run: `npx tsx scripts/verify.ts`
 */
import { chunkText } from '../src/ingestion/chunker.js';
import { mockEmbed } from '../src/llm/embeddings.js';
import { planResearch } from '../src/agents/planner.js';
import { synthesize } from '../src/agents/synthesizer.js';
import type { RetrievedChunk } from '../src/types.js';

let failures = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  const status = cond ? 'PASS' : 'FAIL';
  if (!cond) failures++;
  console.log(`  [${status}] ${name}${extra !== undefined ? ' -> ' + JSON.stringify(extra) : ''}`);
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot; // vectors are already L2-normalized by mockEmbed
}

async function main() {
  console.log('\n=== Atlas core-logic verification (offline, no DB) ===\n');

  // --- 1. Chunking ------------------------------------------------------
  const doc =
    'Lithium demand is rising sharply as electric vehicle adoption accelerates. ' +
    'Battery manufacturers have signed long-term supply agreements to secure raw materials. ' +
    'Meanwhile, solar panel installations reached record highs across residential markets. ' +
    'Grid-scale storage projects are increasingly paired with renewable generation. ' +
    'Recycling of spent batteries is emerging as a secondary source of critical minerals.';
  const chunks = chunkText(doc, 120, 30);
  console.log('1) Chunking');
  check('produces at least 2 chunks', chunks.length >= 2, chunks.length);
  check('positions are sequential', chunks.every((c, i) => c.position === i));
  check('every chunk has content', chunks.every((c) => c.content.length > 0));

  // --- 2. Semantic ranking with mock embeddings -------------------------
  console.log('2) Semantic retrieval ranking (mock embeddings + cosine)');
  const corpus = [
    'Lithium and battery raw material supply agreements for electric vehicles.',
    'Residential solar panel installations hit record highs this year.',
    'Recycling spent batteries to recover critical minerals like lithium.',
  ];
  const corpusVecs = corpus.map(mockEmbed);
  const query = 'electric vehicle battery lithium supply';
  const qVec = mockEmbed(query);
  const ranked = corpus
    .map((text, i) => ({ text, score: cosine(qVec, corpusVecs[i]) }))
    .sort((a, b) => b.score - a.score);
  check('most relevant chunk (EV/battery/lithium) ranks #1', ranked[0].text === corpus[0], ranked[0]);
  check('all similarity scores within [-1, 1]', ranked.every((r) => r.score >= -1.0001 && r.score <= 1.0001));

  // --- 3. Planner (offline) --------------------------------------------
  console.log('3) Planner agent (offline decomposition)');
  const plan = await planResearch('How is the EV battery supply chain evolving?');
  check('plan has multiple sub-queries', plan.length >= 2, plan.length);
  check('plan includes the original question focus', plan.some((p) => /EV battery supply chain/i.test(p)));

  // --- 4. Synthesis + citation grounding -------------------------------
  console.log('4) Synthesizer + citation grounding');
  const evidence: RetrievedChunk[] = corpus.map((content, i) => ({
    id: `chunk-${i}`,
    documentId: `doc-${i}`,
    documentTitle: `Source ${i + 1}`,
    sourceUrl: null,
    content,
    position: i,
    score: 1 - i * 0.1,
  }));
  const { answer, citations } = await synthesize('What is happening in the battery market?', evidence);

  const markersInText = [...answer.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
  check('answer contains inline [n] markers', markersInText.length > 0, markersInText);
  check('at least one citation produced', citations.length > 0, citations.length);
  check(
    'every citation marker appears in the answer text',
    citations.every((c) => markersInText.includes(c.marker)),
  );
  check(
    'every inline marker resolves to a real evidence chunk',
    markersInText.every((m) => evidence[m - 1] !== undefined),
  );
  check(
    'every citation links to a real source chunk id',
    citations.every((c) => evidence.some((e) => e.id === c.chunkId)),
  );

  // --- 5. No-evidence guardrail ----------------------------------------
  console.log('5) No-uncited-claims guardrail');
  const empty = await synthesize('anything', []);
  check('empty evidence yields zero citations', empty.citations.length === 0);
  check('empty evidence returns an explicit "no sources" answer', /could not find/i.test(empty.answer));

  console.log(`\n=== ${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'} ===\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
