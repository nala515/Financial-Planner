from fastapi import APIRouter
from fastapi.responses import FileResponse

router = APIRouter()


##-----------------------------------------------------
## Gets
##-----------------------------------------------------

@router.get("/")
def home():
    return FileResponse("frontend/index.html")

@router.get("/accounts")
def get_accounts():
    return FileResponse("frontend/raw-data/accounts.html")

@router.get("/balances")
def get_balances():
    return FileResponse("frontend/raw-data/balances.html")

@router.get("/contributions")
def get_contributions():
    return FileResponse("frontend/raw-data/contributions.html")

@router.get("/income")
def get_income():
    return FileResponse("frontend/raw-data/income.html")

@router.get("/expenses")
def get_expenses():
    return FileResponse("frontend/cash-flow/expenses.html")

@router.get("/money-movement")
def get_money_movement():
    return FileResponse("frontend/cash-flow/money-movement.html")

@router.get("/savings")
def get_savings():
    return FileResponse("frontend/cash-flow/savings.html")

@router.get("/summary")
def get_summary():
    return FileResponse("frontend/growth/summary.html")

@router.get("/growth-investment")
def get_growth_investment():
    return FileResponse("frontend/growth/growth-investment.html")

@router.get("/growth-retirement")
def get_growth_retirement():
    return FileResponse("frontend/growth/growth-retirement.html")

@router.get("/editor")
def get_editor():
    return FileResponse("frontend/manage-data/editor.html")

@router.get("/add-entry")
def get_add_entry():
    return FileResponse("frontend/manage-data/add-entry.html")

@router.get("/settings")
def get_settings():
    return FileResponse("frontend/manage-data/settings.html")
