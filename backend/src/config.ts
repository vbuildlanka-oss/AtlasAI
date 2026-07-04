import dotenv from 'dotenv';

dotenv.config();

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  port: num('PORT', 4000),
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  databaseUrl: process.env.DATABASE_URL ?? 'postgres://atlas:atlas@localhost:5432/atlas',

  openai: {
    apiKey: process.env.OPENAI_API_KEY?.trim() ?? '',
    chatModel: process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o',
    embeddingModel: process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small',
  },

  embeddingDim: num('EMBEDDING_DIM', 1536),

  rag: {
    chunkSize: num('CHUNK_SIZE', 900),
    chunkOverlap: num('CHUNK_OVERLAP', 150),
    topK: num('RETRIEVE_TOP_K', 6),
  },
};

/** True when no OpenAI key is configured — the whole app runs offline/deterministic. */
export const isOffline = config.openai.apiKey === '';
