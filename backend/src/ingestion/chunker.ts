import { config } from '../config.js';

export interface Chunk {
  content: string;
  position: number;
  tokenCount: number;
}

/** Rough token estimate (~4 chars/token) — good enough for storage + display. */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.round(text.length / 4));
}

/**
 * Split text into overlapping, sentence-aware chunks.
 *
 * We greedily pack sentences up to CHUNK_SIZE characters, then start the next
 * chunk with a CHUNK_OVERLAP-character tail of the previous one so context that
 * straddles a boundary isn't lost during retrieval.
 */
export function chunkText(
  raw: string,
  size = config.rag.chunkSize,
  overlap = config.rag.chunkOverlap,
): Chunk[] {
  const text = raw.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!text) return [];

  // Split into sentence-ish units while keeping paragraph breaks.
  const sentences = text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])|\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks: Chunk[] = [];
  let buffer = '';
  let position = 0;

  const flush = () => {
    const content = buffer.trim();
    if (content) {
      chunks.push({ content, position: position++, tokenCount: estimateTokens(content) });
    }
  };

  for (const sentence of sentences) {
    // A single oversized sentence is hard-split by characters.
    if (sentence.length > size) {
      if (buffer) flush();
      for (let i = 0; i < sentence.length; i += size - overlap) {
        const slice = sentence.slice(i, i + size);
        chunks.push({
          content: slice.trim(),
          position: position++,
          tokenCount: estimateTokens(slice),
        });
      }
      buffer = '';
      continue;
    }

    if ((buffer + ' ' + sentence).trim().length > size) {
      flush();
      // Seed the next chunk with the overlapping tail of the previous one.
      buffer = overlap > 0 ? buffer.slice(-overlap) + ' ' + sentence : sentence;
    } else {
      buffer = buffer ? buffer + ' ' + sentence : sentence;
    }
  }
  flush();

  return chunks;
}
