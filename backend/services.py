from sqlalchemy.orm import Session
from datetime import date

from .schemas import AccountCreate, MonthlyBalanceCreate, ContributionCreate, IncomeEventCreate, IncomeSourceCreate
from .repositories import accounts_repository, balances_repository, contributions_repository, income_repository
from .account_categories import get_category_attributes

##-----------------------------------------------------
## Utilities
##-----------------------------------------------------

def calculate_total_contributions(
    db: Session,
    account_id: int,
    start: date,
    end: date,
):
    contributions = contributions_repository.db_get_contributions(
        db,
        account_id,
        start,
        end,
    )

    return sum(c.amount_cents for c in contributions)

def calculate_growth(
    db: Session,
    account_id: int,
    start: date,
    end: date,
):
    balances = balances_repository.db_get_monthly_balances(
        db,
        account_id,
        start,
        end,
    )

    # Ensure ascending order by date so month-over-month pairs are correct,
    # regardless of what order the repository returns them in.
    balances = sorted(balances, key=lambda b: b.snapshot_date)

    if len(balances) < 2:
        return []

    results = []

    for i in range(1, len(balances)):
        prev_balance = balances[i - 1]
        curr_balance = balances[i]

        contributions = calculate_total_contributions(
            db,
            account_id,
            prev_balance.snapshot_date,
            curr_balance.snapshot_date,
        )

        growth = curr_balance.balance_cents - prev_balance.balance_cents
        investment_return = growth - contributions

        results.append({
            "month": curr_balance.snapshot_date,
            "starting_balance": prev_balance.balance_cents,
            "ending_balance": curr_balance.balance_cents,
            "growth": growth,
            "contributions": contributions,
            "investment_return": investment_return,
        })

    return results

##-----------------------------------------------------
## Dashboard
##-----------------------------------------------------

def get_dashboard_summary(db: Session):
    accounts = accounts_repository.db_get_accounts(db)
    latest_balances = []

    for account in accounts:
        balances = balances_repository.db_get_monthly_balances(db, account.id)
        latest_balance = balances[-1].balance_cents if balances else 0
        latest_balances.append((account, latest_balance))

    net_worth = sum(balance for _, balance in latest_balances)

    categories = {
        "retirement": 0,
        "non_retirement": 0,
        "cash": 0,
        "spendable": 0,
    }

    for account, balance in latest_balances:
        category_name = account.category or "Cash"
        category_attributes = get_category_attributes(category_name)

        if category_attributes.get("retirement"):
            categories["retirement"] += balance
        else:
            categories["non_retirement"] += balance

        if category_name == "Cash":
            categories["cash"] += balance

        if category_attributes.get("spendable"):
            categories["spendable"] += balance

    return {
        "net_worth": net_worth,
        "categories": categories,
    }

##-----------------------------------------------------
## Getters
##-----------------------------------------------------

def get_account(db: Session, account_id: int):
    account = accounts_repository.db_get_account(db, account_id)
    if account is None:
        return None

    return {
        "id": account.id,
        "name": account.name,
        "shared": account.shared,
        "category": account.category,
        "category_attributes": get_category_attributes(account.category),
    }


def get_accounts(db: Session):
    accounts = accounts_repository.db_get_accounts(db)
    return [
        {
            "id": account.id,
            "name": account.name,
            "shared": account.shared,
            "category": account.category,
            "category_attributes": get_category_attributes(account.category),
        }
        for account in accounts
    ]

def get_all_balances(db: Session):
    balances = balances_repository.db_get_all_balances(db)
    return [
        {
            "id": balance.id,
            "account_id": balance.account_id,
            "snapshot_date": balance.snapshot_date,
            "balance_cents": balance.balance_cents,
        }
        for balance in balances
    ]

def get_all_contributions(db: Session):
    contributions = contributions_repository.db_get_all_contributions(db)
    return [
        {
            "id": contribution.id,
            "account_id": contribution.account_id,
            "date": contribution.date,
            "amount_cents": contribution.amount_cents,
        }
        for contribution in contributions
    ]

