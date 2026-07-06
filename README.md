# ✏️ Digit Vision — Handwritten Digit Recognition

An interactive machine-learning web app that trains a model to recognise
handwritten digits (0–9), compares several classifiers, and lets you watch it
make predictions in real time — with a clear view of *how* it decides.

**Fully self-contained: no API keys, no database, no internet required.** The
dataset ships inside scikit-learn, so there is nothing external to configure and
nothing that can fail at runtime — which makes it a reliable portfolio demo.

> **Tech stack:** Python · scikit-learn · Streamlit · pandas · matplotlib

---

## ✨ What it does

- **🏠 Overview** — the project at a glance, with headline accuracy.
- **📊 Explore the Data** — sample digit images, class balance, and dataset stats.
- **🤖 Model & Performance** — pick from four classifiers (SVM, Random Forest,
  K-Nearest Neighbors, Logistic Regression) and see test accuracy, 5-fold
  cross-validation, a confusion matrix, and per-digit precision/recall/F1.
- **🔮 Try It Live** — classify individual test images, view the model's
  confidence across all ten digits, and browse the cases it gets wrong.

The best model reaches roughly **97–99%** accuracy on unseen digits.

---

## 🚀 Run it locally

You need **Python 3.9+**.

```bash
# 1. (optional) create a virtual environment
python -m venv .venv && source .venv/bin/activate    # Windows: .venv\Scripts\activate

# 2. install dependencies
pip install -r requirements.txt

# 3. launch the app
streamlit run app.py
```

Then open the URL it prints (usually http://localhost:8501).

### Run the tests

```bash
python tests/test_pipeline.py      # or: pytest
```

---

## ☁️ Deploy it for free (Streamlit Community Cloud)

No credit card, no server setup.

1. Push this repo to **GitHub** (already done if you're reading this there).
2. Go to **https://share.streamlit.io** and sign in with GitHub.
3. Click **Create app** → **Deploy a public app from GitHub**.
4. Select this **repository**, branch **`main`**, and main file **`app.py`**.
5. Click **Deploy**. In a couple of minutes you'll get a public link to share.

Streamlit reads `requirements.txt` automatically — there is nothing else to set.

---

## 🧠 How it works

```
digits dataset (8×8 images)  ->  train/test split  ->  classifier
                                                          |
                       accuracy · confusion matrix · per-digit scores
                                                          |
                                    live prediction + confidence
```

1. **Data** — 1,797 labelled 8×8 grayscale digit images from scikit-learn.
2. **Train** — a classifier learns the pixel patterns of each digit (a fixed
   random seed keeps results reproducible).
3. **Evaluate** — accuracy and a confusion matrix are computed on held-out data
   the model never saw during training.
4. **Predict** — any test image is classified with a full probability breakdown.

---

## 📁 Project structure

```
.
├── app.py                  # Streamlit UI (the whole web app)
├── src/
│   ├── data.py             # dataset loading + reproducible train/test split
│   └── model.py            # model definitions, training, evaluation, prediction
├── tests/
│   └── test_pipeline.py    # end-to-end checks (data, training, prediction)
├── requirements.txt
├── .streamlit/config.toml  # app theme
└── README.md
```

---

## 📊 About the dataset

The [scikit-learn digits dataset](https://scikit-learn.org/stable/datasets/toy_dataset.html#optical-recognition-of-handwritten-digits-dataset)
is a classic optical-character-recognition benchmark: 1,797 images of
handwritten digits, each an 8×8 grid of pixel intensities (0–16), labelled 0–9.
It is bundled with scikit-learn, so the app needs no downloads.
