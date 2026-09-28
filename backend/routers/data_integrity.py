from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend import schemas
from backend.database import get_db
from backend.services import data_integrity as data_integrity_service

router = APIRouter()

def _parse_ym(s: str) -> tuple[int, int]:
    y, m = s.split("-")
    return int(y), int(m)

@router.get("/api/missing-entries", response_model=list[schemas.MissingEntryRow])
def get_missing_entries(
    start: str = "2000-01",
    end: str | None = None,
    db: Session = Depends(get_db),
):
    start_ym = _parse_ym(start)
    end_ym = _parse_ym(end) if end else (date.today().year, date.today().month)
    return data_integrity_service.find_missing_rows(db, start_ym, end_ym)
