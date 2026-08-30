"""
LandSafe AI backend - ORM models

Two tables:
  - predictions: every prediction the user runs (tabular + optional image)
  - alerts: auto-created when a prediction crosses the high-risk threshold
"""

from datetime import datetime

from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship

from app.database import Base


class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, index=True)
    location_name = Column(String, nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

    # Inputs
    temperature = Column(Float, nullable=False)
    humidity = Column(Float, nullable=False)
    precipitation = Column(Float, nullable=False)
    soil_moisture = Column(Float, nullable=False)
    elevation = Column(Float, nullable=False)

    # Environmental (tabular) model output
    env_probability = Column(Float, nullable=False)
    env_risk_level = Column(String, nullable=False)

    # Terrain (CNN) model output - nullable, since image upload is optional
    terrain_probability = Column(Float, nullable=True)
    terrain_label = Column(String, nullable=True)

    # Combined final risk (per the 70/30 blend, or env-only if no image given)
    final_probability = Column(Float, nullable=False)
    final_risk_level = Column(String, nullable=False)

    # Top SHAP factors, stored as a simple "name:pct,name:pct" string
    # (kept simple deliberately - a JSON column would also work fine here)
    top_factors = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    alerts = relationship("Alert", back_populates="prediction")


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    prediction_id = Column(Integer, ForeignKey("predictions.id"), nullable=False)
    location_name = Column(String, nullable=False)
    risk_level = Column(String, nullable=False)
    probability = Column(Float, nullable=False)
    message = Column(String, nullable=False)
    acknowledged = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    prediction = relationship("Prediction", back_populates="alerts")
