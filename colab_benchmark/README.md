# 🔬 Model Benchmark & Training Suite (Google Colab Ready)

This directory contains two complete, publication-ready benchmark suites:

---

## 1. `real_dataset_training_benchmark.py` (Full Real Dataset Training)
> **Use this to train across multiple epochs on your real chest X-ray images, plot Confusion Matrices, and compare architectures.**

* **Notebook:** [`real_dataset_training_benchmark_notebook.ipynb`](./real_dataset_training_benchmark_notebook.ipynb)
* **Python Script:** [`real_dataset_training_benchmark.py`](./real_dataset_training_benchmark.py)

### What it does:
1. Trains **ResNet-18**, **Attentive-LungNet (CBAM)**, **DenseNet-121**, and **EfficientNet-B0** over your chosen number of epochs (`EPOCHS = 15`).
2. Evaluates every model on the unseen **test set**.
3. Generates **Side-by-Side Confusion Matrices** (showing True Positives, True Negatives, False Positives, False Negatives).
4. Generates **Epoch Learning Curves** (Train/Val Loss & Accuracy over all epochs).
5. Generates **Overlaid ROC Curves** and saves the final Markdown summary table and best `.pth` checkpoints.

---

## 2. `synthetic_benchmark.py` (Instant In-Silico Phantom Benchmark)
> **Use this for instant verification of model parameters, inference latency (ms), and attention bone-suppression without downloading 2.5 GB of data.**

* **Notebook:** [`synthetic_benchmark_notebook.ipynb`](./synthetic_benchmark_notebook.ipynb)
* **Python Script:** [`synthetic_benchmark.py`](./synthetic_benchmark.py)

### Why we do a Synthetic Benchmark:
1. **Zero-Latency In-Silico Verification:** Tests architecture forward passes, parameter counts (M), and inference latency in under 15 seconds.
2. **Controlled Attention Verification:** Mathematically injects bright bone lines (ribs) to prove whether **CBAM Attention** suppresses bone artifacts vs vanilla CNNs that bleed into ribs.
