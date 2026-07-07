import type { Photo, Scored } from "../types";

// Embeddings are L2-normalised, so cosine similarity == dot product.
export function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) dot += a[i] * b[i];
  return dot;
}

export function rank(query: Float32Array, photos: Photo[]): Scored[] {
  return photos
    .map((photo) => ({ photo, score: cosine(query, photo.embedding) }))
    .sort((a, b) => b.score - a.score);
}

export function findSimilar(target: Photo, photos: Photo[]): Scored[] {
  return rank(target.embedding, photos).filter((s) => s.photo.id !== target.id);
}
