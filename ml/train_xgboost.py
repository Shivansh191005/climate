"""
LandSafe AI - Train XGBoost risk model (+ Random Forest baseline)

Trains on the processed splits from preprocessing.py, handles the
Low/Moderate/High imbalance with class weights, compares against a
Random Forest baseline, and saves the final XGBoost model.

Run from the project root, AFTER preprocessing.py:
    python ml/train_xgboost.py
"""

import json
import joblib
import numpy as np
import pandas as pd
from xgboost import XGBClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    classification_report,
    f1_score,
    roc_auc_score,
    confusion_matrix,
)
from sklearn.utils.class_weight import compute_sample_weight

PROCESSED_DIR = "data/processed"
MODELS_DIR = "models"


def load_splits():
    X_train = pd.read_csv(f"{PROCESSED_DIR}/X_train.csv")
    X_test = pd.read_csv(f"{PROCESSED_DIR}/X_test.csv")
    y_train = pd.read_csv(f"{PROCESSED_DIR}/y_train.csv")["risk_label"]
    y_test = pd.read_csv(f"{PROCESSED_DIR}/y_test.csv")["risk_label"]
    with open(f"{PROCESSED_DIR}/metadata.json") as f:
        metadata = json.load(f)
    return X_train, X_test, y_train, y_test, metadata


def evaluate_model(name, model, X_test, y_test, class_order):
    preds = model.predict(X_test)
    probs = model.predict_proba(X_test)

    print(f"\n--- {name} ---")
    print(classification_report(y_test, preds, target_names=class_order, zero_division=0))

    f1_macro = f1_score(y_test, preds, average="macro")
    try:
        auc_macro = roc_auc_score(y_test, probs, multi_class="ovr", average="macro")
    except ValueError:
        auc_macro = float("nan")  # can happen if a class is missing from y_test

    print(f"Macro F1: {f1_macro:.3f}")
    print(f"Macro ROC-AUC (OvR): {auc_macro:.3f}")
    print("Confusion matrix (rows=actual, cols=predicted):")
    print(pd.DataFrame(
        confusion_matrix(y_test, preds),
        index=[f"actual_{c}" for c in class_order],
        columns=[f"pred_{c}" for c in class_order],
    ))
    return {"f1_macro": f1_macro, "auc_macro": auc_macro}


def main():
    print("Loading processed splits...")
    X_train, X_test, y_train, y_test, metadata = load_splits()
    class_order = metadata["class_order"]

    # Sample weights: inverse-frequency weighting so the 4,591 "Low" rows
    # don't drown out "High" (only ~75 rows) during training
    sample_weights = compute_sample_weight(class_weight="balanced", y=y_train)

    # --- Baseline: Random Forest ---
    rf = RandomForestClassifier(
        n_estimators=200, max_depth=8, class_weight="balanced", random_state=42
    )
    rf.fit(X_train, y_train)
    rf_metrics = evaluate_model("Random Forest (baseline)", rf, X_test, y_test, class_order)

    # --- Primary: XGBoost ---
    xgb = XGBClassifier(
        n_estimators=300,
        max_depth=5,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        objective="multi:softprob",
        num_class=len(class_order),
        eval_metric="mlogloss",
        random_state=42,
    )
    xgb.fit(X_train, y_train, sample_weight=sample_weights)
    xgb_metrics = evaluate_model("XGBoost (primary)", xgb, X_test, y_test, class_order)

    # --- Save primary model + a small results summary ---
    joblib.dump(xgb, f"{MODELS_DIR}/xgboost_model.pkl")

    results = {
        "random_forest_baseline": rf_metrics,
        "xgboost": xgb_metrics,
        "class_order": class_order,
    }
    with open(f"{MODELS_DIR}/training_results.json", "w") as f:
        json.dump(results, f, indent=2)

    print(f"\nSaved xgboost_model.pkl to {MODELS_DIR}/")
    print(f"Saved training_results.json to {MODELS_DIR}/")
    print("\nSummary:")
    print(f"  Random Forest -> macro F1: {rf_metrics['f1_macro']:.3f}, macro AUC: {rf_metrics['auc_macro']:.3f}")
    print(f"  XGBoost       -> macro F1: {xgb_metrics['f1_macro']:.3f}, macro AUC: {xgb_metrics['auc_macro']:.3f}")


if __name__ == "__main__":
    main()
