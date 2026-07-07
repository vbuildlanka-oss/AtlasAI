"""Turn a fitted logistic pipeline into browser-ready artifacts.

Produces two things:
  * model.json  -- a compact, self-contained spec (standardisation stats,
    one-hot terms, coefficients + baseline means) that lets the frontend run
    *exact* inference and faithful additive (linear-SHAP) explanations in
    pure TypeScript. No server, no runtime dependency.
  * model.onnx  -- the same pipeline exported to ONNX for portable
    edge/server deployment, validated for parity against scikit-learn.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.pipeline import Pipeline

from .schema import (
    ADDON_SERVICES,
    CATEGORICAL_FEATURES,
    FEATURE_LABELS,
    NUMERIC_FEATURES,
)


def _sigmoid(z: float) -> float:
    return 1.0 / (1.0 + math.exp(-z))


def build_model_spec(pipe: Pipeline, X_train: pd.DataFrame) -> dict:
    pre = pipe.named_steps["pre"]
    clf = pipe.named_steps["clf"]
    scaler = pre.named_transformers_["num"]
    encoder = pre.named_transformers_["cat"]

    coef = clf.coef_.ravel()
    intercept = float(clf.intercept_[0])

    terms: list[dict] = []
    col = 0

    # --- numeric terms (standardised; baseline encoded-mean == 0) ----------
    for i, feat in enumerate(NUMERIC_FEATURES):
        terms.append({
            "feature": feat,
            "kind": "numeric",
            "center": float(scaler.mean_[i]),
            "scale": float(scaler.scale_[i]),
            "coef": float(coef[col]),
            "mean": 0.0,
        })
        col += 1

    # --- one-hot categorical terms ----------------------------------------
    for f_idx, feat in enumerate(CATEGORICAL_FEATURES):
        for cat in encoder.categories_[f_idx]:
            freq = float((X_train[feat] == cat).mean())
            terms.append({
                "feature": feat,
                "kind": "categorical",
                "value": str(cat),
                "coef": float(coef[col]),
                "mean": freq,
            })
            col += 1

    assert col == len(coef), f"term/coef mismatch: {col} != {len(coef)}"

    baseline_logit = intercept + sum(t["coef"] * t["mean"] for t in terms)

    # --- global feature importance ----------------------------------------
    importance = {}
    for feat in NUMERIC_FEATURES:
        importance[feat] = abs(next(t["coef"] for t in terms
                                    if t["feature"] == feat))
    for feat in CATEGORICAL_FEATURES:
        cs = [t["coef"] for t in terms if t["feature"] == feat]
        importance[feat] = max(cs) - min(cs)  # spread across categories
    total = sum(importance.values()) or 1.0
    importance_list = sorted(
        ({"feature": f, "label": FEATURE_LABELS[f],
          "importance": round(v / total, 4)} for f, v in importance.items()),
        key=lambda d: d["importance"], reverse=True,
    )

    return {
        "intercept": intercept,
        "baseline_logit": baseline_logit,
        "baseline_prob": round(_sigmoid(baseline_logit), 4),
        "terms": terms,
        "importance": importance_list,
    }


def build_input_schema(df: pd.DataFrame) -> list[dict]:
    """Describe the fields the user controls in the interactive scorer."""
    schema: list[dict] = []
    # numeric raw inputs the user sets directly
    for feat, unit, step in [("tenure", "months", 1), ("MonthlyCharges", "$", 0.5)]:
        schema.append({
            "feature": feat,
            "label": FEATURE_LABELS[feat],
            "type": "numeric",
            "min": float(np.floor(df[feat].min())),
            "max": float(np.ceil(df[feat].max())),
            "median": float(round(df[feat].median(), 2)),
            "step": step,
            "unit": unit,
        })
    for feat in CATEGORICAL_FEATURES:
        schema.append({
            "feature": feat,
            "label": FEATURE_LABELS[feat],
            "type": "categorical",
            "options": sorted(df[feat].astype(str).unique().tolist()),
            "isAddon": feat in ADDON_SERVICES,
        })
    return schema


def build_cohorts(df: pd.DataFrame) -> dict:
    y = (df["Churn"] == "Yes")

    def by(col, order=None):
        g = df.groupby(col)["Churn"].apply(lambda s: (s == "Yes").mean())
        c = df.groupby(col)["Churn"].size()
        keys = order or list(g.index)
        return [{"label": str(k), "rate": round(float(g[k]), 4),
                 "count": int(c[k])} for k in keys if k in g.index]

    tenure_bins = pd.cut(df["tenure"], [-1, 6, 12, 24, 48, 72],
                         labels=["0-6", "7-12", "13-24", "25-48", "49-72"])
    tg = df.assign(_tg=tenure_bins).groupby("_tg", observed=True)["Churn"]
    tenure_cohort = [{"label": str(k),
                      "rate": round(float((v == "Yes").mean()), 4),
                      "count": int(len(v))}
                     for k, v in tg]

    return {
        "overall": {"rate": round(float(y.mean()), 4), "count": int(len(df))},
        "contract": by("Contract",
                       ["Month-to-month", "One year", "Two year"]),
        "internet": by("InternetService", ["Fiber optic", "DSL", "No"]),
        "payment": by("PaymentMethod"),
        "tenure": tenure_cohort,
    }


def build_samples(df: pd.DataFrame, proba: np.ndarray, schema: list[dict],
                  n: int = 6) -> list[dict]:
    """Representative customers across the risk spectrum for one-click presets."""
    order = np.argsort(proba)
    idx = np.linspace(0, len(order) - 1, n).astype(int)
    picks = order[idx]
    fields = [s["feature"] for s in schema]
    out = []
    for rank, i in enumerate(picks):
        row = df.iloc[i]
        out.append({
            "name": ["Safe", "Stable", "Watch", "Watch", "At-risk", "Critical"][rank],
            "actualChurn": bool(row["Churn"] == "Yes"),
            "modelProb": round(float(proba[i]), 4),
            "inputs": {f: (float(row[f]) if schema_type(schema, f) == "numeric"
                           else str(row[f])) for f in fields},
        })
    return out


def schema_type(schema, feat):
    return next(s["type"] for s in schema if s["feature"] == feat)


def export_onnx(pipe: Pipeline, X_sample: pd.DataFrame, out_path: Path,
                proba_ref: np.ndarray) -> dict:
    """Export to ONNX and validate parity vs scikit-learn."""
    try:
        from skl2onnx import convert_sklearn
        from skl2onnx.common.data_types import FloatTensorType, StringTensorType
        import onnxruntime as ort
    except Exception as exc:  # noqa: BLE001
        print(f"[onnx] skipped (deps unavailable): {exc}")
        return {"available": False, "reason": str(exc)}

    from sklearn.linear_model import LogisticRegression

    initial_types = []
    for feat in NUMERIC_FEATURES:
        initial_types.append((feat, FloatTensorType([None, 1])))
    for feat in CATEGORICAL_FEATURES:
        initial_types.append((feat, StringTensorType([None, 1])))

    onx = convert_sklearn(
        pipe, initial_types=initial_types, target_opset=15,
        options={LogisticRegression: {"zipmap": False}},
    )
    out_path.write_bytes(onx.SerializeToString())

    # --- parity check ------------------------------------------------------
    sess = ort.InferenceSession(out_path.read_bytes(),
                                providers=["CPUExecutionProvider"])
    feeds = {}
    for feat in NUMERIC_FEATURES:
        feeds[feat] = X_sample[feat].to_numpy(dtype=np.float32).reshape(-1, 1)
    for feat in CATEGORICAL_FEATURES:
        feeds[feat] = X_sample[feat].astype(str).to_numpy().reshape(-1, 1)
    outputs = sess.run(None, feeds)
    probs = None
    for o in outputs:
        arr = np.asarray(o)
        if arr.ndim == 2 and arr.shape[1] == 2:
            probs = arr[:, 1]
    max_diff = float(np.max(np.abs(probs - proba_ref))) if probs is not None else None
    ok = max_diff is not None and max_diff < 1e-4
    print(f"[onnx] exported {out_path.name}  parity max|diff| = {max_diff}")
    return {
        "available": True,
        "opset": 15,
        "parityMaxDiff": max_diff,
        "parityOk": bool(ok),
        "sizeBytes": out_path.stat().st_size,
    }
