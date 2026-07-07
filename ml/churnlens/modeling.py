"""Model building, cross-validation and selection.

We benchmark several model families, then deliberately ship a *logistic
regression* as the production model: on this problem it is within a point or
two of AUC of gradient boosting, but it is fully transparent (exact additive
per-feature attributions) and converts to a tiny, universally supported ONNX
graph that runs in the browser with zero server cost.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from .schema import CATEGORICAL_FEATURES, NUMERIC_FEATURES


def build_preprocessor() -> ColumnTransformer:
    return ColumnTransformer(
        transformers=[
            ("num", StandardScaler(), NUMERIC_FEATURES),
            (
                "cat",
                OneHotEncoder(handle_unknown="ignore", sparse_output=False),
                CATEGORICAL_FEATURES,
            ),
        ],
        remainder="drop",
        verbose_feature_names_out=False,
    )


def _candidates() -> dict[str, Pipeline]:
    return {
        "logistic_regression": Pipeline([
            ("pre", build_preprocessor()),
            ("clf", LogisticRegression(
                max_iter=2000, C=0.5, class_weight="balanced")),
        ]),
        "random_forest": Pipeline([
            ("pre", build_preprocessor()),
            ("clf", RandomForestClassifier(
                n_estimators=300, max_depth=12, min_samples_leaf=20,
                class_weight="balanced", random_state=42, n_jobs=-1)),
        ]),
        "hist_gradient_boosting": Pipeline([
            ("pre", build_preprocessor()),
            ("clf", HistGradientBoostingClassifier(
                max_iter=300, learning_rate=0.05, max_depth=4,
                l2_regularization=1.0, random_state=42)),
        ]),
    }


@dataclass
class Benchmark:
    name: str
    cv_auc_mean: float
    cv_auc_std: float


@dataclass
class SelectionResult:
    production_model: Pipeline
    production_name: str
    benchmarks: list[Benchmark] = field(default_factory=list)


def cross_validate_and_select(
    X: pd.DataFrame, y: np.ndarray, production: str = "logistic_regression"
) -> SelectionResult:
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    benchmarks: list[Benchmark] = []
    models = _candidates()
    for name, pipe in models.items():
        scores = cross_val_score(pipe, X, y, cv=cv, scoring="roc_auc", n_jobs=-1)
        benchmarks.append(Benchmark(name, float(scores.mean()), float(scores.std())))
        print(f"[cv] {name:>24}  AUC = {scores.mean():.4f} +/- {scores.std():.4f}")
    benchmarks.sort(key=lambda b: b.cv_auc_mean, reverse=True)
    return SelectionResult(
        production_model=models[production],
        production_name=production,
        benchmarks=benchmarks,
    )
