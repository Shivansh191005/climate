"""
LandSafe AI - Tabular data preprocessing
Loads the raw environmental CSV, cleans it, merges the High/Very High
risk classes, encodes the target, splits train/test, scales features,
and saves everything needed for training + later inference.

Run from the project root:
    python ml/preprocessing.py
"""

import os
import json
import joblib
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder

RAW_PATH = "data/raw/tabular/regenerated_landslide_risk_dataset.csv"
PROCESSED_DIR = "data/processed"
MODELS_DIR = "models"

FEATURE_COLUMNS = [
    "Temperature (°C)",
    "Humidity (%)",
    "Precipitation (mm)",
    "Soil Moisture (%)",
    "Elevation (m)",
]
TARGET_COLUMN = "Landslide Risk Prediction"

# Clean, code-friendly names used everywhere downstream (API, frontend, SHAP labels)
FEATURE_RENAME = {
    "Temperature (°C)": "temperature",
    "Humidity (%)": "humidity",
    "Precipitation (mm)": "precipitation",
    "Soil Moisture (%)": "soil_moisture",
    "Elevation (m)": "elevation",
}

# Merge High + Very High -> High (per class-imbalance decision)
CLASS_MERGE_MAP = {
    "Low": "Low",
    "Moderate": "Moderate",
    "High": "High",
    "Very High": "High",
}

# Fixed class order so risk_level always reads Low -> Moderate -> High
CLASS_ORDER = ["Low", "Moderate", "High"]


def load_raw_data(path: str) -> pd.DataFrame:
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"Could not find {path}. Make sure the CSV is at "
            f"data/raw/tabular/regenerated_landslide_risk_dataset.csv"
        )
    df = pd.read_csv(path)
    return df


def clean_data(df: pd.DataFrame) -> pd.DataFrame:
    before = len(df)
    df = df.drop_duplicates()
    df = df.dropna(subset=FEATURE_COLUMNS + [TARGET_COLUMN])
    after = len(df)
    if before != after:
        print(f"Dropped {before - after} duplicate/null rows")
    return df


def merge_risk_classes(df: pd.DataFrame) -> pd.DataFrame:
    df[TARGET_COLUMN] = df[TARGET_COLUMN].map(CLASS_MERGE_MAP)
    unmapped = df[TARGET_COLUMN].isna().sum()
    if unmapped > 0:
        raise ValueError(
            f"{unmapped} rows had a risk label not in CLASS_MERGE_MAP - "
            f"check for typos/new categories in the raw CSV"
        )
    return df


def main():
    print("Loading raw data...")
    df = load_raw_data(RAW_PATH)
    print(f"Loaded {len(df)} rows")

    df = clean_data(df)
    df = merge_risk_classes(df)

    print("\nClass distribution after merging High + Very High:")
    print(df[TARGET_COLUMN].value_counts())

    # Rename feature columns to clean snake_case
    df = df.rename(columns=FEATURE_RENAME)
    feature_cols = list(FEATURE_RENAME.values())

    X = df[feature_cols]
    y_raw = df[TARGET_COLUMN]

    # Encode target with a fixed, known class order (not alphabetical)
    label_encoder = LabelEncoder()
    label_encoder.fit(CLASS_ORDER)
    y = label_encoder.transform(y_raw)

    # Stratified split keeps class proportions consistent in train/test
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    # Scale features (fit on train only, to avoid leakage)
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    os.makedirs(PROCESSED_DIR, exist_ok=True)
    os.makedirs(MODELS_DIR, exist_ok=True)

    # Save processed splits (unscaled versions kept too - XGBoost doesn't need scaling,
    # but we keep both so evaluate.py / explain.py can use whichever is appropriate)
    pd.DataFrame(X_train, columns=feature_cols).to_csv(f"{PROCESSED_DIR}/X_train.csv", index=False)
    pd.DataFrame(X_test, columns=feature_cols).to_csv(f"{PROCESSED_DIR}/X_test.csv", index=False)
    pd.Series(y_train, name="risk_label").to_csv(f"{PROCESSED_DIR}/y_train.csv", index=False)
    pd.Series(y_test, name="risk_label").to_csv(f"{PROCESSED_DIR}/y_test.csv", index=False)

    # Save scaler + label encoder for inference-time reuse
    joblib.dump(scaler, f"{MODELS_DIR}/scaler.pkl")
    joblib.dump(label_encoder, f"{MODELS_DIR}/label_encoder.pkl")

    # Save a small metadata file so the backend/inference code knows the
    # feature order and class order without re-deriving them
    metadata = {
        "feature_columns": feature_cols,
        "class_order": CLASS_ORDER,
        "n_train": len(X_train),
        "n_test": len(X_test),
    }
    with open(f"{PROCESSED_DIR}/metadata.json", "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"\nSaved processed train/test splits to {PROCESSED_DIR}/")
    print(f"Saved scaler.pkl and label_encoder.pkl to {MODELS_DIR}/")
    print(f"Train size: {len(X_train)}, Test size: {len(X_test)}")


if __name__ == "__main__":
    main()
