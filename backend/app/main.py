"""
LandSafe AI backend - FastAPI entrypoint

Run locally:
    uvicorn app.main:app --reload

Docs at http://localhost:8000/docs
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app.config import settings
from app.routers import predict, history, alerts, assistant, admin

# Creates tables if they don't exist yet (fine for a student/prototype project;
# a bigger project would use Alembic migrations instead)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="LandSafe AI API",
    description="AI-powered landslide risk prediction & early warning platform",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(predict.router)
app.include_router(history.router)
app.include_router(alerts.router)
app.include_router(assistant.router)
app.include_router(admin.router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
