import { useMemo } from "react";
import type { Photo } from "../types";
import { PCA2D, type Point2D } from "../lib/pca";
import { categoryColor } from "../lib/vocab";

interface Props {
  photos: Photo[];
  queryEmbedding: Float32Array | null;
  selectedId?: number;
  onSelect: (id: number) => void;
}

const W = 520;
const H = 380;
const PAD = 26;

export default function Galaxy({ photos, queryEmbedding, selectedId, onSelect }: Props) {
  const { pts, queryPt, cats } = useMemo(() => {
    const pca = new PCA2D();
    pca.fit(photos.map((p) => p.embedding));
    const raw: (Point2D & { photo: Photo })[] = photos.map((p) => ({
      ...pca.project(p.embedding),
      photo: p,
    }));
    const q = queryEmbedding ? pca.project(queryEmbedding) : null;

    const xs = raw.map((p) => p.x).concat(q ? [q.x] : []);
    const ys = raw.map((p) => p.y).concat(q ? [q.y] : []);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const sx = (x: number) => PAD + ((x - minX) / (maxX - minX || 1)) * (W - 2 * PAD);
    const sy = (y: number) => PAD + ((y - minY) / (maxY - minY || 1)) * (H - 2 * PAD);

    return {
      pts: raw.map((p) => ({ x: sx(p.x), y: sy(p.y), photo: p.photo })),
      queryPt: q ? { x: sx(q.x), y: sy(q.y) } : null,
      cats: [...new Set(photos.map((p) => p.category))],
    };
  }, [photos, queryEmbedding]);

  return (
    <div className="galaxy">
      <svg viewBox={`0 0 ${W} ${H}`}>
        <rect x="0" y="0" width={W} height={H} fill="rgba(255,255,255,0.02)" rx="12" />
        {queryPt &&
          pts.map((p) => (
            <line
              key={`l${p.photo.id}`}
              x1={queryPt.x}
              y1={queryPt.y}
              x2={p.x}
              y2={p.y}
              stroke="rgba(217,70,239,0.10)"
              strokeWidth={0.5}
            />
          ))}
        {pts.map((p) => {
          const sel = selectedId === p.photo.id;
          return (
            <circle
              key={p.photo.id}
              className="dot"
              cx={p.x}
              cy={p.y}
              r={sel ? 8 : p.photo.isUpload ? 6 : 5}
              fill={categoryColor(p.photo.category)}
              stroke={sel ? "#fff" : "rgba(0,0,0,0.4)"}
              strokeWidth={sel ? 2 : 1}
              opacity={0.9}
              onClick={() => onSelect(p.photo.id)}
            >
              <title>
                {p.photo.category} · {p.photo.title}
              </title>
            </circle>
          );
        })}
        {queryPt && (
          <g>
            <circle cx={queryPt.x} cy={queryPt.y} r={9} fill="none" stroke="#fff" strokeWidth={2} />
            <circle cx={queryPt.x} cy={queryPt.y} r={3.5} fill="#fff" />
            <text x={queryPt.x + 12} y={queryPt.y + 4} fill="#fff" fontSize="11" fontWeight="600">
              your query
            </text>
          </g>
        )}
      </svg>
      <div className="legend">
        {cats.map((c) => (
          <span key={c}>
            <span className="sw" style={{ background: categoryColor(c) }} />
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}
