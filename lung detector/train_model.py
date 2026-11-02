"""
=============================================================================
🫁 Lung Disease Detection (Normal vs. Pneumonia) - ResNet-18 Pipeline
=============================================================================
Educational Research Prototype:
DISCLAIMER: This project is an educational and research prototype developed 
for study and evaluation purposes. It is NOT a clinically validated diagnostic 
system and must NOT be used for medical decisions, diagnosis, or patient care.
=============================================================================
"""

import os
import sys
import glob
import json
import time
import zipfile
import argparse
from pathlib import Path
from typing import Dict, List, Tuple, Optional

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
import torchvision.transforms as transforms
import torchvision.models as models
from PIL import Image
from tqdm import tqdm
import numpy as np
import matplotlib
matplotlib.use('Agg')  # Headless backend for saving figures
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
    classification_report
)

# ---------------------------------------------------------------------------
# Configuration & Constants
# ---------------------------------------------------------------------------
CLASS_NAMES = ["NORMAL", "PNEUMONIA"]
CLASS_TO_IDX = {"NORMAL": 0, "PNEUMONIA": 1}
IDX_TO_CLASS = {0: "NORMAL", 1: "PNEUMONIA"}

# ImageNet statistics required for pretrained ResNet-18
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]


# ---------------------------------------------------------------------------
# 1. Dataset Extraction & Path Detection
# ---------------------------------------------------------------------------
def locate_zip_file(search_dirs: List[Path]) -> Optional[Path]:
    """Find dataset zip file in given candidate directories."""
    for sdir in search_dirs:
        if not sdir.exists():
            continue
        # Direct check
        direct = sdir / "chest_xray.zip"
        if direct.exists():
            return direct
        # General pattern
        zip_files = list(sdir.glob("*.zip"))
        if zip_files:
            return zip_files[0]
    return None


def extract_dataset(zip_path: Path, target_dir: Path) -> Path:
    """
    Extracts chest X-ray dataset while safely skipping __MACOSX metadata,
    .DS_Store files, and duplicate nested directories.
    Keeps the original zip file intact.
    """
    print(f"📦 Found dataset archive: {zip_path.resolve()}")
    target_dir.mkdir(parents=True, exist_ok=True)
    
    with zipfile.ZipFile(zip_path, 'r') as zf:
        members = zf.namelist()
        # Filter unwanted members
        valid_members = [
            m for m in members
            if not '__MACOSX' in m
            and not m.endswith('.DS_Store')
            and not m.startswith('chest_xray/chest_xray/')  # Skip Kaggle duplicate folder
        ]
        
        print(f"   Extracting {len(valid_members)} valid files to {target_dir}...")
        for i, m in enumerate(valid_members):
            zf.extract(m, target_dir)
            if (i + 1) % 1500 == 0 or (i + 1) == len(valid_members):
                print(f"   -> Extracted {i + 1}/{len(valid_members)} files...")
    
    print("✅ Extraction complete! Original zip file retained intact.")
    return target_dir


def find_dataset_root(base_search_path: Path) -> Path:
    """
    Automatically detects the true dataset root containing 'train', 'val', and 'test'
    directories, including cases with extra parent directories.
    Validates that each split contains 'NORMAL' and 'PNEUMONIA' subdirectories.
    """
    candidates = []
    
    # Search the path itself and subdirectories up to depth 3
    search_paths = [base_search_path] + [p for p in base_search_path.glob("**/*") if p.is_dir()]
    
    for p in search_paths:
        # Avoid checking inside __MACOSX or hidden directories
        if "__MACOSX" in str(p) or any(part.startswith('.') for part in p.parts):
            continue
            
        splits_present = [
            (p / "train").is_dir(),
            (p / "val").is_dir(),
            (p / "test").is_dir()
        ]
        if all(splits_present):
            candidates.append(p)
            
    if not candidates:
        raise FileNotFoundError(
            f"❌ Unable to find dataset root under '{base_search_path}'.\n"
            f"Expected a directory containing 'train', 'val', and 'test' subdirectories.\n"
            f"Please verify dataset extraction."
        )
        
    # Prefer shallowest candidate
    best_candidate = min(candidates, key=lambda c: len(c.parts))
    
    # Validate NORMAL and PNEUMONIA subfolders in each split
    for split in ["train", "val", "test"]:
        split_dir = best_candidate / split
        for cls_name in CLASS_NAMES:
            cls_dir = split_dir / cls_name
            if not cls_dir.is_dir():
                raise FileNotFoundError(
                    f"❌ Expected subdirectory '{cls_name}' missing in split '{split_dir}'.\n"
                    f"Directory structure must have {split}/{cls_name}/."
                )
                
    return best_candidate


