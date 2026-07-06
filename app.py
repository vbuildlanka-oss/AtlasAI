"""Churn Radar — a customer-churn prediction & insights studio.

An end-to-end machine-learning app for a real business problem: predict which
telecom customers are about to leave, understand *why*, and score new customers
interactively.

Fully self-contained — the dataset is bundled and models train locally. No API
keys, no database, no external services. Run locally with:  streamlit run app.py
"""
from __future__ import annotations

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import streamlit as st

from src.data import CATEGORICAL_FEATURES, NUMERIC_FEATURES, feature_metadata, load_data
from src.evaluate import (
    compare_models,
    evaluate_model,
    feature_importances,
    predict_customer,
    train_model,
)
from src.pipeline import DEFAULT_MODEL, MODELS

st.set_page_config(
    page_title="Churn Radar — ML Studio",
    page_icon="📡",
    layout="wide",
    initial_sidebar_state="expanded",
)

PRIMARY = "#5b8cff"
CHURN_C = "#ff6b6b"
STAY_C = "#3fce8f"


# --------------------------------------------------------------------------- #
# Cached compute
# --------------------------------------------------------------------------- #
@st.cache_data(show_spinner=False)
def get_data():
    return load_data()


@st.cache_data(show_spinner=False)
def get_comparison():
    return compare_models(get_data())


@st.cache_resource(show_spinner=False)
def get_model(name: str):
    return train_model(name, get_data())


@st.cache_data(show_spinner=False)
def get_importances(name: str):
    return feature_importances(get_model(name), get_data())


data = get_data()
meta = feature_metadata(data.X)


# --------------------------------------------------------------------------- #
# Sidebar
# --------------------------------------------------------------------------- #
with st.sidebar:
    st.title("📡 Churn Radar")
    st.caption("Predict and explain customer churn.")
    model_name = st.selectbox(
        "Model",
        list(MODELS.keys()),
        index=list(MODELS.keys()).index(DEFAULT_MODEL),
        key="model_select",
    )
    threshold = st.slider(
        "Decision threshold",
        0.05,
        0.95,
        0.50,
        0.01,
        key="threshold",
        help="A customer is flagged as 'will churn' when their predicted "
        "probability is above this value. Lower it to catch more churners "
        "(higher recall); raise it to reduce false alarms (higher precision).",
    )
    st.divider()
    st.markdown(
        "**100% self-contained**\n\nBundled dataset, models trained locally. "
        "No API keys, no database — nothing external to fail."
    )

with st.spinner(f"Training {model_name}…"):
    model = get_model(model_name)
ev = evaluate_model(model, data, threshold=threshold)


# --------------------------------------------------------------------------- #
# Header
# --------------------------------------------------------------------------- #
st.title("📡 Churn Radar")
st.markdown("#### Predicting which customers will leave — and showing why.")

tab_home, tab_eda, tab_models, tab_explain, tab_predict = st.tabs(
    ["🏠 Overview", "📊 Data & Insights", "🤖 Models & Evaluation", "🔍 What Drives Churn", "🔮 Predict a Customer"]
)


# --------------------------------------------------------------------------- #
# Overview
# --------------------------------------------------------------------------- #
with tab_home:
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Customers", f"{data.n_rows:,}")
    c2.metric("Churn rate", f"{data.churn_rate:.1%}")
    c3.metric("Features", len(NUMERIC_FEATURES) + len(CATEGORICAL_FEATURES))
    c4.metric(f"{model_name} ROC-AUC", f"{ev.roc_auc:.3f}")

    st.markdown(
        """
### The business problem
Keeping an existing customer is far cheaper than winning a new one. **Churn
Radar** learns the patterns behind customers who leave, so a retention team can
step in *before* they go — and understand which levers matter most.

### What this project demonstrates
- **A real, messy dataset** — cleaned and prepared with a reproducible pipeline.
- **A proper scikit-learn `Pipeline`** — imputation, scaling, and one-hot
  encoding are bundled with the model, so training and prediction are identical.
- **Honest evaluation for imbalanced data** — models are compared with
  cross-validated **ROC-AUC**, and reported with precision/recall, not just
  accuracy (which is misleading when only ~1 in 4 customers churn).
- **An adjustable decision threshold** — trade off catching more churners
  (recall) against fewer false alarms (precision), a real business decision.
- **Explainability** — permutation importance reveals what actually drives the
  predictions.
- **A live predictor** — score any customer profile in real time.

### Tech stack
`Python` · `scikit-learn` · `pandas` · `Streamlit` · `matplotlib`
        """
    )
    st.info("Use the **Model** and **Decision threshold** controls in the sidebar — every tab updates live.")


