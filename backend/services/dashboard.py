from fastapi import APIRouter
from backend.database import SessionLocal
from backend import services

router = APIRouter()

@router.get("/api/dashboard")
def api_get_dashboard_data():
    db = SessionLocal()
    try:
        return services.get_dashboard_data(db)
    finally:
        db.close()


@router.get("/api/dashboard/monthly-change")
def api_get_monthly_change():
    db = SessionLocal()
    try:
        return services.get_monthly_change(db)
    finally:
        db.close()
