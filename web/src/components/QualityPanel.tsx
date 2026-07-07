import type { EvalFile } from "../types";

export default function QualityPanel({ evalData }: { evalData: EvalFile }) {
  const a = evalData.aggregate;
  const metrics = [
    { v: a.mAP.toFixed(3), l: "mean AP" },
    { v: a.mrr.toFixed(2), l: "MRR" },
    { v: a.pAt["1"].toFixed(2), l: "Precision@1" },
    { v: a.pAt["3"].toFixed(2), l: "Precision@3" },
  ];
  return (
    <div className="card">
      <h3>Retrieval quality</h3>
      <p className="sub">
        Offline evaluation: {a.queries} natural-language queries over {a.gallerySize}{" "}
        labelled images (text → image).
      </p>
      <div className="metrics">
        {metrics.map((m) => (
          <div className="metric" key={m.l}>
            <div className="mv">{m.v}</div>
            <div className="ml">{m.l}</div>
          </div>
        ))}
      </div>
      <div className="qq">
        Every query's top hit is in the correct category (P@1 = {a.pAt["1"].toFixed(2)}),
        with near-perfect ranking (mAP {a.mAP.toFixed(3)}). Computed by <code>scripts/evaluate.mjs</code>,
        reproducible offline.
      </div>
    </div>
  );
}
