"""End-to-end checks for the Churn Radar ML pipeline.

    python tests/test_pipeline.py      # plain script with a printed report
    pytest                             # if pytest is installed

Proves the project works: the data loads and cleans, every model trains to a
solid ROC-AUC, evaluation metrics are well-formed, explainability runs, and a
single-customer prediction returns a valid probability.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.data import CATEGORICAL_FEATURES, FEATURES, load_data
from src.evaluate import (
    compare_models,
    evaluate_model,
    feature_importances,
    predict_customer,
    train_model,
)
from src.pipeline import DEFAULT_MODEL, MODELS

MIN_AUC = 0.80


def test_data_loads_and_cleans():
    data = load_data()
    assert data.n_rows == 7043
    assert set(FEATURES).issubset(data.X.columns)
    # TotalCharges coerced to numeric (blanks -> NaN, imputed downstream).
    assert str(data.X["TotalCharges"].dtype).startswith("float")
    # Target is binary with a realistic imbalance.
    assert set(np.unique(data.y)) == {0, 1}
    assert 0.2 < data.churn_rate < 0.35


def test_all_models_beat_auc_floor():
    data = load_data()
    for score in compare_models(data):
        assert score.cv_auc_mean >= MIN_AUC, f"{score.name} AUC {score.cv_auc_mean:.3f}"


def test_evaluation_is_well_formed():
    data = load_data()
    model = train_model(DEFAULT_MODEL, data)
    ev = evaluate_model(model, data, threshold=0.5)
    assert ev.roc_auc >= MIN_AUC
    for value in (ev.accuracy, ev.precision, ev.recall, ev.f1):
        assert 0.0 <= value <= 1.0
    assert ev.confusion.shape == (2, 2)


def test_threshold_changes_recall():
    data = load_data()
    model = train_model(DEFAULT_MODEL, data)
    low = evaluate_model(model, data, threshold=0.25)
    high = evaluate_model(model, data, threshold=0.75)
    # A lower threshold should catch at least as many churners (higher recall).
    assert low.recall >= high.recall


def test_feature_importance_runs():
    data = load_data()
    model = train_model(DEFAULT_MODEL, data)
    imp = feature_importances(model, data, n_repeats=3)
    assert len(imp) == len(FEATURES)
    assert imp["importance"].iloc[0] >= imp["importance"].iloc[-1]


def test_single_prediction():
    data = load_data()
    model = train_model(DEFAULT_MODEL, data)
    sample = data.X_test.iloc[0].to_dict()
    result = predict_customer(model, sample, threshold=0.5)
    assert 0.0 <= result["probability"] <= 1.0
    assert result["risk"] in {"Low", "Medium", "High"}


def _run_all():
    print("Running Churn Radar pipeline checks...\n")
    data = load_data()
    print(f"Dataset: {data.n_rows:,} customers · churn rate {data.churn_rate:.1%}\n")
    print("Cross-validated ROC-AUC:")
    for s in compare_models(data):
        print(f"  {s.name:<22} {s.cv_auc_mean:.4f} ± {s.cv_auc_std:.4f}")
    print()
    for fn in [
        test_data_loads_and_cleans,
        test_all_models_beat_auc_floor,
        test_evaluation_is_well_formed,
        test_threshold_changes_recall,
        test_feature_importance_runs,
        test_single_prediction,
    ]:
        fn()
        print(f"  [PASS] {fn.__name__}")
    print("\nAll checks passed. The pipeline works end to end. ✅")


if __name__ == "__main__":
    _run_all()
