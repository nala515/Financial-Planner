

from fastapi import APIRouter
from backend.database import SessionLocal
from backend import services, schemas

router = APIRouter()


@router.get("/api/income_events")
def api_get_income_events():
    db = SessionLocal()

    try:
        return services.get_income_events(db)
    finally:
        db.close()


@router.get("/api/income_sources")
def api_get_income_sources():
    db = SessionLocal()

    try:
        return services.get_income_sources(db)
    finally:
        db.close()


@router.post("/api/income_event")
def create_income_data(income_data: schemas.IncomeEventCreate):
    db = SessionLocal()

    try:
        return services.create_income_data(db, income_data)
    finally:
        db.close()

@router.post("/api/income_source")
def create_income_source(source_data: schemas.IncomeSourceCreate):
    db = SessionLocal()

    try:
        return services.create_income_source(db, source_data)
    finally:
        db.close()
