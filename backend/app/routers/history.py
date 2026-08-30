"""
LandSafe AI backend - prediction history

GET    /history                     -> most recent predictions (paginated, filterable)
GET    /history/{id}                -> a single prediction by id
DELETE /history/{id}                -> delete a prediction
GET    /history/trend/{location}    -> chronological (probability, timestamp) pairs
                                        for one location, for a sparkline chart
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import asc, desc

from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/history", tags=["history"])


def _parse_factors(factors_str: str | None):
    if not factors_str:
        return []
    factors = []
    for part in factors_str.split(","):
        name, pct = part.split(":")
        factors.append(schemas.FactorContribution(factor=name, percentage=float(pct)))
    return factors


def _to_response(p: models.Prediction) -> schemas.PredictionResponse:
    return schemas.PredictionResponse(
        id=p.id, location_name=p.location_name, latitude=p.latitude, longitude=p.longitude,
        env_probability=p.env_probability, env_risk_level=p.env_risk_level,
        terrain_probability=p.terrain_probability, terrain_label=p.terrain_label,
        final_probability=p.final_probability, final_risk_level=p.final_risk_level,
        top_factors=_parse_factors(p.top_factors), created_at=p.created_at,
    )


@router.get("", response_model=list[schemas.PredictionResponse])
def list_history(
    limit: int = Query(default=20, le=200),
    offset: int = Query(default=0, ge=0),
    location_name: str | None = None,
    risk_level: str | None = Query(default=None, pattern="^(Low|Moderate|High)$"),
    db: Session = Depends(get_db),
):
    query = db.query(models.Prediction).order_by(desc(models.Prediction.created_at))
    if location_name:
        query = query.filter(models.Prediction.location_name.ilike(f"%{location_name}%"))
    if risk_level:
        query = query.filter(models.Prediction.final_risk_level == risk_level)
    predictions = query.offset(offset).limit(limit).all()
    return [_to_response(p) for p in predictions]


@router.get("/trend/{location_name}")
def get_location_trend(location_name: str, limit: int = Query(default=30, le=200), db: Session = Depends(get_db)):
    """Chronological risk trend for one location - powers the history sparkline chart."""
    predictions = (
        db.query(models.Prediction)
        .filter(models.Prediction.location_name.ilike(location_name))
        .order_by(asc(models.Prediction.created_at))
        .limit(limit)
        .all()
    )
    return [
        {
            "created_at": p.created_at,
            "final_probability": p.final_probability,
            "final_risk_level": p.final_risk_level,
        }
        for p in predictions
    ]


@router.get("/{prediction_id}", response_model=schemas.PredictionResponse)
def get_prediction(prediction_id: int, db: Session = Depends(get_db)):
    p = db.query(models.Prediction).filter(models.Prediction.id == prediction_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Prediction not found")
    return _to_response(p)


@router.delete("/{prediction_id}")
def delete_prediction(prediction_id: int, db: Session = Depends(get_db)):
    p = db.query(models.Prediction).filter(models.Prediction.id == prediction_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Prediction not found")
    # Delete dependent alerts first (no cascade configured - keep it explicit/simple)
    db.query(models.Alert).filter(models.Alert.prediction_id == prediction_id).delete()
    db.delete(p)
    db.commit()
    return {"deleted": True, "id": prediction_id}
