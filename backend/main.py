from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import date
from .database import engine, SessionLocal
from .models import Base
import backend.services, backend.schemas

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

@app.get("/")
def hello():
    return {"message": "Hello, Jacqueline!"}

@app.get("/accounts")
def api_get_accounts():
    db = SessionLocal()

    try:
        return services.get_accounts(db)
    finally:
        db.close()

@app.get("/dashboard")
def api_get_dashboard_summary():
    db = SessionLocal()

    try:
        return services.get_dashboard_summary(db)
    finally:
        db.close()

@app.get("/accounts/{account_id}")
def api_get_account(account_id: int):
    db = SessionLocal()

    try:
        return services.get_account(db, account_id)
    finally:
        db.close()

@app.get("/accounts/{account_id}/balances")
def api_get_balances(
    account_id: int,
    start: date | None = None,
    end: date | None = None,
):
    db = SessionLocal()

    try:
        return services.get_monthly_balances(
            db,
            account_id,
            start,
            end,
        )
    finally:
        db.close()

@app.get("/accounts/{account_id}/growth")
def api_get_growth(
    account_id: int,
    start: date,
    end: date,
):
    db = SessionLocal()

    try:
        return services.calculate_growth(
            db,
            account_id,
            start,
            end,
        )
    finally:
        db.close()

@app.post("/account")
def create_account(account_data: schemas.AccountCreate):
    db = SessionLocal()

    try:
        return services.create_account(db, account_data)
    finally:
        db.close()

@app.patch("/accounts/{account_id}")
def update_account(account_id: int, account_data: schemas.AccountUpdate):
    db = SessionLocal()

    try:
        return services.update_account(db, account_id, account_data)
    finally:
        db.close()
    
@app.post("/monthly_balance")
def create_monthly_balance(balance_data: schemas.MonthlyBalanceCreate):
    db = SessionLocal()

    try:
        return services.create_monthly_balance(db, balance_data)
    finally:
        db.close()

@app.post("/contribution")
def create_contribution(contribution_data: schemas.ContributionCreate):
    db = SessionLocal()

    try:
        return services.create_contribution(db, contribution_data)
    finally:
        db.close()

@app.delete("/accounts/{account_id}")
def delete_account(account_id: int):
    db = SessionLocal()

    try:
        return services.delete_account(db, account_id)
    finally:
        db.close()

@app.delete("/accounts")
def delete_all_accounts():
    db = SessionLocal()

    try:
        return services.delete_all_accounts(db)
    finally:
        db.close()

@app.delete("/monthly_balance/{balance_id}")
def delete_monthly_balance(balance_id: int):
    db = SessionLocal()

    try:
        return services.delete_monthly_balance(db, balance_id)
    finally:
        db.close()

@app.delete("/contribution/{contribution_id}")
def delete_contribution(contribution_id: int):
    db = SessionLocal()

    try:
        return services.delete_contribution(db, contribution_id)
    finally:
        db.close()
