-- Atlas Intelligence — Postgres schema
-- Requires the pgvector extension (provided by the pgvector/pgvector image).
--
-- Embedding dimension is 1536 to match OpenAI's text-embedding-3-small and the
-- offline mock embedder. If you change EMBEDDING_DIM in the backend, update the
-- vector(1536) columns below and re-run migrations.

CREATE EXTENSION IF NOT EXISTS vector;
-- Note: UUID defaults use the built-in gen_random_uuid() (Postgres 13+ core),
-- so no uuid-ossp extension is required — one less thing to fail on a host.

-- Source documents ingested into the workspace ----------------------------
CREATE TABLE IF NOT EXISTS documents (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title        TEXT NOT NULL,
    source_url   TEXT,
    source_type  TEXT NOT NULL DEFAULT 'text', -- text | pdf | url
    ingested_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata     JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Chunked + embedded slices of each document ------------------------------
CREATE TABLE IF NOT EXISTS chunks (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id  UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    content      TEXT NOT NULL,
    embedding    vector(1536),
    position     INTEGER NOT NULL,
    token_count  INTEGER NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Semantic-search index for the embeddings.
--
-- IMPORTANT: do NOT use an IVFFlat index here. IVFFlat is an *approximate*
-- index whose clusters are trained at CREATE time. Because migrations run
-- before any rows exist, an IVFFlat index gets built on an empty table and
-- then silently returns ZERO rows at query time (its single probed cluster is
-- untrained/empty) — even though the data is present. HNSW has no such training
-- step and returns correct results on a fresh table, so we use it instead.
-- The DROP removes any legacy IVFFlat index from databases created earlier.
DROP INDEX IF EXISTS chunks_embedding_idx;
CREATE INDEX IF NOT EXISTS chunks_embedding_hnsw_idx
    ON chunks USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS chunks_document_id_idx ON chunks(document_id);

-- Research sessions (one per question asked) ------------------------------
CREATE TABLE IF NOT EXISTS sessions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     TEXT NOT NULL DEFAULT 'anonymous',
    question    TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Synthesized answers produced for a session ------------------------------
CREATE TABLE IF NOT EXISTS answers (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    content     TEXT NOT NULL,
    plan        JSONB NOT NULL DEFAULT '[]'::jsonb, -- sub-queries the planner produced
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Citations linking answer spans back to the exact source chunk -----------
CREATE TABLE IF NOT EXISTS citations (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    answer_id    UUID NOT NULL REFERENCES answers(id) ON DELETE CASCADE,
    chunk_id     UUID NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
    marker       INTEGER NOT NULL,           -- the [n] number shown inline
    span_start   INTEGER NOT NULL DEFAULT 0, -- char offset in answer.content
    span_end     INTEGER NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS citations_answer_id_idx ON citations(answer_id);