def inspect_dataset(dataset_root: Path) -> Dict[str, Dict[str, List[Path]]]:
    """
    Inspects image files across all splits and classes, prints summary counts,
    and returns a mapping of split -> class -> list of image paths.
    """
    print("\n" + "=" * 60)
    print(f"📊 DATASET INSPECTION: {dataset_root.resolve()}")
    print("=" * 60)
    
    dataset_index = {}
    valid_exts = {".jpeg", ".jpg", ".png", ".bmp"}
    
    for split in ["train", "val", "test"]:
        dataset_index[split] = {}
        split_total = 0
        print(f"\n📁 Split: [{split.upper()}] ({dataset_root / split})")
        for cls_name in CLASS_NAMES:
            cls_dir = dataset_root / split / cls_name
            img_paths = [
                p for p in cls_dir.iterdir()
                if p.is_file() and p.suffix.lower() in valid_exts and not p.name.startswith(".")
            ]
            dataset_index[split][cls_name] = sorted(img_paths)
            split_total += len(img_paths)
            print(f"   • {cls_name:<10}: {len(img_paths):>5} images")
        print(f"   ---------------------------")
        print(f"   Total {split:<6}: {split_total:>5} images")
        
    return dataset_index


# ---------------------------------------------------------------------------
# 2. PyTorch Dataset with Robust Error Handling
# ---------------------------------------------------------------------------
class XRayDataset(Dataset):
    """
    Custom Dataset for loading chest X-ray images on-the-fly.
    Converts all images to RGB and handles corrupted images gracefully.
    """
    def __init__(self, samples: List[Tuple[Path, int]], transform=None):
        self.samples = samples
        self.transform = transform

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, int]:
        img_path, label = self.samples[idx]
        try:
            with Image.open(img_path) as img:
                img = img.convert("RGB")
                if self.transform is not None:
                    img = self.transform(img)
                return img, label
        except Exception as e:
            print(f"⚠️ Error loading image {img_path}: {e}. Returning zero tensor fallback.")
            # Fallback zero tensor with standard shape [3, 224, 224]
            fallback = torch.zeros(3, 224, 224, dtype=torch.float32)
            return fallback, label


def prepare_samples(dataset_index: Dict[str, Dict[str, List[Path]]], split: str) -> List[Tuple[Path, int]]:
    """Flattens (path, label) pairs for a specific split."""
    samples = []
    for cls_name, paths in dataset_index[split].items():
        label_idx = CLASS_TO_IDX[cls_name]
        for p in paths:
            samples.append((p, label_idx))
    return samples


# ---------------------------------------------------------------------------
# 3. Data Augmentation & Preprocessing
# ---------------------------------------------------------------------------
def get_transforms():
    """
    Defines image transformations:
    - Training: Resize to 224x224, RandomHorizontalFlip, RandomRotation(10),
                ColorJitter, ToTensor, ImageNet normalization.
    - Validation/Testing: Deterministic Resize(224x224), ToTensor, ImageNet normalization.
    """
    train_transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.RandomRotation(degrees=10),
        transforms.ColorJitter(brightness=0.1, contrast=0.1),
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD)
    ])

    eval_transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD)
    ])

    return train_transform, eval_transform


