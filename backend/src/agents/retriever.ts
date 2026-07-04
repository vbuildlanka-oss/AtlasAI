import { retrieve } from '../ingestion/retrieve.js';
import type { RetrievedChunk, SubQueryResult } from '../types.js';

/**
 * Retriever agents — run one semantic search per sub-query (in parallel) and
 * return the evidence grouped by sub-query.
 */
export async function retrieveForPlan(subQueries: string[]): Promise<SubQueryResult[]> {
  return Promise.all(
    subQueries.map(async (subQuery) => ({
      subQuery,
      chunks: await retrieve(subQuery),
    })),
  );
}

/**
 * Build a single, de-duplicated, relevance-ranked evidence set from all
 * sub-query results. A chunk retrieved by multiple sub-queries keeps its best
 * score. This is the pool the synthesizer is allowed to cite.
 */
export function consolidateEvidence(results: SubQueryResult[]): RetrievedChunk[] {
  const byId = new Map<string, RetrievedChunk>();
  for (const { chunks } of results) {
    for (const chunk of chunks) {
      const existing = byId.get(chunk.id);
      if (!existing || chunk.score > existing.score) {
        byId.set(chunk.id, chunk);
      }
    }
  }
  return [...byId.values()].sort((a, b) => b.score - a.score);
}
