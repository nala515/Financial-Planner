from fastapi import APIRouter
from datetime import date
from backend.database import SessionLocal
from backend import services, schemas

router = APIRouter()

@router.get("/api/balances")
def api_get_all_balances(
    start: date | None = None,
    end: date | None = None,
):
    db = SessionLocal()

    try:
        return services.get_all_balances(db, start, end)
    finally:
        db.close()

@router.get("/api/accounts/{account_id}/balances")
def api_get_account_balances(
    account_id: int,
    start: date | None = None,
    end: date | None = None,
):
    db = SessionLocal()
    try:
        return services.get_account_balances(db, account_id, start, end)
    finally:
        db.close()

@router.post("/api/balance")
def create_balance(balance_data: schemas.BalanceCreate):
    db = SessionLocal()
    try:
        return services.create_balance(db, balance_data)
    finally:
        db.close()

@router.delete("/api/balance/{balance_id}")
def delete_balance(balance_id: int):
    db = SessionLocal()
    try:
        return services.delete_balance(db, balance_id)
    finally:
        db.close()