# ---------------------------------------------------------------------------
# 4. Model Architecture (ResNet-18)
# ---------------------------------------------------------------------------
def build_model(device: torch.device) -> nn.Module:
    """
    Loads ResNet-18 with pretrained ImageNet weights, replaces the classification
    head with a 2-class output layer, and transfers the model to the target device.
    """
    print("\n" + "=" * 60)
    print("🧠 MODEL INITIALIZATION: ResNet-18")
    print("=" * 60)
    print("ℹ️ Note: Pretrained ImageNet weights are loaded using PyTorch torchvision weights cache.")
    
    weights = models.ResNet18_Weights.DEFAULT
    model = models.resnet18(weights=weights)
    
    # Replace final fully connected layer for binary classification (NORMAL vs PNEUMONIA)
    num_features = model.fc.in_features
    model.fc = nn.Linear(num_features, len(CLASS_NAMES))
    
    model = model.to(device)
    print(f"✅ Model successfully loaded and configured for {len(CLASS_NAMES)} classes on device: {device}")
    return model


# ---------------------------------------------------------------------------
# 5. Training & Validation Engine
# ---------------------------------------------------------------------------
def train_one_epoch(
    model: nn.Module,
    dataloader: DataLoader,
    criterion: nn.Module,
    optimizer: optim.Optimizer,
    device: torch.device,
    epoch: int,
    total_epochs: int
) -> Tuple[float, float]:
    """Runs a single training epoch."""
    model.train()
    running_loss = 0.0
    correct = 0
    total = 0

    pbar = tqdm(dataloader, desc=f"Epoch [{epoch + 1:02d}/{total_epochs:02d}] Train", leave=False)
    for images, labels in pbar:
        images = images.to(device)
        labels = labels.to(device)

        optimizer.zero_grad()
        outputs = model(images)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()

        running_loss += loss.item() * images.size(0)
        _, preds = torch.max(outputs, 1)
        correct += (preds == labels).sum().item()
        total += labels.size(0)

        current_acc = (correct / total) * 100.0 if total > 0 else 0.0
        pbar.set_postfix({"loss": f"{loss.item():.4f}", "acc": f"{current_acc:.2f}%"})

    epoch_loss = running_loss / total
    epoch_acc = (correct / total) * 100.0
    return epoch_loss, epoch_acc


def evaluate_split(
    model: nn.Module,
    dataloader: DataLoader,
    criterion: nn.Module,
    device: torch.device,
    desc: str = "Val"
) -> Tuple[float, float, np.ndarray, np.ndarray, np.ndarray]:
    """Evaluates the model on a dataloader without computing gradients."""
    model.eval()
    running_loss = 0.0
    all_preds = []
    all_labels = []
    all_probs = []

    with torch.no_grad():
        for images, labels in tqdm(dataloader, desc=desc, leave=False):
            images = images.to(device)
            labels = labels.to(device)

            outputs = model(images)
            loss = criterion(outputs, labels)
            running_loss += loss.item() * images.size(0)

            probs = torch.softmax(outputs, dim=1)
            _, preds = torch.max(outputs, 1)

            all_preds.extend(preds.cpu().numpy())
            all_labels.extend(labels.cpu().numpy())
            all_probs.extend(probs.cpu().numpy())

    total = len(all_labels)
    eval_loss = running_loss / total if total > 0 else 0.0
    eval_acc = (accuracy_score(all_labels, all_preds)) * 100.0

    return eval_loss, eval_acc, np.array(all_labels), np.array(all_preds), np.array(all_probs)


