from fastapi import APIRouter, Query
from typing import Literal
from datetime import date
from backend.database import SessionLocal
from backend import services

router = APIRouter()

@router.get("/api/analytics/account-summary")
def api_get_account_summary(
    account_ids: list[int] = Query(...),
    granularity: Literal["month", "year"] = "month",
):
    db = SessionLocal()

    try:
        return services.get_account_summary(db, account_ids, granularity)
    finally:
        db.close()
