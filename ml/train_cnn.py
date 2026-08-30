"""
LandSafe AI - Train CNN terrain classifier (Bijie dataset)

Transfer learning on ResNet18: classifies a terrain image crop as
"landslide" or "non_landslide". Handles the Bijie class imbalance
(770 landslide vs 2003 non-landslide) with a weighted loss.

EXPECTED FOLDER LAYOUT (put the Bijie images here before running):
    data/raw/images/
        landslide/       <- ~770 landslide crops (.png/.jpg)
        non_landslide/    <- ~2003 non-landslide crops (.png/.jpg)

Run from the project root:
    python ml/train_cnn.py
"""

import os
import json
import copy
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Subset
from torchvision import datasets, models, transforms
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix

DATA_DIR = "data/raw/images"
MODELS_DIR = "models"
BATCH_SIZE = 32
NUM_EPOCHS = 10
LEARNING_RATE = 1e-4
IMG_SIZE = 224
VAL_SPLIT = 0.2
RANDOM_SEED = 42

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")


def build_transforms():
    # ImageNet normalization stats, since ResNet18 is pretrained on ImageNet
    normalize = transforms.Normalize(
        mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]
    )
    train_tf = transforms.Compose([
        transforms.Resize((IMG_SIZE, IMG_SIZE)),
        transforms.RandomHorizontalFlip(),
        transforms.RandomRotation(15),
        transforms.ToTensor(),
        normalize,
    ])
    val_tf = transforms.Compose([
        transforms.Resize((IMG_SIZE, IMG_SIZE)),
        transforms.ToTensor(),
        normalize,
    ])
    return train_tf, val_tf


def build_dataloaders():
    if not os.path.isdir(DATA_DIR):
        raise FileNotFoundError(
            f"Expected {DATA_DIR}/landslide/ and {DATA_DIR}/non_landslide/ - "
            f"copy the Bijie images into that layout first"
        )

    train_tf, val_tf = build_transforms()

    # Load once to get file paths + labels for a stratified split
    full_dataset = datasets.ImageFolder(DATA_DIR)
    class_names = full_dataset.classes  # e.g. ['landslide', 'non_landslide']
    targets = [label for _, label in full_dataset.samples]

    train_idx, val_idx = train_test_split(
        range(len(full_dataset)),
        test_size=VAL_SPLIT,
        stratify=targets,
        random_state=RANDOM_SEED,
    )

    # Two ImageFolder instances (different transforms) sharing the same file list
    train_dataset_full = datasets.ImageFolder(DATA_DIR, transform=train_tf)
    val_dataset_full = datasets.ImageFolder(DATA_DIR, transform=val_tf)

    train_dataset = Subset(train_dataset_full, train_idx)
    val_dataset = Subset(val_dataset_full, val_idx)

    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True, num_workers=2)
    val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False, num_workers=2)

    # Class weights for the loss (inverse frequency), since landslide (~770)
    # is the minority class vs non_landslide (~2003)
    counts = [targets.count(i) for i in range(len(class_names))]
    total = sum(counts)
    class_weights = torch.tensor([total / c for c in counts], dtype=torch.float32)

    print(f"Classes: {class_names}")
    print(f"Counts: {dict(zip(class_names, counts))}")
    print(f"Train size: {len(train_dataset)}, Val size: {len(val_dataset)}")

    return train_loader, val_loader, class_names, class_weights


def build_model(num_classes: int):
    model = models.resnet18(weights=models.ResNet18_Weights.IMAGENET1K_V1)

    # Freeze the pretrained backbone, only train the new final layer first.
    # (Simple, fast, avoids overfitting on a dataset this size.)
    for param in model.parameters():
        param.requires_grad = False

    model.fc = nn.Linear(model.fc.in_features, num_classes)
    return model.to(device)


def train_one_epoch(model, loader, criterion, optimizer):
    model.train()
    running_loss = 0.0
    for images, labels in loader:
        images, labels = images.to(device), labels.to(device)
        optimizer.zero_grad()
        outputs = model(images)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()
        running_loss += loss.item() * images.size(0)
    return running_loss / len(loader.dataset)


def evaluate(model, loader, class_names):
    model.eval()
    all_preds, all_labels = [], []
    with torch.no_grad():
        for images, labels in loader:
            images = images.to(device)
            outputs = model(images)
            preds = outputs.argmax(dim=1).cpu()
            all_preds.extend(preds.tolist())
            all_labels.extend(labels.tolist())

    print("\nValidation classification report:")
    print(classification_report(all_labels, all_preds, target_names=class_names, zero_division=0))
    print("Confusion matrix (rows=actual, cols=predicted):")
    print(confusion_matrix(all_labels, all_preds))

    correct = sum(p == l for p, l in zip(all_preds, all_labels))
    return correct / len(all_labels)


def main():
    print(f"Using device: {device}")
    train_loader, val_loader, class_names, class_weights = build_dataloaders()

    model = build_model(num_classes=len(class_names))
    criterion = nn.CrossEntropyLoss(weight=class_weights.to(device))
    optimizer = torch.optim.Adam(model.fc.parameters(), lr=LEARNING_RATE)

    best_acc = 0.0
    best_state = None

    for epoch in range(1, NUM_EPOCHS + 1):
        train_loss = train_one_epoch(model, train_loader, criterion, optimizer)
        val_acc = evaluate(model, val_loader, class_names)
        print(f"Epoch {epoch}/{NUM_EPOCHS} - train_loss: {train_loss:.4f} - val_acc: {val_acc:.4f}")

        if val_acc > best_acc:
            best_acc = val_acc
            best_state = copy.deepcopy(model.state_dict())

    model.load_state_dict(best_state)

    os.makedirs(MODELS_DIR, exist_ok=True)
    torch.save({
        "model_state_dict": model.state_dict(),
        "class_names": class_names,
        "img_size": IMG_SIZE,
    }, f"{MODELS_DIR}/cnn_model.pth")

    with open(f"{MODELS_DIR}/cnn_training_results.json", "w") as f:
        json.dump({"best_val_accuracy": best_acc, "class_names": class_names}, f, indent=2)

    print(f"\nBest validation accuracy: {best_acc:.4f}")
    print(f"Saved cnn_model.pth to {MODELS_DIR}/")


if __name__ == "__main__":
    main()
