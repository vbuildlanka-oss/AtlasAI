"""Data loading, cleaning, and train/test splitting for the churn dataset.

The dataset (IBM Telco Customer Churn) is bundled in ``data/telco_churn.csv`` so
the app never needs to download anything at runtime — it works fully offline.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "telco_churn.csv"

TARGET = "Churn"
DROP_COLUMNS = ["customerID"]

NUMERIC_FEATURES = ["tenure", "MonthlyCharges", "TotalCharges", "SeniorCitizen"]
CATEGORICAL_FEATURES = [
    "gender",
    "Partner",
    "Dependents",
    "PhoneService",
    "MultipleLines",
    "InternetService",
    "OnlineSecurity",
    "OnlineBackup",
    "DeviceProtection",
    "TechSupport",
    "StreamingTV",
    "StreamingMovies",
    "Contract",
    "PaperlessBilling",
    "PaymentMethod",
]
FEATURES = NUMERIC_FEATURES + CATEGORICAL_FEATURES

RANDOM_STATE = 42
TEST_SIZE = 0.2


@dataclass
class ChurnData:
    """Everything the app and models need, in one place."""

    df: pd.DataFrame          # full cleaned frame (for EDA), includes target
    X: pd.DataFrame           # feature matrix
    y: pd.Series              # target (1 = churned)
    X_train: pd.DataFrame
    X_test: pd.DataFrame
    y_train: pd.Series
    y_test: pd.Series

    @property
    def churn_rate(self) -> float:
        return float(self.y.mean())

    @property
    def n_rows(self) -> int:
        return len(self.df)


def load_clean_frame() -> pd.DataFrame:
    """Load the CSV and apply the handful of well-known cleaning steps."""
    df = pd.read_csv(DATA_PATH)

    # `TotalCharges` arrives as text and has 11 blank values (brand-new customers
    # with tenure 0). Coerce to numeric; blanks become NaN and are imputed later.
    df["TotalCharges"] = pd.to_numeric(df["TotalCharges"], errors="coerce")

    # Target -> binary.
    df[TARGET] = (df[TARGET].astype(str).str.strip().str.lower() == "yes").astype(int)

    df = df.drop(columns=[c for c in DROP_COLUMNS if c in df.columns])
    return df


def load_data(test_size: float = TEST_SIZE, seed: int = RANDOM_STATE) -> ChurnData:
    """Return a cleaned dataset with a reproducible, stratified train/test split."""
    df = load_clean_frame()
    X = df[FEATURES].copy()
    y = df[TARGET].copy()

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=seed, stratify=y
    )
    return ChurnData(
        df=df, X=X, y=y,
        X_train=X_train, X_test=X_test, y_train=y_train, y_test=y_test,
    )


def feature_metadata(X: pd.DataFrame) -> dict[str, dict]:
    """Describe each feature so the UI can build sensible input widgets.

    Numeric -> min / max / median. Categorical -> the list of allowed values.
    """
    meta: dict[str, dict] = {}
    for col in NUMERIC_FEATURES:
        series = pd.to_numeric(X[col], errors="coerce")
        meta[col] = {
            "kind": "numeric",
            "min": float(np.nanmin(series)),
            "max": float(np.nanmax(series)),
            "median": float(np.nanmedian(series)),
        }
    for col in CATEGORICAL_FEATURES:
        meta[col] = {"kind": "categorical", "choices": sorted(X[col].dropna().unique().tolist())}
    return meta
