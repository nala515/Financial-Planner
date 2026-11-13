from fastapi import APIRouter
from backend.database import SessionLocal
from backend import services

router = APIRouter()


@router.get("/api/analytics/money-movement")
def api_get_money_movement():
    db = SessionLocal()
    try:
        return services.get_money_movement(db)
    finally:
        db.close()
