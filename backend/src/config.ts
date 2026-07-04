import dotenv from 'dotenv';

dotenv.config();

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  return /^(1|true|yes)$/i.test(raw.trim());
}

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProduction = nodeEnv === 'production';
const databaseUrl = process.env.DATABASE_URL ?? 'postgres://atlas:atlas@localhost:5432/atlas';

/** Hosted databases (Neon, Render, Supabase, …) require TLS; localhost does not. */
const isLocalDb = /(^|@|\/\/)(localhost|127\.0\.0\.1)(:|\/)/.test(databaseUrl);

export const config = {
  nodeEnv,
  isProduction,
  port: num('PORT', 4000),
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  databaseUrl,
  /** Enable SSL automatically for non-local databases (override with DATABASE_SSL). */
  databaseSsl: bool('DATABASE_SSL', !isLocalDb),
  /** Run migrations on startup — on by default in production so a fresh deploy self-initializes. */
  autoMigrate: bool('AUTO_MIGRATE', isProduction),
  /** Serve the built frontend from the API (single-service deploys). Auto-on in production. */
  serveFrontend: bool('SERVE_FRONTEND', isProduction),

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
