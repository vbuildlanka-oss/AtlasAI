import { motion } from "framer-motion";
import type { Contribution } from "../types";

interface Props {
  contributions: Contribution[];
  max?: number;
}

function fmtValue(v: string | number): string {
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(1);
  return v;
}

export default function Waterfall({ contributions }: Props) {
  const top = contributions.slice(0, 8);
  const maxAbs = Math.max(0.15, ...top.map((c) => Math.abs(c.contribution)));

  return (
    <div>
      {top.map((c, i) => {
        const frac = Math.min(1, Math.abs(c.contribution) / maxAbs);
        const up = c.contribution > 0; // increases churn risk
        const width = `${frac * 50}%`;
        return (
          <div className="wf-row" key={c.feature}>
            <div className="wf-label" title={`${c.label}: ${fmtValue(c.value)}`}>
              {c.label}
            </div>
            <div className="wf-track">
              <div className="wf-mid" />
              <motion.div
                className="wf-bar"
                initial={{ width: 0 }}
                animate={{ width }}
                transition={{ duration: 0.5, delay: i * 0.04 }}
                style={{
                  left: up ? "50%" : undefined,
                  right: up ? undefined : "50%",
                  background: up ? "var(--danger)" : "var(--good)",
                }}
              />
            </div>
            <div className="wf-val" style={{ color: up ? "var(--danger)" : "var(--good)" }}>
              {up ? "+" : "\u2212"}
              {Math.abs(c.contribution).toFixed(2)}
            </div>
          </div>
        );
      })}
      <div className="legend">
        <span className="up">Pushes toward churn</span>
        <span className="down">Pushes toward retention</span>
      </div>
    </div>
  );
}
