
from fastapi import APIRouter, Query
from backend.database import SessionLocal
from backend import services
from typing import Literal

router = APIRouter()

@router.get("/api/analytics/savings-summary")
def api_get_savings_summary(granularity: Literal["month", "year"] = "month"):
    db = SessionLocal()
    try:
        return services.get_savings_summary(db, granularity)
    finally:
        db.close()
