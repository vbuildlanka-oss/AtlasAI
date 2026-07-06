import { config } from '../config.js';
import { getEmbeddingClient } from './client.js';

/**
 * Deterministic, network-free embedding used in OFFLINE MOCK mode.
 *
 * It hashes each lowercased token into the embedding space (a "hashing
 * vectorizer") and L2-normalizes the result. Because it is bag-of-words based,
 * two texts that share vocabulary end up with a high cosine similarity — enough
 * to make semantic retrieval behave sensibly in a demo without any API key.
 */
export function mockEmbed(text: string): number[] {
  const dim = config.embeddingDim;
  const vec = new Array<number>(dim).fill(0);
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);

  for (const token of tokens) {
    // Two independent hashes reduce collisions and give a signed contribution.
    const h1 = hash(token) % dim;
    const h2 = hash('salt:' + token) % dim;
    const sign = (hash('sign:' + token) & 1) === 0 ? 1 : -1;
    vec[h1] += sign;
    vec[h2] += sign * 0.5;
  }

  // L2 normalize so cosine similarity == dot product.
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < dim; i++) vec[i] /= norm;
  return vec;
}

function hash(str: string): number {
  // FNV-1a 32-bit, kept positive.
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Embed a batch of texts. Uses the configured embedding provider, else the mock. */
export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  if (!config.llm.embeddings.enabled) {
    return texts.map(mockEmbed);
  }

  const client = getEmbeddingClient();
  const res = await client.embeddings.create({
    model: config.llm.embeddings.model,
    input: texts,
  });
  // OpenAI preserves input order in res.data.
  return res.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding as number[]);
}

export async function embedOne(text: string): Promise<number[]> {
  const [v] = await embed([text]);
  return v;
}