# ---------------------------------------------------------------------------
# 6. Full Training Pipeline
# ---------------------------------------------------------------------------
def run_training_pipeline(
    dataset_index: Dict[str, Dict[str, List[Path]]],
    output_dir: Path,
    epochs: int = 10,
    batch_size: int = 32,
    learning_rate: float = 1e-4,
    device: Optional[torch.device] = None
) -> Tuple[nn.Module, Dict]:
    """Executes the full model training and checkpointing loop."""
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Auto-detect hardware acceleration (Apple Silicon MPS -> CUDA -> CPU)
    if device is None:
        if torch.backends.mps.is_available():
            device = torch.device("mps")
        elif torch.cuda.is_available():
            device = torch.device("cuda")
        else:
            device = torch.device("cpu")
    print(f"⚡ Compute device selected: {device}")

    # Build transforms
    train_transform, eval_transform = get_transforms()

    # Prepare datasets
    train_samples = prepare_samples(dataset_index, "train")
    val_samples = prepare_samples(dataset_index, "val")
    test_samples = prepare_samples(dataset_index, "test")

    train_dataset = XRayDataset(train_samples, transform=train_transform)
    val_dataset = XRayDataset(val_samples, transform=eval_transform)
    test_dataset = XRayDataset(test_samples, transform=eval_transform)

    # Use 2 workers for efficient data prefetching
    num_workers = 2 if sys.platform != "win32" else 0
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, num_workers=num_workers, drop_last=False)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False, num_workers=num_workers)
    test_loader = DataLoader(test_dataset, batch_size=batch_size, shuffle=False, num_workers=num_workers)

    # Compute class weights to address training class imbalance (NORMAL: 1341, PNEUMONIA: 3875)
    train_labels = [s[1] for s in train_samples]
    class_counts = [train_labels.count(0), train_labels.count(1)]
    total_train = len(train_labels)
    # Balanced weighting: total / (n_classes * count)
    class_weights = [total_train / (2.0 * count) for count in class_counts]
    class_weights_tensor = torch.tensor(class_weights, dtype=torch.float32).to(device)

    print("\n" + "=" * 60)
    print("⚖️ CLASS IMBALANCE HANDLING")
    print("=" * 60)
    print(f"Train Counts  -> NORMAL: {class_counts[0]}, PNEUMONIA: {class_counts[1]}")
    print(f"Loss Weights  -> NORMAL: {class_weights[0]:.4f}, PNEUMONIA: {class_weights[1]:.4f}")

    # Loss and Optimizer
    criterion = nn.CrossEntropyLoss(weight=class_weights_tensor)
    model = build_model(device)
    optimizer = optim.Adam(model.parameters(), lr=learning_rate, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='min', factor=0.5, patience=2)

    # History tracker
    history = {
        "train_loss": [],
        "train_acc": [],
        "val_loss": [],
        "val_acc": [],
        "best_epoch": 0,
        "best_val_loss": float("inf")
    }

    best_checkpoint_path = output_dir / "best_resnet18.pth"
    best_val_loss = float("inf")

    print("\n" + "=" * 60)
    print(f"🚀 STARTING TRAINING ({epochs} Epochs, Batch Size: {batch_size}, LR: {learning_rate})")
    print("=" * 60)

    start_time = time.time()
    for epoch in range(epochs):
        epoch_start = time.time()
        
        train_loss, train_acc = train_one_epoch(
            model, train_loader, criterion, optimizer, device, epoch, epochs
        )
        val_loss, val_acc, _, _, _ = evaluate_split(
            model, val_loader, criterion, device, desc=f"Epoch [{epoch + 1:02d}/{epochs:02d}] Val"
        )

        scheduler.step(val_loss)
        epoch_duration = time.time() - epoch_start

        history["train_loss"].append(train_loss)
        history["train_acc"].append(train_acc)
        history["val_loss"].append(val_loss)
        history["val_acc"].append(val_acc)

        is_best = val_loss < best_val_loss
        best_marker = " ⭐ [BEST]" if is_best else ""

        print(
            f"Epoch [{epoch + 1:02d}/{epochs:02d}] | "
            f"Train Loss: {train_loss:.4f} | Train Acc: {train_acc:.2f}% | "
            f"Val Loss: {val_loss:.4f} | Val Acc: {val_acc:.2f}% | "
            f"Time: {epoch_duration:.1f}s{best_marker}"
        )

        if is_best:
            best_val_loss = val_loss
            history["best_epoch"] = epoch + 1
            history["best_val_loss"] = best_val_loss
            torch.save({
                "epoch": epoch + 1,
                "model_state_dict": model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "val_loss": val_loss,
                "val_acc": val_acc,
                "class_to_idx": CLASS_TO_IDX
            }, best_checkpoint_path)

    total_training_time = time.time() - start_time
    print("\n" + "=" * 60)
    print(f"🏁 TRAINING COMPLETED in {total_training_time / 60:.2f} minutes")
    print(f"Best Validation Loss: {history['best_val_loss']:.4f} at Epoch {history['best_epoch']}")
    print(f"Saved Best Checkpoint -> {best_checkpoint_path.resolve()}")
    print("=" * 60)

    # Plot training curves
    plot_training_history(history, output_dir / "training_history.png")

    return model, {
        "history": history,
        "test_loader": test_loader,
        "criterion": criterion,
        "device": device,
        "best_checkpoint_path": best_checkpoint_path
    }