# --------------------------------------------------------------------------- #
# Data & insights (EDA)
# --------------------------------------------------------------------------- #
def churn_rate_by(col: str) -> pd.Series:
    return data.df.groupby(col)["Churn"].mean().sort_values(ascending=False)


with tab_eda:
    st.subheader("Who churns, and by how much?")
    st.caption("Share of customers in each group who left. Taller bars = higher churn risk.")

    a, b = st.columns(2)
    with a:
        st.markdown("**Churn rate by contract type**")
        st.bar_chart(churn_rate_by("Contract"), color=CHURN_C, height=280)
        st.caption("Month-to-month customers churn far more than those on longer contracts.")
    with b:
        st.markdown("**Churn rate by internet service**")
        st.bar_chart(churn_rate_by("InternetService"), color=CHURN_C, height=280)
        st.caption("Fibre-optic customers churn more — often a price/expectation signal.")

    st.divider()
    c, d = st.columns(2)
    with c:
        st.markdown("**Tenure vs. churn**")
        tmp = data.df.copy()
        tmp["tenure_group"] = pd.cut(
            tmp["tenure"], bins=[0, 6, 12, 24, 48, 72],
            labels=["0-6m", "6-12m", "1-2y", "2-4y", "4-6y"], include_lowest=True,
        )
        st.bar_chart(tmp.groupby("tenure_group", observed=True)["Churn"].mean(), color=PRIMARY, height=280)
        st.caption("New customers are the flight risk; loyalty grows with tenure.")
    with d:
        st.markdown("**Monthly charges: churned vs. stayed**")
        fig, ax = plt.subplots(figsize=(5, 3.2))
        ax.hist(data.df[data.df.Churn == 0]["MonthlyCharges"], bins=30, alpha=0.7, label="Stayed", color=STAY_C)
        ax.hist(data.df[data.df.Churn == 1]["MonthlyCharges"], bins=30, alpha=0.7, label="Churned", color=CHURN_C)
        ax.set_xlabel("Monthly charges ($)")
        ax.set_ylabel("Customers")
        ax.legend()
        fig.tight_layout()
        st.pyplot(fig)
        plt.close(fig)
        st.caption("Churn skews toward higher monthly bills.")

    with st.expander("Peek at the raw data"):
        st.dataframe(data.df.head(50))


# --------------------------------------------------------------------------- #
# Models & evaluation
# --------------------------------------------------------------------------- #
with tab_models:
    st.subheader("Model comparison")
    st.caption("5-fold cross-validated ROC-AUC on the training data (higher is better).")
    comparison = get_comparison()
    comp_df = pd.DataFrame(
        {"model": [s.name for s in comparison], "cv_roc_auc": [s.cv_auc_mean for s in comparison]}
    ).set_index("model")
    st.bar_chart(comp_df, color=PRIMARY, height=240)

    st.divider()
    st.subheader(f"{model_name} — held-out test performance")
    st.caption(f"Evaluated on unseen customers at a decision threshold of **{threshold:.2f}**.")
    m1, m2, m3, m4, m5 = st.columns(5)
    m1.metric("ROC-AUC", f"{ev.roc_auc:.3f}")
    m2.metric("Accuracy", f"{ev.accuracy:.1%}")
    m3.metric("Precision", f"{ev.precision:.1%}", help="Of those flagged as churners, how many actually churned.")
    m4.metric("Recall", f"{ev.recall:.1%}", help="Of all real churners, how many we caught.")
    m5.metric("F1", f"{ev.f1:.3f}")

    left, right = st.columns(2)
    with left:
        st.markdown("**ROC curve**")
        fig, ax = plt.subplots(figsize=(5, 4))
        ax.plot(ev.fpr, ev.tpr, color=PRIMARY, lw=2, label=f"AUC = {ev.roc_auc:.3f}")
        ax.plot([0, 1], [0, 1], "--", color="gray", lw=1, label="Random")
        ax.set_xlabel("False positive rate")
        ax.set_ylabel("True positive rate")
        ax.legend(loc="lower right")
        fig.tight_layout()
        st.pyplot(fig)
        plt.close(fig)
    with right:
        st.markdown("**Confusion matrix** (at current threshold)")
        cm = ev.confusion
        fig, ax = plt.subplots(figsize=(5, 4))
        im = ax.imshow(cm, cmap="Blues")
        labels = ["Stay", "Churn"]
        ax.set_xticks([0, 1], labels)
        ax.set_yticks([0, 1], labels)
        ax.set_xlabel("Predicted")
        ax.set_ylabel("Actual")
        thresh = cm.max() / 2
        for i in range(2):
            for j in range(2):
                ax.text(j, i, f"{cm[i, j]:,}", ha="center", va="center",
                        color="white" if cm[i, j] > thresh else "black")
        fig.tight_layout()
        st.pyplot(fig)
        plt.close(fig)
    st.caption(
        "Lower the threshold in the sidebar to catch more churners (recall ↑, precision ↓); "
        "raise it to reduce false alarms."
    )


