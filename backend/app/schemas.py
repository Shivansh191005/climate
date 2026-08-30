"""
LandSafe AI backend - Pydantic schemas (request/response contracts)
"""

from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, Field


class PredictionRequest(BaseModel):
    location_name: str = Field(..., examples=["Darjeeling"])
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    temperature: float = Field(..., description="Degrees Celsius")
    humidity: float = Field(..., ge=0, le=100)
    precipitation: float = Field(..., ge=0, description="mm")
    soil_moisture: float = Field(..., ge=0, le=100)
    elevation: float = Field(..., ge=0, description="meters")


class FactorContribution(BaseModel):
    factor: str
    percentage: float


class PredictionResponse(BaseModel):
    id: int
    location_name: str
    latitude: Optional[float]
    longitude: Optional[float]
    env_probability: float
    env_risk_level: str
    terrain_probability: Optional[float] = None
    terrain_label: Optional[str] = None
    final_probability: float
    final_risk_level: str
    top_factors: List[FactorContribution]
    created_at: datetime

    class Config:
        from_attributes = True


class ImagePredictionResponse(BaseModel):
    terrain_label: str
    terrain_probability: float


class AlertResponse(BaseModel):
    id: int
    prediction_id: int
    location_name: str
    risk_level: str
    probability: float
    message: str
    acknowledged: bool
    created_at: datetime

    class Config:
        from_attributes = True


class AssistantExplainRequest(BaseModel):
    prediction_id: int
    question: Optional[str] = Field(
        default=None,
        description="Optional free-form question, e.g. 'why is this HIGH risk?'",
    )


class AssistantExplainResponse(BaseModel):
    explanation: str
    source: str  # "bedrock" or "local_fallback"


class AdminStatsResponse(BaseModel):
    total_predictions: int
    risk_level_counts: dict[str, int]
    total_alerts: int
    unacknowledged_alerts: int
    avg_final_probability: float
    predictions_with_terrain_image: int


class ModelInfoResponse(BaseModel):
    tabular_training_results: Optional[dict] = None
    cnn_training_results: Optional[dict] = None
    environmental_weight: float
    terrain_weight: float
    high_risk_alert_threshold: float
    bedrock_enabled: bool
