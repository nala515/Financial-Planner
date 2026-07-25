from sqlalchemy.orm import Session
from datetime import date

from .schemas import AccountCreate, MonthlyBalanceCreate, ContributionCreate
from .repositories import accounts_repository, balances_repository, contributions_repository
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

    if len(balances) < 2:
        return None

    start_balance = balances[0].balance_cents
    end_balance = balances[-1].balance_cents

    contributions = calculate_total_contributions(
        db,
        account_id,
        start,
        end,
    )

    growth = end_balance - start_balance
    investment_return = growth - contributions

    return {
        "starting_balance": start_balance,
        "ending_balance": end_balance,
        "growth": growth,
        "contributions": contributions,
        "investment_return": investment_return,
    }

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

def get_monthly_balances(db: Session, account_id: int, start: date | None = None, end: date | None = None):
    return balances_repository.db_get_monthly_balances(db, account_id, start, end)

def get_monthly_contributions(db: Session, account_id: int, start: date | None = None, end: date | None = None):
    return contributions_repository.db_get_contributions(db, account_id, start, end)

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