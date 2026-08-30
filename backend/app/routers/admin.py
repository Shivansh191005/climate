"""
LandSafe AI backend - admin stats

GET /admin/stats -> lightweight aggregate counts for the Admin dashboard
section (total predictions, risk-level breakdown, alert counts). Deliberately
simple - no auth, no pagination - matching the project's "basic system
statistics" scope, not a full admin panel.

GET /admin/model-info -> training metrics + current risk-blend config, read
straight from the JSON files ml/train_xgboost.py and ml/train_cnn.py already
produce, plus the live settings from app/config.py. Powers an "About the
model" transparency panel - no separate bookkeeping to keep in sync.
"""

import json
import os

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.config import settings
from app import models, schemas

router = APIRouter(prefix="/admin", tags=["admin"])

# Paths are relative to the backend/ working directory, same convention as
# the model artifact paths in app/config.py
_TRAINING_RESULTS_PATH = "../models/training_results.json"
_CNN_RESULTS_PATH = "../models/cnn_training_results.json"


@router.get("/stats", response_model=schemas.AdminStatsResponse)
def get_stats(db: Session = Depends(get_db)):
    total_predictions = db.query(func.count(models.Prediction.id)).scalar() or 0

    risk_counts_query = (
        db.query(models.Prediction.final_risk_level, func.count(models.Prediction.id))
        .group_by(models.Prediction.final_risk_level)
        .all()
    )
    risk_level_counts = {level: 0 for level in ("Low", "Moderate", "High")}
    for level, count in risk_counts_query:
        risk_level_counts[level] = count

    total_alerts = db.query(func.count(models.Alert.id)).scalar() or 0
    unacknowledged_alerts = (
        db.query(func.count(models.Alert.id))
        .filter(models.Alert.acknowledged == False)  # noqa: E712
        .scalar()
        or 0
    )

    avg_probability = db.query(func.avg(models.Prediction.final_probability)).scalar()
    predictions_with_terrain = (
        db.query(func.count(models.Prediction.id))
        .filter(models.Prediction.terrain_label.isnot(None))
        .scalar()
        or 0
    )

    return schemas.AdminStatsResponse(
        total_predictions=total_predictions,
        risk_level_counts=risk_level_counts,
        total_alerts=total_alerts,
        unacknowledged_alerts=unacknowledged_alerts,
        avg_final_probability=round(float(avg_probability), 3) if avg_probability else 0.0,
        predictions_with_terrain_image=predictions_with_terrain,
    )


@router.get("/model-info", response_model=schemas.ModelInfoResponse)
def get_model_info():
    def _load_json(path: str):
        if not os.path.exists(path):
            return None
        with open(path) as f:
            return json.load(f)

    return schemas.ModelInfoResponse(
        tabular_training_results=_load_json(_TRAINING_RESULTS_PATH),
        cnn_training_results=_load_json(_CNN_RESULTS_PATH),
        environmental_weight=settings.environmental_weight,
        terrain_weight=settings.terrain_weight,
        high_risk_alert_threshold=settings.high_risk_alert_threshold,
        bedrock_enabled=settings.bedrock_enabled,
    )
