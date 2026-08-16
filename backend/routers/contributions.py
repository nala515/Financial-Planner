

from fastapi import APIRouter
from datetime import date
from backend.database import SessionLocal
from backend import services, schemas

router = APIRouter()


@router.get("/api/contributions")
def api_get_all_contributions(
    start: date | None = None,
    end: date | None = None,
):
    db = SessionLocal()

    try:
        return services.get_all_contributions(
            db,
            start,
            end,
        )
    finally:
        db.close()


@router.get("/api/accounts/{account_id}/contributions")
def api_get_account_contributions(
    account_id: int,
    start: date | None = None,
    end: date | None = None,
):
    db = SessionLocal()

    try:
        return services.get_account_contributions(
            db,
            account_id,
            start,
            end,
        )
    finally:
        db.close()


@router.post("/api/contribution")
def create_contribution(contribution_data: schemas.ContributionCreate):
    db = SessionLocal()

    try:
        return services.create_contribution(db, contribution_data)
    finally:
        db.close()


@router.delete("/api/contribution/{contribution_id}")
def delete_contribution(contribution_id: int):
    db = SessionLocal()

    try:
        return services.delete_contribution(db, contribution_id)
    finally:
        db.close()