# ---------------------------------------------------------------------------
# 7. Evaluation & Artifact Generation
# ---------------------------------------------------------------------------
def evaluate_test_set(
    checkpoint_path: Path,
    test_loader: DataLoader,
    criterion: nn.Module,
    device: torch.device,
    output_dir: Path
) -> Dict:
    """
    Loads the saved best checkpoint and evaluates it on the test dataset.
    Generates precision, recall, F1, per-class report, and confusion matrix.
    """
    print("\n" + "=" * 60)
    print("🧪 EVALUATION ON TEST DATASET (Unseen Data)")
    print("=" * 60)

    # Re-instantiate architecture and load best weights
    model = models.resnet18(weights=None)
    model.fc = nn.Linear(model.fc.in_features, len(CLASS_NAMES))
    checkpoint = torch.load(checkpoint_path, map_location=device)
    model.load_state_dict(checkpoint["model_state_dict"])
    model = model.to(device)
    model.eval()

    test_loss, test_acc, y_true, y_pred, y_probs = evaluate_split(
        model, test_loader, criterion, device, desc="Testing"
    )

    # Compute classification metrics
    precision_macro = precision_score(y_true, y_pred, average="macro")
    recall_macro = recall_score(y_true, y_pred, average="macro")
    f1_macro = f1_score(y_true, y_pred, average="macro")

    precision_weighted = precision_score(y_true, y_pred, average="weighted")
    recall_weighted = recall_score(y_true, y_pred, average="weighted")
    f1_weighted = f1_score(y_true, y_pred, average="weighted")

    # Specific Pneumonia recall (Sensitivity)
    # Pneumonia is class index 1
    cm = confusion_matrix(y_true, y_pred)
    tn, fp, fn, tp = cm.ravel()
    
    pneumonia_recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    pneumonia_precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    normal_recall = tn / (tn + fp) if (tn + fp) > 0 else 0.0
    normal_precision = tn / (tn + fn) if (tn + fn) > 0 else 0.0

    report_dict = classification_report(
        y_true, y_pred, target_names=CLASS_NAMES, output_dict=True
    )
    report_text = classification_report(
        y_true, y_pred, target_names=CLASS_NAMES, digits=4
    )

    print("\nClassification Report:")
    print("-" * 55)
    print(report_text)
    print("-" * 55)
    print(f"Test Accuracy           : {test_acc:.2f}%")
    print(f"Macro Precision         : {precision_macro:.4f}")
    print(f"Macro Recall            : {recall_macro:.4f}")
    print(f"Macro F1-Score          : {f1_macro:.4f}")
    print(f"Weighted F1-Score       : {f1_weighted:.4f}")
    print(f"🫁 PNEUMONIA RECALL     : {pneumonia_recall:.4f} ({pneumonia_recall * 100:.2f}%) [Sensitivity]")
    print(f"🫁 PNEUMONIA PRECISION  : {pneumonia_precision:.4f} ({pneumonia_precision * 100:.2f}%)")
    print(f"🩺 NORMAL SPECIFICITY   : {normal_recall:.4f} ({normal_recall * 100:.2f}%)")

    # Plot Confusion Matrix
    cm_path = output_dir / "confusion_matrix.png"
    plot_confusion_matrix(cm, CLASS_NAMES, cm_path)

    # Save test metrics JSON
    metrics_summary = {
        "test_loss": float(test_loss),
        "test_accuracy_pct": float(test_acc),
        "macro_metrics": {
            "precision": float(precision_macro),
            "recall": float(recall_macro),
            "f1_score": float(f1_macro)
        },
        "weighted_metrics": {
            "precision": float(precision_weighted),
            "recall": float(recall_weighted),
            "f1_score": float(f1_weighted)
        },
        "clinical_metrics": {
            "pneumonia_recall_sensitivity": float(pneumonia_recall),
            "pneumonia_precision": float(pneumonia_precision),
            "normal_recall_specificity": float(normal_recall),
            "normal_precision": float(normal_precision)
        },
        "confusion_matrix": {
            "true_negatives_normal": int(tn),
            "false_positives_pneumonia": int(fp),
            "false_negatives_normal": int(fn),
            "true_positives_pneumonia": int(tp)
        },
        "detailed_classification_report": report_dict,
        "evaluation_timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
    }

    metrics_file = output_dir / "test_metrics.json"
    with open(metrics_file, "w") as f:
        json.dump(metrics_summary, f, indent=4)
    print(f"✅ Saved test metrics JSON -> {metrics_file.resolve()}")

    return metrics_summary


