import { pool, toVectorLiteral } from '../db/pool.js';
import { config } from '../config.js';
import { embedOne } from '../llm/embeddings.js';
import type { RetrievedChunk } from '../types.js';

/**
 * Semantic top-k retrieval over pgvector.
 *
 * Embeds the query, then finds the nearest chunks by cosine distance (<=>).
 * Distance is converted to a [0,1] similarity score for display. Because
 * embeddings are L2-normalized, cosine distance in [0,2] maps to similarity
 * = 1 - distance/2... but pgvector's cosine distance is already 1 - cosine,
 * so similarity = 1 - distance.
 */
export async function retrieve(
  query: string,
  topK = config.rag.topK,
): Promise<RetrievedChunk[]> {
  const embedding = await embedOne(query);
  const literal = toVectorLiteral(embedding);

  const res = await pool.query(
    `SELECT
        c.id,
        c.document_id,
        c.content,
        c.position,
        d.title       AS document_title,
        d.source_url  AS source_url,
        1 - (c.embedding <=> $1::vector) AS score
     FROM chunks c
     JOIN documents d ON d.id = c.document_id
     WHERE c.embedding IS NOT NULL
     ORDER BY c.embedding <=> $1::vector
     LIMIT $2`,
    [literal, topK],
  );

  return res.rows.map((r) => ({
    id: r.id,
    documentId: r.document_id,
    documentTitle: r.document_title,
    sourceUrl: r.source_url,
    content: r.content,
    position: r.position,
    score: Number(r.score),
  }));
}
