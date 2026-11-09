"""
================================================================================
REAL CHEST X-RAY TRAINING & MULTI-MODEL BENCHMARK SUITE (COLAB READY)
================================================================================
Train, evaluate, and compare multiple architectures on your real Chest X-ray dataset:
1. Baseline ResNet-18 (Vanilla)
2. Proposed Attentive-LungNet (ResNet-18 + CBAM Attention + Multi-Task Dual Head)
3. Baseline DenseNet-121 (CheXNet standard)
4. Baseline EfficientNet-B0 (Google compound scaled)

OUTPUTS GENERATED:
- Epoch-by-epoch training/validation loss & accuracy tracking
- Side-by-side Confusion Matrices on real Test Data
- Clinical metrics table (Accuracy, Sensitivity/Recall, Specificity, F1, ROC-AUC)
- Epoch Learning Curves (Train vs Val across all epochs)
- Overlaid ROC Curves
- Best Model Checkpoints (.pth) saved
================================================================================
"""

import os
import time
import copy
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader
from torchvision import datasets, models, transforms

from sklearn.metrics import (
    accuracy_score,
    recall_score,
    precision_score,
    f1_score,
    roc_auc_score,
    roc_curve,
    confusion_matrix
)

# Set random seed for reproducibility
torch.manual_seed(42)
np.random.seed(42)

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"[*] Training Device: {device}")
if device.type == "cuda":
    print(f"[*] GPU Name: {torch.cuda.get_device_name(0)}")

# ==============================================================================
# CONFIGURATION HYPERPARAMETERS
# ==============================================================================
# Set your desired training epochs (as requested by your professor/mam)
EPOCHS = 15          # e.g., 10, 15, or 20 epochs
BATCH_SIZE = 32
LEARNING_RATE = 1e-4
WEIGHT_DECAY = 1e-4
IMAGE_SIZE = 224

# Set your dataset paths. In Colab, if uploaded as a zip or in Google Drive:
# E.g.: /content/chest_xray or /content/drive/MyDrive/chest_xray
DATASET_ROOT = "./dataset"  # Change to your actual path e.g. "/content/chest_xray"


