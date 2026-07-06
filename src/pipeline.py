"""Preprocessing + model definitions, assembled as scikit-learn Pipelines.

A single ``Pipeline`` bundles preprocessing with the classifier so the exact
same transformations are applied during training, evaluation, and live
prediction — no train/serve skew, and the whole thing is one object to pass
around.
"""
from __future__ import annotations

from sklearn.base import clone
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from .data import CATEGORICAL_FEATURES, NUMERIC_FEATURES, RANDOM_STATE

# Candidate models. Where the estimator supports it, class_weight="balanced"
# counters the 3:1 class imbalance; for the others we rely on ROC-AUC for model
# selection and an adjustable decision threshold at serving time.
MODELS: dict[str, object] = {
    "Logistic Regression": LogisticRegression(
        max_iter=1000, class_weight="balanced", random_state=RANDOM_STATE
    ),
    "Random Forest": RandomForestClassifier(
        n_estimators=300, class_weight="balanced", random_state=RANDOM_STATE, n_jobs=-1
    ),
    "Gradient Boosting": HistGradientBoostingClassifier(
        max_iter=300, learning_rate=0.08, random_state=RANDOM_STATE
    ),
}

# Chosen by cross-validated ROC-AUC (see the Models tab): a well-regularised,
# class-balanced Logistic Regression is the strongest — and most interpretable —
# model on this dataset, edging out the tree ensembles.
DEFAULT_MODEL = "Logistic Regression"


def build_preprocessor() -> ColumnTransformer:
    """Impute + scale numeric columns; impute + one-hot encode categoricals."""
    numeric = Pipeline(
        steps=[
            ("impute", SimpleImputer(strategy="median")),
            ("scale", StandardScaler()),
        ]
    )
    categorical = Pipeline(
        steps=[
            ("impute", SimpleImputer(strategy="most_frequent")),
            # Dense output so tree/boosting models accept it; ignore unseen levels.
            ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
        ]
    )
    return ColumnTransformer(
        transformers=[
            ("num", numeric, NUMERIC_FEATURES),
            ("cat", categorical, CATEGORICAL_FEATURES),
        ]
    )


def build_pipeline(model_name: str) -> Pipeline:
    """Preprocessing + a fresh copy of the named classifier, as one Pipeline."""
    if model_name not in MODELS:
        raise ValueError(f"Unknown model '{model_name}'. Options: {list(MODELS)}")
    return Pipeline(
        steps=[
            ("preprocess", build_preprocessor()),
            ("classifier", clone(MODELS[model_name])),
        ]
    )