# --------------------------------------------------------------------------- #
# Explainability
# --------------------------------------------------------------------------- #
with tab_explain:
    st.subheader("What drives the model's churn predictions?")
    st.caption(
        "Permutation importance: how much test ROC-AUC drops when each feature is "
        "randomly shuffled. Bigger drop = more important to the prediction."
    )
    with st.spinner("Computing feature importance…"):
        imp = get_importances(model_name).head(12).iloc[::-1]

    fig, ax = plt.subplots(figsize=(7, 5))
    ax.barh(imp["feature"], imp["importance"], xerr=imp["std"], color=PRIMARY)
    ax.set_xlabel("Drop in ROC-AUC when shuffled")
    fig.tight_layout()
    st.pyplot(fig)
    plt.close(fig)
    st.caption(
        "Typically **contract type, tenure, and charges** dominate — the same "
        "signals visible in the Data & Insights tab, now confirmed by the model."
    )


# --------------------------------------------------------------------------- #
# Predict
# --------------------------------------------------------------------------- #
with tab_predict:
    st.subheader("Score a customer")
    st.caption("Fill in a customer profile and get their churn probability in real time.")

    inputs: dict = {}
    with st.form("customer"):
        cols = st.columns(3)
        # Numeric inputs (SeniorCitizen shown as Yes/No).
        with cols[0]:
            inputs["tenure"] = st.slider("Tenure (months)", 0, 72, 12)
            inputs["MonthlyCharges"] = st.slider(
                "Monthly charges ($)",
                float(meta["MonthlyCharges"]["min"]),
                float(meta["MonthlyCharges"]["max"]),
                float(meta["MonthlyCharges"]["median"]),
            )
            inputs["TotalCharges"] = st.number_input(
                "Total charges ($)", min_value=0.0,
                value=float(meta["TotalCharges"]["median"]),
            )
            inputs["SeniorCitizen"] = 1 if st.selectbox("Senior citizen", ["No", "Yes"]) == "Yes" else 0

        # Categorical inputs split across the remaining columns.
        cat_cols = CATEGORICAL_FEATURES
        half = (len(cat_cols) + 1) // 2
        with cols[1]:
            for c in cat_cols[:half]:
                inputs[c] = st.selectbox(c, meta[c]["choices"])
        with cols[2]:
            for c in cat_cols[half:]:
                inputs[c] = st.selectbox(c, meta[c]["choices"])

        submitted = st.form_submit_button("🔮 Predict churn", type="primary")

    if submitted:
        result = predict_customer(model, inputs, threshold=threshold)
        p = result["probability"]
        r1, r2 = st.columns([1, 1.4])
        with r1:
            st.metric("Churn probability", f"{p:.1%}")
            st.metric("Risk level", result["risk"])
        with r2:
            if result["will_churn"]:
                st.error(
                    f"⚠️ **Likely to churn** (probability {p:.1%} ≥ threshold {threshold:.2f}). "
                    "A retention offer may be worthwhile."
                )
            else:
                st.success(
                    f"✅ **Likely to stay** (probability {p:.1%} < threshold {threshold:.2f})."
                )
            st.progress(min(max(p, 0.0), 1.0))
        st.caption("Adjust the decision threshold in the sidebar to change the flagging cut-off.")


st.markdown("---")
st.caption("Churn Radar · scikit-learn + Streamlit · self-contained, no API keys required.")
