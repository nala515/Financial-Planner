from fastapi import APIRouter
from backend.database import SessionLocal
from backend import services, schemas

router = APIRouter()


@router.get("/api/settings", response_model=schemas.SettingsResponse)
def get_settings():
    db = SessionLocal()

    try:
        return services.get_settings(db)
    finally:
        db.close()


@router.patch("/api/settings", response_model=schemas.SettingsResponse)
def update_settings(settings_data: schemas.SettingsUpdate):
    db = SessionLocal()

    try:
        return services.update_settings(db, settings_data)
    finally:
        db.close()
