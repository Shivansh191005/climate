# LandSafe AI - Stage 1: ML/DL Training

## Setup
    pip install -r requirements.txt

## 1. Tabular model (XGBoost)

Data is already placed at:
    data/raw/tabular/regenerated_landslide_risk_dataset.csv

Run in order:
    python ml/preprocessing.py
    python ml/train_xgboost.py

preprocessing.py:
 - cleans the CSV, merges High + Very High risk -> High (3-class target)
 - stratified 80/20 train/test split
 - saves scaler.pkl, label_encoder.pkl to models/
 - saves processed splits + metadata.json to data/processed/

train_xgboost.py:
 - trains a Random Forest baseline AND the primary XGBoost model
 - uses class-weighted training (balanced) to handle the Low/Moderate/High imbalance
 - prints classification report, macro F1, macro ROC-AUC, confusion matrix for both
 - saves models/xgboost_model.pkl and models/training_results.json

NOTE: I could not run train_xgboost.py myself in this sandbox (no network
access to install xgboost here), so double check the printed metrics look
sane (macro F1 well above the ~33% random-guess baseline for 3 classes).
If anything errors, paste me the traceback.

## 2. Image model (CNN - Bijie dataset)

Copy your downloaded Bijie images into this exact layout:
    data/raw/images/landslide/        <- landslide crops
    data/raw/images/non_landslide/    <- non-landslide crops

(Empty placeholder folders are already there - just drop the images in.)

Run:
    python ml/train_cnn.py

train_cnn.py:
 - ResNet18 pretrained on ImageNet, backbone frozen, only final layer trained
 - stratified 80/20 train/val split
 - class-weighted loss to handle the ~770 vs ~2003 image imbalance
 - trains 10 epochs, keeps the best validation-accuracy checkpoint
 - saves models/cnn_model.pth and models/cnn_training_results.json

NOTE: I could not run this one either (no torch/no images in this sandbox).
It uses standard, well-tested torchvision APIs, but if you hit a shape/path
error, paste me the traceback and I'll fix it directly.

## When both finish, send me:
 - the printed classification report + macro F1/AUC for XGBoost and the RF baseline
 - the best validation accuracy for the CNN
 - contents of models/training_results.json and models/cnn_training_results.json

That's what we'll use to write evaluate.py and explain.py (SHAP) next, and
to decide the final 70/30 environmental/terrain risk blend weights.
