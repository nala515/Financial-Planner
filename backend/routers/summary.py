from fastapi import APIRouter
from datetime import date
from backend.database import SessionLocal
from backend import services

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
