"""
LandSafe AI backend - alerts

GET    /alerts                    -> list alerts, newest first (optionally only unacknowledged)
POST   /alerts/{id}/acknowledge   -> mark an alert as acknowledged
POST   /alerts/acknowledge-all    -> mark all unacknowledged alerts as acknowledged
DELETE /alerts/{id}               -> delete an alert
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=list[schemas.AlertResponse])
def list_alerts(
    unacknowledged_only: bool = False,
    limit: int = Query(default=50, le=200),
    db: Session = Depends(get_db),
):
    query = db.query(models.Alert).order_by(desc(models.Alert.created_at))
    if unacknowledged_only:
        query = query.filter(models.Alert.acknowledged == False)  # noqa: E712
    return query.limit(limit).all()


@router.post("/{alert_id}/acknowledge", response_model=schemas.AlertResponse)
def acknowledge_alert(alert_id: int, db: Session = Depends(get_db)):
    alert = db.query(models.Alert).filter(models.Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.acknowledged = True
    db.commit()
    db.refresh(alert)
    return alert


@router.post("/acknowledge-all")
def acknowledge_all(db: Session = Depends(get_db)):
    count = (
        db.query(models.Alert)
        .filter(models.Alert.acknowledged == False)  # noqa: E712
        .update({"acknowledged": True})
    )
    db.commit()
    return {"acknowledged_count": count}


@router.delete("/{alert_id}")
def delete_alert(alert_id: int, db: Session = Depends(get_db)):
    alert = db.query(models.Alert).filter(models.Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    db.delete(alert)
    db.commit()
    return {"deleted": True, "id": alert_id}
