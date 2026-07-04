# 🛰 Atlas Intelligence

**Turn scattered market signals into precise, cited insight.**

Atlas is a multi-agent AI research workspace. Analysts ask a question and get a
synthesized, **citation-grounded** answer assembled on a flexible canvas — every
claim traces back to the exact source chunk it came from. The goal is to compress
research cycles from days to minutes without losing provenance.

---

## How it works

```
                    ┌─────────────┐
   question ───────▶│  Planner    │  decomposes into focused sub-queries
                    └──────┬──────┘
                           ▼
                    ┌─────────────┐
                    │ Retrievers  │  semantic top-k over pgvector (one per sub-query)
                    └──────┬──────┘
                           ▼
                    ┌─────────────┐
                    │ Synthesizer │  composes an answer, inline-citing every claim
                    └──────┬──────┘
                           ▼
              cited answer + provenance saved to Postgres
```

- **Multi-agent pipeline** — a planner splits the question, retriever agents pull
  relevant chunks (RAG over pgvector), and a synthesizer composes the answer.
- **Citation-grounded answers** — every claim carries an inline `[n]` marker.
  Hover to reveal the source snippet; the synthesizer must ground or omit — no
  uncited claims.
- **Flexible research canvas** — draggable answer / note / source blocks you can
  arrange freely, then export to a Markdown brief.
- **Source ingestion + RAG** — upload text, PDFs, or URLs; Atlas chunks, embeds,
  and stores them in pgvector for semantic retrieval.
- **Provenance / audit trail** — the plan, retrieved evidence, and every citation
  are persisted so you can see which sources fed which conclusions.

## Tech stack

| Layer         | Choice                                          |
| ------------- | ----------------------------------------------- |
| Frontend      | React + TypeScript + Vite                       |
| Backend       | Node.js + TypeScript (Express)                  |
| LLM           | OpenAI (GPT-4-class) for reasoning + synthesis  |
| Embeddings    | OpenAI `text-embedding-3-small`                 |
| Vector search | `pgvector` on Postgres                          |
| Database      | Postgres (documents, chunks, sessions, answers, citations) |

### Offline mock mode 🔌

If you don't set `OPENAI_API_KEY`, Atlas runs the **entire pipeline offline**:

- a deterministic, network-free hashing embedder (bag-of-words → vector), and
- a template synthesizer that still produces grounded, fully-cited answers.

This lets you run and demo the whole product end-to-end with **only Postgres** —
no API key required. Add a key later to switch to real GPT-4-class reasoning.

---

## Repository layout

```
AtlasAI/
├── db/schema.sql          # Postgres + pgvector schema
├── docker-compose.yml     # Postgres (pgvector) for local dev
├── backend/               # Node.js + TypeScript API
│   ├── src/
│   │   ├── agents/        # planner, retriever, synthesizer, pipeline
│   │   ├── ingestion/     # extractors, chunker, ingest, retrieve
│   │   ├── llm/           # OpenAI client + embeddings (+ offline mock)
│   │   ├── routes/        # documents, sessions, research (REST + SSE)
│   │   └── db/            # pool + migrations
│   └── scripts/verify.ts  # core-logic verification (no DB/API needed)
└── frontend/              # React + TypeScript + Vite
    └── src/
        ├── components/    # Canvas, Block, CitedAnswer, CitationInspector, …
        ├── api/           # typed API client + SSE research stream
        └── utils/         # Markdown export
```

---

## Getting started

### Prerequisites

- Node.js 20+ (tested on 22)
- Docker (for Postgres + pgvector), or any Postgres 16 with the `vector` extension

### 1. Start Postgres (pgvector)

```bash
docker compose up -d          # brings up Postgres with pgvector on :5432
# or, without the compose plugin:
docker run -d --name atlas-postgres \
  -e POSTGRES_USER=atlas -e POSTGRES_PASSWORD=atlas -e POSTGRES_DB=atlas \
  -p 5432:5432 pgvector/pgvector:pg16
```

### 2. Backend

```bash
cd backend
cp .env.example .env          # leave OPENAI_API_KEY empty for offline mock mode
npm install
npm run migrate               # applies db/schema.sql
npm run dev                   # API on http://localhost:4000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev                   # app on http://localhost:5173 (proxies /api → :4000)
```

Open **http://localhost:5173**, ingest a few sources (paste text, add a URL, or
upload a PDF) in the left panel, then ask a question. Watch the agents work,
hover the `[n]` citations to inspect sources, drag blocks around the canvas, and
click **Export** for a Markdown brief.

---

## Configuration (`backend/.env`)

| Variable                 | Default                                       | Notes                                  |
| ------------------------ | --------------------------------------------- | -------------------------------------- |
| `PORT`                   | `4000`                                        | API port                               |
| `CORS_ORIGIN`            | `http://localhost:5173`                       | comma-separated allowed origins        |
| `DATABASE_URL`           | `postgres://atlas:atlas@localhost:5432/atlas` | Postgres connection string             |
| `OPENAI_API_KEY`         | *(empty)*                                     | empty → offline mock mode              |
| `OPENAI_CHAT_MODEL`      | `gpt-4o`                                       | synthesis / planning model             |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small`                      | embedding model                        |
| `EMBEDDING_DIM`          | `1536`                                        | **must** match `vector(N)` in schema   |
| `CHUNK_SIZE` / `CHUNK_OVERLAP` | `900` / `150`                           | chunking (characters)                  |
| `RETRIEVE_TOP_K`         | `6`                                           | chunks retrieved per sub-query         |

> Changing `EMBEDDING_DIM` requires updating the `vector(1536)` columns in
> `db/schema.sql` and re-running the migration.

---

## API

| Method | Path                             | Description                                   |
| ------ | -------------------------------- | --------------------------------------------- |
| GET    | `/api/health`                    | status + current mode (offline-mock / openai) |
| GET    | `/api/documents`                 | list ingested documents (+ chunk counts)      |
| POST   | `/api/documents/text`            | ingest raw text `{ text, title? }`            |
| POST   | `/api/documents/url`             | ingest a URL `{ url }`                         |
| POST   | `/api/documents/upload`          | ingest a PDF (multipart `file`)               |
| DELETE | `/api/documents/:id`             | delete a document + its chunks                |
| POST   | `/api/research`                  | run research `{ question }` → cited result    |
| GET    | `/api/research/stream?question=` | same, streamed via Server-Sent Events         |
| GET    | `/api/sessions`                  | list past research sessions                   |
| GET    | `/api/sessions/:id`              | full session: answer, plan, citations         |

---

## Verifying the core logic

The citation-grounding and retrieval logic can be checked without a database or
API key:

```bash
cd backend && npx tsx scripts/verify.ts
```

This exercises chunking, semantic ranking, planning, synthesis, and the
"no-uncited-claims" guardrail, asserting that every inline `[n]` marker resolves
to a real source chunk.

## Data model

`documents` → `chunks` (with `vector(1536)` embeddings) power RAG.
A `sessions` row records each question; its `answers` row stores the synthesized
content and planner sub-queries; `citations` link answer spans back to the exact
`chunk` they were drawn from — the provenance trail.
