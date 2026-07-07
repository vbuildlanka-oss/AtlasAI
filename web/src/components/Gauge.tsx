import { useEffect } from "react";
import { animate, useMotionValue, useTransform, motion } from "framer-motion";

interface Props {
  value: number; // 0..1
  color: string;
  size?: number;
}

export default function Gauge({ value, color, size = 168 }: Props) {
  const r = size / 2 - 14;
  const circumference = 2 * Math.PI * r;
  const sweep = 0.75; // 270-degree gauge
  const arcLen = circumference * sweep;

  const mv = useMotionValue(0);
  const offset = useTransform(mv, (v) => arcLen * (1 - v) + (circumference - arcLen));
  const pct = useTransform(mv, (v) => `${Math.round(v * 100)}`);

  useEffect(() => {
    const controls = animate(mv, value, { duration: 0.7, ease: "easeOut" });
    return controls.stop;
  }, [value, mv]);

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(135deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={13}
          strokeDasharray={`${arcLen} ${circumference}`}
          strokeLinecap="round"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={13}
          strokeDasharray={`${arcLen} ${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 8px ${color})` }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          textAlign: "center",
        }}
      >
        <div>
          <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: "-0.03em" }}>
            <motion.span>{pct}</motion.span>
            <span style={{ fontSize: 20, color: "var(--muted)" }}>%</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--faint)", letterSpacing: "0.08em" }}>
            CHURN PROBABILITY
          </div>
        </div>
      </div>
    </div>
  );
}
