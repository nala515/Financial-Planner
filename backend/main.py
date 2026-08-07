from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from datetime import date
from .database import engine, SessionLocal
from .models import Base
from . import services, schemas
from .schemas import DebugRequest
from .account_categories import ACCOUNT_CATEGORIES

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

class NoCacheStaticFiles(StaticFiles):
    def file_response(self, *args, **kwargs):
        response = super().file_response(*args, **kwargs)
        response.headers["Cache-Control"] = "no-cache"
        return response

app.mount(
    "/static",
    NoCacheStaticFiles(directory="frontend"),
    name="static"
)

##-----------------------------------------------------
## Gets
##-----------------------------------------------------

@app.get("/")
def home():
    return FileResponse("frontend/html/index.html")

@app.get("/accounts")
def get_accounts():
    return FileResponse("frontend/html/accounts.html")

@app.get("/balances")
def get_balances():
    return FileResponse("frontend/html/balances.html")

@app.get("/contributions")
def get_contributions():
    return FileResponse("frontend/html/contributions.html")

@app.get("/summary")
def get_summary():
    return FileResponse("frontend/html/summary.html")

@app.get("/editor")
def get_editor():
    return FileResponse("frontend/html/editor.html")

##-----------------------------------------------------
## API Gets
##-----------------------------------------------------

@app.get("/api/accounts")
def api_get_accounts():
    db = SessionLocal()

    try:
        return services.get_accounts(db)
    finally:
        db.close()

@app.get("/api/settings")
def get_settings():
    db = SessionLocal()

    try:
        return services.get_settings(db)
    finally:
        db.close()

@app.get("/api/dashboard")
def api_get_dashboard_summary():
    db = SessionLocal()

    try:
        return services.get_dashboard_summary(db)
    finally:
        db.close()

@app.get("/api/balances")
def api_get_all_balances(
    start: date | None = None,
    end: date | None = None
):
    db = SessionLocal()

    try:
        return services.get_all_balances(
            db,
            start,
            end,
        )
    finally:
        db.close()

@app.get("/api/contributions")
def api_get_all_contributions(
    start: date | None = None,
    end: date | None = None
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

@app.get("/api/account-categories")
def api_get_account_categories():
    return ACCOUNT_CATEGORIES

##-----------------------------------------------------
## Account-specific Gets
##-----------------------------------------------------

@app.get("/api/accounts/{account_id}")
def api_get_account(account_id: int):
    db = SessionLocal()

    try:
        return services.get_account(db, account_id)
    finally:
        db.close()

@app.get("/api/accounts/{account_id}/balances")
def api_get_account_balances(
    account_id: int,
    start: date | None = None,
    end: date | None = None,
):
    db = SessionLocal()

    try:
        return services.get_account_balances(
            db,
            account_id,
            start,
            end,
        )
    finally:
        db.close()

@app.get("/api/accounts/{account_id}/contributions")
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

@app.get("/api/accounts/{account_id}/summary")
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

##-----------------------------------------------------
## Income related Gets
##-----------------------------------------------------

@app.get("/api/income_events")
def api_get_income_events():
    db = SessionLocal()

    try:
        return services.get_income_events(db)
    finally:
        db.close()

@app.get("/api/income_sources")
def api_get_income_sources():
    db = SessionLocal()

    try:
        return services.get_income_sources(db)
    finally:
        db.close()

##-----------------------------------------------------
## Posts
##-----------------------------------------------------

@app.post("/api/account")
def create_account(account_data: schemas.AccountCreate):
    db = SessionLocal()

    try:
        return services.create_account(db, account_data)
    finally:
        db.close()

@app.post("/api/settings")
def create_settings(settings_data: schemas.SettingsCreate):
    db = SessionLocal()

    try:
        return services.create_settings(db, settings_data)
    finally:
        db.close()

@app.post("/api/balance")
def create_balance(balance_data: schemas.BalanceCreate):
    db = SessionLocal()

    try:
        return services.create_balance(db, balance_data)
    finally:
        db.close()

@app.post("/api/contribution")
def create_contribution(contribution_data: schemas.ContributionCreate):
    db = SessionLocal()

    try:
        return services.create_contribution(db, contribution_data)
    finally:
        db.close()

@app.post("/api/income_event")
def create_income_data(income_data: schemas.IncomeEventCreate):
    db = SessionLocal()

    try:
        return services.create_income_data(db, income_data)
    finally:
        db.close()

@app.post("/api/income_source")
def create_income_source(source_data: schemas.IncomeSourceCreate):
    db = SessionLocal()

    try:
        return services.create_income_source(db, source_data)
    finally:
        db.close()

@app.post("/api/debug")
def print_debug(request: DebugRequest):
    print(request.msg)
    return {"status": "ok"}

##-----------------------------------------------------
## Patches
##-----------------------------------------------------

@app.patch("/api/accounts/{account_id}")
def update_account(account_id: int, account_data: schemas.AccountUpdate):
    db = SessionLocal()

    try:
        return services.update_account(db, account_id, account_data)
    finally:
        db.close()

@app.patch("/api/settings")
def update_settings(settings_data: schemas.SettingsUpdate):
    db = SessionLocal()

    try:
        return services.update_settings(db, settings_data)
    finally:
        db.close()

##-----------------------------------------------------
## Deletes
##-----------------------------------------------------

@app.delete("/api/accounts/{account_id}")
def delete_account(account_id: int):
    db = SessionLocal()

    try:
        return services.delete_account(db, account_id)
    finally:
        db.close()

@app.delete("/api/accounts")
def delete_all_accounts():
    db = SessionLocal()

    try:
        return services.delete_all_accounts(db)
    finally:
        db.close()

@app.delete("/api/balance/{balance_id}")
def delete_balance(balance_id: int):
    db = SessionLocal()

    try:
        return services.delete_balance(db, balance_id)
    finally:
        db.close()

@app.delete("/api/contribution/{contribution_id}")
def delete_contribution(contribution_id: int):
    db = SessionLocal()

    try:
        return services.delete_contribution(db, contribution_id)
    finally:
        db.close()
