"""
LandSafe AI backend - prediction endpoints

POST /predict            -> environmental (tabular) prediction only
POST /predict/image      -> terrain (CNN) prediction only, no DB write
POST /predict/combined   -> both + blended final risk, saved to history,
                             auto-creates an Alert if final risk crosses the threshold
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import settings
from app import models, schemas
from app.ml_service import ml_service, ModelLoadError

router = APIRouter(prefix="/predict", tags=["prediction"])


def _run_tabular(req: schemas.PredictionRequest):
    features = {
        "temperature": req.temperature,
        "humidity": req.humidity,
        "precipitation": req.precipitation,
        "soil_moisture": req.soil_moisture,
        "elevation": req.elevation,
    }
    try:
        probability, risk_level, shap_factors = ml_service.predict_tabular(features)
    except ModelLoadError as e:
        raise HTTPException(status_code=503, detail=str(e))
    return probability, risk_level, shap_factors


@router.post("", response_model=schemas.PredictionResponse)
def predict_environmental(req: schemas.PredictionRequest, db: Session = Depends(get_db)):
    """Environmental-only prediction (no terrain image), saved to history."""
    probability, risk_level, shap_factors = _run_tabular(req)
    final_probability, final_risk_level = ml_service.combine_risk(
        probability, risk_level, terrain_label=None, terrain_probability=None
    )

    prediction = _save_prediction(db, req, probability, risk_level, None, None,
                                   final_probability, final_risk_level, shap_factors)
    return _to_response(prediction, shap_factors)


@router.post("/image", response_model=schemas.ImagePredictionResponse)
def predict_terrain_image(file: UploadFile = File(...)):
    """Terrain-only classification, standalone (not saved - combine with /predict/combined to persist)."""
    if file.content_type not in ("image/jpeg", "image/png", "image/jpg"):
        raise HTTPException(status_code=400, detail="Upload a JPEG or PNG image")

    image_bytes = file.file.read()
    try:
        label, probability = ml_service.predict_image(image_bytes)
    except ModelLoadError as e:
        raise HTTPException(status_code=503, detail=str(e))

    return schemas.ImagePredictionResponse(terrain_label=label, terrain_probability=probability)


@router.post("/combined", response_model=schemas.PredictionResponse)
def predict_combined(
    location_name: str = Form(...),
    latitude: float | None = Form(None),
    longitude: float | None = Form(None),
    temperature: float = Form(...),
    humidity: float = Form(...),
    precipitation: float = Form(...),
    soil_moisture: float = Form(...),
    elevation: float = Form(...),
    file: UploadFile | None = File(None),
    db: Session = Depends(get_db),
):
    """Full prediction: environmental model + optional terrain image, blended per the 70/30 rule."""
    req = schemas.PredictionRequest(
        location_name=location_name, latitude=latitude, longitude=longitude,
        temperature=temperature, humidity=humidity, precipitation=precipitation,
        soil_moisture=soil_moisture, elevation=elevation,
    )
    probability, risk_level, shap_factors = _run_tabular(req)

    terrain_label, terrain_probability = None, None
    if file is not None:
        image_bytes = file.file.read()
        try:
            terrain_label, terrain_probability = ml_service.predict_image(image_bytes)
        except ModelLoadError as e:
            raise HTTPException(status_code=503, detail=str(e))

    final_probability, final_risk_level = ml_service.combine_risk(
        probability, risk_level, terrain_label, terrain_probability
    )

    prediction = _save_prediction(db, req, probability, risk_level,
                                   terrain_label, terrain_probability,
                                   final_probability, final_risk_level, shap_factors)
    return _to_response(prediction, shap_factors)


def _save_prediction(db, req, env_probability, env_risk_level, terrain_label,
                      terrain_probability, final_probability, final_risk_level, shap_factors):
    factors_str = ",".join(f"{f['factor']}:{f['percentage']}" for f in shap_factors)

    prediction = models.Prediction(
        location_name=req.location_name,
        latitude=req.latitude,
        longitude=req.longitude,
        temperature=req.temperature,
        humidity=req.humidity,
        precipitation=req.precipitation,
        soil_moisture=req.soil_moisture,
        elevation=req.elevation,
        env_probability=env_probability,
        env_risk_level=env_risk_level,
        terrain_probability=terrain_probability,
        terrain_label=terrain_label,
        final_probability=final_probability,
        final_risk_level=final_risk_level,
        top_factors=factors_str,
    )
    db.add(prediction)
    db.commit()
    db.refresh(prediction)

    if final_probability >= settings.high_risk_alert_threshold:
        alert = models.Alert(
            prediction_id=prediction.id,
            location_name=prediction.location_name,
            risk_level=final_risk_level,
            probability=final_probability,
            message=(
                f"{final_risk_level.upper()} landslide risk detected at "
                f"{prediction.location_name} ({final_probability * 100:.0f}% confidence)."
            ),
        )
        db.add(alert)
        db.commit()

    return prediction


def _to_response(prediction: models.Prediction, shap_factors: list[dict]) -> schemas.PredictionResponse:
    return schemas.PredictionResponse(
        id=prediction.id,
        location_name=prediction.location_name,
        latitude=prediction.latitude,
        longitude=prediction.longitude,
        env_probability=prediction.env_probability,
        env_risk_level=prediction.env_risk_level,
        terrain_probability=prediction.terrain_probability,
        terrain_label=prediction.terrain_label,
        final_probability=prediction.final_probability,
        final_risk_level=prediction.final_risk_level,
        top_factors=[schemas.FactorContribution(**f) for f in shap_factors],
        created_at=prediction.created_at,
    )
