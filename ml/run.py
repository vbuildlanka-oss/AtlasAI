"""End-to-end pipeline: data -> CV/selection -> fit -> evaluate -> export.

Run:  python run.py            (downloads real data if online, else synthetic)
      python run.py --synthetic

Outputs browser-ready artifacts into ../web/public/model/.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
from pathlib import Path

import numpy as np
from sklearn.model_selection import train_test_split

from churnlens import __version__
from churnlens.data import clean, load_raw
from churnlens.evaluate import best_f1_threshold, evaluate
from churnlens.export import (
    build_cohorts,
    build_input_schema,
    build_model_spec,
    build_samples,
    export_onnx,
)
from churnlens.modeling import cross_validate_and_select
from churnlens.schema import (
    CATEGORICAL_FEATURES,
    NUMERIC_FEATURES,
    add_engineered_features,
)

OUT_DIR = Path(__file__).resolve().parents[1] / "web" / "public" / "model"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--synthetic", action="store_true",
                    help="force synthetic dataset (offline)")
    args = ap.parse_args()

    print("=" * 66)
    print(f" ChurnLens AI - training pipeline v{__version__}")
    print("=" * 66)

    df = clean(load_raw(force_synthetic=args.synthetic))
    df = add_engineered_features(df)
    dataset_is_real = not df["customerID"].astype(str).str.contains("SYNTH").any() \
        if "customerID" in df.columns else True

    features = NUMERIC_FEATURES + CATEGORICAL_FEATURES
    X = df[features].copy()
    y = (df["Churn"] == "Yes").astype(int).to_numpy()

    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=42)

    # --- benchmark + select ------------------------------------------------
    print("\n[stage] cross-validation & model selection")
    selection = cross_validate_and_select(X_tr, y_tr)

    # --- fit on train, evaluate on untouched holdout -----------------------
    print("\n[stage] holdout evaluation")
    model = selection.production_model
    model.fit(X_tr, y_tr)
    proba_te = model.predict_proba(X_te)[:, 1]
    threshold = best_f1_threshold(y_te, proba_te)
    metrics = evaluate(y_te, proba_te, threshold)
    print(f"[eval] production={selection.production_name} "
          f"AUC={metrics['roc_auc']} F1={metrics['f1']} "
          f"precision={metrics['precision']} recall={metrics['recall']}")

    # --- refit on ALL data for the shipped artifact ------------------------
    print("\n[stage] refit on full dataset for deployment")
    model.fit(X, y)
    proba_all = model.predict_proba(X)[:, 1]

    spec = build_model_spec(model, X)
    spec["threshold"] = threshold
    schema = build_input_schema(df)
    cohorts = build_cohorts(df)
    samples = build_samples(df, proba_all, schema)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    onnx_info = export_onnx(model, X.iloc[:200], OUT_DIR / "model.onnx",
                            proba_all[:200])

    artifact = {
        "meta": {
            "name": "ChurnLens AI",
            "version": __version__,
            "generatedAt": dt.datetime.utcnow().isoformat() + "Z",
            "datasetSource": "IBM Telco Customer Churn (public)"
            if dataset_is_real else "synthetic (offline fallback)",
            "datasetIsReal": bool(dataset_is_real),
            "rows": int(len(df)),
            "productionModel": selection.production_name,
            "features": {"numeric": NUMERIC_FEATURES,
                         "categorical": CATEGORICAL_FEATURES},
        },
        "benchmarks": [
            {"name": b.name, "cvAucMean": round(b.cv_auc_mean, 4),
             "cvAucStd": round(b.cv_auc_std, 4)}
            for b in selection.benchmarks
        ],
        "metrics": metrics,
        "model": spec,
        "schema": schema,
        "cohorts": cohorts,
        "samples": samples,
        "onnx": onnx_info,
    }

    (OUT_DIR / "model.json").write_text(json.dumps(artifact, indent=2))
    size_kb = (OUT_DIR / "model.json").stat().st_size / 1024
    print(f"\n[done] wrote {OUT_DIR/'model.json'} ({size_kb:.1f} KB)")
    print(f"[done] artifacts in {OUT_DIR}")


if __name__ == "__main__":
    main()
