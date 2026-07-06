# 📡 Churn Radar — Customer Churn Prediction & Insights

An end-to-end machine-learning app that predicts which telecom customers are
about to cancel, explains **why**, and scores new customers interactively — so a
retention team can act *before* customers leave.

**Fully self-contained: no API keys, no database, no external services.** The
dataset is bundled and models train locally, so it always runs and is trivial to
deploy — a reliable portfolio demo.

> **Tech stack:** Python · scikit-learn · pandas · Streamlit · matplotlib

---

## 🎯 What this project demonstrates

This is built to show real ML-engineering practice, not just a model that fits:

- **Reproducible data pipeline** — a real, slightly messy dataset (7,043
  customers) cleaned and split deterministically.
- **A proper scikit-learn `Pipeline`** — median imputation, scaling, and
  one-hot encoding are bundled *with* the classifier via a `ColumnTransformer`,
  so training and serving apply identical transforms (no train/serve skew).
- **Model selection done right** — Logistic Regression, Random Forest, and
  Gradient Boosting compared by **5-fold cross-validated ROC-AUC**. (A
  well-regularised, class-balanced Logistic Regression wins here — a nice
  reminder that simple, interpretable models are often strong baselines.)
- **Honest metrics for imbalanced data** — only ~26% of customers churn, so the
  app reports **ROC-AUC, precision, and recall**, not just accuracy.
- **An adjustable decision threshold** — a live control to trade recall for
  precision, framed as the business decision it really is.
- **Explainability** — permutation importance shows what actually drives churn.
- **A live predictor** — score any customer profile and get a churn probability.
- **Tests + tooling** — a pipeline test suite, a Streamlit app smoke test, an
  offline hyperparameter-tuning script, and a `Makefile`.

---

## 🖥️ The app (five tabs)

1. **🏠 Overview** — the business problem and headline performance.
2. **📊 Data & Insights** — churn broken down by contract, tenure, service, and
   charges (the drivers you can *see*).
3. **🤖 Models & Evaluation** — cross-validated model comparison, ROC curve,
   confusion matrix, and precision/recall at your chosen threshold.
4. **🔍 What Drives Churn** — permutation-importance ranking of the features.
5. **🔮 Predict a Customer** — an interactive form that returns a churn
   probability and risk level in real time.

---

## 🚀 Run it locally

Requires **Python 3.9+**.

```bash
pip install -r requirements.txt
streamlit run app.py
```

Then open the URL it prints (usually http://localhost:8501).

Handy shortcuts via the `Makefile`:

```bash
make install   # install dependencies
make app       # run the app
make test      # run the test suite
make train     # compare models + tune the best (offline)
```

### Tests

```bash
python tests/test_pipeline.py     # ML pipeline checks
python tests/test_app_smoke.py    # headless app boot test
# or simply:  pytest
```

---

## ☁️ Deploy it for free (Streamlit Community Cloud)

No credit card, no servers.

1. Push this repo to **GitHub**.
2. Go to **https://share.streamlit.io** and sign in with GitHub.
3. Click **Create app** → **Deploy a public app from GitHub**.
4. Choose this **repository**, branch **`main`**, main file **`app.py`**.
5. Click **Deploy** — a couple of minutes later you get a public link to share.

`requirements.txt` is detected automatically; there is nothing else to configure.

---

## 📊 Results

Held-out test performance (Logistic Regression, threshold 0.5):

| Metric | Score |
| ------ | ----- |
| ROC-AUC | ~0.84 |
| Recall (churners caught) | ~0.78 |
| Precision | ~0.50 |

Lowering the decision threshold catches more churners (higher recall) at the
cost of more false alarms — the app lets you explore this trade-off live.

---

## 📁 Project structure

```
.
├── app.py                  # Streamlit app (the five-tab UI)
├── train.py                # offline model comparison + hyperparameter tuning
├── data/
│   └── telco_churn.csv      # bundled dataset (no runtime download)
├── src/
│   ├── data.py             # loading, cleaning, reproducible split, feature metadata
│   ├── pipeline.py         # preprocessing ColumnTransformer + model definitions
│   └── evaluate.py         # model comparison, evaluation, explainability, prediction
├── tests/
│   ├── test_pipeline.py    # end-to-end ML checks
│   └── test_app_smoke.py   # headless Streamlit boot test
├── requirements.txt
├── Makefile
├── .streamlit/config.toml
└── README.md
```

---

## 📚 Dataset

The [Telco Customer Churn](https://www.kaggle.com/datasets/blastchar/telco-customer-churn)
dataset (IBM sample data): 7,043 customers with account, demographic, and service
attributes, labelled by whether they churned. It is bundled in `data/` for
offline, reproducible runs.
