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

  llm: {
    chat: resolveChatProvider(),
    embeddings: resolveEmbeddingProvider(),
  },

  embeddingDim: num('EMBEDDING_DIM', 1536),

  rag: {
    chunkSize: num('CHUNK_SIZE', 900),
    chunkOverlap: num('CHUNK_OVERLAP', 150),
    topK: num('RETRIEVE_TOP_K', 6),
  },
};

// --- LLM provider resolution ---------------------------------------------
//
// Chat (planning + synthesis) and embeddings (RAG search) are resolved
// independently, so you can mix providers — e.g. free Groq for the written
// answer while keeping the free local embedder for search.
//
//   Chat priority:       GROQ_API_KEY  ->  OPENAI_API_KEY  ->  mock template
//   Embeddings priority: OPENAI_API_KEY (Groq has no embeddings API) -> mock
//
// Any OpenAI-compatible endpoint works via *_BASE_URL (that's how Groq plugs in).

export type LlmProvider = 'openai' | 'groq' | 'mock';

export interface ProviderConfig {
  /** false => use the deterministic offline mock for this capability. */
  enabled: boolean;
  provider: LlmProvider;
  apiKey: string;
  /** OpenAI-compatible base URL; undefined uses the OpenAI default. */
  baseUrl: string | undefined;
  model: string;
}

function resolveChatProvider(): ProviderConfig {
  const groqKey = process.env.GROQ_API_KEY?.trim() ?? '';
  const openaiKey = process.env.OPENAI_API_KEY?.trim() ?? '';

  if (groqKey) {
    return {
      enabled: true,
      provider: 'groq',
      apiKey: groqKey,
      baseUrl: process.env.GROQ_BASE_URL?.trim() || 'https://api.groq.com/openai/v1',
      model: process.env.GROQ_MODEL?.trim() || 'llama-3.3-70b-versatile',
    };
  }
  if (openaiKey) {
    return {
      enabled: true,
      provider: 'openai',
      apiKey: openaiKey,
      baseUrl: process.env.OPENAI_BASE_URL?.trim() || undefined,
      model: process.env.OPENAI_CHAT_MODEL?.trim() || 'gpt-4o',
    };
  }
  return { enabled: false, provider: 'mock', apiKey: '', baseUrl: undefined, model: 'mock-template' };
}

function resolveEmbeddingProvider(): ProviderConfig {
  const openaiKey = process.env.OPENAI_API_KEY?.trim() ?? '';
  if (openaiKey) {
    return {
      enabled: true,
      provider: 'openai',
      apiKey: openaiKey,
      baseUrl: process.env.OPENAI_BASE_URL?.trim() || undefined,
      model: process.env.OPENAI_EMBEDDING_MODEL?.trim() || 'text-embedding-3-small',
    };
  }
  // Groq has no embeddings endpoint, so a Groq-only setup uses the local mock
  // embedder for search — which is free and needs no vector-dimension changes.
  return { enabled: false, provider: 'mock', apiKey: '', baseUrl: undefined, model: 'mock-hashing' };
}

/** True only when BOTH chat and embeddings run on the offline mock. */
export const isFullyOffline = !config.llm.chat.enabled && !config.llm.embeddings.enabled;
