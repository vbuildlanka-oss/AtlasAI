import type { Artifact } from "../types";

const PRETTY: Record<string, string> = {
  logistic_regression: "Logistic Regression",
  random_forest: "Random Forest",
  hist_gradient_boosting: "Hist Gradient Boosting",
};

export default function ModelCard({ artifact }: { artifact: Artifact }) {
  const { benchmarks, meta, model, onnx } = artifact;
  const topImp = model.importance.slice(0, 8);
  const maxImp = Math.max(...topImp.map((i) => i.importance), 0.01);

  return (
    <div className="card">
      <h2>Model selection & drivers</h2>
      <p className="sub">
        Three model families were 5-fold cross-validated; the interpretable
        logistic model was shipped as it matches the ensembles within noise.
      </p>

      <table className="bench">
        <thead>
          <tr>
            <th>Model</th>
            <th className="num">CV ROC-AUC</th>
            <th className="num">± std</th>
          </tr>
        </thead>
        <tbody>
          {benchmarks.map((b) => {
            const shipped = b.name === meta.productionModel;
            return (
              <tr key={b.name} className={shipped ? "win" : ""}>
                <td>
                  {PRETTY[b.name] ?? b.name}
                  {shipped && <span className="tag">shipped</span>}
                </td>
                <td className="num">{b.cvAucMean.toFixed(4)}</td>
                <td className="num">{b.cvAucStd.toFixed(4)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h4 style={{ margin: "22px 0 10px", fontSize: 12, color: "var(--muted)", fontWeight: 500 }}>
        Global feature importance
      </h4>
      {topImp.map((imp) => (
        <div className="cbar" key={imp.feature}>
          <div className="cl" title={imp.label}>
            {imp.label}
          </div>
          <div className="ctrack">
            <div className="cfill" style={{ width: `${(imp.importance / maxImp) * 100}%` }} />
          </div>
          <div className="cv">{(imp.importance * 100).toFixed(0)}%</div>
        </div>
      ))}

      {onnx.available && (
        <p className="disclaimer">
          Also exported to ONNX (opset {onnx.opset}, {(onnx.sizeBytes! / 1024).toFixed(1)} KB)
          for portable edge/server deployment - validated to within{" "}
          {onnx.parityMaxDiff?.toExponential(1)} of scikit-learn.
        </p>
      )}
    </div>
  );
}
