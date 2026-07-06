"""Dataset loading and helpers.

Uses scikit-learn's built-in *digits* dataset (8x8 grayscale images of the
handwritten digits 0-9). It ships inside the scikit-learn package, so there is
no download, no API key, and no network access required — the app works fully
offline and can never fail due to an external service being down.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from sklearn.datasets import load_digits
from sklearn.model_selection import train_test_split

RANDOM_STATE = 42
TEST_SIZE = 0.2


@dataclass
class Dataset:
    """A train/test split plus the raw images for display."""

    X_train: np.ndarray
    X_test: np.ndarray
    y_train: np.ndarray
    y_test: np.ndarray
    images_test: np.ndarray  # 8x8 image for each test row (for the UI)
    feature_names: list[str]
    target_names: list[str]

    @property
    def n_samples(self) -> int:
        return len(self.X_train) + len(self.X_test)

    @property
    def n_features(self) -> int:
        return self.X_train.shape[1]

    @property
    def n_classes(self) -> int:
        return len(self.target_names)


def load_dataset(test_size: float = TEST_SIZE, seed: int = RANDOM_STATE) -> Dataset:
    """Load the digits dataset and return a reproducible train/test split."""
    digits = load_digits()
    X = digits.data            # shape (1797, 64), pixel values 0..16
    y = digits.target          # shape (1797,), labels 0..9
    images = digits.images     # shape (1797, 8, 8)

    indices = np.arange(len(X))
    (
        X_train,
        X_test,
        y_train,
        y_test,
        _idx_train,
        idx_test,
    ) = train_test_split(
        X, y, indices, test_size=test_size, random_state=seed, stratify=y
    )

    return Dataset(
        X_train=X_train,
        X_test=X_test,
        y_train=y_train,
        y_test=y_test,
        images_test=images[idx_test],
        feature_names=[f"pixel_{r}_{c}" for r in range(8) for c in range(8)],
        target_names=[str(d) for d in range(10)],
    )
