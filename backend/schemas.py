from pydantic import BaseModel
from datetime import date

##-----------------------------------------------------
## Creates
##-----------------------------------------------------

class AccountCreate(BaseModel):
    name: str
    shared: bool
    category: str

class SettingsCreate(BaseModel):
    group_cash_accounts: bool
    hide_disabled_accounts: bool
    show_retirement_accounts: bool

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

##-----------------------------------------------------
## Updates
##-----------------------------------------------------

class AccountUpdate(BaseModel):
    name: str | None = None
    shared: bool | None = None
    category: str | None = None

class SettingsUpdate(BaseModel):
    group_cash_accounts: bool | None = None
    hide_disabled_accounts: bool | None = None
    show_retirement_accounts: bool | None = None
    
class IncomeSourceUpdate(BaseModel):
    name: str | None = None