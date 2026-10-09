from pydantic import BaseModel, ConfigDict, Field, model_validator
from datetime import date
from typing import Literal

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

##-----------------------------------------------------
## Growth page
##-----------------------------------------------------

MONTH_PATTERN = r"^\d{4}-(0[1-9]|1[0-2])$"  # "YYYY-MM"

class ContributionStep(BaseModel):
    """From from_month onward, contribute monthly_cents per month, until the next step. from_month=None means the projection start."""
    from_month: str | None = Field(default=None, pattern=MONTH_PATTERN)
    monthly_cents: int = Field(ge=0)

class ContributionPlan(BaseModel):
    """Monthly contribution plan for one group of accounts (retirement or non-retirement)."""
    schedule: list[ContributionStep] | None = Field(default=None, max_length=24)  # None = use the trailing 12-month average
    target_account_id: int | None = None  # None = split across the group's accounts

    @model_validator(mode="after")
    def check_schedule(self):
        steps = self.schedule
        if not steps:
            return self

        if any(step.from_month is None for step in steps[1:]):
            raise ValueError("Only the first contribution step may leave from_month empty.")

        months = [step.from_month for step in steps if step.from_month is not None]
        if months != sorted(set(months)):
            raise ValueError("Contribution step months must be unique and in ascending order.")

        return self

class GrowthProjectionRequest(BaseModel):
    account_ids: list[int]
    years: int = Field(default=30, ge=1, le=60)
    return_mode: Literal["historical", "manual"] = "historical"
    manual_return_pct: float = Field(default=7.0, allow_inf_nan=False)  # used in manual mode, and as the last-resort fallback
    spread_pct: float = Field(default=2.0, ge=0, le=10)  # low/high band is the rate -/+ this many points
    history_window_months: Literal[12, 24, 36] = 36
    history_from: str | None = Field(default=None, pattern=MONTH_PATTERN)  # None = all history
    inflation: bool = False
    inflation_pct: float = Field(default=3.0, ge=0, le=20)
    non_retirement: ContributionPlan = Field(default_factory=ContributionPlan)
    retirement: ContributionPlan = Field(default_factory=ContributionPlan)

class AppliedContributionStep(BaseModel):
    from_month: str
    monthly_cents: int

class GrowthAccountRate(BaseModel):
    id: int
    name: str
    group: Literal["non_retirement", "retirement"]
    rate_pct: float
    source: Literal["own", "group_fallback", "all_fallback", "manual"]
    months_used: int

class GrowthContributionInfo(BaseModel):
    trailing_avg_cents: int
    applied_schedule: list[AppliedContributionStep]

class GrowthProjectionResponse(BaseModel):
    dates: list[str]  # "YYYY-MM", one per month, shared by every series below
    actual: list[int | None]  # cents; None after the projection start
    low: list[int | None]  # cents; None before the projection start
    base: list[int | None]
    high: list[int | None]
    projection_start: str | None
    accounts: list[GrowthAccountRate]
    non_retirement: GrowthContributionInfo | None  # None when no selected account is in this group
    retirement: GrowthContributionInfo | None
    ignored_ids: list[int]  # requested ids that were unknown or not invested accounts
