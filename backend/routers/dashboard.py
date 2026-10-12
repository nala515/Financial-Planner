from fastapi import APIRouter, Query
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