def plot_confusion_matrix(cm: np.ndarray, class_names: List[str], save_path: Path):
    """Saves annotated confusion matrix plot."""
    plt.figure(figsize=(7, 6))
    
    # Calculate percentages per true row
    cm_percent = cm.astype('float') / cm.sum(axis=1)[:, np.newaxis] * 100
    
    labels = [
        [f"{count}\n({pct:.1f}%)" for count, pct in zip(row_count, row_pct)]
        for row_count, row_pct in zip(cm, cm_percent)
    ]

    sns.heatmap(
        cm,
        annot=labels,
        fmt="",
        cmap="Blues",
        cbar=True,
        xticklabels=class_names,
        yticklabels=class_names,
        annot_kws={"size": 13, "weight": "bold"}
    )
    plt.title("ResNet-18 Test Confusion Matrix\n(Chest X-Ray Classification)", fontsize=13, pad=12)
    plt.xlabel("Predicted Class", fontsize=11, labelpad=8)
    plt.ylabel("True Clinical Class", fontsize=11, labelpad=8)
    plt.tight_layout()
    plt.savefig(save_path, dpi=300)
    plt.close()
    print(f"✅ Saved confusion matrix plot -> {save_path.resolve()}")


def plot_training_history(history: Dict, save_path: Path):
    """Saves 2-panel training and validation history curves."""
    epochs_range = range(1, len(history["train_loss"]) + 1)
    
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))

    # Loss curve
    ax1.plot(epochs_range, history["train_loss"], "o-", label="Train Loss", color="#1f77b4", linewidth=2)
    ax1.plot(epochs_range, history["val_loss"], "s--", label="Val Loss", color="#ff7f0e", linewidth=2)
    best_epoch = history.get("best_epoch", 1)
    ax1.axvline(best_epoch, color="red", linestyle=":", label=f"Best Checkpoint (Epoch {best_epoch})")
    ax1.set_title("Training & Validation Loss", fontsize=12, fontweight="bold")
    ax1.set_xlabel("Epoch", fontsize=10)
    ax1.set_ylabel("Cross Entropy Loss", fontsize=10)
    ax1.grid(True, linestyle="--", alpha=0.6)
    ax1.legend(loc="upper right")

    # Accuracy curve
    ax2.plot(epochs_range, history["train_acc"], "o-", label="Train Accuracy", color="#2ca02c", linewidth=2)
    ax2.plot(epochs_range, history["val_acc"], "s--", label="Val Accuracy", color="#d62728", linewidth=2)
    ax2.axvline(best_epoch, color="red", linestyle=":", label=f"Best Checkpoint (Epoch {best_epoch})")
    ax2.set_title("Training & Validation Accuracy", fontsize=12, fontweight="bold")
    ax2.set_xlabel("Epoch", fontsize=10)
    ax2.set_ylabel("Accuracy (%)", fontsize=10)
    ax2.grid(True, linestyle="--", alpha=0.6)
    ax2.legend(loc="lower right")

    plt.suptitle("ResNet-18 Training History — Lung Disease Detection", fontsize=14, y=1.02)
    plt.tight_layout()
    plt.savefig(save_path, dpi=300, bbox_inches="tight")
    plt.close()
    print(f"✅ Saved training curves -> {save_path.resolve()}")


