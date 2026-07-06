# Churn Radar — common tasks
.PHONY: install app train test clean

install:      ## Install dependencies
	pip install -r requirements.txt

app:          ## Run the Streamlit app
	streamlit run app.py

train:        ## Compare models + tune the best (offline)
	python train.py

test:         ## Run the test suite
	python -m pytest -q

clean:        ## Remove caches and saved models
	rm -rf __pycache__ */__pycache__ .pytest_cache models
