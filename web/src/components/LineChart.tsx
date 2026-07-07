interface Pt {
  x: number;
  y: number;
}

interface Props {
  points: Pt[];
  xLabel: string;
  yLabel: string;
  diagonal?: boolean;
  fill?: boolean;
  markers?: boolean;
}

const W = 260;
const H = 200;
const P = 30; // padding

export default function LineChart({
  points,
  xLabel,
  yLabel,
  diagonal = false,
  fill = false,
  markers = false,
}: Props) {
  const sx = (x: number) => P + x * (W - P - 8);
  const sy = (y: number) => H - P - y * (H - P - 8);

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`)
    .join(" ");

  const areaPath =
    fill && points.length
      ? `${path} L${sx(points[points.length - 1].x).toFixed(1)},${sy(0).toFixed(1)} L${sx(
          points[0].x,
        ).toFixed(1)},${sy(0).toFixed(1)} Z`
      : "";

  const gridvals = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${yLabel} vs ${xLabel}`}>
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(124,92,255,0.35)" />
            <stop offset="100%" stopColor="rgba(124,92,255,0)" />
          </linearGradient>
        </defs>

        {gridvals.map((g) => (
          <g key={g}>
            <line className="tick" x1={sx(g)} y1={sy(0)} x2={sx(g)} y2={sy(1)} opacity={0.35} />
            <line className="tick" x1={sx(0)} y1={sy(g)} x2={sx(1)} y2={sy(g)} opacity={0.35} />
          </g>
        ))}

        {diagonal && (
          <line
            x1={sx(0)}
            y1={sy(0)}
            x2={sx(1)}
            y2={sy(1)}
            stroke="var(--faint)"
            strokeDasharray="4 4"
            strokeWidth={1}
          />
        )}

        {areaPath && <path d={areaPath} fill="url(#areaGrad)" />}

        <path d={path} fill="none" stroke="url(#lineGrad)" strokeWidth={2.4} />
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#7c5cff" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
        </defs>

        {markers &&
          points.map((p, i) => (
            <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={2.6} fill="#22d3ee" />
          ))}

        <text className="axis-label" x={W / 2} y={H - 6} textAnchor="middle">
          {xLabel}
        </text>
        <text
          className="axis-label"
          x={-H / 2}
          y={11}
          textAnchor="middle"
          transform="rotate(-90)"
        >
          {yLabel}
        </text>
      </svg>
    </div>
  );
}
