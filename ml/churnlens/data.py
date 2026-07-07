"""Data loading.

Strategy:
1. Try to download the public IBM "Telco Customer Churn" dataset (free, no
   auth) from a couple of well-known mirrors, and cache it locally.
2. If the machine is offline, deterministically generate a realistic
   synthetic dataset with the *same schema* and plausible churn dynamics so
   the pipeline always runs end-to-end.
"""
from __future__ import annotations

import io
import urllib.request
from pathlib import Path

import numpy as np
import pandas as pd

from .schema import ADDON_SERVICES

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
CACHE = DATA_DIR / "telco_churn.csv"

MIRRORS = [
    "https://raw.githubusercontent.com/IBM/telco-customer-churn-on-icp4d/master/data/Telco-Customer-Churn.csv",
    "https://raw.githubusercontent.com/treselle-systems/customer_churn_analysis/master/WA_Fn-UseC_-Telco-Customer-Churn.csv",
]

EXPECTED_COLUMNS = {
    "gender", "SeniorCitizen", "Partner", "Dependents", "tenure",
    "PhoneService", "MultipleLines", "InternetService", "OnlineSecurity",
    "OnlineBackup", "DeviceProtection", "TechSupport", "StreamingTV",
    "StreamingMovies", "Contract", "PaperlessBilling", "PaymentMethod",
    "MonthlyCharges", "TotalCharges", "Churn",
}


def _try_download() -> pd.DataFrame | None:
    for url in MIRRORS:
        try:
            with urllib.request.urlopen(url, timeout=20) as resp:
                raw = resp.read().decode("utf-8")
            df = pd.read_csv(io.StringIO(raw))
            if EXPECTED_COLUMNS.issubset(set(df.columns)):
                print(f"[data] downloaded real dataset from {url} ({len(df)} rows)")
                return df
        except Exception as exc:  # noqa: BLE001
            print(f"[data] mirror failed ({url}): {exc}")
    return None


def _synthesize(n: int = 7043, seed: int = 42) -> pd.DataFrame:
    """Generate a realistic Telco-shaped dataset with genuine churn signal."""
    rng = np.random.default_rng(seed)

    def pick(options, p=None):
        return rng.choice(options, size=n, p=p)

    contract = pick(["Month-to-month", "One year", "Two year"], [0.55, 0.21, 0.24])
    internet = pick(["Fiber optic", "DSL", "No"], [0.44, 0.34, 0.22])
    tenure = np.clip(rng.gamma(2.0, 16.0, n).astype(int), 0, 72)
    monthly = np.clip(rng.normal(65, 30, n), 18.5, 120).round(2)

    def svc(has_internet_p_yes):
        out = np.where(
            internet == "No",
            "No internet service",
            np.where(rng.random(n) < has_internet_p_yes, "Yes", "No"),
        )
        return out

    df = pd.DataFrame({
        "customerID": [f"{i:04d}-SYNTH" for i in range(n)],
        "gender": pick(["Male", "Female"]),
        "SeniorCitizen": pick([0, 1], [0.84, 0.16]),
        "Partner": pick(["Yes", "No"]),
        "Dependents": pick(["Yes", "No"], [0.3, 0.7]),
        "tenure": tenure,
        "PhoneService": pick(["Yes", "No"], [0.9, 0.1]),
        "InternetService": internet,
        "OnlineSecurity": svc(0.4),
        "OnlineBackup": svc(0.44),
        "DeviceProtection": svc(0.44),
        "TechSupport": svc(0.4),
        "StreamingTV": svc(0.5),
        "StreamingMovies": svc(0.5),
        "Contract": contract,
        "PaperlessBilling": pick(["Yes", "No"], [0.59, 0.41]),
        "PaymentMethod": pick([
            "Electronic check", "Mailed check",
            "Bank transfer (automatic)", "Credit card (automatic)",
        ], [0.34, 0.23, 0.22, 0.21]),
        "MonthlyCharges": monthly,
    })
    df["MultipleLines"] = np.where(
        df["PhoneService"] == "No", "No phone service",
        np.where(rng.random(n) < 0.42, "Yes", "No"),
    )
    df["TotalCharges"] = (df["tenure"] * df["MonthlyCharges"]).round(2)

    # ---- Churn as a logistic function of realistic drivers ----------------
    z = -1.6
    z = z + 0.9 * (contract == "Month-to-month")
    z = z - 0.9 * (contract == "Two year")
    z = z + 0.7 * (internet == "Fiber optic")
    z = z + 0.6 * (df["PaymentMethod"] == "Electronic check").to_numpy()
    z = z - 0.03 * tenure
    z = z + 0.012 * (monthly - 65)
    z = z - 0.35 * (df["TechSupport"] == "Yes").to_numpy()
    z = z - 0.25 * (df["OnlineSecurity"] == "Yes").to_numpy()
    z = z + 0.25 * (df["SeniorCitizen"] == 1)
    z = z + 0.20 * (df["PaperlessBilling"] == "Yes").to_numpy()
    z = z - 0.15 * (df["Partner"] == "Yes").to_numpy()
    z = z + rng.normal(0, 0.4, n)  # irreducible noise
    p = 1 / (1 + np.exp(-z))
    df["Churn"] = np.where(rng.random(n) < p, "Yes", "No")
    print(f"[data] generated synthetic dataset ({n} rows, "
          f"{(df['Churn'] == 'Yes').mean():.1%} churn)")
    return df


def load_raw(force_synthetic: bool = False) -> pd.DataFrame:
    if CACHE.exists() and not force_synthetic:
        print(f"[data] using cached dataset {CACHE}")
        return pd.read_csv(CACHE)

    df = None if force_synthetic else _try_download()
    if df is None:
        df = _synthesize()

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    df.to_csv(CACHE, index=False)
    return df


def clean(df: pd.DataFrame) -> pd.DataFrame:
    """Normalise types + handle the well-known blank TotalCharges rows."""
    df = df.copy()
    # SeniorCitizen -> Yes/No so it is treated as categorical everywhere.
    if df["SeniorCitizen"].dtype != object:
        df["SeniorCitizen"] = df["SeniorCitizen"].map({0: "No", 1: "Yes"}).fillna("No")
    df["TotalCharges"] = pd.to_numeric(df["TotalCharges"], errors="coerce")
    df["TotalCharges"] = df["TotalCharges"].fillna(df["tenure"] * df["MonthlyCharges"])
    df["Churn"] = df["Churn"].astype(str).str.strip()
    # Guard against unexpected label spellings.
    df = df[df["Churn"].isin(["Yes", "No"])].reset_index(drop=True)
    return df
