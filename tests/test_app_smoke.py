"""Headless smoke test: run the Streamlit app and assert it renders.

Uses Streamlit's AppTest harness, which executes app.py in-process (loading
data, training a model, rendering every tab) and surfaces any exception — a
strong guarantee the deployed app will boot and work.

    python tests/test_app_smoke.py     # or: pytest
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from streamlit.testing.v1 import AppTest

APP = str(ROOT / "app.py")


def _no_exception(at) -> bool:
    return at.exception is None or len(at.exception) == 0


def _by_key(elements, key):
    """Find a widget by its key (widget order in AppTest is not guaranteed)."""
    for el in elements:
        if getattr(el, "key", None) == key:
            return el
    raise KeyError(f"No widget with key '{key}'")


def test_app_boots():
    at = AppTest.from_file(APP, default_timeout=300).run()
    assert _no_exception(at), f"App raised: {at.exception}"
    assert len(at.tabs) == 5
    # The sidebar controls exist and are addressable by key.
    assert _by_key(at.selectbox, "model_select") is not None
    assert _by_key(at.slider, "threshold") is not None


def test_threshold_and_model_switch():
    at = AppTest.from_file(APP, default_timeout=300).run()
    # Move the decision-threshold slider.
    _by_key(at.slider, "threshold").set_value(0.3).run()
    assert _no_exception(at), f"After threshold change: {at.exception}"
    # Switch to a different model.
    _by_key(at.selectbox, "model_select").select("Random Forest").run()
    assert _no_exception(at), f"After model switch: {at.exception}"


if __name__ == "__main__":
    test_app_boots()
    test_threshold_and_model_switch()
    print("App boots, switches model, and adjusts threshold without errors. ✅")