# ==============================================================================
# SECTION 1: ATTENTION MECHANISM (CBAM)
# ==============================================================================
class ChannelAttention(nn.Module):
    def __init__(self, in_planes, ratio=16):
        super(ChannelAttention, self).__init__()
        reduced = max(in_planes // ratio, 8)
        self.avg_pool = nn.AdaptiveAvgPool2d(1)
        self.max_pool = nn.AdaptiveMaxPool2d(1)
        self.fc1 = nn.Conv2d(in_planes, reduced, 1, bias=False)
        self.relu = nn.ReLU(inplace=True)
        self.fc2 = nn.Conv2d(reduced, in_planes, 1, bias=False)
        self.sigmoid = nn.Sigmoid()

    def forward(self, x):
        avg_out = self.fc2(self.relu(self.fc1(self.avg_pool(x))))
        max_out = self.fc2(self.relu(self.fc1(self.max_pool(x))))
        return self.sigmoid(avg_out + max_out)

class SpatialAttention(nn.Module):
    def __init__(self, kernel_size=7):
        super(SpatialAttention, self).__init__()
        padding = 3 if kernel_size == 7 else 1
        self.conv = nn.Conv2d(2, 1, kernel_size, padding=padding, bias=False)
        self.sigmoid = nn.Sigmoid()

    def forward(self, x):
        avg_out = torch.mean(x, dim=1, keepdim=True)
        max_out, _ = torch.max(x, dim=1, keepdim=True)
        return self.sigmoid(self.conv(torch.cat([avg_out, max_out], dim=1)))

class CBAM(nn.Module):
    def __init__(self, in_planes, ratio=16, kernel_size=7):
        super(CBAM, self).__init__()
        self.ca = ChannelAttention(in_planes, ratio)
        self.sa = SpatialAttention(kernel_size)

    def forward(self, x):
        out = x * self.ca(x)
        out = out * self.sa(out)
        return out


# ==============================================================================
# SECTION 2: ARCHITECTURES
# ==============================================================================

# 1. Baseline ResNet-18
class ResNet18Baseline(nn.Module):
    def __init__(self, num_classes=2):
        super().__init__()
        self.net = models.resnet18(weights=models.ResNet18_Weights.DEFAULT)
        self.net.fc = nn.Linear(self.net.fc.in_features, num_classes)
    def forward(self, x):
        return self.net(x)

# 2. Proposed Attentive-LungNet (ResNet-18 + CBAM + Dual Head)
class AttentiveLungNet(nn.Module):
    def __init__(self, num_classes=2):
        super().__init__()
        base = models.resnet18(weights=models.ResNet18_Weights.DEFAULT)
        self.conv1 = base.conv1
        self.bn1 = base.bn1
        self.relu = base.relu
        self.maxpool = base.maxpool

        self.layer1 = base.layer1
        self.layer2 = base.layer2
        self.layer3 = base.layer3
        self.layer4 = base.layer4

        self.cbam = CBAM(in_planes=512, ratio=16)
        self.avgpool = nn.AdaptiveAvgPool2d((1, 1))

        self.classifier = nn.Sequential(
            nn.Dropout(0.3),
            nn.Linear(512, num_classes)
        )
        self.severity_regressor = nn.Sequential(
            nn.Linear(512, 128),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(128, 1),
            nn.Sigmoid()
        )

    def forward(self, x, return_severity=False):
        x = self.conv1(x)
        x = self.bn1(x)
        x = self.relu(x)
        x = self.maxpool(x)

        x = self.layer1(x)
        x = self.layer2(x)
        x = self.layer3(x)
        x = self.layer4(x)

        x = self.cbam(x)
        feat = torch.flatten(self.avgpool(x), 1)

        logits = self.classifier(feat)
        if return_severity:
            return logits, self.severity_regressor(feat) * 100.0
        return logits

# 3. Baseline DenseNet-121
class DenseNet121Baseline(nn.Module):
    def __init__(self, num_classes=2):
        super().__init__()
        self.net = models.densenet121(weights=models.DenseNet121_Weights.DEFAULT)
        self.net.classifier = nn.Linear(self.net.classifier.in_features, num_classes)
    def forward(self, x):
        return self.net(x)

# 4. Baseline EfficientNet-B0
class EfficientNetB0Baseline(nn.Module):
    def __init__(self, num_classes=2):
        super().__init__()
        self.net = models.efficientnet_b0(weights=models.EfficientNet_B0_Weights.DEFAULT)
        self.net.classifier[1] = nn.Linear(self.net.classifier[1].in_features, num_classes)
    def forward(self, x):
        return self.net(x)


# ==============================================================================
# SECTION 3: DATA PREPARATION & AUGMENTATION
# ==============================================================================
def get_dataloaders(data_dir=DATASET_ROOT, batch_size=BATCH_SIZE):
    """
    Expects standard dataset directory structure:
    data_dir/
      train/ (NORMAL, PNEUMONIA)
      val/   (NORMAL, PNEUMONIA)
      test/  (NORMAL, PNEUMONIA)
    """
    train_transforms = transforms.Compose([
        transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.RandomRotation(degrees=10),
        transforms.ColorJitter(brightness=0.1, contrast=0.1),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])

    eval_transforms = transforms.Compose([
        transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])

    train_path = os.path.join(data_dir, "train")
    val_path = os.path.join(data_dir, "val")
    test_path = os.path.join(data_dir, "test")

    if not os.path.exists(train_path):
        raise FileNotFoundError(f"Directory not found: {train_path}. Please check your DATASET_ROOT path.")

    train_dataset = datasets.ImageFolder(train_path, transform=train_transforms)
    val_dataset = datasets.ImageFolder(val_path, transform=eval_transforms)
    test_dataset = datasets.ImageFolder(test_path, transform=eval_transforms)

    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, num_workers=2)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False, num_workers=2)
    test_loader = DataLoader(test_dataset, batch_size=batch_size, shuffle=False, num_workers=2)

    print(f"[*] Loaded Real Dataset: Train={len(train_dataset)}, Val={len(val_dataset)}, Test={len(test_dataset)}")
    print(f"[*] Class Mapping: {train_dataset.class_to_idx}")

    return train_loader, val_loader, test_loader, train_dataset.classes


