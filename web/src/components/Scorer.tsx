import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { Artifact, CategoricalField, InputRecord, NumericField } from "../types";
import { predict, riskTier } from "../lib/inference";
import { recommend } from "../lib/recommend";
import Gauge from "./Gauge";
import Waterfall from "./Waterfall";

const ADDONS = [
  "OnlineSecurity",
  "OnlineBackup",
  "DeviceProtection",
  "TechSupport",
  "StreamingTV",
  "StreamingMovies",
];
const ACCOUNT = ["Contract", "PaymentMethod", "PaperlessBilling"];
const SERVICES = ["PhoneService", "MultipleLines", "InternetService"];
const CUSTOMER = ["gender", "SeniorCitizen", "Partner", "Dependents"];

function initialInputs(artifact: Artifact): InputRecord {
  const watch = artifact.samples.find((s) => s.name === "At-risk") ?? artifact.samples[2];
  return { ...watch.inputs };
}

export default function Scorer({ artifact }: { artifact: Artifact }) {
  const { model, schema, samples } = artifact;
  const [inputs, setInputs] = useState<InputRecord>(() => initialInputs(artifact));

  const field = (f: string) => schema.find((s) => s.feature === f)!;
  const set = (f: string, v: string | number) => setInputs((p) => ({ ...p, [f]: v }));

  const prediction = useMemo(() => predict(model, schema, inputs), [model, schema, inputs]);
  const recs = useMemo(() => recommend(model, schema, inputs), [model, schema, inputs]);
  const tier = riskTier(prediction.probability);
  const hasInternet = inputs.InternetService !== "No";

  const numericFields = schema.filter((s) => s.type === "numeric") as NumericField[];

  const renderSelect = (f: string) => {
    const fld = field(f) as CategoricalField;
    return (
      <div className="field" key={f}>
        <label>{fld.label}</label>
        <select value={String(inputs[f])} onChange={(e) => set(f, e.target.value)}>
          {fld.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
    );
  };

  return (
    <div className="grid main-grid">
      {/* ---- controls ---- */}
      <div className="card">
        <h2>Live risk scorer</h2>
        <p className="sub">
          Adjust a customer profile and watch the model score it instantly - no
          network round-trip.
        </p>

        <div className="presets">
          {samples.map((s) => (
            <button key={s.name} className="preset" onClick={() => setInputs({ ...s.inputs })}>
              {s.name}
            </button>
          ))}
        </div>

        {numericFields.map((fld) => {
          const pct = ((Number(inputs[fld.feature]) - fld.min) / (fld.max - fld.min)) * 100;
          return (
            <div className="field" key={fld.feature}>
              <label>
                {fld.label}
                <span className="val">
                  {fld.unit === "$" ? "$" : ""}
                  {Number(inputs[fld.feature]).toFixed(fld.step < 1 ? 2 : 0)}
                  {fld.unit === "months" ? " mo" : ""}
                </span>
              </label>
              <input
                type="range"
                min={fld.min}
                max={fld.max}
                step={fld.step}
                value={Number(inputs[fld.feature])}
                style={{ ["--pct" as string]: `${pct}%` }}
                onChange={(e) => set(fld.feature, Number(e.target.value))}
              />
            </div>
          );
        })}

        <div className="section-title">Account</div>
        {ACCOUNT.map(renderSelect)}

        <div className="section-title">Services</div>
        {SERVICES.map(renderSelect)}

        <div className="section-title">
          Add-on services {!hasInternet && "(requires internet)"}
        </div>
        <div className="toggle-grid">
          {ADDONS.map((f) => {
            const on = inputs[f] === "Yes";
            return (
              <div
                key={f}
                className={`toggle ${on ? "on" : ""}`}
                style={{ opacity: hasInternet ? 1 : 0.4, pointerEvents: hasInternet ? "auto" : "none" }}
                onClick={() => set(f, on ? "No" : "Yes")}
              >
                <span>{field(f).label}</span>
                <span className="dot" />
              </div>
            );
          })}
        </div>

        <div className="section-title">Customer</div>
        {CUSTOMER.map(renderSelect)}
      </div>

      {/* ---- result ---- */}
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div className="card">
          <div className="result-head">
            <Gauge value={prediction.probability} color={tier.color} />
            <div>
              <span className="tier-badge" style={{ color: tier.color }}>
                {tier.label} risk
              </span>
              <p className="result-advice" style={{ marginTop: 10 }}>
                {tier.advice}
              </p>
              <p className="result-advice" style={{ fontSize: 12 }}>
                Population baseline:{" "}
                <b style={{ color: "var(--text)" }}>
                  {(prediction.baselineProb * 100).toFixed(1)}%
                </b>
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <h2>Why this score?</h2>
          <p className="sub">
            Exact additive attributions (linear SHAP) - each bar is a feature's
            push on the churn log-odds.
          </p>
          <Waterfall contributions={prediction.contributions} />
        </div>

        <div className="card">
          <h2>Retention simulator</h2>
          <p className="sub">
            Best next actions, ranked by the risk drop the model predicts.
          </p>
          {recs.length === 0 ? (
            <div className="rec-empty">
              No high-impact lever found - this profile is already well-retained.
            </div>
          ) : (
            recs.map((r) => (
              <motion.div
                className="rec"
                key={r.label}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div>
                  <div className="r-title">{r.label}</div>
                  <div className="r-detail">{r.detail}</div>
                </div>
                <div className="r-delta">{(r.delta * 100).toFixed(1)} pts</div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
