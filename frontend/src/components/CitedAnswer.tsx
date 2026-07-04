import type { Citation } from '../types';

interface Props {
  answer: string;
  citations: Citation[];
  onHoverCitation: (c: Citation | null) => void;
  onClickCitation: (c: Citation) => void;
}

/**
 * Renders answer text, converting every inline [n] marker into an interactive
 * citation pill. Hovering surfaces the source snippet in the inspector; clicking
 * pins it. This is the core "trust" affordance — every claim is one hover away
 * from its source.
 */
export function CitedAnswer({ answer, citations, onHoverCitation, onClickCitation }: Props) {
  const byMarker = new Map(citations.map((c) => [c.marker, c]));
  const parts = answer.split(/(\[\d+\])/g);

  return (
    <p className="cited-answer">
      {parts.map((part, i) => {
        const match = part.match(/^\[(\d+)\]$/);
        if (match) {
          const marker = Number(match[1]);
          const citation = byMarker.get(marker);
          if (citation) {
            return (
              <sup
                key={i}
                className="citation-pill"
                title={`${citation.documentTitle} — click to inspect`}
                onMouseEnter={() => onHoverCitation(citation)}
                onMouseLeave={() => onHoverCitation(null)}
                onClick={() => onClickCitation(citation)}
              >
                {marker}
              </sup>
            );
          }
          // A marker with no matching citation (shouldn't happen) — render plain.
          return <span key={i}>{part}</span>;
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
}
