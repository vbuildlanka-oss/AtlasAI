"""Model selection, evaluation, explainability, and single-customer prediction."""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.inspection import permutation_importance
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.model_selection import cross_val_score
from sklearn.pipeline import Pipeline

from .data import ChurnData, FEATURES
from .pipeline import MODELS, build_pipeline

CV_FOLDS = 5


@dataclass
class ModelScore:
    name: str
    cv_auc_mean: float
    cv_auc_std: float


def compare_models(data: ChurnData) -> list[ModelScore]:
    """5-fold cross-validated ROC-AUC for every candidate model (on train data).

    ROC-AUC is threshold-independent and robust to class imbalance, which makes
    it the right yardstick for choosing between models here.
    """
    scores: list[ModelScore] = []
    for name in MODELS:
        pipe = build_pipeline(name)
        cv = cross_val_score(
            pipe, data.X_train, data.y_train, cv=CV_FOLDS, scoring="roc_auc"
        )
        scores.append(ModelScore(name, float(cv.mean()), float(cv.std())))
    return sorted(scores, key=lambda s: s.cv_auc_mean, reverse=True)


def train_model(name: str, data: ChurnData) -> Pipeline:
    """Fit the named pipeline on the full training split."""
    pipe = build_pipeline(name)
    pipe.fit(data.X_train, data.y_train)
    return pipe


@dataclass
class Evaluation:
    threshold: float
    roc_auc: float
    accuracy: float
    precision: float
    recall: float
    f1: float
    confusion: np.ndarray
    report: dict
    fpr: np.ndarray
    tpr: np.ndarray
    y_proba: np.ndarray


def evaluate_model(pipe: Pipeline, data: ChurnData, threshold: float = 0.5) -> Evaluation:
    """Score a fitted pipeline on the held-out test set at a chosen threshold."""
    y_proba = pipe.predict_proba(data.X_test)[:, 1]
    y_pred = (y_proba >= threshold).astype(int)
    fpr, tpr, _ = roc_curve(data.y_test, y_proba)

    return Evaluation(
        threshold=threshold,
        roc_auc=float(roc_auc_score(data.y_test, y_proba)),
        accuracy=float(accuracy_score(data.y_test, y_pred)),
        precision=float(precision_score(data.y_test, y_pred, zero_division=0)),
        recall=float(recall_score(data.y_test, y_pred, zero_division=0)),
        f1=float(f1_score(data.y_test, y_pred, zero_division=0)),
        confusion=confusion_matrix(data.y_test, y_pred),
        report=classification_report(
            data.y_test, y_pred, target_names=["Stay", "Churn"], output_dict=True, zero_division=0
        ),
        fpr=fpr,
        tpr=tpr,
        y_proba=y_proba,
    )


def feature_importances(pipe: Pipeline, data: ChurnData, n_repeats: int = 8) -> pd.DataFrame:
    """Permutation importance over the *original* features (model-agnostic).

    Measures how much test ROC-AUC drops when each feature's values are shuffled
    — a faithful, interpretable ranking of what drives churn predictions.
    """
    result = permutation_importance(
        pipe,
        data.X_test,
        data.y_test,
        scoring="roc_auc",
        n_repeats=n_repeats,
        random_state=42,
        n_jobs=-1,
    )
    return (
        pd.DataFrame(
            {
                "feature": FEATURES,
                "importance": result.importances_mean,
                "std": result.importances_std,
            }
        )
        .sort_values("importance", ascending=False)
        .reset_index(drop=True)
    )


def predict_customer(pipe: Pipeline, features: dict, threshold: float = 0.5) -> dict:
    """Predict churn for one customer given a dict of feature values."""
    row = pd.DataFrame([{k: features.get(k) for k in FEATURES}])
    proba = float(pipe.predict_proba(row)[0, 1])
    return {
        "probability": proba,
        "will_churn": bool(proba >= threshold),
        "risk": "High" if proba >= 0.66 else "Medium" if proba >= 0.33 else "Low",
    }
