"""Model training, evaluation, and prediction.

Several classic scikit-learn classifiers are offered so the app can compare
them. Everything trains in a couple of seconds on the small digits dataset, so
models are trained on demand (and cached by the Streamlit layer).
"""
from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

import numpy as np
from sklearn.base import ClassifierMixin
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import cross_val_score
from sklearn.neighbors import KNeighborsClassifier
from sklearn.svm import SVC

from .data import Dataset

# Model name -> factory. Each factory returns a fresh, unfitted estimator.
MODEL_BUILDERS: dict[str, Callable[[], ClassifierMixin]] = {
    # No `probability=True`: it's deprecated in scikit-learn 1.9+ and slow.
    # We derive a probability distribution from decision scores in predict_one,
    # which keeps this working across scikit-learn versions.
    "Support Vector Machine": lambda: SVC(kernel="rbf", C=10, gamma=0.001, random_state=42),
    "Random Forest": lambda: RandomForestClassifier(
        n_estimators=300, random_state=42, n_jobs=-1
    ),
    "K-Nearest Neighbors": lambda: KNeighborsClassifier(n_neighbors=3),
    "Logistic Regression": lambda: LogisticRegression(max_iter=5000),
}

DEFAULT_MODEL = "Support Vector Machine"


@dataclass
class TrainedModel:
    """A fitted estimator plus its evaluation on the held-out test set."""

    name: str
    estimator: ClassifierMixin
    accuracy: float
    cv_mean: float
    cv_std: float
    confusion: np.ndarray
    report: dict
    y_pred: np.ndarray

    @property
    def error_rate(self) -> float:
        return 1.0 - self.accuracy


def train_model(name: str, data: Dataset) -> TrainedModel:
    """Fit `name` on the training split and evaluate it on the test split."""
    if name not in MODEL_BUILDERS:
        raise ValueError(f"Unknown model '{name}'. Options: {list(MODEL_BUILDERS)}")

    estimator = MODEL_BUILDERS[name]()
    estimator.fit(data.X_train, data.y_train)

    y_pred = estimator.predict(data.X_test)
    accuracy = accuracy_score(data.y_test, y_pred)

    # 5-fold cross-validation on the training data for a robustness estimate.
    cv_scores = cross_val_score(
        MODEL_BUILDERS[name](), data.X_train, data.y_train, cv=5
    )

    report = classification_report(
        data.y_test, y_pred, target_names=data.target_names, output_dict=True
    )
    confusion = confusion_matrix(data.y_test, y_pred)

    return TrainedModel(
        name=name,
        estimator=estimator,
        accuracy=float(accuracy),
        cv_mean=float(cv_scores.mean()),
        cv_std=float(cv_scores.std()),
        confusion=confusion,
        report=report,
        y_pred=y_pred,
    )


def _class_probabilities(estimator: ClassifierMixin, x: np.ndarray) -> np.ndarray:
    """A per-class probability distribution that works for any estimator.

    Prefers native ``predict_proba`` (Random Forest, KNN, Logistic Regression);
    otherwise turns SVM decision scores into a distribution via softmax; and as
    a last resort returns a one-hot vector for the predicted class.
    """
    if hasattr(estimator, "predict_proba"):
        return np.asarray(estimator.predict_proba(x)[0], dtype=float)

    if hasattr(estimator, "decision_function"):
        scores = np.atleast_2d(estimator.decision_function(x))[0].astype(float)
        scores -= scores.max()  # numerical stability
        exp = np.exp(scores)
        return exp / exp.sum()

    label = int(estimator.predict(x)[0])
    proba = np.zeros(10)
    proba[label] = 1.0
    return proba


def predict_one(model: TrainedModel, features: np.ndarray) -> dict:
    """Predict a single sample. Returns the label and per-class probabilities."""
    x = np.asarray(features, dtype=float).reshape(1, -1)
    label = int(model.estimator.predict(x)[0])
    proba = _class_probabilities(model.estimator, x)

    return {
        "label": label,
        "confidence": float(np.max(proba)),
        "probabilities": proba,
    }


def misclassified_indices(model: TrainedModel, data: Dataset) -> np.ndarray:
    """Indices (into the test set) the model got wrong — useful for the UI."""
    return np.where(model.y_pred != data.y_test)[0]
