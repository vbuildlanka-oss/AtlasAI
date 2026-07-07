import { motion } from "framer-motion";
import type { Scored } from "../types";

interface Props {
  items: Scored[]; // score is meaningful only when `active`
  active: boolean; // a query/similarity ranking is in effect
  selectedId?: number;
  onSelect: (id: number) => void;
}

export default function PhotoGrid({ items, active, selectedId, onSelect }: Props) {
  const scores = items.map((i) => i.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const span = max - min || 1;
  // Dim clearly-irrelevant results once a query is active.
  const dimBelow = active ? min + span * 0.45 : -Infinity;

  return (
    <div className="masonry">
      {items.map(({ photo, score }, idx) => {
        const rel = (score - min) / span;
        const dim = active && score < dimBelow;
        return (
          <motion.div
            layout
            key={photo.id}
            className={`photo ${dim ? "dim" : ""} ${selectedId === photo.id ? "selected" : ""}`}
            onClick={() => onSelect(photo.id)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25, delay: Math.min(idx * 0.01, 0.2) }}
          >
            <img src={photo.src} alt={photo.title} loading="lazy" />
            {active && (
              <>
                <span className="score">{score.toFixed(2)}</span>
                <div className="barwrap">
                  <div className="bar" style={{ width: `${Math.max(6, rel * 100)}%` }} />
                </div>
              </>
            )}
            {!active && !photo.isUpload && <span className="tagpill">{photo.category}</span>}
            {photo.isUpload && <span className="up">yours</span>}
          </motion.div>
        );
      })}
    </div>
  );
}
