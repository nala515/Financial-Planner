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

class BalanceCreate(BaseModel):
    account_id: int
    date: date
    balance_cents: int

class ContributionCreate(BaseModel):
    account_id: int
    date: date
    amount_cents: int

class IncomeEventCreate(BaseModel):
    source_id: int
    date: date
    amount_cents: int

class IncomeSourceCreate(BaseModel):
    name: str

class IncomeSourceUpdate(BaseModel):
    name: str | None = None
    
