"""Digit Vision — an interactive handwritten-digit recognition studio.

A fully self-contained machine-learning web app:
  * trains classic scikit-learn classifiers on the built-in digits dataset,
  * compares their accuracy, and
  * lets you watch a model classify individual digits in real time.

No API keys, no database, no external services — it runs entirely offline.
Run locally with:  streamlit run app.py
"""
from __future__ import annotations

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import streamlit as st

from src.data import load_dataset
from src.model import (
    DEFAULT_MODEL,
    MODEL_BUILDERS,
    misclassified_indices,
    predict_one,
    train_model,
)

# --------------------------------------------------------------------------- #
# Page setup
# --------------------------------------------------------------------------- #
st.set_page_config(
    page_title="Digit Vision — ML Studio",
    page_icon="✏️",
    layout="wide",
    initial_sidebar_state="expanded",
)


# --------------------------------------------------------------------------- #
# Cached compute (runs once, then reused across interactions)
# --------------------------------------------------------------------------- #
@st.cache_data(show_spinner=False)
def get_data():
    return load_dataset()


@st.cache_resource(show_spinner=False)
def get_model(name: str):
    return train_model(name, get_data())


def digit_figure(image: np.ndarray, size: float = 2.2):
    """Render a single 8x8 digit image."""
    fig, ax = plt.subplots(figsize=(size, size))
    ax.imshow(image, cmap="gray_r", interpolation="nearest")
    ax.set_xticks([])
    ax.set_yticks([])
    fig.tight_layout(pad=0)
    return fig


def confusion_figure(matrix: np.ndarray, labels: list[str]):
    fig, ax = plt.subplots(figsize=(6, 5))
    im = ax.imshow(matrix, cmap="Blues")
    ax.set_xticks(range(len(labels)), labels)
    ax.set_yticks(range(len(labels)), labels)
    ax.set_xlabel("Predicted")
    ax.set_ylabel("Actual")
    # Annotate each cell.
    thresh = matrix.max() / 2.0
    for i in range(matrix.shape[0]):
        for j in range(matrix.shape[1]):
            ax.text(
                j,
                i,
                int(matrix[i, j]),
                ha="center",
                va="center",
                color="white" if matrix[i, j] > thresh else "black",
                fontsize=8,
            )
    fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
    fig.tight_layout()
    return fig


# --------------------------------------------------------------------------- #
# Sidebar
# --------------------------------------------------------------------------- #
data = get_data()

with st.sidebar:
    st.title("✏️ Digit Vision")
    st.caption("Handwritten-digit recognition, powered by scikit-learn.")
    model_name = st.selectbox(
        "Choose a model",
        list(MODEL_BUILDERS.keys()),
        index=list(MODEL_BUILDERS.keys()).index(DEFAULT_MODEL),
        help="Each model is trained live on the digits dataset.",
    )
    st.divider()
    st.markdown(
        "**100% self-contained**\n\n"
        "No API keys, no database, no internet needed — the model trains "
        "right here on a dataset that ships with scikit-learn."
    )

with st.spinner(f"Training {model_name}…"):
    model = get_model(model_name)


# --------------------------------------------------------------------------- #
# Header
# --------------------------------------------------------------------------- #
st.title("✏️ Digit Vision")
st.markdown(
    "#### Teaching a computer to read handwritten numbers — and showing its work."
)

tab_overview, tab_data, tab_perf, tab_try = st.tabs(
    ["🏠 Overview", "📊 Explore the Data", "🤖 Model & Performance", "🔮 Try It Live"]
)


# --------------------------------------------------------------------------- #
# Overview
# --------------------------------------------------------------------------- #
with tab_overview:
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Images", f"{data.n_samples:,}")
    c2.metric("Pixels / image", data.n_features)
    c3.metric("Digit classes", data.n_classes)
    c4.metric(f"{model_name} accuracy", f"{model.accuracy:.1%}")

    st.markdown(
        """
### What is this?
**Digit Vision** trains a machine-learning model to recognise handwritten
digits (0–9) from tiny 8×8 pixel images, then lets you explore how well it
works and watch it make predictions one digit at a time.

### How it works
1. **Data** — 1,797 labelled digit images that ship with scikit-learn.
2. **Train** — a classifier learns the pixel patterns that distinguish each digit.
3. **Evaluate** — we measure accuracy on images the model has never seen.
4. **Predict** — feed it a new digit and it tells you what it sees, with its confidence.

### Why it's reliable
- **No API keys and no database.** The dataset is bundled with the library, so
  there is nothing to configure and nothing external that can fail.
- **Reproducible.** A fixed random seed means the same results every run.

### Tech stack
`Python` · `scikit-learn` · `Streamlit` · `pandas` · `matplotlib`
        """
    )
    st.info("Pick a model in the left sidebar, then open **Try It Live** to see it in action.")


