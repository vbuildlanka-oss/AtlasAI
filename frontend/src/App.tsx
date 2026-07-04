import { useCallback, useEffect, useState } from 'react';
import { api, streamResearch } from './api/client';
import { AskBar } from './components/AskBar';
import { AgentStatus } from './components/AgentStatus';
import { Canvas } from './components/Canvas';
import { CitationInspector } from './components/CitationInspector';
import { SourcePanel } from './components/SourcePanel';
import { canvasToMarkdown, downloadMarkdown } from './utils/exportCanvas';
import type {
  AgentEvent,
  Citation,
  CanvasBlock,
  DocumentSummary,
  HealthInfo,
  ResearchResult,
} from './types';

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export default function App() {
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);

  const [blocks, setBlocks] = useState<CanvasBlock[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState<AgentEvent[]>([]);

  const [hovered, setHovered] = useState<Citation | null>(null);
  const [pinned, setPinned] = useState<Citation | null>(null);

  const refreshDocuments = useCallback(() => {
    api
      .listDocuments()
      .then((r) => setDocuments(r.documents))
      .catch(() => setDocuments([]));
  }, []);

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth(null));
    refreshDocuments();
  }, [refreshDocuments]);

  const selectedBlock = blocks.find((b) => b.id === selectedId) ?? null;
  const inspectorResult =
    selectedBlock?.kind === 'answer' ? selectedBlock.result ?? null : null;

  // --- Research ------------------------------------------------------------
  const ask = useCallback(
    (question: string) => {
      setRunning(true);
      setEvents([{ stage: 'planning', message: 'Dispatching planner agent…' }]);

      streamResearch(question, {
        onStatus: (evt) => setEvents((prev) => [...prev, evt]),
        onError: (message) => {
          setEvents((prev) => [...prev, { stage: 'error', message }]);
          setRunning(false);
        },
        onResult: (result: ResearchResult) => {
          setRunning(false);
          const block: CanvasBlock = {
            id: uid(),
            kind: 'answer',
            title: result.question,
            x: 40 + ((blocks.length * 36) % 240),
            y: 40 + ((blocks.length * 36) % 240),
            width: 460,
            result,
          };
          setBlocks((prev) => [...prev, block]);
          setSelectedId(block.id);
          setPinned(null);
        },
      });
    },
    [blocks.length],
  );

  // --- Canvas ops ----------------------------------------------------------
  const moveBlock = useCallback((id: string, x: number, y: number) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, x, y } : b)));
  }, []);

  const removeBlock = useCallback(
    (id: string) => {
      setBlocks((prev) => prev.filter((b) => b.id !== id));
      if (selectedId === id) setSelectedId(null);
    },
    [selectedId],
  );

  const updateNote = useCallback((id: string, text: string) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, text } : b)));
  }, []);

  const addNote = () => {
    const block: CanvasBlock = {
      id: uid(),
      kind: 'note',
      title: 'Note',
      x: 80,
      y: 80,
      width: 320,
      text: '',
    };
    setBlocks((prev) => [...prev, block]);
    setSelectedId(block.id);
  };

  const addSourceBlock = (doc: DocumentSummary) => {
    const block: CanvasBlock = {
      id: uid(),
      kind: 'source',
      title: doc.title,
      x: 120,
      y: 120,
      width: 320,
      document: doc,
    };
    setBlocks((prev) => [...prev, block]);
    setSelectedId(block.id);
  };

  const exportBrief = () => {
    if (blocks.length === 0) return;
    downloadMarkdown(canvasToMarkdown(blocks));
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">🛰</span>
          <div>
            <div className="brand-name">Atlas Intelligence</div>
            <div className="brand-tag">Scattered signals → precise, cited insight</div>
          </div>
        </div>
        <div className="topbar-actions">
          {health && (
            <span className={`mode-badge ${health.mode}`}>
              {health.mode === 'offline-mock' ? 'Offline mock' : `OpenAI · ${health.chatModel}`}
              <span className={`db-dot ${health.db === 'connected' ? 'ok' : 'down'}`} title={`DB: ${health.db}`} />
            </span>
          )}
          <button onClick={addNote}>+ Note</button>
          <button onClick={exportBrief} disabled={blocks.length === 0}>
            Export
          </button>
        </div>
      </header>

      <div className="workspace">
        <SourcePanel
          documents={documents}
          onChanged={refreshDocuments}
          onAddSourceBlock={addSourceBlock}
        />

        <main className="canvas-area">
          <div className="canvas-scroll">
            <Canvas
              blocks={blocks}
              selectedId={selectedId}
              onMove={moveBlock}
              onSelect={setSelectedId}
              onRemove={removeBlock}
              onUpdateNote={updateNote}
              onHoverCitation={setHovered}
              onClickCitation={(c) => {
                setPinned(c);
              }}
            />
          </div>

          <div className="dock">
            <AgentStatus events={events} running={running} />
            <AskBar onAsk={ask} disabled={running} />
          </div>
        </main>

        <CitationInspector
          result={inspectorResult}
          hovered={hovered}
          pinned={pinned}
          onPin={setPinned}
        />
      </div>
    </div>
  );
}
