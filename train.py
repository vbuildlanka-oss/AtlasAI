"""Offline training + hyperparameter tuning CLI.

Demonstrates the "tune offline, deploy fixed" workflow: this script searches for
good hyperparameters and reports held-out performance. The Streamlit app itself
trains quickly with sensible fixed settings (cached), so it never has to run a
slow search on a cold start.

Usage:
    python train.py                 # compare models + tune the best, print a report
    python train.py --save          # also persist the fitted pipeline to models/
"""
from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from scipy.stats import loguniform, randint
from sklearn.model_selection import RandomizedSearchCV

from src.data import load_data
from src.evaluate import compare_models, evaluate_model, train_model
from src.pipeline import build_pipeline

SEARCH_SPACES = {
    "Gradient Boosting": {
        "classifier__learning_rate": loguniform(0.01, 0.3),
        "classifier__max_iter": randint(150, 500),
        "classifier__max_leaf_nodes": randint(15, 63),
        "classifier__l2_regularization": loguniform(1e-6, 1.0),
    },
    "Random Forest": {
        "classifier__n_estimators": randint(200, 600),
        "classifier__max_depth": randint(4, 20),
        "classifier__min_samples_leaf": randint(1, 20),
    },
    "Logistic Regression": {
        "classifier__C": loguniform(1e-3, 1e2),
    },
}


def main() -> None:
    parser = argparse.ArgumentParser(description="Train + tune the churn model.")
    parser.add_argument("--save", action="store_true", help="Persist the fitted pipeline.")
    parser.add_argument("--n-iter", type=int, default=25, help="RandomizedSearch iterations.")
    args = parser.parse_args()

    data = load_data()
    print(f"Loaded {data.n_rows:,} customers · churn rate {data.churn_rate:.1%}\n")

    print("Cross-validated ROC-AUC by model:")
    ranking = compare_models(data)
    for s in ranking:
        print(f"  {s.name:<22} {s.cv_auc_mean:.4f} ± {s.cv_auc_std:.4f}")
    best_name = ranking[0].name
    print(f"\nBest base model: {best_name}\n")

    space = SEARCH_SPACES.get(best_name)
    if space:
        print(f"Tuning {best_name} with {args.n_iter} random configurations...")
        search = RandomizedSearchCV(
            build_pipeline(best_name),
            param_distributions=space,
            n_iter=args.n_iter,
            scoring="roc_auc",
            cv=5,
            random_state=42,
            n_jobs=-1,
        )
        search.fit(data.X_train, data.y_train)
        print(f"  best CV ROC-AUC: {search.best_score_:.4f}")
        print(f"  best params: {search.best_params_}")
        best_pipe = search.best_estimator_
    else:
        best_pipe = train_model(best_name, data)

    ev = evaluate_model(best_pipe, data, threshold=0.5)
    print("\nHeld-out test performance (threshold 0.5):")
    print(f"  ROC-AUC   {ev.roc_auc:.4f}")
    print(f"  Accuracy  {ev.accuracy:.4f}")
    print(f"  Precision {ev.precision:.4f}")
    print(f"  Recall    {ev.recall:.4f}")
    print(f"  F1        {ev.f1:.4f}")

    if args.save:
        import joblib

        out = Path(__file__).resolve().parent / "models"
        out.mkdir(exist_ok=True)
        path = out / "churn_model.joblib"
        joblib.dump(best_pipe, path)
        print(f"\nSaved fitted pipeline -> {path}")


if __name__ == "__main__":
    main()
