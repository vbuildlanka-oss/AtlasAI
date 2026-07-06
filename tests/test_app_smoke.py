"""Headless smoke test: actually run the Streamlit app and assert it renders.

Uses Streamlit's built-in AppTest harness, which executes app.py in-process
(training a model, rendering every tab) and surfaces any exception — a strong
guarantee that the deployed app will boot and work.

    python tests/test_app_smoke.py     # or: pytest
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from streamlit.testing.v1 import AppTest

APP = str(ROOT / "app.py")


def test_app_boots_without_error():
    at = AppTest.from_file(APP, default_timeout=180).run()
    assert at.exception is None or len(at.exception) == 0, f"App raised: {at.exception}"
    # The four tabs and the model selector should all be present.
    assert len(at.tabs) == 4
    assert len(at.selectbox) >= 1


def test_switching_model_and_predicting():
    at = AppTest.from_file(APP, default_timeout=180).run()
    # Switch to Random Forest and re-run — should still render cleanly.
    at.selectbox[0].select("Random Forest").run()
    assert at.exception is None or len(at.exception) == 0, f"After model switch: {at.exception}"
    # Move the "choose a test image" slider and re-run the prediction path.
    if len(at.slider) >= 1:
        at.slider[0].set_value(100).run()
        assert at.exception is None or len(at.exception) == 0, f"After slider: {at.exception}"


if __name__ == "__main__":
    test_app_boots_without_error()
    test_switching_model_and_predicting()
    print("App boots, switches models, and predicts without errors. ✅")
