import type { Metrics } from "../types";
import LineChart from "./LineChart";

export default function Performance({ metrics }: { metrics: Metrics }) {
  const cm = metrics.confusion_matrix;
  return (
    <div className="grid charts-grid">
      <div className="card">
        <h2>ROC curve</h2>
        <p className="sub">True vs false positive rate on the 20% holdout set.</p>
        <LineChart
          points={metrics.roc_curve.map((p) => ({ x: p.fpr, y: p.tpr }))}
          xLabel="False positive rate"
          yLabel="True positive rate"
          diagonal
          fill
        />
        <div className="metric-inline">
          <div>
            AUC <b>{metrics.roc_auc.toFixed(3)}</b>
          </div>
          <div>
            Brier <b>{metrics.brier.toFixed(3)}</b>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Precision-Recall</h2>
        <p className="sub">Performance on the minority (churn) class.</p>
        <LineChart
          points={metrics.pr_curve.map((p) => ({ x: p.recall, y: p.precision }))}
          xLabel="Recall"
          yLabel="Precision"
        />
        <div className="metric-inline">
          <div>
            Precision <b>{(metrics.precision * 100).toFixed(1)}%</b>
          </div>
          <div>
            Recall <b>{(metrics.recall * 100).toFixed(1)}%</b>
          </div>
          <div>
            F1 <b>{metrics.f1.toFixed(3)}</b>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Calibration</h2>
        <p className="sub">Predicted probability vs observed frequency.</p>
        <LineChart
          points={metrics.calibration.map((p) => ({ x: p.predicted, y: p.observed }))}
          xLabel="Predicted"
          yLabel="Observed"
          diagonal
          markers
        />
        <div className="metric-inline">
          <div>
            Base churn rate <b>{(metrics.base_rate * 100).toFixed(1)}%</b>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Confusion matrix</h2>
        <p className="sub">
          At decision threshold {metrics.threshold.toFixed(2)} (F1-optimal).
        </p>
        <div className="cm">
          <div className="cm-cell tp">
            <div className="n">{cm.tp}</div>
            <div className="t">True positive</div>
          </div>
          <div className="cm-cell fp">
            <div className="n">{cm.fp}</div>
            <div className="t">False positive</div>
          </div>
          <div className="cm-cell fn">
            <div className="n">{cm.fn}</div>
            <div className="t">False negative</div>
          </div>
          <div className="cm-cell tn">
            <div className="n">{cm.tn}</div>
            <div className="t">True negative</div>
          </div>
        </div>
        <div className="metric-inline">
          <div>
            Accuracy <b>{(metrics.accuracy * 100).toFixed(1)}%</b>
          </div>
        </div>
      </div>
    </div>
  );
}
