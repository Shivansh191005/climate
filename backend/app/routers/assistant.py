"""
LandSafe AI backend - AI assistant endpoint

POST /assistant/explain -> plain-language explanation of a past prediction,
                            via Bedrock if configured, else a local fallback
                            built from the real SHAP factors.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.bedrock_service import explain_prediction
from app.routers.history import _parse_factors

router = APIRouter(prefix="/assistant", tags=["assistant"])


@router.post("/explain", response_model=schemas.AssistantExplainResponse)
def explain(req: schemas.AssistantExplainRequest, db: Session = Depends(get_db)):
    prediction = db.query(models.Prediction).filter(
        models.Prediction.id == req.prediction_id
    ).first()
    if not prediction:
        raise HTTPException(status_code=404, detail="Prediction not found")

    top_factors = [f.model_dump() for f in _parse_factors(prediction.top_factors)]

    explanation, source = explain_prediction(
        location_name=prediction.location_name,
        risk_level=prediction.final_risk_level,
        probability=prediction.final_probability,
        top_factors=top_factors,
        terrain_label=prediction.terrain_label,
        user_question=req.question,
    )
    return schemas.AssistantExplainResponse(explanation=explanation, source=source)
