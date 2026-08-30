"""
LandSafe AI backend - configuration

Reads settings from environment variables (see .env.example). Every
setting has a safe local-dev default so `uvicorn app.main:app` works
out of the box against a local Postgres, with Bedrock disabled until
you add real AWS credentials.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # --- Database ---
    database_url: str = "postgresql://postgres:postgres@localhost:5432/landsafe"

    # --- Model artifact paths (relative to the backend/ working directory,
    # so ../models/... resolves to the project-root models/ folder) ---
    xgboost_model_path: str = "../models/xgboost_model.pkl"
    scaler_path: str = "../models/scaler.pkl"
    label_encoder_path: str = "../models/label_encoder.pkl"
    cnn_model_path: str = "../models/cnn_model.pth"

    # --- Risk blending (per project's documented prototype assumption) ---
    environmental_weight: float = 0.7
    terrain_weight: float = 0.3

    # --- Alerts ---
    high_risk_alert_threshold: float = 0.6  # probability above which we raise an alert

    # --- AWS Bedrock (optional - leave blank to use the local fallback explainer) ---
    aws_region: str = "us-east-1"
    bedrock_model_id: str = "anthropic.claude-3-haiku-20240307-v1:0"
    bedrock_enabled: bool = False

    # --- CORS ---
    frontend_origin: str = "http://localhost:5173"

    class Config:
        env_file = ".env"


settings = Settings()