# --------------------------------------------------------------------------- #
# Explore the data
# --------------------------------------------------------------------------- #
with tab_data:
    st.subheader("A look at the raw images")
    st.write(
        "Each sample is an 8×8 grid of pixel intensities. Here is one example "
        "of every digit from 0 to 9:"
    )

    # One example image per class (0-9).
    cols = st.columns(10)
    for digit in range(10):
        idx = int(np.where(data.y_test == digit)[0][0])
        with cols[digit]:
            st.pyplot(digit_figure(data.images_test[idx], size=1.1))
            st.caption(f"“{digit}”")

    st.divider()
    left, right = st.columns([1, 1])
    with left:
        st.subheader("How many of each digit?")
        counts = pd.Series(
            np.concatenate([data.y_train, data.y_test])
        ).value_counts().sort_index()
        counts.index = [str(i) for i in counts.index]
        st.bar_chart(counts, height=300)
        st.caption("The dataset is well balanced across all ten digits.")
    with right:
        st.subheader("Dataset at a glance")
        st.dataframe(
            pd.DataFrame(
                {
                    "Property": [
                        "Total images",
                        "Training images",
                        "Test images",
                        "Pixels per image",
                        "Pixel value range",
                        "Classes",
                    ],
                    "Value": [
                        f"{data.n_samples:,}",
                        f"{len(data.X_train):,}",
                        f"{len(data.X_test):,}",
                        "64 (8×8)",
                        "0 – 16 (grayscale)",
                        "10 (digits 0–9)",
                    ],
                }
            ),
            hide_index=True,
        )


# --------------------------------------------------------------------------- #
# Model & performance
# --------------------------------------------------------------------------- #
with tab_perf:
    st.subheader(f"How well does **{model_name}** do?")
    m1, m2, m3 = st.columns(3)
    m1.metric("Test accuracy", f"{model.accuracy:.2%}")
    m2.metric("5-fold CV accuracy", f"{model.cv_mean:.2%}", f"± {model.cv_std:.2%}")
    m3.metric("Test errors", f"{int(round(model.error_rate * len(data.y_test)))} / {len(data.y_test)}")

    st.divider()
    left, right = st.columns([1.1, 1])
    with left:
        st.subheader("Confusion matrix")
        st.caption("Rows = the true digit, columns = what the model guessed. A strong diagonal is good.")
        st.pyplot(confusion_figure(model.confusion, data.target_names))
    with right:
        st.subheader("Per-digit scores")
        report_df = pd.DataFrame(model.report).transpose()
        per_class = report_df.loc[data.target_names, ["precision", "recall", "f1-score"]]
        per_class.index.name = "digit"
        st.dataframe(
            per_class.style.format("{:.2f}").background_gradient(cmap="Greens", axis=None),
            height=400,
        )
        st.caption("Precision, recall, and F1-score for each digit (1.00 is perfect).")


# --------------------------------------------------------------------------- #
# Try it live
# --------------------------------------------------------------------------- #
with tab_try:
    st.subheader("Watch the model classify a digit")
    st.write(
        "Pick a test image (one the model was **not** trained on) and see its "
        "prediction, along with how confident it is."
    )

    if "sample_idx" not in st.session_state:
        st.session_state.sample_idx = 0

    controls = st.columns([1, 2])
    with controls[0]:
        if st.button("🎲 Random digit"):
            st.session_state.sample_idx = int(np.random.randint(len(data.y_test)))
    with controls[1]:
        st.session_state.sample_idx = st.slider(
            "…or choose a test image by index",
            0,
            len(data.y_test) - 1,
            st.session_state.sample_idx,
        )

    idx = st.session_state.sample_idx
    result = predict_one(model, data.X_test[idx])
    actual = int(data.y_test[idx])
    correct = result["label"] == actual

    show_l, show_r = st.columns([1, 1.4])
    with show_l:
        st.pyplot(digit_figure(data.images_test[idx], size=2.6))
    with show_r:
        p1, p2 = st.columns(2)
        p1.metric("Model predicts", result["label"])
        p2.metric("Actual answer", actual)
        if correct:
            st.success(f"✅ Correct — the model is {result['confidence']:.1%} confident.")
        else:
            st.error(f"❌ Missed it (predicted {result['label']}, was {actual}).")

        proba_df = pd.DataFrame(
            {"probability": result["probabilities"]},
            index=[str(d) for d in range(10)],
        )
        proba_df.index.name = "digit"
        st.caption("How the model scored each possible digit:")
        st.bar_chart(proba_df, height=220)

    st.divider()
    with st.expander("🔎 Where does the model make mistakes?"):
        wrong = misclassified_indices(model, data)
        if len(wrong) == 0:
            st.write("This model classified every test image correctly. 🎉")
        else:
            st.write(
                f"The model missed **{len(wrong)}** of {len(data.y_test)} test images. "
                "A few examples (its guess vs. the truth):"
            )
            gallery = st.columns(8)
            for slot, w in zip(gallery, wrong[:8]):
                with slot:
                    st.pyplot(digit_figure(data.images_test[w], size=1.0))
                    st.caption(f"saw {int(model.y_pred[w])} · was {int(data.y_test[w])}")


st.markdown("---")
st.caption(
    "Digit Vision · built with scikit-learn + Streamlit · self-contained, no API keys required."
)
