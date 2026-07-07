# 🧭 ChurnLens AI — Explainable Customer‑Retention Intelligence

An end‑to‑end machine‑learning project that predicts telecom customer churn,
**explains every prediction**, and recommends the retention action most likely
to save each account — all in a polished dashboard that runs the model
**100 % client‑side in the browser**.

Built entirely with **free, open tools** (scikit‑learn, ONNX, React, Vite).
No paid APIs, no inference server, no data ever leaves the device.

> **Why this design is interesting:** the model is trained and rigorously
> evaluated in Python, then compiled into a tiny (~31 KB) JSON spec that the
> frontend executes in pure TypeScript with **bit‑for‑bit parity** to
> scikit‑learn (verified to `<5e‑5`). You get real ML engineering *and* a
> zero‑cost, infinitely‑scalable static deployment.

---

## ✨ What it does

| Capability | Description |
|---|---|
| **Live risk scoring** | Adjust any customer attribute and get an instant churn probability — inference runs locally in ~0 ms. |
| **Faithful explanations** | An additive **linear‑SHAP** waterfall shows exactly how each feature pushes the score up or down (in log‑odds). |
| **Retention simulator** | Applies real business "levers" (contract upgrade, add‑ons, auto‑pay…), re‑runs the model, and ranks them by predicted risk reduction. |
| **Model transparency** | 5‑fold cross‑validation leaderboard, global feature importance, and a note on the ONNX artifact. |
| **Performance analytics** | ROC, precision‑recall, calibration curves and a confusion matrix from a held‑out test set. |
| **Segment insights** | Ground‑truth churn rates by contract, internet type, tenure and payment method. |

---

## 📊 Results (real IBM Telco dataset, 7,043 customers)

Three model families were benchmarked with 5‑fold cross‑validation:

| Model | CV ROC‑AUC | ± std |
|---|---|---|
| Random Forest | 0.846 | 0.009 |
| **Logistic Regression** ⬅ *shipped* | **0.845** | 0.012 |
| Hist Gradient Boosting | 0.843 | 0.011 |

The gradient‑boosted and bagged ensembles were statistically indistinguishable
from logistic regression on this problem, so the **interpretable linear model
was shipped**: it gives exact per‑feature attributions, compiles to a tiny
universally‑portable ONNX graph, and runs trivially in the browser.

**Held‑out (20 %) test metrics** at the F1‑optimal threshold:
`ROC‑AUC 0.839 · Recall 75 % · Precision 53 % · Brier 0.14`.

*(If the machine is offline, the pipeline deterministically generates a
realistic synthetic dataset with the same schema, so it always runs.)*

---

## 🏗️ Architecture

```
                  TRAIN (offline, Python)                 SERVE (browser, TS)
 ┌───────────────────────────────────────────┐     ┌──────────────────────────┐
 │  IBM Telco CSV ─► clean ─► feature eng.     │     │  fetch model.json        │
 │        │                                    │     │        │                 │
 │        ▼                                    │     │        ▼                 │
 │  ColumnTransformer (scale + one‑hot)        │     │  exact logistic scoring  │
 │        │                                    │     │  + linear‑SHAP           │
 │        ▼                                    │     │        │                 │
 │  5‑fold CV: LogReg / RF / HistGB            │     │        ▼                 │
 │        │  (select interpretable model)      │     │  gauge · waterfall ·     │
 │        ▼                                    │     │  what‑if simulator ·     │
 │  evaluate ─► export ──────────────────────► │ ─►  │  performance charts      │
 │      model.json  (spec + metrics + cohorts) │     │                          │
 │      model.onnx  (portable, parity‑checked) │     │  0 servers · 0 API keys  │
 └───────────────────────────────────────────┘     └──────────────────────────┘
```

The Python export encodes the fitted pipeline as additive terms
(`coef`, baseline `mean`, plus scaler `center`/`scale`). The browser rebuilds
the identical feature vector and computes `sigmoid(intercept + Σ coefᵢ·xᵢ)` —
the same math scikit‑learn runs — and derives explanations as
`coefᵢ·(xᵢ − E[xᵢ])`, which is exact SHAP for a linear model.

---

## 📁 Project structure

```
.
├── ml/                         # Python ML engineering
│   ├── churnlens/
│   │   ├── schema.py           # single source of truth for features
│   │   ├── data.py             # download real data (+ synthetic fallback)
│   │   ├── modeling.py         # pipeline, CV, model selection
│   │   ├── evaluate.py         # metrics + ROC/PR/calibration curves
│   │   └── export.py           # JSON spec + ONNX export & parity check
│   ├── tests/test_pipeline.py  # incl. TS/sklearn parity contract test
│   └── run.py                  # orchestrates the whole pipeline
└── web/                        # React + TS + Vite dashboard
    ├── src/lib/inference.ts    # exact in‑browser model + linear‑SHAP
    ├── src/lib/recommend.ts    # retention‑lever simulator
    ├── src/components/         # gauge, waterfall, charts, scorer…
    └── public/model/           # generated model.json + model.onnx
```

---

## 🚀 Run it locally

**1. Train the model (regenerates the browser artifacts):**

```bash
cd ml
python -m venv .venv && source .venv/bin/activate   # or: uv venv .venv
pip install -r requirements.txt
python run.py            # add --synthetic to force offline mode
pytest                   # runs the parity + signal tests
```

**2. Launch the dashboard:**

```bash
cd web
npm install
npm run dev              # http://localhost:5173
```

---

## 🌐 Deploy for free (static site)

`npm run build` produces a fully static `web/dist/` (including the model
artifacts). Host it anywhere free:

- **GitHub Pages** — push `web/dist` or use the included CI workflow.
- **Netlify / Vercel / Cloudflare Pages** — set base directory `web`,
  build `npm run build`, publish `dist`.

Because inference is client‑side, hosting cost is **$0** and it scales to any
number of users with zero backend.

---

## 🔬 Engineering notes

- **No train/serve skew:** feature definitions live in one place
  (`schema.py`); a unit test asserts the exported spec reproduces
  scikit‑learn's probabilities to `<1e‑9`.
- **Calibrated & honest:** metrics come from an untouched 20 % holdout; the
  shipped artifact is then refit on 100 % of the data.
- **Portable:** the same pipeline is exported to ONNX (opset 15) and
  validated against scikit‑learn for edge/server deployment.
- **Reproducible:** deterministic seeds; offline synthetic fallback so CI
  never depends on the network.

---

## ⚠️ Disclaimer

This is an educational demonstration of ML engineering on a public dataset.
Predictions are statistical estimates on historical telecom data and are **not**
business, financial, or professional advice.
