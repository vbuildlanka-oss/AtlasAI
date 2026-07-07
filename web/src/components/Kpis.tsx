import type { Artifact } from "../types";

function Kpi({ label, value, foot }: { label: string; value: string; foot: string }) {
  return (
    <div className="card kpi">
      <div className="k-label">{label}</div>
      <div className="k-value">{value}</div>
      <div className="k-foot">{foot}</div>
    </div>
  );
}

export default function Kpis({ artifact }: { artifact: Artifact }) {
  const { metrics, meta } = artifact;
  const atRisk = Math.round(meta.rows * metrics.base_rate);
  return (
    <div className="grid kpi-row">
      <Kpi
        label="ROC-AUC"
        value={metrics.roc_auc.toFixed(3)}
        foot="Holdout discrimination"
      />
      <Kpi
        label="Recall"
        value={`${(metrics.recall * 100).toFixed(0)}%`}
        foot="Of churners caught"
      />
      <Kpi
        label="Customers"
        value={meta.rows.toLocaleString()}
        foot={meta.datasetIsReal ? "Real IBM Telco data" : "Synthetic dataset"}
      />
      <Kpi
        label="At-risk base"
        value={atRisk.toLocaleString()}
        foot={`${(metrics.base_rate * 100).toFixed(1)}% churn rate`}
      />
      <Kpi label="Inference" value="0 ms*" foot="Runs in your browser" />
    </div>
  );
}
