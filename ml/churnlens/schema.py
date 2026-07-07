"""Single source of truth for the feature schema.

Both the Python training pipeline and (indirectly, via the exported JSON
artifact) the TypeScript inference layer rely on these definitions, so the
model that is trained is exactly the model that is served -- no train/serve
skew.
"""
from __future__ import annotations

# --- Add-on services: presence of each is a churn signal -------------------
ADDON_SERVICES = [
    "OnlineSecurity",
    "OnlineBackup",
    "DeviceProtection",
    "TechSupport",
    "StreamingTV",
    "StreamingMovies",
]

# --- Model input features --------------------------------------------------
# Numeric features fed to the model (StandardScaler-normalised).
NUMERIC_FEATURES = ["tenure", "MonthlyCharges", "num_addon_services"]

# Categorical features (one-hot encoded).
CATEGORICAL_FEATURES = [
    "gender",
    "SeniorCitizen",
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

TARGET = "Churn"

# Human-friendly labels + UI grouping for the interactive frontend.
FEATURE_LABELS = {
    "tenure": "Tenure (months)",
    "MonthlyCharges": "Monthly charges ($)",
    "num_addon_services": "Add-on services",
    "gender": "Gender",
    "SeniorCitizen": "Senior citizen",
    "Partner": "Has partner",
    "Dependents": "Has dependents",
    "PhoneService": "Phone service",
    "MultipleLines": "Multiple lines",
    "InternetService": "Internet service",
    "OnlineSecurity": "Online security",
    "OnlineBackup": "Online backup",
    "DeviceProtection": "Device protection",
    "TechSupport": "Tech support",
    "StreamingTV": "Streaming TV",
    "StreamingMovies": "Streaming movies",
    "Contract": "Contract type",
    "PaperlessBilling": "Paperless billing",
    "PaymentMethod": "Payment method",
}


def add_engineered_features(df):
    """Add derived features. Kept deliberately simple + deterministic so the
    exact same logic can be reproduced client-side in TypeScript."""
    df = df.copy()
    df["num_addon_services"] = (
        df[ADDON_SERVICES].apply(lambda s: (s == "Yes").astype(int)).sum(axis=1)
    )
    return df
