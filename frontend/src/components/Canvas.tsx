import type { Citation, CanvasBlock } from '../types';
import { Block } from './Block';
import { CitedAnswer } from './CitedAnswer';

interface Props {
  blocks: CanvasBlock[];
  selectedId: string | null;
  onMove: (id: string, x: number, y: number) => void;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onUpdateNote: (id: string, text: string) => void;
  onHoverCitation: (c: Citation | null) => void;
  onClickCitation: (c: Citation) => void;
}

/** The freeform research canvas — answers, notes, and sources arranged spatially. */
export function Canvas({
  blocks,
  selectedId,
  onMove,
  onSelect,
  onRemove,
  onUpdateNote,
  onHoverCitation,
  onClickCitation,
}: Props) {
  return (
    <div className="canvas">
      {blocks.length === 0 && (
        <div className="canvas-empty">
          <h2>Your research canvas is empty</h2>
          <p>Ask a question below to generate a cited answer block, or drop in a note.</p>
        </div>
      )}

      {blocks.map((block) => (
        <Block
          key={block.id}
          block={block}
          selected={block.id === selectedId}
          onMove={onMove}
          onSelect={onSelect}
          onRemove={onRemove}
        >
          {block.kind === 'answer' && block.result && (
            <>
              <CitedAnswer
                answer={block.result.answer}
                citations={block.result.citations}
                onHoverCitation={onHoverCitation}
                onClickCitation={onClickCitation}
              />
              <div className="block-meta">
                {block.result.citations.length} citations · {block.result.plan.length} sub-queries
              </div>
            </>
          )}

          {block.kind === 'note' && (
            <textarea
              className="note-area"
              value={block.text ?? ''}
              placeholder="Write a note…"
              onChange={(e) => onUpdateNote(block.id, e.target.value)}
            />
          )}

          {block.kind === 'source' && block.document && (
            <div className="source-block-body">
              <span className={`doc-badge doc-${block.document.source_type}`}>
                {block.document.source_type}
              </span>
              <div className="source-block-title">{block.document.title}</div>
              <div className="source-block-meta">{block.document.chunk_count} chunks indexed</div>
              {block.document.source_url && (
                <a href={block.document.source_url} target="_blank" rel="noreferrer">
                  {block.document.source_url}
                </a>
              )}
            </div>
          )}
        </Block>
      ))}
    </div>
  );
}
