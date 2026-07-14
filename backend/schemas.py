from pydantic import BaseModel
from datetime import date

class AccountCreate(BaseModel):
    name: str
    account_type: str
    shared: bool

class AccountUpdate(BaseModel):
    name: str

class MonthlyBalanceCreate(BaseModel):
    account_id: int
    snapshot_date: date
    balance_cents: int

class ContributionCreate(BaseModel):
    account_id: int
    snapshot_date: date
    amount_cents: int

#class IncomeCreate(BaseModel):
    