# ==============================================================================
# SECTION 4: TRAINING & VALIDATION LOOP
# ==============================================================================
def train_model(model_name, model, train_loader, val_loader, epochs=EPOCHS):
    print(f"\n" + "="*70)
    print(f"TRAINING: {model_name} for {epochs} EPOCHS")
    print("="*70)

    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.AdamW(model.parameters(), lr=LEARNING_RATE, weight_decay=WEIGHT_DECAY)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)

    history = {
        "train_loss": [], "val_loss": [],
        "train_acc": [], "val_acc": []
    }

    best_val_acc = 0.0
    best_weights = copy.deepcopy(model.state_dict())

    for epoch in range(1, epochs + 1):
        # 1. Training Phase
        model.train()
        running_loss = 0.0
        correct_train = 0
        total_train = 0

        for images, labels in train_loader:
            images, labels = images.to(device), labels.to(device)
            optimizer.zero_grad()

            outputs = model(images)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()

            running_loss += loss.item() * images.size(0)
            preds = torch.argmax(outputs, dim=1)
            correct_train += (preds == labels).sum().item()
            total_train += labels.size(0)

        epoch_train_loss = running_loss / total_train
        epoch_train_acc = (correct_train / total_train) * 100.0

        # 2. Validation Phase
        model.eval()
        val_loss = 0.0
        correct_val = 0
        total_val = 0

        with torch.no_grad():
            for images, labels in val_loader:
                images, labels = images.to(device), labels.to(device)
                outputs = model(images)
                loss = criterion(outputs, labels)

                val_loss += loss.item() * images.size(0)
                preds = torch.argmax(outputs, dim=1)
                correct_val += (preds == labels).sum().item()
                total_val += labels.size(0)

        epoch_val_loss = val_loss / total_val
        epoch_val_acc = (correct_val / total_val) * 100.0

        scheduler.step()

        history["train_loss"].append(epoch_train_loss)
        history["val_loss"].append(epoch_val_loss)
        history["train_acc"].append(epoch_train_acc)
        history["val_acc"].append(epoch_val_acc)

        # Save best weights
        if epoch_val_acc > best_val_acc:
            best_val_acc = epoch_val_acc
            best_weights = copy.deepcopy(model.state_dict())

        print(f"Epoch [{epoch:02d}/{epochs:02d}] | "
              f"Train Loss: {epoch_train_loss:.4f} - Train Acc: {epoch_train_acc:.2f}% | "
              f"Val Loss: {epoch_val_loss:.4f} - Val Acc: {epoch_val_acc:.2f}%")

    # Load best weights
    model.load_state_dict(best_weights)
    torch.save(model.state_dict(), f"best_{model_name.replace(' ', '_').replace('(', '').replace(')', '')}.pth")
    print(f"[*] Completed {model_name}. Best Val Accuracy: {best_val_acc:.2f}%")

    return model, history


# ==============================================================================
# SECTION 5: FINAL EVALUATION ON UNSEEN TEST SET
# ==============================================================================
def evaluate_on_test_set(model, test_loader):
    model.eval()
    all_preds = []
    all_targets = []
    all_probs = []

    start_time = time.time()
    with torch.no_grad():
        for images, labels in test_loader:
            images = images.to(device)
            outputs = model(images)
            probs = F.softmax(outputs, dim=1)[:, 1].cpu().numpy()
            preds = torch.argmax(outputs, dim=1).cpu().numpy()

            all_preds.extend(preds)
            all_probs.extend(probs)
            all_targets.extend(labels.numpy())

    avg_latency = ((time.time() - start_time) / len(all_targets)) * 1000.0

    all_targets = np.array(all_targets)
    all_preds = np.array(all_preds)
    all_probs = np.array(all_probs)

    acc = accuracy_score(all_targets, all_preds) * 100.0
    rec = recall_score(all_targets, all_preds) * 100.0
    prec = precision_score(all_targets, all_preds) * 100.0
    f1 = f1_score(all_targets, all_preds) * 100.0
    auc = roc_auc_score(all_targets, all_probs)

    cm = confusion_matrix(all_targets, all_preds)
    tn, fp, fn, tp = cm.ravel()
    spec = (tn / (tn + fp)) * 100.0 if (tn + fp) > 0 else 0.0

    fpr, tpr, _ = roc_curve(all_targets, all_probs)

    return {
        "Accuracy (%)": acc,
        "Sensitivity/Recall (%)": rec,
        "Specificity (%)": spec,
        "Precision (%)": prec,
        "F1-Score (%)": f1,
        "ROC-AUC": auc,
        "Confusion Matrix": cm,
        "Latency (ms)": avg_latency,
        "fpr": fpr,
        "tpr": tpr
    }


