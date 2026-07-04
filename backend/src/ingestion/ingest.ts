import { pool, toVectorLiteral } from '../db/pool.js';
import { embed } from '../llm/embeddings.js';
import { chunkText } from './chunker.js';
import type { ExtractedSource } from './extractors.js';
import type { DocumentRow } from '../types.js';

export interface IngestResult {
  document: DocumentRow;
  chunkCount: number;
}

/**
 * Persist a source: create the document row, chunk the text, embed every chunk
 * in one batch, and bulk-insert the chunks with their vectors.
 */
export async function ingestSource(
  source: ExtractedSource,
  metadata: Record<string, unknown> = {},
): Promise<IngestResult> {
  const chunks = chunkText(source.text);
  if (chunks.length === 0) {
    throw new Error('Source produced no text to ingest.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const docRes = await client.query<DocumentRow>(
      `INSERT INTO documents (title, source_url, source_type, metadata)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [source.title, source.sourceUrl, source.sourceType, metadata],
    );
    const document = docRes.rows[0];

    const embeddings = await embed(chunks.map((c) => c.content));

    // Build a single multi-row INSERT for the chunks.
    const values: string[] = [];
    const params: unknown[] = [];
    chunks.forEach((chunk, i) => {
      const base = i * 5;
      values.push(`($${base + 1}, $${base + 2}, $${base + 3}::vector, $${base + 4}, $${base + 5})`);
      params.push(
        document.id,
        chunk.content,
        toVectorLiteral(embeddings[i]),
        chunk.position,
        chunk.tokenCount,
      );
    });

    await client.query(
      `INSERT INTO chunks (document_id, content, embedding, position, token_count)
       VALUES ${values.join(', ')}`,
      params,
    );

    await client.query('COMMIT');
    return { document, chunkCount: chunks.length };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
