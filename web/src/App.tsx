import { useEffect, useState } from "react";
import type { Artifact } from "./types";
import Kpis from "./components/Kpis";
import Scorer from "./components/Scorer";
import Performance from "./components/Performance";
import ModelCard from "./components/ModelCard";
import Cohorts from "./components/Cohorts";

export default function App() {
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}model/model.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setArtifact)
      .catch((e) => setError(String(e)));
  }, []);

  if (error) {
    return (
      <div className="app loading">
        <div>
          <p>Could not load the model artifact.</p>
          <p style={{ color: "var(--faint)", fontSize: 13 }}>
            Run <code>python ml/run.py</code> to generate it, then reload. ({error})
          </p>
        </div>
      </div>
    );
  }

  if (!artifact) {
    return (
      <div className="app loading">
        <div style={{ textAlign: "center" }}>
          <div className="spinner" />
          Loading model…
        </div>
      </div>
    );
  }

  const gen = new Date(artifact.meta.generatedAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <div className="logo">🧭</div>
          <div>
            <h1>ChurnLens AI</h1>
            <p>Explainable customer-retention intelligence</p>
          </div>
        </div>
        <div className="badges">
          <span className="chip live">In-browser inference</span>
          <span className="chip">
            {artifact.meta.datasetIsReal ? "IBM Telco dataset" : "Synthetic data"} ·{" "}
            {artifact.meta.rows.toLocaleString()} rows
          </span>
          <span className="chip">scikit-learn · ONNX</span>
        </div>
      </header>

      <Kpis artifact={artifact} />

      <Scorer artifact={artifact} />

      <div className="section-title" style={{ marginTop: 34 }}>
        Model performance
      </div>
      <Performance metrics={artifact.metrics} />

      <div className="grid main-grid" style={{ marginTop: 18 }}>
        <ModelCard artifact={artifact} />
        <Cohorts cohorts={artifact.cohorts} />
      </div>

      <footer className="footer">
        <p>
          The full model runs client-side in TypeScript from a {"<"}35&nbsp;KB spec —
          exact parity with the trained scikit-learn pipeline. No server, no API keys,
          no data leaves your device.
        </p>
        <p>
          Model {artifact.meta.version} · generated {gen} ·{" "}
          {artifact.meta.datasetSource}
        </p>
        <p className="disclaimer" style={{ display: "inline-block", textAlign: "left" }}>
          Educational demonstration of ML engineering. Predictions are statistical
          estimates on historical telecom data, not business or financial advice.
        </p>
      </footer>
    </div>
  );
}
