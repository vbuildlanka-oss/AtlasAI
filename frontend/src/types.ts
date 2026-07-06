// Types mirrored from the Atlas backend API.

export interface Citation {
  marker: number;
  chunkId: string;
  documentId: string;
  documentTitle: string;
  sourceUrl: string | null;
  snippet: string;
  spanStart?: number;
  spanEnd?: number;
}

export interface ResearchResult {
  sessionId: string;
  answerId: string;
  question: string;
  plan: string[];
  answer: string;
  citations: Citation[];
  createdAt: string;
}

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

export interface DocumentSummary {
  id: string;
  title: string;
  source_url: string | null;
  source_type: 'text' | 'pdf' | 'url';
  ingested_at: string;
  chunk_count: number;
}

export interface HealthInfo {
  status: string;
  db: string;
  chat: { provider: 'openai' | 'groq' | 'mock'; model: string | null };
  embeddings: { provider: 'openai' | 'groq' | 'mock'; model: string };
}

// --- Canvas ---------------------------------------------------------------

export type BlockKind = 'answer' | 'note' | 'source';

export interface CanvasBlock {
  id: string;
  kind: BlockKind;
  x: number;
  y: number;
  width: number;
  title: string;
  /** For answer blocks. */
  result?: ResearchResult;
  /** For note blocks. */
  text?: string;
  /** For source blocks. */
  document?: DocumentSummary;
}
