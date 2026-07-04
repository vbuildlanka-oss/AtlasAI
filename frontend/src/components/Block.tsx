import { useRef, type ReactNode, type PointerEvent } from 'react';
import type { CanvasBlock } from '../types';

interface Props {
  block: CanvasBlock;
  selected: boolean;
  onMove: (id: string, x: number, y: number) => void;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  children: ReactNode;
}

/**
 * A draggable canvas block. Dragging the header repositions it; the body holds
 * block-specific content (answer, note, source). Uses pointer events + capture
 * so the drag keeps tracking even if the cursor outruns the element.
 */
export function Block({ block, selected, onMove, onSelect, onRemove, children }: Props) {
  const offset = useRef({ dx: 0, dy: 0 });
  const dragging = useRef(false);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    // Ignore drags that start on interactive controls.
    if ((e.target as HTMLElement).closest('button, a, textarea, input, sup')) return;
    dragging.current = true;
    offset.current = { dx: e.clientX - block.x, dy: e.clientY - block.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    onSelect(block.id);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    onMove(block.id, Math.max(0, e.clientX - offset.current.dx), Math.max(0, e.clientY - offset.current.dy));
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    dragging.current = false;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  };

  return (
    <div
      className={`block block-${block.kind} ${selected ? 'selected' : ''}`}
      style={{ left: block.x, top: block.y, width: block.width }}
      onMouseDown={() => onSelect(block.id)}
    >
      <div
        className="block-header"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <span className={`block-kind kind-${block.kind}`}>{block.kind}</span>
        <span className="block-title">{block.title}</span>
        <button className="block-remove" title="Remove block" onClick={() => onRemove(block.id)}>
          ✕
        </button>
      </div>
      <div className="block-body">{children}</div>
    </div>
  );
}
