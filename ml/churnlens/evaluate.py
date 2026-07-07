"""Evaluation metrics + curve extraction for the dashboard."""
from __future__ import annotations

import numpy as np
from sklearn.metrics import (
    accuracy_score,
    brier_score_loss,
    confusion_matrix,
    f1_score,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)


def _downsample(xs, ys, n=60):
    """Reduce curve resolution so the JSON artifact stays small + snappy."""
    xs, ys = np.asarray(xs), np.asarray(ys)
    if len(xs) <= n:
        return xs.tolist(), ys.tolist()
    idx = np.linspace(0, len(xs) - 1, n).astype(int)
    return xs[idx].tolist(), ys[idx].tolist()


def best_f1_threshold(y_true: np.ndarray, proba: np.ndarray) -> float:
    prec, rec, thr = precision_recall_curve(y_true, proba)
    f1 = np.divide(2 * prec * rec, prec + rec,
                   out=np.zeros_like(prec), where=(prec + rec) > 0)
    # precision_recall_curve returns len(thr) == len(prec) - 1
    return float(thr[max(0, np.argmax(f1[:-1]))])


def calibration_bins(y_true: np.ndarray, proba: np.ndarray, n_bins: int = 10):
    edges = np.linspace(0, 1, n_bins + 1)
    idx = np.clip(np.digitize(proba, edges) - 1, 0, n_bins - 1)
    out = []
    for b in range(n_bins):
        mask = idx == b
        if mask.sum() == 0:
            continue
        out.append({
            "predicted": float(proba[mask].mean()),
            "observed": float(y_true[mask].mean()),
            "count": int(mask.sum()),
        })
    return out


def evaluate(y_true: np.ndarray, proba: np.ndarray, threshold: float) -> dict:
    pred = (proba >= threshold).astype(int)
    fpr, tpr, _ = roc_curve(y_true, proba)
    prec_c, rec_c, _ = precision_recall_curve(y_true, proba)
    fpr_d, tpr_d = _downsample(fpr, tpr)
    rec_d, prec_d = _downsample(rec_c, prec_c)
    tn, fp, fn, tp = confusion_matrix(y_true, pred).ravel()
    return {
        "threshold": round(threshold, 4),
        "roc_auc": round(float(roc_auc_score(y_true, proba)), 4),
        "accuracy": round(float(accuracy_score(y_true, pred)), 4),
        "precision": round(float(precision_score(y_true, pred, zero_division=0)), 4),
        "recall": round(float(recall_score(y_true, pred, zero_division=0)), 4),
        "f1": round(float(f1_score(y_true, pred, zero_division=0)), 4),
        "brier": round(float(brier_score_loss(y_true, proba)), 4),
        "base_rate": round(float(y_true.mean()), 4),
        "confusion_matrix": {"tn": int(tn), "fp": int(fp),
                             "fn": int(fn), "tp": int(tp)},
        "roc_curve": [{"fpr": round(a, 4), "tpr": round(b, 4)}
                      for a, b in zip(fpr_d, tpr_d)],
        "pr_curve": [{"recall": round(a, 4), "precision": round(b, 4)}
                     for a, b in zip(rec_d, prec_d)],
        "calibration": calibration_bins(y_true, proba),
    }
