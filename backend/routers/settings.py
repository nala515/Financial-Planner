
from fastapi import APIRouter
from backend.database import SessionLocal
from backend import services, schemas

router = APIRouter()


@router.get("/api/settings")
def get_settings():
    db = SessionLocal()

    try:
        return services.get_settings(db)
    finally:
        db.close()


@router.post("/api/settings")
def create_settings(settings_data: schemas.SettingsCreate):
    db = SessionLocal()

    try:
        return services.create_settings(db, settings_data)
    finally:
        db.close()


@router.patch("/api/settings")
def update_settings(settings_data: schemas.SettingsUpdate):
    db = SessionLocal()

    try:
        return services.update_settings(db, settings_data)
    finally:
        db.close()