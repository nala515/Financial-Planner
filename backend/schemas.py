from pydantic import BaseModel
from datetime import date

class AccountCreate(BaseModel):
    name: str
    shared: bool
    category: str | None = None

class AccountUpdate(BaseModel):
    name: str | None = None
    shared: bool | None = None
    category: str | None = None

class MonthlyBalanceCreate(BaseModel):
    account_id: int
    snapshot_date: date
    balance_cents: int

class ContributionCreate(BaseModel):
    account_id: int
    snapshot_date: date
    amount_cents: int

class IncomeEventCreate(BaseModel):
    source_id: int
    snapshot_date: date
    amount_cents: int

class IncomeSourceCreate(BaseModel):
    name: str
    