def get_monthly_balances(db: Session, account_id: int, start: date | None = None, end: date | None = None):
    return balances_repository.db_get_monthly_balances(db, account_id, start, end)

def get_monthly_contributions(db: Session, account_id: int, start: date | None = None, end: date | None = None):
    return contributions_repository.db_get_contributions(db, account_id, start, end)

def get_income_events(db: Session, start: date | None = None, end: date | None = None):
    return income_repository.db_get_income_events(db, start, end)

def get_income_sources(db: Session):
    sources = income_repository.db_get_income_sources(db)
    return [
        {
            "id": source.id,
            "name": source.name,
        }
        for source in sources
    ]

##-----------------------------------------------------
## Creates
##-----------------------------------------------------

def create_account(db: Session, account_data: AccountCreate):
    account = accounts_repository.db_create_account(db, account_data)

    return {
        "id": account.id,
        "status": "created"
    }

def create_monthly_balance(db: Session, balance_data: MonthlyBalanceCreate):

    balance = balances_repository.db_create_monthly_balance(db, balance_data)

    return {
        "id": balance.id,
        "status": "created"
    }

def create_contribution(db: Session, contribution_data: ContributionCreate):

    contribution = contributions_repository.db_create_contribution(db, contribution_data)

    return {
        "id": contribution.id,
        "status": "created"
    }

def create_income_event(db: Session, income_data: IncomeEventCreate):

    income_event = income_repository.db_create_income_event(db, income_data)

    return {
        "id": income_event.id,
        "status": "created"
    }

def create_income_source(db: Session, source_data: IncomeSourceCreate):
    source = income_repository.db_create_income_source(db, source_data)

    return {
        "id": source.id,
        "status": "created"
    }

##-----------------------------------------------------
## Deletes
##-----------------------------------------------------

def delete_account(db: Session, account_id: int):
    deleted = accounts_repository.db_delete_account(db, account_id)

    return {
        "id": account_id,
        "status": "deleted" if deleted else "not_found",
    }


def delete_all_accounts(db: Session):
    deleted_count = accounts_repository.db_delete_all_accounts(db)

    return {
        "status": "deleted",
        "deleted_count": deleted_count,
    }


def delete_monthly_balance(db: Session, balance_id: int):
    deleted = balances_repository.db_delete_monthly_balance(db, balance_id)

    return {
        "id": balance_id,
        "status": "deleted" if deleted else "not_found",
    }


def delete_contribution(db: Session, contribution_id: int):
    deleted = contributions_repository.db_delete_contribution(db, contribution_id)

    return {
        "id": contribution_id,
        "status": "deleted" if deleted else "not_found",
    }

def delete_income_event(db: Session, event_id: int):
    deleted = income_repository.db_delete_income_event(db, event_id)

    return {
        "id": event_id,
        "status": "deleted" if deleted else "not_found",
    }

def delete_income_source(db: Session, source_id: int):
    deleted = income_repository.db_delete_income_source(db, source_id)

    return {
        "id": source_id,
        "status": "deleted" if deleted else "not_found",
    }

def delete_all_income_sources(db: Session):
    deleted_count = income_repository.db_delete_all_income_sources(db)

    return {
        "status": "deleted",
        "deleted_count": deleted_count,
    }

##-----------------------------------------------------
## Updates
##-----------------------------------------------------

def update_account(db: Session, account_id: int, account_data):
    account = accounts_repository.db_update_account(db, account_id, account_data)

    if account is None:
        return {"id": account_id, "status": "not_found"}

    return {
        "id": account.id,
        "name": account.name,
        "shared": account.shared,
        "category": account.category,
        "status": "updated",
    }

def update_income_source(db: Session, source_id: int, source_data):
    source = income_repository.db_update_income_source(db, source_id, source_data)

    if source is None:
        return {"id": source_id, "status": "not_found"}

    return {
        "id": source.id,
        "name": source.name,
        "status": "updated",
    }
