.PHONY: install train test lint clean

install:
	python -m pip install -r requirements.txt

train:
	python run.py

train-offline:
	python run.py --synthetic

test:
	pytest -q

clean:
	rm -rf data __pycache__ .pytest_cache churnlens/__pycache__ tests/__pycache__
