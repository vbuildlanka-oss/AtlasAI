// Shared domain types for the Atlas backend.

export interface DocumentRow {
  id: string;
  title: string;
  source_url: string | null;
  source_type: 'text' | 'pdf' | 'url';
  ingested_at: string;
  metadata: Record<string, unknown>;
}

export interface ChunkRow {
  id: string;
  document_id: string;
  content: string;
  position: number;
  token_count: number;
  created_at: string;
}

/** A chunk returned from semantic search, with its relevance score + document context. */
export interface RetrievedChunk {
  id: string;
  documentId: string;
  documentTitle: string;
  sourceUrl: string | null;
  content: string;
  position: number;
  /** Cosine similarity in [0, 1]; higher is more relevant. */
  score: number;
}

export interface SessionRow {
  id: string;
  user_id: string;
  question: string;
  created_at: string;
}

/** One planner-produced sub-query plus the chunks a retriever found for it. */
export interface SubQueryResult {
  subQuery: string;
  chunks: RetrievedChunk[];
}

/** A single inline citation, linking a [marker] in the answer to a source chunk. */
export interface Citation {
  marker: number;
  chunkId: string;
  documentId: string;
  documentTitle: string;
  sourceUrl: string | null;
  snippet: string;
}

/** The full result of a research run. */
export interface ResearchResult {
  sessionId: string;
  answerId: string;
  question: string;
  plan: string[];
  answer: string;
  citations: Citation[];
  createdAt: string;
}

/** Named stages the pipeline reports as it runs. */
export type AgentStage =
  | 'planning'
  | 'retrieving'
  | 'synthesizing'
  | 'saving'
  | 'done'
  | 'error';

export interface AgentEvent {
  stage: AgentStage;
  message: string;
  detail?: unknown;
}
