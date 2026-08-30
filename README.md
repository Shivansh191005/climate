# LandSafe AI — AI-Powered Landslide Risk Prediction & Early Warning Platform

Student/SIH project. Predicts landslide risk for a location from
environmental data (XGBoost) and, optionally, a terrain photo (CNN),
explains the prediction with real SHAP values, and offers a plain-language
AI explanation (Amazon Bedrock, with a local fallback when Bedrock isn't
configured).

## Status
- ✅ Stage 1 — Data + ML/DL (trained: XGBoost macro F1 0.997, CNN val acc 0.849)
- ✅ Stage 2 — Backend (FastAPI + PostgreSQL) — predict, history (filter/delete/trend), alerts (delete/bulk-ack), AI assistant, admin stats + model-info
- ✅ Stage 3 — Frontend (React + TS + Tailwind + Leaflet + Recharts + Framer Motion) — dashboard, location search + reverse geocoding, animated risk gauge, SHAP chart, terrain upload, history (filter/delete/trend sparkline/CSV export), alerts, AI assistant, admin + model-transparency panel, dark mode, PDF/print export, toast notifications
- ✅ Stage 4 — Integration + debugging — map zoom bug fixed, risk-blending bug fixed (see Notes), config path bug fixed
- ⬜ Stage 5 — AWS deployment (you're doing this yourself, whenever you're ready)

## What's new in this round
- **Bug fix**: risk-blending formula no longer collapses confident "Low" predictions into "Moderate" (see `backend/app/ml_service.py::combine_risk` docstring for the root cause)
- **Location search + reverse geocoding**: type a place name or click the map — both fill in coordinates and the place name automatically (free OpenStreetMap Nominatim, no API key)
- **Quick-demo presets**: Low/Moderate/High buttons fill realistic values from the actual training data's per-class averages
- **History**: filter by risk level, delete a prediction, expand a location to see its risk trend over time (sparkline), export filtered results to CSV
- **Alerts**: delete an alert, acknowledge all at once
- **Admin panel**: added a model-transparency section showing real training metrics (F1/AUC/CNN accuracy) and current config (risk-blend weights, alert threshold, Bedrock status) — read live from your training results JSON and `.env`, nothing hardcoded
- **Dark mode** (persisted, respects system preference by default)
- **Print/Save-as-PDF** on a prediction result (styled print stylesheet, no extra library)
- **Toast notifications** for prediction results and errors

## Project layout
```
landsafe-ai/
├── ml/            Stage 1: preprocessing + training scripts (see ml/README.md)
├── models/         Trained model artifacts (xgboost_model.pkl, cnn_model.pth,
│                    scaler.pkl, label_encoder.pkl) — put your trained files here,
│                    not committed to git (too large)
├── data/           Raw + processed datasets
├── backend/        Stage 2: FastAPI app (see backend/README below)
└── frontend/       Stage 3: React dashboard (see frontend/README below)
```

## Quick start (local)

### 1. Models
Copy your trained `xgboost_model.pkl`, `scaler.pkl`, `label_encoder.pkl`,
`cnn_model.pth` into `models/` (you already have these from Stage 1 training —
they weren't included in this zip since I never had the actual files, only
your training-results JSON).

### 2. Database (native PostgreSQL — no Docker)

Install PostgreSQL locally if you haven't already:
- **Windows**: download the installer from postgresql.org, or `winget install PostgreSQL.PostgreSQL`
- **macOS**: `brew install postgresql@16 && brew services start postgresql@16`
- **Linux (Debian/Ubuntu)**: `sudo apt install postgresql && sudo systemctl start postgresql`

Then create the database and set a password matching `.env` (defaults below assume user `postgres` / password `postgres` — adjust either side to match):
```
psql -U postgres -c "CREATE DATABASE landsafe;"
psql -U postgres -c "ALTER USER postgres WITH PASSWORD 'postgres';"
```

```
cd backend
cp .env.example .env          # edit DATABASE_URL here if your username/password differ
```

The backend creates its tables automatically on first run (`Base.metadata.create_all`) — no separate migration step needed.

### 3. Backend
```
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```
API docs: http://localhost:8000/docs

### 4. Frontend
```
cd frontend
npm install
cp .env.example .env          # points at http://localhost:8000 by default
npm run dev
```
App: http://localhost:5173

## Notes
- The tabular dataset (`regenerated_landslide_risk_dataset.csv`) is a
  synthetic/rule-generated dataset, not field-measured data — say so in
  your report/demo rather than implying it's real sensor data.
- Environmental values (temperature, humidity, etc.) are still entered
  manually — location search only fills in the place name and coordinates,
  not weather data. A live weather-API lookup would be a natural next step
  but stays out for now to keep scope moderate.
- New frontend dependency: `framer-motion` (added to `package.json`, installs
  normally with `npm install`).
- Bedrock is OFF by default (`BEDROCK_ENABLED=false` in backend/.env) since
  you haven't set up AWS credentials yet. The AI Assistant panel still works —
  it falls back to a local, SHAP-based explanation. Flip `BEDROCK_ENABLED=true`
  and fill in AWS credentials/region once you're ready for Stage 5.
- Risk blending (70% environmental / 30% terrain) lives in
  `backend/app/ml_service.py::combine_risk` — documented there as a prototype
  design assumption, not a validated formula.
- No Docker — Postgres is a native local install (see step 2 above). If you'd
  rather containerize it later, that's a one-file addition, just ask.
- I could not actually run the backend or `npm run dev` in this sandbox (no
  network to install FastAPI/SQLAlchemy/torch or npm packages here). I did
  run and verify `preprocessing.py` against your real data, and syntax-checked
  every backend Python file, and you've already confirmed the frontend renders
  and round-trips predictions through the backend correctly. Keep testing edge
  cases (image upload, Ask AI, Admin panel) before considering Stage 4 fully closed.
