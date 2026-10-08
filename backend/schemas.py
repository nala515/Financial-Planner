from pydantic import BaseModel, ConfigDict
from datetime import date

##-----------------------------------------------------
## Creates
##-----------------------------------------------------

class AccountCreate(BaseModel):
    name: str
    shared: bool
    category: str

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

class MonthlyEntryCreate(BaseModel):
    account_id: int
    balance_cents: int
    contribution_cents: int = 0

##-----------------------------------------------------
## Updates
##-----------------------------------------------------

class AccountUpdate(BaseModel):
    name: str | None = None
    shared: bool | None = None
    category: str | None = None

class SettingsUpdate(BaseModel):
    hide_disabled_accounts: bool | None = None

class IncomeSourceUpdate(BaseModel):
    name: str | None = None

##-----------------------------------------------------
## Other
##-----------------------------------------------------

class SettingsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    hide_disabled_accounts: bool

class MissingEntryRow(BaseModel):
    account_name: str
    year: int
    month: str
    balance: str
    contribution: str

class DebugRequest(BaseModel):
    msg: str