# ==============================================================================
# SECTION 6: MAIN TRAINING & BENCHMARK PIPELINE
# ==============================================================================
def run_real_training_benchmark(dataset_path=DATASET_ROOT, epochs=EPOCHS):
    train_loader, val_loader, test_loader, class_names = get_dataloaders(dataset_path)

    models_to_train = {
        "ResNet-18 (Baseline)": ResNet18Baseline().to(device),
        "Attentive-LungNet (Proposed)": AttentiveLungNet().to(device),
        "DenseNet-121 (CheXNet)": DenseNet121Baseline().to(device),
        "EfficientNet-B0 (Baseline)": EfficientNetB0Baseline().to(device)
    }

    all_histories = {}
    test_metrics = {}

    # 1. Train each model across requested epochs
    for name, model in models_to_train.items():
        trained_model, history = train_model(name, model, train_loader, val_loader, epochs=epochs)
        all_histories[name] = history
        print(f"\n[*] Evaluating {name} on Unseen Real Test Set...")
        eval_result = evaluate_on_test_set(trained_model, test_loader)
        test_metrics[name] = eval_result

    # 2. Build and Display Final Benchmark Table
    summary_data = []
    for name, m in test_metrics.items():
        params = sum(p.numel() for p in models_to_train[name].parameters()) / 1e6
        summary_data.append({
            "Model Architecture": name,
            "Parameters (M)": round(params, 2),
            "Latency (ms)": round(m["Latency (ms)"], 2),
            "Test Accuracy (%)": round(m["Accuracy (%)"], 2),
            "Sensitivity / Recall (%)": round(m["Sensitivity/Recall (%)"], 2),
            "Specificity (%)": round(m["Specificity (%)"], 2),
            "Precision (%)": round(m["Precision (%)"], 2),
            "F1-Score (%)": round(m["F1-Score (%)"], 2),
            "ROC-AUC": round(m["ROC-AUC"], 3)
        })

    df_summary = pd.DataFrame(summary_data)
    print("\n" + "="*80)
    print("FINAL TEST SET BENCHMARK RESULTS (AFTER FULL TRAINING)")
    print("="*80)
    try:
        print(df_summary.to_markdown(index=False))
    except Exception:
        print(df_summary.to_string(index=False))

    df_summary.to_csv("real_dataset_benchmark_summary.csv", index=False)

    # ==========================================================================
    # 3. PLOT SIDE-BY-SIDE CONFUSION MATRICES
    # ==========================================================================
    num_models = len(models_to_train)
    fig, axes = plt.subplots(1, num_models, figsize=(5 * num_models, 4.5))
    if num_models == 1:
        axes = [axes]

    for ax, (name, metrics) in zip(axes, test_metrics.items()):
        cm = metrics["Confusion Matrix"]
        sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', cbar=False, ax=ax,
                    xticklabels=class_names, yticklabels=class_names, annot_kws={"size": 13, "weight": "bold"})
        ax.set_title(f"{name}\nAcc: {metrics['Accuracy (%)']:.1f}% | Rec: {metrics['Sensitivity/Recall (%)']:.1f}%", fontsize=11)
        ax.set_xlabel("Predicted Label", fontsize=10)
        ax.set_ylabel("True Label", fontsize=10)

    plt.tight_layout()
    plt.savefig("confusion_matrices_comparison.png", dpi=300)
    print("\n[*] Saved Confusion Matrices to: confusion_matrices_comparison.png")

    # ==========================================================================
    # 4. PLOT LEARNING CURVES (TRAIN VS VAL ACROSS EPOCHS)
    # ==========================================================================
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))
    
    # Accuracy curves
    for name, hist in all_histories.items():
        axes[0].plot(range(1, epochs + 1), hist["val_acc"], label=f"{name} (Val)", lw=2)
    axes[0].set_title(f"Validation Accuracy Across {epochs} Epochs", fontsize=12, fontweight='bold')
    axes[0].set_xlabel("Epoch", fontsize=10)
    axes[0].set_ylabel("Accuracy (%)", fontsize=10)
    axes[0].grid(True, linestyle="--", alpha=0.5)
    axes[0].legend()

    # Loss curves
    for name, hist in all_histories.items():
        axes[1].plot(range(1, epochs + 1), hist["val_loss"], label=f"{name} (Val)", lw=2)
    axes[1].set_title(f"Validation Loss Across {epochs} Epochs", fontsize=12, fontweight='bold')
    axes[1].set_xlabel("Epoch", fontsize=10)
    axes[1].set_ylabel("Loss", fontsize=10)
    axes[1].grid(True, linestyle="--", alpha=0.5)
    axes[1].legend()

    plt.tight_layout()
    plt.savefig("epoch_learning_curves.png", dpi=300)
    print("[*] Saved Epoch Learning Curves to: epoch_learning_curves.png")

    # ==========================================================================
    # 5. PLOT OVERLAID ROC CURVES
    # ==========================================================================
    plt.figure(figsize=(8, 6))
    for name, metrics in test_metrics.items():
        plt.plot(metrics["fpr"], metrics["tpr"], lw=2, label=f"{name} (AUC = {metrics['ROC-AUC']:.3f})")

    plt.plot([0, 1], [0, 1], color='gray', linestyle='--')
    plt.xlabel("False Positive Rate (1 - Specificity)", fontsize=11)
    plt.ylabel("True Positive Rate (Sensitivity / Recall)", fontsize=11)
    plt.title(f"Receiver Operating Characteristic (ROC) Comparison ({epochs} Epochs)", fontsize=12, fontweight='bold')
    plt.legend(loc="lower right")
    plt.grid(True, linestyle="--", alpha=0.5)
    plt.tight_layout()
    plt.savefig("real_dataset_roc_curves.png", dpi=300)
    print("[*] Saved ROC Curves to: real_dataset_roc_curves.png")

    print("\n" + "="*80)
    print("ALL TRAINING, EVALUATION, AND PLOTTING FINISHED SUCCESSFULLY!")
    print("="*80)


if __name__ == "__main__":
    # If running locally or in Colab:
    run_real_training_benchmark(dataset_path=DATASET_ROOT, epochs=EPOCHS)
