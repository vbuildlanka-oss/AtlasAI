import { useRef, useState } from 'react';
import { api } from '../api/client';
import type { DocumentSummary } from '../types';

interface Props {
  documents: DocumentSummary[];
  onChanged: () => void;
  onAddSourceBlock: (doc: DocumentSummary) => void;
}

type Tab = 'text' | 'url' | 'pdf';

/** Source ingestion + library. Feeds the RAG store the agents retrieve from. */
export function SourcePanel({ documents, onChanged, onAddSourceBlock }: Props) {
  const [tab, setTab] = useState<Tab>('text');
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ingestion failed.');
    } finally {
      setBusy(false);
    }
  };

  const submitText = () =>
    run(async () => {
      await api.ingestText(text, title || undefined);
      setText('');
      setTitle('');
    });

  const submitUrl = () =>
    run(async () => {
      await api.ingestUrl(url);
      setUrl('');
    });

  const submitPdf = () =>
    run(async () => {
      const file = fileRef.current?.files?.[0];
      if (!file) throw new Error('Choose a PDF file first.');
      await api.uploadPdf(file);
      if (fileRef.current) fileRef.current.value = '';
    });

  return (
    <div className="source-panel">
      <div className="panel-header">Sources</div>

      <div className="source-tabs">
        {(['text', 'url', 'pdf'] as Tab[]).map((t) => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {t === 'text' ? 'Text' : t === 'url' ? 'URL' : 'PDF'}
          </button>
        ))}
      </div>

      <div className="source-form">
        {tab === 'text' && (
          <>
            <input
              placeholder="Title (optional)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              placeholder="Paste text, notes, or a report excerpt…"
              value={text}
              rows={4}
              onChange={(e) => setText(e.target.value)}
            />
            <button disabled={busy || !text.trim()} onClick={submitText}>
              {busy ? 'Ingesting…' : 'Ingest text'}
            </button>
          </>
        )}

        {tab === 'url' && (
          <>
            <input
              placeholder="https://example.com/article"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <button disabled={busy || !url.trim()} onClick={submitUrl}>
              {busy ? 'Fetching…' : 'Ingest URL'}
            </button>
          </>
        )}

        {tab === 'pdf' && (
          <>
            <input ref={fileRef} type="file" accept="application/pdf" />
            <button disabled={busy} onClick={submitPdf}>
              {busy ? 'Parsing…' : 'Ingest PDF'}
            </button>
          </>
        )}

        {error && <div className="source-error">{error}</div>}
      </div>

      <div className="panel-subheader">Library ({documents.length})</div>
      <ul className="doc-list">
        {documents.length === 0 && <li className="doc-empty">No sources yet. Ingest something to begin.</li>}
        {documents.map((doc) => (
          <li key={doc.id} className="doc-item">
            <div className="doc-main" onClick={() => onAddSourceBlock(doc)} title="Add to canvas">
              <span className={`doc-badge doc-${doc.source_type}`}>{doc.source_type}</span>
              <span className="doc-title">{doc.title}</span>
              <span className="doc-chunks">{doc.chunk_count} chunks</span>
            </div>
            <button
              className="doc-delete"
              title="Delete source"
              onClick={() => run(() => api.deleteDocument(doc.id))}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
