import type {
  AgentEvent,
  DocumentSummary,
  HealthInfo,
  ResearchResult,
} from '../types';

const BASE = '/api';

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => fetch(`${BASE}/health`).then((r) => json<HealthInfo>(r)),

  listDocuments: () =>
    fetch(`${BASE}/documents`).then((r) => json<{ documents: DocumentSummary[] }>(r)),

  ingestText: (text: string, title?: string) =>
    fetch(`${BASE}/documents/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, title }),
    }).then((r) => json<{ document: DocumentSummary; chunkCount: number }>(r)),

  ingestUrl: (url: string) =>
    fetch(`${BASE}/documents/url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    }).then((r) => json<{ document: DocumentSummary; chunkCount: number }>(r)),

  uploadPdf: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return fetch(`${BASE}/documents/upload`, { method: 'POST', body: form }).then((r) =>
      json<{ document: DocumentSummary; chunkCount: number }>(r),
    );
  },

  deleteDocument: (id: string) =>
    fetch(`${BASE}/documents/${id}`, { method: 'DELETE' }).then((r) => json<{ deleted: string }>(r)),
};

/**
 * Run research with live agent-status streaming over SSE.
 * Returns an abort function; resolves the final result via callbacks.
 */
export function streamResearch(
  question: string,
  handlers: {
    onStatus: (event: AgentEvent) => void;
    onResult: (result: ResearchResult) => void;
    onError: (message: string) => void;
  },
): () => void {
  const url = `${BASE}/research/stream?question=${encodeURIComponent(question)}`;
  const source = new EventSource(url);

  source.addEventListener('status', (e) => {
    try {
      handlers.onStatus(JSON.parse((e as MessageEvent).data) as AgentEvent);
    } catch {
      /* ignore malformed */
    }
  });

  source.addEventListener('result', (e) => {
    try {
      handlers.onResult(JSON.parse((e as MessageEvent).data) as ResearchResult);
    } catch (err) {
      handlers.onError('Failed to parse research result.');
    }
    source.close();
  });

  source.addEventListener('error', (e) => {
    const data = (e as MessageEvent).data;
    if (data) {
      try {
        handlers.onError((JSON.parse(data) as { message: string }).message);
      } catch {
        handlers.onError('Research stream error.');
      }
    } else {
      // Network-level error / closed connection.
      handlers.onError('Connection to research stream lost.');
    }
    source.close();
  });

  return () => source.close();
}
