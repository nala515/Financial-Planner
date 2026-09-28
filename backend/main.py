from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from datetime import date
from backend.database import engine, SessionLocal
from backend.models import Base
from backend.schemas import DebugRequest
from backend.account_categories import ACCOUNT_CATEGORIES
from backend.routers import pages, accounts, balances, contributions, data_integrity, income, settings, summary

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

app.include_router(pages.router)
app.include_router(accounts.router)
app.include_router(balances.router)
app.include_router(contributions.router)
app.include_router(data_integrity.router)
app.include_router(income.router)
app.include_router(settings.router)
app.include_router(summary.router)


@app.post("/api/debug")
def print_debug(request: DebugRequest):
    print(request.msg)
    return {"status": "ok"}
