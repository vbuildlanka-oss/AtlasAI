"""End-to-end checks for the Digit Vision ML pipeline.

Runnable two ways:
    python tests/test_pipeline.py     # plain script, prints a report
    pytest                            # if pytest is installed

Proves the project actually works: data loads, every model trains to high
accuracy, predictions are well-formed, and the reproducible split is stable.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

# Make `src` importable no matter where this is run from.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.data import load_dataset
from src.model import MODEL_BUILDERS, misclassified_indices, predict_one, train_model

MIN_ACCURACY = 0.90  # every configured model should clear this on the digits set


def test_dataset_loads_and_splits():
    data = load_dataset()
    assert data.n_features == 64
    assert data.n_classes == 10
    assert data.n_samples == 1797
    # Test images line up with the test labels used for prediction.
    assert len(data.images_test) == len(data.y_test)
    assert data.images_test.shape[1:] == (8, 8)


def test_split_is_reproducible():
    a = load_dataset()
    b = load_dataset()
    assert np.array_equal(a.y_test, b.y_test)


def test_all_models_train_and_are_accurate():
    data = load_dataset()
    for name in MODEL_BUILDERS:
        model = train_model(name, data)
        assert 0.0 <= model.accuracy <= 1.0
        assert model.accuracy >= MIN_ACCURACY, f"{name} only scored {model.accuracy:.3f}"
        assert model.confusion.shape == (10, 10)


def test_prediction_is_well_formed():
    data = load_dataset()
    model = train_model("Support Vector Machine", data)
    result = predict_one(model, data.X_test[0])
    assert result["label"] in range(10)
    assert len(result["probabilities"]) == 10
    # Probabilities form a valid distribution.
    assert abs(float(np.sum(result["probabilities"])) - 1.0) < 1e-6
    assert 0.0 <= result["confidence"] <= 1.0
    # Misclassified indices are valid positions in the test set.
    wrong = misclassified_indices(model, data)
    assert np.all(wrong < len(data.y_test))


def _run_all():
    tests = [
        test_dataset_loads_and_splits,
        test_split_is_reproducible,
        test_all_models_train_and_are_accurate,
        test_prediction_is_well_formed,
    ]
    print("Running Digit Vision pipeline checks...\n")
    data = load_dataset()
    for name in MODEL_BUILDERS:
        m = train_model(name, data)
        print(f"  {name:<26} test accuracy {m.accuracy:6.2%}  (CV {m.cv_mean:.2%} ± {m.cv_std:.2%})")
    print()
    for t in tests:
        t()
        print(f"  [PASS] {t.__name__}")
    print("\nAll checks passed. The pipeline works end to end. ✅")


if __name__ == "__main__":
    _run_all()
