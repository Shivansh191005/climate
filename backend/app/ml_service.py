"""
LandSafe AI backend - ML inference service

Loads the trained artifacts once at startup and exposes:
  - predict_tabular(features) -> (probability, risk_level, shap_factors)
  - predict_image(image_bytes) -> (label, probability)
  - combine_risk(env_prob, terrain_prob) -> (final_prob, final_level)

Model files are NOT included in the repo (too large for git) - they're
expected at the paths in app/config.py (models/xgboost_model.pkl etc.),
matching exactly what ml/train_xgboost.py and ml/train_cnn.py produce.
"""

import io
import json
import joblib
import numpy as np
import shap
import torch
from PIL import Image
from torchvision import models as tv_models, transforms

from app.config import settings

CLASS_ORDER = ["Low", "Moderate", "High"]
FEATURE_ORDER = ["temperature", "humidity", "precipitation", "soil_moisture", "elevation"]
IMG_SIZE = 224

# Non-overlapping severity bands used by combine_risk() - see that method's
# docstring for why these need gaps between them.
_SEVERITY_BANDS = {
    "Low": {"low": 0.05, "high": 0.30},
    "Moderate": {"low": 0.35, "high": 0.60},
    "High": {"low": 0.70, "high": 0.95},
}

_device = torch.device("cuda" if torch.cuda.is_available() else "cpu")


class ModelLoadError(RuntimeError):
    """Raised when a required model artifact is missing at startup."""


class MLService:
    def __init__(self):
        self._xgb_model = None
        self._scaler = None
        self._label_encoder = None
        self._shap_explainer = None
        self._cnn_model = None
        self._cnn_class_names = None
        self._cnn_transform = transforms.Compose([
            transforms.Resize((IMG_SIZE, IMG_SIZE)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])

    # ---------- lazy loaders (so the API can start even before you've trained everything) ----------

    def _load_tabular(self):
        if self._xgb_model is not None:
            return
        try:
            self._xgb_model = joblib.load(settings.xgboost_model_path)
            self._scaler = joblib.load(settings.scaler_path)
            self._label_encoder = joblib.load(settings.label_encoder_path)
            self._shap_explainer = shap.TreeExplainer(self._xgb_model)
        except FileNotFoundError as e:
            raise ModelLoadError(
                f"Tabular model artifacts not found ({e}). Run ml/preprocessing.py "
                f"and ml/train_xgboost.py first, and confirm the paths in "
                f"app/config.py match your models/ folder."
            )

    def _load_cnn(self):
        if self._cnn_model is not None:
            return
        try:
            checkpoint = torch.load(settings.cnn_model_path, map_location=_device)
        except FileNotFoundError as e:
            raise ModelLoadError(
                f"CNN model not found ({e}). Run ml/train_cnn.py first, or skip "
                f"image upload - the tabular prediction works independently."
            )
        class_names = checkpoint["class_names"]
        model = tv_models.resnet18(weights=None)
        model.fc = torch.nn.Linear(model.fc.in_features, len(class_names))
        model.load_state_dict(checkpoint["model_state_dict"])
        model.to(_device)
        model.eval()
        self._cnn_model = model
        self._cnn_class_names = class_names

    # ---------- tabular prediction ----------

    def predict_tabular(self, features: dict):
        """
        features: dict with keys matching FEATURE_ORDER (raw, unscaled values)
        Returns: (probability: float, risk_level: str, shap_factors: list[dict])
        """
        self._load_tabular()

        x_raw = np.array([[features[f] for f in FEATURE_ORDER]])
        
        # XGBoost was trained on unscaled data, so we use x_raw directly
        probs = self._xgb_model.predict_proba(x_raw)[0]  # shape (3,)
        pred_class_idx = int(np.argmax(probs))
        risk_level = self._label_encoder.inverse_transform([pred_class_idx])[0]

        # "Probability" shown to the user = confidence in the predicted class
        probability = float(probs[pred_class_idx])

        shap_factors = self._compute_shap_factors(x_raw, pred_class_idx)

        return probability, risk_level, shap_factors

    def _compute_shap_factors(self, x_raw: np.ndarray, class_idx: int):
        """Returns top factors as [{"factor": name, "percentage": pct}, ...] using real SHAP values."""
        raw_shap = self._shap_explainer.shap_values(x_raw)

        # shap's return shape differs across versions/model types for multiclass:
        # either a list of per-class arrays, or a single (n_samples, n_features, n_classes) array.
        if isinstance(raw_shap, list):
            class_shap = raw_shap[class_idx][0]  # (n_features,)
        elif raw_shap.ndim == 3:
            class_shap = raw_shap[0, :, class_idx]
        else:
            class_shap = raw_shap[0]

        abs_vals = np.abs(class_shap)
        total = abs_vals.sum()
        if total == 0:
            # Degenerate case (shouldn't normally happen) - even split
            pct = np.full(len(FEATURE_ORDER), 100 / len(FEATURE_ORDER))
        else:
            pct = (abs_vals / total) * 100

        factors = [
            {"factor": FEATURE_ORDER[i], "percentage": round(float(pct[i]), 1)}
            for i in range(len(FEATURE_ORDER))
        ]
        factors.sort(key=lambda f: f["percentage"], reverse=True)
        return factors

    # ---------- image (CNN) prediction ----------

    def predict_image(self, image_bytes: bytes):
        self._load_cnn()

        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        tensor = self._cnn_transform(image).unsqueeze(0).to(_device)

        with torch.no_grad():
            logits = self._cnn_model(tensor)
            probs = torch.softmax(logits, dim=1)[0].cpu().numpy()

        pred_idx = int(np.argmax(probs))
        label = self._cnn_class_names[pred_idx]
        probability = float(probs[pred_idx])
        return label, probability

    # ---------- risk blending ----------

    @staticmethod
    def combine_risk(env_probability: float, env_risk_level: str,
                      terrain_label: str | None, terrain_probability: float | None):
        """
        Blends environmental + terrain risk per the documented prototype rule:
            final = 70% environmental + 30% terrain (env-only if no image given)

        Each predicted class maps to a non-overlapping "severity band" so a
        highly confident prediction never crosses into the neighbouring
        class's bucket:
            Low:      0.05 - 0.30   (bucket cutoff for Low is < 0.33)
            Moderate: 0.35 - 0.60   (bucket cutoffs are 0.33 <= x < 0.66)
            High:     0.70 - 0.95   (bucket cutoff for High is >= 0.66)
        The gaps (0.30-0.35, 0.60-0.70) exist specifically so a maximally
        confident prediction (confidence=1.0) can never land on a bucket
        boundary and get mis-classified into the wrong final risk level -
        that exact collision was the bug that made every confident "Low"
        env prediction show up as "Moderate" after blending.

        This is a simple, clearly-documented design assumption for this
        prototype, NOT a scientifically validated risk model.
        """
        band = _SEVERITY_BANDS[env_risk_level]
        env_component = band["low"] + env_probability * (band["high"] - band["low"])

        if terrain_label is None:
            terrain_component = 0.0
            terrain_weight = 0.0
            env_weight = 1.0
        else:
            terrain_component = terrain_probability if terrain_label == "landslide" else (1 - terrain_probability)
            terrain_weight = settings.terrain_weight
            env_weight = settings.environmental_weight

        final_score = (env_weight * env_component) + (terrain_weight * terrain_component)
        final_score = min(max(final_score, 0.0), 1.0)

        if final_score >= 0.66:
            final_level = "High"
        elif final_score >= 0.33:
            final_level = "Moderate"
        else:
            final_level = "Low"

        return round(final_score, 3), final_level


ml_service = MLService()
