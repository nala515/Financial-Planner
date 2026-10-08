
from fastapi import APIRouter
from backend.database import SessionLocal
from backend import services, schemas
from backend.account_categories import ACCOUNT_CATEGORIES, ACCOUNT_VIEWS

router = APIRouter()


@router.get("/api/accounts")
def api_get_accounts():
    db = SessionLocal()

    try:
        return services.get_accounts(db)
    finally:
        db.close()


@router.get("/api/accounts/{account_id}")
def api_get_account(account_id: int):
    db = SessionLocal()

    try:
        return services.get_account(db, account_id)
    finally:
        db.close()


@router.get("/api/account-categories")
def api_get_account_categories():
    return ACCOUNT_CATEGORIES

@router.get("/api/account-views")
def get_account_views():
    return ACCOUNT_VIEWS


@router.post("/api/account")
def create_account(account_data: schemas.AccountCreate):
    db = SessionLocal()

    try:
        return services.create_account(db, account_data)
    finally:
        db.close()

@router.patch("/api/accounts/{account_id}")
def update_account(account_id: int, account_data: schemas.AccountUpdate):
    db = SessionLocal()

    try:
        return services.update_account(db, account_id, account_data)
    finally:
        db.close()

@router.delete("/api/accounts/{account_id}")
def delete_account(account_id: int):
    db = SessionLocal()

    try:
        return services.delete_account(db, account_id)
    finally:
        db.close()

@router.delete("/api/accounts")
def delete_all_accounts():
    db = SessionLocal()

    try:
        return services.delete_all_accounts(db)
    finally:
        db.close()
