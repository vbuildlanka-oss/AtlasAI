import type { Citation, ResearchResult } from '../types';

interface Props {
  result: ResearchResult | null;
  hovered: Citation | null;
  pinned: Citation | null;
  onPin: (c: Citation | null) => void;
}

/**
 * Right-hand inspector. Shows the source snippet for the citation currently
 * hovered (or pinned), plus the full citation list and the planner's sub-queries
 * for the selected answer — the provenance / audit trail.
 */
export function CitationInspector({ result, hovered, pinned, onPin }: Props) {
  const active = hovered ?? pinned;

  return (
    <aside className="inspector">
      <div className="panel-header">Citation Inspector</div>

      {!result && <div className="inspector-empty">Select an answer block to inspect its sources.</div>}

      {active && (
        <div className="inspector-snippet">
          <div className="snippet-head">
            <span className="snippet-marker">[{active.marker}]</span>
            <span className="snippet-doc">{active.documentTitle}</span>
            {pinned?.chunkId === active.chunkId && (
              <button className="snippet-unpin" onClick={() => onPin(null)}>
                unpin
              </button>
            )}
          </div>
          <blockquote className="snippet-body">{active.snippet}</blockquote>
          {active.sourceUrl && (
            <a className="snippet-link" href={active.sourceUrl} target="_blank" rel="noreferrer">
              Open source ↗
            </a>
          )}
        </div>
      )}

      {result && (
        <>
          <div className="panel-subheader">Research plan</div>
          <ol className="plan-list">
            {result.plan.map((sub, i) => (
              <li key={i}>{sub}</li>
            ))}
          </ol>

          <div className="panel-subheader">Sources cited ({result.citations.length})</div>
          <ul className="cite-list">
            {result.citations.length === 0 && (
              <li className="doc-empty">No sources were cited for this answer.</li>
            )}
            {result.citations.map((c) => (
              <li
                key={c.marker}
                className={`cite-item ${pinned?.marker === c.marker ? 'pinned' : ''}`}
                onClick={() => onPin(pinned?.marker === c.marker ? null : c)}
              >
                <span className="cite-marker">[{c.marker}]</span>
                <span className="cite-title">{c.documentTitle}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}