def save_class_mapping(output_dir: Path):
    """Saves class mapping JSON file for reliable inference."""
    output_dir.mkdir(parents=True, exist_ok=True)
    mapping = {
        "classes": CLASS_NAMES,
        "class_to_idx": CLASS_TO_IDX,
        "idx_to_class": IDX_TO_CLASS,
        "image_size": [224, 224],
        "normalization": {
            "mean": IMAGENET_MEAN,
            "std": IMAGENET_STD
        }
    }
    mapping_path = output_dir / "class_mapping.json"
    with open(mapping_path, "w") as f:
        json.dump(mapping, f, indent=4)
    print(f"✅ Saved class mapping -> {mapping_path.resolve()}")



# ---------------------------------------------------------------------------
# 8. Main Entrypoint
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description="Train ResNet-18 for Chest X-Ray Normal vs. Pneumonia Classification."
    )
    parser.add_argument("--epochs", type=int, default=10, help="Number of training epochs (default: 10)")
    parser.add_argument("--batch_size", type=int, default=32, help="Batch size for training and eval (default: 32)")
    parser.add_argument("--lr", type=float, default=1e-4, help="Learning rate (default: 1e-4)")
    parser.add_argument("--dataset_dir", type=str, default=None, help="Path to extracted dataset")
    parser.add_argument("--output_dir", type=str, default="model_output", help="Directory to save model artifacts")
    
    args = parser.parse_args()

    project_dir = Path(__file__).resolve().parent
    output_dir = project_dir / args.output_dir

    print("=" * 60)
    print("🫁 LUNG DISEASE DETECTION — MACHINE LEARNING PIPELINE")
    print("=" * 60)
    print("DISCLAIMER: Educational research prototype. Not for clinical use.")

    # Locate or extract dataset
    if args.dataset_dir:
        dataset_candidate = Path(args.dataset_dir)
    else:
        # Check if already extracted in dataset/
        dataset_candidate = project_dir / "dataset"
        
    try:
        dataset_root = find_dataset_root(dataset_candidate)
        print(f"✅ Detected extracted dataset root at: {dataset_root.resolve()}")
    except FileNotFoundError:
        print("🔍 Searching for dataset zip archive...")
        zip_path = locate_zip_file([project_dir, project_dir.parent])
        if not zip_path:
            print("❌ No chest X-ray zip file found in project or parent directory.")
            sys.exit(1)
        extract_dir = project_dir / "dataset"
        extract_dataset(zip_path, extract_dir)
        dataset_root = find_dataset_root(extract_dir)

    # Inspect images
    dataset_index = inspect_dataset(dataset_root)

    # Save class mapping
    save_class_mapping(output_dir)

    # Train model
    model, train_context = run_training_pipeline(
        dataset_index=dataset_index,
        output_dir=output_dir,
        epochs=args.epochs,
        batch_size=args.batch_size,
        learning_rate=args.lr
    )

    # Evaluate on unseen test dataset
    evaluate_test_set(
        checkpoint_path=train_context["best_checkpoint_path"],
        test_loader=train_context["test_loader"],
        criterion=train_context["criterion"],
        device=train_context["device"],
        output_dir=output_dir
    )

    print("\n" + "=" * 60)
    print("🎉 ALL PIPELINE TASKS COMPLETED SUCCESSFULLY!")
    print(f"Artifacts saved in: {output_dir.resolve()}")
    print("=" * 60)


if __name__ == "__main__":
    main()
