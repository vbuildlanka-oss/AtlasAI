"""Fast tests that lock in the contract the frontend depends on.

They run on the deterministic synthetic dataset so CI never needs network.
"""
from __future__ import annotations

import math

import numpy as np
import pytest

from churnlens.data import clean, _synthesize
from churnlens.export import build_input_schema, build_model_spec
from churnlens.modeling import cross_validate_and_select
from churnlens.schema import (
    CATEGORICAL_FEATURES,
    NUMERIC_FEATURES,
    add_engineered_features,
)


@pytest.fixture(scope="module")
def fitted():
    df = add_engineered_features(clean(_synthesize(n=2000, seed=7)))
    X = df[NUMERIC_FEATURES + CATEGORICAL_FEATURES].copy()
    y = (df["Churn"] == "Yes").astype(int).to_numpy()
    sel = cross_validate_and_select(X, y)
    model = sel.production_model
    model.fit(X, y)
    return df, X, y, model


def _sigmoid(z):
    return 1.0 / (1.0 + math.exp(-z))


def test_engineered_feature_bounds():
    df = add_engineered_features(clean(_synthesize(n=500, seed=1)))
    assert df["num_addon_services"].between(0, 6).all()


def test_model_has_signal(fitted):
    from sklearn.metrics import roc_auc_score
    _, X, y, model = fitted
    auc = roc_auc_score(y, model.predict_proba(X)[:, 1])
    assert auc > 0.75, f"AUC too low: {auc}"


def test_spec_matches_sklearn(fitted):
    """The exported linear spec must reproduce sklearn probabilities exactly.

    This guarantees the pure-TypeScript inference in the browser is faithful.
    """
    df, X, y, model = fitted
    spec = build_model_spec(model, X)
    sk = model.predict_proba(X)[:, 1]

    max_diff = 0.0
    for i in range(0, len(X), 37):  # sample rows
        row = X.iloc[i]
        z = spec["intercept"]
        for t in spec["terms"]:
            if t["kind"] == "numeric":
                enc = (float(row[t["feature"]]) - t["center"]) / t["scale"]
            else:
                enc = 1.0 if str(row[t["feature"]]) == t["value"] else 0.0
            z += t["coef"] * enc
        max_diff = max(max_diff, abs(_sigmoid(z) - sk[i]))
    assert max_diff < 1e-9, f"spec/sklearn parity broken: {max_diff}"


def test_schema_covers_all_inputs(fitted):
    df, X, y, model = fitted
    schema = build_input_schema(df)
    feats = {s["feature"] for s in schema}
    # every categorical + the two user-controlled numerics are present
    assert set(CATEGORICAL_FEATURES).issubset(feats)
    assert {"tenure", "MonthlyCharges"}.issubset(feats)
