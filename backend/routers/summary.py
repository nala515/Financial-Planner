
from fastapi import APIRouter, Query
from datetime import date
from backend.database import SessionLocal
from backend import services
from typing import Literal

router = APIRouter()

@router.get("/api/accounts/{account_id}/summary")
def api_get_growth(
    account_id: int,
    start: date,
    end: date,
):
    db = SessionLocal()
    try:
        return services.calculate_growth(db, account_id, start, end)
    finally:
        db.close()


@router.get("/api/analytics/savings-summary")
def api_get_savings_summary(granularity: Literal["month", "year"] = "month"):
    db = SessionLocal()
    try:
        return services.get_savings_summary(db, granularity)
    finally:
        db.close()


@router.get("/api/dashboard")
def api_get_dashboard_data():
    db = SessionLocal()
    try:
        return services.get_dashboard_data(db)
    finally:
        db.close()
