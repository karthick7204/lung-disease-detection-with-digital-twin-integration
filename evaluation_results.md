# 🫁 Lung Disease Detection (ResNet-18) — Pipeline & Evaluation Report

> [!WARNING]
> **Educational & Research Prototype Disclaimer**:
> This project is developed strictly for research, benchmarking, and educational purposes. It is **NOT** a clinically validated diagnostic tool and must **NOT** be used for patient diagnosis or clinical decision-making.

---

## 📊 1. Dataset Overview

The dataset archive `chest_xray.zip` (2.3 GB) was detected, inspected, and cleanly extracted into [`dataset/chest_xray/`](file:///Users/mackbook/Documents/lung/lung%20detector/dataset/chest_xray) (ignoring macOS metadata and duplicate nested folders). The original archive was retained completely intact.

| Split | NORMAL | PNEUMONIA | Total Split Images | Split Percentage |
| :--- | :---: | :---: | :---: | :---: |
| **Train** | 1,341 | 3,875 | 5,216 | 89.07% |
| **Validation** | 8 | 8 | 16 | 0.27% |
| **Test (Unseen)** | 234 | 390 | 624 | 10.66% |
| **Total** | **1,583** | **4,273** | **5,856** | **100%** |

### Class Imbalance Handling
To counteract the ~2.9:1 ratio of Pneumonia to Normal images in training data, inverse frequency class weights were computed and applied to PyTorch's `nn.CrossEntropyLoss`:
- **NORMAL Loss Weight**: `1.9448`
- **PNEUMONIA Loss Weight**: `0.6730`

---

## 🛠️ 2. Architecture & Training Setup

- **Backbone**: Pretrained `ResNet-18` (initialized with official torchvision ImageNet weights `ResNet18_Weights.DEFAULT`).
- **Head**: Custom linear classification layer `nn.Linear(512, 2)` for `NORMAL` (0) and `PNEUMONIA` (1).
- **Acceleration**: Apple Silicon GPU (`mps` backend).
- **Image Preprocessing**:
  - Resized to `224 × 224` pixels.
  - Converted to 3-channel RGB.
  - Normalized using ImageNet statistics: $\mu = [0.485, 0.456, 0.406]$, $\sigma = [0.229, 0.224, 0.225]$.
- **Data Augmentation (Train Only)**:
  - Random horizontal flipping ($p=0.5$).
  - Random rotation ($\pm 10^\circ$).
  - Subtle color jitter (brightness $0.1$, contrast $0.1$).
- **Optimizer**: Adam ($\text{lr} = 10^{-4}$, $\text{weight\_decay} = 10^{-4}$).
- **Scheduler**: `ReduceLROnPlateau` ($\text{factor}=0.5$, $\text{patience}=2$).
- **Epochs**: 10 epochs (Best checkpoint saved at Epoch 3 with validation loss `0.0526`).

---

## 📈 3. Training & Validation Dynamics

![ResNet-18 Training & Validation Curves](/Users/mackbook/.gemini/antigravity-ide/brain/8c11a5c7-b140-4b11-96d3-bc8e814457a4/training_history.png)

- **Best Validation Loss**: `0.0526` (Epoch 3).
- **Train Accuracy**: Began at $95.53\%$ in Epoch 1 and converged to $99.64\%$ by Epoch 10.
- **Val Accuracy**: Reached $100.00\%$ on the balanced validation set.

---

## 🧪 4. Evaluation on Unseen Test Dataset (624 Images)

The model checkpoint from Epoch 3 (`best_resnet18.pth`) was evaluated on the independent test dataset.

### Summary Metrics

| Metric | Score | Clinical / Operational Interpretation |
| :--- | :---: | :--- |
| **Accuracy** | **88.46%** | Overall correct classifications (552 / 624). |
| **PNEUMONIA Recall (Sensitivity)** | **98.72%** | **Critical Metric**: Out of 390 pneumonia cases, 385 were detected. Only 5 missed. |
| **NORMAL Precision** | **97.09%** | If predicted Normal, high probability (97.1%) of truly being Normal. |
| **PNEUMONIA Precision** | **85.18%** | 385 of 452 predicted Pneumonias were true positives. |
| **NORMAL Specificity (Recall)** | **71.37%** | 167 of 234 Normal cases correctly classified. |
| **Macro F1-Score** | **0.8686** | Harmonic mean of precision & recall across both classes. |
| **Weighted F1-Score** | **0.8801** | Support-weighted harmonic mean. |

### Classification Report

```text
              precision    recall  f1-score   support

      NORMAL     0.9709    0.7137    0.8227       234
   PNEUMONIA     0.8518    0.9872    0.9145       390

    accuracy                         0.8846       624
   macro avg     0.9114    0.8504    0.8686       624
weighted avg     0.8965    0.8846    0.8801       624
```

### Confusion Matrix

![Test Set Confusion Matrix](/Users/mackbook/.gemini/antigravity-ide/brain/8c11a5c7-b140-4b11-96d3-bc8e814457a4/confusion_matrix.png)

```text
                     Predicted NORMAL    Predicted PNEUMONIA
True NORMAL                167 (71.4%)           67 (28.6%)
True PNEUMONIA               5  (1.3%)          385 (98.7%)
```

---

## 💾 5. Saved Artifacts in `model_output/`

All required pipeline artifacts have been generated in [`lung detector/model_output/`](file:///Users/mackbook/Documents/lung/lung%20detector/model_output):

| File | Purpose |
| :--- | :--- |
| [`best_resnet18.pth`](file:///Users/mackbook/Documents/lung/lung%20detector/model_output/best_resnet18.pth) | Best model weights checkpoint based on validation loss. |
| [`class_mapping.json`](file:///Users/mackbook/Documents/lung/lung%20detector/model_output/class_mapping.json) | Class indices (`NORMAL: 0`, `PNEUMONIA: 1`) and normalization config. |
| [`test_metrics.json`](file:///Users/mackbook/Documents/lung/lung%20detector/model_output/test_metrics.json) | Full metrics summary, confusion matrix counts, and classification report. |
| [`confusion_matrix.png`](file:///Users/mackbook/Documents/lung/lung%20detector/model_output/confusion_matrix.png) | Annotated heatmap of test predictions. |
| [`training_history.png`](file:///Users/mackbook/Documents/lung/lung%20detector/model_output/training_history.png) | Training/validation loss and accuracy curves across epochs. |

---

## 🚀 6. Running Inference (`predict.py`)

A standalone prediction tool [`predict.py`](file:///Users/mackbook/Documents/lung/lung%20detector/predict.py) has been created to perform inference on new X-ray images using the exact evaluation pipeline.

### Command Syntax

```bash
cd "/Users/mackbook/Documents/lung/lung detector"
python3 predict.py --image "dataset/chest_xray/test/PNEUMONIA/person1_virus_6.jpeg"
```

### Verified Sample Output

```text
============================================================
🫁 CHEST X-RAY INFERENCE SERVICE
============================================================
Device: mps
DISCLAIMER: Educational research prototype. Not for clinical diagnosis.

============================================================
📋 PREDICTION RESULTS
============================================================
Input Image     : .../dataset/chest_xray/test/PNEUMONIA/person1_virus_6.jpeg
Predicted Class : PNEUMONIA
Confidence      : 99.98%

Class Probabilities:
  • NORMAL    :   0.02%  
  • PNEUMONIA :  99.98%  █████████████████████████████
============================================================
```
